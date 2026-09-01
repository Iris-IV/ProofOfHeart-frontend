"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Campaign } from "@/types";
import { Link } from "@/i18n/routing";
import { useMemo } from "react";
import { useTranslations } from "next-intl";


const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

/** Geographic bounds of a WGS-84 coordinate. */
export const LATITUDE_BOUNDS = { min: -90, max: 90 } as const;
export const LONGITUDE_BOUNDS = { min: -180, max: 180 } as const;

/**
 * True when a campaign carries coordinates Leaflet can actually project.
 *
 * Presence and finiteness are not enough: Leaflet's Mercator projection blows
 * up on out-of-range latitudes (|lat| >= 90 projects to ±Infinity, which
 * throws inside `MapContainer` and takes the whole page down), and a longitude
 * outside ±180 places a marker off the world. Bad data from the contract or a
 * mistyped form entry therefore has to be rejected here, before it reaches
 * the map.
 */
export function hasValidCoordinates(
  campaign: Campaign,
): campaign is Campaign & { latitude: number; longitude: number } {
  const { latitude, longitude } = campaign;

  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= LATITUDE_BOUNDS.min &&
    latitude <= LATITUDE_BOUNDS.max &&
    longitude >= LONGITUDE_BOUNDS.min &&
    longitude <= LONGITUDE_BOUNDS.max
  );
}

export function filterByValidCoordinates(
  campaigns: Campaign[],
): (Campaign & { latitude: number; longitude: number })[] {
  return campaigns.filter((c): c is Campaign & { latitude: number; longitude: number } =>
    hasValidCoordinates(c),
  );
}

interface CampaignMapProps {
  campaigns: Campaign[];
  isLoading?: boolean;
}

export default function CampaignMap({ campaigns, isLoading = false }: CampaignMapProps) {
  const t = useTranslations("CampaignMap");
  const validCampaigns = useMemo(
    () => filterByValidCoordinates(Array.isArray(campaigns) ? campaigns : []),
    [campaigns],
  );

  const center = useMemo<[number, number]>(() => {
    if (validCampaigns.length === 0) return [20, 0];
    const latSum = validCampaigns.reduce((s, c) => s + c.latitude, 0);
    const lngSum = validCampaigns.reduce((s, c) => s + c.longitude, 0);
    return [latSum / validCampaigns.length, lngSum / validCampaigns.length];
  }, [validCampaigns]);

  if (isLoading) {
    return (
      <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
        <div className="h-[500px] w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="w-8 h-8 text-blue-500 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{t("loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (validCampaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
        <div className="text-4xl mb-4">🗺️</div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          {t("emptyTitle")}
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <MapContainer center={center} zoom={2} className="h-[500px] w-full" scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validCampaigns.map((campaign) => (
          <Marker key={campaign.id} position={[campaign.latitude, campaign.longitude]}>
            <Popup>
              <div className="min-w-[180px]">
                <Link
                  href={`/causes/${campaign.id}`}
                  className="font-semibold text-blue-600 hover:underline block mb-1"
                >
                  {campaign.title}
                </Link>
                <p className="text-xs text-zinc-500">
                  {campaign.description.length > 120
                    ? `${campaign.description.slice(0, 120)}...`
                    : campaign.description}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
