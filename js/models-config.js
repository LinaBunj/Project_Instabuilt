/**
 * InstaBuilt — 3D configurator: preset → 3D mapping (pure data, no Three.js).
 *
 * Maps each selectable option to (a) the visual params the 3D scene uses and
 * (b) the persisted `house_designs` payload fields (product_line / size /
 * materials / interior_selections) so price-calculator.js keeps working
 * unchanged.
 *
 * To swap in real .glb models later: add a `glb` path to a product line and
 * handle it in house-configurator.js (GLTFLoader branch) — nothing else moves.
 */

export const PRODUCT_LINES = [
  { id: 'popup',       label: 'POP UP Solutions',       shape: 'flat',  storeys: 1, sizes: ['28 m²', '52 m²', '104 m²'] },
  { id: 'multifamily', label: 'Multistory Multifamily', shape: 'flat',  storeys: 3, sizes: ['150 m²', '250 m²', '500 m²'] },
  { id: 'senior',      label: 'Senior Housing',         shape: 'flat',  storeys: 2, sizes: ['52 m²', '104 m²', '150 m²'] },
  { id: 'micro',       label: 'Micro Apartments',       shape: 'flat',  storeys: 1, sizes: ['28 m²', '52 m²'] },
  { id: 'traditional', label: 'Traditional Homes',      shape: 'gable', storeys: 2, sizes: ['104 m²', '150 m²', '250 m²'] },
  { id: 'signature',   label: 'Signature Homes',        shape: 'gable', storeys: 2, sizes: ['150 m²', '250 m²', '500 m²'] },
  { id: 'bathpods',    label: 'Bathpods',               shape: 'flat',  storeys: 1, sizes: ['10 m²'] }
];

// `key` is the priced material label consumed by price-calculator.js;
// `token` is the persisted colour name; `wall` is the 3D tint.
export const MATERIALS = [
  { id: 'render-white',    label: 'Render — White',    key: 'Render',     token: 'White',    wall: 0xf2f1ec, metalness: 0.0,  roughness: 0.9 },
  { id: 'render-sand',     label: 'Render — Sand',     key: 'Render',     token: 'Sand',     wall: 0xe6dfce, metalness: 0.0,  roughness: 0.9 },
  { id: 'timber-natural',  label: 'Timber — Natural',  key: 'Timber',     token: 'Natural',  wall: 0xb0895c, metalness: 0.0,  roughness: 0.75 },
  { id: 'timber-charcoal', label: 'Timber — Charcoal', key: 'Timber',     token: 'Charcoal', wall: 0x4a423a, metalness: 0.0,  roughness: 0.75 },
  { id: 'brick-red',       label: 'Brick-slip — Red',  key: 'Brick-slip', token: 'Red',      wall: 0xa85a4a, metalness: 0.0,  roughness: 0.85 },
  { id: 'metal-graphite',  label: 'Metal — Graphite',  key: 'Metal',      token: 'Graphite', wall: 0x6b7078, metalness: 0.65, roughness: 0.4 }
];

export const INTERIOR_PACKAGES = [
  { id: 'standard', label: 'Standard', items: [],                                                                 floor: 0xcfccc3, accent: null },
  { id: 'comfort',  label: 'Comfort',  items: ['Full kitchen', 'Oak flooring'],                                    floor: 0xb48a5a, accent: 'kitchen' },
  { id: 'premium',  label: 'Premium',  items: ['Full kitchen', 'Premium Bathpod', 'Oak flooring', 'Underfloor heating'], floor: 0x9b7a52, accent: 'kitchen+bath' }
];

export const SMART_HOME = [
  { id: 'smart',   label: 'Smart-home package', priced: 'Smart-home package', visual: 'light' },
  { id: 'solar',   label: 'Solar roof',         priced: null,                 visual: 'solar' },
  { id: 'battery', label: 'Battery storage',    priced: null,                 visual: 'battery' }
];

export const DIMS = {
  wallHeight: 2.7,
  wallThickness: 0.24,
  slabThickness: 0.25,
  roofFlatOverhang: 0.4,
  roofGableHeight: 1.7,
  eyeHeight: 1.6
};

export function parseArea(size) {
  const m = /(\d+(?:\.\d+)?)/.exec(String(size || ''));
  return m ? parseFloat(m[1]) : 0;
}

/** Resolve the current UI selection into one config object for the 3D scene. */
export function resolveConfig(selection) {
  const line = PRODUCT_LINES.find((l) => l.label === selection.productLine) || PRODUCT_LINES[0];
  const area = parseArea(selection.size);
  const material = MATERIALS.find((m) => m.id === selection.materialId) || MATERIALS[0];
  const interior = INTERIOR_PACKAGES.find((p) => p.id === selection.interiorId) || INTERIOR_PACKAGES[0];
  const smart = (selection.smartIds || []).map((id) => SMART_HOME.find((s) => s.id === id)).filter(Boolean);

  const perStorey = area / line.storeys;
  const depth = Math.sqrt(perStorey / 1.4);
  const width = depth * 1.4;

  return { line, area, material, interior, smart, width, depth };
}

/** Build the persisted `house_designs` payload (selected options only). */
export function toSavePayload(sessionUserId, selection) {
  const line = PRODUCT_LINES.find((l) => l.label === selection.productLine) || PRODUCT_LINES[0];
  const material = MATERIALS.find((m) => m.id === selection.materialId) || MATERIALS[0];
  const interior = INTERIOR_PACKAGES.find((p) => p.id === selection.interiorId) || INTERIOR_PACKAGES[0];
  const smart = (selection.smartIds || []).map((id) => SMART_HOME.find((s) => s.id === id)).filter(Boolean);

  const materials = [material.key, material.token];
  const interiorSelections = interior.items.slice();
  smart.forEach((s) => interiorSelections.push(s.label));

  return {
    user_id: sessionUserId,
    product_line: line.label,
    size: selection.size,
    materials: materials,
    interior_selections: interiorSelections
  };
}
