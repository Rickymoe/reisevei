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

const CLUSTER_CELL_PX = 50;

function escapeSvgText(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Buckets buses into a screen-pixel grid (not a fixed geo-distance) so
// clustering adapts automatically to zoom: same grouping behavior whether
// zoomed to a neighborhood or a whole county.
function clusterBuses(buses) {
  const projection = map.getProjection();
  if (!projection) return buses.map(bus => ({ type: 'bus', bus }));
  const scale = Math.pow(2, map.getZoom());
  const groups = new Map();
  for (const bus of buses) {
    const worldPoint = projection.fromLatLngToPoint(new google.maps.LatLng(bus.lat, bus.lng));
    const cellX = Math.floor((worldPoint.x * scale) / CLUSTER_CELL_PX);
    const cellY = Math.floor((worldPoint.y * scale) / CLUSTER_CELL_PX);
    const key = `${cellX}:${cellY}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bus);
  }
  const items = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      items.push({ type: 'bus', bus: group[0] });
    } else {
      items.push({
        type: 'cluster',
        id: `cluster:${key}`,
        lat: group.reduce((sum, b) => sum + b.lat, 0) / group.length,
        lng: group.reduce((sum, b) => sum + b.lng, 0) / group.length,
        count: group.length,
      });
    }
  }
  return items;
}

function clusterIcon(count) {
  const label = count > 99 ? '99+' : String(count);
  const radius = count > 9 ? 13 : 11;
  const size = radius * 2 + 4;
  const c = size / 2;
  const fontSize = label.length >= 3 ? 10 : 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${radius}" fill="#1a73e8" stroke="#fff" stroke-width="2"/>` +
    `<text x="${c}" y="${c + 1}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${label}</text>` +
    `</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(c, c),
  };
}

function busIcon(bearing, line) {
  const rot = Number.isFinite(bearing) ? bearing : 0;
  const label = escapeSvgText((line || '?').toString().slice(0, 3));
  const fontSize = label.length >= 3 ? 9 : label.length === 2 ? 11 : 13;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
    `<circle cx="16" cy="16" r="11" fill="#fbbc04" stroke="#fff" stroke-width="2"/>` +
    `<g transform="rotate(${rot} 16 16)"><polygon points="16,1 19,7 13,7" fill="#202124"/></g>` +
    `<text x="16" y="17" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#202124">${label}</text>` +
    `</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
}

function renderLiveBusMarkers(buses) {
  const seen = new Set();
  clusterBuses(buses).forEach(item => {
    if (item.type === 'cluster') {
      seen.add(item.id);
      const existing = liveBusMarkers.get(item.id);
      const title = `${item.count} busser`;
      if (existing) {
        existing.setPosition({ lat: item.lat, lng: item.lng });
        existing.setIcon(clusterIcon(item.count));
        existing.setTitle(title);
      } else {
        const marker = new google.maps.Marker({
          position: { lat: item.lat, lng: item.lng },
          map,
          icon: clusterIcon(item.count),
          title,
          zIndex: 501,
        });
        liveBusMarkers.set(item.id, marker);
      }
      return;
    }
    const bus = item.bus;
    seen.add(bus.id);
    const existing = liveBusMarkers.get(bus.id);
    const title = `${bus.line} → ${bus.destination}`;
    if (existing) {
      existing.setPosition({ lat: bus.lat, lng: bus.lng });
      existing.setIcon(busIcon(bus.bearing, bus.line));
      existing.setTitle(title);
    } else {
      const marker = new google.maps.Marker({
        position: { lat: bus.lat, lng: bus.lng },
        map,
        icon: busIcon(bus.bearing, bus.line),
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

  // Re-cluster/redraw on zoom without waiting for the next 20s poll —
  // clustering is purely a function of current zoom + already-fetched buses.
  map.addListener('zoom_changed', refreshLiveBusesIfActive);
}
