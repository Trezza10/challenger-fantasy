# Challenger Fantasy API

Standalone ASP.NET Core 8 Web API for the Expo app. It supports configurable Clerk session JWT authentication, policy-based authorization for commissioner actions, controller/DTO/service/mapper boundaries, Swagger UI, and an in-memory development store that can later be replaced with EF Core.

## Run locally

Authentication is disabled by default for easy local development. Start the API:

```bash
dotnet run --project backend/ChallengerFantasy.Api
```

Then open [http://localhost:5088/swagger](http://localhost:5088/swagger).

When authentication is disabled, requests run as the configured `ApiAuth:DevelopmentUserId`, which defaults to `user_demo`.

## Enable Clerk authentication

1. Enable API authentication:

   ```bash
   cd backend/ChallengerFantasy.Api
   dotnet user-secrets init
   dotnet user-secrets set "ApiAuth:Enabled" "true"
   ```

2. In Clerk Dashboard, open **API keys** and copy the **Frontend API URL**.
3. Configure it without committing secrets:

   ```bash
   dotnet user-secrets set "Clerk:Authority" "https://your-instance.clerk.accounts.dev"
   ```

   Alternatively, set:

   ```bash
   export Clerk__Authority="https://your-instance.clerk.accounts.dev"
   ```

4. If your Clerk token uses an audience, configure it:

   ```bash
   dotnet user-secrets set "Clerk:Audiences:0" "challenger-fantasy-api"
   ```

5. For web clients, configure each allowed Clerk `azp` origin:

   ```bash
   dotnet user-secrets set "Clerk:AuthorizedParties:0" "http://localhost:8081"
   ```

   Native Expo bearer requests may not contain `azp`; when present, it is validated against this list.

6. Restart the API:

   ```bash
   dotnet run --project backend/ChallengerFantasy.Api
   ```

The local HTTP URL is `http://localhost:5088`. `GET /health` and Swagger are available without authentication. With `ApiAuth:Enabled=true`, all fantasy endpoints require `Authorization: Bearer <Clerk session token>`.

In Swagger, click **Authorize**, paste the raw Clerk session token, and submit. Swagger adds `Bearer` to the request header automatically.

Never put `CLERK_SECRET_KEY` in the Expo app. This API validates session-token signatures from Clerk's public JWKS through the configured authority. A Clerk secret is only needed later if the backend itself calls Clerk's Backend API.

## Authorization

When `ApiAuth:Enabled=true`, authentication is required by the global fallback policy, even if a future controller accidentally omits `[Authorize]`. When it is `false`, both the default policy and commissioner policy intentionally allow local requests.

`PATCH /leagues/{leagueId}/settings` additionally requires the `Commissioner` policy. It accepts any of these Clerk token roles:

- `commissioner`
- `admin`
- `org:admin`

The policy checks `role`, `org_role`, and a `role` property inside `metadata` or `public_metadata`. Configure the claim in a Clerk JWT template or Organizations role mapping.

## Routes

Routes already used by the mobile service:

- `GET /home`
- `GET /team`
- `GET /leagues`
- `GET /leagues/{leagueId}`
- `GET /leagues/{leagueId}/activity?cursor=0&limit=10`
- `GET /leagues/{leagueId}/matchup`

Backend mutation and management routes:

- `GET /leagues/{leagueId}/roster`
- `PUT /leagues/{leagueId}/lineup`
- `POST /leagues/{leagueId}/cards/plays`
- `DELETE /leagues/{leagueId}/cards/plays/{playId}`
- `GET /leagues/{leagueId}/free-agents`
- `POST /leagues/{leagueId}/free-agents/add`
- `GET|POST /leagues/{leagueId}/waivers`
- `DELETE /leagues/{leagueId}/waivers/{claimId}`
- `GET|POST /leagues/{leagueId}/trades`
- `PATCH /leagues/{leagueId}/trades/{tradeId}`
- `GET|POST /leagues/{leagueId}/chat`
- `GET /leagues/{leagueId}/draft`
- `POST /leagues/{leagueId}/draft/picks`
- `PATCH /leagues/{leagueId}/settings` (`Commissioner`)

See `ChallengerFantasy.Api/ChallengerFantasy.Api.http` for ready-to-run requests.

## Persistence handoff

`InMemoryFantasyStore` is intentionally the only persistence implementation. It seeds development data and is registered as a singleton. To add a database:

1. Create EF Core entities/configurations and a `DbContext`.
2. Replace store access inside `FantasyService` with repository interfaces or split the service by feature.
3. Keep the controller contracts and DTOs stable.
4. Add transactions/concurrency tokens around card inventory, waiver processing, trades, and draft picks.
5. Add league-membership authorization requirements so a valid Clerk user cannot access arbitrary league IDs.

The in-memory implementation demonstrates behavior but is not production persistence and resets on every process restart.
