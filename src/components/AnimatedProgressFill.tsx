"use client";

import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function AnimatedProgressFill({ targetPct }: { targetPct: number }) {
  const prefersReducedMotion = useReducedMotion();
  const hasMountedRef = useRef(false);
  const springPct = useSpring(targetPct, { stiffness: 120, damping: 20, mass: 0.6 });
  const barWidth = useTransform(springPct, (v) => `${v}%`);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      springPct.jump(targetPct);
      return;
    }
    springPct.set(targetPct);
  }, [targetPct, springPct]);

  if (prefersReducedMotion) {
    return (
      <div
        aria-hidden="true"
        className="bg-linear-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
        style={{ width: `${targetPct}%` }}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      className="bg-linear-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
      style={{ width: barWidth }}
    />
  );
}
