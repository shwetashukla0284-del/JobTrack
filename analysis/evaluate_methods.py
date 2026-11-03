"""
Evaluate the notebook's analysis METHODS on synthetic data with a known answer.

    python evaluate_methods.py            # writes method_evaluation.md and a chart

Real data never comes with the true answer attached, so you can't check a method
on it directly. Synthetic data can: the generator's true rates are written in
generate_synthetic_data.py. By simulating thousands of job searches we measure:

  1. Sampling noise     how far one search's rate can drift from the true rate
  2. Recency bias       how much counting recent applications understates the rate,
                        and whether the notebook's "mature only" rule fixes it
  3. CI coverage        do the 95% Wilson intervals contain the truth ~95% of the time?
  4. Test power         how many applications are needed to detect a channel
                        difference, and how often the test gives a false alarm

These are properties of the METHODS, not findings about the job market.
"""

import math
from datetime import timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")   # draw to files, no window
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

import generate_synthetic_data as gen

SIMULATIONS = 1000
SEED = 2026
HERE = Path(__file__).parent
REPORT = HERE / "method_evaluation.md"
FIGURE = HERE.parent / "docs" / "images" / "power_curve.png"

# The notebook's rule: an application is "mature" once it is 21+ days old
MATURE_AFTER_DAYS = 21
MATURE_CUTOFF = (gen.AS_OF - timedelta(days=MATURE_AFTER_DAYS)).date()


# ---------------------------------------------------------------------------
# The true answer, straight from the generator's parameters
# ---------------------------------------------------------------------------

def true_rates():
    weights = {source: params[0] for source, params in gen.SOURCES.items()}
    reply = {source: params[1] for source, params in gen.SOURCES.items()}
    interview = {source: params[1] * params[2] for source, params in gen.SOURCES.items()}

    def weighted(rate, sources):
        return sum(weights[s] * rate[s] for s in sources) / sum(weights[s] for s in sources)

    others = [source for source in gen.SOURCES if source != "Referral"]
    return {
        "reply": weighted(reply, gen.SOURCES),
        "interview": weighted(interview, gen.SOURCES),
        "referral_interview": interview["Referral"],
        "other_interview": weighted(interview, others),
        "referral_share": weights["Referral"],
    }


TRUTH = true_rates()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def simulate(n, seed):
    """One synthetic job search as arrays: is_referral, reached_interview, mature."""
    jobs = gen.generate(seed=seed, n=n, messy=False)
    referral = np.array([job["source"] == "Referral" for job in jobs])
    interview = np.array([any(status in ("Interview", "Offer") for status, _ in job["events"])
                          for job in jobs])
    mature = np.array([job["date_applied"] <= MATURE_CUTOFF for job in jobs])
    return referral, interview, mature


def wilson(successes, n, z=1.959964):
    """95% Wilson interval as fractions (the same formula as the notebook)."""
    p = successes / n
    centre = (p + z**2 / (2 * n)) / (1 + z**2 / n)
    margin = z * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / (1 + z**2 / n)
    return max(0.0, centre - margin), min(1.0, centre + margin)


def fisher_p(a_success, a_n, b_success, b_n):
    table = [[a_success, a_n - a_success], [b_success, b_n - b_success]]
    return stats.fisher_exact(table)[1]


def pct(value, decimals=1):
    return f"{100 * value:.{decimals}f}%"


def markdown_table(header, rows):
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 1 + 2. Sampling noise and recency bias (60 applications, like the practice data)
# ---------------------------------------------------------------------------

def noise_and_recency(n=60):
    all_rates, mature_rates, recent_shares = [], [], []
    for i in range(SIMULATIONS):
        _, interview, mature = simulate(n, SEED + i)
        all_rates.append(interview.mean())
        recent_shares.append(1 - mature.mean())
        if mature.sum() > 0:
            mature_rates.append(interview[mature].mean())
    all_rates, mature_rates = np.array(all_rates), np.array(mature_rates)

    def describe(rates):
        low, mid, high = np.percentile(rates, [5, 50, 95])
        return rates.mean(), low, mid, high

    return n, describe(all_rates), describe(mature_rates), float(np.mean(recent_shares))


