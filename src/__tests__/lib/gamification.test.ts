import { calculateGamificationProfile } from "@/lib/gamification";

describe("calculateGamificationProfile", () => {
  it.each([
    [0, "Bronze"],
    [99, "Bronze"],
    [100, "Silver"],
    [500, "Gold"],
    [2000, "Platinum"],
    [5000, "Diamond"],
  ])("assigns %i XLM to the %s tier", (total, levelId) => {
    expect(calculateGamificationProfile(total).levelId).toBe(levelId);
  });

  it("keeps zero and negative totals on Bronze and leaves badges locked", () => {
    const zero = calculateGamificationProfile(0);
    const negative = calculateGamificationProfile(-50, 3);

    expect(zero.progressPercent).toBe(0);
    expect(negative.levelId).toBe("Bronze");
    expect(negative.badges.find((b) => b.id === "whale")?.unlocked).toBe(false);
  });
});
