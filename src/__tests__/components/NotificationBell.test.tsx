import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "@/components/NotificationBell";

jest.mock("@/components/WalletContext", () => ({ useWallet: () => ({ publicKey: "GTEST" }) }));
jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0, markAllRead: jest.fn(), markRead: jest.fn() }),
}));

describe("NotificationBell", () => {
  it("shows an empty state message when there are no notifications", async () => {
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("noNotifications")).toBeInTheDocument();
  });
});
