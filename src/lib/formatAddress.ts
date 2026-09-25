export function formatAddress(addr: string, opts?: { head?: number; tail?: number }): string {
  const head = opts?.head ?? 6;
  const tail = opts?.tail ?? 4;
  if (!addr) return "";
  // Already shorter than head + tail: show it as-is instead of duplicating chars
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}
