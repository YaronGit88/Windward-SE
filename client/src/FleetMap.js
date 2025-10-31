import React, { useEffect, useMemo, useState } from "react";

// Safely parse coordinates; prefer GeoJSON lastpos.geometry.coordinates [lng, lat]
function getLatLng(loc) {
  try {
    const coords = loc?.lastpos?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const [lng, lat] = coords;
      return { lat: Number(lat), lng: Number(lng) };
    }
  } catch (_) {
    // ignore and try fallbacks
  }
  // Fallbacks (common field names)
  const lat =
    parseFloat(loc?.lat ?? loc?.latitude ?? loc?.Lat ?? loc?.Latitude);
  const lng =
    parseFloat(loc?.lon ?? loc?.long ?? loc?.lng ?? loc?.longitude ?? loc?.Lon ?? loc?.Longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return { lat: null, lng: null };
}

// Format number to fixed decimals or "N/A"
const fmtNum = (n, digits = 5) => (Number.isFinite(n) ? n.toFixed(digits) : "N/A");

// Render-friendly placeholder for missing values
const display = (v) => (v === null || v === undefined || String(v).trim() === "" ? "N/A" : v);

// Choose provider at build/start time (default: leaflet). Values: leaflet | mapbox
const provider = (process.env.REACT_APP_MAP_PROVIDER || "leaflet").toLowerCase();

// Lazy-load only the selected provider. Contract: { points, center, zoom }
const ProviderImpl = React.lazy(() =>
  provider === "mapbox"
    ? import("./maps/FleetMapBox")
    : import("./maps/FleetMapLeaf")
);

// Helper: robustly convert ts to sortable millis
const tsToMillis = (ts) => {
  if (ts === null || ts === undefined) return -Infinity;
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  const asNum = Number(ts);
  if (Number.isFinite(asNum)) return asNum;
  const parsed = Date.parse(String(ts));
  return Number.isFinite(parsed) ? parsed : -Infinity;
};

// Helper: get vessel id from a location record
const getVesselIdFromLoc = (loc) =>
  loc?.vesselId ?? loc?.vessel_id ?? loc?._id ?? null;

// Helper: get lat/lng from GeoJSON [lng,lat]
const getLatLngFromLoc = (loc) => {
  const coords = loc?.lastpos?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lngRaw, latRaw] = coords;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    return {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  }
  return { lat: null, lng: null };
};

// Helper: get ts from lastpos
const getTsFromLoc = (loc) => loc?.lastpos?.ts ?? null;

export default function FleetMap({ vessels }) {
  const [points, setPoints] = useState([]);
  const [center, setCenter] = useState([0, 0]);
  const [zoom, setZoom] = useState(3);

  // Build quick lookup for vessel display fields
  const idList = useMemo(
    () => vessels.map(v => String(v?._id ?? v?.id)).filter(Boolean),
    [vessels]
  );
  const idSet = useMemo(() => new Set(idList), [idList]);
  const nameById = useMemo(
    () => new Map(vessels.map(v => [String(v?._id ?? v?.id), v?.name ?? v?.vesselName ?? v?.title ?? null])),
    [vessels]
  );
  const flagById = useMemo(
    () => new Map(vessels.map(v => [String(v?._id ?? v?.id), v?.flag ?? v?.country ?? v?.Flag ?? null])),
    [vessels]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch("/api/vessellocations");
        const raw = await res.json();
        const locations = Array.isArray(raw)
          ? raw
          : raw?.data?.locations ?? raw?.locations ?? [];

        // Pick latest location per vessel by ts
        const latestByVessel = new Map();
        for (const loc of locations) {
          const vid = getVesselIdFromLoc(loc);
          if (vid == null) continue;
          const vidStr = String(vid);
          if (!idSet.has(vidStr)) continue; // only for current fleet vessels

          const ts = getTsFromLoc(loc);
          const ms = tsToMillis(ts);

          const prev = latestByVessel.get(vidStr);
          if (!prev || ms > prev.ms) {
            latestByVessel.set(vidStr, { loc, ms, ts });
          }
        }

        const pts = [];
        latestByVessel.forEach(({ loc, ts }, vidStr) => {
          const { lat, lng } = getLatLngFromLoc(loc);
          pts.push({
            id: vidStr,
            lat,
            lng,
            name: nameById.get(vidStr) ?? null,
            flag: flagById.get(vidStr) ?? null,
            ts: ts,                 // <- critical: make ts available to the popup
            // compatibility fields if any consumer still reads these:
            time: ts ?? null,
            timeStr: ts == null ? "N/A" : String(ts),
          });
        });

        if (!cancelled) {
          setPoints(pts);

          // Set center to first valid point if any
          const first = pts.find(p => p.lat != null && p.lng != null);
          if (first) setCenter([first.lat, first.lng]);
        }
      } catch (e) {
        if (!cancelled) setPoints([]);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [idSet, nameById, flagById]);

  return (
    <React.Suspense
      fallback={
        <div style={{ height: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Loading map…
        </div>
      }
    >
      <ProviderImpl points={points} center={center} zoom={zoom} />
    </React.Suspense>
  );
}