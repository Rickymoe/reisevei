# Isokronkart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statisk web-app på GitHub Pages som viser isokronpolygoner basert på Entur kollektivdata — brukeren pinner inntil 3 punkter og ser hvilke nabolag som er nåbare innen X minutter.

**Architecture:** Ren frontend — ingen backend. Google Maps JS API for kart, Entur GraphQL direkte fra nettleseren for stopp og reisetider, Turf.js for alpha shape (concave hull) og interseksjon. Floating panel øverst til venstre over kartet.

**Tech Stack:** Vanilla JS (ES modules via CDN), Google Maps JS API, Turf.js v6, Entur Journey Planner GraphQL v3

---

## Filstruktur

```
isokronkart/
├── index.html              — app-shell, Google Maps init, CDN-imports, panel-HTML
├── css/
│   └── style.css           — floating panel, fremdriftsindikator, polygon-legend
└── js/
    ├── app.js              — UI-logikk, punkt-håndtering, Beregn-flyt, kart-tegning
    ├── entur.js            — Entur GraphQL-klient: stopsByRadius + trip-kall
    └── isochrone.js        — alpha shape (Turf.js), interseksjon, farger
```

---

## Task 1: Prosjektscaffold

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/app.js`
- Create: `js/entur.js`
- Create: `js/isochrone.js`
- Create: `.gitignore`

- [ ] **Steg 1: Opprett .gitignore**

```
.superpowers/
.DS_Store
```

- [ ] **Steg 2: Opprett index.html**

```html
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Isokronkart</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <div id="map"></div>

  <div id="panel">
    <h2>Isokronkart</h2>

    <div id="points-container"></div>

    <button id="add-point-btn" class="secondary-btn">+ Legg til punkt</button>

    <div class="field-group">
      <label for="departure-time">Avgangstid</label>
      <input type="datetime-local" id="departure-time" />
    </div>

    <button id="beregn-btn">Beregn</button>

    <div id="progress" class="hidden">
      <span id="progress-text">Beregner...</span>
    </div>

    <div id="error-msg" class="hidden"></div>
  </div>

  <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
  <script src="js/entur.js"></script>
  <script src="js/isochrone.js"></script>
  <script src="js/app.js"></script>
  <script
    src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap"
    async defer>
  </script>
</body>
</html>
```

- [ ] **Steg 3: Opprett css/style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

#map { position: absolute; inset: 0; }

#panel {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 16px;
  width: 260px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}

#panel h2 { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #1a1a2e; }

.point-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 8px;
}

.point-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.point-label {
  font-size: 12px;
  color: #555;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.point-minutes {
  width: 52px;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #ddd;
  border-radius: 6px;
  text-align: right;
}

.point-minutes::after { content: ' min'; }

.remove-btn {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}

.remove-btn:hover { color: #e55; }

.field-group { margin: 10px 0; }

.field-group label { display: block; font-size: 11px; color: #888; margin-bottom: 4px; }

.field-group input {
  width: 100%;
  font-size: 12px;
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

#beregn-btn {
  width: 100%;
  padding: 9px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}

#beregn-btn:hover { background: #1558b0; }
#beregn-btn:disabled { background: #aaa; cursor: default; }

.secondary-btn {
  width: 100%;
  padding: 7px;
  background: white;
  color: #1a73e8;
  border: 1px solid #1a73e8;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  margin-bottom: 8px;
}

.secondary-btn:hover { background: #f0f7ff; }
.secondary-btn:disabled { color: #aaa; border-color: #aaa; cursor: default; }

#progress { margin-top: 8px; font-size: 12px; color: #555; text-align: center; }

#error-msg {
  margin-top: 8px;
  font-size: 12px;
  color: #c62828;
  background: #ffebee;
  padding: 8px;
  border-radius: 6px;
}

.hidden { display: none; }
```

- [ ] **Steg 4: Opprett js/entur.js, js/isochrone.js, js/app.js som tomme filer**

`js/entur.js`:
```javascript
// Entur Journey Planner GraphQL client
const ENTUR_ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql';
const ENTUR_CLIENT_NAME = 'isokronkart-personal';
```

`js/isochrone.js`:
```javascript
// Alpha shape computation and polygon intersection
```

