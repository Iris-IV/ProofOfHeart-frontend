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
