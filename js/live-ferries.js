const liveFerryLayer = createLiveVehicleLayer({
  modes: ['FERRY'],
  pollMs: 20000,
  iconColor: '#4dd0e1',
  clusterColor: '#00838f',
  buttonId: 'live-ferries-toggle-btn',
  statusId: 'live-ferries-status',
  buttonLabel: '⛴️ Live ferge',
  buttonTitle: 'Vis/skjul sanntidsferger i kartutsnittet',
  bottomPx: 240,
  noun: 'ferger',
  nounPlural: 'ferger',
});
