import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

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

map.on('load', () => applyPastel(map));