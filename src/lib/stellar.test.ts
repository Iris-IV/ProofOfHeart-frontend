import { normalizeAddress, isSameAddress } from './stellar';

describe('Stellar Address Utilities', () => {
  describe('normalizeAddress', () => {
    it('should convert mixed-case addresses to uppercase', () => {
      const addr = 'gdqwpn6p6v6x5w7k5e7p5z2r5z2r5z2r5z2r5z2r5z2r5z2r5z2r';
      expect(normalizeAddress(addr)).toBe(addr.toUpperCase());
    });

    it('should trim whitespace from addresses', () => {
      const addr = '  GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R  ';
      expect(normalizeAddress(addr)).toBe('GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R');
    });

    it('should handle null or undefined gracefully', () => {
      expect(normalizeAddress(null)).toBe('');
      expect(normalizeAddress(undefined)).toBe('');
    });
  });

  describe('isSameAddress', () => {
    it('should return true for identical addresses', () => {
      const addr = 'GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R';
      expect(isSameAddress(addr, addr)).toBe(true);
    });

    it('should return true for addresses with different casing', () => {
      const addrUpper = 'GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R';
      const addrLower = 'gdqwpn6p6v6x5w7k5e7p5z2r5z2r5z2r5z2r5z2r5z2r5z2r5z2r';
      expect(isSameAddress(addrUpper, addrLower)).toBe(true);
    });

    it('should return true for addresses with extra whitespace', () => {
      const addr1 = 'GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R';
      const addr2 = '  GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R  ';
      expect(isSameAddress(addr1, addr2)).toBe(true);
    });

    it('should return false for different addresses', () => {
      const addr1 = 'GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R';
      const addr2 = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      expect(isSameAddress(addr1, addr2)).toBe(false);
    });

    it('should return false if one address is null/undefined', () => {
      const addr = 'GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R';
      expect(isSameAddress(addr, null)).toBe(false);
      expect(isSameAddress(undefined, addr)).toBe(false);
    });
  });
});
