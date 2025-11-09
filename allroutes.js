const fs = require('fs').promises;
const path = require('path');

/**
 * Strip JS comments while preserving string literals.
 * Handles // line and /* block *\/ comments.
 */
function stripCommentsPreserveStrings(code) {
  let out = '';
  let i = 0;
  const n = code.length;

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inBlockComment = false;
  let inLineComment = false;
  let escapeNext = false;

  while (i < n) {
    const ch = code[i];
    const next = i + 1 < n ? code[i + 1] : '';

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      i++;
      continue;
    }

    if (inSingle) {
      out += ch;
      if (!escapeNext && ch === "'") inSingle = false;
      escapeNext = ch === '\\' && !escapeNext;
      i++;
      continue;
    }

    if (inDouble) {
      out += ch;
      if (!escapeNext && ch === '"') inDouble = false;
      escapeNext = ch === '\\' && !escapeNext;
      i++;
      continue;
    }

    if (inTemplate) {
      out += ch;
      if (!escapeNext && ch === '`') inTemplate = false;
      escapeNext = ch === '\\' && !escapeNext;
      i++;
      continue;
    }

    // Not inside string/comment: detect comment starts or string starts
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      out += ch;
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Count line number (1-based) for a character index within text.
 */
function lineNumberAt(text, idx) {
  // Count '\n' occurrences before idx
  let count = 1;
  for (let i = 0; i < idx; i++) {
    if (text[i] === '\n') count++;
  }
  return count;
}

/**
 * Build short example commands for a route.
 * Uses PORT from process.env (defaults to 3010).
 */
function buildExamples(method, routePath) {
  const port = process.env.PORT || 3010;
  const base = `http://localhost:${port}`;

  // Replace typical param placeholders with example values
  const demoPath = routePath
    .replace(':vesselJsonId', 'VESSEL123')
    .replace(':fleetJsonId', 'FLEET123');

  // Special-case for filter route: include a helpful query
  if (routePath.startsWith('/api/vessels/filter')) {
    const q = '?name=maersk&name=msc&op=or&fleetJsonId=FLEET123';
    return {
      exampleCurl: `curl "${base}${routePath}${q}"`,
      examplePS: `Invoke-RestMethod "${base}${routePath}${q}"`,
    };
  }

  const url = `${base}${demoPath}`;
  const exampleCurl = method === 'GET'
    ? `curl "${url}"`
    : `curl -X ${method} "${url}"`;

  const examplePS = method === 'GET'
    ? `Invoke-RestMethod "${url}"`
    : `Invoke-RestMethod -Method ${method} "${url}"`;

  return { exampleCurl, examplePS };
}

/**
 * Parse routes from source code.
 * Matches: app.<method>('path'| "path" | `path`)
 */
function parseRoutesFromSource(sourceCode) {
  const clean = stripCommentsPreserveStrings(sourceCode);

  const routeRegex = /\bapp\.(get|post|put|delete|patch|all)\s*\(\s*(['"`])([^'"`]+)\2/gi;
  const results = [];

  let m;
  while ((m = routeRegex.exec(clean)) !== null) {
    const method = m[1].toUpperCase();
    const pathLiteral = m[3];
    const idx = m.index;
    results.push({
      method,
      path: pathLiteral,
     line: lineNumberAt(clean, idx),  //line number  of route definition
    });
  }

  // Deduplicate by method+path, keep the first (lowest line)
  const dedup = new Map();
  for (const r of results) {
    const key = `${r.method} ${r.path}`;
    if (!dedup.has(key) || dedup.get(key).line > r.line) {
      dedup.set(key, r);
    }
  }

  // Sort by path then method then line
  return Array.from(dedup.values()).sort((a, b) => {
    if (a.path === b.path) {
      if (a.method === b.method) return a.line - b.line;
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });
}

/**
 * Mounts a GET endpoint that returns discovered routes in the given source file.
 * @param {import('express').Express} app
 * @param {string} sourceFilePath Absolute path to the server source (usually __filename of server.js)
 * @param {string} mountPath Endpoint path to expose (default '/api/allroutes')
 */
function registerRoutesListing(app, sourceFilePath, mountPath = '/api/allroutes') {
  const fileToRead = path.resolve(sourceFilePath);
  const fileBase = path.basename(fileToRead); // <-- add this

  app.get(mountPath, async (_req, res) => {
    try {
      const code = await fs.readFile(fileToRead, 'utf8');
      const routes = parseRoutesFromSource(code);

      // Attach examples + file metadata per route
      const routesWithExamples = routes.map(r => ({
        ...r,
        //file: fileBase,                  // e.g., "server.js"
        //filePath: fileToRead,            // full absolute path
        source: `${fileBase}:${r.line}`, // e.g., "server.js:123"
        ...buildExamples(r.method, r.path),
      }));

      return res.json({
        file: fileToRead,
        count: routesWithExamples.length,
        routes: routesWithExamples,
        scannedAt: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to scan routes',
        detail: err?.message || String(err),
      });
    }
  });
}

module.exports = {
  registerRoutesListing,
  parseRoutesFromSource,
};