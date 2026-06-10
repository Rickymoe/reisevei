# Transit Lines Map Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vis trikk- og T-banelinjer for Oslo som valgfri overlay på kartet, toggled via en flytende knapp.

**Architecture:** En statisk GeoJSON-fil (`js/oslo-transit-lines.json`) generert fra OpenStreetMap inneholder linjegeometri for trikk (12–19) og T-bane (1–5). En ny fil `js/transit-lines.js` laster GeoJSON, bygger `google.maps.Polyline`-objekter og håndterer toggle. Toggle-knappen er en `<button>` lagt direkte i `#map`-diven via `app.js`.

**Tech Stack:** Node.js (datahenting, én gang), Google Maps Polyline API, statisk GeoJSON (FeatureCollection)

---

### Task 1: Generer statisk GeoJSON fra OpenStreetMap

**Files:**
- Create: `scripts/generate-transit-lines.js`
- Create: `js/oslo-transit-lines.json` (output fra scriptet)

- [ ] **Steg 1: Opprett genereringsskript**

Opprett `scripts/generate-transit-lines.js`:

```javascript
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
  tram:   { '12': '#E8000D', '13': '#FF6600', '15': '#9B1FA0', '17': '#CC0066', '18': '#E87722', '19': '#A3195B' },
  subway: { '1':  '#E8000D', '2':  '#003399', '3':  '#009933', '4':  '#9B1FA0', '5':  '#FF6600' },
};

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = 'data=' + encodeURIComponent(query);
    const options = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
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

  const seenKey = new Set();
  const features = [];

  for (const el of osmData.elements) {
    if (el.type !== 'relation') continue;
    const routeType = el.tags.route;
    const ref = el.tags.ref;
    if (!ref) continue;

    const key = `${routeType}-${ref}`;
    if (seenKey.has(key)) continue; // keep first relation per line
    seenKey.add(key);

    const coords = el.members
      .filter(m => m.type === 'way')
      .flatMap(m => wayById[m.ref] || []);

    if (coords.length < 2) continue;

    const colorMap = LINE_COLORS[routeType] || {};
    const color = colorMap[ref] || '#888888';
    const typeName = routeType === 'tram' ? 'Trikk' : 'T-bane';

    features.push({
      type: 'Feature',
      properties: { line: ref, type: routeType, name: `${typeName} ${ref}`, color },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  return { type: 'FeatureCollection', features };
}

async function main() {
  console.log('Henter fra Overpass API...');
  const osmData = await fetchOverpass(QUERY);
  console.log(`Fikk ${osmData.elements.length} elementer`);
  const geojson = buildGeoJSON(osmData);
  console.log(`Bygget ${geojson.features.length} linjer:`);
  geojson.features.forEach(f => console.log(`  ${f.properties.name} (${f.properties.color})`));
  const outPath = path.join(__dirname, '..', 'js', 'oslo-transit-lines.json');
  fs.writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`Lagret til js/oslo-transit-lines.json`);
}

main().catch(console.error);
```

- [ ] **Steg 2: Kjør scriptet**

```bash
node /home/ricky/Dokumenter/Koding/reisevei/scripts/generate-transit-lines.js
```

Forventet output (ca.):
```
Henter fra Overpass API...
Fikk XXXX elementer
Bygget 11 linjer:
  Trikk 12 (#E8000D)
  Trikk 13 (#FF6600)
  ...
  T-bane 5 (#FF6600)
Lagret til js/oslo-transit-lines.json
```

Hvis scriptet lister færre enn 10 linjer: åpne `js/oslo-transit-lines.json` og sjekk hvilke linjer som mangler. Sjekk om Overpass returnerte riktige relasjoner med `console.log(osmData.elements.filter(e => e.type === 'relation').map(e => e.tags))`.

- [ ] **Steg 3: Verifiser GeoJSON-filen**

```bash
node -e "
const g = require('./js/oslo-transit-lines.json');
g.features.forEach(f => {
  const pts = f.geometry.coordinates.length;
  console.log(f.properties.name, '—', pts, 'punkter');
});
"
```

Kjøres fra `/home/ricky/Dokumenter/Koding/reisevei`.

Forventet: Hver linje har > 50 koordinatpunkter. Hvis en linje har < 10 punkter, er geometrien sannsynligvis feil — re-kjør scriptet eller sjekk OSM-dataene manuelt.

- [ ] **Steg 4: Commit data og script**

```bash
git -C /home/ricky/Dokumenter/Koding/reisevei add js/oslo-transit-lines.json scripts/generate-transit-lines.js
git -C /home/ricky/Dokumenter/Koding/reisevei commit -m "Add static Oslo transit lines GeoJSON (tram + metro)"
```

---

### Task 2: Opprett `js/transit-lines.js`

**Files:**
- Create: `js/transit-lines.js`

- [ ] **Steg 1: Opprett filen**

Opprett `/home/ricky/Dokumenter/Koding/reisevei/js/transit-lines.js`:

