# JobTrack analysis (Python + SQL)

Analysis of job search data exported from the JobTrack app: data quality checks,
cleaning, funnel KPIs, channel comparison with confidence intervals and a
hypothesis test, response-time analysis, and the same KPIs reproduced in SQL.

| File | What it is |
|---|---|
| [`job_search_analysis.ipynb`](job_search_analysis.ipynb) | The analysis, step by step, with explanations |
| [`insights.md`](insights.md) | Write-up template: findings, recommendations, limitations |
| [`generate_synthetic_data.py`](generate_synthetic_data.py) | Creates made-up practice data in the export format (`--n`, `--seed`, `--clean`, `--out`) |
| [`evaluate_methods.py`](evaluate_methods.py) → [`method_evaluation.md`](method_evaluation.md) | Tests the statistical methods on 1,000s of simulated searches with a known answer: accuracy, confidence-interval coverage, test power and sample-size planning |
| `data/raw/` | Put your real exports here (never committed to git) |
| `data/synthetic/` | Synthetic practice data |
| `outputs/` | Cleaned data, KPIs and charts written by the notebook (not committed) |

Metric definitions: [`../docs/metrics.md`](../docs/metrics.md) ·
Column definitions: [`../docs/data-dictionary.md`](../docs/data-dictionary.md)

## Setup (once)

From the `analysis` folder, in a terminal (PowerShell on Windows):

```powershell
python -m venv .venv                  # a private Python environment for this project
.venv\Scripts\Activate.ps1            # activate it (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

Then open `job_search_analysis.ipynb` in VS Code and pick the `.venv` Python as
the kernel (top right of the notebook), or run `jupyter notebook`.

## Using it

1. In the app, open **Analytics** and click **⬇ Applications CSV** and **⬇ Status History CSV**.
2. Move both files into `analysis/data/raw/`.
3. Run all cells. The notebook uses the newest export, and prints whether it is
   using **REAL** or **SYNTHETIC** data.
4. Write up the results in `insights.md`.

To re-create the practice data: `python generate_synthetic_data.py`.

> **Privacy:** notebook outputs (tables, charts) are saved inside the `.ipynb`
> file. Before committing after a run on real data, clear them:
> `jupyter nbconvert --clear-output --inplace job_search_analysis.ipynb`
> (or *Clear All Outputs* in VS Code). Or run on synthetic data before committing.

## How the results are validated

The KPIs are implemented three independent ways, and they agree:

1. **The app** (MongoDB aggregation pipeline, `backend/services/analyticsService.js`)
2. **pandas** (section 6 of the notebook, using the app's exact definitions and rounding)
3. **SQL** (section 11, DuckDB; the notebook stops with an error if SQL and pandas disagree)

## Learning path

If you're new to these tools, work through the notebook in order and try
changing things. Concepts in the order they appear:

| Concept | Plain-English meaning | Where |
|---|---|---|
| DataFrame | A table in Python (rows and named columns) | §1 |
| Data types (`dtype`) | Whether a column is text, number, date… | §1–2 |
| Missing values (`NaN`, `NA`) | Empty cells; easy to miscount | §2–3 |
| Data profiling | Checking data for problems before using it | §3 |
| Normalisation key | A standardised version of text used to match variants | §3–4 |
| Deduplication | Removing records entered twice | §4 |
| `groupby` / `GROUP BY` | Split rows into groups and summarise each one | §5–9, §11 |
| `crosstab` | Count combinations of two categories | §5, §9 |
| Funnel / conversion rate | Share of items that move from one stage to the next | §6–7 |
| Cohort maturity | Recent items haven't had time to convert yet | §8 |
| Confidence interval | Range the true rate plausibly lies in, given the sample size | §9 |
| Hypothesis test, p-value | How likely a difference this big is by chance alone | §9 |
| Median, percentile | The middle value; the value X% of data falls below | §10 |
| `JOIN` (`LEFT` vs inner) | Combine two tables on a shared key; keep or drop unmatched rows | §11 |
| CTE (`WITH ... AS`) | A named step inside a SQL query | §11 |
| Window function (`OVER`) | Calculate across rows without collapsing them (running totals, ranks) | §11 |

**Practice ideas** (good preparation for SQL interview questions):

- Write SQL for the interview rate by `role`. Which role family converts best?
- Use a window function to rank channels by interview rate (`RANK() OVER (...)`).
- Find applications with no reply after 21 days, oldest first.
- Change `STALE_AFTER_DAYS` and see how the stale count changes.
