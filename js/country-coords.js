// ─── Country coordinates for the admin listener map ───────────
// Exposed as window.countryCoords (for non-module scripts) AND
// as a named ES export (for any future module consumers).
// ──────────────────────────────────────────────────────────────

const _coords = {
  "Afghanistan":      [33.9391, 67.7100],
  "Australia":        [-25.2744, 133.7751],
  "Brazil":           [-14.2350, -51.9253],
  "Canada":           [56.1304, -106.3468],
  "China":            [35.8617, 104.1954],
  "DR Congo":         [-4.0383, 21.7587],
  "Egypt":            [26.8205, 30.8025],
  "Ethiopia":         [9.1450, 40.4897],
  "France":           [46.6034, 1.8883],
  "Germany":          [51.1657, 10.4515],
  "Ghana":            [7.9465, -1.0232],
  "India":            [20.5937, 78.9629],
  "Indonesia":        [-0.7893, 113.9213],
  "Italy":            [41.8719, 12.5674],
  "Japan":            [36.2048, 138.2529],
  "Kenya":            [-0.0236, 37.9062],
  "Mexico":           [23.6345, -102.5528],
  "Netherlands":      [52.1326, 5.2913],
  "Nigeria":          [9.0820, 8.6753],
  "Pakistan":         [30.3753, 69.3451],
  "Philippines":      [12.8797, 121.7740],
  "Russia":           [61.5240, 105.3188],
  "Saudi Arabia":     [23.8859, 45.0792],
  "South Africa":     [-30.5595, 22.9375],
  "Spain":            [40.4637, -3.7492],
  "Sweden":           [60.1282, 18.6435],
  "Tanzania":         [-6.3690, 34.8888],
  "Uganda":           [1.3733, 32.2903],
  "United Kingdom":   [55.3781, -3.4360],
  "United States":    [37.0902, -95.7129],
  "Unknown":          [0, 0],
  "Zimbabwe":         [-19.0154, 29.1549]
};

// Always available on window for non-module admin.js
window.countryCoords = _coords;

// Named export for any future ES module consumers
export const countryCoords = _coords;
