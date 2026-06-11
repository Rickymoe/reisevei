# Design: Busstopp-toggle

**Dato:** 2026-06-11  
**Status:** Godkjent

## Oversikt

Legg til en toggle-knapp som viser alle bussholdeplasser i Oslo-regionen som røde prikker på kartet. Følger samme arkitektur som eksisterende trikk/t-bane-toggle.

## Scope

- Geografisk: Oslo + Akershus (bounding box `59.5, 10.2, 60.2, 11.5`)
- Transportmodus: kun buss (`highway=bus_stop` og `stop_position+bus=yes`)
- Data: statisk GeoJSON, generert fra OSM via Overpass
- Zoom-håndtering: alle stopp vises alltid (ingen zoom-filtrering)

## Nye filer

| Fil | Formål |
|---|---|
| `scripts/generate-bus-stops.js` | Node.js-script som henter data fra Overpass og skriver GeoJSON til stdout |
| `js/oslo-bus-stops.json` | Statisk GeoJSON generert av scriptet (~2000–3000 stopp, ~300–500 KB) |
| `js/bus-stops.js` | Toggle-logikk: laster GeoJSON, oppretter markører, håndterer knapp |

## Endringer i eksisterende filer

| Fil | Endring |
|---|---|
| `index.html` | `<script src="js/bus-stops.js">` + kall `initBusStopsToggle()` i `initMap()` |
| `css/style.css` | `#bus-stops-toggle-btn { bottom: 140px; }` |

## Dataformat (GeoJSON)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [10.7522, 59.9139] },
      "properties": { "name": "Jernbanetorget" }
    }
  ]
}
```

## Overpass-spørring

```
[out:json][timeout:60];
(
  node["highway"="bus_stop"](59.5,10.2,60.2,11.5);
  node["public_transport"="stop_position"]["bus"="yes"](59.5,10.2,60.2,11.5);
);
out body;
```

Regenerer data: `node scripts/generate-bus-stops.js > js/oslo-bus-stops.json`

## bus-stops.js — API

```js
initBusStopsToggle()   // kalles fra initMap() i app.js
```

Internt:
- `loadBusStops()` — fetcher GeoJSON, bygger `google.maps.Marker[]` med `map: null`
- `setBusStopsVisible(visible)` — setter alle markører on/off, toggler `.active` på knapp

## Markør-stil

```js
icon: {
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: '#e53935',
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 1,
  scale: 5,
}
```

Bruker `google.maps.Marker` (ikke `AdvancedMarkerElement`) for ytelse ved 1000+ objekter.

## UI — knapp-plassering

```
bottom: 140px  →  🚌 Buss        (ny)
bottom:  90px  →  🚋 Trikk
bottom:  40px  →  🚇 T-bane
```

Bruker eksisterende `.transit-btn`-klasse. Aktiv-tilstand: blå bakgrunn (`.active`), identisk med trikk/t-bane.

## Feilhåndtering

Hvis `oslo-bus-stops.json` ikke kan lastes: logg feil til konsoll og fjern knappen fra DOM. Samme mønster som `loadTransitLines()`.
