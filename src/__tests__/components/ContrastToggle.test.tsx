import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import ContrastToggle from "@/components/ContrastToggle";
import { useTheme } from "@/hooks/useTheme";
import { HIGH_CONTRAST_STORAGE_KEY, getThemeBlockingScript } from "@/lib/preferences";

function ThemeButton() {
  const { setTheme } = useTheme();
  return <button onClick={() => setTheme("dark")}>Dark</button>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.contrast;
});

it("persists daylight mode and restores the selected dark theme when disabled", async () => {
  render(<ThemeProvider><ContrastToggle /><ThemeButton /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Dark" }));
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  const toggle = screen.getByRole("button", { name: "highContrast" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY)).toBe("true");
  expect(document.documentElement.dataset.contrast).toBe("high");
  expect(document.documentElement).not.toHaveClass("dark");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(document.documentElement).toHaveClass("dark");
});

it("applies persisted high contrast before hydration and after mounting", () => {
  localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, "true");
  localStorage.setItem("theme", "dark");
  window.eval(getThemeBlockingScript());
  expect(document.documentElement.dataset.contrast).toBe("high");
  expect(document.documentElement).not.toHaveClass("dark");
  render(<ThemeProvider><ContrastToggle /></ThemeProvider>);
  expect(screen.getByRole("button", { name: "highContrast" })).toHaveAttribute("aria-pressed", "true");
});
