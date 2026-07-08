// maxSize raised well above the national vehicle count (~3000 as of 2026-07):
// the endpoint silently caps at 1000 activities by default and reports
// MoreData:true instead of erroring, so an unset maxSize can make buses
// vanish for zones outside whatever slice happened to come back.
const ENTUR_VM_ENDPOINT = 'https://api.entur.io/realtime/v1/rest/vm?maxSize=10000';
const LIVE_BUSES_POLL_MS = 20000;

let liveBusesActive = false;
let liveBusesPollTimer = null;
let liveBusMarkers = new Map(); // vehicleId -> google.maps.Marker
let lastFetchedBuses = [];
let lastFetchFailed = false;

function hasVisibleTransitZone() {
  return points.some(p => p.transitCalculated && p.transitVisible);
}

async function fetchLiveBuses() {
  const resp = await fetch(ENTUR_VM_ENDPOINT, {
    headers: {
      'Accept': 'application/json',
      'ET-Client-Name': ENTUR_CLIENT_NAME,
    },
  });
  if (!resp.ok) throw new Error(`Entur VM HTTP ${resp.status}`);
  const json = await resp.json();
  const deliveries = json.Siri?.ServiceDelivery?.VehicleMonitoringDelivery;
  const activities = deliveries?.[0]?.VehicleActivity || [];

  const buses = [];
  for (const activity of activities) {
    const mvj = activity.MonitoredVehicleJourney;
    if (!mvj || !mvj.VehicleMode || !mvj.VehicleMode.includes('bus')) continue;
    const loc = mvj.VehicleLocation;
    const vehicleRef = mvj.VehicleRef?.value;
    if (!loc || vehicleRef === undefined) continue;
    buses.push({
      id: vehicleRef,
      lat: loc.Latitude,
      lng: loc.Longitude,
      bearing: typeof mvj.Bearing === 'number' ? mvj.Bearing : 0,
      line: mvj.PublishedLineName?.[0]?.value || '?',
      destination: mvj.DestinationName?.[0]?.value || '',
    });
  }
  return buses;
}

function filterToVisibleZones(buses) {
  const zones = points
    .filter(p => p.transitCalculated && p.transitVisible)
    .map(p => p._geoPolygon);
  if (zones.length === 0) return [];
  return buses.filter(bus => {
    const pt = turf.point([bus.lng, bus.lat]);
    return zones.some(zone => turf.booleanPointInPolygon(pt, zone));
  });
}

function busIcon(bearing) {
  const rot = Number.isFinite(bearing) ? bearing : 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">` +
    `<circle cx="12" cy="12" r="9" fill="#fbbc04" stroke="#fff" stroke-width="2"/>` +
    `<g transform="rotate(${rot} 12 12)"><polygon points="12,4 16,12 12,10 8,12" fill="#202124"/></g>` +
    `</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(24, 24),
    anchor: new google.maps.Point(12, 12),
  };
}

function renderLiveBusMarkers(buses) {
  const seen = new Set();
  buses.forEach(bus => {
    seen.add(bus.id);
    const existing = liveBusMarkers.get(bus.id);
    const title = `${bus.line} → ${bus.destination}`;
    if (existing) {
      existing.setPosition({ lat: bus.lat, lng: bus.lng });
      existing.setIcon(busIcon(bus.bearing));
      existing.setTitle(title);
    } else {
      const marker = new google.maps.Marker({
        position: { lat: bus.lat, lng: bus.lng },
        map,
        icon: busIcon(bus.bearing),
        title,
        zIndex: 500,
      });
      liveBusMarkers.set(bus.id, marker);
    }
  });
  for (const [id, marker] of liveBusMarkers) {
    if (!seen.has(id)) {
      marker.setMap(null);
      liveBusMarkers.delete(id);
    }
  }
}

function clearLiveBusMarkers() {
  liveBusMarkers.forEach(m => m.setMap(null));
  liveBusMarkers.clear();
}

async function pollLiveBuses() {
  if (!hasVisibleTransitZone()) {
    clearLiveBusMarkers();
    updateLiveBusesStatus();
    return;
  }
  try {
    lastFetchedBuses = await fetchLiveBuses();
    lastFetchFailed = false;
  } catch (err) {
    console.error('Kunne ikke hente sanntidsbusser:', err);
    lastFetchFailed = true;
    if (lastFetchedBuses.length === 0) { updateLiveBusesStatus(); return; }
  }
  if (!liveBusesActive) return;
  renderLiveBusMarkers(filterToVisibleZones(lastFetchedBuses));
  updateLiveBusesStatus();
}

function startLiveBusesPolling() {
  pollLiveBuses();
  liveBusesPollTimer = setInterval(pollLiveBuses, LIVE_BUSES_POLL_MS);
}

function stopLiveBusesPolling() {
  clearInterval(liveBusesPollTimer);
  liveBusesPollTimer = null;
  clearLiveBusMarkers();
}

function refreshLiveBusesIfActive() {
  const btn = document.getElementById('live-buses-toggle-btn');
  if (btn) btn.disabled = !liveBusesActive && !hasVisibleTransitZone();
  if (!liveBusesActive) return;
  if (!hasVisibleTransitZone()) { clearLiveBusMarkers(); updateLiveBusesStatus(); return; }
  renderLiveBusMarkers(filterToVisibleZones(lastFetchedBuses));
  updateLiveBusesStatus();
}

function updateLiveBusesStatus() {
  const el = document.getElementById('live-buses-status');
  if (!el) return;
  if (!liveBusesActive || !hasVisibleTransitZone()) {
    el.style.display = 'none';
    return;
  }
  if (lastFetchFailed && lastFetchedBuses.length === 0) {
    el.textContent = 'Kunne ikke hente sanntidsdata akkurat nå';
    el.style.display = 'block';
    return;
  }
  const visibleCount = filterToVisibleZones(lastFetchedBuses).length;
  if (visibleCount === 0) {
    el.textContent = 'Ingen sanntidsbusser tilgjengelig i dette området akkurat nå';
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function initLiveBusesToggle() {
  const btn = document.createElement('button');
  btn.id = 'live-buses-toggle-btn';
  btn.className = 'transit-btn';
  btn.innerHTML = '🚌 Live buss';
  btn.title = 'Vis/skjul sanntidsbusser i kollektivsonen';
  btn.disabled = !hasVisibleTransitZone();
  btn.addEventListener('click', () => {
    liveBusesActive = !liveBusesActive;
    btn.classList.toggle('active', liveBusesActive);
    if (liveBusesActive) {
      startLiveBusesPolling();
    } else {
      stopLiveBusesPolling();
      updateLiveBusesStatus();
    }
  });
  document.body.appendChild(btn);

  const status = document.createElement('div');
  status.id = 'live-buses-status';
  status.style.display = 'none';
  document.body.appendChild(status);
}
