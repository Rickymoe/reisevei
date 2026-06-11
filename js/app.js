const POINT_COLORS = ['#1a73e8', '#e8710a', '#34a853'];
const DEFAULT_MINUTES = 30;
const MAX_POINTS = 3;

const NORWAY_BOUNDS = { latMin: 57.5, latMax: 71.5, lngMin: 4.0, lngMax: 32.0 };

function isInNorway(lat, lng) {
  return lat >= NORWAY_BOUNDS.latMin && lat <= NORWAY_BOUNDS.latMax &&
         lng >= NORWAY_BOUNDS.lngMin && lng <= NORWAY_BOUNDS.lngMax;
}

let map;
let geocoder;
let points = []; // [{ lat, lng, minutes, marker, polygon, color, label }]
let pickingPointIndex = null;
let hoverMarker = null;
let intersectionPolygons = [];

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 12,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    mapId: 'DEMO_MAP_ID',
  });
  geocoder = new google.maps.Geocoder();

  map.addListener('click', onMapClick);
  setupPanel();
  setDefaultDepartureTime();
  initTransitToggle();
}

function onMapClick(e) {
  if (pickingPointIndex === null) return;
  const lat = e.latLng.lat();
  const lng = e.latLng.lng();
  if (!isInNorway(lat, lng)) {
    showError('Reisevei bruker Entur og støtter kun reiser i Norge. Klikk innenfor Norges grenser.');
    return;
  }
  hideError();
  setPointCoords(pickingPointIndex, lat, lng);
  pickingPointIndex = null;
  document.getElementById('map').classList.remove('picking-mode');
}

function setPointCoords(index, lat, lng) {
  const pt = points[index];
  pt.lat = lat;
  pt.lng = lng;
  if (pt.walkPolygon) { pt.walkPolygon.setMap(null); pt.walkPolygon = null; }
  pt.walkGeoJSON = null;
  pt.walkVisible = false;
  pt.label = 'Henter adresse...';

  if (pt.marker) pt.marker.map = null;
  const dot = document.createElement('div');
  dot.style.cssText = `width:16px;height:16px;border-radius:50%;background:${pt.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
  pt.marker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat, lng },
    map,
    content: dot,
  });

  renderPanel();

  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const components = results[0].address_components;
      const route = components.find(c => c.types.includes('route'));
      const number = components.find(c => c.types.includes('street_number'));
      pt.label = route
        ? (number ? `${route.long_name} ${number.long_name}` : route.long_name)
        : results[0].formatted_address.split(',')[0];
    } else {
      pt.label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    renderPanel();
  });
}

function setDefaultDepartureTime() {
  const input = document.getElementById('departure-time');
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(8, 0, 0, 0);
  // datetime-local format: YYYY-MM-DDTHH:MM
  const pad = n => String(n).padStart(2, '0');
  input.value = `${nextMonday.getFullYear()}-${pad(nextMonday.getMonth()+1)}-${pad(nextMonday.getDate())}T08:00`;
}

function setupPanel() {
  addPoint(); // start with one point
  document.getElementById('beregn-btn').addEventListener('click', onBeregn);
  document.getElementById('result-btn').addEventListener('click', () => {
    document.getElementById('result-panel').classList.remove('hidden');
  });
  document.querySelector('#result-panel .close-btn').addEventListener('click', () => {
    document.getElementById('result-panel').classList.add('hidden');
  });
  document.getElementById('info-btn').addEventListener('click', () => {
    document.getElementById('info-panel').classList.toggle('hidden');
  });
  document.querySelector('#info-panel .close-btn').addEventListener('click', () => {
    document.getElementById('info-panel').classList.add('hidden');
  });
}

function addPoint() {
  if (points.length >= MAX_POINTS) return;
  const index = points.length;
  points.push({
    lat: null, lng: null,
    minutes: DEFAULT_MINUTES,
    marker: null,
    polygons: [],
    intersectionPolygon: null,
    color: POINT_COLORS[index],
    label: 'Klikk på kartet...',
    walkVisible: false,
    walkGeoJSON: null,
    walkPolygon: null,
  });
  document.getElementById('result-btn').classList.add('hidden');
  document.getElementById('result-panel').classList.add('hidden');
  renderPanel();
  startPicking(index);
}

function startPicking(index) {
  pickingPointIndex = index;
  document.getElementById('map').classList.add('picking-mode');
}


function renderPanel() {
  const container = document.getElementById('points-container');
  container.innerHTML = '';
  points.forEach((pt, i) => {
    const row = document.createElement('div');
    row.className = 'point-row';
    row.innerHTML = `
      <span class="point-dot" style="background:${pt.color}"></span>
      <span class="point-label" title="${pt.label}">${pt.label}</span>
      <input class="point-minutes" type="number" min="5" max="120" value="${pt.minutes}"
             data-index="${i}" />
      <span class="point-minutes-label">min.</span>
      <button class="walk-btn${pt.walkVisible ? ' active' : ''}" data-index="${i}"
              title="Vis/skjul gangsone"${pt.lat === null ? ' disabled' : ''}>🚶</button>
      <button class="remove-btn" data-index="${i}" title="Fjern punkt">×</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.point-minutes').forEach(input => {
    input.addEventListener('change', e => {
      const clamped = Math.min(120, Math.max(5, +e.target.value));
      e.target.value = clamped;
      points[+e.target.dataset.index].minutes = clamped;
    });
  });
  container.querySelectorAll('.walk-btn').forEach(btn => {
    btn.addEventListener('click', e => toggleWalkingPolygon(+e.target.dataset.index));
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', e => removePoint(+e.target.dataset.index));
  });

  const hasPoint = points.some(p => p.lat !== null);
  document.getElementById('beregn-btn').disabled = !hasPoint;
}

