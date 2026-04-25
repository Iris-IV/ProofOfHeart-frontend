import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateCampaignPage from '@/app/[locale]/causes/new/page';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock('@/components/ToastProvider', () => ({
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

jest.mock('@/components/WalletContext', () => ({
  useWallet: () => mockWalletState,
}));

const mockCreateCampaign = jest.fn();
const mockGetCampaignCount = jest.fn();

jest.mock('@/lib/contractClient', () => ({
  createCampaign: (...args: unknown[]) => mockCreateCampaign(...args),
  getCampaignCount: () => mockGetCampaignCount(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PUBKEY = 'GABCDE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234';

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
  title = 'My Test Campaign',
  description = 'A detailed description of the campaign that explains everything.',
  fundingGoal = '1000',
  durationDays = '30',
} = {}) {
  await userEvent.type(screen.getByLabelText(/campaign title/i), title);
  await userEvent.type(screen.getByLabelText(/description/i), description);
  await userEvent.type(screen.getByLabelText(/funding goal/i), fundingGoal);
  await userEvent.type(screen.getByLabelText(/duration/i), durationDays);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  setWalletDisconnected();
  mockCreateCampaign.mockResolvedValue('mock_tx_hash');
  mockGetCampaignCount.mockResolvedValue(7);
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('CreateCampaignPage — rendering', () => {
  it('renders the page heading', () => {
    render(<CreateCampaignPage />);
    expect(screen.getByRole('heading', { name: /create a campaign/i })).toBeInTheDocument();
  });

  it('renders all required form fields', () => {
    render(<CreateCampaignPage />);
    expect(screen.getByLabelText(/campaign title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/funding goal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
  });

  it('renders the "Launch Campaign" submit button', () => {
    render(<CreateCampaignPage />);
    expect(screen.getByRole('button', { name: /launch campaign/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Wallet guard
// ---------------------------------------------------------------------------

describe('CreateCampaignPage — wallet guard', () => {
  it('shows the wallet guard banner when wallet is not connected', () => {
    render(<CreateCampaignPage />);
    expect(screen.getByText(/connect your freighter wallet/i)).toBeInTheDocument();
  });

  it('disables the submit button when wallet is not connected', () => {
    render(<CreateCampaignPage />);
    expect(screen.getByRole('button', { name: /launch campaign/i })).toBeDisabled();
  });

  it('does not show the wallet guard banner when wallet is connected', () => {
    setWalletConnected();
    render(<CreateCampaignPage />);
    expect(screen.queryByText(/connect your freighter wallet/i)).not.toBeInTheDocument();
  });

  it('calls connectWallet when the "Connect Wallet" button in the banner is clicked', async () => {
    render(<CreateCampaignPage />);
    const connectBtn = screen.getByRole('button', { name: /connect wallet/i });
    await userEvent.click(connectBtn);
    expect(mockConnectWallet).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast if submit is triggered without a wallet (edge case)', async () => {
    // wallet disconnected but form submission attempted programmatically
    render(<CreateCampaignPage />);
    fireEvent.submit(screen.getByRole('button', { name: /launch campaign/i }).closest('form')!);
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/connect your freighter wallet/i),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('CreateCampaignPage — client-side validation', () => {
  beforeEach(() => setWalletConnected());

  it('shows a title error when the field is empty', async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });

  it('links field errors to inputs with aria-describedby and aria-invalid', async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    const titleInput = screen.getByLabelText(/campaign title/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const fundingGoalInput = screen.getByLabelText(/funding goal/i);
    const durationInput = screen.getByLabelText(/duration/i);

    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
    expect(descriptionInput).toHaveAttribute('aria-invalid', 'true');
    expect(descriptionInput).toHaveAttribute('aria-describedby', 'description-error');
    expect(fundingGoalInput).toHaveAttribute('aria-invalid', 'true');
    expect(fundingGoalInput).toHaveAttribute('aria-describedby', 'funding-goal-error');
    expect(durationInput).toHaveAttribute('aria-invalid', 'true');
    expect(durationInput).toHaveAttribute('aria-describedby', 'duration-days-error');
  });

  it('shows a title error when title exceeds 100 characters', async () => {
    render(<CreateCampaignPage />);
    // fireEvent.change bypasses the maxLength DOM attribute so we can test the JS validator
    fireEvent.change(screen.getByLabelText(/campaign title/i), {
      target: { value: 'A'.repeat(101) },
    });
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(await screen.findByText(/100 characters or fewer/i)).toBeInTheDocument();
  });

  it('shows a description error when the field is empty', async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/campaign title/i), 'Valid Title');
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(await screen.findByText(/description is required/i)).toBeInTheDocument();
  });

  it('shows a description error when description exceeds 1000 characters', async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/campaign title/i), 'Valid Title');
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'B'.repeat(1001) },
    });
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(await screen.findByText(/1,000 characters or fewer/i)).toBeInTheDocument();
  });

  it('shows a funding goal error when value is 0 or empty', async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/campaign title/i), 'Valid Title');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'A valid description for this campaign.',
    );
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(await screen.findByText(/greater than 0 xlm/i)).toBeInTheDocument();
  });

  it('shows a duration error when value is outside 1–365', async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/campaign title/i), 'Valid Title');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'A valid description for this campaign.',
    );
    await userEvent.type(screen.getByLabelText(/funding goal/i), '1000');
    await userEvent.type(screen.getByLabelText(/duration/i), '400');
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(await screen.findByText(/between 1 and 365 days/i)).toBeInTheDocument();
  });

  it('does not call createCampaign when there are validation errors', async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Category & Revenue Sharing
// ---------------------------------------------------------------------------

describe('CreateCampaignPage — revenue sharing', () => {
  beforeEach(() => setWalletConnected());

  it('does NOT show the revenue sharing section for non-startup categories', () => {
    render(<CreateCampaignPage />);
    // Default is Learner
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows the revenue sharing section when "Educational Startup" is selected', async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '1'); // EducationalStartup = 1
    expect(screen.getByRole('switch', { name: /revenue sharing/i })).toBeInTheDocument();
  });

  it('hides the slider when the revenue sharing toggle is off', async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '1');
    // Toggle is off by default
    expect(screen.queryByLabelText(/revenue share percentage/i)).not.toBeInTheDocument();
  });

  it('shows the slider when the revenue sharing toggle is turned on', async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '1');
    await userEvent.click(screen.getByRole('switch'));
    expect(await screen.findByLabelText(/revenue share percentage/i)).toBeInTheDocument();
  });

  it('updates the displayed percentage when the slider is moved', async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '1');
    await userEvent.click(screen.getByRole('switch'));

    const slider = await screen.findByLabelText(/revenue share percentage/i);
    fireEvent.change(slider, { target: { value: '2500' } }); // 2500 bps = 25%

    expect(screen.getByText(/25\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/2500 bps/)).toBeInTheDocument();
  });

  it('hides revenue sharing section when switching away from Educational Startup', async () => {
    render(<CreateCampaignPage />);
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '1');
    expect(screen.getByRole('switch')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/category/i), '0'); // Learner
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

