"use client";

import { useEffect, useState } from "react";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";

/**
 * Dev-only panel for switching mock campaign states at runtime.
 * Only visible in development with NEXT_PUBLIC_USE_MOCKS=true.
 * Never shipped in production.
 */
export function DevMockPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [scenarios, setScenarios] = useState<Record<string, string>>({});

  // Only render in mock mode
  if (!IS_MOCK_MODE) {
    return null;
  }

  // Only render in development
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleScenarioChange = (campaignId: string, scenario: string) => {
    setScenarios((prev) => ({
      ...prev,
      [campaignId]: scenario,
    }));

    // Store in sessionStorage for persistence across page reloads
    if (typeof window !== "undefined") {
      const stored = JSON.parse(sessionStorage.getItem("devMockScenarios") || "{}");
      stored[campaignId] = scenario;
      sessionStorage.setItem("devMockScenarios", JSON.stringify(stored));
    }

    // Dispatch custom event so other components can react
    window.dispatchEvent(
      new CustomEvent("devMockScenarioChanged", {
        detail: { campaignId, scenario },
      }),
    );
  };

  const handleReset = () => {
    setScenarios({});
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("devMockScenarios");
    }
    window.dispatchEvent(new CustomEvent("devMockScenariosReset"));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors"
        title="Dev Mock Panel (dev-only)"
      >
        {isOpen ? "✕" : "⚙️ Mock"}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Mock Campaign States</h3>
              <p className="text-xs text-gray-600 mb-3">
                Select scenarios to test different campaign states. Changes persist during session.
              </p>
            </div>

            {/* Campaign Scenarios */}
            <div className="space-y-3 border-t pt-3">
              {[1, 2, 3, 4, 5, 6].map((id) => (
                <div key={id}>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Campaign {id}
                  </label>
                  <select
                    value={scenarios[String(id)] || "default"}
                    onChange={(e) => handleScenarioChange(String(id), e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="default">Default</option>
                    <option value="active">Active</option>
                    <option value="verified">Verified</option>
                    <option value="funded">Funded</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="failed">Failed</option>
                    <option value="empty">Empty State</option>
                    <option value="error">Error State</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="border-t pt-3 flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 px-2 py-1 rounded text-xs font-medium transition-colors"
              >
                Reset All
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>

            {/* Info */}
            <div className="border-t pt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <p>
                <strong>Dev-only panel.</strong> Not visible in production. Scenarios are stored in
                sessionStorage.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
