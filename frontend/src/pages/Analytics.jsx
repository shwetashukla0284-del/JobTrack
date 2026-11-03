import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    LabelList
} from "recharts";
import api, { getErrorMessage } from "../api";

// Below this many applications, differences are directional only
const SMALL_SAMPLE_SIZE = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Chart colors (validated for color-blind separation and contrast)
const COLORS = {
    series1: "#2a78d6",
    series2: "#eb6834",
    grid: "#e5e7eb",
    axis: "#6b7280",
    // Funnel stages are ordered, so they use one hue from light to dark
    funnel: ["#86b6ef", "#5598e7", "#256abf", "#184f95"]
};

const AXIS_PROPS = {
    stroke: COLORS.grid,
    tick: { fill: COLORS.axis, fontSize: 12 },
    tickLine: false
};

// =========================
// HELPERS
// =========================

const formatRate = (value) =>
    value === null || value === undefined ? "—" : `${value}%`;

const formatDays = (value) =>
    value === null || value === undefined
        ? "—"
        : `${value} day${value === 1 ? "" : "s"}`;

const formatWeek = (date) =>
    date.toLocaleDateString(undefined, {
        timeZone: "UTC",
        day: "numeric",
        month: "short"
    });

// Monday 00:00 UTC of the week containing `date` (matches the backend)
const startOfWeekUTC = (date) => {
    const day = (date.getUTCDay() + 6) % 7; // Monday = 0
    return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() - day
    );
};

// The API only returns weeks that have applications. Fill the gaps with
// zeros (up to the current week) so the time axis isn't compressed.
const fillWeeks = (weekly) => {
    if (weekly.length === 0) {
        return [];
    }

    const byWeek = new Map(
        weekly.map((row) => [new Date(row.weekStart).getTime(), row])
    );

    const first = new Date(weekly[0].weekStart).getTime();
    const last = Math.max(
        new Date(weekly[weekly.length - 1].weekStart).getTime(),
        startOfWeekUTC(new Date())
    );

    const weeks = [];

    for (let time = first; time <= last; time += WEEK_MS) {
        const row = byWeek.get(time);

        weeks.push({
            week: formatWeek(new Date(time)),
            applications: row?.applications ?? 0,
            reachedInterview: row?.reachedInterview ?? 0
        });
    }

    return weeks;
};

// =========================
// SMALL COMPONENTS
// =========================

function ChartTooltip({ active, payload, label, valueFormatter }) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="chart-tooltip">
            <strong>{label}</strong>

            {payload.map((item) => (
                <div key={item.dataKey} className="chart-tooltip-row">
                    <span
                        className="chart-swatch"
                        style={{ backgroundColor: item.color || item.payload.fill }}
                    />
                    {item.name}: {valueFormatter
                        ? valueFormatter(item.value, item.payload)
                        : item.value}
                </div>
            ))}
        </div>
    );
}

