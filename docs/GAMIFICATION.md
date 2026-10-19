# Gamification and Badge Reward Rules

How donor levels and badges are decided. The rules are pure functions: no React, no network, no storage, so every rule can be tested by calling it with numbers.

| Module                     | Used by                                     | Status                                                                                |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/lib/gamification.ts`  | `src/components/ContributorLeaderboard.tsx` | Live. Only the **level** is shown today; the badge list is computed but not rendered. |
| `src/lib/badges.ts` (#653) | Its own unit tests                          | Separate, older rule set. No component imports it yet.                                |

This guide covers `gamification.ts`. [Two rule sets](#two-rule-sets-gamificationts-and-badgests) explains how the two differ.

- [Inputs and outputs](#inputs-and-outputs)
- [Levels](#levels)
- [Badges](#badges)
- [Worked examples](#worked-examples)
- [Edge cases](#edge-cases)
- [Where it is used](#where-it-is-used)
- [Changing the rules](#changing-the-rules)
- [Two rule sets](#two-rule-sets-gamificationts-and-badgests)
- [Testing](#testing)

## Inputs and outputs

```ts
import { calculateGamificationProfile } from "@/lib/gamification";

const profile = calculateGamificationProfile(
  totalDonated, // number, in XLM (not stroops)
  donationCount, // number, default 0
  isEarlyBacker, // boolean, default false
);
```

`totalDonated` is a plain `number` of **XLM**. Contract amounts are stroops (`1 XLM = 10 000 000 stroops`), so convert first, as the leaderboard does:

```ts
const amountXlm = item.totalAmountStroops ? Number(item.totalAmountStroops) / 10_000_000 : 0;
const profile = calculateGamificationProfile(amountXlm);
```

The result is a `UserGamificationProfile`:

| Field                | Meaning                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `levelId`            | Tier name: `Bronze`, `Silver`, `Gold`, `Platinum` or `Diamond`.                      |
| `levelNumber`        | 1 to 5.                                                                              |
| `totalDonated`       | The input, returned unchanged (including negative values).                           |
| `donationCount`      | The input, returned unchanged.                                                       |
| `nextLevelThreshold` | XLM needed for the next tier. At Diamond there is no next tier, so it is `Infinity`. |
| `progressPercent`    | 0 to 100, rounded, progress from this tier's minimum towards the next tier.          |
| `badges`             | Four `Badge` objects, always in the same order, each with an `unlocked` flag.        |

## Levels

Defined by `LEVEL_THRESHOLDS`. A donor is in the highest tier whose `min` they have reached; `min` is inclusive.

| Level      | `levelNumber` | Total donated (XLM)  |
| ---------- | ------------- | -------------------- |
| `Bronze`   | 1             | 0 to under 100       |
| `Silver`   | 2             | 100 to under 500     |
| `Gold`     | 3             | 500 to under 2 000   |
| `Platinum` | 4             | 2 000 to under 5 000 |
| `Diamond`  | 5             | 5 000 or more        |

`progressPercent` is `round((totalDonated - min) / (nextMin - min) * 100)`, capped at 100 and floored at 0. At Diamond it is always 100.

## Badges

Badges are independent of the level. Each is `unlocked` when its condition holds; there is no stored state, so a badge can never be "lost" for a given input but is recomputed on every call.

| `id`             | Icon | Unlocked when                                         |
| ---------------- | ---- | ----------------------------------------------------- |
| `early_backer`   | 🌱   | `isEarlyBacker` is `true`, **or** `donationCount > 0` |
| `streak_master`  | 🔥   | `donationCount >= 3`                                  |
| `whale`          | 🐋   | `totalDonated >= 1000`                                |
| `heart_champion` | 💎   | `totalDonated >= 5000`                                |

Notes on the rules as written:

- `early_backer` unlocks for **any** donor with at least one donation, whatever the `isEarlyBacker` flag says. The flag only matters when `donationCount` is 0.
- `streak_master` counts donations, not consecutive days or months.
- `name` and `description` on each badge are **translation keys**, not display text. They resolve in the `Gamification` namespace of `messages/*.json` (for example `badge_whale_name`). `icon` is an emoji and `color` is a Tailwind class string.
- `unlockedAt` exists on the `Badge` type but is never set by this module.

## Worked examples

These outputs were produced by running the function.

| `totalDonated` | `donationCount` | `isEarlyBacker` | Level    | `nextLevelThreshold` | `progressPercent` | Unlocked badges                          |
| -------------- | --------------- | --------------- | -------- | -------------------- | ----------------- | ---------------------------------------- |
| 0              | 0               | false           | Bronze   | 100                  | 0                 | none                                     |
| 100            | 1               | false           | Silver   | 500                  | 0                 | `early_backer`                           |
| 750            | 3               | false           | Gold     | 2000                 | 17                | `early_backer`, `streak_master`          |
| 1000           | 2               | false           | Gold     | 2000                 | 33                | `early_backer`, `whale`                  |
| 4999           | 5               | true            | Platinum | 5000                 | 100               | `early_backer`, `streak_master`, `whale` |
| 5000           | 9               | false           | Diamond  | `Infinity`           | 100               | all four                                 |

## Edge cases

- **Zero and negative totals** stay on Bronze with 0 % progress. A negative `totalDonated` is returned as given, and `whale` and `heart_champion` stay locked. Callers should not pass negatives.
- **Progress rounds up near a boundary.** 99.99 XLM is still Bronze but reports `progressPercent: 100`, because `99.99 / 100` rounds to 100.
- **Diamond has no ceiling.** `nextLevelThreshold` is `Infinity`; do not render it directly or `JSON.stringify` it (it becomes `null`).
- **Floating point.** Totals are JavaScript numbers. Converting very large stroop amounts with `Number(...)` loses precision above 2^53 stroops (about 900 million XLM), far beyond realistic totals.
- **Badge order is fixed**: `early_backer`, `streak_master`, `whale`, `heart_champion`. UI can rely on index order, but should prefer `id`.

## Where it is used

`ContributorLeaderboard` calls `calculateGamificationProfile(amountXlm)` for each row and shows `t("Gamification.level_<levelId>")` next to the contributor. It passes no donation count, so the badge list there reflects the amount-based badges only. Nothing renders `profile.badges` or `progressPercent` yet.

## Changing the rules

1. **A new level**: add a row to `LEVEL_THRESHOLDS` in ascending order, keep `levelNumber` consecutive and make each `max` equal to the next tier's `min`. Add `level_<levelId>` to every file in `messages/`.
2. **A new badge**: append an object to the `badges` array in `calculateGamificationProfile` with a unique `id`, `name` and `description` translation keys, an `icon`, a `color` class and an `unlocked` expression. Add `badge_<id>_name` and `badge_<id>_desc` to every file in `messages/`, then run `npm run i18n:check`.
3. **Add a test** for each boundary: the value just below, at and above the threshold.

## Two rule sets: `gamification.ts` and `badges.ts`

`src/lib/badges.ts` (#653) defines a different system: badge ids `first-donation`, `early-backer`, `whale`, `streak` and `multi-cause`, computed from a list of `DonationRecord`s in **stroops** (with a donation's `backerRank` for "among the first 10 backers"), and its own `DonorLevel` list. The two share names (`Badge`, `whale`, "early backer") but not rules; for example `badges.ts` awards `early-backer` for being one of the first 10 backers of a campaign, while `gamification.ts` awards it to anyone with a donation. Pick one before building profile UI, and do not mix their types.

## Testing

`src/__tests__/lib/gamification.test.ts` covers the tier boundaries (0, 99, 100, 500, 2000, 5000) and the zero and negative cases.

```bash
npx jest src/__tests__/lib/gamification.test.ts
```
