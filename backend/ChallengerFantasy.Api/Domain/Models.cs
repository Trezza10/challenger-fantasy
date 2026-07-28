namespace ChallengerFantasy.Api.Domain;

public enum RosterPosition { QB, RB, WR, TE, FLEX, DEF, K, COACH }
public enum CardTargetTeam { SELF, OPPONENT }
public enum CardRarity { Common, Rare, Epic, Legendary }
public enum CardType { Strategy, Tactic, Review }
public enum ActivityType { Card, Lineup, Trade, Waiver }
public enum WaiverStatus { Pending, Won, Lost, Cancelled }
public enum TradeStatus { Pending, LeagueReview, Accepted, Rejected, Cancelled }

public sealed record Player(
    string Id,
    string Name,
    RosterPosition Position,
    string Team,
    double Score,
    double CardAdjustment,
    bool GameStarted,
    IReadOnlyList<PlayerStat> LiveStats,
    IReadOnlyList<PlayerStat> RecentStats,
    IReadOnlyList<ScoreBreakdownItem> ScoreBreakdown,
    IReadOnlyList<PlayerWeekHistory> WeeklyHistory);

public sealed record PlayerStat(string Label, string Value);
public sealed record ScoreBreakdownItem(string Label, double Quantity, double PointsPerUnit, double Points);
public sealed record PlayerWeekHistory(int Week, string Opponent, string StatLine, double BasePoints, double CardAdjustment);
public sealed record RosterSlot(string Id, string Kind, RosterPosition Position, Player Player);
public sealed record Roster(IReadOnlyList<RosterSlot> Starters, IReadOnlyList<RosterSlot> Bench);

public sealed record PowerCard(
    string Id,
    string Label,
    string Description,
    string EffectText,
    string Duration,
    string Accent,
    string Icon,
    CardTargetTeam AllowedTeam,
    IReadOnlyList<string> AllowedPositions,
    CardRarity Rarity,
    CardType Type,
    int Quantity);

public sealed record AppliedCard(
    string Id,
    string PlayerId,
    string PlayerName,
    string PlayedByUserId,
    string PlayedByName,
    string PlayedBy,
    PowerCard Card);

public sealed record MatchupTeam(string Id, string Name, double Score, double ProjectedPoints, IReadOnlyList<PowerCard>? Hand = null);
public sealed record PlayerMatchup(Player Left, Player Right);
public sealed record Matchup(
    string Id,
    int Week,
    string GameTime,
    bool IsLive,
    int WinChance,
    MatchupTeam LeftTeam,
    MatchupTeam RightTeam,
    IReadOnlyList<PlayerMatchup> Starters,
    IReadOnlyList<PlayerMatchup> Bench,
    IReadOnlyList<AppliedCard> AppliedCards);

public sealed record League(string Id, string Name, int MemberCount, int MaxMembers, int CurrentWeek, bool DraftCompleted, DateTimeOffset? DraftStartsAt, string CommissionerUserId, int TradeRejectVotesRequired = 2, int TradeReviewHours = 24);
public sealed record LeagueMembership(
    string LeagueId,
    string UserId,
    string ManagerName,
    string? Email,
    string TeamName,
    string Role,
    int Wins,
    int Losses,
    int Ties,
    double PointsFor,
    double PointsAgainst,
    DateTimeOffset JoinedAt);
public sealed record LeagueInvitation(string Id, string LeagueId, string InvitedByUserId, string? Email, string Token, DateTimeOffset ExpiresAt, DateTimeOffset? AcceptedAt);
public sealed record NewsStory(string Id, string Category, string Title, string Summary, string Body, DateTimeOffset PublishedAt);
public sealed record ActivityEntry(string Id, string LeagueId, string Actor, string Summary, ActivityType Type, DateTimeOffset OccurredAt);
public sealed record WaiverClaim(string Id, string LeagueId, string UserId, string AddPlayerId, string? DropPlayerId, int Priority, WaiverStatus Status, DateTimeOffset CreatedAt);
public sealed record TradeOffer(
    string Id,
    string LeagueId,
    string FromUserId,
    string ToUserId,
    IReadOnlyList<string> OfferedPlayerIds,
    IReadOnlyList<string> RequestedPlayerIds,
    IReadOnlyList<string> OfferedCardIds,
    IReadOnlyList<string> RequestedCardIds,
    TradeStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReviewEndsAt,
    IReadOnlyList<string> RejectVotes);
public sealed record ChatMessage(string Id, string LeagueId, string UserId, string Sender, string Text, DateTimeOffset SentAt);
public sealed record DraftPick(string Id, string LeagueId, string TeamId, string PlayerId, int Round, int OverallPick, DateTimeOffset PickedAt);
public sealed record CardClaimProgress(string LeagueId, string UserId, int Week, int Allowance, int ClaimedCount, string? OfferId, IReadOnlyList<string> OfferedCardIds);
public sealed record LeaguePost(string Id, string LeagueId, string UserId, string AuthorName, string Title, string Body, string? ImageDataUrl, string? ImagePosition, DateTimeOffset CreatedAt);
