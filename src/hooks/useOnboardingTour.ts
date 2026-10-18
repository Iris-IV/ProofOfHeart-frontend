"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "onboarding_tour_dismissed";

export function useOnboardingTour(totalSteps = 1) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const lastStep = Math.max(0, totalSteps - 1);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
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
  const next = () => setStep((current) => Math.min(current + 1, lastStep));
  const previous = () => setStep((current) => Math.max(current - 1, 0));

  return { show, step, next, previous, dismiss, isFirst: step === 0, isLast: step === lastStep };
}

  return { show, dismiss };
}
