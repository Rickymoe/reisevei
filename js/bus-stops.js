// Bus stops for the visible map area, fetched from Entur Journey Planner
// (stopPlacesByBbox). Only shown when zoomed in, so the marker count stays low.

const BUS_STOPS_MIN_ZOOM = 14;
const BUS_STOPS_ORDER = 2;

function createBusStopsLayer() {
  let active = false;
  let markers = new Map(); // stopPlace id -> google.maps.Marker
  let requestSeq = 0;
  let status = null;
  let icon = null;

  async function fetchStops(bounds) {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const data = await graphql(`{
      stopPlacesByBbox(minimumLatitude: ${sw.lat()}, minimumLongitude: ${sw.lng()},
                       maximumLatitude: ${ne.lat()}, maximumLongitude: ${ne.lng()},
                       multiModalMode: parent) {
        id name latitude longitude transportMode
      }
    }`);
    return data.stopPlacesByBbox.filter(s => s.transportMode?.includes('bus'));
  }

  function setStatus(text) {
    status.textContent = text || '';
    status.style.display = text ? 'block' : 'none';
  }

  function clear() {
    markers.forEach(m => m.setMap(null));
    markers.clear();
  }

  async function refresh() {
    if (!active) return;
    if (map.getZoom() < BUS_STOPS_MIN_ZOOM) {
      clear();
      setStatus('Zoom inn for å se bussholdeplasser');
      return;
    }
    const bounds = map.getBounds();
    if (!bounds) return;
    const seq = ++requestSeq;
    let stops;
    try {
      stops = await fetchStops(bounds);
    } catch (err) {
      console.error('Kunne ikke hente bussholdeplasser:', err);
      if (seq === requestSeq) setStatus('Kunne ikke hente bussholdeplasser');
      return;
    }
    if (!active || seq !== requestSeq) return;

    const keep = new Set(stops.map(s => s.id));
    for (const [id, m] of markers) {
      if (!keep.has(id)) { m.setMap(null); markers.delete(id); }
    }
    for (const s of stops) {
      if (markers.has(s.id)) continue;
      markers.set(s.id, new google.maps.Marker({
        map,
        position: { lat: s.latitude, lng: s.longitude },
        title: s.name,
        icon,
        zIndex: 2,
        clickable: false,
      }));
    }
    setStatus(stops.length === 0 ? 'Ingen bussholdeplasser i kartutsnittet' : '');
  }

  function init() {
    icon = {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#e53935',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 1,
      scale: 5,
    };

    const btn = document.createElement('button');
    btn.id = 'bus-stops-toggle-btn';
    btn.className = 'transit-btn';
    btn.innerHTML = '🚏 Holdeplasser';
    btn.title = 'Vis/skjul bussholdeplasser i kartutsnittet';
    btn.addEventListener('click', () => {
      active = !active;
      btn.classList.toggle('active', active);
      if (active) {
        refresh();
      } else {
        requestSeq++;
        clear();
        setStatus('');
      }
    });
    status = document.createElement('div');
    status.className = 'live-vehicles-status';
    status.style.display = 'none';
    addLayerItem(BUS_STOPS_ORDER, btn, status);

    map.addListener('idle', refresh);
  }

  return { init };
}

const busStopsLayer = createBusStopsLayer();
