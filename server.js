require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { registerRoutesListing } = require('./allroutes'); // ensure this is allroutes, not routes-inspector

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
    // Return the raw fleets array exactly as in fleets.json
    return res.json(data.fleets);
  } catch {
    return res.status(500).json({ status: 'error' });
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

// Helper: fetch fleet vessels via internal HTTP call to keep single source of truth
async function fetchFleetVesselsFullViaHttp(fleetJsonId) {
  const http = require('http');
  const port = process.env.PORT || 3010;
  const urlPath = `/api/fleets/${encodeURIComponent(fleetJsonId)}/vessels/full`;
  const options = { hostname: '127.0.0.1', port, path: urlPath, method: 'GET' };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const arr = Array.isArray(json?.vessels) ? json.vessels : (json?.data?.vessels ?? []);
          resolve(arr);
        } catch (e) {
          reject(new Error(`Failed to parse fleet vessels response: ${e.message}`));
        }
      });
    });
    req.on('error', (e) => reject(new Error(`HTTP error: ${e.message}`)));
    req.end();
  });
}

// expose: Filter vessels by name, flag, and/or mmsi
// - Substring match for values (case-insensitive)
// - Per-field OR via repeated keys (?name=a&name=b) — no "||" parsing
// - Flags: <field>IsNull, <field>IsEmpty (booleans)
// - Across fields combination via op/operator/logic = 'and' (default) | 'or'
// - Scope: optional fleetJsonId uses internal HTTP call to /api/fleets/:fleetJsonId/vessels/full
app.get('/api/vessels/filter', async (req, res) => {
  try {
    const data = app.locals.data ?? await app.locals.dataPromise;

    // Allowed params
    const allowed = new Set([
      'name', 'flag', 'mmsi',
      'nameIsNull', 'flagIsNull', 'mmsiIsNull',
      'nameIsEmpty', 'flagIsEmpty', 'mmsiIsEmpty',
      'op', 'operator', 'logic',
      'fleetJsonId',
    ]);
    const invalidKeys = Object.keys(req.query).filter(k => !allowed.has(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'please use the api wth correct syntax',
        hint: '/api/vessels/filter?fleetJsonId=FLEET123&name=maersk&op=or'
      });
    }

    // Operator across fields
    const opRaw = req.query.op ?? req.query.operator ?? req.query.logic ?? 'and';
    const op = String(opRaw).trim().toLowerCase();
    if (op !== 'and' && op !== 'or') {
      return res.status(400).json({
        status: 'error',
        message: "invalid 'op' value. use 'and' or 'or'",
        hint: '/api/vessels/filter?fleetJsonId=FLEET123&name=maersk&op=or'
      });
    }

    // Scope: optional fleetJsonId (via internal HTTP call)
    const fleetJsonIdRaw = req.query.fleetJsonId;
    const fleetJsonIdStr = typeof fleetJsonIdRaw === 'string' ? String(fleetJsonIdRaw) : null;

    // Helpers
    const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
    const normalizeNeedles = (val) => {
      const arr = toArray(val);
      const out = [];
      for (let v of arr) {
        if (v === null || v === undefined) continue;
        const s = String(v).trim().toLowerCase();
        if (s !== '') out.push(s);
      }
      return out;
    };
    const parseFlag = (val) => {
      if (val === undefined) return false;
      const arr = toArray(val);
      return arr.some(item => {
        if (item === '' || item === null || item === undefined) return true;
        const s = String(item).trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(s)) return true;
        if (['0', 'false', 'no', 'off'].includes(s)) return false;
        return true;
      });
    };
    const normalizeStr = (v) => {
      if (v === null || v === undefined) return null;
      return String(v).trim().toLowerCase();
    };
    const valuesMatch = (valueStr, needles) => {
      if (!needles || needles.length === 0) return false;
      if (valueStr === null) return false;
      return needles.some(n => valueStr.includes(n));
    };
    const fieldMatches = (valueStr, needles, isNullFlag, isEmptyFlag) => {
      const parts = [];
      if (needles.length > 0) parts.push(valuesMatch(valueStr, needles));
      if (isNullFlag) parts.push(valueStr === null);
      if (isEmptyFlag) parts.push(valueStr !== null && valueStr.length === 0);
      return parts.length > 0 ? parts.some(Boolean) : null;
    };
    // Treat literal value "null" as IsNull flag
    const consumeNullToken = (needles, currentIsNullFlag) => {
      const hasNullToken = needles.includes('null');
      const filtered = hasNullToken ? needles.filter(n => n !== 'null') : needles;
      return { filtered, isNull: currentIsNullFlag || hasNullToken };
    };

    // Collect values per field
    const nameNeedles = normalizeNeedles(req.query.name);
    const flagNeedles = normalizeNeedles(req.query.flag);
    const mmsiNeedles = normalizeNeedles(req.query.mmsi);

    // Flags per field
    const nameIsNull = parseFlag(req.query.nameIsNull);
    const flagIsNull = parseFlag(req.query.flagIsNull);
    const mmsiIsNull = parseFlag(req.query.mmsiIsNull);

    const nameIsEmpty = parseFlag(req.query.nameIsEmpty);
    const flagIsEmpty = parseFlag(req.query.flagIsEmpty);
    const mmsiIsEmpty = parseFlag(req.query.mmsiIsEmpty);

    // Apply "null" token to flags
    const { filtered: nameNeedlesAdj, isNull: nameIsNullAdj } = consumeNullToken(nameNeedles, nameIsNull);
    const { filtered: flagNeedlesAdj, isNull: flagIsNullAdj } = consumeNullToken(flagNeedles, flagIsNull);
    const { filtered: mmsiNeedlesAdj, isNull: mmsiIsNullAdj } = consumeNullToken(mmsiNeedles, mmsiIsNull);

    // Scope candidate list by fleetJsonId via internal HTTP call (do this BEFORE checking anyFilters)
    let sourceVessels = data.vessels;
    if (fleetJsonIdStr) {
      try {
        sourceVessels = await fetchFleetVesselsFullViaHttp(fleetJsonIdStr);
      } catch (err) {
        console.error('Fleet scope fetch failed:', err);
        return res.status(502).json({
          status: 'error',
          message: 'Unable to scope by fleetJsonId (internal fetch failed)',
          detail: err.message
        });
      }
    }

    // Determine if there are any actual filters (values or flags).
    const anyFilters =
      nameNeedlesAdj.length || flagNeedlesAdj.length || mmsiNeedlesAdj.length ||
      nameIsNullAdj || flagIsNullAdj || mmsiIsNullAdj ||
      nameIsEmpty || flagIsEmpty || mmsiIsEmpty;

    // NEW: If there are no filters but fleetJsonId is provided, return the scoped fleet vessels.
    if (!anyFilters && fleetJsonIdStr) {
      if (!sourceVessels || sourceVessels.length === 0) {
        return res.status(404).json({ status: 'not_found', message: 'No vessels found for this fleet' });
      }
      return res.json(sourceVessels);
    }

    // Otherwise, if there are no filters and no fleet scope, reject.
    if (!anyFilters) {
      return res.status(404).json({
        status: 'not_found',
        message: "couldn't find any data. please check your filter paramters.",
        hint: '/api/vessels/filter?fleetJsonId=FLEET123&name=maersk&name=msc&op=or'
      });
    }

    const getRawName = (v) => v?.name ?? v?.vesselName ?? v?.title ?? null;
    const getRawFlag = (v) => v?.flag ?? v?.country ?? v?.Flag ?? null;
    const getRawMmsi = (v) => v?.mmsi ?? v?.MMSI ?? v?.mmsi_number ?? v?.mmsiNumber ?? null;

    // Apply filters
    const matches = sourceVessels.filter((v) => {
      const nm = normalizeStr(getRawName(v));
      const fg = normalizeStr(getRawFlag(v));
      const mm = normalizeStr(getRawMmsi(v));

      const nameChk = fieldMatches(nm, nameNeedlesAdj, nameIsNullAdj, nameIsEmpty);
      const flagChk = fieldMatches(fg, flagNeedlesAdj, flagIsNullAdj, flagIsEmpty);
      const mmsiChk = fieldMatches(mm, mmsiNeedlesAdj, mmsiIsNullAdj, mmsiIsEmpty);

      const checks = [];
      if (nameChk !== null) checks.push(nameChk);
      if (flagChk !== null) checks.push(flagChk);
      if (mmsiChk !== null) checks.push(mmsiChk);

      if (checks.length === 0) return false;
      return op === 'or' ? checks.some(Boolean) : checks.every(Boolean);
    });

    if (matches.length === 0) {
      return res.status(404).json({
        status: 'not_found',
        message: "Syntax is correct but couldn't find any data. please check your filter paramters.",
      });
    }

    return res.json(matches);
  } catch (err) {
    console.error('Error in /api/vessels/filter:', err);
    return res.status(500).json({
      status: 'error',
      message: 'please use the api wth correct syntax'
    });
  }
});

// Register /api/allroutes using source-scan from a separate module
registerRoutesListing(app, __filename, '/api/allroutes');

// optional reload endpoint -refresh data from JSON files
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