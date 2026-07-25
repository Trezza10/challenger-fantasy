using System.ComponentModel.DataAnnotations;

namespace ChallengerFantasy.Api.Contracts;

public sealed record PlayerStatDto(string Label, string Value);
public sealed record PlayerDto(string Id, string Name, string Position, string Team, double Score, bool GameStarted, IReadOnlyList<PlayerStatDto> LiveStats, IReadOnlyList<PlayerStatDto> RecentStats);
public sealed record RosterSlotDto(string Id, string Kind, string Position, PlayerDto Player);
public sealed record RosterDto(IReadOnlyList<RosterSlotDto> Starters, IReadOnlyList<RosterSlotDto> Bench);
public sealed record SaveLineupRequest([Required] IReadOnlyList<LineupSlotRequest> Starters, [Required] IReadOnlyList<LineupSlotRequest> Bench);
public sealed record LineupSlotRequest([Required] string SlotId, [Required] string PlayerId);

public sealed record PowerCardDto(string Id, string Label, string Description, string EffectText, string Duration, string Accent, string Icon, string AllowedTeam, IReadOnlyList<string> AllowedPositions, string Rarity, string Type, int Quantity);
public sealed record AppliedCardDto(string Id, string PlayerId, string PlayerName, string PlayedBy, string PlayedByName, PowerCardDto Card);
public sealed record PlayCardRequest([Required] string CardId, [Required] string PlayerId);

public sealed record MatchupTeamDto(string Id, string Name, double Score, double ProjectedPoints, IReadOnlyList<PowerCardDto>? Hand = null);
public sealed record PlayerMatchupDto(PlayerDto Left, PlayerDto Right);
public sealed record LeagueMatchupSummaryDto(string Id, string FeaturedPlayers, string GameTime, bool IsLive, int WinChance, MatchupTeamDto LeftTeam, MatchupTeamDto RightTeam, IReadOnlyList<PlayerMatchupDto> PlayerMatchups, IReadOnlyList<PlayerMatchupDto> BenchMatchups, IReadOnlyList<AppliedCardDto> InitialModifiers);
public sealed record MatchupDto(int Week, string GameTime, bool IsLive, int WinChance, MatchupTeamDto LeftTeam, MatchupTeamDto RightTeam, IReadOnlyList<PlayerMatchupDto> PlayerMatchups, IReadOnlyList<PlayerMatchupDto> BenchMatchups, IReadOnlyList<PowerCardDto> Hand, IReadOnlyList<AppliedCardDto> InitialModifiers, IReadOnlyList<LeagueMatchupSummaryDto> LeagueMatchups);

public sealed record LeagueSummaryDto(string Id, string Name, int MemberCount);
public sealed record LeagueDto(string Id, string Name, int MemberCount, int CurrentWeek);
public sealed record NewsStoryDto(string Id, string Category, string Title, string Summary, string Body, string PublishedAt);
public sealed record HomeDto(string LeagueRank, double ProjectedPoints, string WelcomeMessage, IReadOnlyList<NewsStoryDto> News);
public sealed record TeamSummaryDto(string RosterSpots, string TopPlayer);
public sealed record ActivityEntryDto(string Id, string Actor, string Summary, string Type, string OccurredAt);
public sealed record ActivityPageDto(IReadOnlyList<ActivityEntryDto> Entries, int? NextCursor);

public sealed record FreeAgentPageDto(IReadOnlyList<PlayerDto> Entries, int? NextCursor);
public sealed record AddFreeAgentRequest([Required] string PlayerId, string? DropPlayerId);
public sealed record WaiverClaimRequest([Required] string AddPlayerId, string? DropPlayerId);
public sealed record WaiverClaimDto(string Id, string AddPlayerId, string? DropPlayerId, int Priority, string Status, DateTimeOffset CreatedAt);

public sealed record CreateTradeRequest([Required] string ToUserId, [Required] IReadOnlyList<string> OfferedPlayerIds, [Required] IReadOnlyList<string> RequestedPlayerIds);
public sealed record TradeOfferDto(string Id, string FromUserId, string ToUserId, IReadOnlyList<string> OfferedPlayerIds, IReadOnlyList<string> RequestedPlayerIds, string Status, DateTimeOffset CreatedAt);
public sealed record ResolveTradeRequest([Required] string Decision);

public sealed record ChatMessageRequest([Required, StringLength(1000, MinimumLength = 1)] string Text);
public sealed record ChatMessageDto(string Id, string UserId, string Sender, string Text, DateTimeOffset SentAt);

public sealed record DraftPickRequest([Required] string PlayerId);
public sealed record DraftPickDto(string Id, string TeamId, string PlayerId, int Round, int OverallPick, DateTimeOffset PickedAt);
public sealed record DraftStateDto(int CurrentPick, DateTimeOffset? ClockEndsAt, IReadOnlyList<DraftPickDto> Picks, IReadOnlyList<PlayerDto> AvailablePlayers);

public sealed record LeagueSettingsRequest(int? CurrentWeek);
