using System.Security.Claims;
using System.Text.Json;
using ChallengerFantasy.Api.Options;
using Microsoft.Extensions.Options;

namespace ChallengerFantasy.Api.Auth;

public static class Policies
{
    public const string Commissioner = "Commissioner";
}

public static class ClerkClaims
{
    public static bool HasAnyRole(ClaimsPrincipal user, params string[] allowedRoles)
    {
        var roles = user.FindAll("role")
            .Concat(user.FindAll("org_role"))
            .Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var claimName in new[] { "metadata", "public_metadata" })
        {
            var raw = user.FindFirstValue(claimName);
            if (string.IsNullOrWhiteSpace(raw)) continue;
            try
            {
                using var document = JsonDocument.Parse(raw);
                if (document.RootElement.TryGetProperty("role", out var role))
                    roles.Add(role.GetString() ?? string.Empty);
            }
            catch (JsonException)
            {
                // Malformed optional metadata never grants access.
            }
        }

        return allowedRoles.Any(roles.Contains);
    }
}

public interface ICurrentUser
{
    string UserId { get; }
    string DisplayName { get; }
    string? Email { get; }
}

public sealed class HttpCurrentUser(IHttpContextAccessor accessor, IOptions<ApiAuthOptions> options) : ICurrentUser
{
    public string UserId =>
        accessor.HttpContext?.User.FindFirstValue("sub")
        ?? (!options.Value.Enabled
            ? options.Value.DevelopmentUserId
            : throw new UnauthorizedAccessException("The authenticated token has no subject claim."));

    public string DisplayName =>
        accessor.HttpContext?.User.FindFirstValue("name")
        ?? accessor.HttpContext?.User.FindFirstValue("username")
        ?? accessor.HttpContext?.User.FindFirstValue("given_name")
        ?? (!options.Value.Enabled ? "Development Manager" : "Manager");

    public string? Email => accessor.HttpContext?.User.FindFirstValue("email");
}
