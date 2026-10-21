import { fireEvent, render, screen } from "@testing-library/react";
import Web3Explainer from "@/components/Web3Explainer";
import Tooltip from "@/components/Tooltip";
import FundingProgressBar from "@/components/FundingProgressBar";
import { formatExactXlm, formatStroops, getXlmAmountExplanation } from "@/lib/formatters";

// Interpolating stand-in so the explainer text can be asserted with values.
jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

jest.mock(
  "next/dynamic",
  () => () =>
    function AnimatedFill() {
      return null;
    },
);

function open(name: RegExp | string) {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.getByRole("tooltip");
}

describe("stroop formatters", () => {
  it("formats stroop counts with grouping", () => {
    expect(formatStroops(125_000_000n, "en")).toBe("125,000,000");
    expect(formatStroops(125_000_000n, "es")).toBe("125.000.000");
  });

  it("keeps all seven decimals without float rounding", () => {
    expect(formatExactXlm(125_000_001n, "en")).toBe("12.5000001");
    expect(formatExactXlm(10_000_000n, "en")).toBe("1");
    expect(formatExactXlm(1n, "en")).toBe("0.0000001");
    // Beyond float precision: 900,719,925.4740993 XLM.
    expect(formatExactXlm(9_007_199_254_740_993n, "en")).toBe("900,719,925.4740993");
    expect(formatExactXlm(-25_000_000n, "en")).toBe("-2.5");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatExactXlm(125_000_001n, "es")).toBe("12,5000001");
  });

  it("builds the stroop explanation", () => {
    expect(getXlmAmountExplanation(125_000_000n, "en")).toEqual({
      xlm: "12.5",
      stroops: "125,000,000",
      stroopsPerXlm: "10,000,000",
    });
  });
});

describe("Tooltip rich content", () => {
  it("renders a title above rich content", () => {
    render(
      <Tooltip
        title="Heading"
        label="Explain"
        content={
          <>
            Line with <strong>emphasis</strong>
          </>
        }
      />,
    );
    const tooltip = open("Explain");
    expect(tooltip).toHaveTextContent("Heading");
    expect(tooltip).toHaveTextContent("Line with emphasis");
    expect(tooltip).toHaveClass("ui-pop-in");
    expect(screen.getByRole("button", { name: "Explain" })).toHaveAttribute(
      "aria-describedby",
      tooltip.id,
    );
  });
});

describe("Tooltip viewport clamping", () => {
  const rect = (left: number, width: number) =>
    ({
      left,
      right: left + width,
      width,
      top: 0,
      bottom: 40,
      height: 40,
      x: left,
      y: 0,
    }) as DOMRect;

  afterEach(() => jest.restoreAllMocks());

  function openWithBubbleAt(left: number, width = 200, viewport = 320) {
    jest.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(viewport);
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute("role") === "tooltip" ? rect(left, width) : rect(0, 0);
    });
    render(<Tooltip label="Explain" content="Some help" />);
    return open("Explain");
  }

  it("nudges a bubble that would overflow the right edge back inside", () => {
    const tooltip = openWithBubbleAt(200); // right edge 400 > 320 - 8
    expect(tooltip.style.marginLeft).toBe("-88px");
    // The arrow moves the other way so it still points at the trigger.
    expect((tooltip.lastElementChild as HTMLElement).style.marginLeft).toBe("88px");
  });

  it("nudges a bubble that would overflow the left edge", () => {
    expect(openWithBubbleAt(-30).style.marginLeft).toBe("38px");
  });

  it("leaves a bubble that fits alone", () => {
    expect(openWithBubbleAt(50).style.marginLeft).toBe("");
  });
});

describe("Web3Explainer", () => {
  it("explains a specific amount in stroops", () => {
    render(<Web3Explainer topic="stroops" amount={125_000_001n} />);
    const tooltip = open("stroopsLabel");
    expect(tooltip).toHaveTextContent("stroopsTitle");
    expect(tooltip).toHaveTextContent(
      'stroopsAmount:{"xlm":"12.5000001","stroops":"125,000,001","stroopsPerXlm":"10,000,000"}',
    );
  });

  it("explains stroops in general without an amount", () => {
    render(<Web3Explainer topic="stroops" />);
    expect(open("stroopsLabel")).toHaveTextContent('stroopsBody:{"stroopsPerXlm":"10,000,000"}');
  });

  it.each([
    ["escrow", "escrowLabel", "escrowTitle", "escrowBody"],
    ["multiToken", "multiTokenLabel", "multiTokenTitle", "multiTokenBody"],
  ] as const)("explains %s", (topic, label, title, body) => {
    render(<Web3Explainer topic={topic} />);
    const tooltip = open(label);
    expect(tooltip).toHaveTextContent(title);
    expect(tooltip).toHaveTextContent(body);
  });
});

describe("FundingProgressBar explainers", () => {
  it("adds escrow and stroop explainers only when asked", () => {
    const { rerender } = render(
      <FundingProgressBar amountRaised={50_000_000n} fundingGoal={100_000_000n} />,
    );
    expect(screen.queryByRole("button", { name: "escrowLabel" })).toBeNull();

    rerender(<FundingProgressBar amountRaised={50_000_000n} fundingGoal={100_000_000n} explain />);
    expect(screen.getByRole("button", { name: "escrowLabel" })).toBeInTheDocument();
    expect(open("stroopsLabel")).toHaveTextContent('"stroops":"50,000,000"');
  });
});
