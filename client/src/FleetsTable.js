import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function FleetsTable({ fleets }) {
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    document.title = "Fleets Table";
  }, []);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortedFleets = [...fleets].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === "id") {
      aVal = (a.id ?? a._id ?? "").toString().toLowerCase();
      bVal = (b.id ?? b._id ?? "").toString().toLowerCase();
    } else if (sortBy === "name") {
      aVal = (a.name ?? a.title ?? "").toString().toLowerCase();
      bVal = (b.name ?? b.title ?? "").toString().toLowerCase();
    } else if (sortBy === "vesselsCount") {
      aVal = Number(a.vesselsCount ?? 0);
      bVal = Number(b.vesselsCount ?? 0);
    }
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div>
      <h1>Fleets Table</h1>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>#</th>
            <th
              style={{ cursor: "pointer", background: sortBy === "id" ? "#eee" : undefined }}
              onClick={() => handleSort("id")}
            >
              Name {sortBy === "id" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </th>
            <th
              style={{ cursor: "pointer", background: sortBy === "name" ? "#eee" : undefined }}
              onClick={() => handleSort("name")}
            >
              ID {sortBy === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </th>
            <th
              style={{ cursor: "pointer", background: sortBy === "vesselsCount" ? "#eee" : undefined }}
              onClick={() => handleSort("vesselsCount")}
            >
              VesselsCount {sortBy === "vesselsCount" ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedFleets.map((fleet, idx) => (
            <tr key={fleet.fleetJsonId ?? fleet._id ?? idx}>
              <td>{idx + 1}</td>
              <td>
                <Link to={`/fleet/${fleet.fleetJsonId ?? fleet._id ?? ""}`}>
                  {fleet.name ?? fleet.title ?? ""}
                </Link>
              </td>
              <td>{fleet.fleetJsonId ?? fleet._id ?? ""}</td>
              <td>{fleet.vesselsCount ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}