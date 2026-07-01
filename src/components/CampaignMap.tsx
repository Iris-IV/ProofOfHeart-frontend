"use client";

import { useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Campaign, CATEGORY_LABELS } from "@/types";
import { formatAmount } from "@/lib/formatters";
import { useLocale } from "next-intl";

// Mock world-map coordinates for campaigns.
// The Campaign type has no location field on-chain; coordinates are derived
// from the campaign id so they remain stable across renders.
function mockCoordinates(id: number): { lat: number; lng: number; city: string } {
  const locations = [
    { lat: 40.71, lng: -74.01, city: "New York" },
    { lat: 51.51, lng: -0.13, city: "London" },
    { lat: 35.69, lng: 139.69, city: "Tokyo" },
    { lat: -23.55, lng: -46.63, city: "São Paulo" },
    { lat: 48.85, lng: 2.35, city: "Paris" },
    { lat: 1.35, lng: 103.82, city: "Singapore" },
    { lat: -33.87, lng: 151.21, city: "Sydney" },
    { lat: 55.75, lng: 37.62, city: "Moscow" },
    { lat: 19.08, lng: 72.88, city: "Mumbai" },
    { lat: 30.04, lng: 31.24, city: "Cairo" },
    { lat: -1.29, lng: 36.82, city: "Nairobi" },
    { lat: 6.52, lng: 3.38, city: "Lagos" },
  ];
  return locations[id % locations.length];
}

// Map lat/lng to percentage positions within the SVG map container.
// Equirectangular projection approximation.
function toPercent(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

interface Props {
  campaigns: Campaign[];
}

export default function CampaignMap({ campaigns }: Props) {
  const locale = useLocale();
  const [hovered, setHovered] = useState<number | null>(null);

  const active = campaigns.filter((c) => c.status === "active" || c.status === "verified");

  return (
    <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
        <MapPin className="text-blue-500" size={20} />
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Campaign Locations
        </h2>
        <span className="ml-auto text-xs text-zinc-400">{active.length} active campaigns</span>
      </div>

      {/* World map SVG background with pin overlays */}
      <div className="relative w-full bg-blue-50 dark:bg-zinc-950" style={{ paddingBottom: "50%" }}>
        {/* Simplified world map paths */}
        <svg
          viewBox="0 0 1000 500"
          className="absolute inset-0 w-full h-full opacity-30 dark:opacity-20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        >
          {/* North America */}
          <path d="M120,80 L240,60 L280,100 L300,140 L260,180 L220,200 L180,240 L150,260 L130,220 L110,180 L90,140 Z" className="text-zinc-400 dark:text-zinc-600" fill="currentColor" />
          {/* South America */}
          <path d="M200,280 L250,260 L280,300 L270,360 L250,420 L220,440 L200,400 L190,360 L185,320 Z" className="text-zinc-400 dark:text-zinc-600" fill="currentColor" />
          {/* Europe */}
          <path d="M440,60 L500,50 L520,80 L510,120 L480,140 L450,130 L430,110 L420,80 Z" className="text-zinc-400 dark:text-zinc-600" fill="currentColor" />
          {/* Africa */}
          <path d="M450,160 L510,150 L540,180 L550,240 L540,300 L520,340 L490,360 L460,340 L440,300 L430,240 L440,200 Z" className="text-zinc-400 dark:text-zinc-600" fill="currentColor" />
          {/* Asia */}
          <path d="M540,60 L720,40 L780,80 L800,130 L780,170 L740,180 L700,160 L660,170 L620,150 L580,160 L550,140 L530,110 Z" className="text-zinc-400 dark:text-zinc-600" fill="currentColor" />
          {/* Australia */}
          <path d="M760,300 L840,290 L880,310 L870,370 L830,390 L780,380 L750,350 Z" className="text-zinc-400 dark:text-zinc-600" fill="currentColor" />
        </svg>

        {/* Campaign pins */}
        {active.map((campaign) => {
          const coords = mockCoordinates(campaign.id);
          const { x, y } = toPercent(coords.lat, coords.lng);
          const isHovered = hovered === campaign.id;

          return (
            <div
              key={campaign.id}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -100%)" }}
            >
              <button
                className="relative group focus:outline-none"
                onMouseEnter={() => setHovered(campaign.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(campaign.id)}
                onBlur={() => setHovered(null)}
                aria-label={`Campaign: ${campaign.title} in ${coords.city}`}
              >
                <MapPin
                  size={22}
                  className={`transition-colors drop-shadow ${
                    isHovered ? "text-blue-600" : "text-blue-400"
                  }`}
                  fill={isHovered ? "rgb(37 99 235)" : "rgb(96 165 250)"}
                />

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-52 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg p-3 text-left pointer-events-none">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate mb-1">
                      {campaign.title}
                    </p>
                    <p className="text-xs text-zinc-400 mb-1">{coords.city}</p>
                    <p className="text-xs text-zinc-500">
                      {CATEGORY_LABELS[campaign.category]} ·{" "}
                      <span className="font-medium text-blue-500">
                        {formatAmount(campaign.amount_raised)} raised
                      </span>
                    </p>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend / campaign list */}
      {active.length > 0 && (
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-400 mb-3 font-medium uppercase tracking-wide">
            Active campaigns on map
          </p>
          <ul className="flex flex-wrap gap-2">
            {active.slice(0, 8).map((campaign) => {
              const coords = mockCoordinates(campaign.id);
              return (
                <li key={campaign.id}>
                  <Link
                    href={`/causes/${campaign.id}`}
                    locale={locale}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 px-3 py-1 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <MapPin size={10} />
                    <span className="truncate max-w-[120px]">{campaign.title}</span>
                    <span className="text-blue-400">· {coords.city}</span>
                    <ExternalLink size={10} className="shrink-0 opacity-50" />
                  </Link>
                </li>
              );
            })}
            {active.length > 8 && (
              <li className="inline-flex items-center px-3 py-1 text-xs text-zinc-400">
                +{active.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}

      {active.length === 0 && (
        <div className="p-8 text-center text-sm text-zinc-400">
          No active campaigns to display.
        </div>
      )}
    </div>
  );
}
