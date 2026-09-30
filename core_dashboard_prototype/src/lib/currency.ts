export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatMillionsAsUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return formatUsd(value * 1_000_000);
}
