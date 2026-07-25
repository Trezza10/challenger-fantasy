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

    [HttpGet("{leagueId}")]
    public ActionResult<LeagueDto> Get(string leagueId) => Ok(service.GetLeague(leagueId, currentUser.UserId));

    [HttpPatch("{leagueId}/settings")]
    [Authorize(Policy = Policies.Commissioner)]
    public ActionResult<LeagueDto> Update(string leagueId, LeagueSettingsRequest request) => Ok(service.UpdateLeague(leagueId, request));

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

    [HttpPost("{leagueId}/trades")]
    public ActionResult<TradeOfferDto> CreateTrade(string leagueId, CreateTradeRequest request)
    {
        var result = service.CreateTrade(leagueId, currentUser.UserId, request);
        return Created($"/leagues/{leagueId}/trades/{result.Id}", result);
    }

    [HttpPatch("{leagueId}/trades/{tradeId}")]
    public ActionResult<TradeOfferDto> ResolveTrade(string leagueId, string tradeId, ResolveTradeRequest request) =>
        Ok(service.ResolveTrade(leagueId, currentUser.UserId, tradeId, request));

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

    [HttpPost("{leagueId}/draft/picks")]
    public ActionResult<DraftStateDto> MakeDraftPick(string leagueId, DraftPickRequest request) =>
        Ok(service.MakeDraftPick(leagueId, currentUser.UserId, request));
}
