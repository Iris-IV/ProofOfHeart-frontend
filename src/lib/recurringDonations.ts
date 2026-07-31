/**
 * Recurring donations (#671).
 *
 * The escrow contract has no subscription primitive and cannot pull funds from
 * a wallet, so a schedule here is an off-chain reminder: it stores the intent
 * and, when a cycle is due, prompts the donor to sign that cycle's donation.
 * No funds move without an explicit signature.
 *
 * Schedules live in `localStorage` keyed by wallet, so they are per-device.
 */

export const RECURRING_STORAGE_KEY = "poh_recurring_donations";

export type RecurringInterval = "monthly" | "quarterly";

export const INTERVAL_MONTHS: Record<RecurringInterval, number> = {
  monthly: 1,
  quarterly: 3,
};

export const INTERVAL_LABELS: Record<RecurringInterval, string> = {
  monthly: "Monthly",
  quarterly: "Every 3 months",
};

export interface RecurringDonation {
  id: string;
  walletAddress: string;
  campaignId: number;
  campaignTitle: string;
  /** Per-cycle amount in stroops, stored as a string so JSON round-trips. */
  amountStroops: string;
  interval: RecurringInterval;
  /** Unix ms. */
  createdAt: number;
  nextRunAt: number;
  lastRunAt: number | null;
  cyclesCompleted: number;
  active: boolean;
}

/** Add whole months in UTC, clamping to the last valid day (Jan 31 → Feb 28). */
export function addMonths(timestampMs: number, months: number): number {
  const date = new Date(timestampMs);
  const targetDay = date.getUTCDate();
  const result = new Date(date);

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();

  result.setUTCDate(Math.min(targetDay, daysInTargetMonth));
  return result.getTime();
}

export function nextRunAfter(from: number, interval: RecurringInterval): number {
  return addMonths(from, INTERVAL_MONTHS[interval]);
}

function readAll(): RecurringDonation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECURRING_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecurringDonation[]) : [];
  } catch {
    return [];
  }
}

function writeAll(schedules: RecurringDonation[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(schedules));
  } catch {
    // Storage full or blocked — a lost reminder must not break the donation.
  }
}

export function listSchedules(walletAddress: string): RecurringDonation[] {
  return readAll().filter((s) => s.walletAddress === walletAddress);
}

export function createSchedule(input: {
  walletAddress: string;
  campaignId: number;
  campaignTitle: string;
  amountStroops: bigint;
  interval: RecurringInterval;
  now?: number;
}): RecurringDonation {
  const now = input.now ?? Date.now();

  const schedule: RecurringDonation = {
    id: `${input.walletAddress}-${input.campaignId}-${now}`,
    walletAddress: input.walletAddress,
    campaignId: input.campaignId,
    campaignTitle: input.campaignTitle,
    amountStroops: input.amountStroops.toString(),
    interval: input.interval,
    createdAt: now,
    // The donation that created the schedule counts as cycle 1, so the next
    // charge is one full interval away rather than immediately due.
    nextRunAt: nextRunAfter(now, input.interval),
    lastRunAt: now,
    cyclesCompleted: 1,
    active: true,
  };

  const all = readAll().filter(
    (s) => !(s.walletAddress === schedule.walletAddress && s.campaignId === schedule.campaignId)
  );
  writeAll([...all, schedule]);

  return schedule;
}

export function cancelSchedule(id: string): void {
  writeAll(readAll().map((s) => (s.id === id ? { ...s, active: false } : s)));
}

export function removeSchedule(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

/** Active schedules whose next cycle is due — the donor is prompted to sign. */
export function dueSchedules(walletAddress: string, now: number = Date.now()): RecurringDonation[] {
  return listSchedules(walletAddress).filter((s) => s.active && s.nextRunAt <= now);
}

/** Record that a cycle was signed and settled, and roll the schedule forward. */
export function markCycleCompleted(id: string, now: number = Date.now()): void {
  writeAll(
    readAll().map((s) =>
      s.id === id
        ? {
            ...s,
            lastRunAt: now,
            nextRunAt: nextRunAfter(now, s.interval),
            cyclesCompleted: s.cyclesCompleted + 1,
          }
        : s
    )
  );
}
