const LOYPE_LINE_COLOR = '#2e7d32';

let routePoints = [];
let routePolyline = null;
let routeMarkers = [];

function onLoypeRouteClick(e) {
  if (getMode() !== 'loype') return;
  addRoutePoint(e.latLng.lat(), e.latLng.lng());
}

function addRoutePoint(lat, lng) {
  const pt = { lat, lng };
  routePoints.push(pt);
  redrawRoutePolyline();
  redrawRouteMarkers();
  updateLoypeControls();
  updateDistanceAndChart();
  fetchAndStoreElevation(pt, routePoints.length - 1);
}

let myLocationMarker = null;

function useMyLocationForRoute() {
  if (!navigator.geolocation) {
    showLoypeError('Enheten din støtter ikke geolokasjon.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      showMyLocationMarker(pos.coords.latitude, pos.coords.longitude);
      map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      map.setZoom(16);
    },
    () => {
      showLoypeError('Fikk ikke tilgang til posisjonen din.');
    }
  );
}

function showMyLocationMarker(lat, lng) {
  if (myLocationMarker) myLocationMarker.map = null;
  const dot = document.createElement('div');
  dot.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#4285f4;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
  myLocationMarker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat, lng },
    map,
    content: dot,
  });
}

function redrawRoutePolyline() {
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }
  if (routePoints.length < 2) return;
  routePolyline = new google.maps.Polyline({
    path: routePoints,
    strokeColor: LOYPE_LINE_COLOR,
    strokeWeight: 3,
    strokeOpacity: 0.9,
    map,
  });
}

function redrawRouteMarkers() {
  routeMarkers.forEach(m => { m.map = null; });
  routeMarkers = routePoints.map(pt => {
    const dot = document.createElement('div');
    dot.style.cssText = `width:12px;height:12px;border-radius:50%;background:${LOYPE_LINE_COLOR};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
    return new google.maps.marker.AdvancedMarkerElement({
      position: pt,
      map,
      content: dot,
    });
  });
}

function undoLastRoutePoint() {
  routePoints.pop();
  routeElevations.pop();
  redrawRoutePolyline();
  redrawRouteMarkers();
  updateLoypeControls();
  updateDistanceAndChart();
}

function clearRoute() {
  routePoints = [];
  routeElevations = [];
  redrawRoutePolyline();
  redrawRouteMarkers();
  updateLoypeControls();
  updateDistanceAndChart();
}

function setLoypeMapVisible(visible) {
  if (routePolyline) routePolyline.setMap(visible ? map : null);
  routeMarkers.forEach(m => { m.map = visible ? map : null; });
  if (myLocationMarker) myLocationMarker.map = visible ? map : null;
}

function updateLoypeControls() {
  document.getElementById('loype-undo-btn').disabled = routePoints.length === 0;
  document.getElementById('loype-clear-btn').disabled = routePoints.length === 0;
}

function showLoypeError(msg) {
  const el = document.getElementById('loype-error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideLoypeError() {
  document.getElementById('loype-error-msg').classList.add('hidden');
}

async function fetchRouteElevation(points) {
  const resp = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })),
    }),
  });
  if (resp.status === 429) throw new Error('rate_limit');
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('Open-Elevation error', resp.status, body);
    throw new Error(`HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.results.map(r => r.elevation);
}

function renderElevationChart(elevations) {
  const svg = document.getElementById('loype-elevation-chart');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (elevations.length === 0) return;

  const width = 240, height = 90, pad = 4;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(max - min, 1);

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = `Høydeprofil: ${Math.round(min)}–${Math.round(max)} m`;
  svg.appendChild(title);

  const stepX = elevations.length > 1 ? (width - pad * 2) / (elevations.length - 1) : 0;
  const coords = elevations.map((e, i) => ({
    x: pad + i * stepX,
    y: pad + (1 - (e - min) / range) * (height - pad * 2),
    e,
  }));

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '));
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', LOYPE_LINE_COLOR);
  polyline.setAttribute('stroke-width', '2');
  svg.appendChild(polyline);

  function addElevationLabel(point, dy) {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(Math.min(Math.max(point.x, 14), width - 14)));
    label.setAttribute('y', String(Math.min(Math.max(point.y + dy, 10), height - 4)));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '9');
    label.setAttribute('fill', '#1a1a2e');
    label.textContent = `${Math.round(point.e)} m`;
    svg.appendChild(label);
  }

  const maxPoint = coords.reduce((a, b) => (b.e > a.e ? b : a));
  const minPoint = coords.reduce((a, b) => (b.e < a.e ? b : a));
  addElevationLabel(maxPoint, -6);
  if (minPoint.e !== maxPoint.e) {
    addElevationLabel(minPoint, 12);
  }
}

let routeElevations = [];

function updateDistanceAndChart() {
  if (routePoints.length < 2) {
    hideLoypeError();
    document.getElementById('loype-result').classList.add('hidden');
    return;
  }
  const mirror = document.getElementById('loype-mirror-checkbox').checked;

  const line = turf.lineString(routePoints.map(p => [p.lng, p.lat]));
  let km = turf.length(line, { units: 'kilometers' });
  if (mirror) km *= 2;

  document.getElementById('loype-distance-value').textContent = `${km.toFixed(2)} km`;
  document.getElementById('loype-result').classList.remove('hidden');

  let known = routeElevations.filter(e => e !== undefined);
  if (mirror && known.length > 0) {
    known = known.concat(known.slice(0, -1).reverse());
  }
  renderElevationChart(known);
}

async function fetchAndStoreElevation(pt, index) {
  try {
    const [elevation] = await fetchRouteElevation([pt]);
    if (routePoints[index] !== pt) return;
    routeElevations[index] = elevation;
    hideLoypeError();
    updateDistanceAndChart();
  } catch (err) {
    if (routePoints[index] !== pt) return;
    showLoypeError(err.message === 'rate_limit'
      ? 'Høyde-API er overbelastet. Prøv igjen om litt.'
      : `Kunne ikke hente høydedata (${err.message}). Prøv igjen.`);
  }
}

function initLoypePanel() {
  document.getElementById('loype-geolocate-btn').addEventListener('click', useMyLocationForRoute);
  document.getElementById('loype-undo-btn').addEventListener('click', undoLastRoutePoint);
  document.getElementById('loype-clear-btn').addEventListener('click', clearRoute);
  document.getElementById('loype-mirror-checkbox').addEventListener('change', updateDistanceAndChart);
  updateLoypeControls();
}

document.addEventListener('DOMContentLoaded', initLoypePanel);
