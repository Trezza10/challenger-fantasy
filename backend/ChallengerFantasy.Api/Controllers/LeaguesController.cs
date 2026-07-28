using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChallengerFantasy.Api.Controllers;

[ApiController]
[Authorize]
[Route("leagues")]
public sealed class LeaguesController(IFantasyService service, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<LeagueSummaryDto>> GetAll() => Ok(service.GetLeagues(currentUser.UserId));

    [HttpPost]
    public ActionResult<LeagueAccessDto> Create(CreateLeagueRequest request)
    {
        var result = service.CreateLeague(currentUser.UserId, request.ManagerName ?? currentUser.DisplayName, request.Email ?? currentUser.Email, request);
        return CreatedAtAction(nameof(Get), new { leagueId = result.LeagueId }, result);
    }

    [HttpGet("join/{codeOrToken}")]
    public ActionResult<LeaguePreviewDto> Preview(string codeOrToken) => Ok(service.PreviewLeague(codeOrToken));

    [HttpPost("join")]
    public ActionResult<LeagueAccessDto> Join(JoinLeagueRequest request) =>
        Ok(service.JoinLeague(currentUser.UserId, request.ManagerName ?? currentUser.DisplayName, request.Email ?? currentUser.Email, request));

    [HttpGet("{leagueId}")]
    public ActionResult<LeagueDto> Get(string leagueId) => Ok(service.GetLeague(leagueId, currentUser.UserId));

    [HttpPatch("{leagueId}/settings")]
    public ActionResult<LeagueDto> Update(string leagueId, LeagueSettingsRequest request) => Ok(service.UpdateLeague(leagueId, currentUser.UserId, request));

    [HttpGet("{leagueId}/access")]
    public ActionResult<LeagueAccessDto> GetAccess(string leagueId) => Ok(service.GetLeagueAccess(leagueId, currentUser.UserId));

    [HttpGet("{leagueId}/members")]
    public ActionResult<IReadOnlyList<LeagueMemberDto>> GetMembers(string leagueId) =>
        Ok(service.GetLeagueMembers(leagueId, currentUser.UserId));

    [HttpGet("{leagueId}/posts")]
    public ActionResult<IReadOnlyList<LeaguePostDto>> GetPosts(string leagueId) =>
        Ok(service.GetLeaguePosts(leagueId, currentUser.UserId));

    [HttpPost("{leagueId}/posts")]
    public ActionResult<LeaguePostDto> CreatePost(string leagueId, CreateLeaguePostRequest request)
    {
        var result = service.CreateLeaguePost(leagueId, currentUser.UserId, request);
        return Created($"/leagues/{leagueId}/posts/{result.Id}", result);
    }

    [HttpGet("{leagueId}/invitations")]
    public ActionResult<IReadOnlyList<LeagueInvitationDto>> GetInvitations(string leagueId) =>
        Ok(service.GetLeagueInvitations(leagueId, currentUser.UserId));

    [HttpPost("{leagueId}/invitations")]
    public ActionResult<LeagueInvitationDto> Invite(string leagueId, CreateLeagueInvitationRequest request)
    {
        var result = service.CreateLeagueInvitation(leagueId, currentUser.UserId, request);
        return Created($"/leagues/{leagueId}/invitations/{result.Id}", result);
    }

    [HttpGet("{leagueId}/activity")]
    public ActionResult<ActivityPageDto> GetActivity(string leagueId, [FromQuery] int cursor = 0, [FromQuery] int limit = 10) =>
        Ok(service.GetActivity(leagueId, cursor, limit, currentUser.UserId));

    [HttpGet("{leagueId}/matchup")]
    public ActionResult<MatchupDto> GetMatchup(string leagueId) => Ok(service.GetMatchup(leagueId, currentUser.UserId));

    [HttpGet("{leagueId}/roster")]
    public ActionResult<RosterDto> GetRoster(string leagueId) => Ok(service.GetRoster(leagueId, currentUser.UserId));

    [HttpPut("{leagueId}/lineup")]
    public ActionResult<RosterDto> SaveLineup(string leagueId, SaveLineupRequest request) =>
        Ok(service.SaveLineup(leagueId, currentUser.UserId, request));

    [HttpPost("{leagueId}/cards/plays")]
    public ActionResult<AppliedCardDto> PlayCard(string leagueId, PlayCardRequest request)
    {
        var result = service.PlayCard(leagueId, currentUser.UserId, request);
        return CreatedAtAction(nameof(GetMatchup), new { leagueId }, result);
    }

    [HttpGet("{leagueId}/cards/claims/current")]
    public ActionResult<CardClaimStateDto> GetCardClaim(string leagueId) =>
        Ok(service.GetCardClaim(leagueId, currentUser.UserId));

    [HttpPost("{leagueId}/cards/claims")]
    public ActionResult<CardClaimStateDto> ClaimCard(string leagueId, ClaimCardRequest request) =>
        Ok(service.ClaimCard(leagueId, currentUser.UserId, request));

    [HttpDelete("{leagueId}/cards/plays/{playId}")]
    public IActionResult RemoveCard(string leagueId, string playId)
    {
        service.RemoveCard(leagueId, currentUser.UserId, playId);
        return NoContent();
    }

    [HttpGet("{leagueId}/free-agents")]
    public ActionResult<FreeAgentPageDto> GetFreeAgents(string leagueId, [FromQuery] int cursor = 0, [FromQuery] int limit = 20, [FromQuery] string? search = null, [FromQuery] string? position = null) =>
        Ok(service.GetFreeAgents(leagueId, cursor, limit, search, position, currentUser.UserId));

    [HttpPost("{leagueId}/free-agents/add")]
    public ActionResult<RosterDto> AddFreeAgent(string leagueId, AddFreeAgentRequest request) =>
        Ok(service.AddFreeAgent(leagueId, currentUser.UserId, request));

    [HttpGet("{leagueId}/waivers")]
    public ActionResult<IReadOnlyList<WaiverClaimDto>> GetWaivers(string leagueId) =>
        Ok(service.GetWaivers(leagueId, currentUser.UserId));

    [HttpPost("{leagueId}/waivers")]
    public ActionResult<WaiverClaimDto> CreateWaiver(string leagueId, WaiverClaimRequest request)
    {
        var result = service.CreateWaiver(leagueId, currentUser.UserId, request);
        return Created($"/leagues/{leagueId}/waivers/{result.Id}", result);
    }

    [HttpDelete("{leagueId}/waivers/{claimId}")]
    public IActionResult CancelWaiver(string leagueId, string claimId)
    {
        service.CancelWaiver(leagueId, currentUser.UserId, claimId);
        return NoContent();
    }

    [HttpGet("{leagueId}/trades")]
    public ActionResult<IReadOnlyList<TradeOfferDto>> GetTrades(string leagueId) =>
        Ok(service.GetTrades(leagueId, currentUser.UserId));

    [HttpGet("{leagueId}/trades/partners")]
    public ActionResult<IReadOnlyList<TradePartnerDto>> GetTradePartners(string leagueId) =>
        Ok(service.GetTradePartners(leagueId, currentUser.UserId));

    [HttpPost("{leagueId}/trades")]
    public ActionResult<TradeOfferDto> CreateTrade(string leagueId, CreateTradeRequest request)
    {
        var result = service.CreateTrade(leagueId, currentUser.UserId, request);
        return Created($"/leagues/{leagueId}/trades/{result.Id}", result);
    }

    [HttpPatch("{leagueId}/trades/{tradeId}")]
    public ActionResult<TradeOfferDto> ResolveTrade(string leagueId, string tradeId, ResolveTradeRequest request) =>
        Ok(service.ResolveTrade(leagueId, currentUser.UserId, tradeId, request));

    [HttpPost("{leagueId}/trades/{tradeId}/votes")]
    public ActionResult<TradeOfferDto> VoteTrade(string leagueId, string tradeId, TradeVoteRequest request) =>
        Ok(service.VoteTrade(leagueId, currentUser.UserId, tradeId, request));

    [HttpGet("{leagueId}/chat")]
    public ActionResult<IReadOnlyList<ChatMessageDto>> GetMessages(string leagueId, [FromQuery] int limit = 50) =>
        Ok(service.GetMessages(leagueId, limit, currentUser.UserId));

    [HttpPost("{leagueId}/chat")]
    public ActionResult<ChatMessageDto> SendMessage(string leagueId, ChatMessageRequest request)
    {
        var result = service.SendMessage(leagueId, currentUser.UserId, request);
        return Created($"/leagues/{leagueId}/chat/{result.Id}", result);
    }

    [HttpGet("{leagueId}/draft")]
    public ActionResult<DraftStateDto> GetDraft(string leagueId) => Ok(service.GetDraft(leagueId, currentUser.UserId));

    [HttpPut("{leagueId}/draft/schedule")]
    public ActionResult<DraftStateDto> ScheduleDraft(string leagueId, ScheduleDraftRequest request) =>
        Ok(service.ScheduleDraft(leagueId, currentUser.UserId, request));

    [HttpPost("{leagueId}/draft/picks")]
    public ActionResult<DraftStateDto> MakeDraftPick(string leagueId, DraftPickRequest request) =>
        Ok(service.MakeDraftPick(leagueId, currentUser.UserId, request));

    [HttpPost("{leagueId}/draft/complete")]
    public ActionResult<DraftStateDto> CompleteDraft(string leagueId) =>
        Ok(service.CompleteDraft(leagueId, currentUser.UserId));
}
