import { Horizon } from '@stellar/stellar-sdk';

export async function getStellarBalance(publicKey: string): Promise<number> {
  const server = new Horizon.Server('https://horizon.stellar.org');
  const account = await server.loadAccount(publicKey);
  const xlmBalance = account.balances.find(
    (b: { asset_type: string; balance: string }) => b.asset_type === 'native'
  );
  return xlmBalance ? parseFloat(xlmBalance.balance) : 0;
}