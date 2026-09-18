export function formatCents(cents: number | null | undefined, currency = "AUD"): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
}

export function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "never";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}
