import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import FleetMap from "./FleetMap";

/*
  FleetPage
  - Shows vessels for the current fleet by default.
  - Lets you search vessels with AND/OR logic across fields (name, flag, mmsi).
  - The "Only this fleet" checkbox scopes the search to the fleet shown on the page.
  - The map always reflects the current table results because both use the same `vessels` state.
*/
function FleetPage() {
  const { fleetJsonId } = useParams();
  const [vessels, setVessels] = useState([]);
  const [fleetName, setFleetName] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [lastPosByVesselId, setLastPosByVesselId] = useState({}); // vesselId -> ts (string|number|null)

  // Search UI state
  // - op: 'and' means all provided fields must match; 'or' means any provided field may match.
  // - scopeToFleet: when checked, the API call includes ?fleetJsonId=<current> so the server filters only inside this fleet.
  //   If no name/flag/mmsi are provided and scopeToFleet is checked, the API returns all vessels in this fleet.
  //   If the checkbox is OFF and no fields are provided, the API returns 404 (there's no "list all" without a fleet scope).
  // - Each field value is treated by the server as a case-insensitive substring (no wildcard syntax needed).
  //   Example: name="msc" matches "MSC ORCHESTRA" and "Cosco Msc 123".
  const [nameQ, setNameQ] = useState("");
  const [flagQ, setFlagQ] = useState("");
  const [mmsiQ, setMmsiQ] = useState("");
  const [op, setOp] = useState("and"); // 'and' | 'or'
  const [scopeToFleet, setScopeToFleet] = useState(true); // checkbox to narrow to this fleet
  const [searchActive, setSearchActive] = useState(false);
  const [searchStatus, setSearchStatus] = useState(""); // small message (errors/empty)

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

  // Load fleet vessels (default view)
  useEffect(() => {
    document.title = "Fleet page";
    setSearchActive(false); // reset search when switching fleets
    setSearchStatus("");
    fetch(`/api/fleets/${fleetJsonId}/vessels/full`)
      .then(res => res.json())
      .then(data => setVessels(data.vessels || []))
      .catch(() => setVessels([]));
  }, [fleetJsonId]);

  // Fetch fleet name from raw /api/fleets (now returns as-is from fleets.json)
  useEffect(() => {
    fetch("/api/fleets")
      .then(res => res.json())
      .then(fleets => {
        // fleets are raw objects; match by id or _id
        const fleet = (fleets || []).find(f => String(f.id ?? f._id) === String(fleetJsonId));
        const nm = pickFirstDefined(fleet?.name, fleet?.title);
        setFleetName(nm || "");
      })
      .catch(() => setFleetName(""));
  }, [fleetJsonId]);

  // Pull the latest "Last Position" timestamp per vessel from /api/vessellocations.
  // We compute a map: { vesselId -> latest lastpos.ts } to show in the table and for sorting.
  useEffect(() => {
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

  // Build and fire filter request
  // Behind the scenes when you press "Search":
  // 1) We build a query string with any non-empty inputs:
  //    - name -> &name=<value>
  //    - flag -> &flag=<value>
  //    - mmsi -> &mmsi=<value>
  //    Each is treated on the server as a case-insensitive SUBSTRING match (no wildcard characters needed).
  // 2) We append &op=and or &op=or. This controls how fields combine:
  //    - AND: a vessel must match ALL of the provided fields.
  //    - OR: a vessel may match ANY of the provided fields.
  //    Note: Our UI collects one value per field. The API supports repeated keys for per-field OR
  //    (e.g., &name=A&name=B), but this UI doesn't emit repeated values.
  // 3) If "Only this fleet" is checked, we also append &fleetJsonId=<current>.
  //    - If no fields are provided and the checkbox is ON, the API returns the full fleet list.
  //    - If no fields are provided and the checkbox is OFF, the API returns 404 (no global "list all").
  // 4) We call /api/vessels/filter with these params.
  // 5) If 200 OK, we set `vessels` to the returned array—this updates BOTH the table and the map.
  //    If 404, we clear the table and show "No results found." The map also clears.
  const handleSearch = async () => {
    setSearchStatus("Searching...");
    const params = new URLSearchParams();

    // add values only if provided (server uses case-insensitive substring matching)
    if (nameQ.trim().length > 0) params.append("name", nameQ.trim());
    if (flagQ.trim().length > 0) params.append("flag", flagQ.trim());
    if (mmsiQ.trim().length > 0) params.append("mmsi", mmsiQ.trim());

    // always send op to be explicit (AND vs OR across the provided fields)
    params.set("op", op);

    // scope to fleet if checked
    if (scopeToFleet) {
      params.set("fleetJsonId", String(fleetJsonId));
    }

    try {
      const res = await fetch(`/api/vessels/filter?${params.toString()}`);
      if (!res.ok) {
        // 404 from API means no matches or invalid usage; show message and clear results
        const txt = await res.text().catch(() => "");
        setVessels([]);
        setSearchActive(true);
        setSearchStatus(
          res.status === 404
            ? "No results found."
            : `Search failed (${res.status}). ${txt}`
        );
        return;
      }
      const data = await res.json();
      // API returns a raw array of vessel objects
      setVessels(Array.isArray(data) ? data : []);
      setSearchActive(true);
      setSearchStatus(`Found ${Array.isArray(data) ? data.length : 0} result(s).`);
    } catch (e) {
      setVessels([]);
      setSearchActive(true);
      setSearchStatus(`Search error: ${e.message}`);
    }
  };

  const handleClear = () => {
    // reset inputs but keep scopeToFleet default checked
    setNameQ("");
    setFlagQ("");
    setMmsiQ("");
    setOp("and");
    setSearchStatus("");
    setSearchActive(false);
    // reload default fleet vessels
    fetch(`/api/fleets/${fleetJsonId}/vessels/full`)
      .then(res => res.json())
      .then(data => setVessels(data.vessels || []))
      .catch(() => setVessels([]));
  };

  // Sorting is client-side; note that the map follows the same `vessels` state but is not resorted (order doesn't matter on the map).
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

      {/* Search section */}
      <div style={{ margin: "16px 0", padding: 12, border: "1px solid #ddd", borderRadius: 6 }}>
        <h3 style={{ marginTop: 0 }}>Search vessels</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Name:
            <input
              type="text"
              value={nameQ}
              onChange={(e) => setNameQ(e.target.value)}
              placeholder="substring"
              style={{ marginLeft: 6 }}
            />
          </label>
          <label>
            Flag:
            <input
              type="text"
              value={flagQ}
              onChange={(e) => setFlagQ(e.target.value)}
              placeholder="substring"
              style={{ marginLeft: 6 }}
            />
          </label>
          <label>
            MMSI:
            <input
              type="text"
              value={mmsiQ}
              onChange={(e) => setMmsiQ(e.target.value)}
              placeholder="exact or substring"
              style={{ marginLeft: 6 }}
            />
          </label>
          <label>
            Logic:
            <select value={op} onChange={(e) => setOp(e.target.value)} style={{ marginLeft: 6 }}>
              <option value="and">AND</option>
              <option value="or">OR</option>
            </select>
          </label>
          <label title="When checked, search only inside this fleet">
            <input
              type="checkbox"
              checked={scopeToFleet}
              onChange={(e) => setScopeToFleet(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Only this fleet
          </label>
          <button onClick={handleSearch}>Search</button>
          <button onClick={handleClear} style={{ marginLeft: 4 }}>Clear</button>
        </div>
        {searchStatus && (
          <div style={{ marginTop: 8, color: searchStatus.startsWith("Search error") ? "crimson" : "#444" }}>
            {searchStatus}
          </div>
        )}
      </div>

      <h2>
        {searchActive ? "Search Results" : "Vessels"}
      </h2>

      {/* Table + Map sync:
          - Both consume the same `vessels` state.
          - After searching, the table shows only the filtered vessels and the map displays markers only for those vessels.
          - Clearing the search reloads the full fleet list and the map updates accordingly. */}
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

      {/* FleetMap visibility rule:
          - FleetMap receives the same `vessels` array.
          - Only vessels in this array are plotted as markers, so search results directly control map visibility. */}
      <FleetMap vessels={vessels} />
    </div>
  );
}

export default FleetPage;