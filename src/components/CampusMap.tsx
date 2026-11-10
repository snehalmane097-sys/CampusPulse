"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AnalyticsDTO } from "@/types";

// Colour + radius scale so a heavily-reported block reads as an obvious
// hotspot at a glance, per the PDF's "Campus Issue Radar" feature.
function styleFor(count: number, max: number) {
  const ratio = max === 0 ? 0 : count / max;
  if (ratio > 0.66) return { color: "#E5555C", radius: 22, label: "High" as const };
  if (ratio > 0.33) return { color: "#F2A93B", radius: 16, label: "Medium" as const };
  return { color: "#3ED9A3", radius: 10, label: "Low" as const };
}

export default function CampusMap({ data }: { data: AnalyticsDTO | null }) {
  if (!data || data.hotspots.length === 0) {
    return (
      <div className="h-[360px] flex items-center justify-center text-sm text-slate-soft border border-white/10 rounded-2xl glass-card">
        No location data yet — hotspots appear as grievances come in.
      </div>
    );
  }

  const max = Math.max(...data.hotspots.map((h) => h.count));
  const center: [number, number] = [data.hotspots[0].lat, data.hotspots[0].lng];

  return (
    <div className="space-y-3">
      <div className="h-[360px] rounded-2xl overflow-hidden border border-white/10">
        <MapContainer center={center} zoom={16} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {data.hotspots.map((h) => {
            const { color, radius } = styleFor(h.count, max);
            return (
              <CircleMarker
                key={h.location}
                center={[h.lat, h.lng]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
              >
                <Tooltip direction="top">
                  {h.location}: {h.count} report{h.count === 1 ? "" : "s"}
                </Tooltip>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{h.location}</p>
                    <p>{h.count} total report{h.count === 1 ? "" : "s"}</p>
                    <p>{h.activeIncidents} active incident{h.activeIncidents === 1 ? "" : "s"}</p>
                    <p>Highest priority: {h.highestPriority ?? "None open"}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div className="flex items-center gap-5 text-xs text-slate-soft">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-signal inline-block" /> Low activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber inline-block" /> Medium activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-critical inline-block" /> High activity
        </span>
        <span className="ml-auto">Tap a marker for incident detail</span>
      </div>
    </div>
  );
}
