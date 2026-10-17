# Mobile Responsiveness & Touch Target Guidelines

The standard every new or changed screen must meet on phones and tablets. The one-off audit that
brought the existing pages up to it is recorded in [MOBILE_AUDIT.md](./MOBILE_AUDIT.md); this
document is the rule set going forward.

- [Principles](#principles)
- [Viewport and breakpoints](#viewport-and-breakpoints)
- [Touch target size](#touch-target-size)
- [Layout patterns](#layout-patterns)
- [Gestures and hover](#gestures-and-hover)
- [Safe areas and fixed elements](#safe-areas-and-fixed-elements)
- [Text and forms](#text-and-forms)
- [Testing on mobile](#testing-on-mobile)
- [Review checklist](#review-checklist)

## Principles

1. **Mobile first.** Write the unprefixed utility for the smallest screen, then add `sm:`, `md:`,
   `lg:` overrides as space allows (`flex-col sm:flex-row`, not the other way round).
2. **No horizontal scroll** from 320 px upward. Wide content scrolls inside its own container.
3. **Every control is reachable with a thumb**: at least 44 × 44 CSS px, with space between targets.
4. **Nothing depends on hover.** Hover may enhance, never gate, an action.

## Viewport and breakpoints

The app uses Tailwind CSS v4 (`tailwindcss` / `@tailwindcss/postcss`) with its **default
breakpoints**; `src/app/globals.css` only extends colours and design tokens, it does not override
`--breakpoint-*`. Next.js emits the standard `width=device-width, initial-scale=1` viewport tag, so
no manual `<meta name="viewport">` is needed.

| Prefix   | Min width | Typical use here                                              |
| -------- | --------- | ------------------------------------------------------------- |
| _(none)_ | 0         | Phone portrait — the base styles                              |
| `sm:`    | 640 px    | Large phones / landscape; buttons go inline, badges appear    |
| `md:`    | 768 px    | Tablets; secondary navbar items (e.g. Mock Mode badge) appear |
| `lg:`    | 1024 px   | Laptops; multi-column layouts, large headings                 |
| `xl:`    | 1280 px   | Wide desktop                                                  |
| `2xl:`   | 1536 px   | Very wide desktop                                             |

Design and verify at **320, 375, 390 and 414 px** (the widths used in the audit), then 768 and 1280.

## Touch target size

Minimum interactive size is **44 × 44 CSS px** (WCAG 2.5.5 / Apple HIG). The codebase uses three
techniques; pick the one that fits the element.

**1. Give the element the size.** Used for buttons and links that are already visually large:

```tsx
<button className="min-h-[44px] w-full sm:w-auto px-4">Connect wallet</button>
```

**2. Keep the visual small, enlarge the hit area** with a pseudo-element. Used for icon-only controls
(see `Tooltip.tsx`, `FundingProgressBar.tsx`):

```tsx
<button
  className="relative touch-manipulation after:absolute after:left-1/2 after:top-1/2
             after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
>
  <InfoIcon className="size-4" />
</button>
```

**3. Pad the row** rather than the icon for list items and menu entries (`h-12 w-full` in the
mobile navbar menu).

Rules:

- Keep at least **8 px** between adjacent targets (`gap-2` or more) so a thumb does not hit both.
- Add `touch-manipulation` to frequently tapped controls to remove the double-tap-zoom delay.
- Inline text links inside paragraphs are exempt, but links in lists, footers and cards are not.
- Disabled controls keep their size; do not collapse them.

## Layout patterns

| Situation                                         | Pattern                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Row of controls that overflows at 320 px          | `flex flex-col sm:flex-row` (add `sm:items-center`); let form controls use `w-full sm:w-auto` |
| Filters (`label` + `select`)                      | Stack on mobile, `sm:flex-row sm:flex-wrap`; selects `flex-1`                                 |
| Large headings                                    | `text-4xl sm:text-5xl lg:text-7xl` — never a fixed large size                                 |
| Stat/number tiles                                 | `text-xl sm:text-2xl` and `truncate` so long values do not clip                               |
| Long unbroken strings (Stellar addresses, hashes) | `min-w-0 max-w-full break-all` or `truncate`                                                  |
| Cards                                             | Let height follow content; avoid `min-h-[…px]` that forces scrolling on small screens         |
| Wide tables                                       | Wrap in `overflow-x-auto`, or switch to stacked cards below `md`                              |
| Status badges that crowd the navbar               | `hidden sm:inline-flex` / `hidden md:inline-flex`                                             |

## Gestures and hover

The app does not implement custom swipe or pinch handlers; it relies on native scrolling and taps.
Keep it that way unless a feature clearly needs more:

- Every action reachable by a gesture must also be reachable by a visible button.
- Do not hijack vertical scroll or browser back/forward swipes.
- Do not block pinch-zoom (never set `user-scalable=no` or `maximum-scale=1`).
- Anything revealed on `:hover` (tooltips, menus, action buttons) needs a tap equivalent. `Tooltip`
  also toggles on tap (`onClick` pins it) and opens on focus; follow that component.
- Use `focus-visible:` rings for keyboard and switch users; they do not conflict with touch.

## Safe areas and fixed elements

Fixed or sticky UI must clear the notch and home indicator. `ToastProvider` is the reference:

```tsx
<div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1.25rem)] left-1/2 -translate-x-1/2
                w-full px-4 sm:w-auto sm:px-0 sm:left-auto sm:right-5 sm:translate-x-0">
```

- Use `env(safe-area-inset-*)` for anything pinned to a screen edge.
- Bottom-pinned bars must not cover form submit buttons or the toast area.
- Modals use `max-w-md w-full p-4` (as the onboarding tour does) and should scroll internally
  (`max-h-[…] overflow-y-auto`) so their actions stay reachable when the on-screen keyboard is open.

## Text and forms

- Body text at least 16 px. Inputs smaller than 16 px make iOS Safari zoom the page on focus.
- Use the right input type and `inputMode` (`inputMode="decimal"` for amounts, as `DonationModal` does) so the correct
  keyboard appears.
- Label every input; do not rely on placeholders.
- Place primary actions at the bottom of the form, full width on mobile (`w-full sm:w-auto`).
- Respect `prefers-reduced-motion` (see the `animate-blob` rule in `globals.css`).

## Testing on mobile

**Manual (required for UI changes)**

1. Run the app: `npm run dev`.
2. In browser dev tools open device mode and check 320, 375, 390 and 414 px in portrait; rotate to
   landscape once.
3. Confirm there is no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`).
4. Tap every control with the "touch" emulation on; confirm none is smaller than 44 px (inspect the
   computed box or the `::after` hit area).
5. Open the wallet flow with `NEXT_PUBLIC_USE_MOCKS=true` so you can exercise screens without a
   wallet extension (see [DEV_MOCK_PANEL.md](./DEV_MOCK_PANEL.md)).

**Automated.** `playwright.config.ts` currently defines desktop projects only (Chromium, plus
Firefox and WebKit on CI) with a 1280 × 720 viewport. To assert mobile behaviour in an e2e test, set
the viewport inside the test:

```ts
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

test("causes page has no horizontal overflow on a phone", async ({ page }) => {
  await page.goto("/causes");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
```

## Review checklist

- [ ] Base (unprefixed) styles work at 320 px; larger layouts are added with `sm:`/`md:`/`lg:`.
- [ ] No horizontal page scroll at 320, 375, 390 and 414 px.
- [ ] All interactive elements are ≥ 44 × 44 px with ≥ 8 px between them.
- [ ] Long addresses/hashes use `break-all`, `truncate` or `min-w-0`.
- [ ] Nothing important is available only on hover or only through a gesture.
- [ ] Fixed elements use `env(safe-area-inset-*)`.
- [ ] Inputs are ≥ 16 px with the right `type`/`inputmode`.
- [ ] Pinch-zoom is not disabled.
