import {
  MAX_EXT_BYTES,
  MAX_EXT_MILESTONES,
  MAX_EXT_TAGS,
  MAX_TAG_LENGTH,
  POH_EXT_MARKER,
  parseCampaignExt,
  splitDescription,
} from "@/lib/campaignExt";

const COVER = "https://ipfs.io/ipfs/QmCoverHash";

describe("parseCampaignExt — cover image", () => {
  it("keeps an https URL on an allow-listed host", () => {
    const { ext, rejected } = parseCampaignExt(JSON.stringify({ coverImageUrl: COVER }));
    expect(ext.coverImageUrl).toBe(COVER);
    expect(rejected).toEqual([]);
  });

  it.each([
    ["a foreign host (tracking pixel)", "https://tracker.example/pixel.gif?id=1"],
    ["a suffix lookalike", "https://ipfs.io.evil.example/x.png"],
    ["a prefix lookalike", "https://evil-ipfs.io/x.png"],
    ["plain http", "http://ipfs.io/ipfs/x"],
    ["a data URL", "data:image/svg+xml;base64,PHN2Zy8+"],
    ["a javascript URL", "javascript:alert(1)"],
    ["embedded credentials", "https://user:pw@ipfs.io/ipfs/x"],
    ["a custom port", "https://ipfs.io:8443/ipfs/x"],
    ["a cloud metadata address", "https://169.254.169.254/latest/meta-data"],
    ["not a URL", "not a url"],
    ["an empty string", ""],
    ["an over-long URL", `https://ipfs.io/${"a".repeat(3000)}`],
  ])("drops %s and reports it", (_label, url) => {
    const { ext, rejected } = parseCampaignExt(JSON.stringify({ coverImageUrl: url }));
    expect(ext.coverImageUrl).toBeUndefined();
    expect(rejected).toContain("coverImageUrl");
  });

  it.each([[42], [true], [{}], [["https://ipfs.io/x"]]])("drops a non-string cover (%j)", (value) => {
    const { ext, rejected } = parseCampaignExt(JSON.stringify({ coverImageUrl: value }));
    expect(ext.coverImageUrl).toBeUndefined();
    expect(rejected).toContain("coverImageUrl");
  });

  it("treats an absent or null cover as simply not set", () => {
    expect(parseCampaignExt("{}").rejected).toEqual([]);
    expect(parseCampaignExt('{"coverImageUrl":null}').rejected).toEqual([]);
  });
});

describe("parseCampaignExt — tags", () => {
  it("keeps well-formed tags, trimmed", () => {
    const { ext } = parseCampaignExt(JSON.stringify({ tags: ["water", " rural ", "Clean Water", "r&d"] }));
    expect(ext.tags).toEqual(["water", "rural", "Clean Water", "r&d"]);
  });

  it("drops bad tags one by one and keeps the rest", () => {
    const { ext, rejected } = parseCampaignExt(
      JSON.stringify({
        tags: ["ok", "<script>", "", "   ", 7, null, { a: 1 }, "x".repeat(MAX_TAG_LENGTH + 1), "line\nbreak", "fine"],
      }),
    );
    expect(ext.tags).toEqual(["ok", "fine"]);
    expect(rejected).toContain("tags");
  });

  it("de-duplicates case-insensitively and caps the count", () => {
    const many = Array.from({ length: MAX_EXT_TAGS + 10 }, (_, i) => `tag${i}`);
    expect(parseCampaignExt(JSON.stringify({ tags: ["Water", "water", "WATER"] })).ext.tags).toEqual(["Water"]);
    expect(parseCampaignExt(JSON.stringify({ tags: many })).ext.tags).toHaveLength(MAX_EXT_TAGS);
  });

  it("rejects a tags value that is not an array", () => {
    const { ext, rejected } = parseCampaignExt(JSON.stringify({ tags: "water" }));
    expect(ext.tags).toBeUndefined();
    expect(rejected).toContain("tags");
  });
});

