/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * ProofOfHeart contract read client, generated from the contract's published
 * interface (`contract-spec.json` in this directory).
 *
 * Source of truth : Iris-IV/ProofOfHeart-stellar (contract interface artifact,
 *                   see Iris-IV/ProofOfHeart-stellar#1473), or a local
 *                   `proof_of_heart.wasm` via
 *                   `stellar contract info interface --wasm <path> --output json`
 * Regenerate with : `npm run bindings:generate`
 *                   (scripts/generate-contract-bindings.mjs)
 *
 * Scope: the view (read) surface that `src/lib/contractClient.ts` consumes.
 * Write entrypoints are migrated incrementally (issue #1790); the contract's
 * full entrypoint reference lives in the contract repo's `docs/API.md`.
 *
 * The client owns method selection, ScVal argument encoding and struct
 * decoding, so a contract-side signature change is absorbed here instead of in
 * hand-written wrapper code. Callers inject the transport:
 *
 *   const generated = createGeneratedClient(invokeViewMethod);
 */
import { Address, nativeToScVal, scValToBigInt, xdr } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Contract types (mirrors of `#[contracttype]` structs in the contract spec)
// ---------------------------------------------------------------------------

/**
 * On-chain `Campaign` struct as decoded from XDR — snake_case fields exactly
 * as the contract stores them. The contract keeps lifecycle state in a single
 * `status` bitfield (see `src/lib/campaignStatusFlags.ts`), not booleans.
 *
 * `tags` is NOT a contract field: it is read only for legacy/mock maps that
 * stored it directly. UI tags/milestones/cover images travel in the `POH_EXT`
 * suffix of `description` (parsed by the app layer after decoding).
 */
export interface SpecCampaign {
  id: number;
  creator: string;
  first_creator: string;
  /** Proposed new creator during a two-step ownership transfer, or null. */
  pending_creator: string | null;
  /** Unix seconds after which `pending_creator` can no longer be accepted. */
  pending_creator_expiry: number;
  title: string;
  description: string;
  funding_goal: bigint;
  deadline: number;
  amount_raised: bigint;
  /** Bitfield: CAMPAIGN_ACTIVE|CAMPAIGN_PAUSED|CAMPAIGN_VALIDATED|CAMPAIGN_SUCCEEDED. */
  status: number;
  /** Category enum discriminant (0–3). */
  category: number;
  has_revenue_sharing: boolean;
  /** Basis points (e.g. 300 = 3%). */
  revenue_share_percentage: number;
  /** Per-wallet cap in stroops; `0` means no cap. */
  max_contribution_per_user: bigint;
  /** Per-campaign platform fee override in bps; null = global fee. */
  fee_override: number | null;
  deadline_extended: boolean;
  /** Raised amount still live after refunds (revenue-sharing pro-rata base). */
  effective_amount_raised: bigint;
  /** Legacy/mock maps only — the contract struct carries no tags field. */
  tags?: string[];
}

/** On-chain `PlatformStats` aggregate. */
export interface SpecPlatformStats {
  total_campaigns: number;
  active_campaigns: number;
  verified_campaigns: number;
  cancelled_campaigns: number;
  total_amount_raised: bigint;
  /** True when the contract flags its counters as inconsistent. */
  stats_are_partial: boolean;
}

/** On-chain `Milestone` plan entry (payout_bps values sum to 10_000). */
export interface SpecMilestone {
  id: number;
  description: string;
  payout_bps: number;
  verified: boolean;
}

/** On-chain `CampaignReserve` vesting entry. */
export interface SpecCampaignReserve {
  amount: bigint;
  release_timestamp: number;
  released: boolean;
}

/** One page of the paginated campaign views: `(Vec<Campaign>, next)`. */
export interface SpecCampaignPage {
  campaigns: SpecCampaign[];
  next: number;
}

/**
 * Transport: performs a read-only contract call and returns the raw result.
 * `contractClient.ts` injects its cached/failover `invokeViewMethod` here.
 */
export type InvokeView = (method: string, args?: xdr.ScVal[]) => Promise<xdr.ScVal | null>;

// ---------------------------------------------------------------------------
// ScVal encoders (argument side)
// ---------------------------------------------------------------------------

const encU32 = (value: number): xdr.ScVal => nativeToScVal(value, { type: "u32" });
const encU64 = (value: number): xdr.ScVal => nativeToScVal(value, { type: "u64" });
const encI128 = (value: bigint): xdr.ScVal => nativeToScVal(value, { type: "i128" });
const encBool = (value: boolean): xdr.ScVal => nativeToScVal(value, { type: "bool" });
const encString = (value: string): xdr.ScVal => nativeToScVal(value, { type: "string" });
const encAddress = (value: string): xdr.ScVal => new Address(value).toScVal();
const encBytes32 = (hex: string): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));

