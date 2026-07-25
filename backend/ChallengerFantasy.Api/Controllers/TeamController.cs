using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChallengerFantasy.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TeamController(IFantasyService service, ICurrentUser currentUser) : ControllerBase
{
    // Compatibility route for the mobile prototype. Prefer /leagues/{leagueId}/roster for new code.
    [HttpGet("/team")]
    public ActionResult<TeamSummaryDto> Get() => Ok(service.GetTeam("challengers", currentUser.UserId));
}
