let busStopsLoaded = false;
let busStopsVisible = false;

function busStopStyle() {
  return {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#e53935',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 1,
      scale: 5,
    },
    zIndex: 2,
  };
}

async function loadBusStops() {
  try {
    const resp = await fetch('js/oslo-bus-stops.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    map.data.addGeoJson(geojson);
    map.data.setStyle(busStopsVisible ? busStopStyle() : { visible: false });
    busStopsLoaded = true;
  } catch (err) {
    console.error('Kunne ikke laste bussholdeplasser:', err);
    document.getElementById('bus-stops-toggle-btn')?.remove();
  }
}

function setBusStopsVisible(visible) {
  busStopsVisible = visible;
  if (busStopsLoaded) {
    map.data.setStyle(visible ? busStopStyle() : { visible: false });
  }
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
