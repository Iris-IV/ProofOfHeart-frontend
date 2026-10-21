import { act, render, screen, within } from "@testing-library/react";
import MultiSigProposalDashboard, {
  MultiSigStatusBadge,
} from "@/components/MultiSigProposalDashboard";
import { MultiSigAggregator } from "@/lib/multiSigAggregator";

const SIGNER_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SIGNER_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function setMatchMedia(matches: boolean) {
  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

describe("MultiSigStatusBadge", () => {
  it.each([
    ["awaiting", "statusAwaiting"],
    ["collecting", "statusCollecting"],
    ["ready", "statusReady"],
  ] as const)("labels the %s status", (status, label) => {
    render(<MultiSigStatusBadge status={status} />);
    expect(screen.getByTestId(`multisig-status-${status}`)).toHaveTextContent(label);
  });
});

describe("MultiSigProposalDashboard", () => {
  afterEach(() => setMatchMedia(false));

  it("shows the empty state when there are no proposals", () => {
    render(<MultiSigProposalDashboard aggregator={new MultiSigAggregator()} />);
    expect(screen.getByRole("heading", { name: "dashboardTitle" })).toBeInTheDocument();
    expect(screen.getByText("emptyTitle")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders a card per proposal with progress and an approval matrix", () => {
    const aggregator = new MultiSigAggregator();
    aggregator.initiateCampaignCancellation(4, 3);
    aggregator.addSignature(4, SIGNER_A, "eA==");

    render(<MultiSigProposalDashboard aggregator={aggregator} />);

    const card = screen.getByRole("article", { name: "campaign" });
    expect(within(card).getByTestId("multisig-status-collecting")).toBeInTheDocument();
    expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    expect(within(card).getAllByTestId("multisig-slot-signed")).toHaveLength(1);
    expect(within(card).getAllByTestId("multisig-slot-pending")).toHaveLength(2);
    expect(within(card).getByTitle(SIGNER_A)).toHaveTextContent("GAAAAA...AAAA");
    expect(within(card).getByText("remaining")).toBeInTheDocument();
  });

  it("updates live as signatures arrive and marks the threshold as met", () => {
    const aggregator = new MultiSigAggregator();
    aggregator.initiateCampaignCancellation(1, 1);
    render(<MultiSigProposalDashboard aggregator={aggregator} />);

    expect(screen.getByTestId("multisig-status-awaiting")).toBeInTheDocument();
    expect(screen.getByText("pendingCount_one")).toBeInTheDocument();

    act(() => {
      aggregator.addSignature(1, SIGNER_B, "eA==");
    });

    expect(screen.getByTestId("multisig-status-ready")).toBeInTheDocument();
    expect(screen.getByText("thresholdMet")).toBeInTheDocument();
    expect(screen.getByText("readyCount_one")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders without motion when the user prefers reduced motion", () => {
    setMatchMedia(true);
    const aggregator = new MultiSigAggregator();
    aggregator.initiateCampaignCancellation(2, 2);
    aggregator.initiateCampaignCancellation(3, 2);

    render(<MultiSigProposalDashboard aggregator={aggregator} className="custom" />);

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "dashboardTitle" })).toHaveClass("custom");
  });
});
