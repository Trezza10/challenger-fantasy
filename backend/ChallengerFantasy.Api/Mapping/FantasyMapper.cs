using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Domain;

namespace ChallengerFantasy.Api.Mapping;

public static class FantasyMapper
{
    public static PlayerDto ToDto(this Player value) => new(
        value.Id, value.Name, value.Position.ToString(), value.Team, value.Score, value.GameStarted,
        value.LiveStats.Select(ToDto).ToArray(), value.RecentStats.Select(ToDto).ToArray());
    public static PlayerStatDto ToDto(this PlayerStat value) => new(value.Label, value.Value);
    public static RosterDto ToDto(this Roster value) => new(value.Starters.Select(ToDto).ToArray(), value.Bench.Select(ToDto).ToArray());
    public static RosterSlotDto ToDto(this RosterSlot value) => new(value.Id, value.Kind, value.Position.ToString(), value.Player.ToDto());
    public static PowerCardDto ToDto(this PowerCard value) => new(value.Id, value.Label, value.Description, value.EffectText, value.Duration, value.Accent, value.Icon, value.AllowedTeam.ToString(), value.AllowedPositions, value.Rarity.ToString(), value.Type.ToString(), value.Quantity);
    public static AppliedCardDto ToDto(this AppliedCard value) => new(value.Id, value.PlayerId, value.PlayerName, value.PlayedBy, value.PlayedByName, value.Card.ToDto());
    public static MatchupTeamDto ToDto(this MatchupTeam value) => new(value.Id, value.Name, value.Score, value.ProjectedPoints, value.Hand?.Select(ToDto).ToArray());
    public static PlayerMatchupDto ToDto(this PlayerMatchup value) => new(value.Left.ToDto(), value.Right.ToDto());
    public static LeagueSummaryDto ToSummaryDto(this League value) => new(value.Id, value.Name, value.MemberCount);
    public static LeagueDto ToDto(this League value) => new(value.Id, value.Name, value.MemberCount, value.CurrentWeek);
    public static ActivityEntryDto ToDto(this ActivityEntry value) => new(value.Id, value.Actor, value.Summary, value.Type.ToString().ToLowerInvariant(), value.OccurredAt.ToString("O"));
    public static WaiverClaimDto ToDto(this WaiverClaim value) => new(value.Id, value.AddPlayerId, value.DropPlayerId, value.Priority, value.Status.ToString(), value.CreatedAt);
    public static TradeOfferDto ToDto(this TradeOffer value) => new(value.Id, value.FromUserId, value.ToUserId, value.OfferedPlayerIds, value.RequestedPlayerIds, value.Status.ToString(), value.CreatedAt);
    public static ChatMessageDto ToDto(this ChatMessage value) => new(value.Id, value.UserId, value.Sender, value.Text, value.SentAt);
    public static DraftPickDto ToDto(this DraftPick value) => new(value.Id, value.TeamId, value.PlayerId, value.Round, value.OverallPick, value.PickedAt);
}
