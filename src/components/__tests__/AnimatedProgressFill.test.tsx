import { render, screen } from "@testing-library/react";
import AnimatedProgressFill from "../AnimatedProgressFill";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ style, ...props }: React.ComponentProps<"div">) => (
      <div data-testid="motion-div" style={style} {...props} />
    ),
  },
  useSpring: (initial: number) => ({
    get: () => initial,
    set: jest.fn(),
    jump: jest.fn(),
  }),
  useTransform: (val: { get: () => number }) => `${val.get()}%`,
}));

jest.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: jest.fn(),
}));

import { useReducedMotion } from "@/hooks/useReducedMotion";

const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;

describe("AnimatedProgressFill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the final width immediately when reduced motion is preferred", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(<AnimatedProgressFill targetPct={75} />);

    const div = document.querySelector('[style*="width: 75%"]');
    expect(div).toBeInTheDocument();
  });

  it("renders the final width immediately when reduced motion is not preferred", () => {
    mockUseReducedMotion.mockReturnValue(false);

    render(<AnimatedProgressFill targetPct={50} />);

    const div = screen.getByTestId("motion-div");
    expect(div).toHaveStyle({ width: "50%" });
  });

  it("renders with aria-hidden", () => {
    mockUseReducedMotion.mockReturnValue(false);

    render(<AnimatedProgressFill targetPct={60} />);

    expect(screen.getByTestId("motion-div")).toHaveAttribute("aria-hidden", "true");
  });
});