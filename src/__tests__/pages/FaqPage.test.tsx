/**
 * Tests for the /faq page (src/app/[locale]/faq/page.tsx).
 *
 * The page is a Next.js async Server Component that relies on next-intl's
 * `getTranslations`. We mock that function so the tests run in a plain Jest /
 * jsdom environment without needing a real Next.js server.
 */

jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(),
}));

jest.mock("@/lib/seo", () => ({
  buildAlternates: (path: string) => ({ canonical: `https://example.test${path}` }),
}));

import { render, screen } from "@testing-library/react";
import { getTranslations } from "next-intl/server";
import FaqPage, { generateMetadata } from "@/app/[locale]/faq/page";

const mockedGetTranslations = getTranslations as jest.MockedFunction<typeof getTranslations>;

/** A minimal translation function that returns the key as its value. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeMockT = (overrides: Record<string, string> = {}) =>
  jest.fn((key: string) => overrides[key] ?? key) as unknown as Awaited<
    ReturnType<typeof getTranslations>
  >;

describe("FaqPage", () => {
  beforeEach(() => {
    mockedGetTranslations.mockResolvedValue(makeMockT());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the page title and subtitle", async () => {
    const t = makeMockT({
      pageTitle: "How it works & FAQ",
      pageSubtitle: "Everything you need to know",
    });
    mockedGetTranslations.mockResolvedValue(t);

    const jsx = await FaqPage();
    render(jsx);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How it works & FAQ");
    expect(screen.getByText("Everything you need to know")).toBeInTheDocument();
  });

  it("renders the 'How it works' section with 4 steps", async () => {
    const t = makeMockT({
      howItWorksTitle: "How it works",
      step1Title: "Submit a cause",
      step2Title: "Community validates",
      step3Title: "Contribute & track",
      step4Title: "On-chain outcomes",
    });
    mockedGetTranslations.mockResolvedValue(t);

    const jsx = await FaqPage();
    render(jsx);

    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.getByText(/Submit a cause/)).toBeInTheDocument();
    expect(screen.getByText(/Community validates/)).toBeInTheDocument();
    expect(screen.getByText(/Contribute & track/)).toBeInTheDocument();
    expect(screen.getByText(/On-chain outcomes/)).toBeInTheDocument();
  });

  it("renders all FAQ section headings", async () => {
    const t = makeMockT({
      sectionStellarTitle: "Stellar & Soroban",
      sectionCampaignsTitle: "Campaigns & funds",
      sectionStartupsTitle: "Revenue sharing for startups",
      sectionWalletTitle: "Getting started with Freighter",
    });
    mockedGetTranslations.mockResolvedValue(t);

    const jsx = await FaqPage();
    render(jsx);

    expect(screen.getByText("Stellar & Soroban")).toBeInTheDocument();
    expect(screen.getByText("Campaigns & funds")).toBeInTheDocument();
    expect(screen.getByText("Revenue sharing for startups")).toBeInTheDocument();
    expect(screen.getByText("Getting started with Freighter")).toBeInTheDocument();
  });

  it("renders all required FAQ questions from the issue", async () => {
    const t = makeMockT({
      q_whatIsStellar: "What is Stellar?",
      q_whatIsSoroban: "What is Soroban?",
      q_howVerification: "How does campaign verification work?",
      q_cancelledCampaign: "What happens to my money if a campaign is cancelled?",
      q_platformFees: "What are platform fees?",
      q_revenueSharing: "How does revenue sharing work for startups?",
      q_getFreighter: "How do I get the Freighter wallet?",
      // answers — returned as key names in the mock
      a_whatIsStellar: "a_whatIsStellar",
      a_whatIsSoroban: "a_whatIsSoroban",
      a_howVerification: "a_howVerification",
      a_cancelledCampaign: "a_cancelledCampaign",
      a_platformFees: "a_platformFees",
      a_revenueSharing: "a_revenueSharing",
      a_getFreighter: "a_getFreighter",
    });
    mockedGetTranslations.mockResolvedValue(t);

    const jsx = await FaqPage();
    render(jsx);

    expect(screen.getByText("What is Stellar?")).toBeInTheDocument();
    expect(screen.getByText("What is Soroban?")).toBeInTheDocument();
    expect(screen.getByText("How does campaign verification work?")).toBeInTheDocument();
    expect(
      screen.getByText("What happens to my money if a campaign is cancelled?"),
    ).toBeInTheDocument();
    expect(screen.getByText("What are platform fees?")).toBeInTheDocument();
    expect(screen.getByText("How does revenue sharing work for startups?")).toBeInTheDocument();
    expect(screen.getByText("How do I get the Freighter wallet?")).toBeInTheDocument();
  });

  it("uses a dl/dt/dd structure for FAQ items for accessibility", async () => {
    const jsx = await FaqPage();
    const { container } = render(jsx);

    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelectorAll("dt").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("dd").length).toBeGreaterThan(0);
  });
});

describe("FaqPage generateMetadata", () => {
  it("returns title and description from translations", async () => {
    const t = makeMockT({
      pageTitle: "How it works & FAQ",
      pageSubtitle: "The subtitle",
    });
    mockedGetTranslations.mockResolvedValue(t);

    const metadata = await generateMetadata();

    expect(metadata.title).toBe("How it works & FAQ | ProofOfHeart");
    expect(metadata.description).toBe("The subtitle");
    expect(metadata.openGraph?.title).toBe("How it works & FAQ | ProofOfHeart");
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });
});
