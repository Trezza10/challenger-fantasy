namespace ChallengerFantasy.Api.Options;

public sealed class ClerkOptions
{
    public const string SectionName = "Clerk";

    public string Authority { get; init; } = "https://example.clerk.accounts.dev";
    public string[] Audiences { get; init; } = [];
    public string[] AuthorizedParties { get; init; } = [];
}
