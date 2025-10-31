import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import FleetMap from "./FleetMap";

function FleetPage() {
  const { fleetJsonId } = useParams();
  const [vessels, setVessels] = useState([]);
  const [fleetName, setFleetName] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();

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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedVessels = [...vessels].sort((a, b) => {
    if (a[sortKey] < b[sortKey]) return sortAsc ? -1 : 1;
    if (a[sortKey] > b[sortKey]) return sortAsc ? 1 : -1;
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
          </tr>
        </thead>
        <tbody>
          {sortedVessels.map((vessel, idx) => (
            <tr key={vessel._id || vessel.id || idx}>
              <td>{vessel.name}</td>
              <td>{vessel.mmsi}</td>
              <td>{vessel._id || vessel.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FleetMap vessels={vessels} />
    </div>
  );
}

export default FleetPage;