// ---------------------------------------------------------------------------
// ScVal decoders (result side)
// ---------------------------------------------------------------------------

/** Soroban encodes `Option<T>` as void for `None` and the bare value for `Some`. */
function isScValVoid(val: xdr.ScVal | undefined): boolean {
  return !val || val.switch().name === "scvVoid";
}

function decodeOptionalAddress(val: xdr.ScVal | undefined): string | null {
  return isScValVoid(val) ? null : Address.fromScVal(val as xdr.ScVal).toString();
}

function decodeOptionalU32(val: xdr.ScVal | undefined): number | null {
  return isScValVoid(val) ? null : (val as xdr.ScVal).u32();
}

function toMapFields(val: xdr.ScVal, expect: string): Record<string, xdr.ScVal> {
  const map = val.map();
  if (!map) throw new Error(`Expected ScVal map for ${expect}.`);
  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of map) {
    fields[entry.key().sym().toString()] = entry.val();
  }
  return fields;
}

/** Decode the contract's `Campaign` struct map into {@link SpecCampaign}. */
export function decodeSpecCampaign(val: xdr.ScVal): SpecCampaign {
  const fields = toMapFields(val, "Campaign");
  return {
    id: fields["id"].u32(),
    creator: Address.fromScVal(fields["creator"]).toString(),
    first_creator: Address.fromScVal(fields["first_creator"]).toString(),
    pending_creator: decodeOptionalAddress(fields["pending_creator"]),
    pending_creator_expiry: Number(fields["pending_creator_expiry"].u64()),
    title: fields["title"].str().toString(),
    description: fields["description"].str().toString(),
    funding_goal: scValToBigInt(fields["funding_goal"]),
    deadline: Number(fields["deadline"].u64()),
    amount_raised: scValToBigInt(fields["amount_raised"]),
    status: fields["status"].u32(),
    category: fields["category"].u32(),
    has_revenue_sharing: fields["has_revenue_sharing"].b(),
    revenue_share_percentage: fields["revenue_share_percentage"].u32(),
    max_contribution_per_user: scValToBigInt(fields["max_contribution_per_user"]),
    fee_override: decodeOptionalU32(fields["fee_override"]),
    deadline_extended: fields["deadline_extended"].b(),
    effective_amount_raised: scValToBigInt(fields["effective_amount_raised"]),
    // Not a contract field — only older/mock records carry it on the map.
    tags: fields["tags"] ? fields["tags"].vec().map((v: xdr.ScVal) => v.str().toString()) : undefined,
  };
}

/** Decode the contract's `PlatformStats` struct map. */
export function decodeSpecPlatformStats(val: xdr.ScVal): SpecPlatformStats {
  const fields = toMapFields(val, "PlatformStats");
  const field = (name: string): xdr.ScVal => {
    const value = fields[name];
    if (!value) throw new Error(`PlatformStats is missing ${name}.`);
    return value;
  };
  return {
    total_campaigns: field("total_campaigns").u32(),
    active_campaigns: field("active_campaigns").u32(),
    verified_campaigns: field("verified_campaigns").u32(),
    cancelled_campaigns: field("cancelled_campaigns").u32(),
    total_amount_raised: scValToBigInt(field("total_amount_raised")),
    stats_are_partial: fields["stats_are_partial"]?.b() ?? false,
  };
}

/** Decode the contract's `Milestone` struct map. */
export function decodeSpecMilestone(val: xdr.ScVal): SpecMilestone {
  const fields = toMapFields(val, "Milestone");
  return {
    id: fields["id"].u32(),
    description: fields["description"].str().toString(),
    payout_bps: fields["payout_bps"].u32(),
    verified: fields["verified"].b(),
  };
}

