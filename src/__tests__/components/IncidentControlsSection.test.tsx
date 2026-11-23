import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IncidentControlsSection from "@/components/admin/IncidentControlsSection";
import { useWallet } from "@/components/WalletContext";
import {
  emergencyPausePlatform,
  getEmergencyPauseSigners,
  getPlatformStatus,
  pausePlatform,
  resumeCampaign,
  unpausePlatform,
} from "@/lib/contractClient";

const showError = jest.fn();
const showSuccess = jest.fn();

jest.mock("@/components/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showError, showSuccess, showWarning: jest.fn() }),
}));
jest.mock("@/lib/contractClient", () => ({
  emergencyPausePlatform: jest.fn(),
  getEmergencyPauseSigners: jest.fn(),
  getPlatformStatus: jest.fn(),
  pausePlatform: jest.fn(),
  resumeCampaign: jest.fn(),
  unpausePlatform: jest.fn(),
}));

const ADMIN = "GADMIN111111111111111111111111111111111111111111111111111";
const mockWallet = useWallet as jest.Mock;

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IncidentControlsSection />
    </QueryClientProvider>,
  );
}

describe("IncidentControlsSection", () => {
  beforeEach(() => {
    mockWallet.mockReturnValue({ publicKey: ADMIN });
    (getPlatformStatus as jest.Mock).mockResolvedValue({
      isPaused: false,
      isCreationDisabled: false,
    });
    (getEmergencyPauseSigners as jest.Mock).mockResolvedValue([ADMIN]);
  });
  afterEach(() => jest.clearAllMocks());

  it("shows the current state and the emergency signers", async () => {
    renderSection();
    expect(await screen.findByText("incident.stateActive")).toBeInTheDocument();
    expect(await screen.findByText(ADMIN)).toBeInTheDocument();
  });

  it("requires confirmation before pausing", async () => {
    (pausePlatform as jest.Mock).mockResolvedValue("hash");
    renderSection();
    await screen.findByText("incident.stateActive");
    fireEvent.click(screen.getByRole("button", { name: "incident.pause" }));
    expect(pausePlatform).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "incident.confirm" }));
    await waitFor(() => expect(pausePlatform).toHaveBeenCalledWith(ADMIN, expect.any(Object)));
    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
  });

  it("offers unpause when paused and emergency pause only to signers", async () => {
    (getPlatformStatus as jest.Mock).mockResolvedValue({
      isPaused: true,
      isCreationDisabled: false,
    });
    (unpausePlatform as jest.Mock).mockResolvedValue("hash");
    renderSection();
    await screen.findByText("incident.statePaused");
    expect(screen.getByRole("button", { name: "incident.pause" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "incident.unpause" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "incident.emergencyPause" })).toBeDisabled();
  });

  it("disables emergency pause for wallets that are not signers", async () => {
    (getEmergencyPauseSigners as jest.Mock).mockResolvedValue([]);
    renderSection();
    await screen.findByText("incident.noSigners");
    expect(screen.getByRole("button", { name: "incident.emergencyPause" })).toBeDisabled();
    expect(emergencyPausePlatform).not.toHaveBeenCalled();
  });

  it("surfaces contract errors and resumes a campaign by id", async () => {
    (resumeCampaign as jest.Mock).mockRejectedValueOnce(new Error("ContractErrors.NotAuthorized"));
    renderSection();
    await screen.findByText("incident.stateActive");
    fireEvent.change(screen.getByLabelText("incident.resumeLabel"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "incident.resume" }));
    fireEvent.click(await screen.findByRole("button", { name: "incident.confirm" }));
    await waitFor(() => expect(resumeCampaign).toHaveBeenCalledWith(12, ADMIN, expect.any(Object)));
    await waitFor(() => expect(showError).toHaveBeenCalledWith("NotAuthorized"));
  });
});
