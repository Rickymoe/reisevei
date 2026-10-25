// "Bydeler" layer: Oslo's current 15 bydeler and the 8 new ones from
// 1 Jan 2028. Boundaries come from Oslo kommune's own map layers
// (bydeler_2017 / NyeBydeler), saved as js/bydeler-na.json and js/bydeler-2028.json.
// Each feature carries a pastel `color` chosen so that no two neighbouring bydeler share one.

const BYDELER_BOTTOM_PX = 440;

function createBydelerLayer() {
  const sets = {
    na: { url: 'js/bydeler-na.json', label: 'Nå (15)' },
    nye: { url: 'js/bydeler-2028.json', label: 'Fra 2028 (8)' },
  };
  let active = false;
  let mode = 'nye';
  let switchEl = null;

  async function load(set) {
    if (set.data) return;
    const resp = await fetch(set.url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();
    set.data = new google.maps.Data();
    set.data.addGeoJson(geojson);
    set.data.setStyle(f => {
      const color = f.getProperty('color') || '#999';
      return {
        fillColor: color,
        fillOpacity: 0.28,
        strokeColor: color,
        strokeWeight: 2,
        clickable: false,
        zIndex: 0,
      };
    });
    set.labels = geojson.features.filter(f => f.properties.label !== false).map(f => {
      const [lng, lat] = turf.pointOnFeature(f).geometry.coordinates;
      return new google.maps.Marker({
        position: { lat, lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: f.properties.name, fontSize: '13px', fontWeight: '700', color: '#222' },
        clickable: false,
        zIndex: 1,
      });
    });
  }

  function show(set, visible) {
    if (!set.data) return;
    set.data.setMap(visible ? map : null);
    set.labels.forEach(m => m.setMap(visible ? map : null));
  }

  async function apply() {
    show(sets.na, false);
    show(sets.nye, false);
    if (!active) return;
    const current = mode;
    try {
      await load(sets[current]);
    } catch (err) {
      console.error('Kunne ikke laste bydeler:', err);
      return;
    }
    if (active && mode === current) show(sets[current], true);
  }

  function init() {
    const btn = document.createElement('button');
    btn.id = 'bydeler-toggle-btn';
    btn.className = 'transit-btn';
    btn.innerHTML = '🗺️ Bydeler';
    btn.title = 'Vis/skjul Oslos bydeler';
    btn.style.bottom = `${BYDELER_BOTTOM_PX}px`;
    document.body.appendChild(btn);

    switchEl = document.createElement('div');
    switchEl.className = 'bydel-switch';
    switchEl.style.bottom = `${BYDELER_BOTTOM_PX + 50}px`;
    switchEl.style.display = 'none';
    Object.entries(sets).forEach(([key, set]) => {
      const b = document.createElement('button');
      b.textContent = set.label;
      b.dataset.mode = key;
      b.classList.toggle('active', key === mode);
      b.addEventListener('click', () => {
        mode = key;
        switchEl.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.mode === mode));
        apply();
      });
      switchEl.appendChild(b);
    });
    document.body.appendChild(switchEl);

    btn.addEventListener('click', () => {
      active = !active;
      btn.classList.toggle('active', active);
      switchEl.style.display = active ? 'flex' : 'none';
      apply();
    });
  }

  return { init };
}

const bydelerLayer = createBydelerLayer();
