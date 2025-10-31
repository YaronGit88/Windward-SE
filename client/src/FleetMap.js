import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue in Leaflet + Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function FleetMap({ vessels }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetch("/api/vessellocations")
      .then(res => res.json())
      .then(data => setLocations(data || []));
  }, []);

  // Get vessel IDs for this fleet
  const vesselIds = vessels.map(v => v._id || v.id);

  // Filter locations for vessels in this fleet
  const fleetVesselLocations = locations.filter(loc =>
    vesselIds.includes(loc.vesselId || loc.vessel_id || loc._id)
  );

  // Center map on first vessel location, or fallback to [0,0]
  const mapCenter = fleetVesselLocations.length
    ? [
        fleetVesselLocations[0].lat || fleetVesselLocations[0].latitude || 0,
        fleetVesselLocations[0].lon || fleetVesselLocations[0].longitude || 0,
      ]
    : [0, 0];

  return (
    <div>
      <h2>Vessel Locations Map</h2>
      <div style={{ height: "400px", marginTop: "24px" }}>
        <MapContainer
          center={mapCenter}
          zoom={4}
          minZoom={2}                            // clamp zoom out
          maxZoom={18}                           // optional: clamp zoom in
          maxBounds={[[-85, -180], [85, 180]]}   // keep the map within the world
          maxBoundsViscosity={1.0}               // strong clamp at bounds
          worldCopyJump={false}                   // don’t jump across copies
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            noWrap={true}                         // show the world only once
          />
          {fleetVesselLocations.map((loc, idx) => (
            <Marker
              key={loc._id || loc.id || idx}
              position={[
                loc.lat || loc.latitude || 0,
                loc.lon || loc.longitude || 0,
              ]}
            >
              <Popup>
                Vessel ID: {loc.vesselId || loc.vessel_id || loc._id}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default FleetMap;