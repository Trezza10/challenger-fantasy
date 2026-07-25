using System.Security.Claims;
using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Services;

var tests = new (string Name, Action Run)[]
{
    ("matchup maps the authenticated user's inventory", MatchupUsesUserInventory),
    ("valid card play consumes inventory", ValidCardPlayConsumesInventory),
    ("invalid card target is rejected", InvalidCardTargetIsRejected),
    ("duplicate lineup player is rejected", DuplicateLineupPlayerIsRejected),
    ("commissioner roles are recognized", CommissionerRolesAreRecognized),
};

var failures = 0;
foreach (var test in tests)
{
    try
    {
        test.Run();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception exception)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {test.Name}: {exception.Message}");
    }
}

return failures == 0 ? 0 : 1;

static FantasyService CreateService() => new(new InMemoryFantasyStore());

static void MatchupUsesUserInventory()
{
    var matchup = CreateService().GetMatchup("challengers", "user_test");
    Assert(matchup.Hand.Count > 0, "Expected a seeded hand.");
    Assert(matchup.LeagueMatchups.Count == 1, "Expected the primary matchup summary.");
}

static void ValidCardPlayConsumesInventory()
{
    var service = CreateService();
    var before = service.GetMatchup("challengers", "user_test");
    service.PlayCard("challengers", "user_test", new PlayCardRequest("ground-control", "jahmyr-gibbs"));
    var after = service.GetMatchup("challengers", "user_test");
    Assert(before.Hand.Sum(card => card.Quantity) == after.Hand.Sum(card => card.Quantity) + 1, "The played card was not consumed.");
    Assert(after.InitialModifiers.Count == 1, "The card play was not attached to the matchup.");
}

static void InvalidCardTargetIsRejected()
{
    var service = CreateService();
    AssertThrows<ApiException>(
        () => service.PlayCard("challengers", "user_test", new PlayCardRequest("ground-control", "josh-allen")),
        "Expected an opponent target to be rejected for a self card.");
}

static void DuplicateLineupPlayerIsRejected()
{
    var service = CreateService();
    var roster = service.GetRoster("challengers", "user_test");
    var starters = roster.Starters
        .Select((slot, index) => new LineupSlotRequest(slot.Id, index < 2 ? roster.Starters[0].Player.Id : slot.Player.Id))
        .ToArray();
    var bench = roster.Bench.Select(slot => new LineupSlotRequest(slot.Id, slot.Player.Id)).ToArray();
    AssertThrows<ApiException>(
        () => service.SaveLineup("challengers", "user_test", new SaveLineupRequest(starters, bench)),
        "Expected a duplicate player to be rejected.");
}

static void CommissionerRolesAreRecognized()
{
    var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("org_role", "org:admin")], "test"));
    Assert(ClerkClaims.HasAnyRole(principal, "org:admin"), "Expected org:admin to satisfy the role check.");
}

static void Assert(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

static void AssertThrows<T>(Action action, string message) where T : Exception
{
    try
    {
        action();
    }
    catch (T)
    {
        return;
    }
    throw new InvalidOperationException(message);
}
