import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import FleetPage from './FleetPage';
import ShowAllApiRoutesButton from './components/ShowAllApiRoutesButton'; // <-- add this

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/fleet/:fleetJsonId" element={<FleetPage />} />
      </Routes>
      {/* Button is global now: appears on all routes */}
      <ShowAllApiRoutesButton />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
