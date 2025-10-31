import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import FleetMap from "./FleetMap";

function FleetPage() {
  const { fleetJsonId } = useParams();
  const [vessels, setVessels] = useState([]);
  const [fleetName, setFleetName] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [lastPosByVesselId, setLastPosByVesselId] = useState({}); // vesselId -> ts (string|number|null)
  const navigate = useNavigate();

  // Helper: pick the first value that is not undefined (null is allowed and preserved)
  const pickFirstDefined = (...vals) => {
    for (const v of vals) {
      if (v !== undefined) return v;
    }
    return undefined;
  };

  // Display helper:
  // - null -> "null"
  // - undefined or empty string -> "N/A"
  // - otherwise -> the string value
  const display = (v) => {
    if (v === null) return "null";
    if (v === undefined) return "N/A";
    const s = typeof v === "string" ? v : String(v);
    return s.trim() === "" ? "N/A" : s;
  };

  // Normalize ts to a sortable number (ms since epoch) where possible
  const tsToMillis = (ts) => {
    if (ts === null || ts === undefined) return Number.NEGATIVE_INFINITY;
    if (typeof ts === "number" && Number.isFinite(ts)) return ts;
    const asNum = Number(ts);
    if (Number.isFinite(asNum)) return asNum;
    const parsed = Date.parse(String(ts));
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };

  useEffect(() => {
    document.title = "Fleet page";
    fetch(`/api/fleets/${fleetJsonId}/vessels/full`)
      .then(res => res.json())
      .then(data => setVessels(data.vessels || []));
  }, [fleetJsonId]);

  useEffect(() => {
    // Fetch all fleets to get the name for the current fleetJsonId
    fetch("/api/fleets")
      .then(res => res.json())
      .then(fleets => {
        const fleet = fleets.find(f => String(f.fleetJsonId) === String(fleetJsonId));
        setFleetName(fleet ? fleet.name : "");
      });
  }, [fleetJsonId]);

  useEffect(() => {
    // Fetch vessel locations and map latest lastpos.ts per vessel
    fetch("/api/vessellocations")
      .then(res => res.json())
      .then((locations) => {
        const latestByVessel = new Map();

        const getVesselKeyFromLocation = (loc) =>
          loc?.vesselId ?? loc?.vessel_id ?? loc?._id ?? null; // mirror server-side linking

        const pickTs = (loc) => (loc?.lastpos?.ts ?? null);

        for (const loc of Array.isArray(locations) ? locations : []) {
          const vesselKey = getVesselKeyFromLocation(loc);
          if (vesselKey == null) continue;
          const ts = pickTs(loc);
          const tsMs = tsToMillis(ts);

          if (!latestByVessel.has(vesselKey)) {
            latestByVessel.set(vesselKey, { ts, tsMs });
          } else {
            const prev = latestByVessel.get(vesselKey);
            if (tsMs > prev.tsMs) latestByVessel.set(vesselKey, { ts, tsMs });
          }
        }

        const obj = {};
        for (const [k, v] of latestByVessel.entries()) obj[String(k)] = v.ts;
        setLastPosByVesselId(obj);
      })
      .catch(() => {
        setLastPosByVesselId({});
      });
  }, []); // once is fine; update after /reload if needed

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedVessels = [...vessels].sort((a, b) => {
    let av, bv;
    if (sortKey === "lastPosTs") {
      const idA = pickFirstDefined(a?._id, a?.id);
      const idB = pickFirstDefined(b?._id, b?.id);
      av = tsToMillis(lastPosByVesselId?.[String(idA)]);
      bv = tsToMillis(lastPosByVesselId?.[String(idB)]);
    } else {
      av = a?.[sortKey] ?? "";
      bv = b?.[sortKey] ?? "";
    }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <h1>Fleet {fleetName ? `(${fleetName}) ` : ""}Page</h1>
      <button onClick={() => navigate("/")}>Return to Main Page</button>
      <h2>Vessels</h2>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th
              style={{ cursor: "pointer", background: sortKey === "name" ? "#eee" : undefined }}
              onClick={() => handleSort("name")}
            >
              Name {sortKey === "name" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th
              style={{ cursor: "pointer", background: sortKey === "flag" ? "#eee" : undefined }}
              onClick={() => handleSort("flag")}
            >
              Flag {sortKey === "flag" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th
              style={{ cursor: "pointer", background: sortKey === "mmsi" ? "#eee" : undefined }}
              onClick={() => handleSort("mmsi")}
            >
              MMSI {sortKey === "mmsi" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th
              style={{ cursor: "pointer", background: sortKey === "id" ? "#eee" : undefined }}
              onClick={() => handleSort("id")}
            >
              ID {sortKey === "id" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
            <th
              style={{ cursor: "pointer", background: sortKey === "lastPosTs" ? "#eee" : undefined }}
              onClick={() => handleSort("lastPosTs")}
            >
              Last Position Time{sortKey === "lastPosTs" ? (sortAsc ? "▲" : "▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedVessels.map((vessel, idx) => {
            const name = pickFirstDefined(vessel?.name, vessel?.vesselName, vessel?.title);
            const flag = pickFirstDefined(vessel?.flag, vessel?.country, vessel?.Flag);
            const mmsi = pickFirstDefined(vessel?.mmsi, vessel?.MMSI, vessel?.mmsi_number, vessel?.mmsiNumber);
            const idVal = pickFirstDefined(vessel?._id, vessel?.id);
            const lastTs = lastPosByVesselId?.[String(idVal)];
            return (
              <tr key={vessel?._id || vessel?.id || idx}>
                <td>{display(name)}</td>
                <td>{display(flag)}</td>
                <td>{display(mmsi)}</td>
                <td>{display(idVal)}</td>
                <td>{display(lastTs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <FleetMap vessels={vessels} />
    </div>
  );
}

export default FleetPage;