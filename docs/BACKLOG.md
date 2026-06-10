# Reisevei – Backlog

## Bugs

- [ ] **Interseksjon feil med 3+ punkter** — Med punktene A, B, C lagres bare én interseksjon per punkt, så A&C kan overskrive A&B. Løsning: bruk et objekt/array keyed på punktpar (f.eks. `"A_B"`, `"A_C"`, `"B_C"`) i stedet for per enkelt punkt, og tegn alle delpolygoner.

## Features

_(ingen enda)_
