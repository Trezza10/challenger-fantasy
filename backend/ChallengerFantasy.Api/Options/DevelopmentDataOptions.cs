namespace ChallengerFantasy.Api.Options;

public sealed class DevelopmentDataOptions
{
    public const string SectionName = "DevelopmentData";
    public bool SeedDemoData { get; init; }
}
