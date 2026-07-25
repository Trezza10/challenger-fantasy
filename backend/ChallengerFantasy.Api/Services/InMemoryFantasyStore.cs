using ChallengerFantasy.Api.Domain;

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
    public Dictionary<(string LeagueId, string UserId), Roster> Rosters { get; } = [];
    public Dictionary<(string LeagueId, string UserId), List<PowerCard>> Hands { get; } = [];
    public List<ActivityEntry> Activities { get; } = [];
    public List<WaiverClaim> Waivers { get; } = [];
    public List<TradeOffer> Trades { get; } = [];
    public List<ChatMessage> Messages { get; } = [];
    public List<DraftPick> DraftPicks { get; } = [];

    public InMemoryFantasyStore()
    {
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

        var league = new League("challengers", "Challengers League", 10, 5, "replace-with-clerk-user-id");
        Leagues[league.Id] = league;

        const string seedUser = "user_demo";
        var roster = new Roster(
            manager.Take(10).Select((player, index) => new RosterSlot($"starter-{index}", "starter", player.Position, player)).ToArray(),
            manager.Skip(10).Select((player, index) => new RosterSlot($"bench-{index}", "bench", player.Position, player)).ToArray());
        Rosters[(league.Id, seedUser)] = roster;

        var hand = new List<PowerCard>
        {
            Card("ground-control", "Ground Control", CardTargetTeam.SELF, ["RB", "FLEX"], "football"),
            Card("pocket-protector", "Pocket Protector", CardTargetTeam.SELF, ["QB"], "shield"),
            Card("momentum-shift", "Momentum Shift", CardTargetTeam.OPPONENT, ["ALL"], "swap-horizontal", 2),
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
        var seed = Rosters.Values.First();
        roster = new Roster(seed.Starters.ToArray(), seed.Bench.ToArray());
        Rosters[(leagueId, userId)] = roster;
        return roster;
    }

    public List<PowerCard> GetOrCreateHand(string leagueId, string userId)
    {
        if (Hands.TryGetValue((leagueId, userId), out var hand)) return hand;
        hand = Hands.Values.First().Select(card => card with { }).ToList();
        Hands[(leagueId, userId)] = hand;
        return hand;
    }

    private static Player Player(string id, string name, RosterPosition position, string team, double score) =>
        new(id, name, position, team, score, false, [new("Status", "Upcoming")], [new("Last game", $"{score:0.0} pts")]);

    private static PowerCard Card(string id, string label, CardTargetTeam target, string[] positions, string icon, int quantity = 1) =>
        new(id, label, $"Apply {label} to an eligible player.", $"{label} effect", "This matchup", "#B6FF00", icon, target, positions, CardRarity.Rare, CardType.Strategy, quantity);
}
