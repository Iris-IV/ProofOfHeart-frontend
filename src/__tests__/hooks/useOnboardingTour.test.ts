import { renderHook, act } from "@testing-library/react";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";

const STORAGE_KEY = "onboarding_tour_dismissed";

beforeEach(() => {
  localStorage.clear();
});

describe("useOnboardingTour", () => {
  it("shows the tour when localStorage key is absent", () => {
    const { result } = renderHook(() => useOnboardingTour());
    expect(result.current.show).toBe(true);
  });

  it("does not show the tour when already dismissed", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    const { result } = renderHook(() => useOnboardingTour());
    expect(result.current.show).toBe(false);
  });

  it("dismiss sets localStorage and hides the tour", () => {
    const { result } = renderHook(() => useOnboardingTour());
    expect(result.current.show).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.show).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});
