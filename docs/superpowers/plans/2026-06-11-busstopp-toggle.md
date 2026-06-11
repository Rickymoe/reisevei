# Busstopp-toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til en toggle-knapp nederst til høyre som viser alle bussholdeplasser i Oslo-regionen som røde prikker på kartet.

**Architecture:** Statisk GeoJSON genereres én gang med et Node.js-script (Overpass API), lagres i `js/oslo-bus-stops.json`, og lastes av `js/bus-stops.js` som følger eksakt samme mønster som `js/transit-lines.js`. Knappen bruker eksisterende `.transit-btn`-CSS og plasseres over trikk-knappen (`bottom: 140px`).

**Tech Stack:** Vanilla JS, Google Maps JavaScript API (`google.maps.Marker` med `SymbolPath.CIRCLE`), Overpass API (OSM), Node.js (generering), statisk GeoJSON.

---

## Filstruktur

| Fil | Handling | Ansvar |
|---|---|---|
| `scripts/generate-bus-stops.js` | Opprett | Henter busstransport-noder fra Overpass, skriver GeoJSON til stdout |
| `js/oslo-bus-stops.json` | Generer | Statisk GeoJSON med ~2000–3000 bussholdeplasser |
| `js/bus-stops.js` | Opprett | Laster GeoJSON, oppretter markører, toggle-logikk, initialiserer knapp |
| `css/style.css` | Endre | Legg til `#bus-stops-toggle-btn { bottom: 140px; }` |
| `index.html` | Endre | Legg til script-tag for `bus-stops.js` |
| `js/app.js` | Endre | Kall `initBusStopsToggle()` fra `initMap()` |

---

## Task 1: Skriv generate-script

**Files:**
- Create: `scripts/generate-bus-stops.js`

- [ ] **Steg 1: Opprett scriptet**

Opprett `scripts/generate-bus-stops.js` med følgende innhold:

```js
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
  { hostname: 'overpass-api.de', path: '/api/interpreter' },
  { hostname: 'overpass.kumi.systems', path: '/api/interpreter' },
];

function fetchOverpass(query, endpointIndex = 0) {
  return new Promise((resolve, reject) => {
    if (endpointIndex >= OVERPASS_ENDPOINTS.length) {
      return reject(new Error('Alle Overpass-endepunkter feilet'));
    }
    const endpoint = OVERPASS_ENDPOINTS[endpointIndex];
    console.error(`  Prøver ${endpoint.hostname}...`);
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
          console.error(`  ${endpoint.hostname} returnerte ikke JSON, prøver neste...`);
          fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          console.error(`  JSON parse-feil, prøver neste...`);
          fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
        }
      });
    });
    req.on('error', err => {
      console.error(`  Feil: ${err.message}, prøver neste...`);
      fetchOverpass(query, endpointIndex + 1).then(resolve).catch(reject);
    });
    req.on('timeout', () => {
      req.destroy();
      console.error(`  Timeout, prøver neste...`);
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
```

> Merk: All fremdrift logges til `stderr` slik at stdout kan redirectes direkte til JSON-fil.

- [ ] **Steg 2: Commit**

```bash
git add scripts/generate-bus-stops.js
git commit -m "feat: add Overpass script for Oslo bus stops GeoJSON"
```

---

## Task 2: Generer statisk GeoJSON

**Files:**
- Create: `js/oslo-bus-stops.json`

- [ ] **Steg 1: Kjør scriptet**

```bash
node scripts/generate-bus-stops.js > js/oslo-bus-stops.json
```

Forventet stderr-output (kan ta 10–30 sek):
```
Henter bussholdeplasser fra Overpass API...
  Prøver overpass-api.de...
Fikk XXXX noder
Bygget YYYY unike holdeplasser
```

Forventet antall: 2000–4000 holdeplasser.

- [ ] **Steg 2: Verifiser filen**

```bash
node -e "const f = require('./js/oslo-bus-stops.json'); console.log('Features:', f.features.length); console.log('Første:', JSON.stringify(f.features[0]))"
```

Forventet output: `Features: <tall>` og et feature-objekt med `coordinates` og `properties.name`.

- [ ] **Steg 3: Commit**

```bash
git add js/oslo-bus-stops.json
git commit -m "feat: add static Oslo bus stops GeoJSON (generated from OSM)"
```

---

## Task 3: Skriv bus-stops.js

**Files:**
- Create: `js/bus-stops.js`

- [ ] **Steg 1: Opprett modulen**

