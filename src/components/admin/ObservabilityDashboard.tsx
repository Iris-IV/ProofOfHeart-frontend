'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ObservabilityMetricsSnapshot } from '@/lib/observability/types';

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default function ObservabilityDashboard() {
  const t = useTranslations("Observability");
  const [metrics, setMetrics] = useState<ObservabilityMetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/observability/metrics');
      if (!response.ok) {
        throw new Error(t("metricsRequestFailed", { status: response.status }));
      }
      const data = (await response.json()) as ObservabilityMetricsSnapshot;
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  if (isLoading && !metrics) {
    return <p className="text-sm text-zinc-500">{t("loading")}</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  const { rates, counters, alerts, recentEvents } = metrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("healthTitle")}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("healthSubtitle", { minutes: Math.round(rates.windowMs / 60_000), time: new Date(metrics.updatedAt).toLocaleTimeString() })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {t("refresh")}
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border px-4 py-3 text-sm ${
                alert.severity === 'critical'
                  ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100'
                  : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
              }`}
            >
              <p className="font-medium">{alert.message}</p>
              <p className="mt-1 text-xs opacity-80">
                {alert.metric}: {formatRate(alert.currentRate)} (threshold {formatRate(alert.threshold)})
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("simulationFailures"), value: formatRate(rates.simulationFailureRate) },
          { label: t("submissionFailures"), value: formatRate(rates.submissionFailureRate) },
          { label: t("rpcTimeouts"), value: formatRate(rates.rpcTimeoutRate) },
          { label: t("contractErrors"), value: formatRate(rates.contractErrorRate) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{t("failuresByKind")}</h3>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            {Object.entries(counters.byKind).map(([kind, count]) => (
              <li key={kind} className="flex justify-between gap-4">
                <span>{kind}</span>
                <span className="font-mono">{count}</span>
              </li>
            ))}
            {Object.keys(counters.byKind).length === 0 && (
              <li className="text-zinc-400">{t("noEventsInWindow")}</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{t("contractErrorCodes")}</h3>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            {Object.entries(counters.byContractErrorCode).map(([code, count]) => (
              <li key={code} className="flex justify-between gap-4">
                <span>#{code}</span>
                <span className="font-mono">{count}</span>
              </li>
            ))}
            {Object.keys(counters.byContractErrorCode).length === 0 && (
              <li className="text-zinc-400">{t("noContractErrors")}</li>
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{t("recentEvents")}</h3>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {recentEvents.map((event) => (
            <pre
              key={event.id}
              className="rounded bg-zinc-50 p-2 text-xs text-zinc-700 overflow-x-auto dark:bg-zinc-900 dark:text-zinc-300"
            >
              {JSON.stringify(event)}
            </pre>
          ))}
          {recentEvents.length === 0 && (
            <p className="text-sm text-zinc-400">{t("noRecentEvents")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
