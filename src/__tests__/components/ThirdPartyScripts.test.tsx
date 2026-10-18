/**
 * #657 — ThirdPartyScripts mounts configured scripts through `next/script`.
 *
 * `next/script` is mocked to capture the props the component wires, letting
 * tests drive `onError` the way the real script loader would. The registry
 * module is mocked so each case can supply its own script configuration
 * without reloading modules; `handleScriptError` stays real, so the wiring the
 * component applies to it is exercised end to end.
 */
import { render, waitFor } from "@testing-library/react";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";

const mockGetAnalyticsScript = jest.fn();
const mockGetThirdPartyScripts = jest.fn();

jest.mock("@/lib/thirdParty", () => ({
  ...jest.requireActual("@/lib/thirdParty"),
  getAnalyticsScript: () => mockGetAnalyticsScript(),
  getThirdPartyScripts: () => mockGetThirdPartyScripts(),
}));

interface MockScriptProps {
  id: string;
  onError?: () => void;
}

const mockScriptProps: MockScriptProps[] = [];

jest.mock("next/script", () => ({
  __esModule: true,
  default: function MockScript({ id, onError }: MockScriptProps) {
    mockScriptProps.push({ id, onError });
    return <script id={id} data-testid={`script-${id}`} />;
  },
}));

const ANALYTICS_SCRIPT = {
  id: "analytics-plausible",
  src: "https://plausible.io/js/script.js",
  strategy: "afterInteractive" as const,
  attributes: { "data-domain": "proofofheart.xyz" },
};

describe("ThirdPartyScripts", () => {
  beforeEach(() => {
    mockScriptProps.length = 0;
    mockGetAnalyticsScript.mockReset();
    mockGetThirdPartyScripts.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders nothing when no scripts are configured", () => {
    mockGetAnalyticsScript.mockReturnValue(null);
    mockGetThirdPartyScripts.mockReturnValue([]);

    const { container } = render(<ThirdPartyScripts />);
    expect(container.firstChild).toBeNull();
  });

  it("fires a configured onError when a rendered script errors", async () => {
    const onError = jest.fn();
    mockGetAnalyticsScript.mockReturnValue(ANALYTICS_SCRIPT);
    mockGetThirdPartyScripts.mockReturnValue([{ ...ANALYTICS_SCRIPT, onError }]);

    render(<ThirdPartyScripts />);

    // Consent is granted in an effect, so the Script mounts one commit later.
    await waitFor(() => expect(mockScriptProps.length).toBe(1));

    const script = mockScriptProps[0];
    expect(script.id).toBe(ANALYTICS_SCRIPT.id);
    expect(typeof script.onError).toBe("function");

    // Fire the error as next/script would on a failed load.
    script.onError?.();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("warns instead of failing silently when a script has no onError", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockGetAnalyticsScript.mockReturnValue(ANALYTICS_SCRIPT);
    mockGetThirdPartyScripts.mockReturnValue([ANALYTICS_SCRIPT]);

    render(<ThirdPartyScripts />);

    await waitFor(() => expect(mockScriptProps.length).toBe(1));
    mockScriptProps[0].onError?.();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(ANALYTICS_SCRIPT.id));
  });
});