/** Decode `Option<CampaignReserve>`: void → null. */
export function decodeSpecCampaignReserve(val: xdr.ScVal | null): SpecCampaignReserve | null {
  if (!val || isScValVoid(val)) return null;
  const fields = toMapFields(val, "CampaignReserve");
  if (!fields["amount"]) return null;
  return {
    amount: scValToBigInt(fields["amount"]),
    release_timestamp: Number(scValToBigInt(fields["release_timestamp"])),
    released: fields["released"].b() ?? false,
  };
}

/** Decode a `(Vec<Campaign>, u32)` page tuple returned by the paginated views. */
function decodeSpecCampaignPage(val: xdr.ScVal | null): SpecCampaignPage {
  const [page, next] = val?.vec() ?? [];
  if (!page || !next) return { campaigns: [], next: 0 };
  return { campaigns: (page.vec() ?? []).map(decodeSpecCampaign), next: next.u32() };
}

// ---------------------------------------------------------------------------
// Generated client
// ---------------------------------------------------------------------------

/**
 * Typed read client for the ProofOfHeart contract. One method per view
 * entrypoint in `contract-spec.json`; methods encode their own arguments and
 * decode the result, so callers never touch `nativeToScVal` for reads.
 */
export class ProofOfHeartGeneratedClient {
  constructor(private readonly invoke: InvokeView) {}

  // ── Campaign listings ────────────────────────────────────────────────────

  /** `list_campaigns(start, limit)` — `start` is an exclusive id cursor. */
  async listCampaigns(start: number, limit: number): Promise<SpecCampaignPage> {
    return decodeSpecCampaignPage(await this.invoke("list_campaigns", [encU32(start), encU32(limit)]));
  }

  /** `get_creator_campaigns(creator, start, limit)` — zero-based position cursor. */
  async getCreatorCampaigns(creator: string, start: number, limit: number): Promise<SpecCampaignPage> {
    return decodeSpecCampaignPage(
      await this.invoke("get_creator_campaigns", [encAddress(creator), encU32(start), encU32(limit)]),
    );
  }

  /** `get_campaigns_by_category(category, offset, limit)` — zero-based position cursor. */
  async getCampaignsByCategory(category: number, offset: number, limit: number): Promise<SpecCampaignPage> {
    return decodeSpecCampaignPage(
      await this.invoke("get_campaigns_by_category", [encU32(category), encU32(offset), encU32(limit)]),
    );
  }

  // ── Campaign reads ───────────────────────────────────────────────────────

  /**
   * `get_campaign(campaign_id)` — returns the decoded struct, or null when the
   * simulation produced no result. A missing campaign surfaces as the
   * `CampaignNotFound` (2) contract error, which callers map to null.
   */
  async getCampaign(campaignId: number): Promise<SpecCampaign | null> {
    const result = await this.invoke("get_campaign", [encU32(campaignId)]);
    return result ? decodeSpecCampaign(result) : null;
  }

  /** `get_campaign_count()` */
  async getCampaignCount(): Promise<number> {
    const result = await this.invoke("get_campaign_count");
    return result ? result.u32() : 0;
  }

  /** `get_platform_stats()` */
  async getPlatformStats(): Promise<SpecPlatformStats> {
    const result = await this.invoke("get_platform_stats");
    if (!result) throw new Error("Expected ScVal map for PlatformStats.");
    return decodeSpecPlatformStats(result);
  }

  // ── Contributions & revenue ──────────────────────────────────────────────

  /** `get_contribution(campaign_id, contributor)` — i128 stroops. */
  async getContribution(campaignId: number, contributor: string): Promise<bigint> {
    const result = await this.invoke("get_contribution", [encU32(campaignId), encAddress(contributor)]);
    return result ? scValToBigInt(result) : BigInt(0);
  }

  /** `get_personal_cap(campaign_id, contributor)` — i128 stroops; 0 = no cap. */
  async getPersonalCap(campaignId: number, contributor: string): Promise<bigint> {
    const result = await this.invoke("get_personal_cap", [encU32(campaignId), encAddress(contributor)]);
    return result ? scValToBigInt(result) : BigInt(0);
  }

  /** `get_revenue_pool(campaign_id)` — i128 stroops. */
  async getRevenuePool(campaignId: number): Promise<bigint> {
    const result = await this.invoke("get_revenue_pool", [encU32(campaignId)]);
    return result ? scValToBigInt(result) : BigInt(0);
  }

