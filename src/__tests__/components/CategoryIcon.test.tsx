import { render, screen } from "@testing-library/react";
import CategoryIcon from "@/components/CategoryIcon";
import { Category } from "@/types";

describe("CategoryIcon", () => {
  it.each([
    [Category.Learner, "category-icon-learner"],
    [Category.EducationalStartup, "category-icon-startup"],
    [Category.Educator, "category-icon-educator"],
    [Category.Publisher, "category-icon-publisher"],
  ])("renders a decorative SVG for category %s", (category, testId) => {
    render(<CategoryIcon category={category} className="extra" />);

    const icon = screen.getByTestId(testId);
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("extra");
    expect(icon).toHaveClass("group-hover:scale-110");
    expect(icon).toHaveClass("motion-reduce:transition-none");
  });

  it("renders nothing for an unknown category value", () => {
    const { container } = render(<CategoryIcon category={99 as Category} />);

    expect(container).toBeEmptyDOMElement();
  });
});
