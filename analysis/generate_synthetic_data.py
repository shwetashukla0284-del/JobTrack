"""
Generate SYNTHETIC JobTrack export files for practice.

    python generate_synthetic_data.py

Writes two CSV files to data/synthetic/ with exactly the same columns and
format as the app's "Export CSV" buttons, so the notebook works the same way
on synthetic and real data.

!! This data is made up. Patterns in it (for example "referrals convert
!! better") were PROGRAMMED IN below. They are not findings and must never
!! appear on a resume or in an interview as results.

The data is deliberately messy, the way manually entered data usually is,
so the cleaning steps have something real to do:
  - the same company typed different ways ("Northwind", "northwind ", "Northwind Inc.")
  - "Bangalore" and "Bengaluru" for the same city
  - inconsistent role capitalisation
  - two applications entered twice (duplicates)
  - missing source and location values
  - one same-day reply that computes as -1 day because of UTC vs IST
  - one impossible date (a reply before the application was sent)
"""

import csv
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SEED = 42                       # same seed -> same data every run
N_APPLICATIONS = 60
FIRST_DAY = date(2026, 8, 24)   # a Monday
LAST_DAY = date(2026, 10, 30)
AS_OF = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)  # "export" time
IST = timezone(timedelta(hours=5, minutes=30))

OUT_DIR = Path(__file__).parent / "data" / "synthetic"

COMPANIES = [
    "Northwind Analytics", "Bluepeak Retail", "Larkspur Health", "Quantia Labs",
    "Copperleaf Finance", "Orbitly", "Maple & Finch", "Tidewater Logistics",
    "Sundial Media", "Harbor Insurance", "Kestrel Foods", "Vantage Mobility",
    "Ironbark Energy", "Lumen Education", "Pinecrest Bank", "Stratus Cloud",
    "Mosaic Travel", "Fernway Pharma", "Granite Telecom", "Juniper Commerce",
    "Atlas Fintech", "Brightwater Studios", "Cobalt Gaming", "Driftwood Hotels",
    "Ember Robotics", "Foxglove Fashion", "Glacier Water", "Hollow Oak Games",
    "Indigo Payments", "Jetstream Air",
]

# One company typed differently on different days. Assigned to specific rows
# in main() so these problems are always present, whatever the random seed.
COMPANY_VARIANTS = [
    "Northwind Analytics", "northwind analytics", " Northwind Analytics ",
    "Northwind Analytics Inc.", "Quantia Labs", "QUANTIA LABS", "Quantia Labs Pvt Ltd",
]

ROLES = [
    "Data Analyst", "Data Analyst", "Data Analyst", "Junior Data Analyst",
    "Business Analyst", "Product Analyst", "data analyst", "Data analyst",
]

LOCATIONS = ["Pune", "Bengaluru", "Bangalore", "Mumbai", "Hyderabad", "Remote", "Remote", ""]

# (weight, P(any reply), P(interview | reply), typical days to reply)
SOURCES = {
    "LinkedIn":        (0.33, 0.45, 0.30, 9),
    "Job Board":       (0.18, 0.30, 0.25, 12),
    "Company Website": (0.15, 0.40, 0.30, 10),
    "Referral":        (0.12, 0.80, 0.60, 4),
    "Recruiter":       (0.07, 0.70, 0.50, 5),
    "":                (0.15, 0.40, 0.30, 9),   # source not recorded
}
P_OFFER_AFTER_INTERVIEW = 0.30


def new_id(rng):
    return "".join(rng.choice("0123456789abcdef") for _ in range(24))


def at_ist(day, rng, earliest_hour=9, latest_hour=20):
    """A random time of day in India, converted to UTC."""
    local = datetime(day.year, day.month, day.day,
                     rng.randint(earliest_hour, latest_hour), rng.randint(0, 59),
                     tzinfo=IST)
    return local.astimezone(timezone.utc)


