# Job search analysis: findings

> **Status: TEMPLATE, no findings yet.**
> Fill this in only from a **real** export (the notebook prints `DATA SOURCE: REAL export`).
> Results from the synthetic practice data are made up and must not appear here.

**Analysis date:** YYYY-MM-DD   **Period covered:** DD Mon – DD Mon YYYY
**Data:** N applications (M after cleaning), K status events

---

## 1. Question

Where in my job search do applications get lost, which channels lead to
interviews, and how long should I wait before following up?

## 2. Data and method (2–3 sentences)

*Example structure:* Exported N applications and their status history from
JobTrack. Checked data quality (list the main issues and how many rows), cleaned
(what you changed), then calculated funnel KPIs in pandas and SQL and confirmed
they match the app.

## 3. Data quality

| Issue | Rows | What I did |
|---|---|---|
| | | |

Effect of cleaning on the headline numbers: (from the notebook's KPI table)

## 4. Findings

Write each finding as: **what** (the number), **compared with what**, and **how sure**
(sample size, confidence interval or p-value).

1. **Funnel:** the biggest drop is between ___ and ___ (___% → ___%).
2. **Channels:** ___ had an interview rate of ___% (n=___, 95% CI ___–___%) vs ___%
   for other channels (Fisher's exact test p = ___).
3. **Response time:** median ___ days; 90% of replies came within ___ days.
4. **Trend:** (mature weeks only) ___

## 5. Recommendations

What will I do differently, and which finding supports it?

1.
2.

## 6. Limitations

- Sample size: N applications; differences between small groups are directional only.
- Recent applications have had less time to get replies.
- Status dates are when I logged them, not exactly when companies replied.
- (Anything else specific to this data.)

## 7. Next steps

- What would I measure next, or how would I collect better data?
