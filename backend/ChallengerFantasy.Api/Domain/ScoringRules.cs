namespace ChallengerFantasy.Api.Domain;

/// <summary>
/// Canonical fantasy scoring values used when player stats are converted into points.
/// A future stats provider can feed raw totals into these same rules.
/// </summary>
public static class ScoringRules
{
    public const double Reception = 1;
    public const double ReceivingYard = 0.1;
    public const double ReceivingTouchdown = 6;
    public const double RushingYard = 0.1;
    public const double RushingTouchdown = 6;
    public const double PassingYard = 0.04;
    public const double PassingTouchdown = 4;
    public const double TwoPointConversion = 2;
    public const double InterceptionThrown = -2;
    public const double FumbleLost = -2;
    public const double Sack = 1;
    public const double DefensiveInterception = 2;
    public const double FumbleRecovery = 2;
    public const double Safety = 2;
    public const double DefensiveTouchdown = 6;
    public const double ExtraPointMade = 1;
    public const double FieldGoalMissed = -1;
    public const double CoachWin = 3;
    public const double CoachLoss = -1;

    /// <summary>
    /// Creates deterministic development stats whose calculated total exactly matches seeded scores.
    /// Production stat ingestion should persist real quantities using these same point values.
    /// </summary>
    public static IReadOnlyList<ScoreBreakdownItem> CreateDevelopmentBreakdown(RosterPosition position, double score)
    {
        if (Math.Abs(score) < 0.001) return [];

        var rows = new List<ScoreBreakdownItem>();
        switch (position)
        {
            case RosterPosition.QB:
                Add(rows, "Passing touchdown(s)", Math.Min(4, Math.Floor(score / PassingTouchdown)), PassingTouchdown);
                AddRemainderAsYards(rows, "Rushing yard(s)", score, RushingYard);
                break;
            case RosterPosition.RB:
            case RosterPosition.FLEX:
                Add(rows, "Rushing touchdown(s)", Math.Min(2, Math.Floor(score / RushingTouchdown)), RushingTouchdown);
                AddSkillPositionRemainder(rows, score);
                break;
            case RosterPosition.WR:
            case RosterPosition.TE:
                Add(rows, "Receiving touchdown(s)", Math.Min(2, Math.Floor(score / ReceivingTouchdown)), ReceivingTouchdown);
                AddSkillPositionRemainder(rows, score);
                break;
            case RosterPosition.DEF:
                Add(rows, "Defensive or return touchdown(s)", Math.Min(1, Math.Floor(score / DefensiveTouchdown)), DefensiveTouchdown);
                Add(rows, "Sack(s)", Remaining(score, rows), Sack);
                break;
            case RosterPosition.K:
                Add(rows, "FG made: 50-59 yards", Math.Min(1, Math.Floor(score / 5)), 5);
                Add(rows, "FG made: 40-49 yards", Math.Floor(Remaining(score, rows) / 4), 4);
                Add(rows, "Extra point(s) made", Remaining(score, rows), ExtraPointMade);
                break;
            case RosterPosition.COACH:
                var wins = Math.Ceiling(score / CoachWin);
                Add(rows, "Team win(s)", wins, CoachWin);
                Add(rows, "Team loss(es)", wins * CoachWin - score, CoachLoss);
                break;
        }

        return rows;
    }

    private static void AddSkillPositionRemainder(List<ScoreBreakdownItem> rows, double score)
    {
        var receptions = Math.Min(5, Math.Floor(Remaining(score, rows)));
        Add(rows, "Reception(s)", receptions, Reception);
        AddRemainderAsYards(rows, "Receiving yard(s)", score, ReceivingYard);
    }

    private static void AddRemainderAsYards(List<ScoreBreakdownItem> rows, string label, double score, double rate) =>
        Add(rows, label, Math.Round(Remaining(score, rows) / rate, 2), rate);

    private static double Remaining(double score, IEnumerable<ScoreBreakdownItem> rows) =>
        Math.Round(score - rows.Sum(row => row.Points), 2);

    private static void Add(List<ScoreBreakdownItem> rows, string label, double quantity, double rate)
    {
        if (Math.Abs(quantity) < 0.001) return;
        rows.Add(new ScoreBreakdownItem(label, quantity, rate, Math.Round(quantity * rate, 2)));
    }
}
