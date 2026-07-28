using ChallengerFantasy.Api.Contracts;

namespace ChallengerFantasy.Api.Services;

public interface IFantasyService
{
    HomeDto GetHome(string userId);
    TeamSummaryDto GetTeam(string leagueId, string userId);
    IReadOnlyList<LeagueSummaryDto> GetLeagues(string userId);
    LeagueAccessDto CreateLeague(string userId, string managerName, string? email, CreateLeagueRequest request);
    LeaguePreviewDto PreviewLeague(string codeOrToken);
    LeagueAccessDto JoinLeague(string userId, string managerName, string? email, JoinLeagueRequest request);
    IReadOnlyList<LeagueMemberDto> GetLeagueMembers(string leagueId, string userId);
    IReadOnlyList<LeaguePostDto> GetLeaguePosts(string leagueId, string userId);
    LeaguePostDto CreateLeaguePost(string leagueId, string userId, CreateLeaguePostRequest request);
    LeagueAccessDto GetLeagueAccess(string leagueId, string userId);
    IReadOnlyList<LeagueInvitationDto> GetLeagueInvitations(string leagueId, string userId);
    LeagueInvitationDto CreateLeagueInvitation(string leagueId, string userId, CreateLeagueInvitationRequest request);
    LeagueDto GetLeague(string leagueId, string userId);
    ActivityPageDto GetActivity(string leagueId, int cursor, int limit, string userId);
    MatchupDto GetMatchup(string leagueId, string userId);
    RosterDto GetRoster(string leagueId, string userId);
    RosterDto SaveLineup(string leagueId, string userId, SaveLineupRequest request);
    AppliedCardDto PlayCard(string leagueId, string userId, PlayCardRequest request);
    CardClaimStateDto GetCardClaim(string leagueId, string userId);
    CardClaimStateDto ClaimCard(string leagueId, string userId, ClaimCardRequest request);
    void RemoveCard(string leagueId, string userId, string playId);
    FreeAgentPageDto GetFreeAgents(string leagueId, int cursor, int limit, string? search, string? position, string userId);
    RosterDto AddFreeAgent(string leagueId, string userId, AddFreeAgentRequest request);
    IReadOnlyList<WaiverClaimDto> GetWaivers(string leagueId, string userId);
    WaiverClaimDto CreateWaiver(string leagueId, string userId, WaiverClaimRequest request);
    void CancelWaiver(string leagueId, string userId, string claimId);
    IReadOnlyList<TradeOfferDto> GetTrades(string leagueId, string userId);
    IReadOnlyList<TradePartnerDto> GetTradePartners(string leagueId, string userId);
    TradeOfferDto CreateTrade(string leagueId, string userId, CreateTradeRequest request);
    TradeOfferDto ResolveTrade(string leagueId, string userId, string tradeId, ResolveTradeRequest request);
    TradeOfferDto VoteTrade(string leagueId, string userId, string tradeId, TradeVoteRequest request);
    IReadOnlyList<ChatMessageDto> GetMessages(string leagueId, int limit, string userId);
    ChatMessageDto SendMessage(string leagueId, string userId, ChatMessageRequest request);
    DraftStateDto GetDraft(string leagueId, string userId);
    DraftStateDto ScheduleDraft(string leagueId, string userId, ScheduleDraftRequest request);
    DraftStateDto MakeDraftPick(string leagueId, string userId, DraftPickRequest request);
    DraftStateDto CompleteDraft(string leagueId, string userId);
    LeagueDto UpdateLeague(string leagueId, string userId, LeagueSettingsRequest request);
}
