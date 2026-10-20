import { Category } from "@/types";
import { CAMPAIGN_ACTIVE, CAMPAIGN_VALIDATED } from "@/lib/campaignStatusFlags";
import { parseContractError } from "@/utils/contractErrors";

type LoadClientOptions = {
  useMocks: boolean;
  simulateThrow?: Error;
};

const TEST_ADMIN = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB";
const TEST_USER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC";
const TEST_NEW_ADMIN = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD";

function makeScValHelpers() {
  const scVal = {
    void() {
      return { switch: () => ({ name: "scvVoid" }), toXDR: () => "void" };
    },
    u32(value: number) {
      return { u32: () => value, switch: () => ({ name: "scvU32" }), toXDR: () => `u32:${value}` };
    },
    u64(value: number) {
      return { u64: () => BigInt(value), toXDR: () => `u64:${value}` };
    },
    bool(value: boolean) {
      return { b: () => value, toXDR: () => `bool:${value}` };
    },
    str(value: string) {
      return { str: () => ({ toString: () => value }), toXDR: () => `str:${value}` };
    },
    bigint(value: bigint | number) {
      return { __bigint: BigInt(value), toXDR: () => `i128:${BigInt(value)}` };
    },
    address(value: string) {
      return {
        __address: value,
        switch: () => ({ name: "scvAddress" }),
        toXDR: () => `address:${value}`,
      };
    },
    symbol(value: string) {
      return { sym: () => ({ toString: () => value }), toXDR: () => `symbol:${value}` };
    },
    vec(values: unknown[]) {
      return { vec: () => values, toXDR: () => `vec:${values.length}` };
    },
    map(fields: Record<string, unknown>) {
      return {
        map: () =>
          Object.entries(fields).map(([key, val]) => ({
            key: () => scVal.symbol(key),
            val: () => val,
          })),
      };
    },
  };
  return scVal;
}

type MockMapEntry = { key: { sym: () => { toString: () => string } }; val: unknown };

/** Entries of an ScVal map built by the mocked `xdr.ScVal.scvMap`. */
function mapEntries(scValMap: unknown): MockMapEntry[] {
  return (scValMap as { __map: MockMapEntry[] }).__map;
}

function entryValue(entries: MockMapEntry[], name: string): unknown {
  const entry = entries.find((e) => e.key.sym().toString() === name);
  if (!entry) throw new Error(`missing map key ${name}`);
  return entry.val;
}

function findCreateCall(mockServer: { simulateTransaction: jest.Mock }): unknown[] | undefined {
  return mockServer.simulateTransaction.mock.calls.find(
    ([tx]: [{ ops?: Array<{ method?: string }> }]) => tx.ops?.[0]?.method === "create_campaign",
  );
}

function makeCampaignFixture() {
  const scVal = makeScValHelpers();

  return scVal.map({
    id: scVal.u32(7),
    creator: scVal.address(TEST_ADMIN),
    title: scVal.str("Fixture Campaign"),
    description: scVal.str("Fixture Description"),
    funding_goal: scVal.bigint(500_000_000),
    deadline: scVal.u64(1_900_000_000),
    amount_raised: scVal.bigint(125_000_000),
    // Active + validated. The contract stores lifecycle state as one bitfield.
    status: scVal.u32(CAMPAIGN_ACTIVE | CAMPAIGN_VALIDATED),
    category: scVal.u32(Category.EducationalStartup),
    has_revenue_sharing: scVal.bool(true),
    revenue_share_percentage: scVal.u32(350),
    first_creator: scVal.address(TEST_ADMIN),
    pending_creator: scVal.void(),
    pending_creator_expiry: scVal.u64(0),
    max_contribution_per_user: scVal.bigint(0),
    fee_override: scVal.u32(300),
    deadline_extended: scVal.bool(false),
    effective_amount_raised: scVal.bigint(125_000_000),
    tags: scVal.vec([scVal.str("education"), scVal.str("impact")]),
  });
}

