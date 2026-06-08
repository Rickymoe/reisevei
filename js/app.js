const POINT_COLORS = ['#1a73e8', '#e8710a', '#34a853'];
const DEFAULT_MINUTES = 30;
const MAX_POINTS = 3;

let map;
let points = []; // [{ lat, lng, minutes, marker, polygon, color, label }]
let pickingPointIndex = null;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 12,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
  });

  map.addListener('click', onMapClick);
  setupPanel();
  setDefaultDepartureTime();
}

function onMapClick(e) {
  if (pickingPointIndex === null) return;
  const lat = e.latLng.lat();
  const lng = e.latLng.lng();
  setPointCoords(pickingPointIndex, lat, lng);
  pickingPointIndex = null;
  document.body.style.cursor = '';
}

function setPointCoords(index, lat, lng) {
  const pt = points[index];
  pt.lat = lat;
  pt.lng = lng;
  pt.label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  if (pt.marker) pt.marker.setMap(null);
  pt.marker = new google.maps.Marker({
    position: { lat, lng },
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: pt.color,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
    },
  });

  renderPanel();
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
  document.getElementById('add-point-btn').addEventListener('click', addPoint);
  document.getElementById('beregn-btn').addEventListener('click', onBeregn);
}

function addPoint() {
  if (points.length >= MAX_POINTS) return;
  const index = points.length;
  points.push({
    lat: null, lng: null,
    minutes: DEFAULT_MINUTES,
    marker: null,
    polygon: null,
    intersectionPolygon: null,
    color: POINT_COLORS[index],
    label: 'Klikk på kartet...',
  });
  renderPanel();
  startPicking(index);
}

function startPicking(index) {
  pickingPointIndex = index;
  document.body.style.cursor = 'crosshair';
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
      <button class="remove-btn" data-index="${i}" title="Fjern punkt">×</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.point-minutes').forEach(input => {
    input.addEventListener('change', e => {
      points[+e.target.dataset.index].minutes = +e.target.value;
    });
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', e => removePoint(+e.target.dataset.index));
  });

  const addBtn = document.getElementById('add-point-btn');
  addBtn.disabled = points.length >= MAX_POINTS;
}

function removePoint(index) {
  const pt = points[index];
  if (pt.marker) pt.marker.setMap(null);
  if (pt.polygon) pt.polygon.setMap(null);
  if (pt.intersectionPolygon) pt.intersectionPolygon.setMap(null);
  points.splice(index, 1);
  // reassign colors
  points.forEach((p, i) => { p.color = POINT_COLORS[i]; });
  renderPanel();
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
