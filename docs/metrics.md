# JobTrack metric definitions

Every number in the app is defined here. The calculations live in
[`backend/services/analyticsService.js`](../backend/services/analyticsService.js).

## Data captured per application

| Field | Meaning |
|---|---|
| `dateApplied` | Calendar date the application was sent |
| `status` | Current stage: Applied, Interview, Offer, Rejected |
| `statusHistory` | Every stage the application has been in, with the time it changed |
| `source` | Channel: LinkedIn, Referral, Company Website, Job Board, Recruiter, Other (missing = "Unknown") |
| `company`, `role`, `location` | Descriptive fields for segmentation |

## Why status history matters

The original app stored only the **current** status. An application that went
Applied → Interview → Offer then counted as an *Offer only*, so the interview
count (and interview rate) shrank as applications progressed. Recording every
status change lets us count applications that **ever reached** each stage, which
is the standard way to measure a funnel.

## Funnel metrics

| Metric | Definition |
|---|---|
| Applications | Count of all applications |
| Responded | Applications that ever moved past *Applied* (a rejection counts as a response) |
| Reached Interview | Applications that were ever at *Interview* or *Offer* (an offer implies the interview stage) |
| Reached Offer | Applications that were ever at *Offer* |
| Rejected | Applications whose **current** status is *Rejected* |
| Awaiting Response | Applications whose **current** status is *Applied* |
| Stale | Awaiting response and applied more than 21 days ago (likely no reply coming; consider following up) |

## Rates

All rates are percentages rounded to one decimal place. A rate is **null** (shown as "—")
when its denominator is 0, because "no data" is not the same as "0%".

| Rate | Formula |
|---|---|
| Response rate | Responded ÷ Applications |
| Interview rate | Reached Interview ÷ Applications |
| Offer rate | Reached Offer ÷ Applications |
| Interview → offer rate | Reached Offer ÷ Reached Interview |
| Funnel step conversion | Each funnel stage ÷ the stage before it |

## Response time

- **Days to response** = whole days from `dateApplied` to the first status change
  away from *Applied*.
- Reported as median (the middle value, less affected by outliers than the
  average), average, minimum and maximum, only for applications that got a response.
- `dateApplied` is a calendar date and status changes are exact times, so a
  same-day response can compute as −1 day in timezones ahead of UTC; it is treated as 0.

## Breakdowns

- **Weekly:** applications grouped by the week (starting Monday) of `dateApplied`.
- **By source:** the funnel metrics for each channel.

## Data quality checks

| Check | Why it matters |
|---|---|
| Missing source | Those applications can't be compared by channel |
| Missing location | Limits location analysis |
| Missing history | Created before history tracking; stage dates are unknown |
| Response before applied | Impossible dates; excluded from response-time statistics |

## Known limitations (read before drawing conclusions)

- **Small samples:** one person's job search is usually tens of applications, not
  thousands. Treat differences between channels as directional, not proven.
- **Recent applications haven't had time to respond.** Rates for the latest weeks
  will look worse than they will end up. Compare older weeks with care.
- **Backfilled history is approximate:** for records created before history tracking,
  the change date is the record's last update time.
- **Manual entry:** dates and statuses are only as accurate as what was logged.