`js/app.js`:
```javascript
// UI logic, map interaction, Beregn flow
```

- [ ] **Steg 5: Commit**

```bash
git add index.html css/ js/ .gitignore
git commit -m "feat: project scaffold"
```

---

## Task 2: Google Maps — kart og klikk-interaksjon

**Files:**
- Modify: `js/app.js`

- [ ] **Steg 1: Åpne index.html i nettleseren og verifiser at siden laster uten JS-feil**

Åpne `index.html` direkte i Chrome. Konsollen skal vise én feil: `initMap is not a function` (eller Google Maps-relatert) — det er forventet til vi implementerer den.

- [ ] **Steg 2: Implementer initMap og punkt-klikk i js/app.js**

```javascript
const POINT_COLORS = ['#1a73e8', '#e8710a', '#34a853'];
const DEFAULT_MINUTES = 30;
const MAX_POINTS = 3;

let map;
let points = []; // [{ lat, lng, minutes, marker, polygon, color, label }]
let pickingPointIndex = null;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 12,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
  });

  map.addListener('click', onMapClick);
  setupPanel();
  setDefaultDepartureTime();
}

function onMapClick(e) {
  if (pickingPointIndex === null) return;
  const lat = e.latLng.lat();
  const lng = e.latLng.lng();
  setPointCoords(pickingPointIndex, lat, lng);
  pickingPointIndex = null;
  document.body.style.cursor = '';
}

function setPointCoords(index, lat, lng) {
  const pt = points[index];
  pt.lat = lat;
  pt.lng = lng;
  pt.label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  if (pt.marker) pt.marker.setMap(null);
  pt.marker = new google.maps.Marker({
    position: { lat, lng },
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: pt.color,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
    },
  });

  renderPanel();
}

function setDefaultDepartureTime() {
  const input = document.getElementById('departure-time');
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(8, 0, 0, 0);
  // datetime-local format: YYYY-MM-DDTHH:MM
  const pad = n => String(n).padStart(2, '0');
  input.value = `${nextMonday.getFullYear()}-${pad(nextMonday.getMonth()+1)}-${pad(nextMonday.getDate())}T08:00`;
}

function setupPanel() {
  addPoint(); // start with one point
  document.getElementById('add-point-btn').addEventListener('click', addPoint);
  document.getElementById('beregn-btn').addEventListener('click', onBeregn);
}

function addPoint() {
  if (points.length >= MAX_POINTS) return;
  const index = points.length;
  points.push({
    lat: null, lng: null,
    minutes: DEFAULT_MINUTES,
    marker: null,
    polygon: null,
    intersectionPolygon: null,
    color: POINT_COLORS[index],
    label: 'Klikk på kartet...',
  });
  renderPanel();
  startPicking(index);
}

function startPicking(index) {
  pickingPointIndex = index;
  document.body.style.cursor = 'crosshair';
}

function renderPanel() {
  const container = document.getElementById('points-container');
  container.innerHTML = '';
  points.forEach((pt, i) => {
    const row = document.createElement('div');
    row.className = 'point-row';
    row.innerHTML = `
      <span class="point-dot" style="background:${pt.color}"></span>
      <span class="point-label" title="${pt.label}">${pt.label}</span>
      <input class="point-minutes" type="number" min="5" max="120" value="${pt.minutes}"
             data-index="${i}" />
      <button class="remove-btn" data-index="${i}" title="Fjern punkt">×</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.point-minutes').forEach(input => {
    input.addEventListener('change', e => {
      points[+e.target.dataset.index].minutes = +e.target.value;
    });
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', e => removePoint(+e.target.dataset.index));
  });

  const addBtn = document.getElementById('add-point-btn');
  addBtn.disabled = points.length >= MAX_POINTS;
}

function removePoint(index) {
  const pt = points[index];
  if (pt.marker) pt.marker.setMap(null);
  if (pt.polygon) pt.polygon.setMap(null);
  if (pt.intersectionPolygon) pt.intersectionPolygon.setMap(null);
  points.splice(index, 1);
  // reassign colors
  points.forEach((p, i) => { p.color = POINT_COLORS[i]; });
  renderPanel();
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-msg').classList.add('hidden');
}

