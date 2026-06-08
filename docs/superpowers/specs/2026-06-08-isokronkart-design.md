# Isokronkart — Designspesifikasjon

**Dato:** 2026-06-08  
**Status:** Godkjent av bruker

## Formål

En statisk web-app (GitHub Pages) der brukeren pinner ett eller flere punkter på et kart, setter en reisetid, og ser en farget polygon som viser alle steder reachable med kollektivtransport innen den tiden. Primær brukscase: boligjakt — finn nabolag der du kan bo og rekke jobb/skole innen X minutter.

## Arkitektur

Ren frontend — ingen backend. Hostes på GitHub Pages.

```
isokronkart/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── app.js        — kart-interaksjon, UI-logikk, punkt-håndtering
    ├── entur.js      — Entur GraphQL-klient, stopp-henting, reisetid
    └── isochrone.js  — alpha shape (Turf.js concave), interseksjon
```

**CDN-avhengigheter (ingen build-steg):**
- Google Maps JavaScript API (fra Google Cloud "My First Project")
- Turf.js — `turf.concave()` for alpha shape, `turf.intersect()` for overlapp
- Ingen andre dependencies

## Kartgrunnlag

Google Maps JavaScript API. API-nøkkel i `index.html`, begrenset til GitHub Pages-domenet i Cloud Console.

## Dataflyt — Isokronberegning

Trigges når brukeren klikker "Beregn":

1. **Hent stopp** — Entur GraphQL `stopsByRadius(lat, lon, radius=15000)` → maks 80 stopp med koordinater
2. **Beregn reisetider** — `Promise.all` med parallelle `trip`-kall til Entur for hvert stopp, fra senterpunktet, med brukerens avgangstid
3. **Filtrer** — behold stopp der `duration ≤ brukerens grense (minutter)`
4. **Alpha shape** — `turf.concave(filtrerteStoppSomPoints, { maxEdge: 3 })` → GeoJSON Polygon
5. **Fallback** — hvis concave feiler (< 3 stopp, eller punkter for spredt): bruk `turf.convex()`
6. **Tegn** — `google.maps.Polygon` med gjennomsiktig farge per punkt

## Flervisning og sammenligning

- Støtter inntil **3 punkter** (A, B, C) med unike farger (blå, oransje, grønn)
- Per punkt: egne koordinater, egen reisetidsgrense, egen farge
- Overlapp mellom to soner: `turf.intersect()` → fremhevet med mørkere farge
- Retning per punkt: brukeren setter senterpunktet (kan være jobb, skole, eller leilighet — app skiller ikke teknisk)

## UI — Flytende panel

Halvgjennomsiktig panel øverst til venstre over kartet (som Google Maps søkeboks).

**Panel-innhold:**
- Tittel: "Isokronkart"
- Per punkt (A/B/C): [koordinat-label fra Google Maps geocoder] + [slider/input for minutter] + [fargeprikk]
- "+ Legg til punkt"-knapp (opp til 3)
- Avgangstid: default `Mandag 08:00`, input type=datetime-local
- "Beregn"-knapp
- Fremdriftsindikator: "Beregner... 34/80 stopp" under beregning

## Avgangstid

Default: neste mandag kl. 08:00 (beregnes dynamisk ved sidelast). Bruker kan endre via datetime-input. Sendes som ISO 8601 til Entur `trip`-query.

## Feilhåndtering

| Scenario | Oppførsel |
|---|---|
| Entur API utilgjengelig | Feilmelding i panel: "Entur er ikke tilgjengelig akkurat nå" |
| Ingen stopp i radius | "Ingen kollektivstopp funnet i dette området" |
| For få stopp for alpha shape (< 3) | Fallback til convex hull, ingen feilmelding |
| Google Maps API-feil | Feilmelding i `<div>` over kart |
| Rate limiting fra Entur | Retry 1x med 1s delay, deretter feilmelding |

## Entur API

- **Endpoint:** `https://api.entur.io/journey-planner/v3/graphql`
- **Auth:** Ingen — offentlig API, men `ET-Client-Name`-header skal settes: `isokronkart-personal`
- **Stopp-query:** `stopsByRadius` (GraphQL)
- **Reise-query:** `trip` med `from` (koordinat), `to` (stopId), `dateTime`

## GitHub Pages-oppsett

- Repo: nytt public repo under Rickymoe
- Branch `main` → GitHub Pages
- Ingen build-steg, ingen workflow — bare push og det er live
- `.superpowers/` i `.gitignore`
