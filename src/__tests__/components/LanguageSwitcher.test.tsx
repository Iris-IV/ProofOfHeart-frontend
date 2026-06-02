import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const mockReplace = jest.fn();

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === "selectLanguage") return "Select language";
    if (key === "currentLanguage") return `Current language: ${values?.language}`;
    if (key === "languageChanged") return `Language changed to ${values?.language}`;
    return key;
  },
}));

jest.mock("@/i18n/routing", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/causes",
  routing: { locales: ["en", "es"] },
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a native select with current language in the accessible name", () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole("combobox", { name: /Current language/i });
    expect(select).toHaveAttribute("lang", "en");
    expect(select).toHaveValue("en");
  });

  it("announces language changes and keeps focus on the select", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    const select = screen.getByRole("combobox", { name: /Current language/i });
    await user.selectOptions(select, "es");

    expect(mockReplace).toHaveBeenCalledWith("/causes", { locale: "es" });
    expect(screen.getByText("Language changed to Spanish")).toBeInTheDocument();
    await waitFor(() => expect(select).toHaveFocus());
  });
});
