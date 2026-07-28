using System.ComponentModel.DataAnnotations;

namespace ChallengerFantasy.Api.Contracts;

public sealed record PlayerStatDto(string Label, string Value);
public sealed record ScoreBreakdownItemDto(string Label, double Quantity, double PointsPerUnit, double Points);
public sealed record PlayerWeekHistoryDto(int Week, string Opponent, string StatLine, double BasePoints, double CardAdjustment, double TotalPoints);
public sealed record PlayerDto(string Id, string Name, string Position, string Team, double Score, double BaseScore, double CardAdjustment, bool GameStarted, IReadOnlyList<PlayerStatDto> LiveStats, IReadOnlyList<PlayerStatDto> RecentStats, IReadOnlyList<ScoreBreakdownItemDto> ScoreBreakdown, IReadOnlyList<PlayerWeekHistoryDto> WeeklyHistory);
public sealed record RosterSlotDto(string Id, string Kind, string Position, PlayerDto Player);
public sealed record RosterDto(IReadOnlyList<RosterSlotDto> Starters, IReadOnlyList<RosterSlotDto> Bench);
public sealed record SaveLineupRequest([Required] IReadOnlyList<LineupSlotRequest> Starters, [Required] IReadOnlyList<LineupSlotRequest> Bench);
public sealed record LineupSlotRequest([Required] string SlotId, [Required] string PlayerId);

public sealed record PowerCardDto(string Id, string Label, string Description, string EffectText, string Duration, string Accent, string Icon, string AllowedTeam, IReadOnlyList<string> AllowedPositions, string Rarity, string Type, int Quantity);
public sealed record AppliedCardDto(string Id, string PlayerId, string PlayerName, string PlayedBy, string PlayedByName, PowerCardDto Card);
public sealed record PlayCardRequest([Required] string CardId, [Required] string PlayerId);
public sealed record CardClaimStateDto(int Week, int Allowance, int ClaimedCount, int RemainingClaims, string? OfferId, IReadOnlyList<PowerCardDto> Choices);
public sealed record ClaimCardRequest([Required] string OfferId, [Required] string CardId);

public sealed record MatchupTeamDto(string Id, string Name, double Score, double ProjectedPoints, IReadOnlyList<PowerCardDto>? Hand = null);
public sealed record PlayerMatchupDto(PlayerDto Left, PlayerDto Right);
public sealed record LeagueMatchupSummaryDto(string Id, string FeaturedPlayers, string GameTime, bool IsLive, int WinChance, MatchupTeamDto LeftTeam, MatchupTeamDto RightTeam, IReadOnlyList<PlayerMatchupDto> PlayerMatchups, IReadOnlyList<PlayerMatchupDto> BenchMatchups, IReadOnlyList<AppliedCardDto> InitialModifiers);
public sealed record MatchupDto(int Week, string GameTime, bool IsLive, int WinChance, MatchupTeamDto LeftTeam, MatchupTeamDto RightTeam, IReadOnlyList<PlayerMatchupDto> PlayerMatchups, IReadOnlyList<PlayerMatchupDto> BenchMatchups, IReadOnlyList<PowerCardDto> Hand, IReadOnlyList<AppliedCardDto> InitialModifiers, IReadOnlyList<LeagueMatchupSummaryDto> LeagueMatchups, string Status, string StatusMessage, int MemberCount, int MaxMembers);

public sealed record LeagueSummaryDto(string Id, string Name, int MemberCount, int MaxMembers);
public sealed record LeagueDto(string Id, string Name, int MemberCount, int MaxMembers, int CurrentWeek, bool DraftCompleted, DateTimeOffset? DraftStartsAt, int TradeRejectVotesRequired, int TradeReviewHours);
public sealed record CreateLeagueRequest(
    [Required, StringLength(80, MinimumLength = 3)] string Name,
    [Required, StringLength(80, MinimumLength = 3)] string TeamName,
    [Range(2, 20)] int MaxMembers = 10,
    [StringLength(100)] string? ManagerName = null,
    [EmailAddress] string? Email = null);
public sealed record JoinLeagueRequest(
    [Required, StringLength(200, MinimumLength = 4)] string CodeOrToken,
    [StringLength(80, MinimumLength = 3)] string? TeamName = null,
    [StringLength(100)] string? ManagerName = null,
    [EmailAddress] string? Email = null);