  /** `get_revenue_claimed(campaign_id, contributor)` — i128 stroops. */
  async getRevenueClaimed(campaignId: number, contributor: string): Promise<bigint> {
    const result = await this.invoke("get_revenue_claimed", [encU32(campaignId), encAddress(contributor)]);
    return result ? scValToBigInt(result) : BigInt(0);
  }

  // ── Milestones ───────────────────────────────────────────────────────────

  /** `get_milestones(campaign_id)` — empty when the creator set no plan. */
  async getMilestones(campaignId: number): Promise<SpecMilestone[]> {
    const result = await this.invoke("get_milestones", [encU32(campaignId)]);
    return result?.vec()?.map(decodeSpecMilestone) ?? [];
  }

  /** `is_milestone_claimed(campaign_id, milestone_id)` */
  async isMilestoneClaimed(campaignId: number, milestoneId: number): Promise<boolean> {
    const result = await this.invoke("is_milestone_claimed", [encU32(campaignId), encU32(milestoneId)]);
    return result?.b() ?? false;
  }

  // ── Platform config ──────────────────────────────────────────────────────

  /** `get_admin()` — G… address of the current admin. */
  async getAdmin(): Promise<string> {
    const result = await this.invoke("get_admin");
    if (!result) return "";
    return Address.fromScVal(result).toString();
  }

  /** `get_version()` */
  async getVersion(): Promise<number> {
    const result = await this.invoke("get_version");
    return result ? result.u32() : 0;
  }

  /** `get_platform_fee()` — basis points (300 = 3%). */
  async getPlatformFee(): Promise<number> {
    const result = await this.invoke("get_platform_fee");
    return result ? result.u32() : 0;
  }

  // ── Bookmarks ────────────────────────────────────────────────────────────

  /** `get_saved_campaigns(user)` — campaign ids the wallet saved. */
  async getSavedCampaigns(user: string): Promise<number[]> {
    const result = await this.invoke("get_saved_campaigns", [encAddress(user)]);
    return (result?.vec() ?? []).map((v) => v.u32());
  }

  /** `get_saved_campaigns_count(user)` */
  async getSavedCampaignsCount(user: string): Promise<number> {
    const result = await this.invoke("get_saved_campaigns_count", [encAddress(user)]);
    return result ? result.u32() : 0;
  }

  // ── Voting ───────────────────────────────────────────────────────────────

  /** `get_approve_votes(campaign_id)` */
  async getApproveVotes(campaignId: number): Promise<number> {
    const result = await this.invoke("get_approve_votes", [encU32(campaignId)]);
    return result ? result.u32() : 0;
  }

  /** `get_reject_votes(campaign_id)` */
  async getRejectVotes(campaignId: number): Promise<number> {
    const result = await this.invoke("get_reject_votes", [encU32(campaignId)]);
    return result ? result.u32() : 0;
  }

  /** `has_voted(campaign_id, voter)` */
  async hasVoted(campaignId: number, voter: string): Promise<boolean> {
    const result = await this.invoke("has_voted", [encU32(campaignId), encAddress(voter)]);
    return result?.b() ?? false;
  }

  /** `get_min_votes_quorum()` */
  async getMinVotesQuorum(): Promise<number> {
    const result = await this.invoke("get_min_votes_quorum");
    return result ? result.u32() : 0;
  }

  /** `get_approval_threshold_bps()` */
  async getApprovalThresholdBps(): Promise<number> {
    const result = await this.invoke("get_approval_threshold_bps");
    return result ? result.u32() : 0;
  }

  // ── Moderation ───────────────────────────────────────────────────────────

  /** `is_comment_censured(campaign_id, comment_hash)` — hash is 32-byte hex. */
  async isCommentCensured(campaignId: number, commentHash: string): Promise<boolean> {
    const result = await this.invoke("is_comment_censured", [encU32(campaignId), encBytes32(commentHash)]);
    return result?.b() ?? false;
  }

  // ── Vesting reserve ──────────────────────────────────────────────────────

  /** `get_campaign_reserve(campaign_id)` — `Option<CampaignReserve>`. */
  async getCampaignReserve(campaignId: number): Promise<SpecCampaignReserve | null> {
    const result = await this.invoke("get_campaign_reserve", [encU32(campaignId)]);
    return decodeSpecCampaignReserve(result);
  }
}

/** Build a generated client over a read transport. */
export function createGeneratedClient(invoke: InvokeView): ProofOfHeartGeneratedClient {
  return new ProofOfHeartGeneratedClient(invoke);
}
