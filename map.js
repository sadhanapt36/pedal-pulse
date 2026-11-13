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
  const stations = jsonData.data.stations;
  console.log('Stations:', stations);

  // 3.3 — draw one circle per station
  const svg = d3.select('#map').select('svg');
  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', 5);

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
});