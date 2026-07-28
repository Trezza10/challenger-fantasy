using ChallengerFantasy.Api.Domain;
using ChallengerFantasy.Api.Services;
using Npgsql;

namespace ChallengerFantasy.Api.Persistence;

/// <summary>
/// Adapts the current aggregate-oriented service to normalized PostgreSQL tables.
/// Writes replace one complete, transactionally locked snapshot. This deliberately
/// favors correctness and an easy migration path over write throughput; when the
/// application grows, individual services can move to targeted repositories.
/// </summary>
public sealed class PostgresStateRepository(
    NpgsqlDataSource dataSource)
{
    private const long AdvisoryLockId = 0x4348414C4C454E47; // "CHALLENG"
    private static readonly AsyncLocal<NpgsqlBatch?> ActiveWriteBatch = new();
    private bool referenceDataReady;

    public async Task<bool> HasStateAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            "SELECT EXISTS (SELECT 1 FROM challenger.players) OR EXISTS (SELECT 1 FROM challenger.leagues)",
            connection);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);
    }

    public async Task LoadAsync(InMemoryFantasyStore store, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var cards = new Dictionary<string, PowerCard>();
        var cardPositions = new Dictionary<string, List<string>>();
        await ReadAsync(connection, "SELECT id,label,description,effect_text,duration,accent,icon,allowed_team,rarity,card_type FROM challenger.power_cards",
            reader =>
            {
                var id = reader.GetString(0);
                cards[id] = new PowerCard(id, reader.GetString(1), reader.GetString(2), reader.GetString(3),
                    reader.GetString(4), reader.GetString(5), reader.GetString(6),
                    Enum.Parse<CardTargetTeam>(reader.GetString(7)), [],
                    Enum.Parse<CardRarity>(reader.GetString(8)), Enum.Parse<CardType>(reader.GetString(9)), 1);
            }, cancellationToken);
        await ReadAsync(connection, "SELECT card_id,position FROM challenger.power_card_positions ORDER BY card_id,position",
            reader => GetList(cardPositions, reader.GetString(0)).Add(reader.GetString(1)), cancellationToken);
        foreach (var (id, positions) in cardPositions)
            cards[id] = cards[id] with { AllowedPositions = positions };

        var liveStats = new Dictionary<string, List<PlayerStat>>();
        var recentStats = new Dictionary<string, List<PlayerStat>>();
        var breakdowns = new Dictionary<string, List<ScoreBreakdownItem>>();
        var histories = new Dictionary<string, List<PlayerWeekHistory>>();
        await ReadAsync(connection, "SELECT player_id,stat_group,label,value FROM challenger.player_stats ORDER BY player_id,stat_group,ordinal",
            reader => GetList(reader.GetString(1) == "live" ? liveStats : recentStats, reader.GetString(0))
                .Add(new PlayerStat(reader.GetString(2), reader.GetString(3))), cancellationToken);
        await ReadAsync(connection, "SELECT player_id,label,quantity,points_per_unit,points FROM challenger.player_score_breakdowns ORDER BY player_id,ordinal",
            reader => GetList(breakdowns, reader.GetString(0)).Add(new ScoreBreakdownItem(reader.GetString(1),
                Convert.ToDouble(reader.GetDecimal(2)), Convert.ToDouble(reader.GetDecimal(3)), Convert.ToDouble(reader.GetDecimal(4)))), cancellationToken);
        await ReadAsync(connection, "SELECT player_id,week,opponent,stat_line,base_points,card_adjustment FROM challenger.player_week_history ORDER BY player_id,week",
            reader => GetList(histories, reader.GetString(0)).Add(new PlayerWeekHistory(reader.GetInt32(1),
                reader.GetString(2), reader.GetString(3), Convert.ToDouble(reader.GetDecimal(4)),
                Convert.ToDouble(reader.GetDecimal(5)))), cancellationToken);

        var players = new Dictionary<string, Player>();
        await ReadAsync(connection, "SELECT id,name,position,nfl_team,score,card_adjustment,game_started FROM challenger.players",
            reader =>
            {
                var id = reader.GetString(0);
                players[id] = new Player(id, reader.GetString(1), Enum.Parse<RosterPosition>(reader.GetString(2)),
                    reader.GetString(3), Convert.ToDouble(reader.GetDecimal(4)), Convert.ToDouble(reader.GetDecimal(5)),
                    reader.GetBoolean(6), liveStats.GetValueOrDefault(id) ?? [], recentStats.GetValueOrDefault(id) ?? [],
                    breakdowns.GetValueOrDefault(id) ?? [], histories.GetValueOrDefault(id) ?? []);
            }, cancellationToken);

        var leagues = new Dictionary<string, League>();
        await ReadAsync(connection,
            "SELECT id,name,max_members,current_week,draft_completed,draft_starts_at,commissioner_user_id,trade_reject_votes_required,trade_review_hours FROM challenger.leagues",
            reader =>
            {
                var id = reader.GetString(0);
                leagues[id] = new League(id, reader.GetString(1), 0, reader.GetInt32(2), reader.GetInt32(3),
                    reader.GetBoolean(4), reader.IsDBNull(5) ? null : reader.GetFieldValue<DateTimeOffset>(5),
                    reader.GetString(6), reader.GetInt32(7), reader.GetInt32(8));
            }, cancellationToken);
        var memberships = new Dictionary<(string, string), LeagueMembership>();
        await ReadAsync(connection,
            "SELECT league_id,user_id,manager_name,email,team_name,role,wins,losses,ties,points_for,points_against,joined_at FROM challenger.league_memberships",
            reader =>
            {
                var membership = new LeagueMembership(reader.GetString(0), reader.GetString(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4), reader.GetString(5),
                    reader.GetInt32(6), reader.GetInt32(7), reader.GetInt32(8),
                    Convert.ToDouble(reader.GetDecimal(9)), Convert.ToDouble(reader.GetDecimal(10)),
                    reader.GetFieldValue<DateTimeOffset>(11));
                memberships[(membership.LeagueId, membership.UserId)] = membership;
            }, cancellationToken);
        foreach (var id in leagues.Keys.ToArray())
            leagues[id] = leagues[id] with { MemberCount = memberships.Values.Count(member => member.LeagueId == id) };

        var joinCodes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        await ReadAsync(connection, "SELECT code,league_id FROM challenger.league_join_codes",
            reader => joinCodes[reader.GetString(0)] = reader.GetString(1), cancellationToken);
        var invitations = new Dictionary<string, LeagueInvitation>(StringComparer.Ordinal);
        await ReadAsync(connection, "SELECT id,league_id,invited_by_user_id,email,token,expires_at,accepted_at FROM challenger.league_invitations",
            reader =>
            {
                var invitation = new LeagueInvitation(reader.GetString(0), reader.GetString(1), reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3), reader.GetString(4),
                    reader.GetFieldValue<DateTimeOffset>(5),
                    reader.IsDBNull(6) ? null : reader.GetFieldValue<DateTimeOffset>(6));
                invitations[invitation.Token] = invitation;
            }, cancellationToken);

        var slotRows = new List<(string League, string User, string Id, string Kind, RosterPosition Position, string Player, int Ordinal)>();
        await ReadAsync(connection, "SELECT league_id,user_id,id,kind,position,player_id,ordinal FROM challenger.roster_slots ORDER BY league_id,user_id,kind,ordinal",
            r => slotRows.Add((r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                Enum.Parse<RosterPosition>(r.GetString(4)), r.GetString(5), r.GetInt32(6))), cancellationToken);
        var rosters = new Dictionary<(string, string), Roster>();
        foreach (var key in memberships.Keys)
        {
            var rows = slotRows.Where(row => row.League == key.Item1 && row.User == key.Item2).ToArray();
            RosterSlot Map((string League, string User, string Id, string Kind, RosterPosition Position, string Player, int Ordinal) row) =>
                new(row.Id, row.Kind, row.Position, players[row.Player]);
            rosters[key] = new Roster(rows.Where(r => r.Kind == "starter").OrderBy(r => r.Ordinal).Select(Map).ToArray(),
                rows.Where(r => r.Kind == "bench").OrderBy(r => r.Ordinal).Select(Map).ToArray());
        }

        var hands = new Dictionary<(string, string), List<PowerCard>>();
        await ReadAsync(connection, "SELECT league_id,user_id,card_id,quantity FROM challenger.team_card_inventory",
            reader =>
            {
                var key = (reader.GetString(0), reader.GetString(1));
                GetList(hands, key).Add(cards[reader.GetString(2)] with { Quantity = reader.GetInt32(3) });
            }, cancellationToken);
        var offerCards = new Dictionary<(string, string, int), List<string>>();
        await ReadAsync(connection, "SELECT league_id,user_id,week,card_id FROM challenger.card_claim_offer_cards ORDER BY league_id,user_id,week,ordinal",
            reader => GetList(offerCards, (reader.GetString(0), reader.GetString(1), reader.GetInt32(2))).Add(reader.GetString(3)), cancellationToken);
        var claims = new Dictionary<(string, string, int), CardClaimProgress>();
        await ReadAsync(connection, "SELECT league_id,user_id,week,allowance,claimed_count,offer_id FROM challenger.card_claim_progress",
            reader =>
            {
                var key = (reader.GetString(0), reader.GetString(1), reader.GetInt32(2));
                claims[key] = new CardClaimProgress(key.Item1, key.Item2, key.Item3, reader.GetInt32(3),
                    reader.GetInt32(4), reader.IsDBNull(5) ? null : reader.GetString(5),
                    offerCards.GetValueOrDefault(key) ?? []);
            }, cancellationToken);

        var matchups = await LoadMatchups(connection, players, cards, cancellationToken);
        var draftPicks = new List<DraftPick>();
        await ReadAsync(connection, "SELECT id,league_id,team_user_id,player_id,round,overall_pick,picked_at FROM challenger.draft_picks ORDER BY league_id,overall_pick",
            r => draftPicks.Add(new DraftPick(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                r.GetInt32(4), r.GetInt32(5), r.GetFieldValue<DateTimeOffset>(6))), cancellationToken);
        var waivers = new List<WaiverClaim>();
        await ReadAsync(connection, "SELECT id,league_id,user_id,add_player_id,drop_player_id,priority,status,created_at FROM challenger.waiver_claims",
            r => waivers.Add(new WaiverClaim(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                r.IsDBNull(4) ? null : r.GetString(4), r.GetInt32(5), Enum.Parse<WaiverStatus>(r.GetString(6)),
                r.GetFieldValue<DateTimeOffset>(7))), cancellationToken);

        var trades = await LoadTrades(connection, cancellationToken);
        var posts = new List<LeaguePost>();
        await ReadAsync(connection, "SELECT id,league_id,user_id,author_name,title,body,image_data_url,image_position,created_at FROM challenger.league_posts",
            r => posts.Add(new LeaguePost(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4),
                r.GetString(5), r.IsDBNull(6) ? null : r.GetString(6), r.IsDBNull(7) ? null : r.GetString(7),
                r.GetFieldValue<DateTimeOffset>(8))), cancellationToken);
        var messages = new List<ChatMessage>();
        await ReadAsync(connection, "SELECT id,league_id,user_id,sender,message_text,sent_at FROM challenger.chat_messages",
            r => messages.Add(new ChatMessage(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                r.GetString(4), r.GetFieldValue<DateTimeOffset>(5))), cancellationToken);
        var activities = new List<ActivityEntry>();
        await ReadAsync(connection, "SELECT id,league_id,actor,summary,activity_type,occurred_at FROM challenger.activity_entries",
            r => activities.Add(new ActivityEntry(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                Enum.Parse<ActivityType>(r.GetString(4)), r.GetFieldValue<DateTimeOffset>(5))), cancellationToken);
        var stories = new List<NewsStory>();
        await ReadAsync(connection, "SELECT id,category,title,summary,body,published_at FROM challenger.news_stories",
            r => stories.Add(new NewsStory(r.GetString(0), r.GetString(1), r.GetString(2), r.GetString(3),
                r.GetString(4), r.GetFieldValue<DateTimeOffset>(5))), cancellationToken);

        // Publish the complete hydrated snapshot under the same lock used by the
        // existing domain service; no request can observe a partially loaded store.
        lock (store.SyncRoot)
        {
            Replace(store.CardCatalog, cards);
            Replace(store.Players, players);
            Replace(store.Leagues, leagues);
            Replace(store.Memberships, memberships);
            Replace(store.LeagueIdsByJoinCode, joinCodes);
            Replace(store.InvitationsByToken, invitations);
            Replace(store.Rosters, rosters);
            Replace(store.Hands, hands);
            Replace(store.CardClaims, claims);
            Replace(store.Matchups, matchups);
            Replace(store.DraftPicks, draftPicks);
            Replace(store.Waivers, waivers);
            Replace(store.Trades, trades);
            Replace(store.LeaguePosts, posts);
            Replace(store.Messages, messages);
            Replace(store.Activities, activities);
            Replace(store.CommunityPosts, stories);
        }
        referenceDataReady = true;
    }

    public async Task SaveAsync(InMemoryFantasyStore store, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await ExecuteAsync(connection, transaction, "SELECT pg_advisory_xact_lock($1)", cancellationToken, AdvisoryLockId);

        // Child-first deletion keeps every foreign key active; the transaction
        // ensures readers never observe a half-written snapshot.
        await ExecuteAsync(connection, transaction,
            """
            DELETE FROM challenger.trade_reject_votes;
            DELETE FROM challenger.trade_card_assets;
            DELETE FROM challenger.trade_player_assets;
            DELETE FROM challenger.trade_offers;
            DELETE FROM challenger.applied_cards;
            DELETE FROM challenger.player_matchups;
            DELETE FROM challenger.matchup_team_cards;
            DELETE FROM challenger.matchup_teams;
            DELETE FROM challenger.matchups;
            DELETE FROM challenger.card_claim_offer_cards;
            DELETE FROM challenger.card_claim_progress;
            DELETE FROM challenger.team_card_inventory;
            DELETE FROM challenger.draft_picks;
            DELETE FROM challenger.waiver_claims;
            DELETE FROM challenger.roster_slots;
            DELETE FROM challenger.rosters;
            DELETE FROM challenger.league_posts;
            DELETE FROM challenger.chat_messages;
            DELETE FROM challenger.activity_entries;
            DELETE FROM challenger.league_invitations;
            DELETE FROM challenger.league_join_codes;
            DELETE FROM challenger.league_memberships;
            DELETE FROM challenger.leagues;
            """, cancellationToken);

        // Queue the many normalized inserts into a single PostgreSQL batch. The
        // previous implementation awaited every row individually, adding hundreds
        // of avoidable network round trips to each successful mutation.
        await using var writeBatch = new NpgsqlBatch(connection, transaction);
        ActiveWriteBatch.Value = writeBatch;
        try
        {
            // Players, their stat history, and card definitions are reference data.
            // Populate them only for a brand-new database instead of rewriting
            // hundreds of unchanged rows after every league mutation.
            if (!referenceDataReady)
            {
                foreach (var card in store.CardCatalog.Values)
                {
                    await ExecuteAsync(connection, transaction,
                        """
                        INSERT INTO challenger.power_cards
                            (id,label,description,effect_text,duration,accent,icon,allowed_team,rarity,card_type)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                        """, cancellationToken, card.Id, card.Label, card.Description, card.EffectText, card.Duration,
                        card.Accent, card.Icon, card.AllowedTeam.ToString(), card.Rarity.ToString(), card.Type.ToString());
                    foreach (var position in card.AllowedPositions.Distinct(StringComparer.OrdinalIgnoreCase))
                        await ExecuteAsync(connection, transaction,
                            "INSERT INTO challenger.power_card_positions(card_id,position) VALUES ($1,$2)",
                            cancellationToken, card.Id, position);
                }

                foreach (var player in store.Players.Values)
                {
                    await ExecuteAsync(connection, transaction,
                        """
                        INSERT INTO challenger.players(id,name,position,nfl_team,score,card_adjustment,game_started)
                        VALUES ($1,$2,$3,$4,$5,$6,$7)
                        """, cancellationToken, player.Id, player.Name, player.Position.ToString(), player.Team,
                        player.Score, player.CardAdjustment, player.GameStarted);
                    for (var i = 0; i < player.LiveStats.Count; i++)
                        await InsertStat(connection, transaction, player.Id, "live", i, player.LiveStats[i], cancellationToken);
                    for (var i = 0; i < player.RecentStats.Count; i++)
                        await InsertStat(connection, transaction, player.Id, "recent", i, player.RecentStats[i], cancellationToken);
                    for (var i = 0; i < player.ScoreBreakdown.Count; i++)
                    {
                        var item = player.ScoreBreakdown[i];
                        await ExecuteAsync(connection, transaction,
                            """
                            INSERT INTO challenger.player_score_breakdowns
                                (player_id,ordinal,label,quantity,points_per_unit,points)
                            VALUES ($1,$2,$3,$4,$5,$6)
                            """, cancellationToken, player.Id, i, item.Label, item.Quantity, item.PointsPerUnit, item.Points);
                    }
                    foreach (var history in player.WeeklyHistory)
                        await ExecuteAsync(connection, transaction,
                            """
                            INSERT INTO challenger.player_week_history
                                (player_id,week,opponent,stat_line,base_points,card_adjustment)
                            VALUES ($1,$2,$3,$4,$5,$6)
                            """, cancellationToken, player.Id, history.Week, history.Opponent, history.StatLine,
                            history.BasePoints, history.CardAdjustment);
                }
            }

            foreach (var league in store.Leagues.Values)
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.leagues
                        (id,name,max_members,current_week,draft_completed,draft_starts_at,
                         commissioner_user_id,trade_reject_votes_required,trade_review_hours)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    """, cancellationToken, league.Id, league.Name, league.MaxMembers, league.CurrentWeek,
                    league.DraftCompleted, league.DraftStartsAt, league.CommissionerUserId,
                    league.TradeRejectVotesRequired, league.TradeReviewHours);

            foreach (var membership in store.Memberships.Values)
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.league_memberships
                        (league_id,user_id,manager_name,email,team_name,role,wins,losses,ties,
                         points_for,points_against,joined_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    """, cancellationToken, membership.LeagueId, membership.UserId, membership.ManagerName,
                    membership.Email, membership.TeamName, membership.Role, membership.Wins, membership.Losses,
                    membership.Ties, membership.PointsFor, membership.PointsAgainst, membership.JoinedAt);

            foreach (var pair in store.LeagueIdsByJoinCode)
                await ExecuteAsync(connection, transaction,
                    "INSERT INTO challenger.league_join_codes(code,league_id) VALUES ($1,$2)",
                    cancellationToken, pair.Key.ToUpperInvariant(), pair.Value);
            foreach (var invitation in store.InvitationsByToken.Values)
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.league_invitations
                        (id,league_id,invited_by_user_id,email,token,expires_at,accepted_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    """, cancellationToken, invitation.Id, invitation.LeagueId, invitation.InvitedByUserId,
                    invitation.Email, invitation.Token, invitation.ExpiresAt, invitation.AcceptedAt);

            await SaveRostersAndCards(store, connection, transaction, cancellationToken);
            await SaveMatchups(store, connection, transaction, cancellationToken);
            await SaveTransactionsAndContent(store, connection, transaction, cancellationToken);
            await writeBatch.ExecuteNonQueryAsync(cancellationToken);
        }
        finally
        {
            ActiveWriteBatch.Value = null;
        }
        await transaction.CommitAsync(cancellationToken);
        referenceDataReady = true;
    }

    private static async Task InsertStat(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string playerId, string group, int ordinal, PlayerStat stat, CancellationToken cancellationToken) =>
        await ExecuteAsync(connection, transaction,
            """
            INSERT INTO challenger.player_stats(player_id,stat_group,ordinal,label,value)
            VALUES ($1,$2,$3,$4,$5)
            """, cancellationToken, playerId, group, ordinal, stat.Label, stat.Value);

    private static async Task SaveRostersAndCards(InMemoryFantasyStore store, NpgsqlConnection connection,
        NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var (key, roster) in store.Rosters)
        {
            await ExecuteAsync(connection, transaction,
                "INSERT INTO challenger.rosters(league_id,user_id) VALUES ($1,$2)",
                cancellationToken, key.LeagueId, key.UserId);
            await SaveSlots(roster.Starters, "starter");
            await SaveSlots(roster.Bench, "bench");

            async Task SaveSlots(IReadOnlyList<RosterSlot> slots, string kind)
            {
                for (var i = 0; i < slots.Count; i++)
                {
                    var slot = slots[i];
                    await ExecuteAsync(connection, transaction,
                        """
                        INSERT INTO challenger.roster_slots
                            (id,league_id,user_id,kind,position,player_id,ordinal)
                        VALUES ($1,$2,$3,$4,$5,$6,$7)
                        """, cancellationToken, slot.Id, key.LeagueId, key.UserId, kind,
                        slot.Position.ToString(), slot.Player.Id, i);
                }
            }
        }

        foreach (var (key, hand) in store.Hands)
            foreach (var card in hand.Where(card => card.Quantity > 0))
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.team_card_inventory(league_id,user_id,card_id,quantity)
                    VALUES ($1,$2,$3,$4)
                    """, cancellationToken, key.LeagueId, key.UserId, card.Id, card.Quantity);

        foreach (var claim in store.CardClaims.Values)
        {
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.card_claim_progress
                    (league_id,user_id,week,allowance,claimed_count,offer_id)
                VALUES ($1,$2,$3,$4,$5,$6)
                """, cancellationToken, claim.LeagueId, claim.UserId, claim.Week, claim.Allowance,
                claim.ClaimedCount, claim.OfferId);
            for (var i = 0; i < claim.OfferedCardIds.Count; i++)
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.card_claim_offer_cards
                        (league_id,user_id,week,card_id,ordinal)
                    VALUES ($1,$2,$3,$4,$5)
                    """, cancellationToken, claim.LeagueId, claim.UserId, claim.Week,
                    claim.OfferedCardIds[i], i);
        }
    }

    private static async Task SaveMatchups(InMemoryFantasyStore store, NpgsqlConnection connection,
        NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var (leagueId, matchup) in store.Matchups)
        {
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.matchups(id,league_id,week,game_time,is_live,win_chance)
                VALUES ($1,$2,$3,$4,$5,$6)
                """, cancellationToken, matchup.Id, leagueId, matchup.Week, matchup.GameTime,
                matchup.IsLive, matchup.WinChance);
            await SaveTeam("left", matchup.LeftTeam);
            await SaveTeam("right", matchup.RightTeam);
            await SavePairs("starter", matchup.Starters);
            await SavePairs("bench", matchup.Bench);
            foreach (var applied in matchup.AppliedCards)
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.applied_cards
                        (id,matchup_id,player_id,player_name,played_by_user_id,played_by_name,played_by,card_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                    """, cancellationToken, applied.Id, matchup.Id, applied.PlayerId, applied.PlayerName,
                    applied.PlayedByUserId, applied.PlayedByName, applied.PlayedBy, applied.Card.Id);

            async Task SaveTeam(string side, MatchupTeam team)
            {
                await ExecuteAsync(connection, transaction,
                    """
                    INSERT INTO challenger.matchup_teams
                        (matchup_id,side,team_id,name,score,projected_points)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    """, cancellationToken, matchup.Id, side, team.Id, team.Name, team.Score, team.ProjectedPoints);
                foreach (var card in team.Hand ?? [])
                    await ExecuteAsync(connection, transaction,
                        """
                        INSERT INTO challenger.matchup_team_cards(matchup_id,side,card_id,quantity)
                        VALUES ($1,$2,$3,$4)
                        """, cancellationToken, matchup.Id, side, card.Id, card.Quantity);
            }

            async Task SavePairs(string group, IReadOnlyList<PlayerMatchup> pairs)
            {
                for (var i = 0; i < pairs.Count; i++)
                    await ExecuteAsync(connection, transaction,
                        """
                        INSERT INTO challenger.player_matchups
                            (matchup_id,lineup_group,ordinal,left_player_id,right_player_id)
                        VALUES ($1,$2,$3,$4,$5)
                        """, cancellationToken, matchup.Id, group, i, pairs[i].Left.Id, pairs[i].Right.Id);
            }
        }
    }

    private static async Task SaveTransactionsAndContent(InMemoryFantasyStore store, NpgsqlConnection connection,
        NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var pick in store.DraftPicks)
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.draft_picks
                    (id,league_id,team_user_id,player_id,round,overall_pick,picked_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                """, cancellationToken, pick.Id, pick.LeagueId, pick.TeamId, pick.PlayerId,
                pick.Round, pick.OverallPick, pick.PickedAt);
        foreach (var waiver in store.Waivers)
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.waiver_claims
                    (id,league_id,user_id,add_player_id,drop_player_id,priority,status,created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                """, cancellationToken, waiver.Id, waiver.LeagueId, waiver.UserId, waiver.AddPlayerId,
                waiver.DropPlayerId, waiver.Priority, waiver.Status.ToString(), waiver.CreatedAt);
        foreach (var trade in store.Trades)
        {
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.trade_offers
                    (id,league_id,from_user_id,to_user_id,status,created_at,review_ends_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                """, cancellationToken, trade.Id, trade.LeagueId, trade.FromUserId, trade.ToUserId,
                trade.Status.ToString(), trade.CreatedAt, trade.ReviewEndsAt);
            foreach (var id in trade.OfferedPlayerIds)
                await Asset("trade_player_assets", "player_id", "offered", id);
            foreach (var id in trade.RequestedPlayerIds)
                await Asset("trade_player_assets", "player_id", "requested", id);
            foreach (var id in trade.OfferedCardIds)
                await Asset("trade_card_assets", "card_id", "offered", id);
            foreach (var id in trade.RequestedCardIds)
                await Asset("trade_card_assets", "card_id", "requested", id);
            foreach (var userId in trade.RejectVotes)
                await ExecuteAsync(connection, transaction,
                    "INSERT INTO challenger.trade_reject_votes(trade_id,user_id) VALUES ($1,$2)",
                    cancellationToken, trade.Id, userId);

            async Task Asset(string table, string column, string direction, string value) =>
                await ExecuteAsync(connection, transaction,
                    $"INSERT INTO challenger.{table}(trade_id,direction,{column}) VALUES ($1,$2,$3)",
                    cancellationToken, trade.Id, direction, value);
        }

        foreach (var post in store.LeaguePosts)
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.league_posts
                    (id,league_id,user_id,author_name,title,body,image_data_url,image_position,created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """, cancellationToken, post.Id, post.LeagueId, post.UserId, post.AuthorName,
                post.Title, post.Body, post.ImageDataUrl, post.ImagePosition, post.CreatedAt);
        foreach (var message in store.Messages)
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.chat_messages(id,league_id,user_id,sender,message_text,sent_at)
                VALUES ($1,$2,$3,$4,$5,$6)
                """, cancellationToken, message.Id, message.LeagueId, message.UserId,
                message.Sender, message.Text, message.SentAt);
        foreach (var activity in store.Activities)
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.activity_entries
                    (id,league_id,actor,summary,activity_type,occurred_at)
                VALUES ($1,$2,$3,$4,$5,$6)
                """, cancellationToken, activity.Id, activity.LeagueId, activity.Actor,
                activity.Summary, activity.Type.ToString(), activity.OccurredAt);
        foreach (var story in store.CommunityPosts)
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO challenger.news_stories
                    (id,category,title,summary,body,published_at)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (id) DO UPDATE SET
                    category=EXCLUDED.category,
                    title=EXCLUDED.title,
                    summary=EXCLUDED.summary,
                    body=EXCLUDED.body,
                    published_at=EXCLUDED.published_at
                """, cancellationToken, story.Id, story.Category, story.Title, story.Summary,
                story.Body, story.PublishedAt);
    }

    private static async Task<Dictionary<string, Matchup>> LoadMatchups(NpgsqlConnection connection,
        IReadOnlyDictionary<string, Player> players, IReadOnlyDictionary<string, PowerCard> cards,
        CancellationToken cancellationToken)
    {
        var teamCards = new Dictionary<(string, string), List<PowerCard>>();
        await ReadAsync(connection, "SELECT matchup_id,side,card_id,quantity FROM challenger.matchup_team_cards",
            r => GetList(teamCards, (r.GetString(0), r.GetString(1)))
                .Add(cards[r.GetString(2)] with { Quantity = r.GetInt32(3) }), cancellationToken);
        var teams = new Dictionary<(string, string), MatchupTeam>();
        await ReadAsync(connection, "SELECT matchup_id,side,team_id,name,score,projected_points FROM challenger.matchup_teams",
            r =>
            {
                var key = (r.GetString(0), r.GetString(1));
                teams[key] = new MatchupTeam(r.GetString(2), r.GetString(3),
                    Convert.ToDouble(r.GetDecimal(4)), Convert.ToDouble(r.GetDecimal(5)),
                    teamCards.GetValueOrDefault(key));
            }, cancellationToken);
        var pairs = new Dictionary<(string, string), List<PlayerMatchup>>();
        await ReadAsync(connection, "SELECT matchup_id,lineup_group,left_player_id,right_player_id FROM challenger.player_matchups ORDER BY matchup_id,lineup_group,ordinal",
            r => GetList(pairs, (r.GetString(0), r.GetString(1)))
                .Add(new PlayerMatchup(players[r.GetString(2)], players[r.GetString(3)])), cancellationToken);
        var applied = new Dictionary<string, List<AppliedCard>>();
        await ReadAsync(connection, "SELECT matchup_id,id,player_id,player_name,played_by_user_id,played_by_name,played_by,card_id FROM challenger.applied_cards",
            r => GetList(applied, r.GetString(0)).Add(new AppliedCard(r.GetString(1), r.GetString(2), r.GetString(3),
                r.GetString(4), r.GetString(5), r.GetString(6), cards[r.GetString(7)])), cancellationToken);
        var result = new Dictionary<string, Matchup>();
        await ReadAsync(connection, "SELECT id,league_id,week,game_time,is_live,win_chance FROM challenger.matchups",
            r =>
            {
                var id = r.GetString(0);
                result[r.GetString(1)] = new Matchup(id, r.GetInt32(2), r.GetString(3), r.GetBoolean(4),
                    r.GetInt32(5), teams[(id, "left")], teams[(id, "right")],
                    pairs.GetValueOrDefault((id, "starter")) ?? [], pairs.GetValueOrDefault((id, "bench")) ?? [],
                    applied.GetValueOrDefault(id) ?? []);
            }, cancellationToken);
        return result;
    }

    private static async Task<List<TradeOffer>> LoadTrades(NpgsqlConnection connection,
        CancellationToken cancellationToken)
    {
        var players = new Dictionary<(string, string), List<string>>();
        var cards = new Dictionary<(string, string), List<string>>();
        var votes = new Dictionary<string, List<string>>();
        await ReadAsync(connection, "SELECT trade_id,direction,player_id FROM challenger.trade_player_assets",
            r => GetList(players, (r.GetString(0), r.GetString(1))).Add(r.GetString(2)), cancellationToken);
        await ReadAsync(connection, "SELECT trade_id,direction,card_id FROM challenger.trade_card_assets",
            r => GetList(cards, (r.GetString(0), r.GetString(1))).Add(r.GetString(2)), cancellationToken);
        await ReadAsync(connection, "SELECT trade_id,user_id FROM challenger.trade_reject_votes",
            r => GetList(votes, r.GetString(0)).Add(r.GetString(1)), cancellationToken);
        var result = new List<TradeOffer>();
        await ReadAsync(connection, "SELECT id,league_id,from_user_id,to_user_id,status,created_at,review_ends_at FROM challenger.trade_offers",
            r =>
            {
                var id = r.GetString(0);
                result.Add(new TradeOffer(id, r.GetString(1), r.GetString(2), r.GetString(3),
                    players.GetValueOrDefault((id, "offered")) ?? [], players.GetValueOrDefault((id, "requested")) ?? [],
                    cards.GetValueOrDefault((id, "offered")) ?? [], cards.GetValueOrDefault((id, "requested")) ?? [],
                    Enum.Parse<TradeStatus>(r.GetString(4)), r.GetFieldValue<DateTimeOffset>(5),
                    r.IsDBNull(6) ? null : r.GetFieldValue<DateTimeOffset>(6), votes.GetValueOrDefault(id) ?? []));
            }, cancellationToken);
        return result;
    }

    private static async Task ReadAsync(NpgsqlConnection connection, string sql, Action<NpgsqlDataReader> read,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) read(reader);
    }

    private static List<TValue> GetList<TKey, TValue>(Dictionary<TKey, List<TValue>> dictionary, TKey key)
        where TKey : notnull
    {
        if (dictionary.TryGetValue(key, out var list)) return list;
        list = [];
        dictionary[key] = list;
        return list;
    }

    private static void Replace<TKey, TValue>(Dictionary<TKey, TValue> destination,
        IEnumerable<KeyValuePair<TKey, TValue>> source) where TKey : notnull
    {
        destination.Clear();
        foreach (var pair in source) destination[pair.Key] = pair.Value;
    }

    private static void Replace<T>(List<T> destination, IEnumerable<T> source)
    {
        destination.Clear();
        destination.AddRange(source);
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string sql, CancellationToken cancellationToken, params object?[] values)
    {
        var activeBatch = ActiveWriteBatch.Value;
        if (activeBatch is not null)
        {
            var batchCommand = new NpgsqlBatchCommand(sql);
            AddParameters(batchCommand.Parameters, values);
            activeBatch.BatchCommands.Add(batchCommand);
            return;
        }

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        AddParameters(command.Parameters, values);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void AddParameters(NpgsqlParameterCollection parameters, object?[] values)
    {
        for (var i = 0; i < values.Length; i++)
        {
            var value = values[i] switch
            {
                // PostgreSQL timestamptz represents an instant; normalize offsets
                // explicitly so Npgsql never receives an ambiguous local value.
                DateTimeOffset timestamp => timestamp.ToUniversalTime(),
                _ => values[i] ?? DBNull.Value,
            };
            parameters.AddWithValue(value);
        }
    }
}
