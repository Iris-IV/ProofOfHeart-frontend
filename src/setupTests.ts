import "@testing-library/jest-dom";

// Global mock for Freighter API
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn(),
  isAllowed: jest.fn(),
  getAddress: jest.fn(),
}));
