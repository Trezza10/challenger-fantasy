using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Contracts;
using ChallengerFantasy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChallengerFantasy.Api.Controllers;

[ApiController]
[Authorize]
public sealed class HomeController(IFantasyService service, ICurrentUser currentUser) : ControllerBase
{
    [HttpGet("/home")]
    [ProducesResponseType<HomeDto>(StatusCodes.Status200OK)]
    public ActionResult<HomeDto> Get() => Ok(service.GetHome(currentUser.UserId));
}
