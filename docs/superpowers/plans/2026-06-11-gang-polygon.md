# Gang-polygon (Walking Isochrone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til en 🚶-knapp per punkt i panelet som henter en gang-isokron fra Openrouteservice og tegner den som en polygon ved siden av transit-polygonen.

**Architecture:** `js/walking.js` håndterer all ORS-kommunikasjon og polygon-tegning, eksponerer én funksjon (`toggleWalkingPolygon(index)`) som `app.js` kaller. GeoJSON caches per punkt for å unngå gjentatte API-kall. Walk-state (`walkVisible`, `walkGeoJSON`, `walkPolygon`) lagres på hvert punkt-objekt i `points[]`-arrayet.

**Tech Stack:** Vanilla JS, Openrouteservice Isochrone API v2 (`foot-walking`), Google Maps JavaScript API (`google.maps.Polygon`), eksisterende `points[]`-state i `app.js`.

---

## Filstruktur

| Fil | Handling | Ansvar |
|---|---|---|
| `js/walking.js` | Opprett | ORS API-kall, toggle-logikk, polygon-tegning |
| `js/app.js` | Endre | Walk-state i `addPoint()`, 🚶-knapp i `renderPanel()`, rydding i `setPointCoords()` / `removePoint()` / `clearPolygons()` |
| `index.html` | Endre | `<script src="js/walking.js">` før `app.js` |
| `css/style.css` | Endre | `.walk-btn`-stiler |

---

## Task 1: Skriv js/walking.js

**Files:**
- Create: `js/walking.js`

- [ ] **Steg 1: Opprett filen**

Opprett `js/walking.js` med følgende innhold:

```js
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE3YjA3MWQ1M2NhZTQ5NDNhMTg4Mjc4ODY3M2E1NTg3IiwiaCI6Im11cm11cjY0In0=';

async function fetchWalkingIsochrone(lat, lng, minutes) {
  const resp = await fetch(
    'https://api.openrouteservice.org/v2/isochrones/foot-walking',
    {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [minutes * 60],
        range_type: 'time',
      }),
    }
  );
  if (resp.status === 429) throw new Error('rate_limit');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.json();
}

function drawWalkingPolygon(pt) {
  const coords = pt.walkGeoJSON.features[0].geometry.coordinates[0];
  pt.walkPolygon = new google.maps.Polygon({
    paths: coords.map(([lng, lat]) => ({ lat, lng })),
    strokeColor: pt.color,
    strokeOpacity: 0.6,
    strokeWeight: 2,
    fillColor: pt.color,
    fillOpacity: 0.08,
    map,
    zIndex: 1,
  });
}

async function toggleWalkingPolygon(index) {
  const pt = points[index];

  if (pt.walkVisible) {
    pt.walkPolygon.setMap(null);
    pt.walkPolygon = null;
    pt.walkVisible = false;
    document.querySelector(`.walk-btn[data-index="${index}"]`)?.classList.remove('active');
    return;
  }

  if (pt.walkGeoJSON) {
    drawWalkingPolygon(pt);
    pt.walkVisible = true;
    document.querySelector(`.walk-btn[data-index="${index}"]`)?.classList.add('active');
    return;
  }

  const btn = document.querySelector(`.walk-btn[data-index="${index}"]`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    pt.walkGeoJSON = await fetchWalkingIsochrone(pt.lat, pt.lng, pt.minutes);
    drawWalkingPolygon(pt);
    pt.walkVisible = true;
    if (btn) btn.classList.add('active');
  } catch (err) {
    pt.walkGeoJSON = null;
    showError(err.message === 'rate_limit'
      ? 'Gang-API er overbelastet. Prøv igjen om litt.'
      : 'Kunne ikke hente gangsone. Prøv igjen.');
  } finally {
    if (btn) { btn.textContent = '🚶'; btn.disabled = false; }
  }
}

function clearWalkingPolygons() {
  points.forEach(pt => {
    if (pt.walkPolygon) { pt.walkPolygon.setMap(null); pt.walkPolygon = null; }
    pt.walkVisible = false;
  });
}
```

- [ ] **Steg 2: Commit**

```bash
git add js/walking.js
git commit -m "feat: add walking isochrone module (ORS API)"
```

---

## Task 2: Oppdater app.js

**Files:**
- Modify: `js/app.js`

- [ ] **Steg 1: Legg til walk-state i `addPoint()`**

Finn `points.push({` i `addPoint()` (linje ~113) og legg til tre felter:

```js
  points.push({
    lat: null, lng: null,
    minutes: DEFAULT_MINUTES,
    marker: null,
    polygons: [],
    intersectionPolygon: null,
    color: POINT_COLORS[index],
    label: 'Klikk på kartet...',
    walkVisible: false,
    walkGeoJSON: null,
    walkPolygon: null,
  });
```

- [ ] **Steg 2: Legg til 🚶-knapp i `renderPanel()`**

