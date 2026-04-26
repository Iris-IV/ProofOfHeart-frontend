import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction, getAddress } from '@stellar/freighter-api';
import { Campaign, CampaignStatus, Category } from '../types';
import { parseContractError } from '../utils/contractErrors';
import { appendWalletTransaction } from './transactionLog';

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const USE_MOCKS =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  'https://soroban-testnet.stellar.org';

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  process.env.NEXT_PUBLIC_CONTRACT_ID ??
  '';

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

// ---------------------------------------------------------------------------
// Soroban RPC server (lazily initialised)
// ---------------------------------------------------------------------------

let _server: StellarSdk.rpc.Server | null = null;

function getServer(): StellarSdk.rpc.Server {
  if (!_server) {
    _server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  }
  return _server;
}

// ---------------------------------------------------------------------------
// Helpers — transaction building & submission
// ---------------------------------------------------------------------------

async function buildAndSubmitTransaction(
  sourcePublicKey: string,
  contractOp: StellarSdk.xdr.Operation,
): Promise<StellarSdk.rpc.Api.GetSuccessfulTransactionResponse> {
  const server = getServer();
  const sourceAccount = await server.getAccount(sourcePublicKey);

  const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  txBuilder.addOperation(contractOp);
  txBuilder.setTimeout(300);

  const builtTx = txBuilder.build();
  const simulated = await server.simulateTransaction(builtTx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error ?? 'Transaction simulation failed.');
  }

  const preparedTx = StellarSdk.rpc.assembleTransaction(
    builtTx,
    simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse,
  ).build();

  const { signedTxXdr } = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE,
  ) as StellarSdk.Transaction;

  const submissionResult = await server.sendTransaction(signedTx);

  if (submissionResult.status === 'ERROR') {
    throw new Error('Transaction submission failed.');
  }

  let getResult = await server.getTransaction(submissionResult.hash);
  while (getResult.status === 'NOT_FOUND') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    getResult = await server.getTransaction(submissionResult.hash);
  }

  if (getResult.status === 'FAILED') {
    throw new Error('Transaction failed on-chain.');
  }

  return getResult as StellarSdk.rpc.Api.GetSuccessfulTransactionResponse;
}

async function invokeViewMethod(
  method: string,
  args: StellarSdk.xdr.ScVal[] = [],
): Promise<StellarSdk.xdr.ScVal | null> {
  const server = getServer();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);

  const zeroKeyPair = StellarSdk.Keypair.random();
  const zeroAccount = new StellarSdk.Account(zeroKeyPair.publicKey(), '0');

  const txBuilder = new StellarSdk.TransactionBuilder(zeroAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  txBuilder.addOperation(contract.call(method, ...args));
  txBuilder.setTimeout(30);

  const tx = txBuilder.build();
  const simulated = await server.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error ?? `View call ${method} failed.`);
  }

  const successSim = simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
  return successSim.result?.retval ?? null;
}

// ---------------------------------------------------------------------------
// XDR ↔ TypeScript decoders
// ---------------------------------------------------------------------------

