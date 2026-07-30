"use client";

import React from "react";
import { calculateGamificationProfile } from "../lib/gamification";

interface DonatorBadgesProps {
  totalDonated: number;
  donationCount?: number;
  isEarlyBacker?: boolean;
}

export function DonatorBadges({
  totalDonated,
  donationCount = 0,
  isEarlyBacker = false,
}: DonatorBadgesProps) {
  const profile = calculateGamificationProfile(totalDonated, donationCount, isEarlyBacker);

  return (
    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm space-y-4">
      {/* Level & Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Level {profile.levelNumber}: {profile.level}
            </span>
            <span className="text-xs text-slate-400">{profile.totalDonated} XLM Total</span>
          </div>
          {profile.progressPercent < 100 && (
            <span className="text-xs text-slate-400">Next: {profile.nextLevelThreshold} XLM</span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
            style={{ width: `${profile.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Badges List */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Earned Badges
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {profile.badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                badge.unlocked
                  ? `${badge.color} shadow-sm`
                  : "bg-slate-900/40 text-slate-500 border-slate-800/60 opacity-60"
              }`}
            >
              <span className="text-xl leading-none">{badge.icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate">{badge.name}</span>
                <span className="text-[10px] text-slate-400 truncate">
                  {badge.unlocked ? badge.description : "Locked"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
