using ChallengerFantasy.Api.Contracts;

namespace ChallengerFantasy.Api.Services;

public interface IFantasyService
{
    HomeDto GetHome(string userId);
    TeamSummaryDto GetTeam(string leagueId, string userId);
    IReadOnlyList<LeagueSummaryDto> GetLeagues(string userId);
    LeagueDto GetLeague(string leagueId, string userId);
    ActivityPageDto GetActivity(string leagueId, int cursor, int limit, string userId);
    MatchupDto GetMatchup(string leagueId, string userId);
    RosterDto GetRoster(string leagueId, string userId);
    RosterDto SaveLineup(string leagueId, string userId, SaveLineupRequest request);
    AppliedCardDto PlayCard(string leagueId, string userId, PlayCardRequest request);
    void RemoveCard(string leagueId, string userId, string playId);
    FreeAgentPageDto GetFreeAgents(string leagueId, int cursor, int limit, string? search, string? position, string userId);
    RosterDto AddFreeAgent(string leagueId, string userId, AddFreeAgentRequest request);
    IReadOnlyList<WaiverClaimDto> GetWaivers(string leagueId, string userId);
    WaiverClaimDto CreateWaiver(string leagueId, string userId, WaiverClaimRequest request);
    void CancelWaiver(string leagueId, string userId, string claimId);
    IReadOnlyList<TradeOfferDto> GetTrades(string leagueId, string userId);
    TradeOfferDto CreateTrade(string leagueId, string userId, CreateTradeRequest request);
    TradeOfferDto ResolveTrade(string leagueId, string userId, string tradeId, ResolveTradeRequest request);
    IReadOnlyList<ChatMessageDto> GetMessages(string leagueId, int limit, string userId);
    ChatMessageDto SendMessage(string leagueId, string userId, ChatMessageRequest request);
    DraftStateDto GetDraft(string leagueId, string userId);
    DraftStateDto MakeDraftPick(string leagueId, string userId, DraftPickRequest request);
    LeagueDto UpdateLeague(string leagueId, LeagueSettingsRequest request);
}
