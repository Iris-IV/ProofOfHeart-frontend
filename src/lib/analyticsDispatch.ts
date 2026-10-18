import { trackWebVital, type WebVitalMetric } from "@/lib/analytics";

export type WebVitalRating = "good" | "needs-improvement" | "poor";

/** Core Web Vitals SLA target thresholds (milliseconds / score) */
export const WEB_VITALS_THRESHOLDS: Record<WebVitalMetric["name"], { good: number; needsImprovement: number }> = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

/** Determine rating based on Web Vitals metric SLA targets */
export function rateWebVital(name: WebVitalMetric["name"], value: number): WebVitalRating {
  const threshold = WEB_VITALS_THRESHOLDS[name];
  if (!threshold) return "good";
  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/** Web Vitals Analytics Dispatcher Pipeline */
export function analyticsDispatch(eventName: string, payload: Record<string, unknown>): void {
  if (eventName === "web_vital" && payload.name && typeof payload.value === "number") {
    const metricName = payload.name as WebVitalMetric["name"];
    const value = payload.value;
    const rating = payload.rating ? (payload.rating as WebVitalRating) : rateWebVital(metricName, value);

    trackWebVital({
      name: metricName,
      value,
      rating,
      id: payload.id as string | undefined,
      navigationType: payload.navigationType as string | undefined,
    });
    return;
  }

  // Fallback for general analytics dispatch events
  if (process.env.NODE_ENV === "development") {
    console.log("[AnalyticsDispatch]", eventName, payload);
  }
}
