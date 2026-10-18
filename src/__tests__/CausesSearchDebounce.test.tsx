import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CausesClient from "@/app/[locale]/causes/CausesClient";

const listCampaignsMock = jest.fn();

jest.mock("@/lib/contractClient", () => ({
  listCampaigns: (...args: unknown[]) => listCampaignsMock(...args),
}));

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/causes",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  redirect: jest.fn(),
  usePathname: () => "/causes",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  getPathname: () => "/causes",
}));

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({ publicKey: null, isWalletConnected: false }),
}));

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showWarning: jest.fn(),
  }),
}));

jest.mock("next/dynamic", () => {
  return (loader: () => Promise<{ default: React.ComponentType }>) => {
    const Component = (props: Record<string, unknown>) => {
      const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
      React.useEffect(() => {
        loader().then((m) => setComp(() => m.default));
      }, [loader]);
      void props;
      return Comp ? <Comp {...props} /> : null;
    };
    Component.displayName = "DynamicMock";
    return Component;
  };
});

import React from "react";

// Regression test for #1145: typing in the cause search field must not
// trigger a network call per keystroke. CausesClient already debounces
// (300ms) and filters client-side over already-fetched campaigns, but
// nothing previously pinned that behaviour — this locks it in.
describe("Causes search debounce (#1145)", () => {
  it("does not call listCampaigns more than once while typing a search term", async () => {
    listCampaignsMock.mockResolvedValue({ campaigns: [], nextCursor: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <CausesClient />
      </QueryClientProvider>,
    );

    const callsBeforeTyping = listCampaignsMock.mock.calls.length;

    const searchInput = await screen.findByPlaceholderText(/search/i);
    await user.type(searchInput, "clean water");

    // Even with the debounce timer running, typing itself must never call
    // the API — filtering happens client-side over already-loaded pages.
    expect(listCampaignsMock.mock.calls.length).toBe(callsBeforeTyping);

    // Let the 300ms debounce settle, then confirm still no extra fetch.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(listCampaignsMock.mock.calls.length).toBe(callsBeforeTyping);
  });
});
