import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CausesClient from "@/app/[locale]/causes/CausesClient";
import * as contractClient from "@/lib/contractClient";

// Regression test for #1145: typing in the cause search field must not
// trigger a network call per keystroke. CausesClient already debounces
// (300ms) and filters client-side over already-fetched campaigns, but
// nothing previously pinned that behaviour — this locks it in.
describe("Causes search debounce (#1145)", () => {
  it("does not call listCampaigns more than once while typing a search term", async () => {
    const listSpy = jest.spyOn(contractClient, "listCampaigns");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <CausesClient />
      </QueryClientProvider>,
    );

    const callsBeforeTyping = listSpy.mock.calls.length;

    const searchInput = await screen.findByPlaceholderText(/search/i);
    await user.type(searchInput, "clean water");

    // Even with the debounce timer running, typing itself must never call
    // the API — filtering happens client-side over already-loaded pages.
    expect(listSpy.mock.calls.length).toBe(callsBeforeTyping);

    // Let the 300ms debounce settle, then confirm still no extra fetch.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(listSpy.mock.calls.length).toBe(callsBeforeTyping);
  });
});