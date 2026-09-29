export type SeaState = "Calm" | "Slight" | "Moderate" | "Rough" | "Very rough";

export interface FuelHistoryPoint {
  sample: number;
  actual: number;
  predicted: number;
}

export function formatSignedPercent(value: number): string {
  if (value === 0) return "0.0%";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

export function seaStateForWave(heightM: number): SeaState {
  if (heightM < 0.5) return "Calm";
  if (heightM < 1.25) return "Slight";
  if (heightM < 2.5) return "Moderate";
  if (heightM < 6) return "Rough";
  return "Very rough";
}

export function buildHistoryChart(
  history: FuelHistoryPoint[],
  width: number,
  height: number,
): {
  actual: [number, number][];
  predicted: [number, number][];
  domain: [number, number];
} {
  if (history.length === 0) return { actual: [], predicted: [], domain: [0, 1] };
  const padding = 24;
  const values = history.flatMap(point => [point.actual, point.predicted]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum || 1;
  const x = (index: number) => history.length === 1
    ? width / 2
    : padding + index * (width - padding * 2) / (history.length - 1);
  const y = (value: number) => height - padding - (value - minimum) * (height - padding * 2) / span;
  const point = (value: number, index: number): [number, number] => [
    Number(x(index).toFixed(3)),
    Number(y(value).toFixed(3)),
  ];

  return {
    actual: history.map((item, index) => point(item.actual, index)),
    predicted: history.map((item, index) => point(item.predicted, index)),
    domain: [minimum, maximum],
  };
}
