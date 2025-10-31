import React from "react";

/*
  Placeholder Mapbox provider with the same props contract as FleetMapLeaf:
  - points: [{ id, lat, lng, nameDisplay, idDisplay, flagDisplay, latStr, lngStr, courseStr, timeStr, ... }]
  - center: [lat, lng]
  - zoom: number

  To implement:
  - Install dependencies: mapbox-gl and a React binding (or use mapbox-gl directly)
  - Read process.env.REACT_APP_MAPBOX_TOKEN for access
  - Render markers/popups using the points array
*/

export default function FleetMapBox({ points, center, zoom }) {
  return (
    <div style={{ height: 480, width: "100%", border: "1px dashed #aaa", borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Mapbox provider not implemented yet</div>
      <div>
        Center: [{center?.[0]}, {center?.[1]}], Zoom: {zoom}
      </div>
      <div>{Array.isArray(points) ? `${points.length} vessel(s) provided.` : "No points."}</div>
      <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
        Set REACT_APP_MAP_PROVIDER=leaflet to switch back.
      </div>
    </div>
  );
}