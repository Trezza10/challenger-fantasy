using System.Security.Cryptography;
using System.Text;
using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Domain;
using ChallengerFantasy.Api.Mapping;

namespace ChallengerFantasy.Api.Services;

public sealed class FantasyService(InMemoryFantasyStore store) : IFantasyService
{
    public HomeDto GetHome(string userId)
    {
        lock (store.SyncRoot)
        {
            var memberships = store.Memberships.Values.Where(member => member.UserId == userId).ToArray();
            var communityPosts = store.CommunityPosts.OrderByDescending(post => post.PublishedAt).Select(FantasyMapper.ToDto).ToArray();
            return memberships.Length == 0
                ? new HomeDto("—", 0, "Create or join a league to get started.", communityPosts)
                : new HomeDto("—", 0, $"You belong to {memberships.Length} league{(memberships.Length == 1 ? string.Empty : "s")}.", communityPosts);
        }
    }

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
        lock (store.SyncRoot)
        {
            var leagueIds = store.Memberships.Values
                .Where(membership => membership.UserId == userId)
                .Select(membership => membership.LeagueId)
                .ToHashSet();
            return store.Leagues.Values.Where(league => leagueIds.Contains(league.Id)).Select(FantasyMapper.ToSummaryDto).ToArray();
        }
    }

    public LeagueAccessDto CreateLeague(string userId, string managerName, string? email, CreateLeagueRequest request)
    {
        lock (store.SyncRoot)
        {
            var name = request.Name.Trim();
            var baseId = string.Concat(name.ToLowerInvariant().Select(character => char.IsLetterOrDigit(character) ? character : '-')).Trim('-');
            if (string.IsNullOrWhiteSpace(baseId)) baseId = "league";
            var id = baseId;
            for (var suffix = 2; store.Leagues.ContainsKey(id); suffix++) id = $"{baseId}-{suffix}";

            var league = new League(id, name, 1, request.MaxMembers, 1, false, null, userId);
            store.Leagues[id] = league;
            store.Memberships[(id, userId)] = new LeagueMembership(
                id, userId, managerName, email, request.TeamName.Trim(), "commissioner",
                0, 0, 0, 0, 0, DateTimeOffset.UtcNow);

            var joinCode = CreateJoinCode();
            store.LeagueIdsByJoinCode[joinCode] = id;

            store.GetOrCreateRoster(id, userId);
            store.GetOrCreateHand(id, userId);
            AddActivity(id, "Commissioner", $"created {name}.", ActivityType.Lineup);
            return ToAccess(league, userId, joinCode);
        }
    }

    public LeaguePreviewDto PreviewLeague(string codeOrToken)
    {
        lock (store.SyncRoot)
        {
            var league = FindLeagueByCodeOrToken(codeOrToken);
            return new LeaguePreviewDto(league.Id, league.Name, league.MemberCount, league.MaxMembers, league.CommissionerUserId);
        }
    }

    public LeagueAccessDto JoinLeague(string userId, string managerName, string? email, JoinLeagueRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = FindLeagueByCodeOrToken(request.CodeOrToken, out var invitation);
            if (store.Memberships.ContainsKey((league.Id, userId)))
                return ToAccess(league, userId, FindJoinCode(league.Id));
            if (league.MemberCount >= league.MaxMembers)
                throw new ApiException(StatusCodes.Status409Conflict, "This league is full.");

            var teamName = string.IsNullOrWhiteSpace(request.TeamName) ? $"{managerName}'s Team" : request.TeamName.Trim();
            store.Memberships[(league.Id, userId)] = new LeagueMembership(
                league.Id, userId, managerName, email, teamName, "member",
                0, 0, 0, 0, 0, DateTimeOffset.UtcNow);
            league = league with { MemberCount = league.MemberCount + 1 };
            store.Leagues[league.Id] = league;
            store.GetOrCreateRoster(league.Id, userId);
            store.GetOrCreateHand(league.Id, userId);
            if (invitation is not null)
                store.InvitationsByToken[invitation.Token] = invitation with { AcceptedAt = DateTimeOffset.UtcNow };
            AddActivity(league.Id, "New manager", "joined the league.", ActivityType.Lineup);
            return ToAccess(league, userId, FindJoinCode(league.Id));
        }
    }

    public IReadOnlyList<LeagueMemberDto> GetLeagueMembers(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            RequireMember(leagueId, userId);
            return store.Memberships.Values
                .Where(member => member.LeagueId == leagueId)
                .OrderByDescending(member => member.Wins)
                .ThenByDescending(member => member.PointsFor)
                .ThenBy(member => member.JoinedAt)
                .Select((member, index) => new LeagueMemberDto(
                    member.UserId,
                    member.ManagerName,
                    member.Email,
                    member.TeamName,
                    member.Role,
                    member.UserId == userId,
                    index + 1,
                    member.Wins,
                    member.Losses,
                    member.Ties,
                    member.PointsFor,
                    member.PointsAgainst))
                .ToArray();
        }
    }

    public IReadOnlyList<LeaguePostDto> GetLeaguePosts(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            RequireMember(leagueId, userId);
            return store.LeaguePosts
                .Where(post => post.LeagueId == leagueId)
                .OrderByDescending(post => post.CreatedAt)
                .Select(ToPostDto)
                .ToArray();
        }
    }

    public LeaguePostDto CreateLeaguePost(string leagueId, string userId, CreateLeaguePostRequest request)
    {
        lock (store.SyncRoot)
        {
            RequireMember(leagueId, userId);
            var membership = store.Memberships[(leagueId, userId)];
            var title = request.Title.Trim();
            var body = request.Body.Trim();
            if (title.Length < 3 || body.Length == 0)
                throw new ApiException(StatusCodes.Status400BadRequest, "A post title and body are required.");

            string? imageDataUrl = null;
            string? imagePosition = null;
            if (!string.IsNullOrWhiteSpace(request.ImageDataUrl))
            {
                const string prefix = "data:image/jpeg;base64,";
                if (!request.ImageDataUrl.StartsWith(prefix, StringComparison.Ordinal))
                    throw new ApiException(StatusCodes.Status400BadRequest, "Post images must be JPEG data URLs.");
                var encoded = request.ImageDataUrl[prefix.Length..];
                var buffer = new byte[encoded.Length * 3 / 4 + 3];
                if (!Convert.TryFromBase64String(encoded, buffer, out var bytesWritten) || bytesWritten > 2_000_000)
                    throw new ApiException(StatusCodes.Status400BadRequest, "Post images must be valid JPEG files no larger than 2 MB.");
                imageDataUrl = request.ImageDataUrl;
                imagePosition = request.ImagePosition is "top" or "bottom" ? request.ImagePosition : "top";
            }

            var post = new LeaguePost(
                Guid.NewGuid().ToString("N"),
                leagueId,
                userId,
                membership.ManagerName,
                title,
                body,
                imageDataUrl,
                imagePosition,
                DateTimeOffset.UtcNow);
            store.LeaguePosts.Add(post);
            AddActivity(leagueId, membership.ManagerName, $"published \"{title}\".", ActivityType.Lineup);
            return ToPostDto(post);
        }
    }

    public LeagueAccessDto GetLeagueAccess(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            return ToAccess(league, userId, FindJoinCode(leagueId));
        }
    }

    public IReadOnlyList<LeagueInvitationDto> GetLeagueInvitations(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            RequireCommissioner(leagueId, userId);
            return store.InvitationsByToken.Values
                .Where(invitation => invitation.LeagueId == leagueId)
                .OrderByDescending(invitation => invitation.ExpiresAt)
                .Select(ToInvitationDto)
                .ToArray();
        }
    }

    public LeagueInvitationDto CreateLeagueInvitation(string leagueId, string userId, CreateLeagueInvitationRequest request)
    {
        lock (store.SyncRoot)
        {
            RequireCommissioner(leagueId, userId);
            var token = Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
            var invitation = new LeagueInvitation(
                Guid.NewGuid().ToString("N"),
                leagueId,
                userId,
                string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant(),
                token,
                DateTimeOffset.UtcNow.AddDays(7),
                null);
            store.InvitationsByToken[token] = invitation;
            return ToInvitationDto(invitation);
        }
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
            var league = RequireMember(leagueId, userId);
            var roster = store.GetOrCreateRoster(leagueId, userId);
            var hand = store.GetOrCreateHand(leagueId, userId);
            var membership = store.Memberships[(leagueId, userId)];
            var opponentMembership = store.Memberships.Values.FirstOrDefault(member => member.LeagueId == leagueId && member.UserId != userId);
            var opponentRoster = opponentMembership is null ? new Roster([], []) : store.GetOrCreateRoster(leagueId, opponentMembership.UserId);
            if (!league.DraftCompleted || !store.Matchups.TryGetValue(leagueId, out var matchup))
            {
                var waitingForMembers = league.MemberCount < league.MaxMembers;
                return new MatchupDto(
                    league.CurrentWeek,
                    "Schedule not set",
                    false,
                    50,
                    new MatchupTeamDto($"{leagueId}-{userId}", membership.TeamName, 0, 0, hand.Select(FantasyMapper.ToDto).ToArray()),
                    new MatchupTeamDto($"{leagueId}-opponent", opponentMembership?.TeamName ?? "Awaiting Opponent", 0, 0),
                    [],
                    [],
                    hand.Select(FantasyMapper.ToDto).ToArray(),
                    [],
                    [],
                    waitingForMembers ? "waiting_for_members" : "waiting_for_draft",
                    waitingForMembers
                        ? $"{league.MemberCount} of {league.MaxMembers} managers have joined."
                        : "All managers have joined. Complete the draft to create the schedule.",
                    league.MemberCount,
                    league.MaxMembers);
            }
            var starters = PairRosters(roster.Starters, opponentRoster.Starters);
            var bench = PairRosters(roster.Bench, opponentRoster.Bench);
            var leftTeam = matchup.LeftTeam with { Id = $"{leagueId}-{userId}", Name = membership.TeamName, Hand = hand };
            var rightTeam = matchup.RightTeam with
            {
                Id = opponentMembership is null ? $"{leagueId}-opponent" : $"{leagueId}-{opponentMembership.UserId}",
                Name = opponentMembership?.TeamName ?? "Awaiting Opponent",
                Hand = opponentMembership is null ? [] : store.GetOrCreateHand(leagueId, opponentMembership.UserId),
            };
            var initialModifiers = matchup.AppliedCards.Select(FantasyMapper.ToDto).ToArray();
            var summary = new LeagueMatchupSummaryDto(
                matchup.Id,
                starters.Count > 0 ? $"{starters[0].Left.Name} · {starters[0].Right.Name}" : "No lineup set",
                matchup.GameTime,
                matchup.IsLive,
                matchup.WinChance,
                leftTeam.ToDto(),
                rightTeam.ToDto(),
                starters.Select(FantasyMapper.ToDto).ToArray(),
                bench.Select(FantasyMapper.ToDto).ToArray(),
                initialModifiers);

            return new MatchupDto(
                matchup.Week,
                matchup.GameTime,
                matchup.IsLive,
                matchup.WinChance,
                leftTeam.ToDto(),
                rightTeam.ToDto(),
                starters.Select(FantasyMapper.ToDto).ToArray(),
                bench.Select(FantasyMapper.ToDto).ToArray(),
                hand.Select(FantasyMapper.ToDto).ToArray(),
                initialModifiers,
                [summary],
                "ready",
                "Matchups are ready.",
                league.MemberCount,
                league.MaxMembers);
        }
    }

    public RosterDto GetRoster(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            FindLeague(leagueId);
            return SortRoster(store.GetOrCreateRoster(leagueId, userId)).ToDto();
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

    public CardClaimStateDto GetCardClaim(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            return BuildCardClaimState(league, userId);
        }
    }

    public CardClaimStateDto ClaimCard(string leagueId, string userId, ClaimCardRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            if (!league.DraftCompleted)
                throw new ApiException(StatusCodes.Status409Conflict, "Weekly cards are locked until the league draft is complete.");
            var key = (leagueId, userId, league.CurrentWeek);
            var state = EnsureActiveCardOffer(league, userId, GetOrCreateCardClaimProgress(league, userId));
            if (state.ClaimedCount >= state.Allowance)
                throw new ApiException(StatusCodes.Status409Conflict, "All card claims for this week have already been used.");
            if (state.OfferId is null || !string.Equals(state.OfferId, request.OfferId, StringComparison.Ordinal))
                throw new ApiException(StatusCodes.Status409Conflict, "That card offer is no longer active.");
            if (!state.OfferedCardIds.Contains(request.CardId, StringComparer.Ordinal))
                throw new ApiException(StatusCodes.Status400BadRequest, "The selected card was not part of this offer.");
            if (!store.CardCatalog.TryGetValue(request.CardId, out var card))
                throw new ApiException(StatusCodes.Status404NotFound, "Card not found.");

            var hand = store.GetOrCreateHand(leagueId, userId);
            var existingIndex = hand.FindIndex(item => item.Id == card.Id);
            if (existingIndex >= 0) hand[existingIndex] = hand[existingIndex] with { Quantity = hand[existingIndex].Quantity + 1 };
            else hand.Add(card with { Quantity = 1 });

            store.CardClaims[key] = state with
            {
                ClaimedCount = state.ClaimedCount + 1,
                OfferId = null,
                OfferedCardIds = [],
            };
            AddActivity(leagueId, "Manager", $"claimed {card.Label}.", ActivityType.Card);
            return BuildCardClaimState(league, userId);
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
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            FinalizeExpiredTrades(league);
            return store.Trades.Where(item => item.LeagueId == leagueId).OrderByDescending(item => item.CreatedAt).Select(item => item.ToDto(league, userId)).ToArray();
        }
    }

    public IReadOnlyList<TradePartnerDto> GetTradePartners(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            RequireMember(leagueId, userId);
            return store.Memberships.Values
                .Where(member => member.LeagueId == leagueId)
                .OrderBy(member => member.TeamName)
                .Select(member => new TradePartnerDto(
                    member.UserId,
                    member.TeamName,
                    SortRoster(store.GetOrCreateRoster(leagueId, member.UserId)).ToDto(),
                    store.GetOrCreateHand(leagueId, member.UserId).Select(FantasyMapper.ToDto).ToArray()))
                .ToArray();
        }
    }

    public TradeOfferDto CreateTrade(string leagueId, string userId, CreateTradeRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            if (request.ToUserId == userId) throw new ApiException(StatusCodes.Status400BadRequest, "You cannot trade with yourself.");
            RequireMember(leagueId, request.ToUserId);
            var offeredPlayers = request.OfferedPlayerIds ?? [];
            var requestedPlayers = request.RequestedPlayerIds ?? [];
            var offeredCards = request.OfferedCardIds ?? [];
            var requestedCards = request.RequestedCardIds ?? [];
            if (offeredPlayers.Count + requestedPlayers.Count + offeredCards.Count + requestedCards.Count == 0)
                throw new ApiException(StatusCodes.Status400BadRequest, "A trade must include at least one player or card.");
            if (offeredPlayers.Count != requestedPlayers.Count)
                throw new ApiException(StatusCodes.Status400BadRequest, "Player trades currently require the same number of players from each team.");
            ValidateTradeAssets(leagueId, userId, offeredPlayers, offeredCards);
            ValidateTradeAssets(leagueId, request.ToUserId, requestedPlayers, requestedCards);
            var trade = new TradeOffer(Guid.NewGuid().ToString("N"), leagueId, userId, request.ToUserId, offeredPlayers, requestedPlayers, offeredCards, requestedCards, TradeStatus.Pending, DateTimeOffset.UtcNow, null, []);
            store.Trades.Add(trade);
            AddActivity(leagueId, "You", "sent a trade offer.", ActivityType.Trade);
            return trade.ToDto(league, userId);
        }
    }

    public TradeOfferDto ResolveTrade(string leagueId, string userId, string tradeId, ResolveTradeRequest request)
    {
        lock (store.SyncRoot)
        {
            var index = store.Trades.FindIndex(item => item.Id == tradeId && item.LeagueId == leagueId);
            if (index < 0) throw new ApiException(StatusCodes.Status404NotFound, "Trade offer not found.");
            var trade = store.Trades[index];
            var league = RequireMember(leagueId, userId);
            if (trade.Status != TradeStatus.Pending) throw new ApiException(StatusCodes.Status409Conflict, "This trade is no longer awaiting a recipient decision.");
            TradeStatus status;
            DateTimeOffset? reviewEndsAt = null;
            if (request.Decision.Equals("cancel", StringComparison.OrdinalIgnoreCase) && trade.FromUserId == userId) status = TradeStatus.Cancelled;
            else if (trade.ToUserId != userId) throw new ApiException(StatusCodes.Status403Forbidden, "Only the recipient can resolve this offer.");
            else if (request.Decision.Equals("accept", StringComparison.OrdinalIgnoreCase))
            {
                status = TradeStatus.LeagueReview;
                reviewEndsAt = DateTimeOffset.UtcNow.AddHours(league.TradeReviewHours);
            }
            else if (request.Decision.Equals("reject", StringComparison.OrdinalIgnoreCase)) status = TradeStatus.Rejected;
            else throw new ApiException(StatusCodes.Status400BadRequest, "Decision must be accept, reject, or cancel.");
            store.Trades[index] = trade with { Status = status, ReviewEndsAt = reviewEndsAt };
            return store.Trades[index].ToDto(league, userId);
        }
    }

    public TradeOfferDto VoteTrade(string leagueId, string userId, string tradeId, TradeVoteRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            FinalizeExpiredTrades(league);
            var index = store.Trades.FindIndex(item => item.Id == tradeId && item.LeagueId == leagueId);
            if (index < 0) throw new ApiException(StatusCodes.Status404NotFound, "Trade offer not found.");
            var trade = store.Trades[index];
            if (trade.Status != TradeStatus.LeagueReview) throw new ApiException(StatusCodes.Status409Conflict, "This trade is not in league review.");
            var votes = trade.RejectVotes.ToHashSet(StringComparer.Ordinal);
            if (request.Decision.Equals("reject", StringComparison.OrdinalIgnoreCase)) votes.Add(userId);
            else if (request.Decision.Equals("approve", StringComparison.OrdinalIgnoreCase)) votes.Remove(userId);
            else throw new ApiException(StatusCodes.Status400BadRequest, "Decision must be approve or reject.");
            var status = votes.Count >= league.TradeRejectVotesRequired ? TradeStatus.Rejected : trade.Status;
            store.Trades[index] = trade with { RejectVotes = votes.ToArray(), Status = status };
            return store.Trades[index].ToDto(league, userId);
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
        lock (store.SyncRoot)
        {
            RequireMember(leagueId, userId);
            return BuildDraftState(leagueId, userId);
        }
    }

    public DraftStateDto ScheduleDraft(string leagueId, string userId, ScheduleDraftRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = RequireCommissioner(leagueId, userId);
            if (league.DraftCompleted || store.DraftPicks.Any(pick => pick.LeagueId == leagueId))
                throw new ApiException(StatusCodes.Status409Conflict, "The draft cannot be rescheduled after picks have been made.");
            if (request.StartsAt <= DateTimeOffset.UtcNow)
                throw new ApiException(StatusCodes.Status400BadRequest, "Draft start time must be in the future.");
            league = league with { DraftStartsAt = request.StartsAt };
            store.Leagues[leagueId] = league;
            AddActivity(leagueId, "Commissioner", $"scheduled the draft for {request.StartsAt:u}.", ActivityType.Lineup);
            return BuildDraftState(leagueId, userId);
        }
    }

    public DraftStateDto MakeDraftPick(string leagueId, string userId, DraftPickRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = RequireMember(leagueId, userId);
            if (league.MemberCount < league.MaxMembers)
                throw new ApiException(StatusCodes.Status409Conflict, "The draft cannot begin until every manager has joined.");
            if (league.DraftStartsAt is null)
                throw new ApiException(StatusCodes.Status409Conflict, "The commissioner has not scheduled the draft.");
            if (DateTimeOffset.UtcNow < league.DraftStartsAt)
                throw new ApiException(StatusCodes.Status409Conflict, "The draft has not started yet.");
            if (league.DraftCompleted)
                throw new ApiException(StatusCodes.Status409Conflict, "The draft is already complete.");

            var order = GetDraftOrder(leagueId);
            var existingPicks = store.DraftPicks.Where(item => item.LeagueId == leagueId).OrderBy(item => item.OverallPick).ToArray();
            var overall = existingPicks.Length + 1;
            var currentPicker = GetPicker(order, overall);
            if (!string.Equals(currentPicker.UserId, userId, StringComparison.Ordinal))
                throw new ApiException(StatusCodes.Status409Conflict, $"It is {currentPicker.TeamName}'s turn.");
            FindPlayer(request.PlayerId);
            if (store.DraftPicks.Any(item => item.LeagueId == leagueId && item.PlayerId == request.PlayerId))
                throw new ApiException(StatusCodes.Status409Conflict, "That player has already been drafted.");
            var player = FindPlayer(request.PlayerId);
            var nextRoster = AddDraftedPlayerToRoster(store.GetOrCreateRoster(leagueId, userId), player);
            var round = ((overall - 1) / order.Length) + 1;
            store.DraftPicks.Add(new DraftPick(Guid.NewGuid().ToString("N"), leagueId, userId, request.PlayerId, round, overall, DateTimeOffset.UtcNow));
            store.Rosters[(leagueId, userId)] = nextRoster;

            if (overall >= order.Length * 13)
            {
                league = league with { DraftCompleted = true };
                store.Leagues[leagueId] = league;
                CreateOpeningMatchup(league);
                AddActivity(leagueId, "League", "completed the draft. Matchups are now available.", ActivityType.Lineup);
            }
            return BuildDraftState(leagueId, userId);
        }
    }

    public DraftStateDto CompleteDraft(string leagueId, string userId)
    {
        lock (store.SyncRoot)
        {
            var league = RequireCommissioner(leagueId, userId);
            var requiredPicks = league.MaxMembers * 13;
            if (store.DraftPicks.Count(pick => pick.LeagueId == leagueId) < requiredPicks)
                throw new ApiException(StatusCodes.Status409Conflict, $"All {requiredPicks} draft picks must be made before the draft can be completed.");
            if (!league.DraftCompleted)
            {
                league = league with { DraftCompleted = true };
                store.Leagues[leagueId] = league;
                CreateOpeningMatchup(league);
                AddActivity(leagueId, "Commissioner", "completed the draft. Matchups are now available.", ActivityType.Lineup);
            }
            return BuildDraftState(leagueId, userId);
        }
    }

    public LeagueDto UpdateLeague(string leagueId, string userId, LeagueSettingsRequest request)
    {
        lock (store.SyncRoot)
        {
            var league = RequireCommissioner(leagueId, userId);
            if (request.CurrentWeek is < 1 or > 18) throw new ApiException(StatusCodes.Status400BadRequest, "Current week must be between 1 and 18.");
            if (request.MaxMembers is not null && request.MaxMembers < league.MemberCount)
                throw new ApiException(StatusCodes.Status409Conflict, "League size cannot be smaller than the number of managers who have already joined.");
            if (request.MaxMembers is not null && request.MaxMembers != league.MaxMembers && (league.DraftStartsAt is not null || store.DraftPicks.Any(pick => pick.LeagueId == leagueId)))
                throw new ApiException(StatusCodes.Status409Conflict, "League size cannot change after the draft has been scheduled.");
            league = league with
            {
                CurrentWeek = request.CurrentWeek ?? league.CurrentWeek,
                MaxMembers = request.MaxMembers ?? league.MaxMembers,
                TradeRejectVotesRequired = request.TradeRejectVotesRequired ?? league.TradeRejectVotesRequired,
                TradeReviewHours = request.TradeReviewHours ?? league.TradeReviewHours,
            };
            store.Leagues[leagueId] = league;
            return league.ToDto();
        }
    }

    private DraftStateDto BuildDraftState(string leagueId, string userId)
    {
        var league = FindLeague(leagueId);
        var order = GetDraftOrder(leagueId);
        var picks = store.DraftPicks.Where(item => item.LeagueId == leagueId).OrderBy(item => item.OverallPick).ToArray();
        var drafted = picks.Select(item => item.PlayerId).ToHashSet();
        var totalPicks = league.MaxMembers * 13;
        var currentPick = Math.Min(picks.Length + 1, totalPicks);
        var currentPicker = !league.DraftCompleted && order.Length > 0 ? GetPicker(order, currentPick) : null;
        var now = DateTimeOffset.UtcNow;
        var status = league.DraftCompleted
            ? "complete"
            : league.MemberCount < league.MaxMembers
                ? "waiting_for_members"
                : league.DraftStartsAt is null
                    ? "unscheduled"
                    : now < league.DraftStartsAt
                        ? "scheduled"
                        : "live";
        return new DraftStateDto(
            status,
            league.DraftStartsAt,
            currentPick,
            totalPicks,
            status == "live" ? picks.LastOrDefault()?.PickedAt.AddMinutes(2) ?? league.DraftStartsAt?.AddMinutes(2) : null,
            currentPicker?.UserId,
            currentPicker?.TeamName,
            status == "live" && currentPicker?.UserId == userId,
            SortRoster(store.GetOrCreateRoster(leagueId, userId)).ToDto(),
            order.Select((member, index) => new DraftParticipantDto(member.UserId, member.TeamName, index + 1)).ToArray(),
            picks.Select(pick => new DraftPickDto(pick.Id, pick.TeamId, FindPlayer(pick.PlayerId).ToDto(), pick.Round, pick.OverallPick, pick.PickedAt)).ToArray(),
            store.Players.Values.Where(player => !drafted.Contains(player.Id)).Select(FantasyMapper.ToDto).ToArray(),
            FindLeague(leagueId).DraftCompleted);
    }

    private CardClaimStateDto BuildCardClaimState(League league, string userId)
    {
        if (!league.DraftCompleted)
            return new CardClaimStateDto(league.CurrentWeek, 0, 0, 0, null, []);
        var state = EnsureActiveCardOffer(league, userId, GetOrCreateCardClaimProgress(league, userId));
        return new CardClaimStateDto(
            league.CurrentWeek,
            state.Allowance,
            state.ClaimedCount,
            state.Allowance - state.ClaimedCount,
            state.OfferId,
            state.OfferedCardIds.Select(id => store.CardCatalog[id].ToDto()).ToArray());
    }

    private CardClaimProgress EnsureActiveCardOffer(League league, string userId, CardClaimProgress state)
    {
        if (state.ClaimedCount >= state.Allowance || state.OfferId is not null) return state;

        // A GET may materialize an offer before the database middleware writes
        // anything. Deriving it from durable state lets the subsequent POST
        // reconstruct the exact same locked offer after a database reload.
        var offerSeed = $"{league.Id}\n{userId}\n{league.CurrentWeek}\n{state.ClaimedCount}";
        var offerId = StableHash(offerSeed)[..32].ToLowerInvariant();
        var choices = store.CardCatalog.Values
            .OrderBy(card => StableHash($"{offerSeed}\n{card.Id}"), StringComparer.Ordinal)
            .Take(3)
            .Select(card => card.Id)
            .ToArray();
        state = state with { OfferId = offerId, OfferedCardIds = choices };
        store.CardClaims[(league.Id, userId, league.CurrentWeek)] = state;
        return state;
    }

    private static string StableHash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private CardClaimProgress GetOrCreateCardClaimProgress(League league, string userId)
    {
        var key = (league.Id, userId, league.CurrentWeek);
        if (store.CardClaims.TryGetValue(key, out var state)) return state;
        var isOpeningAllocation = !store.CardClaims.Keys.Any(item => item.LeagueId == league.Id && item.UserId == userId)
            && store.GetOrCreateHand(league.Id, userId).Count == 0;
        state = new CardClaimProgress(league.Id, userId, league.CurrentWeek, isOpeningAllocation ? 5 : 2, 0, null, []);
        store.CardClaims[key] = state;
        return state;
    }

    private LeagueMembership[] GetDraftOrder(string leagueId) =>
        store.Memberships.Values.Where(member => member.LeagueId == leagueId).OrderBy(member => member.JoinedAt).ThenBy(member => member.UserId).ToArray();

    private static LeagueMembership GetPicker(IReadOnlyList<LeagueMembership> order, int overallPick)
    {
        var zeroBased = overallPick - 1;
        var roundIndex = zeroBased / order.Count;
        var position = zeroBased % order.Count;
        return order[roundIndex % 2 == 0 ? position : order.Count - position - 1];
    }

    private static Roster AddDraftedPlayerToRoster(Roster roster, Player player)
    {
        var starterDefinitions = new (string Id, RosterPosition Position)[]
        {
            ("starter-qb-1", RosterPosition.QB),
            ("starter-rb-1", RosterPosition.RB),
            ("starter-rb-2", RosterPosition.RB),
            ("starter-wr-1", RosterPosition.WR),
            ("starter-wr-2", RosterPosition.WR),
            ("starter-te-1", RosterPosition.TE),
            ("starter-flex-1", RosterPosition.FLEX),
            ("starter-def-1", RosterPosition.DEF),
            ("starter-k-1", RosterPosition.K),
            ("starter-coach-1", RosterPosition.COACH),
        };
        var occupied = roster.Starters.Select(slot => slot.Id).ToHashSet(StringComparer.Ordinal);
        var exact = starterDefinitions.FirstOrDefault(slot => slot.Position == player.Position && !occupied.Contains(slot.Id));
        var destination = exact != default
            ? exact
            : player.Position is RosterPosition.RB or RosterPosition.WR or RosterPosition.TE
                ? starterDefinitions.FirstOrDefault(slot => slot.Position == RosterPosition.FLEX && !occupied.Contains(slot.Id))
                : default;
        if (destination != default)
            return SortRoster(roster with { Starters = [.. roster.Starters, new RosterSlot(destination.Id, "starter", destination.Position, player)] });
        if (roster.Bench.Count >= 3)
            throw new ApiException(StatusCodes.Status409Conflict, "That position has no available starter or bench slot.");
        return roster with { Bench = [.. roster.Bench, new RosterSlot($"bench-{roster.Bench.Count + 1}", "bench", player.Position, player)] };
    }

    private League FindLeague(string id) => store.Leagues.TryGetValue(id, out var value)
        ? value
        : throw new ApiException(StatusCodes.Status404NotFound, "League not found.");
    private League RequireMember(string leagueId, string userId)
    {
        var league = FindLeague(leagueId);
        if (!store.Memberships.ContainsKey((leagueId, userId)))
            throw new ApiException(StatusCodes.Status403Forbidden, "You are not a member of this league.");
        return league;
    }
    private League RequireCommissioner(string leagueId, string userId)
    {
        var league = RequireMember(leagueId, userId);
        if (!string.Equals(league.CommissionerUserId, userId, StringComparison.Ordinal))
            throw new ApiException(StatusCodes.Status403Forbidden, "Only the league commissioner can perform this action.");
        return league;
    }
    private League FindLeagueByCodeOrToken(string codeOrToken) => FindLeagueByCodeOrToken(codeOrToken, out _);
    private League FindLeagueByCodeOrToken(string codeOrToken, out LeagueInvitation? invitation)
    {
        var normalized = codeOrToken.Trim();
        invitation = null;
        if (store.InvitationsByToken.TryGetValue(normalized, out var foundInvitation))
        {
            if (foundInvitation.AcceptedAt is not null)
                throw new ApiException(StatusCodes.Status409Conflict, "This invitation has already been accepted.");
            if (foundInvitation.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new ApiException(StatusCodes.Status410Gone, "This invitation has expired.");
            invitation = foundInvitation;
            return FindLeague(foundInvitation.LeagueId);
        }
        if (store.LeagueIdsByJoinCode.TryGetValue(normalized.ToUpperInvariant(), out var leagueId))
            return FindLeague(leagueId);
        throw new ApiException(StatusCodes.Status404NotFound, "That league invitation or join code was not found.");
    }
    private string FindJoinCode(string leagueId) =>
        store.LeagueIdsByJoinCode.First(pair => pair.Value == leagueId).Key;
    private string CreateJoinCode()
    {
        string code;
        do code = Convert.ToHexString(Guid.NewGuid().ToByteArray())[..8];
        while (store.LeagueIdsByJoinCode.ContainsKey(code));
        return code;
    }
    private LeagueAccessDto ToAccess(League league, string userId, string joinCode)
    {
        var membership = store.Memberships[(league.Id, userId)];
        return new LeagueAccessDto(league.Id, league.Name, league.MemberCount, league.MaxMembers, league.DraftCompleted, membership.Role, league.CommissionerUserId == userId, joinCode);
    }
    private static LeagueInvitationDto ToInvitationDto(LeagueInvitation invitation) => new(
        invitation.Id,
        invitation.LeagueId,
        invitation.Email,
        $"challengerfantasy://join?token={Uri.EscapeDataString(invitation.Token)}",
        invitation.AcceptedAt is not null ? "accepted" : invitation.ExpiresAt <= DateTimeOffset.UtcNow ? "expired" : "pending",
        invitation.ExpiresAt);
    private static LeaguePostDto ToPostDto(LeaguePost post) => new(
        post.Id, post.UserId, post.AuthorName, post.Title, post.Body, post.ImageDataUrl, post.ImagePosition, post.CreatedAt);
    private Matchup FindMatchup(string leagueId) => store.Matchups.TryGetValue(leagueId, out var value)
        ? value
        : throw new ApiException(StatusCodes.Status404NotFound, "Matchup not found.");
    private void CreateOpeningMatchup(League league)
    {
        if (store.Matchups.ContainsKey(league.Id)) return;
        var members = store.Memberships.Values.Where(member => member.LeagueId == league.Id).OrderBy(member => member.JoinedAt).ToArray();
        var left = members[0];
        var right = members.Length > 1 ? members[1] : members[0];
        store.Matchups[league.Id] = new Matchup(
            $"{league.Id}-opening-matchup",
            league.CurrentWeek,
            "Schedule pending",
            false,
            50,
            new MatchupTeam($"{league.Id}-{left.UserId}", left.TeamName, 0, 0, []),
            new MatchupTeam($"{league.Id}-{right.UserId}", right.TeamName, 0, 0),
            [],
            [],
            []);
    }
    private Player FindPlayer(string id) => store.Players.TryGetValue(id, out var value)
        ? value
        : throw new ApiException(StatusCodes.Status404NotFound, "Player not found.");
    private void ValidateTradeAssets(string leagueId, string userId, IReadOnlyList<string> playerIds, IReadOnlyList<string> cardIds)
    {
        if (playerIds.Distinct(StringComparer.Ordinal).Count() != playerIds.Count || cardIds.Distinct(StringComparer.Ordinal).Count() != cardIds.Count)
            throw new ApiException(StatusCodes.Status400BadRequest, "The same player or card cannot be included twice.");
        var rosterIds = store.GetOrCreateRoster(leagueId, userId).Starters.Concat(store.GetOrCreateRoster(leagueId, userId).Bench).Select(slot => slot.Player.Id).ToHashSet(StringComparer.Ordinal);
        if (playerIds.Any(id => !rosterIds.Contains(id)))
            throw new ApiException(StatusCodes.Status409Conflict, "A selected player is no longer on that manager's roster.");
        var hand = store.GetOrCreateHand(leagueId, userId);
        if (cardIds.Any(id => hand.All(card => card.Id != id || card.Quantity < 1)))
            throw new ApiException(StatusCodes.Status409Conflict, "A selected card is no longer in that manager's inventory.");
    }

    private void FinalizeExpiredTrades(League league)
    {
        var expired = store.Trades
            .Select((trade, index) => (trade, index))
            .Where(item => item.trade.LeagueId == league.Id && item.trade.Status == TradeStatus.LeagueReview && item.trade.ReviewEndsAt <= DateTimeOffset.UtcNow)
            .ToArray();
        foreach (var (trade, index) in expired)
        {
            try
            {
                ApplyTrade(trade);
                store.Trades[index] = trade with { Status = TradeStatus.Accepted };
                AddActivity(league.Id, "League", "approved a trade after the review window.", ActivityType.Trade);
            }
            catch (ApiException)
            {
                store.Trades[index] = trade with { Status = TradeStatus.Cancelled };
            }
        }
    }

    private void ApplyTrade(TradeOffer trade)
    {
        ValidateTradeAssets(trade.LeagueId, trade.FromUserId, trade.OfferedPlayerIds, trade.OfferedCardIds);
        ValidateTradeAssets(trade.LeagueId, trade.ToUserId, trade.RequestedPlayerIds, trade.RequestedCardIds);
        var fromRoster = store.GetOrCreateRoster(trade.LeagueId, trade.FromUserId);
        var toRoster = store.GetOrCreateRoster(trade.LeagueId, trade.ToUserId);
        for (var index = 0; index < trade.OfferedPlayerIds.Count; index++)
        {
            var offered = FindPlayer(trade.OfferedPlayerIds[index]);
            var requested = FindPlayer(trade.RequestedPlayerIds[index]);
            var fromSlot = fromRoster.Starters.Concat(fromRoster.Bench).Single(slot => slot.Player.Id == offered.Id);
            var toSlot = toRoster.Starters.Concat(toRoster.Bench).Single(slot => slot.Player.Id == requested.Id);
            if (!CanFill(requested.Position, fromSlot.Position) || !CanFill(offered.Position, toSlot.Position))
                throw new ApiException(StatusCodes.Status409Conflict, "Those players cannot fill each other's roster slots.");
            fromRoster = ReplaceRosterPlayer(fromRoster, offered.Id, requested);
            toRoster = ReplaceRosterPlayer(toRoster, requested.Id, offered);
        }
        store.Rosters[(trade.LeagueId, trade.FromUserId)] = fromRoster;
        store.Rosters[(trade.LeagueId, trade.ToUserId)] = toRoster;
        foreach (var cardId in trade.OfferedCardIds) TransferCard(trade.LeagueId, trade.FromUserId, trade.ToUserId, cardId);
        foreach (var cardId in trade.RequestedCardIds) TransferCard(trade.LeagueId, trade.ToUserId, trade.FromUserId, cardId);
    }

    private static Roster ReplaceRosterPlayer(Roster roster, string outgoingId, Player incoming)
    {
        RosterSlot Replace(RosterSlot slot) => slot.Player.Id == outgoingId ? slot with { Player = incoming } : slot;
        return roster with { Starters = roster.Starters.Select(Replace).ToArray(), Bench = roster.Bench.Select(Replace).ToArray() };
    }

    private void TransferCard(string leagueId, string fromUserId, string toUserId, string cardId)
    {
        var from = store.GetOrCreateHand(leagueId, fromUserId);
        var index = from.FindIndex(card => card.Id == cardId && card.Quantity > 0);
        if (index < 0) throw new ApiException(StatusCodes.Status409Conflict, "A traded card is no longer available.");
        var card = from[index];
        if (card.Quantity == 1) from.RemoveAt(index);
        else from[index] = card with { Quantity = card.Quantity - 1 };
        var to = store.GetOrCreateHand(leagueId, toUserId);
        var target = to.FindIndex(item => item.Id == cardId);
        if (target < 0) to.Add(card with { Quantity = 1 });
        else to[target] = to[target] with { Quantity = to[target].Quantity + 1 };
    }
    private void AddActivity(string leagueId, string actor, string summary, ActivityType type) =>
        store.Activities.Add(new ActivityEntry(Guid.NewGuid().ToString("N"), leagueId, actor, summary, type, DateTimeOffset.UtcNow));
    private static IReadOnlyList<PlayerMatchup> ReplaceManagerPlayers(IReadOnlyList<PlayerMatchup> matchups, IReadOnlyList<RosterSlot> slots) =>
        matchups.Select((item, index) => index < slots.Count ? item with { Left = slots[index].Player } : item).ToArray();
    private static IReadOnlyList<PlayerMatchup> PairRosters(IReadOnlyList<RosterSlot> left, IReadOnlyList<RosterSlot> right) =>
        SortRoster(new Roster(left, [])).Starters.Zip(SortRoster(new Roster(right, [])).Starters, (leftSlot, rightSlot) => new PlayerMatchup(leftSlot.Player, rightSlot.Player)).ToArray();
    private static Roster SortRoster(Roster roster)
    {
        var order = new[] { "starter-qb-1", "starter-rb-1", "starter-rb-2", "starter-wr-1", "starter-wr-2", "starter-te-1", "starter-flex-1", "starter-def-1", "starter-k-1", "starter-coach-1" };
        return roster with
        {
            Starters = roster.Starters.OrderBy(slot => Array.IndexOf(order, slot.Id)).ToArray(),
            Bench = roster.Bench.OrderBy(slot => slot.Id).ToArray(),
        };
    }
    private static bool CanFill(RosterPosition player, RosterPosition slot) =>
        player == slot || slot == RosterPosition.FLEX && player is RosterPosition.RB or RosterPosition.WR or RosterPosition.TE;
    private static void ValidatePage(int cursor, int limit)
    {
        if (cursor < 0) throw new ApiException(StatusCodes.Status400BadRequest, "Cursor cannot be negative.");
        if (limit is < 1 or > 100) throw new ApiException(StatusCodes.Status400BadRequest, "Limit must be between 1 and 100.");
    }
}