def iso(moment):
    return moment.strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def make_application(rng):
    source = rng.choices(list(SOURCES), weights=[v[0] for v in SOURCES.values()])[0]
    _, p_reply, p_interview, reply_days = SOURCES[source]

    company = rng.choice(COMPANIES)

    applied = FIRST_DAY + timedelta(days=rng.randint(0, (LAST_DAY - FIRST_DAY).days))
    applied_utc = datetime(applied.year, applied.month, applied.day, tzinfo=timezone.utc)
    events = [("Applied", applied_utc)]

    # Walk the application through the funnel. Anything that would happen
    # after the export date hasn't happened yet (it stays at its current stage).
    if rng.random() < p_reply:
        reply_day = applied + timedelta(days=max(1, round(rng.gammavariate(2, reply_days / 2))))
        reply_at = at_ist(reply_day, rng)
        if reply_at < AS_OF:
            if rng.random() < p_interview:
                events.append(("Interview", reply_at))
                decision_at = at_ist(reply_day + timedelta(days=rng.randint(5, 15)), rng)
                if decision_at < AS_OF:
                    outcome = "Offer" if rng.random() < P_OFFER_AFTER_INTERVIEW else "Rejected"
                    events.append((outcome, decision_at))
            else:
                events.append(("Rejected", reply_at))

    # Entered into the app on the day, or a day or two later
    created_at = at_ist(applied + timedelta(days=rng.choice([0, 0, 0, 1, 2])), rng, 18, 23)
    created_at = max(created_at, applied_utc)
    updated_at = max([created_at] + [moment for _, moment in events])

    return {
        "job_id": new_id(rng),
        "company": company,
        "role": rng.choice(ROLES),
        "location": rng.choice(LOCATIONS),
        "source": source,
        "current_status": events[-1][0],
        "date_applied": applied,
        "created_at": created_at,
        "updated_at": updated_at,
        "events": events,
    }


def main():
    rng = random.Random(SEED)
    jobs = [make_application(rng) for _ in range(N_APPLICATIONS)]

    # Data-entry problem 0: the same companies spelled different ways
    for job, spelling in zip(jobs[10:], COMPANY_VARIANTS):
        job["company"] = spelling

    # Data-entry problem 1: two applications logged twice
    for original in rng.sample(jobs, 2):
        copy = dict(original, job_id=new_id(rng),
                    created_at=original["created_at"] + timedelta(minutes=3))
        copy["updated_at"] = max(copy["updated_at"], copy["created_at"])
        jobs.append(copy)

    # Data-entry problem 2: same-day reply early in the morning (IST), which
    # is the previous day in UTC -> computes as -1 day
    early = jobs[0]
    early["events"] = [early["events"][0],
                       ("Rejected", early["events"][0][1] - timedelta(hours=3, minutes=30))]
    early["current_status"] = "Rejected"

    # Data-entry problem 3: impossible date (reply 9 days before applying)
    wrong = jobs[1]
    wrong["events"] = [wrong["events"][0],
                       ("Rejected", wrong["events"][0][1] - timedelta(days=9))]
    wrong["current_status"] = "Rejected"

    for job in jobs:
        job["updated_at"] = max([job["created_at"]] + [m for _, m in job["events"]])

    jobs.sort(key=lambda job: (job["date_applied"], job["job_id"]))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # utf-8-sig + \r\n: the same encoding and line endings as the app's export
    with open(OUT_DIR / "jobtrack_applications_SYNTHETIC.csv", "w",
              newline="", encoding="utf-8-sig") as file:
        writer = csv.writer(file, lineterminator="\r\n")
        writer.writerow(["job_id", "company", "role", "location", "source",
                         "current_status", "date_applied", "created_at", "updated_at"])
        for job in jobs:
            writer.writerow([job["job_id"], job["company"], job["role"], job["location"],
                             job["source"], job["current_status"],
                             job["date_applied"].isoformat(),
                             iso(job["created_at"]), iso(job["updated_at"])])

    with open(OUT_DIR / "jobtrack_status_events_SYNTHETIC.csv", "w",
              newline="", encoding="utf-8-sig") as file:
        writer = csv.writer(file, lineterminator="\r\n")
        writer.writerow(["job_id", "event_number", "status", "changed_at"])
        for job in jobs:
            for number, (status, moment) in enumerate(job["events"], start=1):
                writer.writerow([job["job_id"], number, status, iso(moment)])

    events = sum(len(job["events"]) for job in jobs)
    print(f"SYNTHETIC data written to {OUT_DIR}: "
          f"{len(jobs)} applications, {events} status events")


if __name__ == "__main__":
    main()
