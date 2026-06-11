let busStopMarkers = [];
let busStopsVisible = false;

async function loadBusStops() {
  try {
    const resp = await fetch('js/oslo-bus-stops.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    for (const f of geojson.features) {
      const [lng, lat] = f.geometry.coordinates;
      busStopMarkers.push(new google.maps.Marker({
        position: { lat, lng },
        map: null,
        title: f.properties.name || undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#e53935',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1,
          scale: 5,
        },
        zIndex: 2,
      }));
    }
    if (busStopsVisible) busStopMarkers.forEach(m => m.setMap(map));
  } catch (err) {
    console.error('Kunne ikke laste bussholdeplasser:', err);
    document.getElementById('bus-stops-toggle-btn')?.remove();
  }
}

function setBusStopsVisible(visible) {
  busStopsVisible = visible;
  busStopMarkers.forEach(m => m.setMap(visible ? map : null));
  document.getElementById('bus-stops-toggle-btn')?.classList.toggle('active', visible);
}

function initBusStopsToggle() {
  const btn = document.createElement('button');
  btn.id = 'bus-stops-toggle-btn';
  btn.className = 'transit-btn';
  btn.innerHTML = '🚌 Buss';
  btn.title = 'Vis/skjul bussholdeplasser';
  btn.addEventListener('click', () => setBusStopsVisible(!busStopsVisible));
  document.body.appendChild(btn);
  loadBusStops();
}
