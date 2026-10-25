const liveBusLayer = createLiveVehicleLayer({
  modes: ['BUS', 'COACH'],
  pollMs: 20000,
  iconColor: '#fbbc04',
  clusterColor: '#1a73e8',
  buttonId: 'live-buses-toggle-btn',
  statusId: 'live-buses-status',
  buttonLabel: '🚌 Live buss',
  buttonTitle: 'Vis/skjul sanntidsbusser i kartutsnittet',
  order: 4,
  noun: 'busser',
  nounPlural: 'busser',
});
