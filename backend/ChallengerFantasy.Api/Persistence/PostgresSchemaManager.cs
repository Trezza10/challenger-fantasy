using System.Security.Cryptography;
using System.Text;
using ChallengerFantasy.Api.Options;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ChallengerFantasy.Api.Persistence;

/// <summary>
/// Small, migration-tool-neutral script runner. It records a SHA-256 checksum for
/// each applied file and refuses to silently alter an already-applied script.
/// Liquibase can baseline from challenger.schema_scripts later.
/// </summary>
public sealed class PostgresSchemaManager(
    NpgsqlDataSource dataSource,
    IOptions<DatabaseOptions> options,
    IWebHostEnvironment environment,
    ILogger<PostgresSchemaManager> logger)
{
    public async Task ApplyAsync(CancellationToken cancellationToken = default)
    {
        var databaseOptions = options.Value;
        var publishedDirectory = Path.Combine(AppContext.BaseDirectory, "database");
        var sourceDirectory = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "..", "database"));
        var scriptDirectory = Directory.Exists(publishedDirectory) ? publishedDirectory : sourceDirectory;
        var scripts = Directory.GetFiles(scriptDirectory, "*.sql")
            .OrderBy(path => NumericPrefix(Path.GetFileName(path)))
            .ThenBy(path => path, StringComparer.Ordinal)
            .ToArray();

        if (scripts.Length == 0)
            throw new InvalidOperationException($"No database scripts were found in {scriptDirectory}.");

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        foreach (var path in scripts)
        {
            var name = Path.GetFileName(path);
            var sql = await File.ReadAllTextAsync(path, cancellationToken);
            var checksum = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));

            // Bootstrap only the tracker before checking script zero's checksum.
            // We do not execute a changed script before discovering the mismatch.
            if (name == "0_schema.sql")
            {
                await using var bootstrap = new NpgsqlCommand(
                    """
                    CREATE SCHEMA IF NOT EXISTS challenger;
                    CREATE TABLE IF NOT EXISTS challenger.schema_scripts (
                        script_name text PRIMARY KEY,
                        checksum text NOT NULL,
                        applied_at timestamptz NOT NULL DEFAULT now()
                    );
                    """, connection)
                { CommandTimeout = databaseOptions.CommandTimeoutSeconds };
                await bootstrap.ExecuteNonQueryAsync(cancellationToken);
            }

            await using var lookup = new NpgsqlCommand(
                "SELECT checksum FROM challenger.schema_scripts WHERE script_name = $1", connection)
            { CommandTimeout = databaseOptions.CommandTimeoutSeconds };
            lookup.Parameters.AddWithValue(name);
            var existing = (string?)await lookup.ExecuteScalarAsync(cancellationToken);
            if (existing == checksum) continue;
            if (existing is not null)
                throw new InvalidOperationException(
                    $"Database script {name} changed after it was applied. Add a new numbered script instead.");

            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sql, connection, transaction)
            { CommandTimeout = databaseOptions.CommandTimeoutSeconds };
            await command.ExecuteNonQueryAsync(cancellationToken);
            await using var record = new NpgsqlCommand(
                """
                INSERT INTO challenger.schema_scripts(script_name, checksum)
                VALUES ($1, $2)
                ON CONFLICT (script_name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()
                """, connection, transaction);
            record.Parameters.AddWithValue(name);
            record.Parameters.AddWithValue(checksum);
            await record.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Applied database script {Script}", name);
        }
    }

    private static int NumericPrefix(string name) =>
        int.TryParse(name.Split('_', 2)[0], out var value) ? value : int.MaxValue;
}

public sealed class DatabaseStartupService(
    IOptions<DatabaseOptions> options,
    PostgresSchemaManager schema,
    PostgresStateRepository repository,
    Services.InMemoryFantasyStore store,
    ILogger<DatabaseStartupService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!options.Value.Enabled) return;
        if (options.Value.ApplySchemaOnStartup)
            await schema.ApplyAsync(cancellationToken);
        if (await repository.HasStateAsync(cancellationToken))
            await repository.LoadAsync(store, cancellationToken);
        else
            await repository.SaveAsync(store, cancellationToken);
        logger.LogInformation("PostgreSQL persistence is enabled");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
