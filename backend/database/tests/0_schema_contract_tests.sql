\set ON_ERROR_STOP on

-- Run after the numbered schema scripts. The transaction is always rolled back,
-- so this test never leaves fixture data behind.
BEGIN;

DO $$
DECLARE
    missing_tables text;
    jsonb_columns integer;
BEGIN
    SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
      INTO missing_tables
      FROM (VALUES
        ('leagues'), ('league_memberships'), ('league_invitations'),
        ('players'), ('player_stats'), ('player_score_breakdowns'), ('player_week_history'),
        ('rosters'), ('roster_slots'), ('power_cards'), ('team_card_inventory'),
        ('card_claim_progress'), ('matchups'), ('matchup_teams'), ('player_matchups'),
        ('applied_cards'), ('draft_picks'), ('waiver_claims'), ('trade_offers'),
        ('trade_player_assets'), ('trade_card_assets'), ('trade_reject_votes'),
        ('news_stories'), ('league_posts'), ('chat_messages'), ('activity_entries')
      ) AS expected(name)
     WHERE NOT EXISTS (
        SELECT 1
          FROM information_schema.tables actual
         WHERE actual.table_schema = 'challenger'
           AND actual.table_name = expected.name
     );

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'Missing expected tables: %', missing_tables;
    END IF;

    SELECT count(*)
      INTO jsonb_columns
      FROM information_schema.columns
     WHERE table_schema = 'challenger'
       AND data_type = 'jsonb';
    IF jsonb_columns <> 0 THEN
        RAISE EXCEPTION 'Expected zero jsonb columns, found %', jsonb_columns;
    END IF;
END $$;

-- Prove that an orphaned membership is rejected by its foreign key.
DO $$
BEGIN
    BEGIN
        INSERT INTO challenger.league_memberships
            (league_id,user_id,manager_name,team_name,role,joined_at)
        VALUES ('missing-league','test-user','Test Manager','Test Team','member',now());
        RAISE EXCEPTION 'Expected a foreign-key violation for an orphaned membership';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL; -- Expected.
    END;
END $$;

ROLLBACK;
