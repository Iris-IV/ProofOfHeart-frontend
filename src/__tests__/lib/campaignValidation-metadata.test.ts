import {
  computeMetadataHash,
  validateCampaignMetadataHash,
  handleContractError,
  type CampaignMetadata,
} from "../../lib/campaignValidation";
import { SorobanContractError } from "../../lib/stellar";
import type { Campaign } from "../../types";
import { Category } from "../../types";

describe("Campaign metadata hash validation (#1534)", () => {
  describe("computeMetadataHash", () => {
    it("computes a deterministic SHA-256 hash", async () => {
      const metadata: CampaignMetadata = {
        title: "Clean Water Initiative",
        description: "Providing clean water to rural communities",
        coverImageUrl: "https://ipfs.io/ipfs/QmHash123",
        tags: ["water", "health"],
        milestones: [
          { targetAmount: BigInt(1000000000), description: "First 100 families" },
        ],
      };

      const hash1 = await computeMetadataHash(metadata);
      const hash2 = await computeMetadataHash(metadata);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hashes for different metadata", async () => {
      const metadata1: CampaignMetadata = {
        title: "Campaign A",
        description: "Description A",
      };

      const metadata2: CampaignMetadata = {
        title: "Campaign B",
        description: "Description B",
      };

      const hash1 = await computeMetadataHash(metadata1);
      const hash2 = await computeMetadataHash(metadata2);

      expect(hash1).not.toBe(hash2);
    });

    it("treats missing optional fields consistently", async () => {
      const metadata1: CampaignMetadata = {
        title: "Test",
        description: "Test description",
      };

      const metadata2: CampaignMetadata = {
        title: "Test",
        description: "Test description",
        tags: [],
        milestones: [],
      };

      const hash1 = await computeMetadataHash(metadata1);
      const hash2 = await computeMetadataHash(metadata2);

      expect(hash1).toBe(hash2);
    });

    it("encodes bigint milestone amounts as strings", async () => {
      const metadata: CampaignMetadata = {
        title: "Test",
        description: "Test",
        milestones: [
          { targetAmount: BigInt("999999999999999999"), description: "Milestone" },
        ],
      };

      const hash = await computeMetadataHash(metadata);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("validateCampaignMetadataHash", () => {
    const mockCampaign: Campaign = {
      id: 1,
      creator: "GTEST",
      title: "Test Campaign",
      description: "Test description",
      funding_goal: BigInt(1000000000),
      deadline: Date.now() / 1000 + 86400,
      amount_raised: BigInt(0),
      is_active: true,
      status: "active" as any,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      category: Category.Learner,
      has_revenue_sharing: false,
      revenue_share_percentage: 0,
      tags: ["test"],
      cover_image_url: "https://example.com/image.jpg",
    };

    it("returns valid when no expected hash is provided", async () => {
      const result = await validateCampaignMetadataHash(mockCampaign);

      expect(result.valid).toBe(true);
      expect(result.reason).toBe("missing_expected_hash");
    });

    it("returns valid when computed hash matches expected hash", async () => {
      const metadata: CampaignMetadata = {
        title: mockCampaign.title,
        description: mockCampaign.description,
        coverImageUrl: mockCampaign.cover_image_url,
        tags: mockCampaign.tags,
        milestones: mockCampaign.milestones,
      };
      const expectedHash = await computeMetadataHash(metadata);

      const result = await validateCampaignMetadataHash(mockCampaign, expectedHash);

      expect(result.valid).toBe(true);
      expect(result.computedHash).toBe(expectedHash);
      expect(result.expectedHash).toBe(expectedHash);
      expect(result.reason).toBeUndefined();
    });

    it("returns invalid when hashes do not match", async () => {
      const expectedHash = "0".repeat(64);

      const result = await validateCampaignMetadataHash(mockCampaign, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("hash_mismatch");
      expect(result.computedHash).not.toBe(expectedHash);
      expect(result.expectedHash).toBe(expectedHash);
    });

    it("detects metadata tampering", async () => {
      const originalMetadata: CampaignMetadata = {
        title: "Original Title",
        description: "Original description",
      };
      const expectedHash = await computeMetadataHash(originalMetadata);

      // Campaign with tampered title
      const tamperedCampaign: Campaign = {
        ...mockCampaign,
        title: "Tampered Title",
        description: "Original description",
      };

      const result = await validateCampaignMetadataHash(tamperedCampaign, expectedHash);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("hash_mismatch");
    });
  });

  describe("handleContractError", () => {
    it("wraps a Soroban contract error with localized message", () => {
      const rawError = new Error("HostError: Error(Contract, #2)");

      const wrapped = handleContractError(rawError, "en");

      expect(wrapped).toBeInstanceOf(SorobanContractError);
      expect(wrapped.code).toBe(2);
      expect(wrapped.localizedMessage).toContain("campaign");
    });

    it("handles custom contract error codes outside the known enum", () => {
      const rawError = new Error("HostError: Error(Contract, #999)");

      const wrapped = handleContractError(rawError, "en");

      expect(wrapped).toBeInstanceOf(SorobanContractError);
      expect(wrapped.code).toBe(999);
      expect(wrapped.localizedMessage).toContain("999");
    });

    it("uses Spanish locale when specified", () => {
      const rawError = new Error("HostError: Error(Contract, #2)");

      const wrapped = handleContractError(rawError, "es");

      expect(wrapped).toBeInstanceOf(SorobanContractError);
      expect(wrapped.localizedMessage).toMatch(/campaña|encontrar/i);
    });

    it("handles non-contract errors gracefully", () => {
      const rawError = new Error("Network timeout");

      const wrapped = handleContractError(rawError, "en");

      expect(wrapped).toBeInstanceOf(SorobanContractError);
      expect(wrapped.code).toBeNull();
    });
  });
});
