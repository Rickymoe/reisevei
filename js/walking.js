const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE3YjA3MWQ1M2NhZTQ5NDNhMTg4Mjc4ODY3M2E1NTg3IiwiaCI6Im11cm11cjY0In0=';

async function fetchWalkingIsochrone(lat, lng, minutes) {
  const resp = await fetch(
    'https://api.openrouteservice.org/v2/isochrones/foot-walking',
    {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [minutes * 60],
        range_type: 'time',
      }),
    }
  );
  if (resp.status === 429) throw new Error('rate_limit');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.json();
}

function drawWalkingPolygon(pt) {
  const coords = pt.walkGeoJSON.features[0].geometry.coordinates[0];
  pt.walkPolygon = new google.maps.Polygon({
    paths: coords.map(([lng, lat]) => ({ lat, lng })),
    strokeColor: pt.color,
    strokeOpacity: 0.6,
    strokeWeight: 2,
    fillColor: pt.color,
    fillOpacity: 0.08,
    map,
    zIndex: 1,
  });
}

async function toggleWalkingPolygon(index) {
  const pt = points[index];

  if (pt.walkVisible) {
    pt.walkPolygon.setMap(null);
    pt.walkPolygon = null;
    pt.walkVisible = false;
    document.querySelector(`.walk-btn[data-index="${index}"]`)?.classList.remove('active');
    return;
  }

  if (pt.walkGeoJSON) {
    drawWalkingPolygon(pt);
    pt.walkVisible = true;
    document.querySelector(`.walk-btn[data-index="${index}"]`)?.classList.add('active');
    return;
  }

  const btn = document.querySelector(`.walk-btn[data-index="${index}"]`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    pt.walkGeoJSON = await fetchWalkingIsochrone(pt.lat, pt.lng, pt.minutes);
    drawWalkingPolygon(pt);
    pt.walkVisible = true;
    if (btn) btn.classList.add('active');
  } catch (err) {
    pt.walkGeoJSON = null;
    showError(err.message === 'rate_limit'
      ? 'Gang-API er overbelastet. Prøv igjen om litt.'
      : 'Kunne ikke hente gangsone. Prøv igjen.');
  } finally {
    if (btn) { btn.textContent = '🚶'; btn.disabled = false; }
  }
}

function clearWalkingPolygons() {
  points.forEach(pt => {
    if (pt.walkPolygon) { pt.walkPolygon.setMap(null); pt.walkPolygon = null; }
    pt.walkVisible = false;
  });
}