Opprett `js/bus-stops.js`:

```js
let busStopMarkers = [];
let busStopsVisible = false;

async function loadBusStops() {
  try {
    const resp = await fetch('js/oslo-bus-stops.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    for (const f of geojson.features) {
      const [lng, lat] = f.geometry.coordinates;
      busStopMarkers.push(new google.maps.Marker({
        position: { lat, lng },
        map: null,
        title: f.properties.name || undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#e53935',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1,
          scale: 5,
        },
        zIndex: 2,
      }));
    }
    if (busStopsVisible) busStopMarkers.forEach(m => m.setMap(map));
  } catch (err) {
    console.error('Kunne ikke laste bussholdeplasser:', err);
    document.getElementById('bus-stops-toggle-btn')?.remove();
  }
}

function setBusStopsVisible(visible) {
  busStopsVisible = visible;
  busStopMarkers.forEach(m => m.setMap(visible ? map : null));
  document.getElementById('bus-stops-toggle-btn')?.classList.toggle('active', visible);
}

function initBusStopsToggle() {
  const btn = document.createElement('button');
  btn.id = 'bus-stops-toggle-btn';
  btn.className = 'transit-btn';
  btn.innerHTML = '🚌 Buss';
  btn.title = 'Vis/skjul bussholdeplasser';
  btn.addEventListener('click', () => setBusStopsVisible(!busStopsVisible));
  document.body.appendChild(btn);
  loadBusStops();
}
```

- [ ] **Steg 2: Commit**

```bash
git add js/bus-stops.js
git commit -m "feat: add bus-stops toggle module"
```

---

## Task 4: Koble inn i app, HTML og CSS

**Files:**
- Modify: `js/app.js:32`
- Modify: `index.html:59`
- Modify: `css/style.css:327`

- [ ] **Steg 1: Legg til kall i `initMap()` i `js/app.js`**

Finn linjen `initTransitToggle();` (linje 32) og legg til én linje etter:

```js
  initTransitToggle();
  initBusStopsToggle();
```

- [ ] **Steg 2: Legg til script-tag i `index.html`**

Finn linjen `<script src="js/transit-lines.js"></script>` og legg til én linje etter:

```html
  <script src="js/transit-lines.js"></script>
  <script src="js/bus-stops.js"></script>
```

- [ ] **Steg 3: Legg til CSS for knapp-posisjon i `css/style.css`**

Finn linjen `#subway-toggle-btn { bottom: 40px; }` og legg til én linje etter:

```css
#tram-toggle-btn { bottom: 90px; }
#subway-toggle-btn { bottom: 40px; }
#bus-stops-toggle-btn { bottom: 140px; }
```

- [ ] **Steg 4: Commit**

```bash
git add js/app.js index.html css/style.css
git commit -m "feat: wire bus stop toggle into map init, HTML, and CSS"
```

---

## Task 5: Manuell verifisering

Ingen test-rammeverk i prosjektet — verifiser i nettleser.

- [ ] **Steg 1: Åpne appen lokalt**

Åpne `index.html` direkte i nettleseren (eller via en lokal HTTP-server om nødvendig for at `fetch()` skal fungere):

```bash
python3 -m http.server 8080 --directory /home/ricky/Dokumenter/Koding/reisevei
# Åpne http://localhost:8080
```

- [ ] **Steg 2: Sjekk at knappen vises**

Forventet: en `🚌 Buss`-knapp vises nederst til høyre, over `🚋 Trikk`-knappen.

- [ ] **Steg 3: Toggle på**

Klikk `🚌 Buss`. Forventet:
- Knappen blir blå (`.active`)
- Røde prikker dukker opp spredt over Oslo-kartet

- [ ] **Steg 4: Toggle av**

Klikk `🚌 Buss` igjen. Forventet:
- Knappen blir hvit
- Alle røde prikker forsvinner

- [ ] **Steg 5: Sjekk at trikk/t-bane fortsatt fungerer**

Toggle `🚋 Trikk` og `🚇 T-bane` uavhengig og bekreft at de ikke interfererer med busstopp-laget.

- [ ] **Steg 6: Sjekk konsollen**

Åpne DevTools → Console. Det skal ikke være noen feil knyttet til `bus-stops.js` eller `oslo-bus-stops.json`.

- [ ] **Steg 7: Push til GitHub Pages**

```bash
git push
```

Verifiser live på `https://rickymoe.github.io/reisevei/` etter ~1 minutt.
