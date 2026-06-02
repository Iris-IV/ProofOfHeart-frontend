import { Horizon } from "@stellar/stellar-sdk";

export function getStellarNetworkKey(): string {
  const passphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
  return passphrase.toLowerCase().includes("test") ? "testnet" : "mainnet";
}

function getHorizonServerUrl(): string {
  return getStellarNetworkKey() === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
}

export async function getStellarBalance(publicKey: string): Promise<number> {
  const server = new Horizon.Server(getHorizonServerUrl());
  const account = await server.loadAccount(publicKey);
  const xlmBalance = account.balances.find(
    (b: { asset_type: string; balance: string }) => b.asset_type === "native",
  );
  return xlmBalance ? parseFloat(xlmBalance.balance) : 0;
}
