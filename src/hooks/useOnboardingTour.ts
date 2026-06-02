"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "onboarding_tour_dismissed";

export function useOnboardingTour() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  return { show, dismiss };
}
