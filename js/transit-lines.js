let transitPolylines = [];
let transitVisible = false;

async function loadTransitLines() {
  try {
    const resp = await fetch('js/oslo-transit-lines.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    transitPolylines = geojson.features.map(f => {
      const path = f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      return new google.maps.Polyline({
        path,
        strokeColor: f.properties.color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map: null,
        zIndex: 1,
      });
    });
    if (transitVisible) transitPolylines.forEach(p => p.setMap(map));
  } catch (err) {
    console.error('Kunne ikke laste kollektivlinjer:', err);
    const btn = document.getElementById('transit-toggle-btn');
    if (btn) btn.remove();
  }
}

function setTransitVisible(visible) {
  transitVisible = visible;
  transitPolylines.forEach(p => p.setMap(visible ? map : null));
  const btn = document.getElementById('transit-toggle-btn');
  if (btn) btn.classList.toggle('active', visible);
}

function initTransitToggle() {
  const btn = document.createElement('button');
  btn.id = 'transit-toggle-btn';
  btn.innerHTML = '🚋 Vis trikk';
  btn.title = 'Vis/skjul trikk og T-banelinjer';
  btn.addEventListener('click', () => setTransitVisible(!transitVisible));
  document.body.appendChild(btn);
  loadTransitLines();
}
