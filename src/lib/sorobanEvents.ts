import * as StellarSdk from '@stellar/stellar-sdk';

type Api = StellarSdk.rpc.Api;

const USE_MOCKS =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  'https://soroban-testnet.stellar.org';

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';

const VOTE_CAST_TOPIC = 'campaign_vote_cast';

let _server: StellarSdk.rpc.Server | null = null;

function getServer(): StellarSdk.rpc.Server {
  if (!_server) {
    _server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  }
  return _server;
}

export function isEventStreamingAvailable(): boolean {
  return !USE_MOCKS && Boolean(CONTRACT_ADDRESS);
}

/** Base64 XDR segment for Soroban event topic filters. */
export function scValToTopicSegment(value: StellarSdk.xdr.ScVal): string {
  return value.toXDR().toString('base64');
}

/** Topic filter for `("campaign_vote_cast", campaign_id, *)` contract events. */
export function voteCastTopicFilter(campaignId: number): string[][] {
  const eventSymbol = StellarSdk.nativeToScVal(VOTE_CAST_TOPIC, { type: 'symbol' });
  const campaignTopic = StellarSdk.nativeToScVal(campaignId, { type: 'u32' });
  return [[scValToTopicSegment(eventSymbol), scValToTopicSegment(campaignTopic), '*']];
}

export function isVoteCastEvent(event: Api.EventResponse, campaignId: number): boolean {
  if (event.topic.length < 2) return false;
  const topicName = StellarSdk.scValToNative(event.topic[0]);
  const eventCampaignId = StellarSdk.scValToNative(event.topic[1]);
  return topicName === VOTE_CAST_TOPIC && eventCampaignId === campaignId;
}

export function parseVoteCastApprove(event: Api.EventResponse): boolean {
  return Boolean(StellarSdk.scValToNative(event.value));
}

const CONTRIBUTION_MADE_TOPIC = 'contribution_made';

/** Topic filter for `("contribution_made", campaign_id, *)` contract events. */
export function contributionMadeTopicFilter(campaignId: number): string[][] {
  const eventSymbol = StellarSdk.nativeToScVal(CONTRIBUTION_MADE_TOPIC, { type: 'symbol' });
  const campaignTopic = StellarSdk.nativeToScVal(campaignId, { type: 'u32' });
  return [[scValToTopicSegment(eventSymbol), scValToTopicSegment(campaignTopic), '*']];
}

export function isContributionMadeEvent(event: Api.EventResponse, campaignId: number): boolean {
  if (event.topic.length < 2) return false;
  const topicName = StellarSdk.scValToNative(event.topic[0]);
  const eventCampaignId = StellarSdk.scValToNative(event.topic[1]);
  return topicName === CONTRIBUTION_MADE_TOPIC && eventCampaignId === campaignId;
}

export function parseContributionAmount(event: Api.EventResponse): bigint {
  const val = event.value;
  if (val && typeof val === 'object' && '__bigint' in val) {
    return (val as { __bigint: bigint }).__bigint;
  }
  try {
    return BigInt(StellarSdk.scValToNative(val as never));
  } catch {
    return BigInt(0);
  }
}

export interface FetchContributionEventsResult {
  events: Api.EventResponse[];
  cursor: string;
  latestLedger: number;
}

export interface FetchContributionEventsOptions {
  campaignId: number;
  cursor?: string;
  startLedger?: number;
  limit?: number;
}

/**
 * Poll Soroban RPC for `contribution_made` events on the configured contract.
 * Returns an empty result when mocks are enabled or the contract is not configured.
 */
export async function fetchContributionMadeEvents(
  options: FetchContributionEventsOptions,
): Promise<FetchContributionEventsResult | null> {
  if (!isEventStreamingAvailable()) {
    return null;
  }

  const { campaignId, cursor, startLedger, limit = 100 } = options;
  const server = getServer();

  const filters: Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [CONTRACT_ADDRESS],
      topics: contributionMadeTopicFilter(campaignId),
    },
  ];

  const request: Api.GetEventsRequest = cursor
    ? { filters, cursor, limit }
    : {
        filters,
        startLedger: startLedger ?? (await server.getLatestLedger()).sequence - 1,
        limit,
      };

  const response = await server.getEvents(request);

  return {
    events: response.events.filter((event) => isContributionMadeEvent(event, campaignId)),
    cursor: response.cursor,
    latestLedger: response.latestLedger,
  };
}

export function sumContributionAmounts(events: Api.EventResponse[]): bigint {
  return events.reduce((total, event) => total + parseContributionAmount(event), BigInt(0));
}

export interface FetchVoteCastEventsResult {
  events: Api.EventResponse[];
  cursor: string;
  latestLedger: number;
}

export interface FetchVoteCastEventsOptions {
  campaignId: number;
  cursor?: string;
  startLedger?: number;
  limit?: number;
}

/**
 * Poll Soroban RPC for `campaign_vote_cast` events on the configured contract.
 */
export async function fetchVoteCastEvents(
  options: FetchVoteCastEventsOptions,
): Promise<FetchVoteCastEventsResult | null> {
  if (!isEventStreamingAvailable()) {
    return null;
  }

  const { campaignId, cursor, startLedger, limit = 100 } = options;
  const server = getServer();

  const filters: Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [CONTRACT_ADDRESS],
      topics: voteCastTopicFilter(campaignId),
    },
  ];

  const request: Api.GetEventsRequest = cursor
    ? { filters, cursor, limit }
    : {
        filters,
        startLedger: startLedger ?? (await server.getLatestLedger()).sequence - 1,
        limit,
      };

  const response = await server.getEvents(request);

  return {
    events: response.events.filter((event) => isVoteCastEvent(event, campaignId)),
    cursor: response.cursor,
    latestLedger: response.latestLedger,
  };
}