public sealed record LeagueAccessDto(string LeagueId, string Name, int MemberCount, int MaxMembers, bool DraftCompleted, string Role, bool IsCommissioner, string JoinCode);
public sealed record LeaguePreviewDto(string LeagueId, string Name, int MemberCount, int MaxMembers, string CommissionerUserId);
public sealed record CreateLeagueInvitationRequest([EmailAddress] string? Email);
public sealed record LeagueInvitationDto(string Id, string LeagueId, string? Email, string InviteUrl, string Status, DateTimeOffset ExpiresAt);
public sealed record LeagueMemberDto(
    string UserId,
    string ManagerName,
    string? Email,
    string TeamName,
    string Role,
    bool IsCurrentUser,
    int Rank,
    int Wins,
    int Losses,
    int Ties,
    double PointsFor,
    double PointsAgainst);
public sealed record LeaguePostDto(string Id, string UserId, string AuthorName, string Title, string Body, string? ImageDataUrl, string? ImagePosition, DateTimeOffset CreatedAt);
public sealed record CreateLeaguePostRequest(
    [Required, StringLength(120, MinimumLength = 3)] string Title,
    [Required, StringLength(5000, MinimumLength = 1)] string Body,
    [StringLength(3_000_000)] string? ImageDataUrl,
    [RegularExpression("^(top|bottom)$")] string? ImagePosition);
public sealed record NewsStoryDto(string Id, string Category, string Title, string Summary, string Body, string PublishedAt);
public sealed record HomeDto(string LeagueRank, double ProjectedPoints, string WelcomeMessage, IReadOnlyList<NewsStoryDto> News);
public sealed record TeamSummaryDto(string RosterSpots, string TopPlayer);
public sealed record ActivityEntryDto(string Id, string Actor, string Summary, string Type, string OccurredAt);
public sealed record ActivityPageDto(IReadOnlyList<ActivityEntryDto> Entries, int? NextCursor);

public sealed record FreeAgentPageDto(IReadOnlyList<PlayerDto> Entries, int? NextCursor);
public sealed record AddFreeAgentRequest([Required] string PlayerId, string? DropPlayerId);
public sealed record WaiverClaimRequest([Required] string AddPlayerId, string? DropPlayerId);
public sealed record WaiverClaimDto(string Id, string AddPlayerId, string? DropPlayerId, int Priority, string Status, DateTimeOffset CreatedAt);

public sealed record CreateTradeRequest([Required] string ToUserId, IReadOnlyList<string>? OfferedPlayerIds = null, IReadOnlyList<string>? RequestedPlayerIds = null, IReadOnlyList<string>? OfferedCardIds = null, IReadOnlyList<string>? RequestedCardIds = null);
public sealed record TradeOfferDto(string Id, string FromUserId, string ToUserId, IReadOnlyList<string> OfferedPlayerIds, IReadOnlyList<string> RequestedPlayerIds, IReadOnlyList<string> OfferedCardIds, IReadOnlyList<string> RequestedCardIds, string Status, DateTimeOffset CreatedAt, DateTimeOffset? ReviewEndsAt, int RejectVotes, int RejectVotesRequired, bool HasCurrentUserRejected);
public sealed record ResolveTradeRequest([Required] string Decision);
public sealed record TradeVoteRequest([Required] string Decision);
public sealed record TradePartnerDto(string UserId, string TeamName, RosterDto Roster, IReadOnlyList<PowerCardDto> Hand);

public sealed record ChatMessageRequest([Required, StringLength(1000, MinimumLength = 1)] string Text);
public sealed record ChatMessageDto(string Id, string UserId, string Sender, string Text, DateTimeOffset SentAt);

public sealed record DraftPickRequest([Required] string PlayerId);
public sealed record DraftPickDto(string Id, string TeamId, PlayerDto Player, int Round, int OverallPick, DateTimeOffset PickedAt);
public sealed record DraftParticipantDto(string UserId, string TeamName, int DraftPosition);
public sealed record ScheduleDraftRequest(DateTimeOffset StartsAt);
public sealed record DraftStateDto(
    string Status,
    DateTimeOffset? StartsAt,
    int CurrentPick,
    int TotalPicks,
    DateTimeOffset? ClockEndsAt,
    string? CurrentPickerUserId,
    string? CurrentPickerTeamName,
    bool CanCurrentUserPick,
    RosterDto CurrentUserRoster,
    IReadOnlyList<DraftParticipantDto> DraftOrder,
    IReadOnlyList<DraftPickDto> Picks,
    IReadOnlyList<PlayerDto> AvailablePlayers,
    bool IsComplete);

public sealed record LeagueSettingsRequest(int? CurrentWeek, [Range(2, 20)] int? MaxMembers, [Range(1, 20)] int? TradeRejectVotesRequired = null, [Range(1, 168)] int? TradeReviewHours = null);
