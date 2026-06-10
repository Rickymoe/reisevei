# Design: Kollektivlinjer på kartet

**Dato:** 2026-06-10  
**Status:** Godkjent

## Sammendrag

Legg til trikk- og T-banelinjer (Oslo) som valgfri overlay på kartet, toggled via en flytende knapp nederst til høyre.

## Omfang

- **Linjer:** Oslo trikk (12, 13, 15, 17, 18, 19) + T-bane (1, 2, 3, 4, 5)
- **Ikke inkludert:** Buss, båt, linjer utenfor Oslo
- **Utvidelse til andre byer:** Utenfor scope for nå

## Datakilde

Statisk GeoJSON-fil `js/oslo-transit-lines.json` generert én gang fra OpenStreetMap via Overpass API. Filen committes til repoet og oppdateres manuelt ved større ruteendringer (Ruter endrer traséer sjeldent).

### GeoJSON-struktur

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "line": "12",
        "type": "tram",
        "name": "Trikk 12",
        "color": "#E8000D"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], ...]
      }
    }
  ]
}
```

### Farger per linje

| Linje | Type | Farge |
|-------|------|-------|
| 12 | Trikk | `#E8000D` |
| 13 | Trikk | `#FF6600` |
| 15 | Trikk | `#9B1FA0` |
| 17 | Trikk | `#CC0066` |
| 18 | Trikk | `#E87722` |
| 19 | Trikk | `#A3195B` |
| T1 | T-bane | `#E8000D` |
| T2 | T-bane | `#003399` |
| T3 | T-bane | `#009933` |
| T4 | T-bane | `#9B1FA0` |
| T5 | T-bane | `#FF6600` |

(Farger basert på offisielle Ruter-farger der tilgjengelig, ellers distinkte farger.)

## UI

### Flytende toggle-knapp

- Plassering: `position: absolute`, nederst til høyre på kartet (`bottom: 40px; right: 10px`)
- Av-tilstand: hvit bakgrunn, grå kant — `🚋 Linjer`
- På-tilstand: blå bakgrunn (`#1a73e8`), hvit tekst — `🚋 Linjer`
- Klikk toggler linjer av/på og oppdaterer knappens utseende

### Standard

Linjer er **av** ved oppstart. Brukeren velger selv å slå dem på.

## Implementasjon

### Ny fil: `js/transit-lines.js`

Ansvar: laste GeoJSON, opprette `google.maps.Polyline`-objekter, eksponere `toggleTransitLines()`.

```
loadTransitLines()     — fetch + parse GeoJSON, bygg Polyline-objekter (usynlige)
toggleTransitLines()   — vis/skjul alle linjer, oppdater knapp-tilstand
initTransitToggle()    — opprett flytende knapp, bind click-handler
```

### Endringer i `index.html`

- `<script src="js/transit-lines.js"></script>` etter øvrige scripts
- `initTransitToggle()` kalles fra `initMap()` i `app.js`

### Ingen endringer i `entur.js` eller `isochrone.js`

### GeoJSON-generering

Kjør Overpass-spørring mot `overpass-api.de` for Oslo trikk og T-bane, prosesser til GeoJSON-format med linje-metadata, lagre som `js/oslo-transit-lines.json`.

## Feilhåndtering

- Hvis GeoJSON-filen ikke lastes (nettverk, 404): logg feil i konsollen, toggle-knapp vises ikke
- Linjer som mangler koordinater i OSM: hoppes over stille

## Avgrensninger

- Linjene er statiske — de oppdateres ikke automatisk ved ruteendringer
- Geometrien følger OSM-data, som kan ha små avvik fra faktiske traséer
- Kun LineString-geometri støttes (ikke MultiLineString i første versjon)
