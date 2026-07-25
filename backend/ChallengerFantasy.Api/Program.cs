using System.Security.Claims;
using ChallengerFantasy.Api.Auth;
using ChallengerFantasy.Api.Options;
using ChallengerFantasy.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Challenger Fantasy API",
        Version = "v1",
        Description = "Backend API for leagues, matchups, rosters, cards, transactions, chat, and drafts.",
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste a Clerk session token. Swagger adds the Bearer prefix automatically.",
    });
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.Configure<ClerkOptions>(builder.Configuration.GetSection(ClerkOptions.SectionName));
builder.Services.Configure<ApiAuthOptions>(builder.Configuration.GetSection(ApiAuthOptions.SectionName));

var clerk = builder.Configuration.GetSection(ClerkOptions.SectionName).Get<ClerkOptions>() ?? new ClerkOptions();
var apiAuth = builder.Configuration.GetSection(ApiAuthOptions.SectionName).Get<ApiAuthOptions>() ?? new ApiAuthOptions();
if (apiAuth.Enabled)
{
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = clerk.Authority.TrimEnd('/');
            options.MapInboundClaims = false;
            options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            options.TokenValidationParameters = new TokenValidationParameters
            {
                NameClaimType = "sub",
                RoleClaimType = "role",
                ValidateAudience = clerk.Audiences.Length > 0,
                ValidAudiences = clerk.Audiences,
                ValidateIssuer = true,
                ValidIssuer = clerk.Authority.TrimEnd('/'),
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
            };
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = context =>
                {
                    var status = context.Principal?.FindFirstValue("sts");
                    if (string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
                        context.Fail("The Clerk session is pending.");
                    var authorizedParty = context.Principal?.FindFirstValue("azp");
                    if (clerk.AuthorizedParties.Length > 0
                        && !string.IsNullOrWhiteSpace(authorizedParty)
                        && !clerk.AuthorizedParties.Contains(authorizedParty, StringComparer.OrdinalIgnoreCase))
                        context.Fail("The token's authorized party is not allowed.");
                    return Task.CompletedTask;
                },
            };
        });
}

var authorization = builder.Services.AddAuthorizationBuilder();
if (apiAuth.Enabled)
{
    var authenticatedPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    authorization
        .SetDefaultPolicy(authenticatedPolicy)
        .SetFallbackPolicy(authenticatedPolicy)
        .AddPolicy(Policies.Commissioner, policy =>
            policy.RequireAssertion(context => ClerkClaims.HasAnyRole(
                context.User,
                "admin",
                "commissioner",
                "org:admin")));
}
else
{
    var openPolicy = new AuthorizationPolicyBuilder()
        .RequireAssertion(_ => true)
        .Build();
    authorization
        .SetDefaultPolicy(openPolicy)
        .SetFallbackPolicy(openPolicy)
        .AddPolicy(Policies.Commissioner, openPolicy);
}

if (apiAuth.Enabled)
{
    builder.Services.Configure<Swashbuckle.AspNetCore.SwaggerGen.SwaggerGenOptions>(options =>
    {
        options.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer",
                    },
                },
                Array.Empty<string>()
            },
        });
    });
}

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddSingleton<InMemoryFantasyStore>();
builder.Services.AddScoped<IFantasyService, FantasyService>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Challenger Fantasy API v1");
    options.DocumentTitle = "Challenger Fantasy API";
    options.DisplayRequestDuration();
});
if (apiAuth.Enabled)
    app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous()
    .WithName("Health");
app.MapControllers();

app.Run();

public partial class Program;