# ---------------------------------------------------------------------------
# 3. Confidence-interval coverage (mature applications only, as in the notebook)
# ---------------------------------------------------------------------------

def coverage(sizes=(30, 60, 120, 240)):
    rows = []
    for n in sizes:
        covered_all = covered_ref = ref_runs = few_referrals = 0
        widths_all, widths_ref = [], []
        for i in range(SIMULATIONS):
            referral, interview, mature = simulate(n, SEED + 10_000 + i)
            m_interview, m_referral = interview[mature], referral[mature]

            low, high = wilson(m_interview.sum(), len(m_interview))
            covered_all += low <= TRUTH["interview"] <= high
            widths_all.append(high - low)

            k = m_referral.sum()
            few_referrals += k < 5
            if k > 0:
                low, high = wilson(m_interview[m_referral].sum(), k)
                covered_ref += low <= TRUTH["referral_interview"] <= high
                widths_ref.append(high - low)
                ref_runs += 1
        rows.append({
            "n": n,
            "coverage_all": covered_all / SIMULATIONS,
            "width_all": np.mean(widths_all),
            "coverage_ref": covered_ref / ref_runs,
            "width_ref": np.mean(widths_ref),
            "few_referrals": few_referrals / SIMULATIONS,
        })
    return rows


# ---------------------------------------------------------------------------
# 4a. Power for the effect planted in the practice data
# ---------------------------------------------------------------------------

def planted_power(sizes=(30, 60, 120, 240)):
    rows = []
    for n in sizes:
        significant = 0
        referral_counts = []
        for i in range(SIMULATIONS):
            referral, interview, mature = simulate(n, SEED + 20_000 + i)
            m_interview, m_referral = interview[mature], referral[mature]
            k = m_referral.sum()
            referral_counts.append(k)
            if 0 < k < len(m_referral):
                p = fisher_p(m_interview[m_referral].sum(), k,
                             m_interview[~m_referral].sum(), len(m_referral) - k)
                significant += p < 0.05
        rows.append({"n": n, "power": significant / SIMULATIONS,
                     "median_referrals": int(np.median(referral_counts))})
    return rows


# ---------------------------------------------------------------------------
# 4b. Sample-size planning for realistic effects (simple binomial model)
# ---------------------------------------------------------------------------

PLAN_BASELINE = 0.15         # interview rate of "other" channels
PLAN_REFERRAL_SHARE = 0.15   # share of applications that are referrals
PLAN_SIZES = (50, 100, 200, 400, 800)
PLAN_EFFECTS = (1.0, 1.5, 2.0, 3.0)   # referral rate = baseline x effect


def planning():
    rng = np.random.default_rng(SEED)
    power = {}
    for effect in PLAN_EFFECTS:
        for n in PLAN_SIZES:
            significant = 0
            for _ in range(SIMULATIONS):
                k = rng.binomial(n, PLAN_REFERRAL_SHARE)
                if k == 0 or k == n:
                    continue
                ref_hits = rng.binomial(k, PLAN_BASELINE * effect)
                other_hits = rng.binomial(n - k, PLAN_BASELINE)
                significant += fisher_p(ref_hits, k, other_hits, n - k) < 0.05
            power[(effect, n)] = significant / SIMULATIONS
    return power