Finn `row.innerHTML = \`` i `renderPanel()` (linje ~140) og erstatt hele innerHTML-strengen:

```js
    row.innerHTML = `
      <span class="point-dot" style="background:${pt.color}"></span>
      <span class="point-label" title="${pt.label}">${pt.label}</span>
      <input class="point-minutes" type="number" min="5" max="120" value="${pt.minutes}"
             data-index="${i}" />
      <span class="point-minutes-label">min.</span>
      <button class="walk-btn${pt.walkVisible ? ' active' : ''}" data-index="${i}"
              title="Vis/skjul gangsone"${pt.lat === null ? ' disabled' : ''}>🚶</button>
      <button class="remove-btn" data-index="${i}" title="Fjern punkt">×</button>
    `;
```

- [ ] **Steg 3: Legg til event listener for walk-knappen i `renderPanel()`**

Finn `container.querySelectorAll('.remove-btn').forEach(btn => {` (linje ~158) og legg til rett etter event-listener-blokken for `.point-minutes`:

```js
  container.querySelectorAll('.walk-btn').forEach(btn => {
    btn.addEventListener('click', e => toggleWalkingPolygon(+e.target.dataset.index));
  });
```

- [ ] **Steg 4: Nullstill walk-state i `setPointCoords()`**

Finn `setPointCoords(index, lat, lng)` (linje ~49). Etter `pt.lng = lng;` og FØR `pt.label = 'Henter adresse...'`, legg til:

```js
  if (pt.walkPolygon) { pt.walkPolygon.setMap(null); pt.walkPolygon = null; }
  pt.walkGeoJSON = null;
  pt.walkVisible = false;
```

- [ ] **Steg 5: Rydd walk-polygon i `removePoint()`**

Finn `removePoint(index)` (linje ~166). Etter `(pt.polygons || []).forEach(p => p.setMap(null));` og FØR `points.splice(...)`, legg til:

```js
  if (pt.walkPolygon) { pt.walkPolygon.setMap(null); pt.walkPolygon = null; }
```

- [ ] **Steg 6: Rydd walk-polygoner i `clearPolygons()`**

Finn slutten av `clearPolygons()` (linje ~352), etter `intersectionPolygons = [];`, legg til ett kall:

```js
  clearWalkingPolygons();
```

- [ ] **Steg 7: Commit**

```bash
git add js/app.js
git commit -m "feat: add walk toggle button and walk-state management to app.js"
```

---

## Task 3: Koble inn HTML og CSS

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

- [ ] **Steg 1: Legg til script-tag i `index.html`**

Finn `<script src="js/transit-lines.js"></script>` og legg til én linje etter:

```html
  <script src="js/transit-lines.js"></script>
  <script src="js/walking.js"></script>
  <script src="js/app.js"></script>
```

- [ ] **Steg 2: Legg til CSS for `.walk-btn` i `css/style.css`**

Finn `.transit-btn {`-blokken (linje ~312) og legg til rett FØR den:

```css
.walk-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;
}
.walk-btn:disabled { opacity: 0.3; cursor: default; }
.walk-btn.active { color: #1a73e8; background: #e8f0fe; }
.walk-btn:hover:not(:disabled):not(.active) { background: #f5f5f5; }

```

- [ ] **Steg 3: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: wire walking.js into HTML and add walk-btn CSS"
```

---

## Task 4: Manuell verifisering og push

- [ ] **Steg 1: Start lokal server**

```bash
python3 -m http.server 8080 --directory /home/ricky/Dokumenter/Koding/reisevei
# Åpne http://localhost:8080
```

Google Maps vil vise en feilmelding (API-nøkkel er begrenset til github.io) — det er normalt. Sjekk konsollen for feil fra `walking.js`.

- [ ] **Steg 2: Test at knappen vises**

Forventet: 🚶-knapp vises i punkt-raden, grå og disabled til koordinater er satt.

- [ ] **Steg 3: Push til GitHub Pages og test live**

```bash
git push
```

Vent ~2 min, åpne `https://rickymoe.github.io/reisevei/`.

- [ ] **Steg 4: Sett ett punkt og test toggle**

1. Klikk på kartet ved Oslo S
2. Klikk 🚶 — knappen skal vise ⏳ mens ORS hentes
3. Polygon tegnes i samme farge som punkt-fargen (blå), men mer gjennomsiktig enn transit-polygonen
4. Klikk 🚶 igjen — polygon forsvinner, knapp tilbake til normal
5. Klikk 🚶 en tredje gang — polygon vises øyeblikkelig (fra cache, ingen ny API-kall)

- [ ] **Steg 5: Test rydding**

1. Klikk «Finn reiseveier» — transit-polygon beregnes, gang-polygon fjernes (clearPolygons)
2. Flytt punktet til ny posisjon — gang-polygon fjernes og cache invalideres
3. Fjern punktet med × — gang-polygon forsvinner
