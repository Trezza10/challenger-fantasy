# Challenger Fantasy API

Standalone ASP.NET Core 8 Web API for the Expo app. It supports configurable Clerk session JWT authentication, policy-based authorization for commissioner actions, controller/DTO/service/mapper boundaries, Swagger UI, and optional PostgreSQL persistence.

## Run locally

Clerk authentication is enabled by default so separate app accounts receive separate league data. Configure `Clerk:Authority` as described below, then start the API:

```bash
dotnet run --project backend/ChallengerFantasy.Api
```

Then open [http://localhost:5088/swagger](http://localhost:5088/swagger).

When authentication is disabled, requests run as the configured `ApiAuth:DevelopmentUserId`, which defaults to `user_demo`.

Every request is logged as a matching `→` request and `←` response pair. Logs include the
HTTP method, path/query, resolved user, remote address, sanitized JSON body, response status,
trace ID, and end-to-end elapsed time. Authorization values and password/token/secret fields
are never logged.

The Expo frontend uses this API by default. Its optional `.env.local` settings are:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5088
EXPO_PUBLIC_API_AUTH_ENABLED=true
EXPO_PUBLIC_USE_MOCK_SERVICES=false
```

Use your computer's LAN IP instead of `127.0.0.1` when running Expo Go on a physical phone. Android Emulator uses `http://10.0.2.2:5088`.

The app attaches the active Clerk session token as a bearer token on every API request.

## Enable Clerk authentication

1. Authentication already defaults to enabled. To make that explicit in local user secrets:

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

The API listens on all local interfaces at port `5088`. Use `http://localhost:5088` from the Mac or `http://<your-mac-lan-ip>:5088` from a phone. `GET /health` and Swagger are available without authentication. With `ApiAuth:Enabled=true`, all fantasy endpoints require `Authorization: Bearer <Clerk session token>`.

In Swagger, click **Authorize**, paste the raw Clerk session token, and submit. Swagger adds `Bearer` to the request header automatically.

Never put `CLERK_SECRET_KEY` in the Expo app. This API validates session-token signatures from Clerk's public JWKS through the configured authority. A Clerk secret is only needed later if the backend itself calls Clerk's Backend API.

## Authorization

When `ApiAuth:Enabled=true`, authentication is required by the global fallback policy, even if a future controller accidentally omits `[Authorize]`. When it is `false`, both the default policy and commissioner policy intentionally allow local requests.

League membership is stored by Clerk user ID. League-scoped routes reject non-members, and commissioner mutations verify the commissioner stored for that specific league.

## Optional demo data

New accounts and fresh API processes start with no leagues or teams. To opt into the old
development fixture explicitly, set:

```bash
dotnet user-secrets set "DevelopmentData:SeedDemoData" "true"
```

Leave this unset or `false` for the real create/join onboarding flow.

## Routes

Routes already used by the mobile service:

- `GET /home`
- `GET /team`
- `GET /leagues`
- `GET /leagues/{leagueId}`
- `GET /leagues/{leagueId}/activity?cursor=0&limit=10`
- `GET /leagues/{leagueId}/matchup`

Backend mutation and management routes:

- `POST /leagues` (creator becomes commissioner)
- `GET /leagues/join/{codeOrToken}`
- `POST /leagues/join`
- `GET /leagues/{leagueId}/access`
- `GET /leagues/{leagueId}/members`
- `GET|POST /leagues/{leagueId}/invitations` (commissioner only)
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

Invitation creation returns a seven-day `challengerfantasy://join?token=...` app link.
The Expo UI can share it or open the device's email composer with a prefilled message.
Server-side email delivery is intentionally not faked: connect an email provider such as
Resend, Postmark, or SendGrid when the API has a public deployment and stable HTTPS invite URL.
For production, configure iOS Universal Links and Android App Links so recipients without the
app installed can land on a web fallback page.

See `ChallengerFantasy.Api/ChallengerFantasy.Api.http` for ready-to-run requests.

## PostgreSQL persistence

PostgreSQL is optional and disabled by default. The schema lives in
`backend/database` as ordered, commented SQL files. Collections such as weekly
history, card positions, trade assets, votes, and matchup players use child/join
tables; the schema intentionally has no `jsonb` columns. Post images remain `text`
because the current API sends data URLs. In production, store an object-storage URL
in that column rather than a large base64 payload.

Configure secrets outside `appsettings.json`:

```bash
cd backend/ChallengerFantasy.Api
dotnet user-secrets set "ConnectionStrings:ChallengerFantasy" \
  "Host=localhost;Port=5432;Database=challenger_fantasy;Username=challenger;Password=change-me"
dotnet user-secrets set "Database:Enabled" "true"
dotnet user-secrets set "Database:ApplySchemaOnStartup" "true"
```

Equivalent environment variables are:

```bash
export ConnectionStrings__ChallengerFantasy='Host=localhost;Port=5432;Database=challenger_fantasy;Username=challenger;Password=change-me'
export Database__Enabled=true
export Database__ApplySchemaOnStartup=true
```

`ApplySchemaOnStartup` is convenient locally. For a shared or production database,
apply reviewed scripts in order through deployment automation and set it to `false`.
Applied filenames and SHA-256 checksums are recorded in
`challenger.schema_scripts`; changing an applied file fails startup, so fixes should
always be a new numbered script. This table can later become the Liquibase baseline.

On the first database-enabled start, the API writes its player/card reference
catalog. Later starts hydrate all persisted state before accepting traffic. A
successful POST/PUT/PATCH/DELETE is committed as an atomic normalized snapshot.
This compatibility adapter preserves the existing service and is intentionally
optimized for correctness and clarity, not high write throughput. Before running
multiple API replicas or handling high traffic, migrate each feature service to
targeted SQL repositories and per-command transactions.

Check connectivity at `GET /health/database`.

### Database contract test

After applying the numbered scripts, run:

```bash
psql "$CHALLENGER_TEST_POSTGRES" \
  -f backend/database/tests/0_schema_contract_tests.sql
```

The test runs in a rolled-back transaction. It verifies the expected tables exist,
there are no `jsonb` columns, and orphaned membership rows are rejected by foreign
keys. The existing database-free behavior tests still run with:

```bash
dotnet run --project backend/ChallengerFantasy.Api.Tests
```
