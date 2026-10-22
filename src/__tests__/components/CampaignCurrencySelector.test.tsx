import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CampaignCurrencySelector from "@/components/CampaignCurrencySelector";

const originalFetch = global.fetch;
const fetchMock = jest.fn();
const rates = () => ({ usd: 0.25, eur: 0.2, last_updated_at: Math.floor(Date.now() / 1000) });
const select = (currency: string) =>
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: currency },
  });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

afterAll(() => {
  global.fetch = originalFetch;
});

it("shows XLM without making a third-party request", () => {
  render(<CampaignCurrencySelector goal={1000000000n} />);
  expect(screen.getByRole("combobox", { name: "goal" })).toHaveValue("XLM");
  expect(screen.getByRole("status")).toHaveTextContent("100 XLM");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("converts stroops to estimated USD and EUR while preserving the XLM amount", async () => {
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(rates()) }),
  );
  render(<CampaignCurrencySelector goal={1000000000n} />);
  select("USD");
  expect(await screen.findByText(/≈ USD.*25\.00/)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("100 XLM");
  expect(screen.getByRole("link", { name: "CoinGecko" })).toHaveAttribute(
    "href",
    "https://www.coingecko.com/en/coins/stellar",
  );
  select("EUR");
  expect(await screen.findByText(/≈ EUR.*20\.00/)).toBeInTheDocument();
  select("XLM");
  expect(screen.getByRole("status")).toHaveTextContent("100 XLM");
  expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
});

it.each([
  ["provider error", () => Promise.resolve({ ok: false })],
  ["network error", () => Promise.reject(new Error("offline"))],
  [
    "invalid rates",
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ...rates(), usd: -1 }) }),
  ],
  [
    "expired rates",
    () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...rates(), last_updated_at: 1 }),
      }),
  ],
])("keeps XLM visible on %s and permits retry", async (_name, fail) => {
  fetchMock.mockImplementationOnce(fail);
  render(<CampaignCurrencySelector goal={1000000000n} />);
  select("USD");
  expect(await screen.findByText("unavailable")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("100 XLM");
  fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(rates()) });
  fireEvent.click(screen.getByRole("button", { name: "retry" }));
  expect(await screen.findByText(/≈ USD.*25\.00/)).toBeInTheDocument();
});

it("aborts an in-flight request when switching back to XLM", async () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  render(<CampaignCurrencySelector goal={0n} />);
  select("USD");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  select("XLM");
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole("status")).toHaveTextContent("0 XLM");
});

it("gives each selector its own accessible label", () => {
  render(
    <>
      <CampaignCurrencySelector goal={0n} />
      <CampaignCurrencySelector goal={1n} />
    </>,
  );
  const controls = screen.getAllByRole("combobox", { name: "goal" });
  expect(controls[0].id).not.toEqual(controls[1].id);
});

it("explains which token contributions settle in (#1356)", () => {
  render(<CampaignCurrencySelector goal={1000000000n} />);
  fireEvent.click(screen.getByRole("button", { name: "multiTokenLabel" }));
  expect(screen.getByRole("tooltip")).toHaveTextContent("multiTokenBody");
});
