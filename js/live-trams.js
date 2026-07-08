const liveTramLayer = createLiveVehicleLayer({
  mode: 'tram',
  endpoint: 'https://api.entur.io/realtime/v1/rest/vm?maxSize=10000',
  pollMs: 20000,
  iconColor: '#f06292',
  clusterColor: '#c2185b',
  buttonId: 'live-trams-toggle-btn',
  statusId: 'live-trams-status',
  buttonLabel: '🚋 Live trikk',
  buttonTitle: 'Vis/skjul sanntidstrikker i kartutsnittet',
  bottomPx: 240,
  noun: 'trikk',
  nounPlural: 'trikker',
});
