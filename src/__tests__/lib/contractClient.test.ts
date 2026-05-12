import { Category } from "@/types";
import { parseContractError } from "@/utils/contractErrors";

type LoadClientOptions = {
  useMocks: boolean;
  simulateThrow?: Error;
};

const TEST_ADMIN = "GADMIN000000000000000000000000000000000000000000000000000000000";
const TEST_USER = "GUSER0000000000000000000000000000000000000000000000000000000000";
const TEST_NEW_ADMIN = "GNEWADMIN000000000000000000000000000000000000000000000000000000";

function makeScValHelpers() {
  const scVal = {
    u32(value: number) {
      return { u32: () => value };
    },
    u64(value: number) {
      return { u64: () => BigInt(value) };
    },
    bool(value: boolean) {
      return { b: () => value };
    },
    str(value: string) {
      return { str: () => ({ toString: () => value }) };
    },
    bigint(value: bigint | number) {
      return { __bigint: BigInt(value) };
    },
    address(value: string) {
      return { __address: value };
    },
    symbol(value: string) {
      return { sym: () => ({ toString: () => value }) };
    },
    vec(values: unknown[]) {
      return { vec: () => values };
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
    is_active: scVal.bool(true),
    status: scVal.str("active"),
    created_at: scVal.u64(1_800_000_000),
    funds_withdrawn: scVal.bool(false),
    is_cancelled: scVal.bool(false),
    is_verified: scVal.bool(true),
    category: scVal.u32(Category.EducationalStartup),
    has_revenue_sharing: scVal.bool(true),
    revenue_share_percentage: scVal.u32(350),
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
    getAccount: jest.fn().mockResolvedValue({ accountId: TEST_ADMIN, sequence: "1" }),
    simulateTransaction: jest.fn().mockImplementation((tx: { ops?: Array<{ method?: string }> }) => {
      if (options.simulateThrow) {
        throw options.simulateThrow;
      }

      const method = tx.ops?.[0]?.method;
      if (method === "get_campaign_count") return { result: { retval: scVal.u32(1) } };
      if (method === "get_campaign") return { result: { retval: campaignFixture } };
      if (method === "get_contribution") return { result: { retval: scVal.bigint(100_000_000) } };
      if (method === "get_revenue_pool") return { result: { retval: scVal.bigint(500_000_000) } };
      if (method === "get_revenue_claimed") return { result: { retval: scVal.bigint(25_000_000) } };
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
    })),
  };

  class MockServer {
    constructor() {
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
        }),
      })),
    },
    xdr: {},
    __campaignFixture: campaignFixture,
  };

  jest.doMock("@stellar/stellar-sdk", () => stellarSdkMock);
  jest.doMock("@stellar/freighter-api", () => ({
    getAddress: jest.fn().mockResolvedValue({ address: TEST_ADMIN }),
    signTransaction: jest.fn().mockResolvedValue({ signedTxXdr: "signed-xdr" }),
  }));

  const module = await import("../../lib/contractClient");
  return { module, mockServer, stellarSdkMock };
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
    expect(createdTx).toBe("mock_tx_create_campaign");
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
    expect(
      await module.createCampaign(
        TEST_USER,
        "On-chain campaign",
        "Description",
        BigInt(1_000_000_000),
        30,
        Category.Learner,
        false,
        0,
        ["alpha"],
      ),
    ).toMatch(/^hash-/);
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
});
