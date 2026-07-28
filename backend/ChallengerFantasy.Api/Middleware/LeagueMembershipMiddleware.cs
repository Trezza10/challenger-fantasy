using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Services;

namespace ChallengerFantasy.Api.Middleware;

/// <summary>Prevents authenticated users from accessing league-scoped routes before joining that league.</summary>
public sealed class LeagueMembershipMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, InMemoryFantasyStore store, ICurrentUser currentUser)
    {
        if (context.Request.RouteValues.TryGetValue("leagueId", out var rawLeagueId)
            && rawLeagueId is string leagueId)
        {
            var isMember = false;
            lock (store.SyncRoot)
                isMember = store.Memberships.ContainsKey((leagueId, currentUser.UserId));

            if (!isMember)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await Results.Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "League membership required",
                    detail: "Join this league before accessing its data.")
                    .ExecuteAsync(context);
                return;
            }
        }

        await next(context);
    }
}
