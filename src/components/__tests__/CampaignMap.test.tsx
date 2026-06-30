import { render, screen, fireEvent } from "@testing-library/react";
import MapErrorBoundary from "../MapErrorBoundary";
import { hasValidCoordinates, filterByValidCoordinates } from "../CampaignMap";
import { Campaign, Category } from "@/types";

// Leaflet and react-leaflet use browser APIs not available in jsdom.
// Mock them so importing CampaignMap doesn't crash during tests.
jest.mock("leaflet", () => ({
  icon: jest.fn(() => ({})),
  Icon: jest.fn(),
  Marker: { prototype: { options: {} } },
  Map: jest.fn(),
  TileLayer: jest.fn(),
  LatLng: jest.fn(),
  control: { zoom: jest.fn() },
}));

jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a data-testid="link" href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a data-testid="link" href={href}>{children}</a>
  ),
}));

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GABC123456789012345678901234567890123456789012345678901234567890",
    title: "Test Campaign",
    description: "A test campaign.",
    created_at: 1_000_000,
    status: "active",
    funding_goal: BigInt(100_000_000_000),
    deadline: 2_000_000_000,
    amount_raised: BigInt(50_000_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hasValidCoordinates
// ---------------------------------------------------------------------------

describe("hasValidCoordinates", () => {
  it("returns true when latitude and longitude are valid numbers", () => {
    const campaign = makeCampaign({ latitude: 40.7128, longitude: -74.006 });
    expect(hasValidCoordinates(campaign)).toBe(true);
  });

  it("returns false when latitude is undefined", () => {
    const campaign = makeCampaign({ longitude: -74.006 });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when longitude is undefined", () => {
    const campaign = makeCampaign({ latitude: 40.7128 });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when both are undefined", () => {
    const campaign = makeCampaign();
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when latitude is null", () => {
    const campaign = makeCampaign({ latitude: null as unknown as undefined, longitude: -74.006 });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when longitude is null", () => {
    const campaign = makeCampaign({ latitude: 40.7128, longitude: null as unknown as undefined });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when latitude is NaN", () => {
    const campaign = makeCampaign({ latitude: NaN, longitude: -74.006 });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when longitude is Infinity", () => {
    const campaign = makeCampaign({ latitude: 40.7128, longitude: Infinity });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });

  it("returns false when latitude is -Infinity", () => {
    const campaign = makeCampaign({ latitude: -Infinity, longitude: -74.006 });
    expect(hasValidCoordinates(campaign)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterByValidCoordinates
// ---------------------------------------------------------------------------

describe("filterByValidCoordinates", () => {
  it("filters out campaigns without valid coordinates", () => {
    const withCoords = makeCampaign({ id: 1, latitude: 40.7128, longitude: -74.006 });
    const withoutCoords = makeCampaign({ id: 2 });
    const result = filterByValidCoordinates([withCoords, withoutCoords]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns empty array when no campaigns have coordinates", () => {
    const result = filterByValidCoordinates([makeCampaign({ id: 1 }), makeCampaign({ id: 2 })]);
    expect(result).toHaveLength(0);
  });

  it("returns all campaigns when all have valid coordinates", () => {
    const c1 = makeCampaign({ id: 1, latitude: 40.7128, longitude: -74.006 });
    const c2 = makeCampaign({ id: 2, latitude: 51.5074, longitude: -0.1278 });
    const result = filterByValidCoordinates([c1, c2]);
    expect(result).toHaveLength(2);
  });

  it("handles empty array", () => {
    const result = filterByValidCoordinates([]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MapErrorBoundary
// ---------------------------------------------------------------------------

describe("MapErrorBoundary", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <MapErrorBoundary>
        <div data-testid="child">Map content</div>
      </MapErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Map content");
  });

  it("catches error and shows fallback UI", () => {
    const Bomb = () => {
      throw new Error("Map crashed!");
    };

    render(
      <MapErrorBoundary>
        <Bomb />
      </MapErrorBoundary>,
    );

    expect(screen.getByText("Map unavailable")).toBeInTheDocument();
    expect(screen.getByText("Map crashed!")).toBeInTheDocument();
  });

  it('clicking "Try Again" resets the error state', () => {
    let shouldThrow = true;
    const Bomb = () => {
      if (shouldThrow) {
        throw new Error("Temporary failure");
      }
      return <div data-testid="recovered">Recovered</div>;
    };

    render(
      <MapErrorBoundary>
        <Bomb />
      </MapErrorBoundary>,
    );

    expect(screen.getByText("Map unavailable")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText("Try Again"));

    expect(screen.getByTestId("recovered")).toHaveTextContent("Recovered");
  });
});
