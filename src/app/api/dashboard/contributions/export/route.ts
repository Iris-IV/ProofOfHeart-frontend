import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getCampaign } from "@/lib/contractClient";
import { deriveStatus, Campaign } from "@/types";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { escapeCsvCell, formatCsvDate } from "@/utils/exportCsv";
import { scValToTopicSegment, parseContributionAmount } from "@/lib/sorobanEvents";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";

// Allow each address/IP at most 5 CSV exports per minute to prevent amplification abuse.
const exportRateLimiter = createRateLimiter(60_000, 5);

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    // Rate-limit by wallet address, falling back to client IP.
    const rlKey = rateLimitKeyFromRequest(req, address);
    if (!exportRateLimiter.check(rlKey)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before exporting again." },
        { status: 429 },
      );
    }

    if (!CONTRACT_ADDRESS) {
      return NextResponse.json({ error: "Contract address not configured" }, { status: 500 });
    }

    const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

    const contributionSymbol = StellarSdk.nativeToScVal("contribution_made", { type: "symbol" });
    const claimRefundSymbol = StellarSdk.nativeToScVal("claim_refund", { type: "symbol" });
    const addressVal = StellarSdk.nativeToScVal(address, { type: "address" });
    const addressTopic = scValToTopicSegment(addressVal);

    const filters = [
      {
        type: "contract" as const,
        contractIds: [CONTRACT_ADDRESS],
        topics: [[scValToTopicSegment(contributionSymbol), "*", addressTopic]],
      },
      {
        type: "contract" as const,
        contractIds: [CONTRACT_ADDRESS],
        topics: [[scValToTopicSegment(claimRefundSymbol), "*", addressTopic]],
      },
    ];

    let allEvents: StellarSdk.rpc.Api.EventResponse[] = [];
    let cursor: string | undefined = undefined;

    // Start from ledger 1 so the export covers the full on-chain history,
    // matching what the dashboard already shows via useContributions.
    const startLedger = 1;

    // Fetch events with pagination
    do {
      const request: StellarSdk.rpc.Api.GetEventsRequest = cursor
        ? { filters, cursor, limit: 100 }
        : { filters, startLedger, limit: 100 };

      try {
        const response = await server.getEvents(request);
        if (response.events && response.events.length > 0) {
          allEvents = allEvents.concat(response.events);
        }
        if (response.events.length === 0 || !response.cursor) {
          break;
        }
        cursor = response.cursor;
      } catch (err) {
        console.error("Error fetching events", err);
        break; // Stop fetching on error, process what we have
      }
    } while (cursor);

    // Group events and fetch campaign info
    const campaignIds = new Set<number>();
    allEvents.forEach((event) => {
      try {
        const campaignId = StellarSdk.scValToNative(event.topic[1]);
        if (typeof campaignId === "number" || typeof campaignId === "bigint") {
          campaignIds.add(Number(campaignId));
        }
      } catch {
        // ignore invalid topics
      }
    });

    const campaignsMap = new Map<number, Campaign>();
    await Promise.all(
      Array.from(campaignIds).map(async (id) => {
        try {
          const campaign = await getCampaign(id);
          if (campaign) {
            campaignsMap.set(id, campaign);
          }
        } catch {
          // Campaign might not exist or failed to load
        }
      }),
    );

    const headers = [
      "Date",
      "Campaign Name",
      "Campaign ID",
      "Amount Contributed (XLM)",
      "Transaction Hash",
      "Current Status",
    ];

    const rows: string[][] = [];

    allEvents.forEach((event) => {
      try {
        const topicName = StellarSdk.scValToNative(event.topic[0]);
        const campaignId = Number(StellarSdk.scValToNative(event.topic[1]));
        const campaign = campaignsMap.get(campaignId);

        if (!campaign) return; // Skip if campaign data couldn't be loaded

        const status = deriveStatus(campaign);
        let amountBigInt = parseContributionAmount(event);

        // If it's a refund event, make the amount negative to represent returned funds
        if (topicName === "claim_refund") {
          amountBigInt = -amountBigInt;
        }

        const amountXlm = stroopsToXlmNumber(amountBigInt);
        const amountStr = amountXlm.toFixed(7).replace(/\.?0+$/, "");

        // Use ledgerClosedAt if available, otherwise just use current date as fallback
        const dateStr = event.ledgerClosedAt
          ? formatCsvDate(new Date(event.ledgerClosedAt).getTime())
          : formatCsvDate(Date.now());

        rows.push([
          dateStr,
          campaign.title,
          campaignId.toString(),
          amountStr,
          event.txHash,
          status,
        ]);
      } catch {
        // Skip malformed events
      }
    });

    const csvLines = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ];

    const csvContent = csvLines.join("\r\n");

    const dateStr = new Date().toISOString().slice(0, 10);
    const truncatedWallet = `${address.slice(0, 6)}_${address.slice(-4)}`;
    const filename = `contributions_${truncatedWallet}_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    return NextResponse.json({ error: "Failed to export contributions" }, { status: 500 });
  }
}
