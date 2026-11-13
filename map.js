import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);

mapboxgl.accessToken = 'pk.eyJ1Ijoic2FkaGFuYXQiLCJhIjoiY213ZWVqMTJyMGRxcjMwb20wazcyeDJyMSJ9.o83Cx6L0QzkwhS5jlNMpYQ';

const map = new mapboxgl.Map({
  container: 'map',                              // id of the div
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-71.09415, 42.36027],                 // [longitude, latitude] — Boston/Cambridge
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// 🎨 Pastel palette
const PASTEL = {
  land:      '#fdf6f0', // cream
  water:     '#bde0fe', // baby blue
  park:      '#caffbf', // mint
  building:  '#ffd6e0', // blush pink
  road:      '#ffffff', // white
  majorRoad: '#ffe5b4', // peach
  label:     '#8a7f99', // soft lavender-gray
};

// Which paint property holds the color for each layer type
const COLOR_PROP = {
  background: 'background-color',
  fill: 'fill-color',
  line: 'line-color',
  'fill-extrusion': 'fill-extrusion-color',
  symbol: 'text-color',
};

function applyPastel(map) {
  for (const layer of map.getStyle().layers) {
    const { id, type } = layer;
    if (id.startsWith('bike')) continue; // leave our own bike layers alone (Step 2)

    const prop = COLOR_PROP[type];
    if (!prop) continue;

    let color = null;
    if (type === 'symbol')                                 color = PASTEL.label;
    else if (type === 'background' || id === 'land')       color = PASTEL.land;
    else if (id.includes('water'))                         color = PASTEL.water;
    else if (/park|landcover|landuse|grass|wood/.test(id)) color = PASTEL.park;
    else if (id.includes('building'))                      color = PASTEL.building;
    else if (/motorway|trunk|primary/.test(id))            color = PASTEL.majorRoad;
    else if (/road|street|bridge|tunnel/.test(id))         color = PASTEL.road;

    if (color) {
      try { map.setPaintProperty(id, prop, color); } catch { /* skip layers that can't take it */ }
    }
  }
}

// Shared style for all bike lane layers (2.3 optional — one object, reused)
const bikeLaneStyle = {
  'line-color': '#b388eb', // saturated lilac — pops on pastel
  'line-width': 3,
  'line-opacity': 0.6,
};

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point); // lat/lng → pixel position on screen
  return { cx: x, cy: y };
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // midnight + N minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // e.g. "8:30 AM"
}

// 5.3 — count arrivals/departures per station for a given set of trips
function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, (v) => v.length, (d) => d.start_station_id);
  const arrivals = d3.rollup(trips, (v) => v.length, (d) => d.end_station_id);

  return stations.map((station) => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

// 5.3 — Date → minutes since midnight (e.g. 8:30 AM → 510)
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// 5.3 — keep trips that start OR end within 60 min of the selected time
function filterTripsByTime(trips, timeFilter) {
  if (timeFilter === -1) return trips; // "any time" → no filter

  return trips.filter((trip) => {
    const start = minutesSinceMidnight(trip.started_at);
    const end = minutesSinceMidnight(trip.ended_at);
    return Math.abs(start - timeFilter) <= 60 || Math.abs(end - timeFilter) <= 60;
  });
}

map.on('load', async () => {
  applyPastel(map); // recolor base map first

  // 2.1 — Boston
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: bikeLaneStyle,
  });

  // 2.3 — Cambridge
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: bikeLaneStyle,
  });

  // 3.1 — load stations
  const jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');

  // 4.1 + 5.3 — load trips, turning the time strings into real Dates
  const trips = await d3.csv(
    'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    },
  );
  console.log('Trips loaded:', trips.length);

  // 4.2 — traffic for ALL trips (starting state)
  const stations = computeStationTraffic(jsonData.data.stations, trips);

  // 4.3 — size scale
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // 3.3 — draw circles (keyed by short_name so D3 can match them on update)
  const svg = d3.select('#map').select('svg');
  let circles = svg
    .selectAll('circle')
    .data(stations, (d) => d.short_name)
    .enter()
    .append('circle')
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .each(function (d) {
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  // reposition circles whenever the map changes
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  // 5.3 — recompute + resize circles for a given time
  function updateScatterPlot(timeFilter) {
    const filteredTrips = filterTripsByTime(trips, timeFilter);
    const filteredStations = computeStationTraffic(stations, filteredTrips);

    // fewer trips when filtered → bigger range so circles stay visible
    radiusScale.range(timeFilter === -1 ? [0, 25] : [3, 50]);

    circles = svg
      .selectAll('circle')
      .data(filteredStations, (d) => d.short_name)
      .join('circle')
      .attr('r', (d) => radiusScale(d.totalTraffic));

    circles
      .select('title')
      .text((d) => `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
  }

  // 5.2 — slider → time display (+ now updates the circles)
  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function updateTimeDisplay() {
    const timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }

    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});