```javascript
let transitPolylines = [];
let transitVisible = false;

async function loadTransitLines() {
  try {
    const resp = await fetch('js/oslo-transit-lines.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    transitPolylines = geojson.features.map(f => {
      const path = f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      return new google.maps.Polyline({
        path,
        strokeColor: f.properties.color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map: null,
        zIndex: 1,
      });
    });
  } catch (err) {
    console.error('Kunne ikke laste kollektivlinjer:', err);
    const btn = document.getElementById('transit-toggle-btn');
    if (btn) btn.remove();
  }
}

function setTransitVisible(visible) {
  transitVisible = visible;
  transitPolylines.forEach(p => p.setMap(visible ? map : null));
  const btn = document.getElementById('transit-toggle-btn');
  if (btn) btn.classList.toggle('active', visible);
}

function initTransitToggle() {
  const btn = document.createElement('button');
  btn.id = 'transit-toggle-btn';
  btn.innerHTML = '🚋 Linjer';
  btn.title = 'Vis/skjul trikk og T-banelinjer';
  btn.addEventListener('click', () => setTransitVisible(!transitVisible));
  document.getElementById('map').appendChild(btn);
  loadTransitLines();
}
```

- [ ] **Steg 2: Bekreft syntaks**

```bash
node --check /home/ricky/Dokumenter/Koding/reisevei/js/transit-lines.js
```

Forventet: ingen output (ingen syntaksfeil).

- [ ] **Steg 3: Commit**

```bash
git -C /home/ricky/Dokumenter/Koding/reisevei add js/transit-lines.js
git -C /home/ricky/Dokumenter/Koding/reisevei commit -m "Add transit-lines.js: load GeoJSON and toggle polylines"
```

---

### Task 3: Legg til CSS for toggle-knappen

**Files:**
- Modify: `css/style.css`

- [ ] **Steg 1: Legg til CSS på slutten av `css/style.css`**

Legg til etter siste linje i filen:

```css
#transit-toggle-btn {
  position: absolute;
  bottom: 40px;
  right: 10px;
  z-index: 10;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
}

#transit-toggle-btn.active {
  background: #1a73e8;
  color: white;
  border-color: #1a73e8;
}

#transit-toggle-btn:hover:not(.active) {
  background: #f5f5f5;
}
```

- [ ] **Steg 2: Commit**

```bash
git -C /home/ricky/Dokumenter/Koding/reisevei add css/style.css
git -C /home/ricky/Dokumenter/Koding/reisevei commit -m "Add CSS for transit lines toggle button"
```

---

### Task 4: Koble opp i `index.html` og `app.js`

**Files:**
- Modify: `index.html`
- Modify: `js/app.js` (linje ~59–63)

- [ ] **Steg 1: Legg til script-tag i `index.html`**

I `index.html`, legg til `<script src="js/transit-lines.js"></script>` rett før `app.js`-scriptet:

```html
  <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
  <script src="js/entur.js"></script>
  <script src="js/isochrone.js"></script>
  <script src="js/transit-lines.js"></script>
  <script src="js/app.js"></script>
```

- [ ] **Steg 2: Kall `initTransitToggle()` fra `initMap()` i `app.js`**

I `app.js`, finn `initMap()`-funksjonen (starter ca. linje 19) og legg til kallet etter `setupPanel()`:

```javascript
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 12,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    mapId: 'DEMO_MAP_ID',
  });
  geocoder = new google.maps.Geocoder();

  map.addListener('click', onMapClick);
  setupPanel();
  setDefaultDepartureTime();
  initTransitToggle();
}
```

- [ ] **Steg 3: Commit**

```bash
git -C /home/ricky/Dokumenter/Koding/reisevei add index.html js/app.js
git -C /home/ricky/Dokumenter/Koding/reisevei commit -m "Wire up transit toggle in initMap and index.html"
```

---

### Task 5: Test i nettleser og push

**Files:** ingen nye endringer

- [ ] **Steg 1: Åpne appen lokalt**

Åpne `file:///home/ricky/Dokumenter/Koding/reisevei/index.html` i Chrome, eller kjør en enkel HTTP-server:

```bash
python3 -m http.server 8080 --directory /home/ricky/Dokumenter/Koding/reisevei
```

Åpne `http://localhost:8080`.

**Merk:** GeoJSON-filen lastes med `fetch()` som krever HTTP (ikke `file://`). Bruk HTTP-serveren.

- [ ] **Steg 2: Verifiser knapp vises**

Kontroller at «🚋 Linjer»-knappen vises nederst til høyre på kartet ved oppstart.

- [ ] **Steg 3: Verifiser toggle av**

Klikk knappen — linjene skal vises på kartet med distinkte farger per linje. Knappen skal bli blå.

- [ ] **Steg 4: Verifiser toggle på**

Klikk knappen igjen — linjene forsvinner. Knappen blir hvit igjen.

- [ ] **Steg 5: Verifiser ingen regresjon**

Legg et punkt på kartet, klikk «Finn reiseveier» — isokronen skal tegnes normalt med linjene synlige. Linjene skal vises under isokronen (lavere z-index).

- [ ] **Steg 6: Sjekk konsollen**

Åpne DevTools → Console. Ingen røde feil. Hvis «Kunne ikke laste kollektivlinjer» vises, sjekk at `js/oslo-transit-lines.json` finnes og at du bruker HTTP-server (ikke file://).

- [ ] **Steg 7: Push**

```bash
git -C /home/ricky/Dokumenter/Koding/reisevei push
```
