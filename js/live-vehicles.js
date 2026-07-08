// Shared engine behind the "Live buss" and "Live trikk" layers (js/live-buses.js,
// js/live-trams.js). Both are thin config objects passed to
// createLiveVehicleLayer() below — fetch/filter/cluster/render/poll logic
// lives here once instead of being duplicated per vehicle mode.

const CLUSTER_CELL_PX = 50;

function hasVisibleTransitZone() {
  return points.some(p => p.transitCalculated && p.transitVisible);
}

function filterToVisibleZones(vehicles) {
  const zones = points
    .filter(p => p.transitCalculated && p.transitVisible)
    .map(p => p._geoPolygon);
  if (zones.length === 0) return [];
  return vehicles.filter(v => {
    const pt = turf.point([v.lng, v.lat]);
    return zones.some(zone => turf.booleanPointInPolygon(pt, zone));
  });
}

function escapeSvgText(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Buckets vehicles into a screen-pixel grid (not a fixed geo-distance) so
// clustering adapts automatically to zoom: same grouping behavior whether
// zoomed to a neighborhood or a whole county.
function clusterVehicles(vehicles) {
  const projection = map.getProjection();
  if (!projection) return vehicles.map(v => ({ type: 'vehicle', vehicle: v }));
  const scale = Math.pow(2, map.getZoom());
  const groups = new Map();
  for (const v of vehicles) {
    const worldPoint = projection.fromLatLngToPoint(new google.maps.LatLng(v.lat, v.lng));
    const cellX = Math.floor((worldPoint.x * scale) / CLUSTER_CELL_PX);
    const cellY = Math.floor((worldPoint.y * scale) / CLUSTER_CELL_PX);
    const key = `${cellX}:${cellY}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  const items = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      items.push({ type: 'vehicle', vehicle: group[0] });
    } else {
      items.push({
        type: 'cluster',
        id: `cluster:${key}`,
        lat: group.reduce((sum, v) => sum + v.lat, 0) / group.length,
        lng: group.reduce((sum, v) => sum + v.lng, 0) / group.length,
        count: group.length,
      });
    }
  }
  return items;
}

function vehicleClusterIcon(count, color) {
  const label = count > 99 ? '99+' : String(count);
  const radius = count > 9 ? 13 : 11;
  const size = radius * 2 + 4;
  const c = size / 2;
  const fontSize = label.length >= 3 ? 10 : 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${radius}" fill="${color}" stroke="#fff" stroke-width="2"/>` +
    `<text x="${c}" y="${c + 1}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${label}</text>` +
    `</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(c, c),
  };
}

function vehicleIcon(bearing, line, color) {
  const rot = Number.isFinite(bearing) ? bearing : 0;
  const label = escapeSvgText((line || '?').toString().slice(0, 3));
  const fontSize = label.length >= 3 ? 9 : label.length === 2 ? 11 : 13;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
    `<circle cx="16" cy="16" r="11" fill="${color}" stroke="#fff" stroke-width="2"/>` +
    `<g transform="rotate(${rot} 16 16)"><polygon points="16,1 19,7 13,7" fill="#202124"/></g>` +
    `<text x="16" y="17" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#202124">${label}</text>` +
    `</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
}

// opts: { mode, endpoint, pollMs, iconColor, clusterColor, buttonId, statusId,
//         buttonLabel, buttonTitle, bottomPx, noun, nounPlural }
function createLiveVehicleLayer(opts) {
  let active = false;
  let pollTimer = null;
  let markers = new Map(); // vehicleId or clusterId -> google.maps.Marker
  let lastFetched = [];
  let lastFetchFailed = false;

  async function fetchVehicles() {
    const resp = await fetch(opts.endpoint, {
      headers: {
        'Accept': 'application/json',
        'ET-Client-Name': ENTUR_CLIENT_NAME,
      },
    });
    if (!resp.ok) throw new Error(`Entur VM HTTP ${resp.status}`);
    const json = await resp.json();
    const deliveries = json.Siri?.ServiceDelivery?.VehicleMonitoringDelivery;
    const activities = deliveries?.[0]?.VehicleActivity || [];

    const vehicles = [];
    for (const activity of activities) {
      const mvj = activity.MonitoredVehicleJourney;
      if (!mvj || !mvj.VehicleMode || !mvj.VehicleMode.includes(opts.mode)) continue;
      const loc = mvj.VehicleLocation;
      const vehicleRef = mvj.VehicleRef?.value;
      if (!loc || vehicleRef === undefined) continue;
      vehicles.push({
        id: vehicleRef,
        lat: loc.Latitude,
        lng: loc.Longitude,
        bearing: typeof mvj.Bearing === 'number' ? mvj.Bearing : 0,
        line: mvj.PublishedLineName?.[0]?.value || '?',
        destination: mvj.DestinationName?.[0]?.value || '',
      });
    }
    return vehicles;
  }

  function render(vehicles) {
    const seen = new Set();
    clusterVehicles(vehicles).forEach(item => {
      if (item.type === 'cluster') {
        seen.add(item.id);
        const existing = markers.get(item.id);
        const title = `${item.count} ${opts.nounPlural}`;
        if (existing) {
          existing.setPosition({ lat: item.lat, lng: item.lng });
          existing.setIcon(vehicleClusterIcon(item.count, opts.clusterColor));
          existing.setTitle(title);
        } else {
          const marker = new google.maps.Marker({
            position: { lat: item.lat, lng: item.lng },
            map,
            icon: vehicleClusterIcon(item.count, opts.clusterColor),
            title,
            zIndex: 501,
          });
          markers.set(item.id, marker);
        }
        return;
      }
      const v = item.vehicle;
      seen.add(v.id);
      const existing = markers.get(v.id);
      const title = `${v.line} → ${v.destination}`;
      if (existing) {
        existing.setPosition({ lat: v.lat, lng: v.lng });
        existing.setIcon(vehicleIcon(v.bearing, v.line, opts.iconColor));
        existing.setTitle(title);
      } else {
        const marker = new google.maps.Marker({
          position: { lat: v.lat, lng: v.lng },
          map,
          icon: vehicleIcon(v.bearing, v.line, opts.iconColor),
          title,
          zIndex: 500,
        });
        markers.set(v.id, marker);
      }
    });
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }
  }

  function clear() {
    markers.forEach(m => m.setMap(null));
    markers.clear();
  }

  function updateStatus() {
    const el = document.getElementById(opts.statusId);
    if (!el) return;
    if (!active || !hasVisibleTransitZone()) {
      el.style.display = 'none';
      return;
    }
    if (lastFetchFailed && lastFetched.length === 0) {
      el.textContent = 'Kunne ikke hente sanntidsdata akkurat nå';
      el.style.display = 'block';
      return;
    }
    const visibleCount = filterToVisibleZones(lastFetched).length;
    if (visibleCount === 0) {
      el.textContent = `Ingen sanntids${opts.nounPlural} tilgjengelig i dette området akkurat nå`;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  async function poll() {
    if (!hasVisibleTransitZone()) {
      clear();
      updateStatus();
      return;
    }
    try {
      lastFetched = await fetchVehicles();
      lastFetchFailed = false;
    } catch (err) {
      console.error(`Kunne ikke hente sanntids-${opts.noun}:`, err);
      lastFetchFailed = true;
      if (lastFetched.length === 0) { updateStatus(); return; }
    }
    if (!active) return;
    render(filterToVisibleZones(lastFetched));
    updateStatus();
  }

  function start() {
    poll();
    pollTimer = setInterval(poll, opts.pollMs);
  }

  function stop() {
    clearInterval(pollTimer);
    pollTimer = null;
    clear();
  }

  function refreshIfActive() {
    const btn = document.getElementById(opts.buttonId);
    if (btn) btn.disabled = !active && !hasVisibleTransitZone();
    if (!active) return;
    if (!hasVisibleTransitZone()) { clear(); updateStatus(); return; }
    render(filterToVisibleZones(lastFetched));
    updateStatus();
  }

  function initToggle() {
    const btn = document.createElement('button');
    btn.id = opts.buttonId;
    btn.className = 'transit-btn';
    btn.innerHTML = opts.buttonLabel;
    btn.title = opts.buttonTitle;
    btn.style.bottom = `${opts.bottomPx}px`;
    btn.disabled = !hasVisibleTransitZone();
    btn.addEventListener('click', () => {
      active = !active;
      btn.classList.toggle('active', active);
      if (active) {
        start();
      } else {
        stop();
        updateStatus();
      }
    });
    document.body.appendChild(btn);

    const status = document.createElement('div');
    status.id = opts.statusId;
    status.className = 'live-vehicles-status';
    status.style.bottom = `${opts.bottomPx + 45}px`;
    status.style.display = 'none';
    document.body.appendChild(status);

    // Re-cluster/redraw on zoom without waiting for the next poll —
    // clustering is purely a function of current zoom + already-fetched data.
    map.addListener('zoom_changed', refreshIfActive);
  }

  return { initToggle, refreshIfActive };
}
