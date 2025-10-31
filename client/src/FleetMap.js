import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Safely parse coordinates; prefer GeoJSON lastpos.geometry.coordinates [lng, lat]
function getLatLng(loc) {
  try {
    const coords = loc?.lastpos?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
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
  return null;
}

// Format number to fixed decimals or "N/A"
const fmtNum = (n, digits = 5) =>
  Number.isFinite(n) ? n.toFixed(digits) : "N/A";

// Render-friendly placeholder for missing values
const display = (v) => (v === null || v === undefined || v === "" ? "N/A" : v);

function FleetMap({ vessels }) {
  const [locations, setLocations] = useState([]);
  const [center, setCenter] = useState([20, 0]); // default Atlantic-ish
  const [zoom, setZoom] = useState(2);

  // Build a quick lookup of vessel IDs in this fleet and maps for name/flag
  const { idSet, nameById, flagById } = useMemo(() => {
    const set = new Set();
    const names = new Map();
    const flags = new Map();
    (vessels || []).forEach((v) => {
      const id = String(v?._id ?? v?.id ?? "");
      if (id) {
        set.add(id);
        if (v?.name) names.set(id, v.name);
        const flag = v?.flag ?? v?.country ?? v?.Flag ?? "";
        if (flag) flags.set(id, flag);
      }
    });
    return { idSet: set, nameById: names, flagById: flags };
  }, [vessels]);

  // Fetch all vessel locations once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/vessellocations")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        // If server returns a wrapped object, unwrap; otherwise it's already an array
        const arr = Array.isArray(data)
          ? data
          : data?.data?.locations || data?.locations || [];
        setLocations(arr);
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build map points filtered to this fleet
  const points = useMemo(() => {
    const out = [];
    (locations || []).forEach((loc) => {
      // Prefer explicit vessel ID fields; fall back to generic ids if needed
      const vesselIdCand =
        loc?.vesselId ?? loc?.vessel_id ?? loc?._id ?? loc?.id ?? null;
      const vid = vesselIdCand != null ? String(vesselIdCand) : "";
      if (!vid || !idSet.has(vid)) return;

      const ll = getLatLng(loc);
      if (!ll) return;

      // Enrich popup data
      const course =
        loc?.lastpos?.course ?? loc?.course ?? loc?.cog ?? null;

      const tsRaw =
        loc?.lastpos?.time ??
        loc?.time ??
        loc?.timestamp ??
        loc?.last_position_time ??
        null;

      let timeStr = "";
      if (tsRaw != null) {
        const d = new Date(tsRaw);
        timeStr = isNaN(d) ? String(tsRaw) : d.toLocaleString();
      }

      out.push({
        id: vid,
        // Only use the actual name; if missing, we'll show N/A in the popup
        name: nameById.get(vid) ?? null,
        flag: flagById.get(vid) || "",
        lat: ll.lat,
        lng: ll.lng,
        course: Number.isFinite(Number(course)) ? Number(course) : null,
        timeStr,
      });
    });
    return out;
  }, [locations, idSet, nameById, flagById]);

  // Center on the first point when points change
  useEffect(() => {
    if (points.length > 0) {
      setCenter([points[0].lat, points[0].lng]);
      setZoom(3);
    }
  }, [points]);

  // Constrain the map to one-world bounds; keep single-world visuals
  const maxBounds = [
    [-85, -180],
    [85, 180],
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <h3>Vessel locations on map</h3>
      <MapContainer
        center={center}
        zoom={zoom}
        // allow ~20% more zoom-out with fractional zoom levels
        minZoom={1.75}
        zoomSnap={0.25}
        zoomDelta={0.25}
        maxZoom={18}
        style={{ height: 480, width: "100%", border: "1px solid #ccc", borderRadius: 6 }}
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        noWrap={true}
      >
        {/* Base map: local labels */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          //attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
          noWrap={true}            // prevent tile wrap
        />
        {/* Labels-only overlay: English labels */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"
          //attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          opacity={0.95}
          noWrap={true}            // prevent tile wrap
        />

        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup>
              <div style={{ minWidth: 220 }}>
                <div>
                  Name: <strong>{display(p.name)}</strong>
                </div>
                <div>ID: {display(p.id)}</div>
                <div>Flag: {display(p.flag)}</div>
                <div>Lat: {fmtNum(p.lat)} | Lon: {fmtNum(p.lng)}</div>
                <div>Course: {p.course != null ? `${p.course}°` : "N/A"}</div>
                <div>Time: {display(p.timeStr)}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {points.length === 0 ? (
        <div style={{ marginTop: 8, color: "#666" }}>
          No vessel locations found for this fleet.
        </div>
      ) : null}
    </div>
  );
}

export default FleetMap;