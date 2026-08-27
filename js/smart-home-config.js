/**
 * InstaBuilt — smart-home feature catalogue (shared data, no UI).
 *
 * Imported by the smart-home configurator (to render rooms/features) and by
 * the price / energy calculators (to apply per-feature cost and efficiency).
 * Keep prices and energy multipliers in sync with real figures here.
 *
 * `energyMult` < 1 reduces estimated energy consumption (e.g. 0.90 = −10%).
 * `control` selects the mock control shown in the preview panel.
 */

export const CATEGORIES = [
  'Lighting',
  'Heating & Cooling',
  'Garden Irrigation',
  'Security',
  'Entertainment',
  'Climate Sensors'
];

// Rooms drawn on the top-down floor plan (SVG viewBox 0 0 360 330).
export const ROOMS = [
  { id: 'living',   label: 'Living Room', x: 20,  y: 20,  w: 180, h: 130, garden: false },
  { id: 'kitchen',  label: 'Kitchen',     x: 200, y: 20,  w: 140, h: 130, garden: false },
  { id: 'bedroom',  label: 'Bedroom',     x: 20,  y: 150, w: 180, h: 110, garden: false },
  { id: 'bathroom', label: 'Bathroom',    x: 200, y: 150, w: 140, h: 110, garden: false },
  { id: 'garden',   label: 'Garden',      x: 20,  y: 270, w: 320, h: 50,  garden: true }
];

export const FEATURES = [
  // Living Room
  { id: 'lr-lights',     room: 'living',   category: 'Lighting',          label: 'Smart lighting',   price: 850,  energyMult: 1.0,  control: 'light' },
  { id: 'lr-scenes',     room: 'living',   category: 'Lighting',          label: 'Ambience scenes',  price: 300,  energyMult: 1.0,  control: 'toggle' },
  { id: 'lr-thermostat', room: 'living',   category: 'Heating & Cooling', label: 'Smart thermostat',  price: 1200, energyMult: 0.90, control: 'thermostat' },
  { id: 'lr-tv',         room: 'living',   category: 'Entertainment',     label: 'Smart TV',         price: 600,  energyMult: 1.0,  control: 'entertainment' },
  { id: 'lr-speaker',    room: 'living',   category: 'Entertainment',     label: 'Smart speaker',    price: 250,  energyMult: 1.0,  control: 'entertainment' },
  { id: 'lr-sensor',     room: 'living',   category: 'Climate Sensors',   label: 'Climate sensor',   price: 180,  energyMult: 0.97, control: 'sensor' },

  // Bedroom
  { id: 'br-lights',     room: 'bedroom',  category: 'Lighting',          label: 'Smart lighting',   price: 600,  energyMult: 1.0,  control: 'light' },
  { id: 'br-blinds',     room: 'bedroom',  category: 'Lighting',          label: 'Blackout blinds',  price: 400,  energyMult: 1.0,  control: 'toggle' },
  { id: 'br-valve',      room: 'bedroom',  category: 'Heating & Cooling', label: 'Radiator valve',   price: 450,  energyMult: 0.96, control: 'thermostat' },
  { id: 'br-speaker',    room: 'bedroom',  category: 'Entertainment',     label: 'Smart speaker',    price: 250,  energyMult: 1.0,  control: 'entertainment' },
  { id: 'br-sensor',     room: 'bedroom',  category: 'Climate Sensors',   label: 'Climate sensor',   price: 180,  energyMult: 0.97, control: 'sensor' },

  // Kitchen
  { id: 'kt-lights',     room: 'kitchen',  category: 'Lighting',          label: 'Smart lighting',   price: 550,  energyMult: 1.0,  control: 'light' },
  { id: 'kt-thermostat', room: 'kitchen',  category: 'Heating & Cooling', label: 'Smart thermostat',  price: 600,  energyMult: 0.95, control: 'thermostat' },
  { id: 'kt-display',    room: 'kitchen',  category: 'Entertainment',     label: 'Smart display',    price: 350,  energyMult: 1.0,  control: 'entertainment' },
  { id: 'kt-smoke',      room: 'kitchen',  category: 'Security',          label: 'Smoke & leak sensor', price: 220, energyMult: 1.0,  control: 'sensor' },
  { id: 'kt-sensor',     room: 'kitchen',  category: 'Climate Sensors',   label: 'Climate sensor',   price: 180,  energyMult: 0.97, control: 'sensor' },

  // Bathroom
  { id: 'ba-mirror',     room: 'bathroom', category: 'Lighting',          label: 'Mirror lighting',  price: 300,  energyMult: 1.0,  control: 'light' },
  { id: 'ba-floor',      room: 'bathroom', category: 'Heating & Cooling', label: 'Heated floor',     price: 900,  energyMult: 0.97, control: 'thermostat' },
  { id: 'ba-humidity',   room: 'bathroom', category: 'Climate Sensors',   label: 'Humidity sensor',  price: 150,  energyMult: 0.97, control: 'sensor' },

  // Garden
  { id: 'ga-lawn',       room: 'garden',   category: 'Garden Irrigation', label: 'Lawn irrigation',   price: 1200, energyMult: 1.0,  control: 'irrigation' },
  { id: 'ga-planter',    room: 'garden',   category: 'Garden Irrigation', label: 'Planter drip line', price: 500,  energyMult: 1.0,  control: 'irrigation' },
  { id: 'ga-camera',     room: 'garden',   category: 'Security',          label: 'Outdoor camera',   price: 450,  energyMult: 1.0,  control: 'camera' },
  { id: 'ga-lock',       room: 'garden',   category: 'Security',          label: 'Smart gate lock',  price: 600,  energyMult: 1.0,  control: 'lock' },
  { id: 'ga-lights',     room: 'garden',   category: 'Lighting',          label: 'Outdoor lighting', price: 400,  energyMult: 1.0,  control: 'light' }
];

export const FEATURE_BY_ID = FEATURES.reduce(function (m, f) { m[f.id] = f; return m; }, {});

export const CONTROL_ICON = {
  light: '💡',
  thermostat: '🌡️',
  camera: '📷',
  irrigation: '💧',
  lock: '🔒',
  sensor: '📈',
  entertainment: '📺',
  toggle: '🔘'
};