function decodeCampaign(val: StellarSdk.xdr.ScVal): Campaign {
  const map = val.map();
  if (!map) throw new Error('Expected ScVal map for Campaign.');

  const fields: Record<string, StellarSdk.xdr.ScVal> = {};
  for (const entry of map) {
    const key = entry.key().sym().toString();
    fields[key] = entry.val();
  }

  return {
    id: fields['id'].u32(),
    creator: StellarSdk.Address.fromScVal(fields['creator']).toString(),
    title: fields['title'].str().toString(),
    description: fields['description'].str().toString(),
    funding_goal: StellarSdk.scValToBigInt(fields['funding_goal']),
    deadline: Number(fields['deadline'].u64()),
    amount_raised: StellarSdk.scValToBigInt(fields['amount_raised']),
    is_active: fields['is_active'].b(),
    status: fields['status'].str().toString() as CampaignStatus,
    created_at: Number(fields['created_at'].u64()),
    funds_withdrawn: fields['funds_withdrawn'].b(),
    is_cancelled: fields['is_cancelled'].b(),
    is_verified: fields['is_verified'].b(),
    category: fields['category'].u32() as Category,
    has_revenue_sharing: fields['has_revenue_sharing'].b(),
    revenue_share_percentage: fields['revenue_share_percentage'].u32(),
  };
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 1,
    title: 'Clean Water for Rural Communities',
    description:
      'Providing clean water access to 500 families in rural areas affected by drought.',
    creator: 'GABC123456789012345678901234567890123456789012345678901234567890',
    funding_goal: BigInt(100_000_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400 * 30,
    status: 'active',
    amount_raised: BigInt(65_000_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Learner,
    has_revenue_sharing: false,
    created_at: Math.floor(Date.now() / 1000),
    revenue_share_percentage: 0,
  },
  {
    id: 2,
    title: 'Education Technology for Underprivileged Children',
    description:
      'Equipping schools in low-income areas with tablets and educational software.',
    creator: 'GDEF123456789012345678901234567890123456789012345678901234567890',
    funding_goal: BigInt(50_000_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400 * 60,
    amount_raised: BigInt(12_000_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    status: 'active',
    created_at: Math.floor(Date.now() / 1000),
    category: Category.EducationalStartup,
    has_revenue_sharing: true,
    revenue_share_percentage: 500,
  },
  {
    id: 3,
    title: 'Medical Supplies for Remote Clinics',
    description:
      'Delivering essential medical supplies to clinics in remote areas.',
    creator: 'GHIJ123456789012345678901234567890123456789012345678901234567890',
    funding_goal: BigInt(150_000_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400 * 15,
    amount_raised: BigInt(89_000_000_000),
    is_active: true,
    status: 'active',
    created_at: Math.floor(Date.now() / 1000),
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  },
  {
    id: 4,
    title: 'Reforestation of Degraded Lands',
    description: 'Planting 100,000 trees across deforested regions.',
    creator: 'GKLM123456789012345678901234567890123456789012345678901234567890',
    funding_goal: BigInt(80_000_000_000),
    deadline: Math.floor(Date.now() / 1000) - 86400 * 5,
    amount_raised: BigInt(32_000_000_000),
    is_active: false,
    funds_withdrawn: false,
    is_cancelled: false,
    status: 'active',
    created_at: Math.floor(Date.now() / 1000),
    is_verified: true,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  },
  {
    id: 5,
    title: 'Mental Health Support for Youth',
    description: 'Building free counselling centres for teenagers in underserved areas.',
    creator: 'GNOP123456789012345678901234567890123456789012345678901234567890',
    funding_goal: BigInt(60_000_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400 * 45,
    amount_raised: BigInt(9_000_000_000),
    is_active: true,
    status: 'active',
    created_at: Math.floor(Date.now() / 1000),
    funds_withdrawn: false,
    is_cancelled: true,
    is_verified: false,
    category: Category.Publisher,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  },
  {
    id: 6,
    title: 'Solar Energy for Off-Grid Villages',
    description: 'Installing solar panels in 20 villages without electricity.',
    creator: 'GQRS123456789012345678901234567890123456789012345678901234567890',
    funding_goal: BigInt(200_000_000_000),
    deadline: Math.floor(Date.now() / 1000) - 86400 * 2,
    amount_raised: BigInt(200_000_000_000),
    is_active: false,
    status: 'active',
    created_at: Math.floor(Date.now() / 1000),
    funds_withdrawn: true,
    is_cancelled: false,
    is_verified: true,
    category: Category.EducationalStartup,
    has_revenue_sharing: true,
    revenue_share_percentage: 300,
  },
];

// ---------------------------------------------------------------------------
// Public API — Read (view) functions
// ---------------------------------------------------------------------------

export async function getCampaignCount(): Promise<number> {
  if (USE_MOCKS) return MOCK_CAMPAIGNS.length;
  try {
    const result = await invokeViewMethod('get_campaign_count');
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  if (USE_MOCKS) return MOCK_CAMPAIGNS.find((c) => c.id === id) ?? null;
  try {
    const result = await invokeViewMethod('get_campaign', [
      StellarSdk.nativeToScVal(id, { type: 'u32' }),
    ]);
    if (!result) return null;
    return decodeCampaign(result);
  } catch (err) {
    const msg = parseContractError(err);
    if (msg.includes('not be found')) return null;
    throw new Error(msg);
  }
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  if (USE_MOCKS) return [...MOCK_CAMPAIGNS];
  try {
    const count = await getCampaignCount();
    const results = await Promise.all(
      Array.from({ length: count }, (_, i) => getCampaign(i + 1)),
    );
    return results.filter((c): c is Campaign => c !== null);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getContribution(
  campaignId: number,
  contributor: string,
): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod('get_contribution', [
      StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
      new StellarSdk.Address(contributor).toScVal(),
    ]);
    if (!result) return BigInt(0);
    return StellarSdk.scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getRevenuePool(campaignId: number): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod('get_revenue_pool', [
      StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    ]);
    if (!result) return BigInt(0);
    return StellarSdk.scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getRevenueClaimed(
  campaignId: number,
  contributor: string,
): Promise<bigint> {
  if (USE_MOCKS) return BigInt(0);
  try {
    const result = await invokeViewMethod('get_revenue_claimed', [
      StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
      new StellarSdk.Address(contributor).toScVal(),
    ]);
    if (!result) return BigInt(0);
    return StellarSdk.scValToBigInt(result);
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getAdmin(): Promise<string> {
  if (USE_MOCKS) return 'GADMIN123456789012345678901234567890123456789012345678901234567890';
  try {
    const result = await invokeViewMethod('get_admin');
    if (!result) return '';
    return StellarSdk.Address.fromScVal(result).toString();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Fetches the platform fee in basis points.
 */
export async function getPlatformFee(): Promise<number> {
  if (USE_MOCKS) return 250;

  try {
    const result = await invokeViewMethod('get_platform_fee');
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// Public API — Write (mutate) functions
// ---------------------------------------------------------------------------

export async function init(
  admin: string,
  token: string,
  platformFee: number,
): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_init';
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'init',
    new StellarSdk.Address(admin).toScVal(),
    new StellarSdk.Address(token).toScVal(),
    StellarSdk.nativeToScVal(platformFee, { type: 'u32' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(admin, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function createCampaign(
  creator: string,
  title: string,
  description: string,
  fundingGoal: bigint,
  durationDays: number,
  category: Category,
  hasRevenueSharing: boolean,
  revenueSharePercentage: number,
): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_create_campaign';
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'create_campaign',
    new StellarSdk.Address(creator).toScVal(),
    StellarSdk.nativeToScVal(title, { type: 'string' }),
    StellarSdk.nativeToScVal(description, { type: 'string' }),
    StellarSdk.nativeToScVal(fundingGoal, { type: 'i128' }),
    StellarSdk.nativeToScVal(durationDays, { type: 'u64' }),
    StellarSdk.nativeToScVal(category, { type: 'u32' }),
    StellarSdk.nativeToScVal(hasRevenueSharing, { type: 'bool' }),
    StellarSdk.nativeToScVal(revenueSharePercentage, { type: 'u32' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(creator, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function contribute(
  campaignId: number,
  contributor: string,
  amount: bigint,
): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_contribute';
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'contribute',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    new StellarSdk.Address(contributor).toScVal(),
    StellarSdk.nativeToScVal(amount, { type: 'i128' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op);
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: 'contribute',
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function withdrawFunds(campaignId: number): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_withdraw_funds';
  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'withdraw_funds',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Cancel a campaign (creator only).
 * Returns the transaction hash on success.
 */
export async function cancelCampaign(campaignId: number): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_cancel_campaign';
  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'cancel_campaign',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Claim a refund from a cancelled or failed campaign.
 * Returns the transaction hash on success.
 */
export async function claimRefund(
  campaignId: number,
  contributor: string,
): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_claim_refund';
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'claim_refund',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    new StellarSdk.Address(contributor).toScVal(),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op);
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: 'claim_refund',
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function depositRevenue(
  campaignId: number,
  amount: bigint,
): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_deposit_revenue';
  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'deposit_revenue',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    StellarSdk.nativeToScVal(amount, { type: 'i128' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function claimRevenue(
  campaignId: number,
  contributor: string,
): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_claim_revenue';
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'claim_revenue',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    new StellarSdk.Address(contributor).toScVal(),
  );
  try {
    const txResult = await buildAndSubmitTransaction(contributor, op);
    appendWalletTransaction({
      walletAddress: contributor,
      campaignId,
      action: 'claim_revenue',
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function verifyCampaign(campaignId: number): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_verify_campaign';
  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'verify_campaign',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}


/**
 * Update the platform fee (admin only).
 */
export async function updatePlatformFee(platformFee: number): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_update_platform_fee';

  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'update_platform_fee',
    StellarSdk.nativeToScVal(platformFee, { type: 'u32' }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Transfer the admin role to a new address (admin only).
 */
export async function updateAdmin(newAdmin: string): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_update_admin';

  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'update_admin',
    new StellarSdk.Address(newAdmin).toScVal(),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

// ---------------------------------------------------------------------------
// Voting functions — wired to real contract
// ---------------------------------------------------------------------------

export async function getApproveVotes(campaignId: number): Promise<number> {
  if (USE_MOCKS) return 0;
  try {
    const result = await invokeViewMethod('get_approve_votes', [
      StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    ]);
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getRejectVotes(campaignId: number): Promise<number> {
  if (USE_MOCKS) return 0;
  try {
    const result = await invokeViewMethod('get_reject_votes', [
      StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    ]);
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function hasVoted(campaignId: number, voter: string): Promise<boolean> {
  if (USE_MOCKS) return false;
  try {
    const result = await invokeViewMethod('has_voted', [
      StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
      new StellarSdk.Address(voter).toScVal(),
    ]);
    if (!result) return false;
    return result.b();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getMinVotesQuorum(): Promise<number> {
  if (USE_MOCKS) return 10;
  try {
    const result = await invokeViewMethod('get_min_votes_quorum');
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function getApprovalThresholdBps(): Promise<number> {
  if (USE_MOCKS) return 5000;
  try {
    const result = await invokeViewMethod('get_approval_threshold_bps');
    if (!result) return 0;
    return result.u32();
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Cast a vote on a campaign via Freighter wallet.
 * approve = true → upvote, approve = false → downvote.
 */
export async function voteOnCampaign(
  campaignId: number,
  voter: string,
  approve: boolean,
): Promise<string> {
  if (USE_MOCKS) return `mock_tx_vote_${campaignId}_${approve ? 'approve' : 'reject'}`;
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'vote_on_campaign',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
    new StellarSdk.Address(voter).toScVal(),
    StellarSdk.nativeToScVal(approve, { type: 'bool' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(voter, op);
    appendWalletTransaction({
      walletAddress: voter,
      campaignId,
      action: 'vote',
      txHash: txResult.txHash,
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

/**
 * Trigger on-chain campaign verification using accumulated votes.
 * Can be called by anyone once quorum + threshold are met.
 */
export async function verifyCampaignWithVotes(campaignId: number): Promise<string> {
  if (USE_MOCKS) return 'mock_tx_verify_with_votes';
  const { address: callerAddress } = await getAddress();
  const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    'verify_campaign_with_votes',
    StellarSdk.nativeToScVal(campaignId, { type: 'u32' }),
  );
  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op);
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}