async function loadClient(options: LoadClientOptions) {
  jest.resetModules();
  process.env.NEXT_PUBLIC_USE_MOCKS = options.useMocks ? "true" : "false";
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = "CCONTRACT";
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://example-rpc.invalid";

  const campaignFixture = makeCampaignFixture();
  const scVal = makeScValHelpers();
  let txCounter = 0;

  const mockServer = {
    getAccount: jest.fn().mockImplementation(async (publicKey: string) => ({
      accountId: () => publicKey,
      sequenceNumber: () => "1",
    })),
    simulateTransaction: jest
      .fn()
      .mockImplementation((tx: { ops?: Array<{ method?: string }> }) => {
        if (options.simulateThrow) {
          throw options.simulateThrow;
        }

        const method = tx.ops?.[0]?.method;
        if (method === "get_campaign_count") return { result: { retval: scVal.u32(1) } };
        if (method === "get_campaign") return { result: { retval: campaignFixture } };
        if (
          method === "list_campaigns" ||
          method === "get_campaigns_by_category" ||
          method === "get_creator_campaigns"
        ) {
          // (Vec<Campaign>, next_cursor): a single short page holding one campaign.
          return {
            result: { retval: scVal.vec([scVal.vec([campaignFixture]), scVal.u32(1)]) },
          };
        }
        if (method === "get_contribution") return { result: { retval: scVal.bigint(100_000_000) } };
        if (method === "get_revenue_pool") return { result: { retval: scVal.bigint(500_000_000) } };
        if (method === "get_revenue_claimed")
          return { result: { retval: scVal.bigint(25_000_000) } };
        if (method === "get_admin") return { result: { retval: scVal.address(TEST_ADMIN) } };
        if (method === "get_platform_fee") return { result: { retval: scVal.u32(250) } };
        if (method === "get_approve_votes") return { result: { retval: scVal.u32(12) } };
        if (method === "get_reject_votes") return { result: { retval: scVal.u32(3) } };
        if (method === "has_voted") return { result: { retval: scVal.bool(true) } };
        if (method === "get_min_votes_quorum") return { result: { retval: scVal.u32(10) } };
        if (method === "get_approval_threshold_bps") return { result: { retval: scVal.u32(5000) } };

        return { result: { retval: null } };
      }),
    sendTransaction: jest.fn().mockImplementation(() => {
      txCounter += 1;
      return { status: "PENDING", hash: `hash-${txCounter}` };
    }),
    getTransaction: jest.fn().mockImplementation((hash: string) => ({
      status: "SUCCESS",
      txHash: hash,
      // `create_campaign` returns the new campaign id as a u32.
      returnValue: scVal.u32(42),
    })),
  };

  const serverUrls: string[] = [];

  class MockServer {
    constructor(url: string) {
      serverUrls.push(url);
      return mockServer;
    }
  }

  class MockContract {
    constructor(private readonly _address: string) {}

    call(method: string, ...args: unknown[]) {
      return { method, args };
    }
  }

  class MockAddress {
    constructor(private readonly value: string) {}

    toScVal() {
      return scVal.address(this.value);
    }

    static fromScVal(value: { __address?: string }) {
      return { toString: () => value.__address ?? "" };
    }
  }

  class MockAccount {
    constructor(
      private readonly _id: string,
      private readonly _seq: string,
    ) {}

    accountId() {
      return this._id;
    }

    sequenceNumber() {
      return this._seq;
    }
  }

  class MockTransactionBuilder {
    private ops: unknown[] = [];

    constructor(
      private readonly _source: unknown,
      private readonly _config: unknown,
    ) {}

    addOperation(op: unknown) {
      this.ops.push(op);
      return this;
    }

    setTimeout(_timeout: number) {
      return this;
    }

    build() {
      return {
        ops: this.ops,
        toXDR: () => "unsigned-xdr",
      };
    }

    static fromXDR(_xdr: string, _passphrase: string) {
      return { signatures: [] };
    }
  }

  class MockScMapEntry {
    key: unknown;
    val: unknown;

    constructor(init: { key: unknown; val: unknown }) {
      this.key = init.key;
      this.val = init.val;
    }
  }

  const stellarSdkMock = {
    BASE_FEE: "100",
    Account: MockAccount,
    Address: MockAddress,
    Contract: MockContract,
    Keypair: {
      random: () => ({ publicKey: () => "GRANDOM" }),
    },
    TransactionBuilder: MockTransactionBuilder,
    nativeToScVal: (value: unknown, options?: { type?: string }) => {
      switch (options?.type) {
        case "u32":
          return scVal.u32(Number(value));
        case "u64":
          return scVal.u64(Number(value));
        case "bool":
          return scVal.bool(Boolean(value));
        case "string":
          return scVal.str(String(value));
        case "i128":
          return scVal.bigint(value as bigint | number);
        default:
          return value;
      }
    },
    scValToBigInt: (value: { __bigint?: bigint }) => BigInt(value.__bigint ?? 0),
    rpc: {
      Server: MockServer,
      Api: {
        isSimulationError: (result: { __simulationError?: boolean }) =>
          Boolean(result?.__simulationError),
      },
      assembleTransaction: jest.fn().mockImplementation(() => ({
        build: () => ({
          toXDR: () => "prepared-xdr",
          fee: "4321",
        }),
      })),
    },
    xdr: {
      ScVal: {
        scvSymbol: (value: string) => scVal.symbol(value),
        scvMap: (entries: unknown[]) => ({ __map: entries, toXDR: () => `map:${entries.length}` }),
      },
      ScMapEntry: MockScMapEntry,
    },
    __campaignFixture: campaignFixture,
  };

  jest.doMock("@stellar/stellar-sdk", () => stellarSdkMock);
  jest.doMock("@stellar/freighter-api", () => ({
    getAddress: jest.fn().mockResolvedValue({ address: TEST_ADMIN }),
    signTransaction: jest.fn().mockResolvedValue({ signedTxXdr: "signed-xdr" }),
  }));

  const module = await import("../../lib/contractClient");
  return { module, mockServer, stellarSdkMock, serverUrls };
}

