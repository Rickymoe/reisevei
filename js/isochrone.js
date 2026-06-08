function computeIsochrone(stops, durations, maxMinutes) {
  const maxSeconds = maxMinutes * 60;
  const reachable = stops.filter((_, i) => durations[i] !== null && durations[i] <= maxSeconds);

  if (reachable.length < 3) return null;

  const points = turf.featureCollection(
    reachable.map(s => turf.point([s.longitude, s.latitude]))
  );

  const hull = turf.concave(points, { maxEdge: 2 }) || turf.convex(points);
  return hull; // GeoJSON Feature<Polygon> or null
}

function computeIntersection(polygon1, polygon2) {
  if (!polygon1 || !polygon2) return null;
  try {
    return turf.intersect(polygon1, polygon2);
  } catch {
    return null;
  }
}

function geoJsonToGooglePath(polygon) {
  // polygon is GeoJSON Feature<Polygon>
  const coords = polygon.geometry.coordinates[0]; // outer ring
  return coords.map(([lng, lat]) => ({ lat, lng }));
}
