using System.Security.Claims;
using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Domain;
using ChallengerFantasy.Api.Services;
using ChallengerFantasy.Api.Options;
using Microsoft.Extensions.Options;

var tests = new (string Name, Action Run)[]
{
    ("matchup maps the authenticated user's inventory", MatchupUsesUserInventory),
    ("valid card play consumes inventory", ValidCardPlayConsumesInventory),
    ("invalid card target is rejected", InvalidCardTargetIsRejected),
    ("duplicate lineup player is rejected", DuplicateLineupPlayerIsRejected),
    ("commissioner roles are recognized", CommissionerRolesAreRecognized),
    ("league creation and invitation join lifecycle", LeagueInvitationLifecycle),
    ("demo data is opt-in", DemoDataIsOptIn),
    ("joined manager receives empty team and matchup data", JoinedManagerGetsTeamData),
    ("weekly card claims persist offers and enforce allowances", WeeklyCardClaimsAreProtected),
    ("league posts require membership and preserve image placement", LeaguePostsAreProtected),
    ("player scoring breakdowns reconcile to displayed totals", PlayerBreakdownsReconcile),
    ("trades enter league review and auto-approve after the window", TradesAutoApprove),
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

static FantasyService CreateService() => new(new InMemoryFantasyStore(Options.Create(new DevelopmentDataOptions { SeedDemoData = true })));

static void MatchupUsesUserInventory()
{
    var matchup = CreateService().GetMatchup("challengers", "user_demo");
    Assert(matchup.Hand.Count > 0, "Expected a seeded hand.");
    Assert(matchup.LeagueMatchups.Count == 1, "Expected the primary matchup summary.");
}

static void ValidCardPlayConsumesInventory()
{
    var service = CreateService();
    var before = service.GetMatchup("challengers", "user_demo");
    service.PlayCard("challengers", "user_demo", new PlayCardRequest("ground-control", "jahmyr-gibbs"));
    var after = service.GetMatchup("challengers", "user_demo");
    Assert(before.Hand.Sum(card => card.Quantity) == after.Hand.Sum(card => card.Quantity) + 1, "The played card was not consumed.");
    Assert(after.InitialModifiers.Count == 1, "The card play was not attached to the matchup.");
}

static void InvalidCardTargetIsRejected()
{
    var service = CreateService();
    AssertThrows<ApiException>(
        () => service.PlayCard("challengers", "user_demo", new PlayCardRequest("ground-control", "josh-allen")),
        "Expected an opponent target to be rejected for a self card.");
}

static void DuplicateLineupPlayerIsRejected()
{
    var service = CreateService();
    var roster = service.GetRoster("challengers", "user_demo");
    var starters = roster.Starters
        .Select((slot, index) => new LineupSlotRequest(slot.Id, index < 2 ? roster.Starters[0].Player.Id : slot.Player.Id))
        .ToArray();
    var bench = roster.Bench.Select(slot => new LineupSlotRequest(slot.Id, slot.Player.Id)).ToArray();
    AssertThrows<ApiException>(
        () => service.SaveLineup("challengers", "user_demo", new SaveLineupRequest(starters, bench)),
        "Expected a duplicate player to be rejected.");
}

static void CommissionerRolesAreRecognized()
{
    var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("org_role", "org:admin")], "test"));
    Assert(ClerkClaims.HasAnyRole(principal, "org:admin"), "Expected org:admin to satisfy the role check.");
}

static void LeagueInvitationLifecycle()
{
    var service = CreateService();
    var created = service.CreateLeague("user_commissioner", "Commissioner", "commish@example.com", new CreateLeagueRequest("Friday Night League", "Friday Fire"));
    Assert(created.IsCommissioner, "The creator should be the commissioner.");
    Assert(service.GetLeagues("user_commissioner").Any(league => league.Id == created.LeagueId), "The new league should appear for its creator.");
    Assert(!service.GetLeagues("user_invitee").Any(league => league.Id == created.LeagueId), "Non-members should not see the league.");

    var invitation = service.CreateLeagueInvitation(created.LeagueId, "user_commissioner", new CreateLeagueInvitationRequest("invitee@example.com"));
    var token = new Uri(invitation.InviteUrl).Query.Split("token=", StringSplitOptions.None)[1];
    var joined = service.JoinLeague("user_invitee", "Invitee", "invitee@example.com", new JoinLeagueRequest(Uri.UnescapeDataString(token), "Invitee United"));

    Assert(joined.Role == "member", "An invited user should join as a member.");
    Assert(joined.MemberCount == 2, "Joining should increment the member count.");
    Assert(service.GetLeagues("user_invitee").Any(league => league.Id == created.LeagueId), "The joined league should appear for the invitee.");
    AssertThrows<ApiException>(
        () => service.CreateLeagueInvitation(created.LeagueId, "user_invitee", new CreateLeagueInvitationRequest(null)),
        "A non-commissioner should not be able to invite members.");
}

