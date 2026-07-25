using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Domain;
using ChallengerFantasy.Api.Mapping;

namespace ChallengerFantasy.Api.Services;

public sealed class FantasyService(InMemoryFantasyStore store) : IFantasyService
{
    public HomeDto GetHome(string userId) => new(
        "#3",
        128.4,
        "Your league draft begins soon. Set your lineup and scout the competition.",
        [
            new NewsStoryDto(
                "week-five",
                "MATCHUP REPORT",
                "Titans look to hold their edge",
                "Your Week 5 matchup remains close.",
                "A timely card play could change the matchup.",
                DateTimeOffset.UtcNow.AddMinutes(-18).ToString("O")),
        ]);

    public TeamSummaryDto GetTeam(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            var roster = store.GetOrCreateRoster(leagueId, userId);
            var players = roster.Starters.Concat(roster.Bench).Select(slot => slot.Player).ToArray();
            return new TeamSummaryDto($"{players.Length} / {players.Length}", players.MaxBy(player => player.Score)?.Name ?? "No players");
        }
    }

    public IReadOnlyList<LeagueSummaryDto> GetLeagues(string userId)
    {
        lock (store.SyncRoot) return store.Leagues.Values.Select(FantasyMapper.ToSummaryDto).ToArray();
    }

    public LeagueDto GetLeague(string leagueId, string userId)
    {
        lock (store.SyncRoot) return FindLeague(leagueId).ToDto();
    }

    public ActivityPageDto GetActivity(string leagueId, int cursor, int limit, string userId)
    {
        ValidatePage(cursor, limit);
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            var all = store.Activities
                .Where(item => item.LeagueId == leagueId)
                .OrderByDescending(item => item.OccurredAt)
                .ToArray();
            var page = all.Skip(cursor).Take(limit).Select(FantasyMapper.ToDto).ToArray();
            int? next = cursor + page.Length < all.Length ? cursor + page.Length : null;
            return new ActivityPageDto(page, next);
        }
    }

    public MatchupDto GetMatchup(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            var matchup = FindMatchup(leagueId);
            var roster = store.GetOrCreateRoster(leagueId, userId);
            var hand = store.GetOrCreateHand(leagueId, userId);
            var starters = ReplaceManagerPlayers(matchup.Starters, roster.Starters);
            var bench = ReplaceManagerPlayers(matchup.Bench, roster.Bench);
            var leftTeam = matchup.LeftTeam with { Hand = hand };
            var initialModifiers = matchup.AppliedCards.Select(FantasyMapper.ToDto).ToArray();
            var summary = new LeagueMatchupSummaryDto(
                matchup.Id,
                $"{starters.First().Left.Name} · {starters.First().Right.Name}",
                matchup.GameTime,
                matchup.IsLive,
                matchup.WinChance,
                leftTeam.ToDto(),
                matchup.RightTeam.ToDto(),
                starters.Select(FantasyMapper.ToDto).ToArray(),
                bench.Select(FantasyMapper.ToDto).ToArray(),
                initialModifiers);

            return new MatchupDto(
                matchup.Week,
                matchup.GameTime,
                matchup.IsLive,
                matchup.WinChance,
                leftTeam.ToDto(),
                matchup.RightTeam.ToDto(),
                starters.Select(FantasyMapper.ToDto).ToArray(),
                bench.Select(FantasyMapper.ToDto).ToArray(),
                hand.Select(FantasyMapper.ToDto).ToArray(),
                initialModifiers,
                [summary]);
        }
    }

    public RosterDto GetRoster(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            return store.GetOrCreateRoster(leagueId, userId).ToDto();
        }
    }

    public RosterDto SaveLineup(string leagueId, string userId, SaveLineupRequest request)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            var current = store.GetOrCreateRoster(leagueId, userId);
            var allCurrentSlots = current.Starters.Concat(current.Bench).ToDictionary(slot => slot.Id);
            var requested = request.Starters.Concat(request.Bench).ToArray();
            if (requested.Select(slot => slot.SlotId).Distinct().Count() != requested.Length)
                throw new ApiException(StatusCodes.Status400BadRequest, "A lineup slot may only appear once.");
            if (requested.Select(slot => slot.PlayerId).Distinct().Count() != requested.Length)
                throw new ApiException(StatusCodes.Status400BadRequest, "A player may only occupy one lineup slot.");

            RosterSlot Build(LineupSlotRequest input, string kind)
            {
                if (!allCurrentSlots.TryGetValue(input.SlotId, out var slot))
                    throw new ApiException(StatusCodes.Status400BadRequest, $"Unknown lineup slot '{input.SlotId}'.");
                var player = FindPlayer(input.PlayerId);
                if (kind == "starter" && !CanFill(player.Position, slot.Position))
                    throw new ApiException(StatusCodes.Status409Conflict, $"{player.Name} cannot fill {slot.Position}.");
                return slot with { Kind = kind, Player = player };
            }

            var roster = new Roster(
                request.Starters.Select(slot => Build(slot, "starter")).ToArray(),
                request.Bench.Select(slot => Build(slot, "bench")).ToArray());
            store.Rosters[(leagueId, userId)] = roster;
            AddActivity(leagueId, "You", "updated the starting lineup.", ActivityType.Lineup);
            return roster.ToDto();
        }
    }

    public AppliedCardDto PlayCard(string leagueId, string userId, PlayCardRequest request)
    {
        lock (store.SyncRoot)
        {
            var matchup = FindMatchup(leagueId);
            var hand = store.GetOrCreateHand(leagueId, userId);
            var cardIndex = hand.FindIndex(item => item.Id == request.CardId);
            if (cardIndex < 0 || hand[cardIndex].Quantity <= 0)
                throw new ApiException(StatusCodes.Status409Conflict, "That card is not available in your inventory.");
            var player = FindPlayer(request.PlayerId);
            var managerPlayerIds = store.GetOrCreateRoster(leagueId, userId).Starters
                .Concat(store.GetOrCreateRoster(leagueId, userId).Bench)
                .Select(slot => slot.Player.Id)
                .ToHashSet();
            var isManagerPlayer = managerPlayerIds.Contains(player.Id);
            var card = hand[cardIndex];
            if ((card.AllowedTeam == CardTargetTeam.SELF) != isManagerPlayer
                || (!card.AllowedPositions.Contains("ALL") && !card.AllowedPositions.Contains(player.Position.ToString())))
                throw new ApiException(StatusCodes.Status409Conflict, "That player is not a valid target for this card.");
            if (player.GameStarted)
                throw new ApiException(StatusCodes.Status409Conflict, "Cards cannot be played after the player's game starts.");

            hand[cardIndex] = card with { Quantity = card.Quantity - 1 };
            if (hand[cardIndex].Quantity == 0) hand.RemoveAt(cardIndex);
            var applied = new AppliedCard(
                Guid.NewGuid().ToString("N"),
                player.Id,
                player.Name,
                userId,
                "You",
                "manager",
                card with { Quantity = 1 });
            store.Matchups[leagueId] = matchup with { AppliedCards = matchup.AppliedCards.Append(applied).ToArray() };
            AddActivity(leagueId, "You", $"played {card.Label} on {player.Name}.", ActivityType.Card);
            return applied.ToDto();
        }
    }

    public void RemoveCard(string leagueId, string userId, string playId)
    {
        lock (store.SyncRoot)
        {
            var matchup = FindMatchup(leagueId);
            var play = matchup.AppliedCards.FirstOrDefault(item => item.Id == playId)
                ?? throw new ApiException(StatusCodes.Status404NotFound, "Card play not found.");
            if (play.PlayedByUserId != userId)
                throw new ApiException(StatusCodes.Status403Forbidden, "You can only remove your own card plays.");
            if (FindPlayer(play.PlayerId).GameStarted)
                throw new ApiException(StatusCodes.Status409Conflict, "This card is locked because the game has started.");

            store.Matchups[leagueId] = matchup with { AppliedCards = matchup.AppliedCards.Where(item => item.Id != playId).ToArray() };
            var hand = store.GetOrCreateHand(leagueId, userId);
            var cardIndex = hand.FindIndex(item => item.Id == play.Card.Id);
            if (cardIndex >= 0) hand[cardIndex] = hand[cardIndex] with { Quantity = hand[cardIndex].Quantity + 1 };
            else hand.Add(play.Card with { Quantity = 1 });
        }
    }

    public FreeAgentPageDto GetFreeAgents(string leagueId, int cursor, int limit, string? search, string? position, string userId)
    {
        ValidatePage(cursor, limit);
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            var rostered = store.Rosters
                .Where(item => item.Key.LeagueId == leagueId)
                .SelectMany(item => item.Value.Starters.Concat(item.Value.Bench))
                .Select(slot => slot.Player.Id)
                .ToHashSet();
            var query = store.Players.Values.Where(player => !rostered.Contains(player.Id));
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(player => player.Name.Contains(search, StringComparison.OrdinalIgnoreCase) || player.Team.Contains(search, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(position) && !string.Equals(position, "ALL", StringComparison.OrdinalIgnoreCase))
                query = query.Where(player => string.Equals(player.Position.ToString(), position, StringComparison.OrdinalIgnoreCase));
            var all = query.OrderByDescending(player => player.Score).ToArray();
            var page = all.Skip(cursor).Take(limit).Select(FantasyMapper.ToDto).ToArray();
            return new FreeAgentPageDto(page, cursor + page.Length < all.Length ? cursor + page.Length : null);
        }
    }

    public RosterDto AddFreeAgent(string leagueId, string userId, AddFreeAgentRequest request)
    {
        lock (store.SyncRoot)
        {
            var player = FindPlayer(request.PlayerId);
            if (store.Rosters.Where(item => item.Key.LeagueId == leagueId).SelectMany(item => item.Value.Starters.Concat(item.Value.Bench)).Any(slot => slot.Player.Id == player.Id))
                throw new ApiException(StatusCodes.Status409Conflict, "That player is no longer a free agent.");
            var roster = store.GetOrCreateRoster(leagueId, userId);
            if (string.IsNullOrWhiteSpace(request.DropPlayerId))
                throw new ApiException(StatusCodes.Status400BadRequest, "A dropPlayerId is required for a full roster.");
            var dropSlot = roster.Starters.Concat(roster.Bench).FirstOrDefault(slot => slot.Player.Id == request.DropPlayerId)
                ?? throw new ApiException(StatusCodes.Status404NotFound, "The player to drop is not on your roster.");
            if (dropSlot.Kind == "starter" && !CanFill(player.Position, dropSlot.Position))
                throw new ApiException(StatusCodes.Status409Conflict, "The free agent cannot fill the dropped starter's slot.");
            var updated = new Roster(
                roster.Starters.Select(slot => slot.Id == dropSlot.Id ? slot with { Player = player } : slot).ToArray(),
                roster.Bench.Select(slot => slot.Id == dropSlot.Id ? slot with { Player = player } : slot).ToArray());
            store.Rosters[(leagueId, userId)] = updated;
            AddActivity(leagueId, "You", $"added {player.Name}.", ActivityType.Waiver);
            return updated.ToDto();
        }
    }

    public IReadOnlyList<WaiverClaimDto> GetWaivers(string leagueId, string userId)
    {
        lock (store.SyncRoot) return store.Waivers.Where(item => item.LeagueId == leagueId && item.UserId == userId).Select(FantasyMapper.ToDto).ToArray();
    }

    public WaiverClaimDto CreateWaiver(string leagueId, string userId, WaiverClaimRequest request)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            FindPlayer(request.AddPlayerId);
            var claim = new WaiverClaim(Guid.NewGuid().ToString("N"), leagueId, userId, request.AddPlayerId, request.DropPlayerId, store.Waivers.Count(item => item.LeagueId == leagueId && item.Status == WaiverStatus.Pending) + 1, WaiverStatus.Pending, DateTimeOffset.UtcNow);
            store.Waivers.Add(claim);
            return claim.ToDto();
        }
    }

    public void CancelWaiver(string leagueId, string userId, string claimId)
    {
        lock (store.SyncRoot)
        {
            var index = store.Waivers.FindIndex(item => item.Id == claimId && item.LeagueId == leagueId && item.UserId == userId);
            if (index < 0) throw new ApiException(StatusCodes.Status404NotFound, "Waiver claim not found.");
            store.Waivers[index] = store.Waivers[index] with { Status = WaiverStatus.Cancelled };
        }
    }

    public IReadOnlyList<TradeOfferDto> GetTrades(string leagueId, string userId)
    {
        lock (store.SyncRoot) return store.Trades.Where(item => item.LeagueId == leagueId && (item.FromUserId == userId || item.ToUserId == userId)).Select(FantasyMapper.ToDto).ToArray();
    }

    public TradeOfferDto CreateTrade(string leagueId, string userId, CreateTradeRequest request)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            if (request.ToUserId == userId) throw new ApiException(StatusCodes.Status400BadRequest, "You cannot trade with yourself.");
            var trade = new TradeOffer(Guid.NewGuid().ToString("N"), leagueId, userId, request.ToUserId, request.OfferedPlayerIds, request.RequestedPlayerIds, TradeStatus.Pending, DateTimeOffset.UtcNow);
            store.Trades.Add(trade);
            AddActivity(leagueId, "You", "sent a trade offer.", ActivityType.Trade);
            return trade.ToDto();
        }
    }

    public TradeOfferDto ResolveTrade(string leagueId, string userId, string tradeId, ResolveTradeRequest request)
    {
        lock (store.SyncRoot)
        {
            var index = store.Trades.FindIndex(item => item.Id == tradeId && item.LeagueId == leagueId);
            if (index < 0) throw new ApiException(StatusCodes.Status404NotFound, "Trade offer not found.");
            var trade = store.Trades[index];
            TradeStatus status;
            if (request.Decision.Equals("cancel", StringComparison.OrdinalIgnoreCase) && trade.FromUserId == userId) status = TradeStatus.Cancelled;
            else if (trade.ToUserId != userId) throw new ApiException(StatusCodes.Status403Forbidden, "Only the recipient can resolve this offer.");
            else if (request.Decision.Equals("accept", StringComparison.OrdinalIgnoreCase)) status = TradeStatus.Accepted;
            else if (request.Decision.Equals("reject", StringComparison.OrdinalIgnoreCase)) status = TradeStatus.Rejected;
            else throw new ApiException(StatusCodes.Status400BadRequest, "Decision must be accept, reject, or cancel.");
            store.Trades[index] = trade with { Status = status };
            return store.Trades[index].ToDto();
        }
    }

    public IReadOnlyList<ChatMessageDto> GetMessages(string leagueId, int limit, string userId)
    {
        if (limit is < 1 or > 100) throw new ApiException(StatusCodes.Status400BadRequest, "Limit must be between 1 and 100.");
        lock (store.SyncRoot) return store.Messages.Where(item => item.LeagueId == leagueId).OrderByDescending(item => item.SentAt).Take(limit).OrderBy(item => item.SentAt).Select(FantasyMapper.ToDto).ToArray();
    }

    public ChatMessageDto SendMessage(string leagueId, string userId, ChatMessageRequest request)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            var text = request.Text.Trim();
            if (text.Length == 0) throw new ApiException(StatusCodes.Status400BadRequest, "Message cannot be empty.");
            var message = new ChatMessage(Guid.NewGuid().ToString("N"), leagueId, userId, "You", text, DateTimeOffset.UtcNow);
            store.Messages.Add(message);
            return message.ToDto();
        }
    }

    public DraftStateDto GetDraft(string leagueId, string userId)
    {
        lock (store.SyncRoot) return BuildDraftState(leagueId);
    }

    public DraftStateDto MakeDraftPick(string leagueId, string userId, DraftPickRequest request)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            FindPlayer(request.PlayerId);
            if (store.DraftPicks.Any(item => item.LeagueId == leagueId && item.PlayerId == request.PlayerId))
                throw new ApiException(StatusCodes.Status409Conflict, "That player has already been drafted.");
            var overall = store.DraftPicks.Count(item => item.LeagueId == leagueId) + 1;
            store.DraftPicks.Add(new DraftPick(Guid.NewGuid().ToString("N"), leagueId, userId, request.PlayerId, ((overall - 1) / 10) + 1, overall, DateTimeOffset.UtcNow));
            return BuildDraftState(leagueId);
        }
    }

    public LeagueDto UpdateLeague(string leagueId, LeagueSettingsRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = FindLeague(leagueId);
            if (request.CurrentWeek is < 1 or > 18) throw new ApiException(StatusCodes.Status400BadRequest, "Current week must be between 1 and 18.");
            league = league with { CurrentWeek = request.CurrentWeek ?? league.CurrentWeek };
            store.Leagues[leagueId] = league;
            return league.ToDto();
        }
    }

    private DraftStateDto BuildDraftState(string leagueId)
    {
        FindLeague(leagueId);
        var picks = store.DraftPicks.Where(item => item.LeagueId == leagueId).OrderBy(item => item.OverallPick).ToArray();
        var drafted = picks.Select(item => item.PlayerId).ToHashSet();
        return new DraftStateDto(
            picks.Length + 1,
            DateTimeOffset.UtcNow.AddMinutes(2),
            picks.Select(FantasyMapper.ToDto).ToArray(),
            store.Players.Values.Where(player => !drafted.Contains(player.Id)).Select(FantasyMapper.ToDto).ToArray());
    }

    private League FindLeague(string id) => store.Leagues.TryGetValue(id, out var value)
        ? value
        : throw new ApiException(StatusCodes.Status404NotFound, "League not found.");
    private Matchup FindMatchup(string leagueId) => store.Matchups.TryGetValue(leagueId, out var value)
        ? value
        : throw new ApiException(StatusCodes.Status404NotFound, "Matchup not found.");
    private Player FindPlayer(string id) => store.Players.TryGetValue(id, out var value)
        ? value
        : throw new ApiException(StatusCodes.Status404NotFound, "Player not found.");
    private void AddActivity(string leagueId, string actor, string summary, ActivityType type) =>
        store.Activities.Add(new ActivityEntry(Guid.NewGuid().ToString("N"), leagueId, actor, summary, type, DateTimeOffset.UtcNow));
    private static IReadOnlyList<PlayerMatchup> ReplaceManagerPlayers(IReadOnlyList<PlayerMatchup> matchups, IReadOnlyList<RosterSlot> slots) =>
        matchups.Select((item, index) => index < slots.Count ? item with { Left = slots[index].Player } : item).ToArray();
    private static bool CanFill(RosterPosition player, RosterPosition slot) =>
        player == slot || slot == RosterPosition.FLEX && player is RosterPosition.RB or RosterPosition.WR or RosterPosition.TE;
    private static void ValidatePage(int cursor, int limit)
    {
        if (cursor < 0) throw new ApiException(StatusCodes.Status400BadRequest, "Cursor cannot be negative.");
        if (limit is < 1 or > 100) throw new ApiException(StatusCodes.Status400BadRequest, "Limit must be between 1 and 100.");
    }
}
