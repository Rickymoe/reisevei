async function fetchPlaceName(lat, lng) {
  try {
    const url = `https://ws.geonorge.no/stedsnavn/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4326&radius=500&antall=1`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const hit = data.navn && data.navn[0];
    return hit ? hit.stedsnavn[0].skrivemåte : null;
  } catch (err) {
    return null;
  }
}

// Bygger en avstandsbasert høydeprofil (km langs ruten, ikke punktindeks),
// inkludert returbenet hvis "Speil retur" er huket av.
function buildDistanceProfile() {
  const mirror = document.getElementById('loype-mirror-checkbox').checked;
  const profile = [];
  let cum = 0;
  for (let i = 0; i < routePoints.length; i++) {
    if (i > 0) {
      const segKm = turf.distance(
        turf.point([routePoints[i - 1].lng, routePoints[i - 1].lat]),
        turf.point([routePoints[i].lng, routePoints[i].lat]),
        { units: 'kilometers' }
      );
      cum += segKm;
    }
    if (routeElevations[i] !== undefined) {
      profile.push({ distKm: cum, elevation: routeElevations[i], lat: routePoints[i].lat, lng: routePoints[i].lng });
    }
  }

  if (mirror && profile.length > 1) {
    const totalOneWay = cum;
    const returnLeg = profile.slice(0, -1).reverse().map(p => ({
      distKm: totalOneWay + (totalOneWay - p.distKm),
      elevation: p.elevation,
      lat: p.lat,
      lng: p.lng,
    }));
    profile.push(...returnLeg);
  }

  return profile;
}

const GRADE_BUCKETS = [
  { max: 0.03, base: '#8bc34a', light: '#dcedc8' },
  { max: 0.06, base: '#ffc107', light: '#fff3cd' },
  { max: 0.10, base: '#ff9800', light: '#ffe0b2' },
  { max: Infinity, base: '#e53935', light: '#ffcdd2' },
];

function gradeBucketIndex(grade) {
  return GRADE_BUCKETS.findIndex(b => grade < b.max);
}

// Bygger en lys-til-mørk gradient per stigningsfarge, så profilen får litt
// dybde/3D-følelse (som sollys som treffer en skråning) i stedet for flate
// fargeflater.
function buildDetailGradients(svg) {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  GRADE_BUCKETS.forEach((bucket, i) => {
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', `loype-grade-gradient-${i}`);
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y2', '1');

    const stopTop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopTop.setAttribute('offset', '0%');
    stopTop.setAttribute('stop-color', bucket.light);
    const stopBottom = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopBottom.setAttribute('offset', '100%');
    stopBottom.setAttribute('stop-color', bucket.base);

    gradient.appendChild(stopTop);
    gradient.appendChild(stopBottom);
    defs.appendChild(gradient);
  });

  const shadowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  shadowFilter.setAttribute('id', 'loype-profile-shadow');
  shadowFilter.setAttribute('x', '-20%');
  shadowFilter.setAttribute('y', '-20%');
  shadowFilter.setAttribute('width', '140%');
  shadowFilter.setAttribute('height', '140%');
  const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
  dropShadow.setAttribute('dx', '0');
  dropShadow.setAttribute('dy', '2');
  dropShadow.setAttribute('stdDeviation', '2');
  dropShadow.setAttribute('flood-color', '#000');
  dropShadow.setAttribute('flood-opacity', '0.3');
  shadowFilter.appendChild(dropShadow);
  defs.appendChild(shadowFilter);

  svg.appendChild(defs);
}

let detailModal = null;

function openRouteDetailView() {
  const profile = buildDistanceProfile();
  if (profile.length < 2) return;

  buildDetailModalSkeleton();
  renderDetailSummary(profile);
  renderDetailChart(profile);
  loadPlaceLabels(profile);
}

function closeRouteDetailView() {
  if (detailModal) {
    detailModal.remove();
    detailModal = null;
  }
}

function buildDetailModalSkeleton() {
  if (detailModal) detailModal.remove();
  detailModal = document.createElement('div');
  detailModal.id = 'loype-detail-modal';
  detailModal.innerHTML = `
    <div id="loype-detail-backdrop"></div>
    <div id="loype-detail-panel">
      <button id="loype-detail-close" aria-label="Lukk">&times;</button>
      <div id="loype-detail-summary"></div>
      <svg id="loype-detail-chart" viewBox="0 0 900 320" preserveAspectRatio="xMidYMid meet" role="img"></svg>
    </div>
  `;
  document.body.appendChild(detailModal);
  document.getElementById('loype-detail-close').addEventListener('click', closeRouteDetailView);
  document.getElementById('loype-detail-backdrop').addEventListener('click', closeRouteDetailView);
}