static void DemoDataIsOptIn()
{
    var service = new FantasyService(new InMemoryFantasyStore());
    Assert(service.GetLeagues("brand_new_user").Count == 0, "A new account should start without seeded leagues.");
}

static void JoinedManagerGetsTeamData()
{
    var service = new FantasyService(new InMemoryFantasyStore());
    var created = service.CreateLeague("creator", "Creator", "creator@example.com", new CreateLeagueRequest("Clean League", "Creator Team", 2));
    var joined = service.JoinLeague("joiner", "Joiner", "joiner@example.com", new JoinLeagueRequest(created.JoinCode, "Joiner Team"));
    var roster = service.GetRoster(joined.LeagueId, "joiner");
    var matchup = service.GetMatchup(joined.LeagueId, "joiner");

    Assert(roster.Starters.Count == 0 && roster.Bench.Count == 0, "A new team should return an empty roster instead of failing.");
    Assert(matchup.LeftTeam.Name == "Joiner Team", "The joined manager should see their own team name.");
    Assert(matchup.Status == "waiting_for_draft" && matchup.LeagueMatchups.Count == 0, "No matchup should be created before the draft.");
    AssertThrows<ApiException>(
        () => service.JoinLeague("late", "Late", "late@example.com", new JoinLeagueRequest(created.JoinCode, "Late Team")),
        "A manager should not be able to join a full league.");
    service.ScheduleDraft(created.LeagueId, "creator", new ScheduleDraftRequest(DateTimeOffset.UtcNow.AddMilliseconds(500)));
    AssertThrows<ApiException>(
        () => service.MakeDraftPick(created.LeagueId, "creator", new DraftPickRequest("jalen-hurts")),
        "A pick should not be accepted before the scheduled start.");
    Thread.Sleep(550);
    AssertThrows<ApiException>(
        () => service.MakeDraftPick(created.LeagueId, "joiner", new DraftPickRequest("jalen-hurts")),
        "A manager should not be able to draft out of order.");
    while (!service.GetDraft(created.LeagueId, "creator").IsComplete)
    {
        var state = service.GetDraft(created.LeagueId, "creator");
        var accepted = false;
        foreach (var player in state.AvailablePlayers)
        {
            try
            {
                service.MakeDraftPick(created.LeagueId, state.CurrentPickerUserId!, new DraftPickRequest(player.Id));
                accepted = true;
                break;
            }
            catch (ApiException)
            {
                // Try the next fake player when this roster has no compatible slot.
            }
        }
        Assert(accepted, "At least one available player should fit the current manager's roster.");
    }
    var ready = service.GetMatchup(joined.LeagueId, "joiner");
    Assert(ready.Status == "ready" && ready.LeagueMatchups.Count == 1, "Completing the draft should create the opening matchup.");
    Assert(ready.PlayerMatchups.Count == 10 && ready.BenchMatchups.Count == 3, "Completed matchups should contain both drafted rosters.");
    var draftedRoster = service.GetRoster(joined.LeagueId, "joiner");
    Assert(draftedRoster.Starters.Count == 10 && draftedRoster.Bench.Count == 3, "Draft picks should fill ten legal starter slots and three bench slots.");
}

static void WeeklyCardClaimsAreProtected()
{
    var store = new InMemoryFantasyStore();
    var service = new FantasyService(store);
    var league = service.CreateLeague("card-user", "Card User", "cards@example.com", new CreateLeagueRequest("Card League", "Card Team", 2));
    var locked = service.GetCardClaim(league.LeagueId, "card-user");
    Assert(locked.RemainingClaims == 0 && locked.Choices.Count == 0, "Card claims should remain locked before the draft.");
    AssertThrows<ApiException>(
        () => service.ClaimCard(league.LeagueId, "card-user", new ClaimCardRequest("locked", "locked")),
        "The backend must reject card claims before the draft.");
    store.Leagues[league.LeagueId] = store.Leagues[league.LeagueId] with { DraftCompleted = true };
    var first = service.GetCardClaim(league.LeagueId, "card-user");
    var repeated = service.GetCardClaim(league.LeagueId, "card-user");
    Assert(first.Allowance == 5 && first.RemainingClaims == 5, "An empty first-season inventory should receive five opening claims.");
    Assert(first.OfferId == repeated.OfferId && first.Choices.Select(card => card.Id).SequenceEqual(repeated.Choices.Select(card => card.Id)), "Refreshing must not reroll an active offer.");
    store.CardClaims.Clear(); // Simulates the database middleware discarding a GET-only in-memory change.
    var reconstructed = service.GetCardClaim(league.LeagueId, "card-user");
    Assert(first.OfferId == reconstructed.OfferId && first.Choices.Select(card => card.Id).SequenceEqual(reconstructed.Choices.Select(card => card.Id)),
        "A database reload between GET and POST must reconstruct the same locked offer.");
    store.CardClaims.Clear();
    AssertThrows<ApiException>(
        () => service.ClaimCard(league.LeagueId, "card-user", new ClaimCardRequest(first.OfferId!, "not-offered")),
        "A card outside the active offer should be rejected.");

    store.CardClaims.Clear(); // The POST itself must reconstruct and accept the offer returned by the earlier GET.
    var state = first;
    while (state.RemainingClaims > 0)
        state = service.ClaimCard(league.LeagueId, "card-user", new ClaimCardRequest(state.OfferId!, state.Choices[0].Id));
    Assert(state.ClaimedCount == 5 && state.Choices.Count == 0, "The opening allocation should stop after five claims.");
    Assert(service.GetMatchup(league.LeagueId, "card-user").Hand.Sum(card => card.Quantity) == 5, "Claimed cards should be added to inventory.");

    service.UpdateLeague(league.LeagueId, "card-user", new LeagueSettingsRequest(2, null));
    var nextWeek = service.GetCardClaim(league.LeagueId, "card-user");
    Assert(nextWeek.Week == 2 && nextWeek.Allowance == 2 && nextWeek.RemainingClaims == 2, "Later weeks should grant two claims.");
}

