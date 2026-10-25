const transitPolylinesByType = { tram: [], subway: [] };
const transitVisible = { tram: false, subway: false };

let lineTooltip = null;

const STRIPE_DASH_PX = 8;

// Lines sharing a track are drawn as one invisible polyline carrying a repeating
// dash in each line's colour, so every line stays visible instead of one hiding the rest.
function stripeIcons(colors, weight) {
  return colors.map((color, i) => ({
    icon: { path: 'M 0,-1 0,1', strokeColor: color, strokeOpacity: 0.95, strokeWeight: weight, scale: STRIPE_DASH_PX / 2 },
    offset: `${i * STRIPE_DASH_PX}px`,
    repeat: `${colors.length * STRIPE_DASH_PX}px`,
  }));
}

function setLineHover(hoveredNames, on) {
  for (const type of ['tram', 'subway']) {
    for (const p of transitPolylinesByType[type]) {
      if (p.stripeColors) {
        if (p.lineNames.some(n => hoveredNames.includes(n))) p.setOptions({ icons: stripeIcons(p.stripeColors, on ? 6 : 3) });
      } else if (hoveredNames.includes(p.lineName)) {
        p.setOptions({ strokeWeight: on ? 6 : 3, strokeOpacity: on ? 1 : 0.85 });
      }
    }
  }
}

function attachLineHover(polyline, label, names) {
  polyline.lineName = names[0];
  polyline.lineNames = names;
  polyline.addListener('mouseover', e => {
    setLineHover(names, true);
    lineTooltip.textContent = label;
    lineTooltip.style.display = 'block';
    moveLineTooltip(e);
  });
  polyline.addListener('mousemove', moveLineTooltip);
  polyline.addListener('mouseout', () => {
    setLineHover(names, false);
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
      const shared = f.properties.shared;
      const polyline = new google.maps.Polyline(shared ? {
        path,
        strokeOpacity: 0,
        strokeWeight: 6,
        icons: stripeIcons(f.properties.colors, 3),
        map: null,
        zIndex: 2,
      } : {
        path,
        strokeColor: f.properties.color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map: null,
        zIndex: 1,
      });
      if (shared) polyline.stripeColors = f.properties.colors;
      attachLineHover(polyline, f.properties.name, shared ? f.properties.names : [f.properties.name]);
      transitPolylinesByType[routeType].push(polyline);
    }
    for (const type of ['tram', 'subway']) {
      if (transitVisible[type]) transitPolylinesByType[type].forEach(p => p.setMap(map));
    }
  } catch (err) {
    console.error('Kunne ikke laste kollektivlinjer:', err);
    document.getElementById('tram-toggle-btn')?.parentElement.remove();
    document.getElementById('subway-toggle-btn')?.parentElement.remove();
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
  addLayerItem(5, tramBtn);

  const subwayBtn = document.createElement('button');
  subwayBtn.id = 'subway-toggle-btn';
  subwayBtn.className = 'transit-btn';
  subwayBtn.innerHTML = '🚇 T-bane';
  subwayBtn.title = 'Vis/skjul T-banelinjer';
  subwayBtn.addEventListener('click', () => setTypeVisible('subway', !transitVisible.subway));
  addLayerItem(6, subwayBtn);

  loadTransitLines();
}
