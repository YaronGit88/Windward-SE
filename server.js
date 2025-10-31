require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// All JSON files live in the same directory as this script
const vesselsPath = path.join(__dirname, 'vessels.json');
const fleetsPath = path.join(__dirname, 'fleets.json');
const vesselLocationsPath = path.join(__dirname, 'vesselLocations.json');

// read  JSON functions with clarify ID sources
const getFleetJsonId = (fleetObj) => fleetObj?.id ?? fleetObj?._id ?? null; // from fleets.json
const getVesselJsonId = (vesselObj) => vesselObj?._id ?? null; // from vessels.json
const getVesselLocationJsonId = (locationObj) => locationObj?.id ?? locationObj?._id ?? null; // from vesselLocations.json
const getName = (o) => o?.name ?? o?.title ?? 'N/A';
// For vessels, get the fleet ID reference (from vessels.json, points to fleets.json)
const getFleetIdFromVessel = (v) => v?.fleetId ?? v?.fleet_id ?? v?.fleet ?? null;

async function loadData() {
  const [vesselsRaw, fleetsRaw, locationsRaw] = await Promise.all([
    fs.readFile(vesselsPath, 'utf8'),
    fs.readFile(fleetsPath, 'utf8'),
    fs.readFile(vesselLocationsPath, 'utf8'),
  ]);
  const vessels = JSON.parse(vesselsRaw);
  const fleets = JSON.parse(fleetsRaw);
  const locations = JSON.parse(locationsRaw);

  // Map vesselJsonId -> vessel
  const vesselMap = new Map();
  vessels.forEach((vessel, vesselIndex) => vesselMap.set(getVesselJsonId(vessel) ?? `idx:${vesselIndex}`, vessel));

  // Map fleetJsonId -> fleet
  const fleetMap = new Map();
  fleets.forEach((fleet, fleetIndex) => fleetMap.set(getFleetJsonId(fleet) ?? `idx:${fleetIndex}`, fleet));
  
  // Map vesselJsonId -> [locations]
  const locationMap = new Map();
  locations.forEach((location, locationIndex) => {
    const vesselJsonId = location.vesselId ?? location.vessel_id ?? location._id ?? `idx:${locationIndex}`;
    if (!locationMap.has(vesselJsonId)) locationMap.set(vesselJsonId, []);
    locationMap.get(vesselJsonId).push(location);
  });

  // Precompute vessels per fleet:
  // - If fleet object has a "vessels" (or similar) array, use its length.
  // - Otherwise, fall back to counting vessels that reference the fleet.
  const fleetCounts = new Map();
  const countedFromFleets = new Set();

  fleets.forEach((f, i) => {
    const fleetJsonId = getFleetJsonId(f) ?? `idx:${i}`;
    // common property names that may contain vessel id array
    const arr = f.vessels ?? f.vesselIds ?? f.vesselsIds ?? f.vessels_list ?? null;
    if (Array.isArray(arr)) {
      fleetCounts.set(fleetJsonId, arr.length);
      countedFromFleets.add(fleetJsonId);
    } else {
      fleetCounts.set(fleetJsonId, 0);
    }
  });

  vessels.forEach(v => {
    const fleetJsonId = getFleetIdFromVessel(v);
    if (fleetJsonId == null) return;
    // only count from vessels if fleet did not provide explicit vessels array
    if (countedFromFleets.has(fleetJsonId)) return;
    fleetCounts.set(fleetJsonId, (fleetCounts.get(fleetJsonId) || 0) + 1);
  });

  return { vessels, fleets, locations, vesselMap, fleetMap, locationMap, fleetCounts };
}

// initial load
app.locals.dataPromise = loadData().then(data => {
  app.locals.data = data;
  return data;
}).catch(err => {
  console.error('Initial data load failed:', err);
  throw err;
});


// routes
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Windward SE', timestamp: new Date().toISOString() }));
// Vessels summary: list of vessels with basic info
app.get('/vessels', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    return res.json({ status: 'success', results: data.vessels.length, data: { vessels: data.vessels } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Unable to load vessels' });
  }
});
// Vessel details by vesselJsonId
app.get('/vessels/:vesselJsonId', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    const v = data.vesselMap.get(req.params.vesselJsonId) || Array.from(data.vesselMap.values()).find(x => getVesselJsonId(x) == req.params.vesselJsonId);
    if (!v) return res.status(404).json({ status: 'not_found' });
    return res.json({ status: 'success', data: { vessel: v } });
  } catch {
    return res.status(500).json({ status: 'error' });
  }
});

