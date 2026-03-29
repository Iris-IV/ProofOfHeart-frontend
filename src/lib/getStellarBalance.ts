import Server from 'stellar-sdk';

export async function getStellarBalance(publicKey: string): Promise<number> {
  const server = new Server('https://horizon.stellar.org');
  const account = await server.loadAccount(publicKey);
  const xlmBalance = account.balances.find((b: any) => b.asset_type === 'native');
  return xlmBalance ? parseFloat(xlmBalance.balance) : 0;
}
