import { renderHook, waitFor } from "@testing-library/react";
import { useCampaignMetadata } from "@/hooks/useCampaignMetadata";
import { getCampaign } from "@/lib/contractClient";
import type { Campaign } from "@/types";

jest.mock("@/lib/contractClient");

const mockGetCampaign = getCampaign as jest.MockedFunction<typeof getCampaign>;

describe("useCampaignMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return null metadata when campaign is loading", () => {
    mockGetCampaign.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCampaignMetadata(1));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.title).toBeNull();
    expect(result.current.creator).toBeNull();
  });

  it("should return campaign metadata fields", async () => {
    const mockCampaign: Campaign = {
      id: 1,
      creator: "GTEST123",
      title: "Test Campaign",
      description: "Test description",
      category: "health",
      tags: ["health", "community"],
      cover_image_url: "https://example.com/image.jpg",
      latitude: 40.7128,
      longitude: -74.006,
      social_links: { twitter: "@test" },
      created_at: 1234567890,
      status: "active",
      funding_goal: BigInt(1000),
      deadline: 9999999999,
      amount_raised: BigInt(500),
      is_active: true,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      has_revenue_sharing: false,
      revenue_share_percentage: 0,
    };

    mockGetCampaign.mockResolvedValue(mockCampaign);

    const { result } = renderHook(() => useCampaignMetadata(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.title).toBe("Test Campaign");
    expect(result.current.creator).toBe("GTEST123");
    expect(result.current.description).toBe("Test description");
    expect(result.current.category).toBe("health");
    expect(result.current.tags).toEqual(["health", "community"]);
    expect(result.current.coverImageUrl).toBe("https://example.com/image.jpg");
    expect(result.current.location).toEqual({ latitude: 40.7128, longitude: -74.006 });
    expect(result.current.socialLinks).toEqual({ twitter: "@test" });
    expect(result.current.createdAt).toBe(1234567890);
  });

  it("should handle campaign not found", async () => {
    mockGetCampaign.mockResolvedValue(null);

    const { result } = renderHook(() => useCampaignMetadata(999));

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
    });

    expect(result.current.title).toBeNull();
  });
});
