const https = require('https');
const fs = require('fs');
const path = require('path');

const QUERY = `
[out:json][timeout:90];
(
  relation["route"="tram"]["network"="Ruter"]["ref"];
  relation["route"="subway"]["network"="Ruter"]["ref"];
);
(._;>;);
out body;
`;

const LINE_COLORS = {
  tram:   { '11': '#9B1FA0', '12': '#E8000D', '13': '#FF6600', '17': '#CC0066', '18': '#E87722', '19': '#A3195B' },
  subway: { '1':  '#E8000D', '2':  '#003399', '3':  '#009933', '4':  '#9B1FA0', '5':  '#FF6600' },
};

const OVERPASS_ENDPOINTS = [
  { hostname: 'overpass-api.de', path: '/api/interpreter' },
  { hostname: 'overpass.kumi.systems', path: '/api/interpreter' },
];

function fetchOverpass(query, endpointIndex = 0) {
  return new Promise((resolve, reject) => {
    if (endpointIndex >= OVERPASS_ENDPOINTS.length) {
      return reject(new Error('All Overpass endpoints failed'));
    }
    const endpoint = OVERPASS_ENDPOINTS[endpointIndex];
    console.log(`  Prøver ${endpoint.hostname}...`);
    const postData = 'data=' + encodeURIComponent(query);
    const options = {
      hostname: endpoint.hostname,
      path: endpoint.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 120000,
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (!data.trimStart().startsWith('{')) {
          console.log(`  ${endpoint.hostname} returnerte ikke JSON (HTTP ${res.statusCode}), prøver neste...`);
          fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.log(`  JSON parse-feil fra ${endpoint.hostname}, prøver neste...`);
          fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
        }
      });
    });
    req.on('error', err => {
      console.log(`  Feil fra ${endpoint.hostname}: ${err.message}, prøver neste...`);
      fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
    });
    req.on('timeout', () => {
      req.destroy();
      console.log(`  Timeout fra ${endpoint.hostname}, prøver neste...`);
      fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
    });
    req.write(postData);
    req.end();
  });
}

function coordsMatch(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1];
}

function stitchWays(ways) {
  if (ways.length === 0) return [];
  const remaining = ways.map(w => [...w]);
  const chains = [];

  while (remaining.length > 0) {
    const chain = remaining.shift();
    let changed = true;
    while (remaining.length > 0 && changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const head = chain[chain.length - 1];
        const tail = chain[0];
        if (coordsMatch(head, way[0])) {
          chain.push(...way.slice(1)); remaining.splice(i, 1); changed = true; break;
        }
        if (coordsMatch(head, way[way.length - 1])) {
          chain.push(...[...way].reverse().slice(1)); remaining.splice(i, 1); changed = true; break;
        }
        if (coordsMatch(tail, way[way.length - 1])) {
          chain.unshift(...way.slice(0, -1)); remaining.splice(i, 1); changed = true; break;
        }
        if (coordsMatch(tail, way[0])) {
          chain.unshift(...[...way].reverse().slice(0, -1)); remaining.splice(i, 1); changed = true; break;
        }
      }
    }
    chains.push(chain);
  }
  return chains; // array of connected chains — no cross-city jumps between disconnected segments
}

function buildGeoJSON(osmData) {
  const nodeById = {};
  for (const el of osmData.elements) {
    if (el.type === 'node') nodeById[el.id] = [el.lon, el.lat];
  }
  const wayById = {};
  for (const el of osmData.elements) {
    if (el.type === 'way') {
      wayById[el.id] = el.nodes.map(nid => nodeById[nid]).filter(Boolean);
    }
  }

  // Collect all unique way IDs per (routeType, ref) across all relations
  const lineWayIds = {};
  for (const el of osmData.elements) {
    if (el.type !== 'relation') continue;
    const routeType = el.tags.route;
    const ref = el.tags.ref;
    if (!ref) continue;
    const key = `${routeType}-${ref}`;
    if (!lineWayIds[key]) lineWayIds[key] = { routeType, ref, wayIds: new Set() };
    el.members.filter(m => m.type === 'way').forEach(m => lineWayIds[key].wayIds.add(m.ref));
  }

  const features = [];

  for (const [, { routeType, ref, wayIds }] of Object.entries(lineWayIds)) {
    const ways = [...wayIds].map(id => wayById[id]).filter(Boolean);
    const chains = stitchWays(ways);

    const colorMap = LINE_COLORS[routeType] || {};
    const color = colorMap[ref] || '#888888';
    const typeName = routeType === 'tram' ? 'Trikk' : 'T-bane';

    for (const coords of chains) {
      const deduped = coords.filter((c, i) =>
        i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1]
      );
      if (deduped.length < 20) continue; // skip tiny segments (sidings, depot tracks)
      features.push({
        type: 'Feature',
        properties: { line: ref, type: routeType, name: `${typeName} ${ref}`, color },
        geometry: { type: 'LineString', coordinates: deduped },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

async function main() {
  // Support --from-cache <file> for offline use / testing
  const cacheArg = process.argv.indexOf('--from-cache');
  let osmData;
  if (cacheArg !== -1 && process.argv[cacheArg + 1]) {
    const cacheFile = process.argv[cacheArg + 1];
    console.log(`Leser fra lokal cache: ${cacheFile}`);
    osmData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } else {
    console.log('Henter fra Overpass API...');
    osmData = await fetchOverpass(QUERY);
  }
  console.log(`Fikk ${osmData.elements.length} elementer`);
  const geojson = buildGeoJSON(osmData);
  console.log(`Bygget ${geojson.features.length} linjer:`);
  geojson.features.forEach(f => console.log(`  ${f.properties.name} (${f.properties.color})`));
  const outPath = path.join(__dirname, '..', 'js', 'oslo-transit-lines.json');
  fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`Lagret til js/oslo-transit-lines.json`);
}

main().catch(console.error);