function removePoint(index) {
  const pt = points[index];
  if (pt.marker) pt.marker.map = null;
  (pt.polygons || []).forEach(p => p.setMap(null));
  if (pt.walkPolygon) { pt.walkPolygon.setMap(null); pt.walkPolygon = null; }
  intersectionPolygons.forEach(p => p.setMap(null));
  intersectionPolygons = [];
  points.splice(index, 1);
  points.forEach((p, i) => { p.color = POINT_COLORS[i]; });
  document.getElementById('result-btn').classList.add('hidden');
  document.getElementById('result-panel').classList.add('hidden');
  if (points.length === 0) { addPoint(); } else { renderPanel(); }
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error-msg').classList.add('hidden');
}

function showProgress(text) {
  const el = document.getElementById('progress');
  el.classList.remove('hidden');
  document.getElementById('progress-text').textContent = text;
}

function hideProgress() {
  document.getElementById('progress').classList.add('hidden');
}

async function onBeregn() {
  hideError();

  const activePoints = points.filter(p => p.lat !== null);
  if (activePoints.length === 0) {
    showError('Klikk på kartet for å sette minst ett punkt.');
    return;
  }

  const departureInput = document.getElementById('departure-time').value;
  if (!departureInput) {
    showError('Sett en avgangstid.');
    return;
  }
  const dateTimeISO = new Date(departureInput).toISOString();

  const beregnBtn = document.getElementById('beregn-btn');
  beregnBtn.disabled = true;
  beregnBtn.textContent = '⏳';
  document.getElementById('result-btn').classList.add('hidden');
  document.getElementById('result-panel').classList.add('hidden');
  clearPolygons();

  try {
    for (let i = 0; i < activePoints.length; i++) {
      const pt = activePoints[i];
      showProgress(`Punkt ${i + 1}/${activePoints.length}: henter stopp...`);

      const radius = dynamicRadius(pt.minutes);
      const maxStops = pt.minutes >= 45 ? 150 : 80;
      let stops;
      try {
        stops = await fetchStopsNearby(pt.lat, pt.lng, radius, maxStops);
      } catch {
        showError('Entur er ikke tilgjengelig akkurat nå.');
        return;
      }

      if (stops.length === 0) {
        showError('Finner ingen kollektivstopp i nærheten. Punktet kan ligge utenfor Entur-dekning (Norge).');
        return;
      }

      showProgress(`Punkt ${i + 1}: beregner reisetider 0/${stops.length}...`);
      const durations = await batchFetchDurations(
        stops, pt.lat, pt.lng, dateTimeISO,
        (done, total) => showProgress(`Punkt ${i + 1}: beregner reisetider ${done}/${total}...`)
      );

      pt.reachableStops = stops
        .map((s, j) => ({ name: s.name, id: s.id, lat: s.latitude, lng: s.longitude, duration: durations[j], mode: s.transportMode }))
        .filter(s => s.duration !== null && s.duration <= pt.minutes * 60)
        .sort((a, b) => a.duration - b.duration);

      const polygon = computeIsochrone(stops, durations, pt.minutes);
      if (!polygon) {
        showError(`Finner ikke reiseveier innen ${pt.minutes} min. Prøv med lengre reisetid.`);
        continue;
      }

      pt.polygons = geoJsonToGooglePaths(polygon).map(path => new google.maps.Polygon({
        paths: path,
        strokeColor: pt.color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: pt.color,
        fillOpacity: 0.15,
        map,
      }));
      pt._geoPolygon = polygon;
    }

    drawIntersections(activePoints);
    buildResultPanel(activePoints);
    document.getElementById('result-btn').classList.remove('hidden');
  } finally {
    hideProgress();
    const btn = document.getElementById('beregn-btn');
    btn.disabled = false;
    btn.textContent = 'Finn reiseveier';
  }
}

