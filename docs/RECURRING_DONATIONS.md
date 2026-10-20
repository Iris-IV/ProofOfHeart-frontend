# Recurring Donation Subscriptions

How "donate monthly" works in ProofOfHeart, and what it does not do. Source: `src/lib/recurringDonations.ts`, used by `src/components/DonationModal.tsx`.

- [What a schedule is](#what-a-schedule-is)
- [Lifecycle](#lifecycle)
- [Data model](#data-model)
- [Interval arithmetic](#interval-arithmetic)
- [API](#api)
- [How the donation modal uses it](#how-the-donation-modal-uses-it)
- [Current limitations](#current-limitations)
- [Extending it](#extending-it)

## What a schedule is

The escrow contract has no subscription primitive and cannot pull funds from a wallet. So a recurring donation is an **off-chain reminder**: the browser remembers the donor's intent (campaign, amount, interval) and, once a cycle is due, the donor is asked to sign that cycle's donation like any other. **No funds move without an explicit signature, and nothing runs in the background.**

Schedules are stored in the browser's `localStorage` under `poh_recurring_donations`, so they are **per device and per browser profile**. They do not follow the wallet to another device and are lost if site data is cleared.

## Lifecycle

```text
Donor ticks "recurring" in the donation modal and signs cycle 1
        │  (transaction settles)
        ▼
createSchedule()  →  cyclesCompleted = 1, lastRunAt = now,
                     nextRunAt = now + 1 interval, active = true
        │
        │  time passes
        ▼
dueSchedules(wallet)  →  active && nextRunAt <= now   (donor is prompted)
        │  donor signs the next donation
        ▼
markCycleCompleted(id)  →  lastRunAt = now, nextRunAt = now + 1 interval,
                           cyclesCompleted + 1
        │
        ▼
cancelSchedule(id)  →  active = false (kept for history)
removeSchedule(id)  →  entry deleted
```

The donation that creates a schedule counts as cycle 1, so the next prompt is one full interval away, not immediately.

## Data model

```ts
interface RecurringDonation {
  id: string; // `${walletAddress}-${campaignId}-${createdAt}`
  walletAddress: string;
  campaignId: number;
  campaignTitle: string; // snapshot, so the reminder reads well offline
  amountStroops: string; // per cycle; string so JSON round-trips a bigint
  interval: "monthly" | "quarterly";
  createdAt: number; // Unix ms
  nextRunAt: number; // Unix ms
  lastRunAt: number | null; // Unix ms
  cyclesCompleted: number;
  active: boolean;
}
```

Amounts are stroops (`1 XLM = 10 000 000`). Convert with `BigInt(schedule.amountStroops)`; never parse it as a `number`.

| `interval`  | `INTERVAL_MONTHS` | `INTERVAL_LABELS` |
| ----------- | ----------------- | ----------------- |
| `monthly`   | 1                 | Monthly           |
| `quarterly` | 3                 | Every 3 months    |

## Interval arithmetic

`addMonths(timestampMs, months)` adds whole calendar months in **UTC** and clamps to the last day of the target month. `nextRunAfter(from, interval)` is `addMonths(from, INTERVAL_MONTHS[interval])`.

| Start (UTC)      | Interval  | Next run (UTC)   |
| ---------------- | --------- | ---------------- |
| 2026-01-31 10:00 | monthly   | 2026-02-28 10:00 |
| 2024-01-31 10:00 | monthly   | 2024-02-29 10:00 |
| 2026-03-31 00:00 | monthly   | 2026-04-30 00:00 |
| 2026-11-30 00:00 | 3 months  | 2027-02-28 00:00 |
| 2026-12-15 00:00 | quarterly | 2027-03-15 00:00 |

The next run is always computed from the time the previous cycle was **completed** (`markCycleCompleted` uses `now`), not from the original anniversary. A donor who pays a week late shifts every later cycle by that week, and a schedule that was clamped (Jan 31 → Feb 28) does not return to the 31st.

## API

All functions are synchronous and safe during server rendering: with no `window` they return empty results and write nothing.

| Function                                                                                      | Behaviour                                                                                                 |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `createSchedule({ walletAddress, campaignId, campaignTitle, amountStroops, interval, now? })` | Creates the schedule and returns it. **Replaces** any existing schedule for the same wallet and campaign. |
| `listSchedules(walletAddress)`                                                                | Every schedule for that wallet, active or not.                                                            |
| `dueSchedules(walletAddress, now?)`                                                           | Active schedules with `nextRunAt <= now`.                                                                 |
| `markCycleCompleted(id, now?)`                                                                | Records a settled cycle and rolls `nextRunAt` forward. Does nothing for an unknown id.                    |
| `cancelSchedule(id)`                                                                          | Sets `active: false`; the entry stays in storage.                                                         |
| `removeSchedule(id)`                                                                          | Deletes the entry.                                                                                        |

`now` defaults to `Date.now()`; pass it in tests to avoid fake timers.

Storage failures (quota exceeded, blocked storage, corrupt JSON) are swallowed on purpose: a lost reminder must never block a donation. Reads fall back to an empty list.

## How the donation modal uses it

`DonationModal` shows an opt-in checkbox with a monthly/quarterly select. After the contribution transaction settles, and only then, it calls `createSchedule(...)`, so a failed donation never leaves a schedule behind. The confirmation step then tells the donor a reminder is set.

```ts
createSchedule({
  walletAddress: publicKey,
  campaignId: campaign.id,
  campaignTitle: campaign.title,
  amountStroops: stroops, // bigint
  interval: recurringInterval, // "monthly" | "quarterly"
});
```

## Current limitations

- **Reminders are not shown yet.** The modal is the only caller of this module, and it only uses `createSchedule`. Nothing in the app calls `dueSchedules`, `listSchedules`, `markCycleCompleted` or `cancelSchedule`, so a due schedule does not prompt anyone and there is no screen to view or cancel schedules. Those functions are the intended hooks for that UI.
- **Nothing executes off-chain.** There is no server, cron job or service worker. "Off-chain execution" here means the reminder lives off-chain; the donor's wallet still signs every cycle.
- **One schedule per wallet and campaign.** Creating a second replaces the first, including its cycle count.
- **No validation on read.** Stored JSON is trusted to have the `RecurringDonation` shape. Treat it as user-editable and validate before relying on a field for anything that matters.
- **Per-device.** See [What a schedule is](#what-a-schedule-is).

## Extending it

1. To show reminders, read `dueSchedules(publicKey)` in a client component after the wallet connects and re-run it when the tab becomes visible; open the donation modal pre-filled with `campaignId` and `BigInt(amountStroops)`.
2. After that donation settles, call `markCycleCompleted(schedule.id)`.
3. Offer `cancelSchedule` next to each listed schedule.
4. If schedules must follow the wallet across devices, they need a server-side store; this module deliberately has none.