def plot_power(power):
    colors = {1.0: "#9ca3af", 1.5: "#2a78d6", 2.0: "#eb6834", 3.0: "#1baf7a"}
    labels = {1.0: "no real difference (false alarms)", 1.5: "referrals 1.5x better",
              2.0: "referrals 2x better", 3.0: "referrals 3x better"}
    fig, ax = plt.subplots(figsize=(7.5, 4.6))
    ax.axhline(0.8, color="#d1d5db", linewidth=1)
    ax.text(PLAN_SIZES[0], 0.82, "80% power (common target)", color="#6b7280", fontsize=8)
    for effect in PLAN_EFFECTS:
        values = [power[(effect, n)] for n in PLAN_SIZES]
        ax.plot(PLAN_SIZES, values, marker="o", markersize=6, linewidth=2,
                color=colors[effect], label=labels[effect])
        ax.annotate(f"{values[-1]:.0%}", (PLAN_SIZES[-1], values[-1]), textcoords="offset points",
                    xytext=(8, -3), fontsize=9, color="#1f2937")
    ax.set_xscale("log")
    ax.set_xticks(PLAN_SIZES, [str(n) for n in PLAN_SIZES])
    ax.minorticks_off()
    ax.set_ylim(0, 1.05)
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.set_xlabel("Total applications (15% of them referrals)")
    ax.set_ylabel("Chance the test detects it (p < 0.05)")
    ax.set_title("How many applications to detect a referral advantage?  [SIMULATED]", loc="left", fontsize=11)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.grid(axis="y", color="#e5e7eb")
    ax.set_axisbelow(True)
    ax.legend(frameon=False, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.17), ncol=2)
    fig.tight_layout()
    FIGURE.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(FIGURE, dpi=110)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def main():
    n, (all_mean, all_lo, all_mid, all_hi), (mat_mean, mat_lo, mat_mid, mat_hi), recent_share = noise_and_recency()
    cov = coverage()
    planted = planted_power()
    power = planning()
    plot_power(power)

    def needed(effect):
        previous = None
        for size in PLAN_SIZES:
            if power[(effect, size)] >= 0.8:
                return f"{size} or fewer" if previous is None else f"between {previous} and {size}"
            previous = size
        return f"more than {PLAN_SIZES[-1]}"

    false_alarm = max(power[(1.0, size)] for size in PLAN_SIZES)

    # Simulation noise on a coverage estimate (95% margin for 1,000 runs)
    noise = 1.96 * math.sqrt(0.95 * 0.05 / SIMULATIONS)
    coverages = [row[key] for row in cov for key in ("coverage_all", "coverage_ref")]
    low_cov = [c for c in coverages if c < 0.95 - noise]
    if not low_cov:
        coverage_text = (f"All coverages are between {pct(min(coverages))} and {pct(max(coverages))}. "
                         f"With {SIMULATIONS:,} simulations, random noise alone moves a coverage estimate "
                         f"by about ±{100 * noise:.1f} points, so the intervals are **well calibrated**: "
                         "a 95% interval really does contain the truth about 95% of the time. "
                         "With very few referrals the interval is slightly conservative (wider than strictly needed).")
    else:
        coverage_text = (f"Some coverages ({', '.join(pct(c) for c in low_cov)}) are below 95% by more than "
                         f"simulation noise (±{100 * noise:.1f} points): those intervals are too narrow "
                         "and should be treated with caution.")

    report = f"""# Method evaluation (synthetic data)

> **Everything here is simulated.** It measures how well the notebook's *methods*
> work when the true answer is known. It says nothing about real job searches.
> Regenerate with `python evaluate_methods.py` ({SIMULATIONS:,} simulated searches per setting,
> fixed seeds, so the numbers are reproducible).

## The known truth

From the generator's parameters (`generate_synthetic_data.py`), the *eventual* rates,
if every application had unlimited time to get a reply:

{markdown_table(["Quantity", "True value"], [
    ["Reply rate, all channels", pct(TRUTH["reply"])],
    ["Interview rate, all channels", pct(TRUTH["interview"])],
    ["Interview rate, referrals", pct(TRUTH["referral_interview"])],
    ["Interview rate, other channels", pct(TRUTH["other_interview"])],
    ["Share of applications that are referrals", pct(TRUTH["referral_share"], 0)],
])}

## 1. Sampling noise: one search is a small sample

Across {SIMULATIONS:,} simulated searches of **{n} applications** each, all with the same true
interview rate of **{pct(TRUTH["interview"])}**:

{markdown_table(["Interview rate measured on", "Average", "Middle 90% of searches", "Median"], [
    ["All applications", pct(all_mean), f"{pct(all_lo)} – {pct(all_hi)}", pct(all_mid)],
    ["Mature applications only (21+ days old)", pct(mat_mean), f"{pct(mat_lo)} – {pct(mat_hi)}", pct(mat_mid)],
])}

**Reading it:** two people with *identical* true chances can see interview rates of
{pct(all_lo, 0)} and {pct(all_hi, 0)} just by luck. A single rate from tens of applications
needs its confidence interval next to it.

## 2. Recency bias: recent applications drag the rate down

Counting every application gives an average of **{pct(all_mean)}** against a truth of
**{pct(TRUTH["interview"])}**: it understates the rate by
**{100 * (TRUTH["interview"] - all_mean):.1f} percentage points**, because the newest
applications haven't had time to get a reply. Using only mature applications
(the notebook's rule) gives **{pct(mat_mean)}**, closing
{(mat_mean - all_mean) / (TRUTH["interview"] - all_mean):.0%} of the gap. The rest comes
from replies that take longer than 21 days.

The bias is small here because only **{pct(recent_share, 0)}** of these synthetic applications
are under 21 days old. In an active search, where most applications are recent, it is much
larger, which is why the notebook's weekly comparison uses mature weeks only.

## 3. Do the 95% confidence intervals contain the truth?

Wilson intervals on mature applications. A well-calibrated 95% interval should
contain the true value in about 95% of searches.

{markdown_table(["Applications", "Coverage: overall interview rate", "Avg. width",
                 "Coverage: referral interview rate", "Avg. width", "Searches with < 5 mature referrals"],
                [[row["n"], pct(row["coverage_all"]), pct(row["width_all"], 0),
                  pct(row["coverage_ref"]), pct(row["width_ref"], 0), pct(row["few_referrals"], 0)]
                 for row in cov])}

**Reading it:** {coverage_text} The widths show how little a small sample pins down:
with 60 applications, the referral interval is typically
{pct(next(r["width_ref"] for r in cov if r["n"] == 60), 0)} wide.

## 4. How many applications are needed to detect a channel difference?

### The large effect planted in the practice data

Referrals are set to convert at {pct(TRUTH["referral_interview"], 0)} vs
{pct(TRUTH["other_interview"], 0)} for other channels, a very large (about
{TRUTH["referral_interview"] / TRUTH["other_interview"]:.1f}x) difference. Fisher's exact test on mature applications:

{markdown_table(["Applications", "Typical number of mature referrals", "Chance of detecting it (p < 0.05)"],
                [[row["n"], row["median_referrals"], pct(row["power"], 0)] for row in planted])}

### Planning for realistic, smaller effects

Simple model: other channels convert at {pct(PLAN_BASELINE, 0)}, and
{pct(PLAN_REFERRAL_SHARE, 0)} of applications are referrals.

{markdown_table(["Referral advantage"] + [f"{size} apps" for size in PLAN_SIZES],
                [[("none (false-alarm rate)" if effect == 1.0 else f"{effect}x")]
                 + [pct(power[(effect, size)], 0) for size in PLAN_SIZES]
                 for effect in PLAN_EFFECTS])}

![Power curve](../docs/images/power_curve.png)

- To detect a **2x** referral advantage 80% of the time takes **{needed(2.0)} applications**;
  a **1.5x** advantage takes **{needed(1.5)}**; a **3x** advantage **{needed(3.0)}**.
- When there is **no real difference**, the test raised a false alarm in at most
  **{pct(false_alarm)}** of searches, at or below the intended 5%. Fisher's exact test is
  conservative, so false alarms are not the main risk; **missing a real difference is**.

## What this means for analysing a real job search

1. **Report rates with confidence intervals and sample sizes**, never alone.
2. **Compare channels on mature applications** (21+ days old), or recent weeks will look worse than they are.
3. **A non-significant test early in a search means "not enough data yet"**, not "no difference".
   With realistic effect sizes, expect to need a few hundred applications before a channel
   comparison can be conclusive; until then, treat differences as directional.
4. **Decide the comparison before looking** (as the notebook does with referrals vs the rest);
   testing every channel against every other would raise the false-alarm rate.
"""
    REPORT.write_text(report, encoding="utf-8")
    print(f"Wrote {REPORT.name} and {FIGURE.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