describe("parseCampaignExt — milestones", () => {
  it("parses a valid plan, accepting string or integer amounts", () => {
    const { ext } = parseCampaignExt(
      JSON.stringify({
        milestones: [
          { targetAmount: "1000000000", description: "Phase 1" },
          { targetAmount: 2000, description: "Phase 2" },
        ],
      }),
    );
    expect(ext.milestones).toEqual([
      { targetAmount: 1_000_000_000n, description: "Phase 1" },
      { targetAmount: 2000n, description: "Phase 2" },
    ]);
  });

  it.each([
    ["a non-numeric amount", { targetAmount: "abc", description: "x" }],
    ["a negative amount", { targetAmount: "-5", description: "x" }],
    ["a fractional amount", { targetAmount: 1.5, description: "x" }],
    ["a missing description", { targetAmount: "5" }],
    ["an empty description", { targetAmount: "5", description: " " }],
  ])("drops the whole plan for %s", (_label, entry) => {
    const { ext, rejected } = parseCampaignExt(
      JSON.stringify({ milestones: [{ targetAmount: "1", description: "good" }, entry] }),
    );
    expect(ext.milestones).toBeUndefined();
    expect(rejected).toContain("milestones");
  });

  it("drops a plan with too many milestones", () => {
    const plan = Array.from({ length: MAX_EXT_MILESTONES + 1 }, () => ({ targetAmount: "1", description: "m" }));
    expect(parseCampaignExt(JSON.stringify({ milestones: plan })).ext.milestones).toBeUndefined();
  });
});

describe("parseCampaignExt — isolation and robustness", () => {
  it("one bad field never discards a good one", () => {
    const { ext, rejected } = parseCampaignExt(
      JSON.stringify({ coverImageUrl: "https://evil.example/x.png", tags: ["water"], milestones: "nope" }),
    );
    expect(ext).toEqual({ tags: ["water"] });
    expect(rejected.sort()).toEqual(["coverImageUrl", "milestones"]);
  });

  it("ignores unknown keys", () => {
    const { ext } = parseCampaignExt(JSON.stringify({ tags: ["a"], isVerified: true, admin: "GABC" }));
    expect(ext).toEqual({ tags: ["a"] });
  });

  it.each([["not json"], ["[]"], ["null"], ['"string"'], ["42"], [""]])("yields nothing for %j", (json) => {
    const { ext, rejected } = parseCampaignExt(json);
    expect(ext).toEqual({});
    expect(rejected).toEqual(["ext"]);
  });

  it("refuses an oversized blob without parsing it", () => {
    const huge = JSON.stringify({ tags: ["a"], pad: "x".repeat(MAX_EXT_BYTES) });
    const { ext, rejected } = parseCampaignExt(huge);
    expect(ext).toEqual({});
    expect(rejected).toEqual(["ext"]);
  });

  it("does not let __proto__ pollute anything", () => {
    parseCampaignExt('{"__proto__":{"polluted":true},"tags":["a"]}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("splitDescription", () => {
  it("returns the description untouched when there is no marker", () => {
    expect(splitDescription("Just text")).toEqual({ description: "Just text", ext: {}, rejected: [] });
  });

  it("splits at the marker and validates the payload", () => {
    const { description, ext } = splitDescription(
      `Real description${POH_EXT_MARKER}${JSON.stringify({ coverImageUrl: COVER, tags: ["water"] })}`,
    );
    expect(description).toBe("Real description");
    expect(ext).toEqual({ coverImageUrl: COVER, tags: ["water"] });
  });

  it("still cuts the marker off the description when the payload is unusable", () => {
    const { description, ext, rejected } = splitDescription(`Real description${POH_EXT_MARKER}{broken`);
    expect(description).toBe("Real description");
    expect(ext).toEqual({});
    expect(rejected).toEqual(["ext"]);
  });

  it("a second marker inside the payload makes the payload unusable rather than trusted", () => {
    const { ext } = splitDescription(
      `A${POH_EXT_MARKER}{"tags":["a"]}${POH_EXT_MARKER}{"coverImageUrl":"https://evil.example/x.png"}`,
    );
    expect(ext).toEqual({});
  });

  it("the post-verification swap: a marker appended later cannot load a foreign cover", () => {
    // A verified campaign whose description is rewritten on-chain to point the
    // cover at an arbitrary host.
    const swapped = `Verified campaign text${POH_EXT_MARKER}${JSON.stringify({
      coverImageUrl: "https://tracker.example/pixel.png?campaign=1",
    })}`;
    expect(splitDescription(swapped).ext.coverImageUrl).toBeUndefined();
  });
});