function renderDetailSummary(profile) {
  const totalKm = profile[profile.length - 1].distKm;
  const gain = profile.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const diff = p.elevation - profile[i - 1].elevation;
    return sum + (diff > 0 ? diff : 0);
  }, 0);

  const paceSecPerKm = parsePaceToSecondsPerKm(document.getElementById('loype-pace-input').value);
  let timeText = '';
  if (paceSecPerKm) {
    const mirror = document.getElementById('loype-mirror-checkbox').checked;
    let seconds = segmentTimeSeconds(paceSecPerKm, false);
    if (mirror) seconds += segmentTimeSeconds(paceSecPerKm, true);
    timeText = ` · Estimert tid: ${formatDuration(seconds)}`;
  }

  document.getElementById('loype-detail-summary').textContent =
    `${totalKm.toFixed(2)} km · ${Math.round(gain)} m stigning${timeText}`;
}

function renderDetailChart(profile) {
  const svg = document.getElementById('loype-detail-chart');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const width = 900, height = 320;
  const plotLeft = 50, plotRight = width - 20, plotTop = 20, plotBottom = height - 40;

  const totalKm = profile[profile.length - 1].distKm;
  const elevations = profile.map(p => p.elevation);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(max - min, 1);

  const xFor = distKm => plotLeft + (totalKm > 0 ? (distKm / totalKm) : 0) * (plotRight - plotLeft);
  const yFor = elevation => plotTop + (1 - (elevation - min) / range) * (plotBottom - plotTop);

  buildDetailGradients(svg);

  // Fylt, gradientskyggelagt profil (én polygon per delstrekning) — lysere
  // øverst, mørkere mot grunnlinja, for litt 3D-følelse.
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i];
    const segKm = b.distKm - a.distKm;
    const grade = segKm > 0 ? Math.max(0, (b.elevation - a.elevation) / (segKm * 1000)) : 0;

    const x1 = xFor(a.distKm), x2 = xFor(b.distKm);
    const y1 = yFor(a.elevation), y2 = yFor(b.elevation);

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', `${x1},${plotBottom} ${x1},${y1} ${x2},${y2} ${x2},${plotBottom}`);
    poly.setAttribute('fill', `url(#loype-grade-gradient-${gradeBucketIndex(grade)})`);
    svg.appendChild(poly);
  }

  // Konturlinje over den fargede profilen, med en myk skygge for å gi
  // fjellsilhuetten litt dybde.
  const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  outline.setAttribute('points', profile.map(p => `${xFor(p.distKm).toFixed(1)},${yFor(p.elevation).toFixed(1)}`).join(' '));
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', '#1a1a2e');
  outline.setAttribute('stroke-width', '1.5');
  outline.setAttribute('filter', 'url(#loype-profile-shadow)');
  svg.appendChild(outline);

  // Y-akse med noen få høydenivåer
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', String(plotLeft));
  yAxis.setAttribute('y1', String(plotTop));
  yAxis.setAttribute('x2', String(plotLeft));
  yAxis.setAttribute('y2', String(plotBottom));
  yAxis.setAttribute('stroke', '#999');
  svg.appendChild(yAxis);

  const yTickCount = 4;
  for (let i = 0; i <= yTickCount; i++) {
    const value = min + (range * i) / yTickCount;
    const y = yFor(value);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', String(plotLeft - 5));
    tick.setAttribute('y1', String(y));
    tick.setAttribute('x2', String(plotLeft));
    tick.setAttribute('y2', String(y));
    tick.setAttribute('stroke', '#999');
    svg.appendChild(tick);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(plotLeft - 8));
    label.setAttribute('y', String(y + 3));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', '#5f6368');
    label.textContent = `${Math.round(value)} m`;
    svg.appendChild(label);
  }

  // X-akse med kilometermarkeringer
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', String(plotLeft));
  xAxis.setAttribute('y1', String(plotBottom));
  xAxis.setAttribute('x2', String(plotRight));
  xAxis.setAttribute('y2', String(plotBottom));
  xAxis.setAttribute('stroke', '#999');
  svg.appendChild(xAxis);

  const xStepKm = totalKm > 5 ? 1 : (totalKm > 1 ? 0.5 : 0.1);
  for (let d = 0; d <= totalKm + 0.001; d += xStepKm) {
    const x = xFor(d);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', String(x));
    tick.setAttribute('y1', String(plotBottom));
    tick.setAttribute('x2', String(x));
    tick.setAttribute('y2', String(plotBottom + 5));
    tick.setAttribute('stroke', '#999');
    svg.appendChild(tick);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(plotBottom + 18));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', '#5f6368');
    label.textContent = `${d.toFixed(d < 1 ? 1 : 0)} km`;
    svg.appendChild(label);
  }

  svg.dataset.plotLeft = String(plotLeft);
  svg.dataset.plotRight = String(plotRight);
  svg.dataset.plotTop = String(plotTop);
  svg.dataset.plotBottom = String(plotBottom);
  svg.dataset.totalKm = String(totalKm);
  svg.dataset.min = String(min);
  svg.dataset.range = String(range);
}

