import { contributorSharePercentage, contributorShareBps } from './RevenueSharingPanel';

describe('contributorSharePercentage', () => {
  it('formats ordinary shares', () => {
    expect(contributorSharePercentage(1n, 3n)).toBe('33.33%');
    expect(contributorSharePercentage(50n, 100n)).toBe('50.00%');
    expect(contributorSharePercentage(100n, 100n)).toBe('100.00%');
  });

  it('stays exact above 2^53 stroops', () => {
    const raised = 2n ** 61n;
    expect(contributorSharePercentage(2n ** 60n, raised)).toBe('50.00%');
    expect(contributorShareBps(2n ** 60n, raised)).toBe(5000n);
  });

  type Amount = bigint | string | number;

function toBigInt(value: Amount): bigint {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.trunc(value));
    return BigInt(value.trim() === '' ? '0' : value.trim());
  } catch {
    return 0n; // malformed input: treat as zero rather than crash the panel
  }
}

/** Share in basis points (1 bp = 0.01%), rounded half up. Pure bigint math. */
export function contributorShareBps(contribution: Amount, amountRaised: Amount): bigint {
  const c = toBigInt(contribution);
  const a = toBigInt(amountRaised);
  if (a <= 0n || c <= 0n) return 0n;
  // round(c * 10000 / a) using integer arithmetic
  return (c * 20000n + a) / (2n * a);
}

/** Formatted percentage, e.g. "33.33%". Shows "<0.01%" for a nonzero share below 0.005%. */
export function contributorSharePercentage(contribution: Amount, amountRaised: Amount): string {
  const c = toBigInt(contribution);
  const bps = contributorShareBps(contribution, amountRaised);
  if (bps === 0n && c > 0n && toBigInt(amountRaised) > 0n) return '<0.01%';
  const whole = bps / 100n;
  const frac = (bps % 100n).toString().padStart(2, '0');
  return `${whole}.${frac}%`;
}

  it('does not show 0.00% for a nonzero share of a huge campaign', () => {
    expect(contributorSharePercentage(1n, 10n ** 18n)).toBe('<0.01%');
  });

  it('accepts string inputs from the contract layer', () => {
    expect(contributorSharePercentage('25000000', '100000000')).toBe('25.00%');
  });

  it('handles zero and invalid values safely', () => {
    expect(contributorSharePercentage(0n, 100n)).toBe('0.00%');
    expect(contributorSharePercentage(5n, 0n)).toBe('0.00%');
    expect(contributorSharePercentage('abc', '100')).toBe('0.00%');
  });
});