describe("contractClient", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("mock branch returns expected shape and mutation responses", async () => {
    const { module } = await loadClient({ useMocks: true });

    const beforeCount = await module.getCampaignCount();
    const campaigns = await module.getAllCampaigns();

    expect(Array.isArray(campaigns)).toBe(true);
    expect(campaigns[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        title: expect.any(String),
        creator: expect.any(String),
        funding_goal: expect.anything(),
        amount_raised: expect.anything(),
      }),
    );
    expect(typeof campaigns[0].funding_goal).toBe("bigint");
    expect(typeof campaigns[0].amount_raised).toBe("bigint");

    const createdTx = await module.createCampaign(
      TEST_USER,
      "New Campaign",
      "Campaign description",
      BigInt(123_000_000),
      45,
      Category.Educator,
      false,
      0,
      ["tag-a", "tag-b"],
    );
    expect(createdTx).toEqual({
      txHash: "mock_tx_create_campaign",
      campaignId: beforeCount + 1,
    });
    expect(await module.getCampaignCount()).toBe(beforeCount + 1);

    expect(await module.getCampaign(1)).not.toBeNull();
    expect(await module.getContribution(1, TEST_USER)).toBe(BigInt(0));
    expect(await module.getRevenuePool(1)).toBe(BigInt(0));
    expect(await module.getRevenueClaimed(1, TEST_USER)).toBe(BigInt(0));
    expect(await module.getAdmin()).toContain("GADMIN");
    expect(await module.getPlatformFee()).toBe(250);

    expect(await module.init(TEST_ADMIN, TEST_USER, 250)).toBe("mock_tx_init");
    expect(await module.contribute(1, TEST_USER, BigInt(10))).toBe("mock_tx_contribute");
    expect(await module.withdrawFunds(1)).toBe("mock_tx_withdraw_funds");
    expect(await module.cancelCampaign(1)).toBe("mock_tx_cancel_campaign");
    expect(await module.claimRefund(1, TEST_USER)).toBe("mock_tx_claim_refund");
    expect(await module.depositRevenue(1, BigInt(50))).toBe("mock_tx_deposit_revenue");
    expect(await module.claimRevenue(1, TEST_USER)).toBe("mock_tx_claim_revenue");
    expect(await module.verifyCampaign(1)).toBe("mock_tx_verify_campaign");
    expect(await module.updatePlatformFee(300)).toBe("mock_tx_update_platform_fee");
    expect(await module.updateAdmin(TEST_NEW_ADMIN)).toBe("mock_tx_update_admin");
    expect(await module.getApproveVotes(1)).toBe(0);
    expect(await module.getRejectVotes(1)).toBe(0);
    expect(await module.hasVoted(1, TEST_USER)).toBe(false);
    expect(await module.getMinVotesQuorum()).toBe(10);
    expect(await module.getApprovalThresholdBps()).toBe(5000);
    expect(await module.voteOnCampaign(1, TEST_USER, true)).toBe("mock_tx_vote_1_approve");
    expect(await module.verifyCampaignWithVotes(1)).toBe("mock_tx_verify_with_votes");
  });

  it("decodeCampaign round-trips a fixture map", async () => {
    const { module, stellarSdkMock } = await loadClient({ useMocks: true });
    const decoded = module.__testUtils.decodeCampaign(stellarSdkMock.__campaignFixture as never);

    expect(decoded).toEqual(
      expect.objectContaining({
        id: 7,
        creator: TEST_ADMIN,
        title: "Fixture Campaign",
        description: "Fixture Description",
        funding_goal: BigInt(500_000_000),
        amount_raised: BigInt(125_000_000),
        category: Category.EducationalStartup,
        has_revenue_sharing: true,
        revenue_share_percentage: 350,
      }),
    );
    expect(decoded.tags).toEqual(["education", "impact"]);

    // Lifecycle state comes from the `status` bitfield (ACTIVE | VALIDATED here).
    expect(decoded).toEqual(
      expect.objectContaining({
        status: "verified",
        is_active: true,
        is_verified: true,
        is_cancelled: false,
        funds_withdrawn: false,
        first_creator: TEST_ADMIN,
        pending_creator: null,
        pending_creator_expiry: 0,
        max_contribution_per_user: BigInt(0),
        fee_override: 300,
        deadline_extended: false,
        effective_amount_raised: BigInt(125_000_000),
      }),
    );
    // The contract does not store a creation time.
    expect(decoded.created_at).toBeUndefined();
  });

  it("createCampaign encodes tags into the off-chain POH_EXT blob on the non-mock path", async () => {
    const { module, mockServer } = await loadClient({ useMocks: false });

    await module.createCampaign(
      TEST_USER,
      "On-chain campaign",
      "Description",
      BigInt(1_000_000_000),
      30,
      Category.Learner,
      false,
      0,
      ["alpha", "beta"],
    );

    const createCall = mockServer.simulateTransaction.mock.calls.find(
      ([tx]: [{ ops?: Array<{ method?: string }> }]) => tx.ops?.[0]?.method === "create_campaign",
    );
    expect(createCall).toBeDefined();

    const [tx] = createCall as [{ ops: Array<{ args: unknown[] }> }];
    const entries = mapEntries(tx.ops[0].args[0]);
    const description = entryValue(entries, "description") as {
      str: () => { toString: () => string };
    };
    const finalDescription = description.str().toString();

    expect(finalDescription).toContain("===POH_EXT===");
    const ext = JSON.parse(finalDescription.split("===POH_EXT===\n")[1]);
    expect(ext.tags).toEqual(["alpha", "beta"]);

    // Tags travel in the description blob because CreateCampaignParams has no field for them.
    expect(tx.ops[0].args).toHaveLength(1);
  });

  it("createCampaign sends one CreateCampaignParams struct with sorted keys and the per-wallet cap", async () => {
    const { module, mockServer } = await loadClient({ useMocks: false });

    await module.createCampaign(
      TEST_USER,
      "Struct campaign",
      "Description",
      BigInt(1_000_000_000),
      30,
      Category.Learner,
      false,
      0,
      [],
      BigInt(2_500_000_000),
    );

    const [tx] = findCreateCall(mockServer) as [{ ops: Array<{ args: unknown[] }> }];
    const entries = mapEntries(tx.ops[0].args[0]);

    // Soroban requires struct map keys in sorted order.
    expect(entries.map((entry) => entry.key.sym().toString())).toEqual([
      "category",
      "creator",
      "description",
      "duration_days",
      "funding_goal",
      "has_revenue_sharing",
      "max_contribution_per_user",
      "revenue_share_percentage",
      "title",
    ]);
    expect(entryValue(entries, "max_contribution_per_user")).toEqual({
      __bigint: BigInt(2_500_000_000),
      toXDR: expect.any(Function),
    });
  });

  it("createCampaign defaults the per-wallet cap to 0, the contract's no-cap sentinel", async () => {
    const { module, mockServer } = await loadClient({ useMocks: false });

    await module.createCampaign(
      TEST_USER,
      "Uncapped campaign",
      "Description",
      BigInt(1_000_000_000),
      30,
      Category.Learner,
      false,
      0,
      [],
    );

    const [tx] = findCreateCall(mockServer) as [{ ops: Array<{ args: unknown[] }> }];
    const cap = entryValue(mapEntries(tx.ops[0].args[0]), "max_contribution_per_user") as {
      __bigint: bigint;
    };
    expect(cap.__bigint).toBe(BigInt(0));
  });

  it("createCampaign returns the campaign id the contract returned", async () => {
    const { module } = await loadClient({ useMocks: false });

    const result = await module.createCampaign(
      TEST_USER,
      "Id campaign",
      "Description",
      BigInt(1_000_000_000),
      30,
      Category.Learner,
      false,
      0,
      [],
    );

    expect(result).toEqual({ txHash: "hash-1", campaignId: 42 });
  });

  it("createCampaign rejects a negative per-wallet cap before simulating", async () => {
    const { module, mockServer } = await loadClient({ useMocks: false });

    await expect(
      module.createCampaign(
        TEST_USER,
        "Negative cap",
        "Description",
        BigInt(1_000_000_000),
        30,
        Category.Learner,
        false,
        0,
        [],
        BigInt(-1),
      ),
    ).rejects.toThrow();
    expect(mockServer.simulateTransaction).not.toHaveBeenCalled();
  });

  it("rejects campaign creation before simulation when the creator account does not exist", async () => {
    const { module, mockServer } = await loadClient({ useMocks: false });
    mockServer.getAccount.mockRejectedValueOnce(new Error("404 account not found"));

    await expect(
      module.createCampaign(
        TEST_USER,
        "On-chain campaign",
        "Description",
        BigInt(1_000_000_000),
        30,
        Category.Learner,
        false,
        0,
        [],
      ),
    ).rejects.toThrow("Creator account does not exist on the Stellar network.");
    expect(mockServer.simulateTransaction).not.toHaveBeenCalled();
  });

  it("estimates contribution fees from the RPC-assembled transaction", async () => {
    const { module, mockServer } = await loadClient({ useMocks: false });

    await expect(
      module.estimateContributeNetworkFee(7, TEST_USER, BigInt(50_000_000)),
    ).resolves.toBe(4321n);
    expect(mockServer.simulateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        ops: [expect.objectContaining({ method: "contribute" })],
      }),
    );
    expect(mockServer.sendTransaction).not.toHaveBeenCalled();
  });

  it("decodeCampaign parses tags from the off-chain POH_EXT blob when the contract map has no tags field", async () => {
    const { module } = await loadClient({ useMocks: true });
    const scVal = makeScValHelpers();

    const description = `Real description\n\n===POH_EXT===\n${JSON.stringify({
      tags: ["water", "rural"],
      coverImageUrl: "https://example.com/cover.png",
    })}`;

    const fixtureWithoutContractTags = scVal.map({
      id: scVal.u32(9),
      creator: scVal.address(TEST_ADMIN),
      title: scVal.str("No-tags-field campaign"),
      description: scVal.str(description),
      funding_goal: scVal.bigint(500_000_000),
      deadline: scVal.u64(1_900_000_000),
      amount_raised: scVal.bigint(0),
      // Active only: no validated, cancelled or succeeded bits.
      status: scVal.u32(CAMPAIGN_ACTIVE),
      category: scVal.u32(Category.Publisher),
      has_revenue_sharing: scVal.bool(false),
      revenue_share_percentage: scVal.u32(0),
      first_creator: scVal.address(TEST_ADMIN),
      pending_creator: scVal.void(),
      pending_creator_expiry: scVal.u64(0),
      max_contribution_per_user: scVal.bigint(0),
      fee_override: scVal.void(),
      deadline_extended: scVal.bool(false),
      effective_amount_raised: scVal.bigint(0),
      // Deliberately no `tags` field, matching the real contract's schema.
    });

    const decoded = module.__testUtils.decodeCampaign(fixtureWithoutContractTags as never);

    expect(decoded.tags).toEqual(["water", "rural"]);
    expect(decoded.cover_image_url).toBe("https://example.com/cover.png");
    expect(decoded.description).toBe("Real description");
  });

  it("parseContractError maps Contract error strings", () => {
    expect(parseContractError(new Error("Error(Contract, #3)"))).toBe(
      "ContractErrors.CampaignNotActive",
    );
    expect(parseContractError(new Error("Error(Contract, #16)"))).toBe(
      "ContractErrors.AlreadyVoted",
    );
  });

  it("fetch failures surface as parsed error messages", async () => {
    const { module } = await loadClient({
      useMocks: false,
      simulateThrow: new Error("fetch failed"),
    });

    await expect(module.getCampaignCount()).rejects.toThrow("fetch failed");
  });

  describe("paginated reads (no N-way fan-out)", () => {
    type Call = { method?: string; args?: Array<{ u32?: () => number }> };

    function methodsCalled(mockServer: { simulateTransaction: jest.Mock }): string[] {
      return mockServer.simulateTransaction.mock.calls.map(
        ([tx]: [{ ops?: Call[] }]) => tx.ops?.[0]?.method ?? "",
      );
    }

    function pageOf(
      scVal: ReturnType<typeof makeScValHelpers>,
      fixture: unknown,
      n: number,
      next: number,
    ) {
      return {
        result: {
          retval: scVal.vec([scVal.vec(Array.from({ length: n }, () => fixture)), scVal.u32(next)]),
        },
      };
    }

    it("listCampaigns issues exactly one list_campaigns view per page", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });

      const page = await module.listCampaigns({ cursor: 1, limit: 20 });

      expect(methodsCalled(mockServer)).toEqual(["list_campaigns"]);
      expect(page.campaigns).toHaveLength(1);
      // Short page => the listing is exhausted.
      expect(page.nextCursor).toBeNull();
    });

    it("passes an exclusive id cursor and caps the limit at LIST_MAX_LIMIT", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });

      await module.listCampaigns({ cursor: 51, limit: 500 });

      const [tx] = mockServer.simulateTransaction.mock.calls[0] as [{ ops?: Call[] }];
      expect(tx.ops?.[0]?.args?.[0]?.u32?.()).toBe(50);
      expect(tx.ops?.[0]?.args?.[1]?.u32?.()).toBe(50);
    });

    it("advances the cursor while pages are full", async () => {
      const { module, mockServer, stellarSdkMock } = await loadClient({ useMocks: false });
      const scVal = makeScValHelpers();
      mockServer.simulateTransaction.mockImplementation(() =>
        pageOf(scVal, stellarSdkMock.__campaignFixture, 2, 2),
      );

      const page = await module.listCampaigns({ cursor: 1, limit: 2 });

      expect(page.nextCursor).toBe(3);
    });

    it("routes category and creator filters to the contract indexes", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });

      await module.listCampaigns({ category: Category.Educator, limit: 10 });
      await module.listCampaigns({ creator: TEST_ADMIN, limit: 10 });

      expect(methodsCalled(mockServer)).toEqual([
        "get_campaigns_by_category",
        "get_creator_campaigns",
      ]);
    });

    it("loading N campaigns costs ceil(N / 50) calls, never N", async () => {
      const { module, mockServer, stellarSdkMock } = await loadClient({ useMocks: false });
      const scVal = makeScValHelpers();
      const total = 120;
      mockServer.simulateTransaction.mockImplementation((tx: { ops?: Call[] }) => {
        const op = tx.ops?.[0];
        const start = op?.args?.[0]?.u32?.() ?? 0;
        const n = Math.min(50, total - start);
        return pageOf(scVal, stellarSdkMock.__campaignFixture, n, start + n);
      });

      const all = await module.getAllCampaigns();

      expect(all).toHaveLength(total);
      const methods = methodsCalled(mockServer);
      expect(methods).toHaveLength(Math.ceil(total / 50));
      expect(new Set(methods)).toEqual(new Set(["list_campaigns"]));
      expect(methods).not.toContain("get_campaign");
    });

    it("getPlatformStats reads counts from one get_platform_stats call", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });
      const scVal = makeScValHelpers();
      mockServer.simulateTransaction.mockImplementation(() => ({
        result: {
          retval: scVal.map({
            total_campaigns: scVal.u32(42),
            active_campaigns: scVal.u32(30),
            verified_campaigns: scVal.u32(20),
            cancelled_campaigns: scVal.u32(2),
            total_amount_raised: scVal.bigint(9_000_000_000),
            stats_are_partial: scVal.bool(false),
          }),
        },
      }));

      const stats = await module.getPlatformStats();

      expect(stats.totalCampaigns).toBe(42);
      expect(stats.totalAmountRaised).toBe(BigInt(9_000_000_000));
      expect(methodsCalled(mockServer)).toEqual(["get_platform_stats"]);
    });
  });

  describe("on-chain bookmarks and creator revenue claim", () => {
    it("reads saved campaigns and the count from the contract", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });
      const scVal = makeScValHelpers();
      mockServer.simulateTransaction.mockImplementation(
        (tx: { ops?: Array<{ method?: string }> }) => {
          const method = tx.ops?.[0]?.method;
          if (method === "get_saved_campaigns") {
            return { result: { retval: scVal.vec([scVal.u32(3), scVal.u32(9)]) } };
          }
          if (method === "get_saved_campaigns_count") return { result: { retval: scVal.u32(2) } };
          return { result: { retval: null } };
        },
      );

      expect(await module.getSavedCampaigns(TEST_USER)).toEqual([3, 9]);
      expect(await module.getSavedCampaignsCount(TEST_USER)).toBe(2);
    });

    it("mock mode enforces the bookmark limit and duplicate checks", async () => {
      const { module } = await loadClient({ useMocks: true });

      await module.saveCampaign(TEST_USER, 1);
      await expect(module.saveCampaign(TEST_USER, 1)).rejects.toThrow(
        "ContractErrors.CampaignAlreadyBookmarked",
      );
      await module.batchSaveCampaigns(TEST_USER, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(await module.getSavedCampaignsCount(TEST_USER)).toBe(module.MAX_BOOKMARKS_PER_WALLET);
      await expect(module.saveCampaign(TEST_USER, 11)).rejects.toThrow(
        "ContractErrors.BookmarkLimitReached",
      );

      await module.removeSavedCampaign(TEST_USER, 1);
      expect(await module.getSavedCampaigns(TEST_USER)).not.toContain(1);
      await module.clearSavedCampaigns(TEST_USER);
      expect(await module.getSavedCampaigns(TEST_USER)).toEqual([]);
    });

    it("claimCreatorRevenue submits claim_creator_revenue for the campaign id", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });

      const txHash = await module.claimCreatorRevenue(7, TEST_ADMIN);

      expect(txHash).toMatch(/^hash-/);
      const methods = mockServer.simulateTransaction.mock.calls.map(
        ([tx]: [{ ops?: Array<{ method?: string }> }]) => tx.ops?.[0]?.method,
      );
      expect(methods).toContain("claim_creator_revenue");
    });
  });

  it("non-mock branch runs core read/write flows with mocked SDK", async () => {
    const { module } = await loadClient({ useMocks: false });

    expect(await module.getCampaignCount()).toBe(1);
    expect(await module.getCampaign(1)).toEqual(
      expect.objectContaining({
        id: 7,
        creator: TEST_ADMIN,
      }),
    );
    expect(await module.getAllCampaigns()).toHaveLength(1);
    expect(await module.getContribution(1, TEST_USER)).toBe(BigInt(100_000_000));
    expect(await module.getRevenuePool(1)).toBe(BigInt(500_000_000));
    expect(await module.getRevenueClaimed(1, TEST_USER)).toBe(BigInt(25_000_000));
    expect(await module.getAdmin()).toBe(TEST_ADMIN);
    expect(await module.getPlatformFee()).toBe(250);
    expect(await module.getApproveVotes(1)).toBe(12);
    expect(await module.getRejectVotes(1)).toBe(3);
    expect(await module.hasVoted(1, TEST_USER)).toBe(true);
    expect(await module.getMinVotesQuorum()).toBe(10);
    expect(await module.getApprovalThresholdBps()).toBe(5000);

    expect(await module.init(TEST_ADMIN, TEST_USER, 300)).toMatch(/^hash-/);
    const createdCampaign = await module.createCampaign(
      TEST_USER,
      "On-chain campaign",
      "Description",
      BigInt(1_000_000_000),
      30,
      Category.Learner,
      false,
      0,
      ["alpha"],
    );
    expect(createdCampaign.txHash).toMatch(/^hash-/);
    expect(await module.contribute(1, TEST_USER, BigInt(50_000_000))).toMatch(/^hash-/);
    expect(await module.withdrawFunds(1)).toMatch(/^hash-/);
    expect(await module.cancelCampaign(1)).toMatch(/^hash-/);
    expect(await module.claimRefund(1, TEST_USER)).toMatch(/^hash-/);
    expect(await module.depositRevenue(1, BigInt(80_000_000))).toMatch(/^hash-/);
    expect(await module.claimRevenue(1, TEST_USER)).toMatch(/^hash-/);
    expect(await module.verifyCampaign(1)).toMatch(/^hash-/);
    expect(await module.updatePlatformFee(350)).toMatch(/^hash-/);
    expect(await module.updateAdmin(TEST_NEW_ADMIN)).toMatch(/^hash-/);
    expect(await module.voteOnCampaign(1, TEST_USER, true)).toMatch(/^hash-/);
    expect(await module.verifyCampaignWithVotes(1)).toMatch(/^hash-/);
  });

  describe("RPC server lifecycle", () => {
    it("reuses one server across successful calls", async () => {
      const { module, serverUrls } = await loadClient({ useMocks: false });

      await module.getAdmin();
      await module.getPlatformFee();
      await module.getCampaignCount();

      expect(serverUrls).toEqual(["https://example-rpc.invalid"]);
    });

    it("reconnects on the next call after a transport failure", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });

      await module.getAdmin();
      expect(serverUrls).toHaveLength(1);

      const transportError = new TypeError("fetch failed");
      transportError.cause = Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ECONNREFUSED",
      });
      mockServer.simulateTransaction.mockImplementationOnce(() => {
        throw transportError;
      });
      module.clearContractCallCache();

      // Transport failures reconnect and retry transparently.
      await expect(module.getAdmin()).resolves.toBe(TEST_ADMIN);
      expect(serverUrls).toHaveLength(2);
    });

    it("reconnects after a timeout", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });

      await module.getAdmin();
      mockServer.simulateTransaction.mockImplementationOnce(() => {
        throw new Error("Request timed out after 30000ms");
      });
      module.clearContractCallCache();

      await expect(module.getAdmin()).resolves.toBe(TEST_ADMIN);
      expect(serverUrls).toHaveLength(2);
    });

    it("keeps the server when the node returns an application error", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });

      await module.getAdmin();
      mockServer.simulateTransaction.mockImplementationOnce(() => {
        throw new Error("Error(Contract, #6)");
      });
      module.clearContractCallCache();

      await expect(module.getAdmin()).rejects.toThrow();
      await expect(module.getAdmin()).resolves.toBe(TEST_ADMIN);
      expect(serverUrls).toHaveLength(1);
    });

    it("resetRpcServer() forces a reconnect", async () => {
      const { module, serverUrls } = await loadClient({ useMocks: false });

      await module.getAdmin();
      expect(serverUrls).toHaveLength(1);

      module.resetRpcServer();
      module.clearContractCallCache();
      await module.getAdmin();

      expect(serverUrls).toHaveLength(2);
    });
  });

  describe("RPC latency fallback", () => {
    const PRIMARY = "https://example-rpc.invalid";
    const FALLBACK = "https://fallback-rpc.invalid";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URL = FALLBACK;
      process.env.NEXT_PUBLIC_RPC_LATENCY_THRESHOLD_MS = "50";
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_SOROBAN_RPC_FALLBACK_URL;
      delete process.env.NEXT_PUBLIC_RPC_LATENCY_THRESHOLD_MS;
      jest.restoreAllMocks();
    });

    function delayed<T>(value: T, ms: number): Promise<T> {
      return new Promise((resolve) => setTimeout(() => resolve(value), ms));
    }

    it("retries on the fallback when the primary is slower than the threshold", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });
      const respond = mockServer.simulateTransaction.getMockImplementation()!;
      mockServer.simulateTransaction.mockImplementationOnce((tx) => delayed(respond(tx), 200));

      await expect(module.getAdmin()).resolves.toBe(TEST_ADMIN);

      expect(serverUrls).toEqual([PRIMARY, FALLBACK]);
      expect(module.getActiveRpcUrl()).toBe(FALLBACK);
    });

    it("keeps using the fallback for later calls without re-timing the primary", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });
      const respond = mockServer.simulateTransaction.getMockImplementation()!;
      mockServer.simulateTransaction.mockImplementationOnce((tx) => delayed(respond(tx), 200));

      await module.getAdmin();
      await module.getPlatformFee();

      expect(serverUrls).toEqual([PRIMARY, FALLBACK]);
    });

    it("switches immediately on a primary transport failure", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });
      mockServer.simulateTransaction.mockImplementationOnce(() => {
        throw new TypeError("fetch failed");
      });

      const started = Date.now();
      await expect(module.getAdmin()).resolves.toBe(TEST_ADMIN);

      expect(Date.now() - started).toBeLessThan(400);
      expect(serverUrls).toEqual([PRIMARY, FALLBACK]);
    });

    it("goes back to the primary once the retry window has passed", async () => {
      const { module, mockServer, serverUrls } = await loadClient({ useMocks: false });
      const respond = mockServer.simulateTransaction.getMockImplementation()!;
      mockServer.simulateTransaction.mockImplementationOnce((tx) => delayed(respond(tx), 200));
      await module.getAdmin();

      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now + module.RPC_PRIMARY_RETRY_AFTER_MS + 1);
      module.clearContractCallCache();
      await module.getAdmin();

      expect(module.getActiveRpcUrl()).toBe(PRIMARY);
      expect(serverUrls).toEqual([PRIMARY, FALLBACK, PRIMARY]);
    });

    it("still surfaces contract errors as user-facing messages through the fallback", async () => {
      const { module, mockServer } = await loadClient({ useMocks: false });
      mockServer.simulateTransaction.mockImplementation(() => {
        throw new Error("Error(Contract, #6)");
      });

      await expect(module.getAdmin()).rejects.toThrow(
        parseContractError(new Error("Error(Contract, #6)")),
      );
    });
  });
});
