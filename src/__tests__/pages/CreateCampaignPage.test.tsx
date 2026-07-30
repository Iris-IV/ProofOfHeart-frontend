import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateCampaignPage from "@/app/[locale]/causes/new/page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
    showWarning: jest.fn(),
  }),
}));

const mockConnectWallet = jest.fn();
let mockWalletState = {
  publicKey: null as string | null,
  isWalletConnected: false,
  connectWallet: mockConnectWallet,
  isLoading: false,
};

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => mockWalletState,
}));

const mockCreateCampaign = jest.fn();
const mockGetCampaignCount = jest.fn();

jest.mock("@/lib/contractClient", () => ({
  createCampaign: (...args: unknown[]) => mockCreateCampaign(...args),
  getCampaignCount: () => mockGetCampaignCount(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PUBKEY = "GABCDE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234";

function setWalletConnected(pubkey = TEST_PUBKEY) {
  mockWalletState = {
    publicKey: pubkey,
    isWalletConnected: true,
    connectWallet: mockConnectWallet,
    isLoading: false,
  };
}

function setWalletDisconnected() {
  mockWalletState = {
    publicKey: null,
    isWalletConnected: false,
    connectWallet: mockConnectWallet,
    isLoading: false,
  };
}

async function fillRequiredFields({
  title = "My Test Campaign",
  description = "A detailed description of the campaign that explains everything.",
  fundingGoal = "1000",
  durationDays = "30",
} = {}) {
  await userEvent.type(screen.getByLabelText(/labelTitle/i), title);
  await userEvent.type(screen.getByLabelText(/labelDescription/i), description);
  await userEvent.type(screen.getByLabelText(/labelFundingGoal/i), fundingGoal);
  await userEvent.type(screen.getByLabelText(/labelDuration/i), durationDays);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  setWalletDisconnected();
  mockCreateCampaign.mockResolvedValue("mock_tx_hash");
  mockGetCampaignCount.mockResolvedValue(7);
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("CreateCampaignPage — rendering", () => {
  it("renders the page heading", () => {
    render(<CreateCampaignPage />);
    expect(screen.getByRole("heading", { name: "pageTitle" })).toBeInTheDocument();
  });

  it("renders all required form fields", () => {
    render(<CreateCampaignPage />);
    expect(screen.getByLabelText(/labelTitle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/labelDescription/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/labelFundingGoal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/labelDuration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/labelCategory/i)).toBeInTheDocument();
  });

  it('renders the "Launch Campaign" submit button', () => {
    render(<CreateCampaignPage />);
    expect(screen.getByRole("button", { name: /launchCampaign/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wallet guard
// ---------------------------------------------------------------------------

describe("CreateCampaignPage — wallet guard", () => {
  it("shows the wallet guard banner when wallet is not connected", () => {
    render(<CreateCampaignPage />);
    expect(screen.getByText("walletGuard")).toBeInTheDocument();
  });

  it("disables the submit button when wallet is not connected", () => {
    render(<CreateCampaignPage />);
    expect(screen.getByRole("button", { name: /launchCampaign/i })).toBeDisabled();
  });

  it("does not show the wallet guard banner when wallet is connected", () => {
    setWalletConnected();
    render(<CreateCampaignPage />);
    expect(screen.queryByText("walletRequiredError")).not.toBeInTheDocument();
  });

  it('calls connectWallet when the "Connect Wallet" button in the banner is clicked', async () => {
    setWalletDisconnected();
    render(<CreateCampaignPage />);
    const connectBtn = screen.getByRole("button", { name: "connectWallet" });
    await userEvent.click(connectBtn);
    expect(mockConnectWallet).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast if submit is triggered without a wallet (edge case)", async () => {
    // wallet disconnected but form submission attempted programmatically
    setWalletDisconnected();
    render(<CreateCampaignPage />);
    fireEvent.submit(screen.getByRole("button", { name: /launchCampaign/i }).closest("form")!);
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching("walletRequiredError"),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("CreateCampaignPage — client-side validation", () => {
  beforeEach(() => setWalletConnected());

  it("shows a title error when the field is empty", async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(await screen.findByText("validationTitleRequired")).toBeInTheDocument();
  });

  it("links field errors to inputs with aria-describedby and aria-invalid", async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));

    const titleInput = screen.getByLabelText(/labelTitle/i);
    const descriptionInput = screen.getByLabelText(/labelDescription/i);
    const fundingGoalInput = screen.getByLabelText(/labelFundingGoal/i);
    const durationInput = screen.getByLabelText(/labelDuration/i);

    expect(titleInput).toHaveAttribute("aria-invalid", "true");
    expect(titleInput).toHaveAttribute("aria-describedby", "title-error");
    expect(descriptionInput).toHaveAttribute("aria-invalid", "true");
    expect(descriptionInput).toHaveAttribute("aria-describedby", "description-error");
    expect(fundingGoalInput).toHaveAttribute("aria-invalid", "true");
    expect(fundingGoalInput).toHaveAttribute("aria-describedby", "funding-goal-error");
    expect(durationInput).toHaveAttribute("aria-invalid", "true");
    expect(durationInput).toHaveAttribute("aria-describedby", "duration-days-error");
  });

  it("shows a title error when title exceeds 100 characters", async () => {
    render(<CreateCampaignPage />);
    // fireEvent.change bypasses the maxLength DOM attribute so we can test the JS validator
    fireEvent.change(screen.getByLabelText(/labelTitle/i), {
      target: { value: "A".repeat(101) },
    });
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(await screen.findByText("validationTitleTooLong")).toBeInTheDocument();
  });

  it("shows a description error when the field is empty", async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/labelTitle/i), "Valid Title");
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(await screen.findByText("validationDescriptionRequired")).toBeInTheDocument();
  });

  it("shows a description error when description exceeds 1000 characters", async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/labelTitle/i), "Valid Title");
    fireEvent.change(screen.getByLabelText(/labelDescription/i), {
      target: { value: "B".repeat(1001) },
    });
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(await screen.findByText("validationDescriptionTooLong")).toBeInTheDocument();
  });

  it("shows a funding goal error when value is 0 or empty", async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/labelTitle/i), "Valid Title");
    await userEvent.type(
      screen.getByLabelText(/labelDescription/i),
      "A valid description for this campaign.",
    );
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(await screen.findByText("validationFundingGoalInvalid")).toBeInTheDocument();
  });

  it("shows a duration error when value is outside 1–365", async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/labelTitle/i), "Valid Title");
    await userEvent.type(
      screen.getByLabelText(/labelDescription/i),
      "A valid description for this campaign.",
    );
    await userEvent.type(screen.getByLabelText(/labelFundingGoal/i), "1000");
    await userEvent.type(screen.getByLabelText(/labelDuration/i), "400");
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(await screen.findByText("validationDurationInvalid")).toBeInTheDocument();
  });

  it("does not call createCampaign when there are validation errors", async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Category & Revenue Sharing
// ---------------------------------------------------------------------------

describe("CreateCampaignPage — revenue sharing", () => {
  beforeEach(() => setWalletConnected());

  it("does NOT show the revenue sharing section for non-startup categories", () => {
    render(<CreateCampaignPage />);
    // Default is Learner
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it('shows the revenue sharing section when "Educational Startup" is selected', async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1"); // EducationalStartup = 1
    expect(screen.getByRole("switch", { name: /revenueSharingAriaLabel/i })).toBeInTheDocument();
  });

  it("hides the slider when the revenue sharing toggle is off", async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1");
    // Toggle is off by default
    expect(screen.queryByLabelText(/labelRevenueSharePct/i)).not.toBeInTheDocument();
  });

  it("shows the slider when the revenue sharing toggle is turned on", async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1");
    await userEvent.click(screen.getByRole("switch"));
    expect(await screen.findByLabelText(/labelRevenueSharePct/i)).toBeInTheDocument();
  });

  it("updates the displayed percentage when the slider is moved", async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1");
    await userEvent.click(screen.getByRole("switch"));

    const slider = await screen.findByLabelText(/labelRevenueSharePct/i);
    fireEvent.change(slider, { target: { value: "25" } }); // 25%

    expect(screen.getByDisplayValue("2500")).toBeInTheDocument();
  });

  it("hides revenue sharing section when switching away from Educational Startup", async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1");
    expect(screen.getByRole("switch")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "0"); // Learner
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

describe("CreateCampaignPage — submission", () => {
  beforeEach(() => setWalletConnected());

  it('opens review first and only submits after "Confirm & Sign"', async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields();

    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));

    expect(
      screen.getByRole("heading", { name: /reviewTitle/i }),
    ).toBeInTheDocument();
    expect(mockCreateCampaign).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    await waitFor(() => expect(mockCreateCampaign).toHaveBeenCalledTimes(1));
  });

  it("allows editing details and reopening review", async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields();

    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(screen.getByText("My Test Campaign")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /editDetails/i }));
    expect(
      screen.queryByRole("heading", { name: /reviewTitle/i }),
    ).not.toBeInTheDocument();

    const titleInput = screen.getByLabelText(/labelTitle/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated Campaign Title");

    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    expect(screen.getByText("Updated Campaign Title")).toBeInTheDocument();
  });

  it("shows a consolidated review with local deadline preview details", async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields({ durationDays: "10" });

    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1");
    await userEvent.click(screen.getByRole("switch", { name: /revenueSharingAriaLabel/i }));
    const slider = await screen.findByLabelText(/labelRevenueSharePct/i);
    fireEvent.change(slider, { target: { value: "5" } }); // 5%

    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));

    const reviewDialog = screen.getByRole("dialog");
    const reviewScope = within(reviewDialog);

    expect(reviewScope.getByText("My Test Campaign")).toBeInTheDocument();
    expect(reviewScope.getByText(/1,?000 xlm/i)).toBeInTheDocument();
    expect(reviewScope.getByText("reviewFieldDurationDays")).toBeInTheDocument();
    expect(reviewScope.getByText(/^Educational Startup$/)).toBeInTheDocument();
    expect(reviewScope.getByText("5.00%")).toBeInTheDocument();
    expect(reviewScope.getByText("reviewFieldEndDate")).toBeInTheDocument();

    const timestampValues = reviewScope
      .getAllByText(/^\d+$/)
      .map((node) => node.textContent ?? "")
      .filter((value) => value.length >= 10);
    expect(timestampValues.length).toBeGreaterThan(0);
  });

  it("calls createCampaign with correct args on valid submission", async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    await waitFor(() => expect(mockCreateCampaign).toHaveBeenCalledTimes(1));

    const [
      creator,
      title,
      description,
      fundingGoalStroops,
      durationDays,
      category,
      hasRevShare,
      bps,
    ] = mockCreateCampaign.mock.calls[0];

    expect(creator).toBe(TEST_PUBKEY);
    expect(title).toBe("My Test Campaign");
    expect(description).toContain("A detailed description");
    expect(fundingGoalStroops).toBe(BigInt(10_000_000_000)); // 1000 XLM in stroops
    expect(durationDays).toBe(30);
    expect(category).toBe(0); // Learner
    expect(hasRevShare).toBe(false);
    expect(bps).toBe(0);
  });

  it("passes revenue share basis points correctly", async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields();

    // Switch to Educational Startup and enable revenue sharing
    await userEvent.selectOptions(screen.getByLabelText(/labelCategory/i), "1");
    await userEvent.click(screen.getByRole("switch"));

    // Move slider to 500 bps (5%)
    const slider = await screen.findByLabelText(/labelRevenueSharePct/i);
    fireEvent.change(slider, { target: { value: "5" } });

    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    await waitFor(() => expect(mockCreateCampaign).toHaveBeenCalledTimes(1));

    const [, , , , , category, hasRevShare, bps] = mockCreateCampaign.mock.calls[0];
    expect(category).toBe(1); // EducationalStartup
    expect(hasRevShare).toBe(true);
    expect(bps).toBe(500);
  });

  it("shows a success toast and redirects to the new campaign page", async () => {
    mockGetCampaignCount.mockResolvedValue(7);
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith("successMessage");
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/causes/7");
    });
  });

  it("falls back to /causes redirect if getCampaignCount fails", async () => {
    mockGetCampaignCount.mockRejectedValue(new Error("rpc error"));
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/causes");
    });
  });

  it("shows an error toast when createCampaign throws", async () => {
    mockCreateCampaign.mockRejectedValue(new Error("Error(Contract, #3)"));
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith("ContractErrors.CampaignNotActive");
    });
  });

  it("disables the submit button and shows a spinner while submitting", async () => {
    let resolveCreate!: (v: string) => void;
    mockCreateCampaign.mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolveCreate = r;
        }),
    );

    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /launchCampaign/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmAndSign/i }));

    expect(await screen.findByRole("button", { name: /submitting/i })).toBeDisabled();

    await act(async () => {
      resolveCreate("tx_hash");
    });
  });

  it("navigates to /causes when Cancel is clicked", async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith("/causes");
  });
});

// ---------------------------------------------------------------------------
// Character counter
// ---------------------------------------------------------------------------

describe("CreateCampaignPage — character counters", () => {
  beforeEach(() => setWalletConnected());

  it("updates the title character counter as user types", async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/labelTitle/i), "Hello");
    expect(screen.getByText("5/100")).toBeInTheDocument();
  });

  it("updates the description character counter as user types", async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/labelDescription/i), "Test");
    expect(screen.getByText("4/1,000")).toBeInTheDocument();
  });
});
