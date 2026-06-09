# Design: «Se resultat»-panel

**Dato:** 2026-06-09

## Formål

Etter beregning kan brukeren åpne et panel som viser hvilke kollektivstopp som er nåbare fra hvert punkt, sortert etter reisetid.

## Oppførsel

- «Se resultat»-knapp vises i Reisevei-panelet etter fullført beregning (hidden ellers)
- Klikk viser `#result-panel` under Reisevei-panelet og populerer innholdet
- × lukker panelet; knappen forblir synlig slik brukeren kan gjenåpne
- Ny beregning: skjuler knapp og panel til beregningen er ferdig

## Layout

`#panel` og `#result-panel` pakkes i `#left-column`:
- `position: absolute; top: 16px; left: 16px; z-index: 10`
- `display: flex; flex-direction: column; gap: 8px; width: 260px`

Resultatpanelet arver bredde fra wrapper. Ingen JS-posisjonering.

## Innhold

Per punkt:
- Farget prikk + adresselabel
- Liste over nåbare stopp sortert etter reisetid stigende
- Reisetid vises i minutter (avrundet opp)
- `max-height: 180px; overflow-y: auto` per seksjon

## Data

Lagres på hvert punkt-objekt i `onBeregn` etter at durations er hentet:

```js
pt.reachableStops = stops
  .map((s, i) => ({ name: s.name, duration: durations[i] }))
  .filter(s => s.duration !== null && s.duration <= pt.minutes * 60)
  .sort((a, b) => a.duration - b.duration);
```

## Stil

Matcher `#panel`: `rgba(255,255,255,0.95)`, `backdrop-filter: blur(8px)`, `border-radius: 12px`, `box-shadow: 0 2px 12px rgba(0,0,0,0.15)`

## Endringer

| Fil | Endring |
|-----|---------|
| `index.html` | `#left-column`-wrapper, `#result-panel` div, «Se resultat»-knapp i `#panel` |
| `css/style.css` | `#left-column`, `#result-panel`, `.result-section`, `.result-row` |
| `js/app.js` | lagre `reachableStops`, vis/skjul knapp og panel, bygg innhold |
