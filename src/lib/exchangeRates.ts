import { z } from "zod";

/** Quotes are informational only; contract amounts always remain in stroops. */
export const exchangeRatesSchema = z.object({
  usd: z.number().finite().positive(),
  eur: z.number().finite().positive(),
  last_updated_at: z.number().int().positive(),
});

export type ExchangeRates = z.infer<typeof exchangeRatesSchema>;
export type DisplayCurrency = "XLM" | "USD" | "EUR";

export function hasFreshRates(rates: ExchangeRates, now = Date.now()): boolean {
  const age = now - rates.last_updated_at * 1000;
  return age >= -60_000 && age <= 10 * 60_000;
}
