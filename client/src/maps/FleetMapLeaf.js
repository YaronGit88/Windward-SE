import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// fix default Leaflet marker icons in bundlers
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Ensure default marker icons resolve correctly
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// One-world bounds
const maxBounds = [
  [-85, -180],
  [85, 180],
];

// Keep nulls as "null", undefined/empty -> "N/A"
const displayNullAware = (v) => {
  if (v === null) return "null";
  if (v === undefined) return "N/A";
  const s = typeof v === "string" ? v : String(v);
  return s.trim() === "" ? "N/A" : s;
};

// Pick the first value that is not undefined (null is preserved)
const firstDefined = (...vals) => {
  for (const v of vals) {
    if (v !== undefined) return v;
  }
  return undefined;
};

// For coordinates, show Lat first visually; keep null behavior
const formatCoord = (val, digits = 5) => {
  if (val === null) return "null";
  if (val === undefined) return "N/A";
  const num = typeof val === "number" ? val : Number(val);
  if (Number.isFinite(num)) return num.toFixed(digits);
  // fallback to stringy input
  return displayNullAware(val);
};

export default function FleetMapLeaf({ points, center, zoom }) {
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
          noWrap={true}
        />
        {/* Labels-only overlay: English labels */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"
          opacity={0.95}
          noWrap={true}
        />

        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup>
              <div style={{ minWidth: 220 }}>
                <div>
                  <strong>Name:</strong> {displayNullAware(firstDefined(p.name, p.nameDisplay))}
                </div>
                <div>
                  <strong>ID:</strong> {displayNullAware(firstDefined(p.id, p.vesselId, p._id))}
                </div>
                <div>
                  <strong>Flag:</strong> {displayNullAware(firstDefined(p.flag, p.flagDisplay))}
                </div>
                <div>
                  <strong>Lat | Lon:</strong>{" "}
                  {formatCoord(firstDefined(p.lat, p.latitude, p.latStr))} |{" "}
                  {formatCoord(firstDefined(p.lng, p.lon, p.longitude, p.lngStr))}
                </div>
                <div>
                  <strong>Course:</strong> {displayNullAware(firstDefined(p.course, p.courseStr))}
                </div>
                {/*
                <div>
                  <strong>Time:</strong> {displayNullAware(firstDefined(p.ts, p.time, p.timeStr))}
                </div>
                */}
                <div>
                  <strong>Time Lastpos:</strong> {displayNullAware(firstDefined(p.ts, p.time, p.timeStr))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {(!points || points.length === 0) ? (
        <div style={{ marginTop: 8, color: "#666" }}>
          No vessel locations found for this fleet.
        </div>
      ) : null}
    </div>
  );
}