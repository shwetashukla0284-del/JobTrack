# JobTrack data dictionary

The Analytics page exports two CSV files. They contain **raw data only**:
no calculated metrics, so every KPI can be recalculated independently
(see [metrics.md](metrics.md) for the definitions).

The files are linked by `job_id` (one application → many status events),
like two tables in a relational database.

```
applications.csv              status_events.csv
┌────────────────┐            ┌─────────────────┐
│ job_id (PK)    │◄───────────┤ job_id (FK)     │
│ company        │   1 ── *   │ event_number    │
│ role           │            │ status          │
│ ...            │            │ changed_at      │
└────────────────┘            └─────────────────┘
```

PK = primary key (unique per row). FK = foreign key (points to a row in the other table).

## applications.csv

One row per job application. Sorted by `date_applied`, oldest first.

| Column | Type | Description | Can be empty? |
|---|---|---|---|
| `job_id` | text (24 hex characters) | Unique ID of the application | No |
| `company` | text | Company name, as typed by the user | No |
| `role` | text | Job title, as typed by the user | No |
| `location` | text | City or "Remote", as typed by the user | Yes |
| `source` | category | Channel: LinkedIn, Referral, Company Website, Job Board, Recruiter, Other | Yes (not recorded) |
| `current_status` | category | Applied, Interview, Offer, Rejected | No |
| `date_applied` | date `YYYY-MM-DD` | Calendar date the application was sent | No |
| `created_at` | timestamp (ISO 8601, UTC) | When the record was entered into the app | No |
| `updated_at` | timestamp (ISO 8601, UTC) | When the record was last edited | No |

## status_events.csv

One row per status change. Sorted by application, then `event_number`.

| Column | Type | Description | Can be empty? |
|---|---|---|---|
| `job_id` | text | The application this event belongs to (→ `applications.job_id`) | No |
| `event_number` | integer | 1 for the first event of an application, 2 for the next, … | No |
| `status` | category | The status the application moved to | No |
| `changed_at` | timestamp (ISO 8601, UTC) | When the change was recorded | No |

Every application's first event is `Applied`, dated on `date_applied`.

## Things to know when analyzing

- **Free-text fields are not standardized.** "Google", "google" and "Google India"
  are different values. Cleaning them is part of the analysis.
- **Timestamps are UTC.** India (IST) is UTC+5:30, so an event at 02:00 IST shows as
  the previous day's 20:30 in UTC.
- **`date_applied` is a date, `changed_at` is a moment.** Comparing them can make a
  same-day reply look like −1 day; treat that as 0 (see metrics.md).
- **`changed_at` is when the user recorded the change**, which may be later than when
  the company actually replied.
- **Records created before status history existed** have approximate events: their
  non-Applied event is dated on the record's last update.
- **Spreadsheet safety:** text beginning with `=`, `+`, `-` or `@` is prefixed with an
  apostrophe (`'`) so spreadsheet apps don't run it as a formula. Remove the leading
  apostrophe if you need the original text.
- **No personal account data** (user ID, name, email) is included.
