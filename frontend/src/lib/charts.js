export function extractCharts(chartDatasets) {
  if (!chartDatasets) return [];

  if (Array.isArray(chartDatasets)) {
    return chartDatasets.filter(isValidChart);
  }

  if (Array.isArray(chartDatasets.charts)) {
    return chartDatasets.charts.filter(isValidChart);
  }

  return [];
}

export function hasCharts(chartDatasets) {
  return extractCharts(chartDatasets).length > 0;
}

export function formatChartValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";

  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString();
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return numeric.toFixed(2);
}

function isValidChart(chart) {
  return (
    chart &&
    typeof chart === "object" &&
    typeof chart.id === "string" &&
    typeof chart.title === "string" &&
    Array.isArray(chart.labels) &&
    Array.isArray(chart.values)
  );
}
