using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ChallengerFantasy.Api.Options;
using Microsoft.Extensions.Options;

namespace ChallengerFantasy.Api.Middleware;

/// <summary>
/// Writes one compact request line and one completion line for every API call.
/// JSON bodies and query strings are included with common secret fields redacted.
/// </summary>
public sealed class ApiRequestLoggingMiddleware(
    RequestDelegate next,
    ILogger<ApiRequestLoggingMiddleware> logger,
    IOptions<ApiAuthOptions> authOptions)
{
    private const int MaxLoggedBodyCharacters = 8_192;
    private static readonly string[] SensitiveKeyFragments =
        ["authorization", "cookie", "password", "secret", "token", "api-key", "apikey"];

    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        var stopwatch = Stopwatch.StartNew();
        var requestBody = await ReadSanitizedBodyAsync(request, context.RequestAborted);
        var query = SanitizeQuery(request.Query);
        var initialUser = ResolveUser(context.User, authOptions.Value);
        var remoteAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        logger.LogInformation(
            "→ {Method} {Path}{Query} | user={UserId} remote={RemoteAddress} type={ContentType} length={ContentLength} trace={TraceId}{Body}",
            request.Method,
            request.Path.Value ?? "/",
            query,
            initialUser,
            remoteAddress,
            request.ContentType ?? "-",
            request.ContentLength?.ToString() ?? "-",
            context.TraceIdentifier,
            requestBody is null ? string.Empty : $" body={requestBody}");

        try
        {
            await next(context);
        }
        finally
        {
            stopwatch.Stop();
            logger.LogInformation(
                "← {Method} {Path} | status={StatusCode} user={UserId} elapsed={ElapsedMilliseconds:0.0}ms trace={TraceId}",
                request.Method,
                request.Path.Value ?? "/",
                context.Response.StatusCode,
                ResolveUser(context.User, authOptions.Value),
                stopwatch.Elapsed.TotalMilliseconds,
                context.TraceIdentifier);
        }
    }

    private static string ResolveUser(ClaimsPrincipal user, ApiAuthOptions options) =>
        user.FindFirstValue("sub")
        ?? (options.Enabled ? "anonymous" : options.DevelopmentUserId);

    private static async Task<string?> ReadSanitizedBodyAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength is null or 0 || !IsTextContent(request.ContentType)) return null;

        request.EnableBuffering();
        using var reader = new StreamReader(
            request.Body,
            Encoding.UTF8,
            detectEncodingFromByteOrderMarks: false,
            leaveOpen: true);
        var buffer = new char[MaxLoggedBodyCharacters + 1];
        var count = await reader.ReadBlockAsync(buffer.AsMemory(), cancellationToken);
        request.Body.Position = 0;

        var body = new string(buffer, 0, Math.Min(count, MaxLoggedBodyCharacters));
        var wasTruncated = count > MaxLoggedBodyCharacters;
        var sanitized = request.ContentType?.Contains("json", StringComparison.OrdinalIgnoreCase) == true
            ? SanitizeJson(body)
            : body;
        return wasTruncated ? $"{sanitized}…[truncated]" : sanitized;
    }

    private static bool IsTextContent(string? contentType) =>
        contentType?.Contains("json", StringComparison.OrdinalIgnoreCase) == true
        || contentType?.StartsWith("text/", StringComparison.OrdinalIgnoreCase) == true
        || contentType?.Contains("x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase) == true;

    private static string SanitizeQuery(IQueryCollection query)
    {
        if (query.Count == 0) return string.Empty;
        var values = query.Select(item =>
            $"{Uri.EscapeDataString(item.Key)}={Uri.EscapeDataString(IsSensitive(item.Key) ? "[REDACTED]" : item.Value.ToString())}");
        return $"?{string.Join("&", values)}";
    }

    private static string SanitizeJson(string body)
    {
        try
        {
            var node = JsonNode.Parse(body);
            Redact(node);
            return node?.ToJsonString(new JsonSerializerOptions { WriteIndented = false }) ?? body;
        }
        catch (JsonException)
        {
            return "[invalid JSON body]";
        }
    }

    private static void Redact(JsonNode? node)
    {
        if (node is JsonObject jsonObject)
        {
            foreach (var property in jsonObject.ToArray())
            {
                if (IsSensitive(property.Key)) jsonObject[property.Key] = "[REDACTED]";
                else Redact(property.Value);
            }
        }
        else if (node is JsonArray jsonArray)
        {
            foreach (var child in jsonArray) Redact(child);
        }
    }

    private static bool IsSensitive(string key) =>
        SensitiveKeyFragments.Any(fragment => key.Contains(fragment, StringComparison.OrdinalIgnoreCase));
}
