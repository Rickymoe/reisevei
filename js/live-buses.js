// maxSize raised well above the national vehicle count (~3000 as of 2026-07):
// the endpoint silently caps at 1000 activities by default and reports
// MoreData:true instead of erroring, so an unset maxSize can make vehicles
// vanish for zones outside whatever slice happened to come back.
const liveBusLayer = createLiveVehicleLayer({
  mode: 'bus',
  endpoint: 'https://api.entur.io/realtime/v1/rest/vm?maxSize=10000',
  pollMs: 20000,
  iconColor: '#fbbc04',
  clusterColor: '#1a73e8',
  buttonId: 'live-buses-toggle-btn',
  statusId: 'live-buses-status',
  buttonLabel: '🚌 Live buss',
  buttonTitle: 'Vis/skjul sanntidsbusser i kollektivsonen',
  bottomPx: 140,
  noun: 'busser',
  nounPlural: 'busser',
});
