/** Extract the `args` bag from a raw event log. */
export function getLogArgs(log: unknown): Record<string, unknown> {
  return ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
}

/** Shorten an Ethereum address to `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

/** Format a Unix timestamp (seconds) as a locale date-time string. */
export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

/** Extract a human-readable message from a caught error. */
export function extractError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
