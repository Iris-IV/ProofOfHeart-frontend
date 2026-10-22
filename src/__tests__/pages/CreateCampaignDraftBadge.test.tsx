import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreateCampaignPage from "@/app/[locale]/causes/new/page";

// react-markdown ships ESM this Jest setup does not transform
jest.mock("@/components/SafeMarkdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

jest.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showError: jest.fn(), showSuccess: jest.fn(), showWarning: jest.fn() }),
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({
    publicKey: null,
    isWalletConnected: false,
    connectWallet: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock("@/lib/contractClient", () => ({
  createCampaign: jest.fn(),
}));

describe("CreateCampaignPage — draft auto-save badge", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows a live draft-saved status once form state has been persisted", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CreateCampaignPage />
      </QueryClientProvider>,
    );

    const badge = await screen.findByTestId("draft-saved-badge");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAttribute("aria-live", "polite");
  });
});