describe('CreateCampaignPage — submission', () => {
  beforeEach(() => setWalletConnected());

  it('calls createCampaign with correct args on valid submission', async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    await waitFor(() => expect(mockCreateCampaign).toHaveBeenCalledTimes(1));

    const [creator, title, description, fundingGoalStroops, durationDays, category, hasRevShare, bps] =
      mockCreateCampaign.mock.calls[0];

    expect(creator).toBe(TEST_PUBKEY);
    expect(title).toBe('My Test Campaign');
    expect(description).toContain('A detailed description');
    expect(fundingGoalStroops).toBe(BigInt(10_000_000_000)); // 1000 XLM in stroops
    expect(durationDays).toBe(30);
    expect(category).toBe(0); // Learner
    expect(hasRevShare).toBe(false);
    expect(bps).toBe(0);
  });

  it('passes revenue share basis points correctly', async () => {
    render(<CreateCampaignPage />);
    await fillRequiredFields();

    // Switch to Educational Startup and enable revenue sharing
    await userEvent.selectOptions(screen.getByLabelText(/category/i), '1');
    await userEvent.click(screen.getByRole('switch'));

    // Move slider to 500 bps (5%)
    const slider = await screen.findByLabelText(/revenue share percentage/i);
    fireEvent.change(slider, { target: { value: '500' } });

    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    await waitFor(() => expect(mockCreateCampaign).toHaveBeenCalledTimes(1));

    const [, , , , , category, hasRevShare, bps] = mockCreateCampaign.mock.calls[0];
    expect(category).toBe(1); // EducationalStartup
    expect(hasRevShare).toBe(true);
    expect(bps).toBe(500);
  });

  it('shows a success toast and redirects to the new campaign page', async () => {
    mockGetCampaignCount.mockResolvedValue(7);
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('Campaign created successfully!');
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/causes/7');
    });
  });

  it('falls back to /causes redirect if getCampaignCount fails', async () => {
    mockGetCampaignCount.mockRejectedValue(new Error('rpc error'));
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/causes');
    });
  });

  it('shows an error toast when createCampaign throws', async () => {
    mockCreateCampaign.mockRejectedValue(new Error('Error(Contract, #3)'));
    render(<CreateCampaignPage />);
    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringMatching(/no longer accepting contributions/i),
      );
    });
  });

  it('disables the submit button and shows a spinner while submitting', async () => {
    let resolveCreate!: (v: string) => void;
    mockCreateCampaign.mockImplementation(
      () => new Promise<string>((r) => { resolveCreate = r; }),
    );

    render(<CreateCampaignPage />);
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /launch campaign/i }));

    expect(await screen.findByRole('button', { name: /submitting/i })).toBeDisabled();

    await act(async () => { resolveCreate('tx_hash'); });
  });

  it('navigates to /causes when Cancel is clicked', async () => {
    render(<CreateCampaignPage />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/causes');
  });
});

// ---------------------------------------------------------------------------
// Character counter
// ---------------------------------------------------------------------------

describe('CreateCampaignPage — character counters', () => {
  beforeEach(() => setWalletConnected());

  it('updates the title character counter as user types', async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/campaign title/i), 'Hello');
    expect(screen.getByText('5/100')).toBeInTheDocument();
  });

  it('updates the description character counter as user types', async () => {
    render(<CreateCampaignPage />);
    await userEvent.type(screen.getByLabelText(/description/i), 'Test');
    expect(screen.getByText('4/1,000')).toBeInTheDocument();
  });
});
