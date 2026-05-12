export function formatAddress(
  addr: string,
  opts?: { head?: number; tail?: number }
): string {
  const head = opts?.head ?? 6;
  const tail = opts?.tail ?? 4;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}
