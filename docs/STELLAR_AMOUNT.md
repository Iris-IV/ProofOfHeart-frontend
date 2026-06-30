# Stellar amount formatting

All XLM ↔ stroops conversion and display formatting lives in two modules:

| Module                | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `@/lib/stellarAmount` | Bigint-safe conversion (`stroopsToXlm`, `xlmToStroops`, `STROOPS_PER_XLM`) |
| `@/lib/formatters`    | Locale-aware display (`formatAmount` for stroops → formatted XLM string)   |

## Conversion (contract / validation)

```ts
import { xlmToStroops, stroopsToXlm, STROOPS_PER_XLM } from "@/lib/stellarAmount";

const stroops = xlmToStroops("12.5"); // 125_000_000n
const xlm = stroopsToXlm(stroops); // "12.5"
```

Use `stroopsToXlmNumber` only when you need a `number` for math/charts and values stay within safe IEEE range.

## Display (UI)

```tsx
import { useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";

const locale = useLocale();
formatAmount(campaign.amount_raised, locale, { maximumFractionDigits: 2 });
```

Pass `locale` from `useLocale()` in client components. For non-UI helpers (e.g. env-based fee strings), use a fixed locale such as `"en"`.

## Do not

- Duplicate `10_000_000` conversion logic in components.
- Import amount helpers from `@/types` (types are for domain models only).
