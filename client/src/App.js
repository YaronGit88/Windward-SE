import React, { useEffect, useState } from "react";
import FleetsTable from "./FleetsTable";

function App() {
  const [fleets, setFleets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/fleets")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch fleets");
        return res.json();
      })
      .then(json => {
        setFleets(json?.data?.fleets || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Fleets</h2>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <FleetsTable fleets={fleets} />
    </div>
  );
}

export default App;