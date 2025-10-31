import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import FleetsTable from "./FleetsTable";
import FleetPage from "./FleetPage";
import reportWebVitals from './reportWebVitals';

// Example: you may have a component that fetches fleets and passes them to FleetsTable
function MainPage() {
  const [fleets, setFleets] = React.useState([]);
  React.useEffect(() => {
    fetch("/api/fleets")
      .then(res => res.json())
      .then(data => setFleets(data));
  }, []);
  return <FleetsTable fleets={fleets} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/fleet/:fleetJsonId" element={<FleetPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
