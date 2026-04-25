import { extractCharts, formatChartValue } from "../../lib/charts";

function normalizeChartRows(chart) {
  const labels = chart.labels || [];
  const values = chart.values || [];
  const rows = labels.map((label, index) => ({
    label: String(label),
    value: Number(values[index] ?? 0),
  }));

  if (rows.length === 0) {
    return [{ label: "No data", value: 0 }];
  }

  return rows;
}

function ChartCard({ chart }) {
  const rows = normalizeChartRows(chart);
  const maxValue = rows.reduce((acc, row) => Math.max(acc, Math.abs(row.value)), 0) || 1;

  return (
    <article className="rounded-lg border border-gray-800 bg-gray-800/35 p-4">
      <h3 className="text-sm text-gray-100 font-medium">{chart.title}</h3>
      {chart.description ? <p className="mt-1 text-xs text-gray-500">{chart.description}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const barWidth = Math.min(100, Math.max(0, (Math.abs(row.value) / maxValue) * 100));
          return (
            <div key={`${chart.id}-${row.label}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-400 truncate">{row.label}</span>
                <span className="text-cyan-200 font-mono">{formatChartValue(row.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-900/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-500 to-blue-400"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function ChartGrid({ chartDatasets, title = "Chart Visualizations", subtitle = "" }) {
  const charts = extractCharts(chartDatasets);

  if (charts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-4 md:p-6">
      <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-gray-500">{subtitle}</p> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {charts.map((chart) => (
          <ChartCard key={chart.id} chart={chart} />
        ))}
      </div>
    </section>
  );
}
