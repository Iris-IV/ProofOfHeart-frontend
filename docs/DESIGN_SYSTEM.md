# ProofOfHeart Design System

The UI was built screen by screen, so the same button existed in a dozen
near-identical forms — six blues, four radii, three focus treatments, and touch
targets that shrank whenever a component was written in a hurry. This document
defines the tokens and primitives that replace those ad-hoc strings.

Two layers, both in this repo — no Figma round-trip is required to use them:

1. **Tokens** — `src/app/globals.css`, in Tailwind v4 `@theme` blocks.
2. **Primitives** — `src/components/ui`, importable from `@/components/ui`.

## Tokens

Tokens are named for **intent**, never for colour. `bg-brand` survives a
rebrand; `bg-blue-600` does not.

### Colour

| Token                                      | Intent                                 |
| ------------------------------------------ | -------------------------------------- |
| `brand`, `brand-strong`, `brand-subtle`    | Primary action, its hover, its wash    |
| `accent`, `accent-strong`, `accent-subtle` | Secondary brand (campaign creation)    |
| `success`, `success-strong`                | Completed, funded, verified            |
| `warning`, `warning-strong`                | Needs attention, pending, degraded     |
| `danger`, `danger-strong`                  | Destructive action, validation failure |
| `info`, `info-strong`                      | Neutral information                    |
| `muted`, `muted-strong`                    | De-emphasised text (pre-existing)      |

Each maps to a Tailwind palette step, so `bg-brand`, `text-brand`,
`border-brand` and `ring-brand` all work.

### Radius

| Token             | Value   | Applies to      |
| ----------------- | ------- | --------------- |
| `rounded-control` | 0.75rem | Buttons, inputs |
| `rounded-surface` | 1rem    | Cards, panels   |

### Motion

`--duration-fast` (150ms) for state changes such as hover and focus;
`--duration-base` (300ms) for entrances and layout shifts. Used as
`duration-(--duration-fast)`. Anything decorative must respect
`motion-reduce:`.

### Utilities

- `tap-target` — 44px minimum height (WCAG 2.5.5). Every interactive primitive
  applies it, so touch targets stop being hand-tuned per screen.
- `focus-ring` — the single keyboard-focus treatment, visible in both themes.
  Use it instead of writing `focus:ring-*` by hand; it is `focus-visible`
  based, so mouse users do not get a ring.

## Primitives

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Textarea,
  Tabs,
  TabPanel,
} from "@/components/ui";
```

### `Button`

Variants are intents: `primary`, `secondary`, `ghost`, `danger`, `success`.
Sizes: `sm`, `md`, `lg`.

```tsx
<Button variant="primary" isLoading={isSubmitting} loadingLabel="Posting…">
  Post Update
</Button>
```

`isLoading` disables the button, sets `aria-busy`, and swaps the label in place
rather than replacing the node — the button keeps its width, so a layout does
not jump mid-transaction.

### `Card`

The standard surface. Replaces the repeated
`bg-white dark:bg-zinc-800 rounded-xl shadow-sm border …` string.
`padding` is `none | sm | md | lg`; `interactive` adds a hover lift and belongs
only on cards that are themselves a link or button.

### `Badge`

Status pill with a `tone` per intent. A "pending" state should be `warning` on
every screen so the meaning stays readable.

### `Input` / `Textarea`

Label, hint and error in one component, with `aria-invalid`,
`aria-describedby` and `role="alert"` wired up. An error is always announced
instead of being a red string beside an unassociated control.

### `Tabs` / `TabPanel`

Implements the WAI-ARIA tabs pattern: roving `tabindex`, arrow-key navigation
with wraparound, Home/End, and `aria-controls` / `aria-labelledby` linking each
tab to its panel.

```tsx
<Tabs tabs={TABS} activeId={active} onChange={setActive}
      label="Campaign sections" idPrefix="campaign" />
<TabPanel tabId="updates" idPrefix="campaign" active={active === "updates"}>
  <UpdatesSection campaign={campaign} />
</TabPanel>
```

`idPrefix` must be unique per tablist on a page — it is how the tab and its
panel derive matching element ids. An inactive `TabPanel` renders nothing, so
panels that fetch (comments, updates) stay unmounted until opened.

## Rules

1. **Reach for a primitive first.** A new bespoke button or card needs a reason.
2. **Use intent tokens, not palette steps,** in anything shared.
3. **Never hand-roll focus.** `focus-ring` exists so the ring is identical and
   always visible in dark mode.
4. **Interactive means `tap-target`.** 44px minimum, no exceptions for "small"
   controls.
5. **Extend, don't fork.** A missing variant belongs in the primitive, not in a
   one-off `className` in a page.
6. **Every primitive works in both themes.** Dark mode is not a later pass.

## Adoption

The kit ships alongside the existing components rather than replacing them in
one sweep — a repo-wide restyle would be unreviewable. Migrated so far:

- Dashboard tabs → `Tabs` / `TabPanel`
- Campaign updates / Q&A tabs → `Tabs` / `TabPanel`
- Update composer actions → `Button`
- Dashboard withdrawal cards → `Card`

The remaining screens should migrate opportunistically: when you touch a
component, swap its bespoke button, card or field for the primitive.

`src/stories/UIKit.stories.tsx` renders every variant side by side — run
`npm run storybook` to review them together.
