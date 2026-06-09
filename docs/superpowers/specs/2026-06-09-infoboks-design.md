# Design: Floating infoboks

**Dato:** 2026-06-09

## Formål

Ny bruker som åpner Reisevei forstår ikke umiddelbart hva de skal gjøre. En floating infoboks øverst til høyre forklarer arbeidsflyten steg for steg.

## Oppførsel

- Vises alltid ved sideinnlasting (ingen localStorage)
- Lukkes manuelt med × — legger til `.hidden`-klassen
- Kan ikke gjenåpnes (tilstrekkelig for denne appen)

## Plassering og stil

- `position: absolute; top: 16px; right: 16px; z-index: 10`
- Matcher eksisterende `#panel` nøyaktig: `rgba(255,255,255,0.95)`, `backdrop-filter: blur(8px)`, `border-radius: 12px`, `box-shadow: 0 2px 12px rgba(0,0,0,0.15)`
- Bredde: 240px

## Innhold

Tittel: **Slik bruker du Reisevei**

1. Klikk på kartet for å plassere ett eller flere punkt
2. Sett ønsket reisetid (min) per punkt
3. Velg avgangstid (valgfritt)
4. Trykk «Beregn» for å se hvilke områder du kan nå med kollektiv

## Endringer

| Fil | Endring |
|-----|---------|
| `index.html` | Ny `<div id="info-box">` med innhold og ×-knapp |
| `css/style.css` | `#info-box` layout + `.close-btn` stil |
| `js/app.js` | Én linje: close-btn onclick → `.hidden` |
