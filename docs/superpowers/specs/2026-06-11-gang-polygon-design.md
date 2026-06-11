# Design: Gang-polygon (walking isochrone)

**Dato:** 2026-06-11  
**Status:** Godkjent

## Oversikt

Legg til en 🚶-knapp per punkt i panelet. Klikk henter en gang-isokron fra Openrouteservice (ORS) og tegner en polygon som viser hvor langt brukeren kan gå fra det punktet innen samme antall minutter som er satt for transit-beregningen.

## Scope

- Én 🚶-knapp per punkt-rad i panelet
- Bruker samme `minutes`-verdi som transit-polygonen for det punktet
- ORS API, profil `foot-walking`
- GeoJSON caches per punkt — ingen re-kall ved toggle av/på
- Cache invalideres når punktets koordinater endres

## Nye/endrede filer

| Fil | Handling | Ansvar |
|---|---|---|
| `js/walking.js` | Opprett | ORS API-kall, toggle-logikk, polygon-tegning |
| `js/app.js` | Endre | 🚶-knapp i `renderPanel()`, rydding i `setPointCoords()`, `removePoint()`, `clearPolygons()` |
| `index.html` | Endre | `<script src="js/walking.js">` før `app.js` |
| `css/style.css` | Endre | `.walk-btn`-stiler (inaktiv, klar, aktiv, laster) |

## Per-punkt state

Følgende felter legges til hvert `points[]`-objekt (i tillegg til eksisterende):

```js
pt.walkVisible   // bool — om polygon er synlig nå
pt.walkGeoJSON   // cachet GeoJSON fra ORS (null = ikke hentet)
pt.walkPolygon   // google.maps.Polygon | null
```

## walking.js — API

```js
toggleWalkingPolygon(index)  // kalles fra renderPanel() i app.js
```

Internt:
- `fetchWalkingIsochrone(lat, lng, minutes)` — POST til ORS
- Tegner `google.maps.Polygon` med punkt-fargen (`pt.color`)

## ORS-integrasjon

```js
const ORS_API_KEY = 'din-nøkkel-her';

fetch('https://api.openrouteservice.org/v2/isochrones/foot-walking', {
  method: 'POST',
  headers: {
    'Authorization': ORS_API_KEY,
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
  },
  body: JSON.stringify({
    locations: [[lng, lat]],
    range: [minutes * 60],   // sekunder
    range_type: 'time',
  }),
})
```

Gratis tier: 500 req/dag, 40 req/min. Mer enn nok for personlig bruk.

## Toggle-flyt

```
toggleWalkingPolygon(index)
  ├── pt.walkVisible = true?
  │     └── skjul polygon, sett walkVisible = false, return
  └── pt.walkVisible = false
        ├── pt.walkGeoJSON finnes?
        │     └── tegn fra cache, vis
        └── ikke cachet
              ├── sett knapp til loading (⏳, disabled)
              ├── kall fetchWalkingIsochrone()
              ├── cache GeoJSON på pt.walkGeoJSON
              ├── tegn polygon
              └── gjenopprett knapp
```

## Polygon-stil

Bruker punktets egen farge (`pt.color`) men mer gjennomsiktig enn transit-polygonen:

```js
{
  strokeColor: pt.color,
  strokeOpacity: 0.6,
  strokeWeight: 2,
  fillColor: pt.color,
  fillOpacity: 0.08,
  map,
}
```

## UI — knapp-tilstander

```
● Storgata 5    [30]  min.  🚶  ×
```

| Tilstand | Utseende | Trigger |
|---|---|---|
| Inaktiv | `opacity: 0.3`, ikke klikbar | `pt.lat === null` |
| Klar | normal | punkt er satt |
| Aktiv | blå farge (`.active`) | polygon vises |
| Laster | `⏳`, disabled | venter på ORS-svar |

## Feilhåndtering

| Feil | Melding |
|---|---|
| HTTP 429 | `'Gang-API er overbelastet. Prøv igjen om litt.'` |
| Andre feil | `'Kunne ikke hente gangsone. Prøv igjen.'` |

Bruker eksisterende `showError()` i app.js.

## Rydding

| Hendelse | Handling |
|---|---|
| `setPointCoords()` | Nullstill `pt.walkGeoJSON`, fjern `pt.walkPolygon`, sett `pt.walkVisible = false` |
| `removePoint()` | Fjern `pt.walkPolygon` fra kart |
| `clearPolygons()` | Fjern alle `pt.walkPolygon` fra kart |

## Forutsetning

Brukeren må registrere seg gratis på openrouteservice.org og legge inn API-nøkkelen som `ORS_API_KEY` i `js/walking.js`.