function DataTable({ columns, rows }) {
    return (
        <div className="table-wrapper">
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>{column.label}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            {columns.map((column) => (
                                <td key={column.key}>
                                    {column.format
                                        ? column.format(row[column.key])
                                        : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Section({ title, description, children }) {
    return (
        <section className="analytics-section">
            <h3>{title}</h3>

            {description && (
                <p className="section-description">{description}</p>
            )}

            {children}
        </section>
    );
}

// =========================
// PAGE
// =========================

function Analytics() {
    const [analytics, setAnalytics] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [exportMessage, setExportMessage] = useState("");
    const [exporting, setExporting] = useState("");

    const navigate = useNavigate();

    // =========================
    // CSV DOWNLOAD
    // =========================

    const downloadCsv = async (dataset) => {
        setExportMessage("");
        setExporting(dataset);

        try {
            const response = await api.get(`/jobs/export/${dataset}`, {
                responseType: "blob"
            });

            const today = new Date().toLocaleDateString("en-CA");
            const url = URL.createObjectURL(response.data);
            const link = document.createElement("a");

            link.href = url;
            link.download = `jobtrack_${dataset}_${today}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

        } catch (error) {
            // Blob responses can't carry a readable message, so use a fixed one
            if (getErrorMessage(error) !== null) {
                setExportMessage(
                    "Unable to export your data. Please try again."
                );
            }

        } finally {
            setExporting("");
        }
    };

    useEffect(() => {
        let ignore = false;

        const fetchAnalytics = async () => {
            try {
                const response = await api.get("/analytics");

                if (!ignore) {
                    setAnalytics(response.data);
                }

            } catch (error) {
                const message = getErrorMessage(
                    error,
                    "Unable to load analytics. Please try again."
                );

                if (!ignore && message) {
                    setErrorMessage(message);
                }
            }
        };

        fetchAnalytics();

        return () => {
            ignore = true;
        };

    }, [navigate]);


    const header = (
        <header className="dashboard-header">
            <div>
                <h1>JobTrack</h1>
                <p>Job search analytics</p>
            </div>

            <button
                className="secondary-button"
                onClick={() => navigate("/dashboard")}
            >
                ← Dashboard
            </button>
        </header>
    );

    if (errorMessage || !analytics) {
        return (
            <div className="dashboard">
                {header}

                <main className="dashboard-content">
                    {errorMessage ? (
                        <p className="error-message">{errorMessage}</p>
                    ) : (
                        <p className="loading-text">Loading analytics…</p>
                    )}
                </main>
            </div>
        );
    }

    const {
        summary,
        funnel,
        responseTime,
        weekly,
        bySource,
        dataQuality
    } = analytics;

    if (summary.applications === 0) {
        return (
            <div className="dashboard">
                {header}

                <main className="dashboard-content">
                    <div className="empty-state">
                        <h3>No data yet</h3>
                        <p>
                            Add job applications and update their status as
                            you hear back. Your analytics will appear here.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    // Funnel bars are labelled "count (x% of previous stage)"
    const funnelData = funnel.map((step) => ({
        ...step,
        label:
            step.conversionFromPrevious === null
                ? `${step.count}`
                : `${step.count} (${formatRate(step.conversionFromPrevious)})`
    }));

    const weeklyData = fillWeeks(weekly);

    const sourceData = bySource.map((row) => ({
        ...row,
        label: `${formatRate(row.interviewRate)} · n=${row.applications}`
    }));

    const kpis = [
        {
            label: "Applications",
            value: summary.applications,
            definition: "All applications you have logged"
        },
        {
            label: "Response Rate",
            value: formatRate(summary.responseRate),
            definition: "Share of applications that got any reply, including rejections"
        },
        {
            label: "Interview Rate",
            value: formatRate(summary.interviewRate),
            definition: "Share of applications that ever reached the Interview stage"
        },
        {
            label: "Offer Rate",
            value: formatRate(summary.offerRate),
            definition: "Share of applications that ever reached the Offer stage"
        },
        {
            label: "Interview → Offer",
            value: formatRate(summary.interviewToOfferRate),
            definition: "Of the applications that reached an interview, the share that got an offer"
        },
        {
            label: "Median Days to Response",
            value: formatDays(responseTime.medianDays),
            definition: `Middle value of days from applying to the first reply (${responseTime.respondedCount} responses)`
        },
        {
            label: "Awaiting Response",
            value: summary.awaitingResponse,
            definition: "Current status is still Applied"
        },
        {
            label: `No Reply > ${summary.staleAfterDays} Days`,
            value: summary.stale,
            definition: `Still Applied after ${summary.staleAfterDays} days: consider following up or treating as closed`
        }
    ];

    const qualityIssues = [
        ["Missing source", dataQuality.missingSource, "can't be compared by channel"],
        ["Missing location", dataQuality.missingLocation, "limits location analysis"],
        ["No status history", dataQuality.missingHistory, "created before history tracking; stage dates unknown"],
        ["Response dated before applying", dataQuality.responseBeforeApplied, "excluded from response-time figures"]
    ];

    return (
        <div className="dashboard">
            {header}

            <main className="dashboard-content">

                <div className="dashboard-title">
                    <div>
                        <h2>Job Search Analytics</h2>
                        <p>
                            Where applications convert, where they stall,
                            and which channels work best
                        </p>
                    </div>

                    <div
                        className="header-actions"
                        title="Raw data for analysis in Excel, Python or SQL"
                    >
                        <button
                            className="secondary-button"
                            disabled={exporting !== ""}
                            onClick={() => downloadCsv("applications")}
                        >
                            {exporting === "applications"
                                ? "Exporting…"
                                : "⬇ Applications CSV"}
                        </button>

                        <button
                            className="secondary-button"
                            disabled={exporting !== ""}
                            onClick={() => downloadCsv("status_events")}
                        >
                            {exporting === "status_events"
                                ? "Exporting…"
                                : "⬇ Status History CSV"}
                        </button>
                    </div>
                </div>

                {exportMessage && (
                    <p className="error-message">{exportMessage}</p>
                )}


                {/* =========================
                    SAMPLE SIZE WARNING
                ========================= */}

                {summary.applications < SMALL_SAMPLE_SIZE && (
                    <p className="sample-warning">
                        ⚠️ Based on {summary.applications} application
                        {summary.applications === 1 ? "" : "s"}. With fewer
                        than {SMALL_SAMPLE_SIZE}, treat differences between
                        channels or weeks as directional, not conclusive.
                    </p>
                )}


                {/* =========================
                    KPIs
                ========================= */}

                <div className="stats-container">
                    {kpis.map((kpi) => (
                        <div
                            className="stat-card"
                            key={kpi.label}
                            title={kpi.definition}
                        >
                            <h3>{kpi.value}</h3>
                            <p>{kpi.label}</p>
                        </div>
                    ))}
                </div>


                {/* =========================
                    FUNNEL
                ========================= */}

                <Section
                    title="Application Funnel"
                    description="How many applications ever reached each stage. Percentages are conversion from the previous stage."
                >
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                                data={funnelData}
                                layout="vertical"
                                margin={{ top: 4, right: 96, bottom: 4, left: 8 }}
                            >
                                <CartesianGrid
                                    horizontal={false}
                                    stroke={COLORS.grid}
                                />

                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    {...AXIS_PROPS}
                                />

                                <YAxis
                                    type="category"
                                    dataKey="stage"
                                    width={84}
                                    {...AXIS_PROPS}
                                />

                                <Tooltip
                                    cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                                    content={
                                        <ChartTooltip
                                            valueFormatter={(value, row) =>
                                                row.conversionFromPrevious === null
                                                    ? value
                                                    : `${value} (${formatRate(row.conversionFromPrevious)} of previous stage)`
                                            }
                                        />
                                    }
                                />

                                <Bar
                                    dataKey="count"
                                    name="Applications"
                                    radius={[0, 4, 4, 0]}
                                    maxBarSize={28}
                                    isAnimationActive={false}
                                    minPointSize={3}
                                >
                                    {funnelData.map((step, index) => (
                                        <Cell
                                            key={step.stage}
                                            fill={COLORS.funnel[index]}
                                        />
                                    ))}

                                    <LabelList
                                        dataKey="label"
                                        position="right"
                                        fill="#1f2937"
                                        fontSize={12}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <details className="table-toggle">
                        <summary>View data table</summary>

                        <DataTable
                            columns={[
                                { key: "stage", label: "Stage" },
                                { key: "count", label: "Applications" },
                                {
                                    key: "conversionFromPrevious",
                                    label: "Conversion from previous",
                                    format: formatRate
                                }
                            ]}
                            rows={funnel}
                        />
                    </details>
                </Section>


                {/* =========================
                    WEEKLY TREND
                ========================= */}

                <Section
                    title="Applications per Week"
                    description="Weeks start on Monday. Recent weeks have had less time to get replies, so their interview counts may still rise."
                >
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                                data={weeklyData}
                                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
                                barGap={2}
                            >
                                <CartesianGrid
                                    vertical={false}
                                    stroke={COLORS.grid}
                                />

                                <XAxis dataKey="week" {...AXIS_PROPS} />

                                <YAxis allowDecimals={false} {...AXIS_PROPS} />

                                <Tooltip
                                    cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                                    content={<ChartTooltip />}
                                />

                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: 13, color: "#374151" }}
                                />

                                <Bar
                                    dataKey="applications"
                                    name="Applications"
                                    fill={COLORS.series1}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={24}
                                    isAnimationActive={false}
                                />

                                <Bar
                                    dataKey="reachedInterview"
                                    name="Reached interview"
                                    fill={COLORS.series2}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={24}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <details className="table-toggle">
                        <summary>View data table</summary>

                        <DataTable
                            columns={[
                                { key: "week", label: "Week of" },
                                { key: "applications", label: "Applications" },
                                { key: "reachedInterview", label: "Reached interview" }
                            ]}
                            rows={weeklyData}
                        />
                    </details>
                </Section>


                {/* =========================
                    BY SOURCE
                ========================= */}

                <Section
                    title="Interview Rate by Source"
                    description="Which channels lead to interviews. Check n (the number of applications) before comparing: a rate based on 2 applications says very little."
                >
                    <div className="chart-container">
                        <ResponsiveContainer
                            width="100%"
                            height={Math.max(160, sourceData.length * 44)}
                        >
                            <BarChart
                                data={sourceData}
                                layout="vertical"
                                margin={{ top: 4, right: 110, bottom: 4, left: 8 }}
                            >
                                <CartesianGrid
                                    horizontal={false}
                                    stroke={COLORS.grid}
                                />

                                <XAxis
                                    type="number"
                                    domain={[0, 100]}
                                    tickFormatter={(value) => `${value}%`}
                                    {...AXIS_PROPS}
                                />

                                <YAxis
                                    type="category"
                                    dataKey="source"
                                    width={120}
                                    {...AXIS_PROPS}
                                />

                                <Tooltip
                                    cursor={{ fill: "rgba(37, 99, 235, 0.06)" }}
                                    content={
                                        <ChartTooltip
                                            valueFormatter={(value, row) =>
                                                `${formatRate(value)} (${row.reachedInterview} of ${row.applications})`
                                            }
                                        />
                                    }
                                />

                                <Bar
                                    dataKey="interviewRate"
                                    name="Interview rate"
                                    fill={COLORS.series1}
                                    radius={[0, 4, 4, 0]}
                                    maxBarSize={24}
                                    isAnimationActive={false}
                                    minPointSize={3}
                                >
                                    <LabelList
                                        dataKey="label"
                                        position="right"
                                        fill="#1f2937"
                                        fontSize={12}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <DataTable
                        columns={[
                            { key: "source", label: "Source" },
                            { key: "applications", label: "Applications (n)" },
                            { key: "responseRate", label: "Response rate", format: formatRate },
                            { key: "interviewRate", label: "Interview rate", format: formatRate },
                            { key: "offerRate", label: "Offer rate", format: formatRate }
                        ]}
                        rows={bySource}
                    />
                </Section>


                {/* =========================
                    RESPONSE TIME
                ========================= */}

                <Section
                    title="Response Time"
                    description={`Days from applying to the first reply, across ${responseTime.respondedCount} application${responseTime.respondedCount === 1 ? "" : "s"} that got one. The median is less affected by one very slow reply than the average.`}
                >
                    <div className="mini-stats">
                        <div>
                            <strong>{formatDays(responseTime.medianDays)}</strong>
                            <span>Median</span>
                        </div>

                        <div>
                            <strong>{formatDays(responseTime.averageDays)}</strong>
                            <span>Average</span>
                        </div>

                        <div>
                            <strong>
                                {responseTime.minDays === null
                                    ? "—"
                                    : `${responseTime.minDays}–${formatDays(responseTime.maxDays)}`}
                            </strong>
                            <span>Fastest – slowest</span>
                        </div>
                    </div>
                </Section>


                {/* =========================
                    DATA QUALITY
                ========================= */}

                <Section
                    title="Data Quality"
                    description={`Checks across all ${dataQuality.totalRecords} records. Missing or inconsistent data limits what the analysis can show.`}
                >
                    <ul className="quality-list">
                        {qualityIssues.map(([label, count, impact]) => (
                            <li key={label}>
                                <span
                                    className={
                                        count === 0
                                            ? "quality-badge quality-ok"
                                            : "quality-badge quality-issue"
                                    }
                                >
                                    {count === 0 ? "✓ OK" : `⚠ ${count}`}
                                </span>
                                <span>
                                    <strong>{label}</strong>
                                    {count > 0 && ` — ${impact}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>

            </main>
        </div>
    );
}

export default Analytics;
