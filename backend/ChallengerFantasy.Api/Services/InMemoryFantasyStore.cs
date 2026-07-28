using ChallengerFantasy.Api.Domain;
using ChallengerFantasy.Api.Options;
using Microsoft.Extensions.Options;

namespace ChallengerFantasy.Api.Services;

/// <summary>
/// Development persistence boundary. Replace this class with EF Core repositories without changing controllers.
/// </summary>
public sealed class InMemoryFantasyStore
{
    public object SyncRoot { get; } = new();
    public Dictionary<string, League> Leagues { get; } = [];
    public Dictionary<string, Player> Players { get; } = [];
    public Dictionary<string, Matchup> Matchups { get; } = [];
    public Dictionary<(string LeagueId, string UserId), LeagueMembership> Memberships { get; } = [];
    public Dictionary<string, string> LeagueIdsByJoinCode { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, LeagueInvitation> InvitationsByToken { get; } = new(StringComparer.Ordinal);
    public Dictionary<(string LeagueId, string UserId), Roster> Rosters { get; } = [];
    public Dictionary<(string LeagueId, string UserId), List<PowerCard>> Hands { get; } = [];
    public Dictionary<string, PowerCard> CardCatalog { get; } = [];
    public Dictionary<(string LeagueId, string UserId, int Week), CardClaimProgress> CardClaims { get; } = [];
    public List<ActivityEntry> Activities { get; } = [];
    public List<WaiverClaim> Waivers { get; } = [];
    public List<TradeOffer> Trades { get; } = [];
    public List<ChatMessage> Messages { get; } = [];
    public List<DraftPick> DraftPicks { get; } = [];
    public List<LeaguePost> LeaguePosts { get; } = [];
    public List<NewsStory> CommunityPosts { get; } = [];

    public InMemoryFantasyStore(IOptions<DevelopmentDataOptions>? options = null)
    {
        CommunityPosts.AddRange([
            new NewsStory("community-1", "TEAM REPORT", "Philadelphia’s offense enters the week with new red-zone wrinkles", "Beat reporter Lena Ortiz breaks down the personnel packages fantasy managers should watch.", "Philadelphia spent the week emphasizing condensed formations and running-back motion near the goal line. The changes could create additional scoring opportunities across the offense, particularly when defenses commit extra help inside.", DateTimeOffset.UtcNow.AddHours(-2)),
            new NewsStory("community-2", "INJURY WATCH", "Sunday availability remains uncertain for several featured receivers", "Final practice reports will shape lineup decisions around the league.", "Several receiving groups remain fluid heading into the weekend. Managers should monitor official game-status reports and be prepared to adjust before individual kickoffs.", DateTimeOffset.UtcNow.AddHours(-5)),
            new NewsStory("community-3", "FILM ROOM", "Why defensive pressure rates could decide this week’s closest matchups", "Analyst Marcus Chen highlights three fronts creating difficult fantasy decisions.", "Pressure rate has become one of the clearest signals for volatile quarterback and kicker outcomes. This week’s slate includes several mismatches that could also elevate the value of defensive units.", DateTimeOffset.UtcNow.AddHours(-9)),
        ]);
        var cards = new[]
        {
            Card("ground-control", "Ground Control", CardTargetTeam.SELF, ["RB", "FLEX"], "football"),
            Card("pocket-protector", "Pocket Protector", CardTargetTeam.SELF, ["QB"], "shield"),
            Card("momentum-shift", "Momentum Shift", CardTargetTeam.OPPONENT, ["ALL"], "swap-horizontal"),
            Card("air-raid", "Air Raid", CardTargetTeam.SELF, ["QB", "WR", "TE"], "rocket"),
            Card("red-zone-raider", "Red Zone Raider", CardTargetTeam.SELF, ["RB", "WR", "TE"], "flame"),
            Card("shutdown", "Shutdown", CardTargetTeam.OPPONENT, ["WR", "TE"], "lock-closed"),
            Card("breakaway-threat", "Breakaway Threat", CardTargetTeam.SELF, ["RB", "WR", "FLEX"], "flash"),
            Card("ice-the-kicker", "Ice the Kicker", CardTargetTeam.OPPONENT, ["K"], "timer"),
            Card("defensive-surge", "Defensive Surge", CardTargetTeam.SELF, ["DEF"], "shield"),
            Card("coachs-challenge", "Coach's Challenge", CardTargetTeam.SELF, ["COACH"], "checkmark-circle"),
            Card("volume-play", "Volume Play", CardTargetTeam.SELF, ["WR", "TE"], "stats-chart"),
            Card("second-half-sniper", "Second-Half Sniper", CardTargetTeam.SELF, ["QB", "WR"], "radio"),
        };
        foreach (var card in cards) CardCatalog[card.Id] = card;

        var manager = new[]
        {
            Player("jalen-hurts", "J. Hurts", RosterPosition.QB, "PHI", 32.5),
            Player("jahmyr-gibbs", "J. Gibbs", RosterPosition.RB, "DET", 24.4),
            Player("saquon-barkley", "S. Barkley", RosterPosition.RB, "PHI", 19.8),
            Player("ceedee-lamb", "C. Lamb", RosterPosition.WR, "DAL", 21.3),
            Player("justin-jefferson", "J. Jefferson", RosterPosition.WR, "MIN", 18.7),
            Player("travis-kelce", "T. Kelce", RosterPosition.TE, "KC", 13.2),
            Player("bijan-robinson", "B. Robinson", RosterPosition.FLEX, "ATL", 15.4),
            Player("eagles-defense", "Eagles D/ST", RosterPosition.DEF, "PHI", 10),
            Player("jake-elliott", "J. Elliott", RosterPosition.K, "PHI", 9),
            Player("nick-sirianni", "N. Sirianni", RosterPosition.COACH, "PHI", 7),
            Player("jordan-love", "J. Love", RosterPosition.QB, "GB", 0),
            Player("tee-higgins", "T. Higgins", RosterPosition.WR, "CIN", 0),
            Player("niners-defense", "49ers D/ST", RosterPosition.DEF, "SF", 0),
        };
        var opponent = new[]
        {
            Player("josh-allen", "J. Allen", RosterPosition.QB, "BUF", 21.6),
            Player("jonathan-taylor", "J. Taylor", RosterPosition.RB, "IND", 15.6),
            Player("kyren-williams", "K. Williams", RosterPosition.RB, "LAR", 17.2),
            Player("aj-brown", "A. Brown", RosterPosition.WR, "PHI", 17.9),
            Player("puka-nacua", "P. Nacua", RosterPosition.WR, "LAR", 16.4),
            Player("mark-andrews", "M. Andrews", RosterPosition.TE, "BAL", 11.8),
            Player("devonta-smith", "D. Smith", RosterPosition.FLEX, "PHI", 14.1),
            Player("bills-defense", "Bills D/ST", RosterPosition.DEF, "BUF", 8),
            Player("tyler-bass", "T. Bass", RosterPosition.K, "BUF", 8),
            Player("sean-mcdermott", "S. McDermott", RosterPosition.COACH, "BUF", 6),
            Player("cj-stroud", "C. Stroud", RosterPosition.QB, "HOU", 0),
            Player("dj-moore", "D. Moore", RosterPosition.WR, "CHI", 0),
            Player("steelers-defense", "Steelers D/ST", RosterPosition.DEF, "PIT", 0),
        };
        var freeAgents = new[]
        {
            Player("rico-dowdle", "R. Dowdle", RosterPosition.RB, "DAL", 11.7),
            Player("josh-palmer", "J. Palmer", RosterPosition.WR, "LAC", 9.8),
            Player("geno-smith", "G. Smith", RosterPosition.QB, "SEA", 17.1),
            Player("pat-freiermuth", "P. Freiermuth", RosterPosition.TE, "PIT", 8.4),
        };
        foreach (var player in manager.Concat(opponent).Concat(freeAgents))
            Players[player.Id] = player;
        var positions = Enum.GetValues<RosterPosition>();
        for (var index = 1; index <= 260; index++)
        {
            var position = positions[(index - 1) % positions.Length];
            var id = $"prospect-{index:000}";
            Players[id] = Player(id, $"Prospect {index:000}", position, $"T{((index - 1) % 32) + 1:00}", 0);
        }
        if (options?.Value.SeedDemoData != true) return;

        var league = new League("challengers", "Challengers League", 1, 10, 5, true, DateTimeOffset.UtcNow.AddDays(-30), "user_demo");
        Leagues[league.Id] = league;

        const string seedUser = "user_demo";
        Memberships[(league.Id, seedUser)] = new LeagueMembership(league.Id, seedUser, "Development Manager", "manager@example.com", "Trezza Titans", "commissioner", 3, 2, 0, 618.4, 590.2, DateTimeOffset.UtcNow);
        LeagueIdsByJoinCode["CHALLENG"] = league.Id;
        var roster = new Roster(
            manager.Take(10).Select((player, index) => new RosterSlot($"starter-{index}", "starter", player.Position, player)).ToArray(),
            manager.Skip(10).Select((player, index) => new RosterSlot($"bench-{index}", "bench", player.Position, player)).ToArray());
        Rosters[(league.Id, seedUser)] = roster;

        var hand = new List<PowerCard>
        {
            CardCatalog["ground-control"],
            CardCatalog["pocket-protector"],
            CardCatalog["momentum-shift"] with { Quantity = 2 },
        };
        Hands[(league.Id, seedUser)] = hand;

        var pairs = manager.Take(10).Zip(opponent.Take(10), (left, right) => new PlayerMatchup(left, right)).ToArray();
        var benchPairs = manager.Skip(10).Zip(opponent.Skip(10), (left, right) => new PlayerMatchup(left, right)).ToArray();
        Matchups[league.Id] = new Matchup(
            "titans-kings", 5, "Sun 1:05 PM", true, 84,
            new MatchupTeam("titans", "Trezza Titans", 128.4, 142.6, hand),
            new MatchupTeam("kings", "Grid Iron Kings", 119.7, 135.1),
            pairs, benchPairs, []);

        Activities.Add(new ActivityEntry("activity-1", league.Id, "You", "set the Week 5 lineup.", ActivityType.Lineup, DateTimeOffset.UtcNow.AddMinutes(-15)));
        Messages.Add(new ChatMessage("message-1", league.Id, "user_demo", "You", "Ready for Week 5.", DateTimeOffset.UtcNow.AddMinutes(-10)));
    }

    public Roster GetOrCreateRoster(string leagueId, string userId)
    {
        if (Rosters.TryGetValue((leagueId, userId), out var roster)) return roster;
        var seed = Rosters.Values.FirstOrDefault();
        roster = seed is null
            ? new Roster([], [])
            : new Roster(seed.Starters.ToArray(), seed.Bench.ToArray());
        Rosters[(leagueId, userId)] = roster;
        return roster;
    }

    public List<PowerCard> GetOrCreateHand(string leagueId, string userId)
    {
        if (Hands.TryGetValue((leagueId, userId), out var hand)) return hand;
        hand = [];
        Hands[(leagueId, userId)] = hand;
        return hand;
    }

    private static Player Player(string id, string name, RosterPosition position, string team, double score) =>
        new(id, name, position, team, score, 0, false, [new("Status", "Upcoming")], [new("Last game", $"{score:0.0} pts")], ScoringRules.CreateDevelopmentBreakdown(position, score), CreateWeeklyHistory(id, position, score));

    private static IReadOnlyList<PlayerWeekHistory> CreateWeeklyHistory(string id, RosterPosition position, double score)
    {
        if (score <= 0) return [];
        var opponents = new[] { "DAL", "NYG", "WAS", "GB", "MIN", "CHI", "SF", "SEA" };
        var seed = Math.Abs(StringComparer.Ordinal.GetHashCode(id));
        return Enumerable.Range(1, 4).Select(week =>
        {
            var basePoints = Math.Round(Math.Max(1, score + ((seed + week * 7) % 9 - 4) * 0.8), 1);
            var cardPoints = week == 3 && seed % 3 == 0 ? 3d : 0d;
            return new PlayerWeekHistory(week, opponents[(seed + week) % opponents.Length], DevelopmentStatLine(position, basePoints), basePoints, cardPoints);
        }).ToArray();
    }

    private static string DevelopmentStatLine(RosterPosition position, double points) => position switch
    {
        RosterPosition.QB => $"{Math.Round(points / .04):0} pass yds · {Math.Max(1, Math.Floor(points / 10)):0} pass TD",
        RosterPosition.RB or RosterPosition.FLEX => $"{Math.Round(points * 5):0} rush yds · {Math.Max(1, Math.Floor(points / 8)):0} TD",
        RosterPosition.WR or RosterPosition.TE => $"{Math.Max(2, Math.Round(points / 3)):0} rec · {Math.Round(points * 4):0} rec yds",
        RosterPosition.DEF => $"{Math.Max(1, Math.Round(points / 3)):0} sacks · {Math.Max(0, Math.Floor(points / 6)):0} takeaway",
        RosterPosition.K => $"{Math.Max(1, Math.Round(points / 4)):0} FG · {Math.Max(1, Math.Round(points / 3)):0} XP",
        _ => points >= 3 ? "Team win" : "Team loss",
    };

    private static PowerCard Card(string id, string label, CardTargetTeam target, string[] positions, string icon, int quantity = 1) =>
        new(id, label, $"Apply {label} to an eligible player.", $"{label} effect", "This matchup", "#B6FF00", icon, target, positions, CardRarity.Rare, CardType.Strategy, quantity);
}
