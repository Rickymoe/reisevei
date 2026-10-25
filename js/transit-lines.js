const transitPolylinesByType = { tram: [], subway: [] };
const transitVisible = { tram: false, subway: false };

let lineTooltip = null;

function setLineHover(hoveredName, on) {
  for (const type of ['tram', 'subway']) {
    for (const p of transitPolylinesByType[type]) {
      if (p.lineName === hoveredName) p.setOptions({ strokeWeight: on ? 6 : 3, strokeOpacity: on ? 1 : 0.85 });
    }
  }
}

function attachLineHover(polyline, name) {
  polyline.lineName = name;
  polyline.addListener('mouseover', e => {
    setLineHover(name, true);
    lineTooltip.textContent = name;
    lineTooltip.style.display = 'block';
    moveLineTooltip(e);
  });
  polyline.addListener('mousemove', moveLineTooltip);
  polyline.addListener('mouseout', () => {
    setLineHover(name, false);
    lineTooltip.style.display = 'none';
  });
  // A clickable polyline swallows map clicks, so hand them on (point picking)
  polyline.addListener('click', e => onMapClick(e));
}

function moveLineTooltip(e) {
  const ev = e.domEvent;
  if (!ev) return;
  lineTooltip.style.left = `${ev.clientX + 12}px`;
  lineTooltip.style.top = `${ev.clientY + 12}px`;
}

async function loadTransitLines() {
  try {
    const resp = await fetch('js/oslo-transit-lines.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    for (const f of geojson.features) {
      const routeType = f.properties.type;
      if (!transitPolylinesByType[routeType]) continue;
      const path = f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: f.properties.color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map: null,
        zIndex: 1,
      });
      attachLineHover(polyline, f.properties.name);
      transitPolylinesByType[routeType].push(polyline);
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
  lineTooltip = document.createElement('div');
  lineTooltip.className = 'line-tooltip';
  document.body.appendChild(lineTooltip);

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

  loadTransitLines();
}