//expose vessels
app.get('/api/vessels', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    return res.json(data.vessels);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Unable to load vessels' });
  }
});


// vessel locations Summary. list of vessels location  with basic info
app.get('/vessellocations', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    return res.json({ status: 'success', results: data.locations.length, data: { locations: data.locations } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Unable to load vessel locations' });
  }
});

//expose vessel locations
app.get('/api/vessellocations', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    return res.json(data.locations);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Unable to load vessel locations' });
  }
});

// Fleets summary: name & vessels count
app.get('/fleets', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    const summaryfleets = data.fleets.map((f, i) => {
      const fleetJsonId = getFleetJsonId(f) ?? `idx:${i}`;
      return { fleetJsonId, name: getName(f), vesselsCount: data.fleetCounts.get(fleetJsonId) || 0 };
    });
    res.json({ status: 'success', results: summaryfleets.length, data: { fleets: summaryfleets } });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

//expose fleets
app.get('/api/fleets', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    const summaryfleets = data.fleets.map((f, i) => {
      const fleetJsonId = getFleetJsonId(f) ?? `idx:${i}`;
      return { fleetJsonId, name: getName(f), vesselsCount: data.fleetCounts.get(fleetJsonId) || 0 };
    });
    res.json(summaryfleets);
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

// New route: Get all vessels for a specific fleet by fleetJsonId
app.get('/api/fleets/:fleetJsonId/vessels', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    const fleetJsonId = req.params.fleetJsonId;
    // Find the fleet by ID
    const fleet = data.fleets.find(
      f => String(getFleetJsonId(f)) === String(fleetJsonId)
    );
    if (!fleet) {
      return res.status(404).json({ status: 'not_found', message: 'Fleet not found' });
    }
    // Get vessel IDs from the fleet's vessels property (or similar)
    const vesselIds = fleet.vessels ?? fleet.vesselIds ?? fleet.vesselsIds ?? fleet.vessels_list ?? [];
    res.json({ vesselIds });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Unable to load vessel IDs for fleet' });
  }
});

// New route: Get full vessel objects for a specific fleet by fleetJsonId
app.get('/api/fleets/:fleetJsonId/vessels/full', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;
    const fleetJsonId = req.params.fleetJsonId;

    const fleet = data.fleets.find(
      f => String(getFleetJsonId(f)) === String(fleetJsonId)
    );
    if (!fleet) {
      return res.status(404).json({ status: 'not_found', message: 'Fleet not found' });
    }

    const vesselIdsRaw = fleet.vessels ?? fleet.vesselIds ?? fleet.vesselsIds ?? fleet.vessels_list ?? [];
    const vesselIds = vesselIdsRaw.map(idObj =>
      typeof idObj === 'object' && idObj !== null
        ? idObj.id ?? idObj._id ?? JSON.stringify(idObj)
        : idObj
    );

    // Build a fast lookup map of all vessels by _id
    const allVesselsById = new Map(
      data.vessels.map(v => [String(getVesselJsonId(v)), v])
    );

    // Map vesselIds -> vessel objects (keeping order from fleet.vessels), filter missing
    const vesselsForFleet = vesselIds.map(id => allVesselsById.get(id)).filter(Boolean);

    res.json({ vessels: vesselsForFleet });
  } catch (err) {
    console.error('Error in /api/fleets/:fleetJsonId/vessels/full:', err);
    res.status(500).json({ status: 'error', message: 'Unable to load vessels for fleet' });
  }
});



// optional reload endpoint
app.post('/reload', async (req, res) => {
  try {
    const data = await loadData();
    app.locals.data = data;
    res.json({ status: 'reloaded' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'reload failed' });
  }
});

// start service using PORT from .env (default 3010)
const PORT = process.env.PORT || 3010;
app.locals.dataPromise.then(() => {
  app.listen(PORT, () => console.log(`Service running on port ${PORT}`));
}).catch(err => {
  console.error('Service start aborted due to data load error.');
  process.exit(1);
});