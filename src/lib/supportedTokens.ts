export type TokenSymbol = "USDC" | "XLM" | "AQUA" | "yXLM";

export interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  contractId: string | null;
  icon: string;
  enabled: boolean;
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
  { symbol: "USDC", name: "USD Coin", decimals: 7, contractId: null, icon: "💵", enabled: true },
  { symbol: "XLM", name: "Stellar Lumens", decimals: 7, contractId: null, icon: "⭐", enabled: true },
  { symbol: "AQUA", name: "Aqua", decimals: 7, contractId: null, icon: "🌊", enabled: true },
  { symbol: "yXLM", name: "Yield XLM", decimals: 7, contractId: null, icon: "🔥", enabled: false },
];

export function getEnabledTokens(): TokenConfig[] {
  return SUPPORTED_TOKENS.filter((t) => t.enabled);
}

export function getTokenBySymbol(symbol: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
}

export function formatTokenAmount(amount: number, symbol: TokenSymbol, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 7 }).format(amount) + " " + symbol;
}

export function isValidTokenAmount(value: string, decimals: number): boolean {
  const parts = value.split(".");
  if (parts.length > 2) return false;
  if (parts[1] && parts[1].length > decimals) return false;
  const n = parseFloat(value);
  return !isNaN(n) && isFinite(n) && n > 0;
}
