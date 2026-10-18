import type { CampaignReport } from "./campaignReports";
import { getKeyValueStore, type KeyValueStore } from "./persistentStore";

/**
 * Persistence boundary for campaign abuse reports (#1682).
 *
 * Replaces the process-local `reportStore` array so reports survive a restart
 * and are shared across instances.
 */
export interface ReportRepository {
  list(status?: CampaignReport["status"]): Promise<CampaignReport[]>;
  find(reportId: string): Promise<CampaignReport | null>;
  hasReporter(campaignId: number, reporterAddress: string): Promise<boolean>;
  add(report: CampaignReport): Promise<CampaignReport>;
  markReviewed(reportId: string): Promise<CampaignReport | null>;
}

const REPORTS_KEY = "reports";

/** Repository over any `KeyValueStore`. */
export class KeyValueReportRepository implements ReportRepository {
  constructor(private readonly store: KeyValueStore) {}

  async list(status?: CampaignReport["status"]): Promise<CampaignReport[]> {
    const reports = (await this.store.get<CampaignReport[]>(REPORTS_KEY)) ?? [];
    const filtered = status ? reports.filter((report) => report.status === status) : reports;
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }

  async find(reportId: string): Promise<CampaignReport | null> {
    const reports = (await this.store.get<CampaignReport[]>(REPORTS_KEY)) ?? [];
    return reports.find((report) => report.id === reportId) ?? null;
  }

  async hasReporter(campaignId: number, reporterAddress: string): Promise<boolean> {
    const reports = (await this.store.get<CampaignReport[]>(REPORTS_KEY)) ?? [];
    return reports.some(
      (report) =>
        report.campaignId === campaignId && report.reporterAddress === reporterAddress,
    );
  }

  async add(report: CampaignReport): Promise<CampaignReport> {
    const reports = (await this.store.get<CampaignReport[]>(REPORTS_KEY)) ?? [];
    await this.store.set(REPORTS_KEY, [...reports, report]);
    return report;
  }

  async markReviewed(reportId: string): Promise<CampaignReport | null> {
    const reports = (await this.store.get<CampaignReport[]>(REPORTS_KEY)) ?? [];
    const index = reports.findIndex((report) => report.id === reportId);
    if (index === -1) return null;

    const updated: CampaignReport = { ...reports[index], status: "reviewed" };
    reports[index] = updated;
    await this.store.set(REPORTS_KEY, reports);
    return updated;
  }
}

let cachedRepository: ReportRepository | null = null;

/** Resolve the process-wide report repository. */
export function getReportRepository(): ReportRepository {
  if (!cachedRepository) {
    cachedRepository = new KeyValueReportRepository(getKeyValueStore());
  }
  return cachedRepository;
}

/** Reset the cached repository so tests can swap the underlying store. */
export function resetReportRepositoryForTests(): void {
  cachedRepository = null;
}
