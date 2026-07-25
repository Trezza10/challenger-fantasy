namespace ChallengerFantasy.Api.Options;

public sealed class ApiAuthOptions
{
    public const string SectionName = "ApiAuth";

    public bool Enabled { get; init; }
    public string DevelopmentUserId { get; init; } = "user_demo";
}
