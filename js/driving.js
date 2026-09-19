const DRIVE_COLOR = '#e65100';

async function fetchDrivingIsochrone(lat, lng, minutes) {
  const resp = await fetch(
    `https://api.openrouteservice.org/v2/isochrones/driving-car?api_key=${ORS_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json',
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [minutes * 60],
        range_type: 'time',
      }),
    }
  );
  if (resp.status === 429) throw new Error('rate_limit');
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('ORS driving error', resp.status, body);
    throw new Error(`HTTP ${resp.status}`);
  }
  return await resp.json();
}

function drawDrivingPolygon(pt) {
  const coords = pt.driveGeoJSON.features[0].geometry.coordinates[0];
  pt.drivePolygon = new google.maps.Polygon({
    paths: coords.map(([lng, lat]) => ({ lat, lng })),
    strokeColor: DRIVE_COLOR,
    strokeOpacity: 0.7,
    strokeWeight: 2,
    fillColor: DRIVE_COLOR,
    fillOpacity: 0.05,
    map,
    zIndex: 0,
  });
}

async function toggleDrivingPolygon(index) {
  const pt = points[index];

  if (pt.driveVisible) {
    pt.drivePolygon.setMap(null);
    pt.drivePolygon = null;
    pt.driveVisible = false;
    document.querySelector(`.drive-btn[data-index="${index}"]`)?.classList.remove('active');
    return;
  }

  if (pt.driveGeoJSON) {
    drawDrivingPolygon(pt);
    pt.driveVisible = true;
    document.querySelector(`.drive-btn[data-index="${index}"]`)?.classList.add('active');
    return;
  }

  pt.driveFetching = true;
  const btn = document.querySelector(`.drive-btn[data-index="${index}"]`);
  if (btn) { btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }

  try {
    pt.driveGeoJSON = await fetchDrivingIsochrone(pt.lat, pt.lng, pt.minutes);
    drawDrivingPolygon(pt);
    pt.driveVisible = true;
    if (btn) btn.classList.add('active');
  } catch (err) {
    pt.driveGeoJSON = null;
    showError(err.message === 'rate_limit'
      ? 'Bil-API er overbelastet. Prøv igjen om litt.'
      : `Kunne ikke hente bilsone (${err.message}). Prøv igjen.`);
  } finally {
    pt.driveFetching = false;
    if (btn) { btn.innerHTML = '🚗'; btn.disabled = false; }
  }
}

function clearDrivingPolygons() {
  points.forEach(pt => {
    if (pt.drivePolygon) { pt.drivePolygon.setMap(null); pt.drivePolygon = null; }
    pt.driveVisible = false;
  });
  document.querySelectorAll('.drive-btn.active').forEach(b => b.classList.remove('active'));
}
