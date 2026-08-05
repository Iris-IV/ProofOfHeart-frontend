import { useEffect, useState } from "react";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";

export type MockScenario =
  | "default"
  | "active"
  | "verified"
  | "funded"
  | "cancelled"
  | "failed"
  | "empty"
  | "error";

/**
 * Hook to get the current mock scenario for a campaign.
 * Only works in mock mode (NEXT_PUBLIC_USE_MOCKS=true).
 *
 * Usage:
 * ```tsx
 * const scenario = useDevMockScenario(campaignId);
 * if (scenario === 'error') {
 *   return <ErrorState />;
 * }
 * ```
 */
export function useDevMockScenario(campaignId: number): MockScenario {
  const [scenario, setScenario] = useState<MockScenario>("default");

  useEffect(() => {
    if (!IS_MOCK_MODE) return;

    // Load from sessionStorage
    const stored = JSON.parse(sessionStorage.getItem("devMockScenarios") || "{}");
    const campaignScenario = stored[String(campaignId)] || "default";
    setScenario(campaignScenario);

    // Listen for changes from DevMockPanel
    const handleScenarioChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.campaignId === String(campaignId)) {
        setScenario(customEvent.detail.scenario);
      }
    };

    const handleReset = () => {
      setScenario("default");
    };

    window.addEventListener("devMockScenarioChanged", handleScenarioChange);
    window.addEventListener("devMockScenariosReset", handleReset);

    return () => {
      window.removeEventListener("devMockScenarioChanged", handleScenarioChange);
      window.removeEventListener("devMockScenariosReset", handleReset);
    };
  }, [campaignId]);

  return scenario;
}