function showProgress(text) {
  const el = document.getElementById('progress');
  el.classList.remove('hidden');
  document.getElementById('progress-text').textContent = text;
}

function hideProgress() {
  document.getElementById('progress').classList.add('hidden');
}
```

- [ ] **Steg 3: Test manuelt i nettleseren**

1. Erstatt `YOUR_GOOGLE_MAPS_API_KEY` i `index.html` med din nøkkel fra Google Cloud
2. Åpne `index.html` i Chrome
3. Kartet skal vise Oslo
4. Klikk på kartet — en blå markør skal dukke opp og koordinatene vises i panelet

- [ ] **Steg 4: Commit**

```bash
git add js/app.js
git commit -m "feat: google maps init and click-to-pin"
```

---

## Task 3: Entur — hent stopp og reisetider

**Files:**
- Modify: `js/entur.js`

- [ ] **Steg 1: Implementer stopsByRadius**

```javascript
const ENTUR_ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql';
const ENTUR_CLIENT_NAME = 'isokronkart-personal';

async function graphql(query) {
  const resp = await fetch(ENTUR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ET-Client-Name': ENTUR_CLIENT_NAME,
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`Entur HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function fetchStopsNearby(lat, lng, radiusMeters = 15000, maxStops = 80) {
  const query = `{
    stopsByRadius(latitude: ${lat}, longitude: ${lng}, radius: ${radiusMeters}, first: ${maxStops}) {
      edges {
        node {
          place {
            ... on StopPlace {
              id
              name
              latitude
              longitude
            }
          }
          distance
        }
      }
    }
  }`;
  const data = await graphql(query);
  return data.stopsByRadius.edges
    .map(e => e.node.place)
    .filter(p => p && p.latitude && p.longitude);
}
```

- [ ] **Steg 2: Test fetchStopsNearby i nettleserkonsollen**

Åpne DevTools → Console, lim inn:
```javascript
fetchStopsNearby(59.929, 10.716).then(stops => {
  console.log('Antall stopp:', stops.length);
  console.log('Første stopp:', stops[0]);
});
```
Forventet output: `Antall stopp: 80`, med `{ id: "NSR:StopPlace:...", name: "...", latitude: ..., longitude: ... }`

- [ ] **Steg 3: Implementer fetchTripDuration og batchFetchDurations**

Legg til etter `fetchStopsNearby` i `js/entur.js`:

```javascript
async function fetchTripDuration(fromLat, fromLng, toStopId, dateTimeISO) {
  const query = `{
    trip(
      from: { coordinates: { latitude: ${fromLat}, longitude: ${fromLng} } }
      to: { place: "${toStopId}" }
      dateTime: "${dateTimeISO}"
      numTripPatterns: 1
    ) {
      tripPatterns {
        duration
      }
    }
  }`;
  try {
    const data = await graphql(query);
    const patterns = data.trip.tripPatterns;
    if (!patterns || patterns.length === 0) return null;
    return patterns[0].duration; // sekunder
  } catch {
    return null;
  }
}

async function batchFetchDurations(stops, fromLat, fromLng, dateTimeISO, onProgress) {
  const CONCURRENCY = 10;
  const results = new Array(stops.length).fill(null);

  for (let i = 0; i < stops.length; i += CONCURRENCY) {
    const batch = stops.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(stop => fetchTripDuration(fromLat, fromLng, stop.id, dateTimeISO))
    );
    batchResults.forEach((dur, j) => { results[i + j] = dur; });
    onProgress(Math.min(i + CONCURRENCY, stops.length), stops.length);
  }
  return results; // [sekunder | null] — samme rekkefølge som stops
}
```

- [ ] **Steg 4: Test batchFetchDurations i konsollen**

```javascript
fetchStopsNearby(59.929, 10.716, 5000, 5).then(async stops => {
  const durations = await batchFetchDurations(
    stops, 59.929, 10.716,
    '2026-06-16T08:00:00+02:00',
    (done, total) => console.log(`${done}/${total}`)
  );
  stops.forEach((s, i) => console.log(s.name, durations[i] ? `${Math.round(durations[i]/60)} min` : 'ikke nåbar'));
});
```

Forventet output: stopp-navn med reisetid i minutter.

- [ ] **Steg 5: Commit**

```bash
git add js/entur.js
git commit -m "feat: entur graphql client — stops and trip duration"
```

---

## Task 4: Isokronberegning — alpha shape

**Files:**
- Modify: `js/isochrone.js`

- [ ] **Steg 1: Implementer computeIsochrone**

```javascript
function computeIsochrone(stops, durations, maxMinutes) {
  const maxSeconds = maxMinutes * 60;
  const reachable = stops.filter((_, i) => durations[i] !== null && durations[i] <= maxSeconds);

  if (reachable.length < 3) return null;

  const points = turf.featureCollection(
    reachable.map(s => turf.point([s.longitude, s.latitude]))
  );

  const hull = turf.concave(points, { maxEdge: 2 }) || turf.convex(points);
  return hull; // GeoJSON Feature<Polygon> eller null
}
```

- [ ] **Steg 2: Implementer computeIntersection**

```javascript
function computeIntersection(polygon1, polygon2) {
  if (!polygon1 || !polygon2) return null;
  try {
    return turf.intersect(polygon1, polygon2);
  } catch {
    return null;
  }
}
```

- [ ] **Steg 3: Implementer geoJsonToGooglePath**

```javascript
function geoJsonToGooglePath(polygon) {
  // polygon er GeoJSON Feature<Polygon>
  const coords = polygon.geometry.coordinates[0]; // ytre ring
  return coords.map(([lng, lat]) => ({ lat, lng }));
}
```

- [ ] **Steg 4: Test computeIsochrone manuelt i konsollen**

```javascript
// Simuler 5 nåbare stopp rundt Majorstuen
const mockStops = [
  { id: 'a', latitude: 59.93, longitude: 10.72 },
  { id: 'b', latitude: 59.92, longitude: 10.70 },
  { id: 'c', latitude: 59.94, longitude: 10.70 },
  { id: 'd', latitude: 59.93, longitude: 10.74 },
  { id: 'e', latitude: 59.91, longitude: 10.72 },
];
const mockDurations = [600, 900, 1200, 1500, 2400]; // sekunder
const hull = computeIsochrone(mockStops, mockDurations, 30);
console.log('Hull type:', hull?.geometry?.type); // → 'Polygon'
console.log('Koordinater:', hull?.geometry?.coordinates[0].length); // ≥ 4
```

- [ ] **Steg 5: Commit**

```bash
git add js/isochrone.js
git commit -m "feat: alpha shape isochrone computation"
```

---

## Task 5: Wire Beregn-flyt — tegn polygon på kartet

**Files:**
- Modify: `js/app.js`

- [ ] **Steg 1: Implementer onBeregn**

Legg til i `js/app.js`:

```javascript
async function onBeregn() {
  hideError();

  const activePoints = points.filter(p => p.lat !== null);
  if (activePoints.length === 0) {
    showError('Klikk på kartet for å sette minst ett punkt.');
    return;
  }

  const departureInput = document.getElementById('departure-time').value;
  if (!departureInput) {
    showError('Sett en avgangstid.');
    return;
  }
  const dateTimeISO = new Date(departureInput).toISOString();

  document.getElementById('beregn-btn').disabled = true;
  clearPolygons();

  try {
    for (let i = 0; i < activePoints.length; i++) {
      const pt = activePoints[i];
      showProgress(`Punkt ${i + 1}/${activePoints.length}: henter stopp...`);

      let stops;
      try {
        stops = await fetchStopsNearby(pt.lat, pt.lng);
      } catch {
        showError('Entur er ikke tilgjengelig akkurat nå.');
        return;
      }

      if (stops.length === 0) {
        showError('Ingen kollektivstopp funnet i dette området.');
        return;
      }

      showProgress(`Punkt ${i + 1}: beregner reisetider 0/${stops.length}...`);
      const durations = await batchFetchDurations(
        stops, pt.lat, pt.lng, dateTimeISO,
        (done, total) => showProgress(`Punkt ${i + 1}: beregner reisetider ${done}/${total}...`)
      );

      const polygon = computeIsochrone(stops, durations, pt.minutes);
      if (!polygon) {
        showError(`For få nåbare stopp for punkt ${i + 1}. Prøv en lengre reisetid.`);
        continue;
      }

      pt.polygon = new google.maps.Polygon({
        paths: geoJsonToGooglePath(polygon),
        strokeColor: pt.color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: pt.color,
        fillOpacity: 0.15,
        map,
      });
      pt._geoPolygon = polygon;
    }

    drawIntersections(activePoints);
  } finally {
    hideProgress();
    document.getElementById('beregn-btn').disabled = false;
  }
}

function clearPolygons() {
  points.forEach(pt => {
    if (pt.polygon) { pt.polygon.setMap(null); pt.polygon = null; }
    if (pt.intersectionPolygon) { pt.intersectionPolygon.setMap(null); pt.intersectionPolygon = null; }
    pt._geoPolygon = null;
  });
}

function drawIntersections(activePoints) {
  for (let i = 0; i < activePoints.length - 1; i++) {
    for (let j = i + 1; j < activePoints.length; j++) {
      const intersection = computeIntersection(
        activePoints[i]._geoPolygon,
        activePoints[j]._geoPolygon
      );
      if (!intersection) continue;
      activePoints[i].intersectionPolygon = new google.maps.Polygon({
        paths: geoJsonToGooglePath(intersection),
        strokeColor: '#34a853',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#34a853',
        fillOpacity: 0.35,
        map,
      });
    }
  }
}
```

- [ ] **Steg 2: Test end-to-end manuelt**

1. Åpne `index.html` i Chrome
2. Klikk på kartet nær Majorstuen
3. Sett minutter til 20
4. Klikk "Beregn"
5. Fremdrift skal vises: "Punkt 1: beregner reisetider 10/80..."
6. Etter ~15 sekunder skal en blå polygon vises rundt de nåbare stopp
7. Polygon skal ligne på den røde sirkelen fra originalbildet

- [ ] **Steg 3: Test med to punkter**

1. Klikk "+ Legg til punkt"
2. Klikk et annet sted på kartet
3. Klikk "Beregn"
4. To polygoner (blå + oransje) + grønn interseksjon skal vises

- [ ] **Steg 4: Commit**

```bash
git add js/app.js
git commit -m "feat: beregn flow — fetch stops, compute isochrone, draw polygons"
```

---

## Task 6: GitHub Pages — deploy

**Files:**
- Modify: `index.html` (API-nøkkel-restriksjon)
- Create: `README.md` (valgfritt)

- [ ] **Steg 1: Begrens Google Maps API-nøkkel**

I Google Cloud Console → "My First Project" → APIs & Services → Credentials:
- Finn din Maps JS API-nøkkel
- Under "Application restrictions": velg "HTTP referrers"
- Legg til: `https://<ditt-github-brukernavn>.github.io/*`
- Lagre

- [ ] **Steg 2: Sett branch til main**

```bash
git branch -m master main
```

- [ ] **Steg 3: Opprett repo på GitHub og push**

```bash
git remote add origin https://github.com/Rickymoe/isokronkart.git
git push -u origin main
```

- [ ] **Steg 4: Aktiver GitHub Pages**

I repo-innstillingene på GitHub:
- Settings → Pages
- Source: "Deploy from a branch"
- Branch: `main`, folder: `/ (root)`
- Lagre

Appen er live på `https://rickymoe.github.io/isokronkart/` etter ~1 minutt.

- [ ] **Steg 5: Test live**

Åpne URL-en, sett et punkt, klikk Beregn. Verifiser at polygon vises korrekt.

---

## Spec-dekning

| Krav | Task |
|------|------|
| Web-app i nettleseren | Task 1 |
| Google Maps | Task 2 |
| Flytende panel | Task 1 (CSS) |
| Klikk-til-pin | Task 2 |
| Entur stopsByRadius | Task 3 |
| Entur trip-duration | Task 3 |
| Alpha shape (concave hull) | Task 4 |
| Fallback til convex hull | Task 4 |
| Beregn-flyt med fremdrift | Task 5 |
| Flervisning / overlapp | Task 5 |
| Grønn interseksjon | Task 5 |
| Avgangstid default mandag 08:00 | Task 2 |
| GitHub Pages | Task 6 |
| API-nøkkel begrenset til domene | Task 6 |