function addDetailLabel(profile, point, name) {
  const svg = document.getElementById('loype-detail-chart');
  if (!svg) return;
  const plotLeft = Number(svg.dataset.plotLeft);
  const plotRight = Number(svg.dataset.plotRight);
  const plotTop = Number(svg.dataset.plotTop);
  const plotBottom = Number(svg.dataset.plotBottom);
  const totalKm = Number(svg.dataset.totalKm);
  const min = Number(svg.dataset.min);
  const range = Number(svg.dataset.range);

  const x = plotLeft + (totalKm > 0 ? (point.distKm / totalKm) : 0) * (plotRight - plotLeft);
  const y = plotTop + (1 - (point.elevation - min) / range) * (plotBottom - plotTop);
  const xClamped = Math.min(Math.max(x, plotLeft + 5), plotRight - 5);

  // Stiplet loddrett linje fra grunnlinja opp til punktet, som i Tour de
  // France-profiler.
  const connector = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  connector.setAttribute('x1', String(xClamped));
  connector.setAttribute('y1', String(plotBottom));
  connector.setAttribute('x2', String(xClamped));
  connector.setAttribute('y2', String(y));
  connector.setAttribute('stroke', '#666');
  connector.setAttribute('stroke-width', '1');
  connector.setAttribute('stroke-dasharray', '3,3');
  svg.appendChild(connector);

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', String(xClamped));
  dot.setAttribute('cy', String(y));
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', '#1a1a2e');
  svg.appendChild(dot);

  // Vertikal tekst som vokser oppover fra grunnlinja, like til venstre for
  // den stiplede linja — samme plassering som stedsnavnene i TdF-profiler.
  const labelX = xClamped - 8;
  const labelY = plotBottom - 4;
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', String(labelX));
  label.setAttribute('y', String(labelY));
  label.setAttribute('text-anchor', 'start');
  label.setAttribute('font-size', '12');
  label.setAttribute('font-weight', '600');
  label.setAttribute('fill', '#1a1a2e');
  label.setAttribute('stroke', '#fff');
  label.setAttribute('stroke-width', '3');
  label.setAttribute('paint-order', 'stroke');
  label.setAttribute('transform', `rotate(-90 ${labelX} ${labelY})`);
  label.textContent = `${name} · ${point.distKm.toFixed(1)} km · ${Math.round(point.elevation)} m`;
  svg.appendChild(label);
}

async function loadPlaceLabels(profile) {
  const start = profile[0];
  const end = profile[profile.length - 1];
  const peak = profile.reduce((a, b) => (b.elevation > a.elevation ? b : a));

  const [startName, endName, peakName] = await Promise.all([
    fetchPlaceName(start.lat, start.lng),
    fetchPlaceName(end.lat, end.lng),
    peak !== start && peak !== end ? fetchPlaceName(peak.lat, peak.lng) : Promise.resolve(null),
  ]);

  if (!document.getElementById('loype-detail-chart')) return; // modal lukket i mellomtiden

  addDetailLabel(profile, start, startName || 'Start');
  addDetailLabel(profile, end, endName || 'Slutt');
  if (peak !== start && peak !== end) {
    addDetailLabel(profile, peak, peakName || 'Høyeste punkt');
  }
}

function initRouteDetailView() {
  document.getElementById('loype-elevation-chart').addEventListener('click', openRouteDetailView);
}

document.addEventListener('DOMContentLoaded', initRouteDetailView);
