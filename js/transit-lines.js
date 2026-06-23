const transitPolylinesByType = { tram: [], subway: [] };
const transitVisible = { tram: false, subway: false };

async function loadTransitLines() {
  try {
    const resp = await fetch('js/oslo-transit-lines.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    for (const f of geojson.features) {
      const routeType = f.properties.type;
      if (!transitPolylinesByType[routeType]) continue;
      const path = f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      transitPolylinesByType[routeType].push(new google.maps.Polyline({
        path,
        strokeColor: f.properties.color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map: null,
        zIndex: 1,
      }));
    }
    for (const type of ['tram', 'subway']) {
      if (transitVisible[type]) transitPolylinesByType[type].forEach(p => p.setMap(map));
    }
  } catch (err) {
    console.error('Kunne ikke laste kollektivlinjer:', err);
    document.getElementById('tram-toggle-btn')?.remove();
    document.getElementById('subway-toggle-btn')?.remove();
  }
}

function setTypeVisible(type, visible) {
  transitVisible[type] = visible;
  transitPolylinesByType[type].forEach(p => p.setMap(visible ? map : null));
  const btnId = type === 'tram' ? 'tram-toggle-btn' : 'subway-toggle-btn';
  document.getElementById(btnId)?.classList.toggle('active', visible);
}

function initTransitToggle() {
  const tramBtn = document.createElement('button');
  tramBtn.id = 'tram-toggle-btn';
  tramBtn.className = 'transit-btn';
  tramBtn.innerHTML = '🚋 Trikk';
  tramBtn.title = 'Vis/skjul trikkelinjer';
  tramBtn.addEventListener('click', () => setTypeVisible('tram', !transitVisible.tram));
  document.body.appendChild(tramBtn);

  const subwayBtn = document.createElement('button');
  subwayBtn.id = 'subway-toggle-btn';
  subwayBtn.className = 'transit-btn';
  subwayBtn.innerHTML = '🚇 T-bane';
  subwayBtn.title = 'Vis/skjul T-banelinjer';
  subwayBtn.addEventListener('click', () => setTypeVisible('subway', !transitVisible.subway));
  document.body.appendChild(subwayBtn);

  // Planet button — opens globe as fullscreen overlay
  const PLANET_URL = 'https://rickymoe.github.io/globus/';
  const planetBtn = document.createElement('button');
  planetBtn.id = 'planet-toggle-btn';
  planetBtn.className = 'transit-btn';
  planetBtn.innerHTML = '🌍 Planet';
  planetBtn.title = 'Åpne Planet Simulator';
  planetBtn.addEventListener('click', () => openPlanet(PLANET_URL));
  document.body.appendChild(planetBtn);

  loadTransitLines();
}

function openPlanet(url) {
  const overlay = document.createElement('div');
  overlay.id = 'planet-overlay';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'planet-close-btn';
  closeBtn.innerHTML = '✕';
  closeBtn.title = 'Lukk Planet (Escape)';
  closeBtn.addEventListener('click', () => overlay.remove());

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.allowFullscreen = true;

  overlay.appendChild(closeBtn);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  const onKey = (e) => { if (e.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', onKey); } };
  window.addEventListener('keydown', onKey);
}
