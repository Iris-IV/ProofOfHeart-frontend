import * as StellarSdk from "@stellar/stellar-sdk";

import Api = StellarSdk.rpc.Api;

const USE_MOCKS =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

const CONTRIBUTION_MADE_TOPIC = "contribution_made";

let _server: StellarSdk.rpc.Server | null = null;

function getServer(): StellarSdk.rpc.Server {
  if (!_server) {
    _server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  }
  return _server;
}

/** Base64 XDR segment for Soroban event topic filters. */
export function scValToTopicSegment(value: StellarSdk.xdr.ScVal): string {
  return value.toXDR().toString("base64");
}

/** Topic filter for `("contribution_made", campaign_id, *)` contract events. */
export function contributionMadeTopicFilter(campaignId: number): string[][] {
  const eventSymbol = StellarSdk.nativeToScVal(CONTRIBUTION_MADE_TOPIC, { type: "symbol" });
  const campaignTopic = StellarSdk.nativeToScVal(campaignId, { type: "u32" });
  return [[scValToTopicSegment(eventSymbol), scValToTopicSegment(campaignTopic), "*"]];
}

export function isContributionMadeEvent(event: Api.EventResponse, campaignId: number): boolean {
  if (event.topic.length < 2) return false;
  const topicName = StellarSdk.scValToNative(event.topic[0]);
  const eventCampaignId = StellarSdk.scValToNative(event.topic[1]);
  return topicName === CONTRIBUTION_MADE_TOPIC && eventCampaignId === campaignId;
}

export function parseContributionAmount(event: Api.EventResponse): bigint {
  return StellarSdk.scValToBigInt(event.value);
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
  if (USE_MOCKS || !CONTRACT_ADDRESS) {
    return null;
  }

  const { campaignId, cursor, startLedger, limit = 100 } = options;
  const server = getServer();

  const filters: Api.EventFilter[] = [
    {
      type: "contract",
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
