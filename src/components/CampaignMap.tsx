"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Campaign } from "@/types";
import { Link } from "@/i18n/routing";
import { useMemo } from "react";

// Fix Leaflet default marker icon (broken in bundlers)
// https://github.com/Leaflet/Leaflet/issues/4968
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

export function hasValidCoordinates(
  campaign: Campaign,
): campaign is Campaign & { latitude: number; longitude: number } {
  return (
    campaign.latitude != null &&
    campaign.longitude != null &&
    Number.isFinite(campaign.latitude) &&
    Number.isFinite(campaign.longitude)
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
}

export default function CampaignMap({ campaigns }: CampaignMapProps) {
  const validCampaigns = useMemo(() => filterByValidCoordinates(campaigns), [campaigns]);

  const center = useMemo<[number, number]>(() => {
    if (validCampaigns.length === 0) return [20, 0];
    const latSum = validCampaigns.reduce((s, c) => s + c.latitude, 0);
    const lngSum = validCampaigns.reduce((s, c) => s + c.longitude, 0);
    return [latSum / validCampaigns.length, lngSum / validCampaigns.length];
  }, [validCampaigns]);

  if (validCampaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
        <div className="text-4xl mb-4">🗺️</div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          No campaigns with location data
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
          Campaigns with coordinates will appear on this map. Switch to list
          view to browse all campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <MapContainer
        center={center}
        zoom={2}
        className="h-[500px] w-full"
        scrollWheelZoom={true}
      >
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
