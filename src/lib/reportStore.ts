import { CampaignReport } from "./campaignReports";

/**
 * Server-side in-memory report store.
 * In production, replace with a real database adapter.
 *
 * Data retention policy: reports persist for the server process lifetime.
 * Reporter privacy: only the on-chain wallet address is stored; no other PII.
 */
export const reportStore: CampaignReport[] = [];
