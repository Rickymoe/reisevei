const https = require('https');

const QUERY = `
[out:json][timeout:60];
(
  node["highway"="bus_stop"](59.5,10.2,60.2,11.5);
  node["public_transport"="stop_position"]["bus"="yes"](59.5,10.2,60.2,11.5);
);
out body;
`;

const OVERPASS_ENDPOINTS = [
  { hostname: 'maps.mail.ru', path: '/osm/tools/overpass/api/interpreter' },
  { hostname: 'overpass.kumi.systems', path: '/api/interpreter' },
  { hostname: 'overpass-api.de', path: '/api/interpreter' },
  { hostname: 'overpass.openstreetmap.fr', path: '/api/interpreter' },
];

function fetchOverpass(query, endpointIndex = 0) {
  return new Promise((resolve, reject) => {
    if (endpointIndex >= OVERPASS_ENDPOINTS.length) {
      return reject(new Error('Alle Overpass-endepunkter feilet'));
    }
    const endpoint = OVERPASS_ENDPOINTS[endpointIndex];
    console.error(`  Prøver ${endpoint.hostname}...`);
    const compactQuery = query
      .replace(/\s+/g, ' ')    // collapse all whitespace to single spaces
      .replace(/\s*([;(){}\[\]])\s*/g, '$1')  // remove spaces around syntax chars
      .trim();
    const postData = 'data=' + encodeURIComponent(compactQuery);
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
          console.error(`  ${endpoint.hostname} returnerte ikke JSON (HTTP ${res.statusCode}), prøver neste...`);
          fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error(`  JSON parse-feil, prøver neste...`);
          fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
        }
      });
    });
    req.on('error', err => {
      console.error(`  Feil fra ${endpoint.hostname}: ${err.message}, prøver neste...`);
      fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
    });
    req.on('timeout', () => {
      req.destroy();
      console.error(`  Timeout fra ${endpoint.hostname}, prøver neste...`);
      fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
    });
    req.write(postData);
    req.end();
  });
}

function buildGeoJSON(osmData) {
  const features = [];
  const seen = new Set();
  for (const el of osmData.elements) {
    if (el.type !== 'node') continue;
    const key = `${el.lon},${el.lat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      properties: { name: el.tags?.name || '' },
    });
  }
  return { type: 'FeatureCollection', features };
}

async function main() {
  console.error('Henter bussholdeplasser fra Overpass API...');
  const osmData = await fetchOverpass(QUERY);
  console.error(`Fikk ${osmData.elements.length} noder`);
  const geojson = buildGeoJSON(osmData);
  console.error(`Bygget ${geojson.features.length} unike holdeplasser`);
  process.stdout.write(JSON.stringify(geojson));
}

main().catch(err => { console.error(err); process.exit(1); });