const TRANSPORT_ICONS = {
  bus: '🚌', rail: '🚆', tram: '🚋', metro: '🚇',
  water: '⛴', coach: '🚌', air: '✈',
};

function transportIcon(mode) {
  return TRANSPORT_ICONS[mode] || '🚏';
}

function buildResultPanel(activePoints) {
  const container = document.getElementById('result-content');
  container.innerHTML = '';
  activePoints.forEach(pt => {
    if (!pt.reachableStops || pt.reachableStops.length === 0) return;
    const section = document.createElement('div');
    section.className = 'result-section';
    const header = document.createElement('div');
    header.className = 'result-section-header';
    header.innerHTML = `<span class="point-dot" style="background:${pt.color}"></span>${pt.label}`;
    const list = document.createElement('div');
    list.className = 'result-list';
    pt.reachableStops.forEach(s => {
      const mins = Math.ceil(s.duration / 60);
      const url = `https://entur.no/reiselenke?startLabel=${encodeURIComponent(pt.label)}&startLat=${pt.lat}&startLon=${pt.lng}&stopLabel=${encodeURIComponent(s.name)}&stopLat=${s.lat}&stopLon=${s.lng}`;
      const row = document.createElement('a');
      row.className = 'result-row';
      row.href = url;
      row.target = '_blank';
      row.rel = 'noopener';
      row.innerHTML = `<span class="stop-name">${s.name}</span><span class="stop-duration">${mins} min</span>`;
      row.addEventListener('mouseenter', () => showHoverMarker(s.lat, s.lng));
      row.addEventListener('mouseleave', removeHoverMarker);
      list.appendChild(row);
    });
    section.appendChild(header);
    section.appendChild(list);
    container.appendChild(section);
  });
}

function showHoverMarker(lat, lng) {
  removeHoverMarker();
  hoverMarker = new google.maps.Marker({
    position: { lat, lng },
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#ff6b35',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
      scale: 9,
    },
    zIndex: 1000,
  });
}

function removeHoverMarker() {
  if (hoverMarker) { hoverMarker.setMap(null); hoverMarker = null; }
}

function clearPolygons() {
  removeHoverMarker();
  points.forEach(pt => {
    (pt.polygons || []).forEach(p => p.setMap(null));
    pt.polygons = [];
    pt._geoPolygon = null;
  });
  intersectionPolygons.forEach(p => p.setMap(null));
  intersectionPolygons = [];
  clearWalkingPolygons();
}

function drawIntersections(activePoints) {
  for (let i = 0; i < activePoints.length - 1; i++) {
    for (let j = i + 1; j < activePoints.length; j++) {
      const intersection = computeIntersection(
        activePoints[i]._geoPolygon,
        activePoints[j]._geoPolygon
      );
      if (!intersection) continue;
      geoJsonToGooglePaths(intersection).forEach(path => {
        intersectionPolygons.push(new google.maps.Polygon({
          paths: path,
          strokeColor: '#34a853',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#34a853',
          fillOpacity: 0.35,
          map,
        }));
      });
    }
  }
}
