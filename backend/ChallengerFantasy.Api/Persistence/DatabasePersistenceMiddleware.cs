using ChallengerFantasy.Api.Options;
using ChallengerFantasy.Api.Services;
using Microsoft.Extensions.Options;

namespace ChallengerFantasy.Api.Persistence;

/// <summary>
/// Compatibility bridge for the existing synchronous domain service. It serializes
/// requests inside this API process and persists successful mutations. Startup
/// hydration makes the in-process state authoritative for this single API instance.
/// Remove this middleware as services migrate to
/// focused repositories and normal per-command database transactions.
/// </summary>
public sealed class DatabasePersistenceMiddleware(
    RequestDelegate next,
    IOptions<DatabaseOptions> options,
    PostgresStateRepository repository,
    InMemoryFantasyStore store)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task InvokeAsync(HttpContext context)
    {
        if (!options.Value.Enabled
            || context.Request.Path.StartsWithSegments("/health")
            || context.Request.Path.StartsWithSegments("/swagger"))
        {
            await next(context);
            return;
        }

        await Gate.WaitAsync(context.RequestAborted);
        try
        {
            await next(context);
            if (IsMutation(context.Request.Method))
            {
                if (context.Response.StatusCode < 400)
                    await repository.SaveAsync(store, context.RequestAborted);
                else
                    await repository.LoadAsync(store, context.RequestAborted);
            }
        }
        catch
        {
            // Restore the last committed state if persistence itself fails after
            // the domain service has already changed the in-memory aggregate.
            await repository.LoadAsync(store, CancellationToken.None);
            throw;
        }
        finally
        {
            Gate.Release();
        }
    }

    private static bool IsMutation(string method) =>
        HttpMethods.IsPost(method) || HttpMethods.IsPut(method)
        || HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);
}
