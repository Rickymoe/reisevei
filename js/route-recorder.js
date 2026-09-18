const LOYPE_LINE_COLOR = '#2e7d32';

let routePoints = [];
let routePolyline = null;

function onLoypeRouteClick(e) {
  if (getMode() !== 'loype') return;
  routePoints.push({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  redrawRoutePolyline();
  updateLoypeControls();
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

function undoLastRoutePoint() {
  routePoints.pop();
  redrawRoutePolyline();
  updateLoypeControls();
}

function clearRoute() {
  routePoints = [];
  redrawRoutePolyline();
  updateLoypeControls();
  hideLoypeError();
  document.getElementById('loype-result').classList.add('hidden');
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

function initLoypePanel() {
  document.getElementById('loype-undo-btn').addEventListener('click', undoLastRoutePoint);
  document.getElementById('loype-clear-btn').addEventListener('click', clearRoute);
  updateLoypeControls();
}

document.addEventListener('DOMContentLoaded', initLoypePanel);
