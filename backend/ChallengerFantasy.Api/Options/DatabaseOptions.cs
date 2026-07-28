namespace ChallengerFantasy.Api.Options;

/// <summary>
/// Controls the optional PostgreSQL persistence adapter. Keep Enabled=false when
/// running the API without PostgreSQL (for example, fast unit tests).
/// </summary>
public sealed class DatabaseOptions
{
    public const string SectionName = "Database";
    public bool Enabled { get; init; }
    public bool ApplySchemaOnStartup { get; init; }
    public int CommandTimeoutSeconds { get; init; } = 30;
}
