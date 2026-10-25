// Finds stretches where two or more lines run on the same track and adds them to
// js/oslo-transit-lines.json as `shared` features, so the map can draw them striped
// in every line's colour instead of letting the last-drawn line hide the others.
// Run after generate-transit-lines.js: node scripts/add-shared-segments.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'js', 'oslo-transit-lines.json');
const TOL = 0.00015;      // ~15 m, in degrees
const MIN_RUN = 4;        // vertices
const MAX_GAP = 3;        // vertices of different coverage bridged inside one run
const RETRACE_RATIO = 0.7; // share of a run's tail that must lie on its head to count as the way back

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const lines = data.features.filter(f => !f.properties.shared);

function buildGrid(points) {
  const grid = new Map();
  for (const [x, y] of points) {
    const key = `${Math.floor(x / TOL)}:${Math.floor(y / TOL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([x, y]);
  }
  return grid;
}

function isNear([x, y], grid) {
  const cx = Math.floor(x / TOL), cy = Math.floor(y / TOL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const [wx, wy] of grid.get(`${cx + dx}:${cy + dy}`) || []) {
        if (Math.abs(wx - x) < TOL && Math.abs(wy - y) < TOL) return true;
      }
    }
  }
  return false;
}

// A run can pass a terminus and come back on the parallel track. Dashes on both
// tracks have different phases and fill each other's gaps, so keep only the way out.
function dropReturnLeg(coords) {
  const [x0, y0] = coords[0];
  let far = 0, farDist = -1;
  coords.forEach(([x, y], i) => {
    const d = Math.hypot(x - x0, y - y0);
    if (d > farDist) { farDist = d; far = i; }
  });
  const head = buildGrid(coords.slice(0, far + 1));
  const tail = coords.slice(far + 1);
  if (tail.length < MIN_RUN) return coords;
  const retraced = tail.filter(p => isNear(p, head)).length / tail.length;
  return retraced >= RETRACE_RATIO ? coords.slice(0, far + 1) : coords;
}

const lineNumber = name => parseInt(name.replace(/\D/g, ''), 10);
const shared = [];
const emitted = new Map(); // `${type}:${members}` -> grid of points already drawn

for (const type of ['tram', 'subway']) {
  const ofType = lines.filter(f => f.properties.type === type);
  const names = [...new Set(ofType.map(f => f.properties.name))].sort((a, b) => lineNumber(a) - lineNumber(b));
  const colorOf = Object.fromEntries(ofType.map(f => [f.properties.name, f.properties.color]));
  const grids = Object.fromEntries(names.map(n => [
    n, buildGrid(ofType.filter(f => f.properties.name === n).flatMap(f => f.geometry.coordinates)),
  ]));

  for (const name of names) {
    // One feature per line is enough: the other direction runs on the same track
    const feature = ofType.filter(f => f.properties.name === name)
      .reduce((a, b) => (b.geometry.coordinates.length > a.geometry.coordinates.length ? b : a));
    const coords = feature.geometry.coordinates;
    const keys = coords.map(p => names.filter(n => n === name || isNear(p, grids[n])).join('|'));

    let i = 0;
    while (i < coords.length) {
      if (!keys[i].includes('|')) { i++; continue; }
      let end = i, j = i + 1, gap = 0;
      while (j < coords.length && gap <= MAX_GAP) {
        if (keys[j] === keys[i]) { end = j; gap = 0; } else gap++;
        j++;
      }
      const members = keys[i].split('|');
      const run = end - i + 1 >= MIN_RUN && members[0] === name ? dropReturnLeg(coords.slice(i, end + 1)) : null;
      // The opposite direction of a stretch already emitted would only add a second, out-of-phase dash pattern
      const groupKey = `${type}:${keys[i]}`;
      const seen = emitted.get(groupKey);
      const isReturn = run && seen && run.filter(p => isNear(p, seen)).length / run.length >= RETRACE_RATIO;
      if (run && !isReturn) {
        emitted.set(groupKey, buildGrid([...(seen ? [...seen.values()].flat() : []), ...run]));
        shared.push({
          type: 'Feature',
          properties: {
            type,
            shared: true,
            name: members.join(' og ').replace(/ (Trikk|T-bane) /g, ' '),
            names: members,
            colors: members.map(n => colorOf[n]),
          },
          geometry: { type: 'LineString', coordinates: run },
        });
      }
      i = end + 1;
    }
  }
}

data.features = [...lines, ...shared];
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log(`${lines.length} linjer, ${shared.length} delte strekk`);
for (const s of shared) console.log(' ', s.properties.type, s.properties.name, s.geometry.coordinates.length, 'pkt');
