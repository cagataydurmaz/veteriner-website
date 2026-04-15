"use client";

import { ExternalLink, Navigation } from "lucide-react";

interface ClinicMapProps {
  /** Full address for confirmed appointments, city/district for approximate display */
  query: string;
  /** Latitude for precise OSM interactive embed (preferred over query-only) */
  lat?: number;
  /** Longitude for precise OSM interactive embed (preferred over query-only) */
  lng?: number;
  /** Display label shown above the map */
  label?: string;
  /** Zoom level: 15 for exact address, 13 for city area, 11 for wide city */
  zoom?: number;
  height?: number;
  showDirections?: boolean;
  /** When true renders a muted "approximate area" notice */
  approximate?: boolean;
}

/**
 * ClinicMap — Interactive map component.
 *
 * When `lat` + `lng` are provided, renders an interactive OpenStreetMap embed
 * (free, no API key required, fully interactive — pan & zoom).
 *
 * Falls back to Google Maps iframe embed (address string) when coordinates are
 * not available. Google Maps embed still works without an API key via the legacy
 * embed URL.
 */
export default function ClinicMap({
  query,
  lat,
  lng,
  label,
  zoom = 15,
  height = 200,
  showDirections = true,
  approximate = false,
}: ClinicMapProps) {
  const hasCoords = lat !== undefined && lng !== undefined;

  // ── Interactive OSM embed (preferred when coordinates are available) ────────
  // Uses OpenStreetMap export embed with bbox calculated from centre + zoom offset.
  // Zoom offset approximation: each zoom level halves the area.
  // zoom=11 → ±0.30°, zoom=13 → ±0.08°, zoom=15 → ±0.02°
  const zoomOffset = hasCoords
    ? zoom >= 15 ? 0.02 : zoom >= 13 ? 0.08 : 0.30
    : 0;

  const osmSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - zoomOffset},${lat! - zoomOffset},${lng! + zoomOffset},${lat! + zoomOffset}&layer=mapnik&marker=${lat},${lng}`
    : null;

  // ── Google Maps iframe fallback (address string) ────────────────────────────
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const encodedQuery = encodeURIComponent(query);
  const googleSrc = apiKey && apiKey !== "your_google_maps_api_key"
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedQuery}&zoom=${zoom}`
    : `https://maps.google.com/maps?q=${encodedQuery}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;

  const mapSrc = osmSrc ?? googleSrc;

  // ── Direction / view links ──────────────────────────────────────────────────
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodedQuery}`;

  const mapsUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-700">{label}</p>
          {approximate && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Yaklaşık konum
            </span>
          )}
        </div>
      )}

      <div
        className="rounded-xl overflow-hidden border border-gray-200 relative"
        style={{ height }}
      >
        <iframe
          src={mapSrc}
          width="100%"
          height={height}
          style={{ border: 0 }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={label || "Konum"}
          className="w-full h-full"
        />
        {/* Transparent overlay — clicking opens the full map */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0"
          aria-label={hasCoords ? "OpenStreetMap'te görüntüle" : "Google Maps'te görüntüle"}
        />
      </div>

      {showDirections && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 w-full justify-center py-2.5 px-4 bg-[#166534] hover:bg-[#14532D] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Navigation className="w-4 h-4" />
          Yol Tarifi Al
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      )}
    </div>
  );
}
