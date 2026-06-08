const ENTUR_ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql';
const ENTUR_CLIENT_NAME = 'isokronkart-personal';

async function graphql(query) {
  const resp = await fetch(ENTUR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ET-Client-Name': ENTUR_CLIENT_NAME,
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`Entur HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function fetchStopsNearby(lat, lng, radiusMeters = 15000, maxStops = 80) {
  const query = `{
    stopsByRadius(latitude: ${lat}, longitude: ${lng}, radius: ${radiusMeters}, first: ${maxStops}) {
      edges {
        node {
          place {
            ... on StopPlace {
              id
              name
              latitude
              longitude
            }
          }
          distance
        }
      }
    }
  }`;
  const data = await graphql(query);
  return data.stopsByRadius.edges
    .map(e => e.node.place)
    .filter(p => p && p.latitude && p.longitude);
}

async function fetchTripDuration(fromLat, fromLng, toStopId, dateTimeISO) {
  const query = `{
    trip(
      from: { coordinates: { latitude: ${fromLat}, longitude: ${fromLng} } }
      to: { place: "${toStopId}" }
      dateTime: "${dateTimeISO}"
      numTripPatterns: 1
    ) {
      tripPatterns {
        duration
      }
    }
  }`;
  try {
    const data = await graphql(query);
    const patterns = data.trip.tripPatterns;
    if (!patterns || patterns.length === 0) return null;
    return patterns[0].duration; // seconds
  } catch {
    return null;
  }
}

async function batchFetchDurations(stops, fromLat, fromLng, dateTimeISO, onProgress) {
  const CONCURRENCY = 10;
  const results = new Array(stops.length).fill(null);

  for (let i = 0; i < stops.length; i += CONCURRENCY) {
    const batch = stops.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(stop => fetchTripDuration(fromLat, fromLng, stop.id, dateTimeISO))
    );
    batchResults.forEach((dur, j) => { results[i + j] = dur; });
    onProgress(Math.min(i + CONCURRENCY, stops.length), stops.length);
  }
  return results; // [seconds | null] — same order as stops
}