static void LeaguePostsAreProtected()
{
    var service = new FantasyService(new InMemoryFantasyStore());
    var league = service.CreateLeague("author", "Author", "author@example.com", new CreateLeagueRequest("Post League", "Author Team", 2));
    AssertThrows<ApiException>(
        () => service.GetLeaguePosts(league.LeagueId, "outsider"),
        "Non-members should not be able to read league posts.");
    var image = $"data:image/jpeg;base64,{Convert.ToBase64String([0xFF, 0xD8, 0xFF, 0xD9])}";
    var post = service.CreateLeaguePost(league.LeagueId, "author", new CreateLeaguePostRequest("Weekly Recap", "A close opening matchup.", image, "bottom"));
    Assert(post.AuthorName == "Author" && post.ImagePosition == "bottom", "Posts should preserve the membership author and requested image placement.");
    Assert(service.GetLeaguePosts(league.LeagueId, "author").Single().Id == post.Id, "Published posts should appear in the league feed.");
}

static void PlayerBreakdownsReconcile()
{
    var matchup = CreateService().GetMatchup("challengers", "user_demo");
    var players = matchup.PlayerMatchups.SelectMany(pair => new[] { pair.Left, pair.Right });
    Assert(players.All(player => player.GameStarted || player.Score == 0 && player.ScoreBreakdown.Count == 0), "Pregame players must expose zero points and no scoring stats.");
    var history = CreateService().GetRoster("challengers", "user_demo").Starters.SelectMany(slot => slot.Player.WeeklyHistory).ToArray();
    Assert(history.Length > 0, "Seeded players should include completed weekly game history.");
    Assert(history.All(game => Math.Abs(game.TotalPoints - game.BasePoints - game.CardAdjustment) < 0.001), "Weekly card adjustments must remain separate while reconciling to the fantasy total.");
}

static void TradesAutoApprove()
{
    var store = new InMemoryFantasyStore();
    var service = new FantasyService(store);
    var league = service.CreateLeague("sender", "Sender", "sender@example.com", new CreateLeagueRequest("Trade League", "Senders", 2));
    service.JoinLeague("receiver", "Receiver", "receiver@example.com", new JoinLeagueRequest(league.JoinCode, "Receivers"));
    var card = store.CardCatalog.Values.First();
    store.Hands[(league.LeagueId, "sender")] = [card with { Quantity = 1 }];
    var trade = service.CreateTrade(league.LeagueId, "sender", new CreateTradeRequest("receiver", OfferedCardIds: [card.Id]));
    Assert(trade.Status == "Pending", "A new offer should await the recipient.");
    trade = service.ResolveTrade(league.LeagueId, "receiver", trade.Id, new ResolveTradeRequest("accept"));
    Assert(trade.Status == "LeagueReview" && trade.ReviewEndsAt is not null, "Recipient acceptance should start league review.");
    var index = store.Trades.FindIndex(item => item.Id == trade.Id);
    store.Trades[index] = store.Trades[index] with { ReviewEndsAt = DateTimeOffset.UtcNow.AddSeconds(-1) };
    var finalized = service.GetTrades(league.LeagueId, "sender").Single(item => item.Id == trade.Id);
    Assert(finalized.Status == "Accepted", "An unopposed trade should auto-approve after review.");
    Assert(store.GetOrCreateHand(league.LeagueId, "receiver").Any(item => item.Id == card.Id), "Approved card assets should transfer to the recipient.");
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
