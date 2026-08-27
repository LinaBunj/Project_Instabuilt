/**
 * InstaBuilt — procedural placeholder house + material/part swapping.
 *
 * Builds a stylised house from Three.js primitives (floor, walls, roof, door,
 * windows, interior accents, smart-home visuals) and rebuilds it live as the
 * user changes options. This is the placeholder model; real .glb files can be
 * swapped in later via a GLTFLoader branch keyed off models-config.js.
 */
import * as THREE from 'three';
import { DIMS } from './models-config.js';

export function createHouse() {
  const group = new THREE.Group();
  group.name = 'house';
  return group;
}

function disposeTree(obj) {
  obj.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

function mat(color, opts) {
  const m = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });
  if (opts) {
    if (opts.roughness != null) m.roughness = opts.roughness;
    if (opts.metalness != null) m.metalness = opts.metalness;
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity || 1; }
  }
  return m;
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Rebuild the house to match the resolved config. */
export function render(house, config) {
  disposeTree(house);
  house.clear();

  const { width, depth, material, interior, smart } = config;
  const storeys = config.line.storeys;
  const wallH = DIMS.wallHeight * storeys;
  const t = DIMS.wallThickness;
  const isGable = config.line.shape === 'gable';

  // Slab
  const slabMat = mat(0x8a8a8a, { roughness: 0.9 });
  const slab = box(width + t * 2, DIMS.slabThickness, depth + t * 2, slabMat);
  slab.position.y = DIMS.slabThickness / 2;
  house.add(slab);

  // Walls
  const wallMat = mat(material.wall, { roughness: material.roughness, metalness: material.metalness });
  const walls = [
    { sx: width, sz: t, px: 0, pz: depth / 2 },
    { sx: width, sz: t, px: 0, pz: -depth / 2 },
    { sx: t, sz: depth, px: width / 2, pz: 0 },
    { sx: t, sz: depth, px: -width / 2, pz: 0 }
  ];
  walls.forEach(function (s) {
    const m = box(s.sx, wallH, s.sz, wallMat);
    m.position.set(s.px, wallH / 2, s.pz);
    house.add(m);
  });

  // Storey band lines
  if (storeys > 1) {
    for (let i = 1; i < storeys; i++) {
      const band = box(width + t, 0.06, depth + t, mat(0x333333, { roughness: 0.8 }));
      band.position.y = i * DIMS.wallHeight;
      house.add(band);
    }
  }

  // Roof
  const roofMat = mat(0x2b2b2b, { roughness: 0.7, metalness: 0.2 });
  const over = DIMS.roofFlatOverhang;
  if (isGable) {
    const rh = DIMS.roofGableHeight;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 - over, 0);
    shape.lineTo(width / 2 + over, 0);
    shape.lineTo(0, rh);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: depth + over * 2, bevelEnabled: false });
    geom.translate(0, 0, -(depth + over * 2) / 2);
    const gable = new THREE.Mesh(geom, roofMat);
    gable.position.y = wallH;
    gable.castShadow = true;
    gable.receiveShadow = true;
    house.add(gable);
  } else {
    const slab2 = box(width + over * 2, 0.28, depth + over * 2, roofMat);
    slab2.position.y = wallH + 0.14;
    house.add(slab2);
    const parapet = box(width + over * 2 + 0.1, 0.35, depth + over * 2 + 0.1, roofMat);
    parapet.position.y = wallH + 0.05;
    house.add(parapet);
  }

  // Door
  const doorMat = mat(0x4d5c2b, { roughness: 0.6 });
  const door = box(1.0, 2.1, 0.06, doorMat);
  door.position.set(width / 2 - 1.6, 1.05, depth / 2 + t / 2 + 0.03);
  house.add(door);

  // Windows
  const winFrameMat = mat(0x1a1a1a, { roughness: 0.5 });
  const winGlassMat = mat(0x22303f, { roughness: 0.3, metalness: 0.6 });
  const winYs = storeys >= 2 ? [1.6, 1.6 + DIMS.wallHeight] : [1.6];
  function addWindow(px, py, pz, ry) {
    const frame = box(1.48, 1.38, 0.08, winFrameMat);
    const glass = box(1.4, 1.3, 0.04, winGlassMat);
    frame.position.set(px, py, pz);
    glass.position.set(px, py, pz);
    if (ry) { frame.rotation.y = ry; glass.rotation.y = ry; }
    house.add(frame);
    house.add(glass);
  }
  winYs.forEach(function (y) {
    addWindow(-width / 2 + 2.2, y, depth / 2 + t / 2 + 0.03, 0);
    addWindow(width / 2 - 2.2, y, depth / 2 + t / 2 + 0.03, 0);
    addWindow(width / 2 + t / 2 + 0.03, y, 0, Math.PI / 2);
    addWindow(-width / 2 - t / 2 - 0.03, y, 0, Math.PI / 2);
  });

  // Interior floor
  const floorMat = mat(interior.floor, { roughness: 0.6 });
  const ifloor = box(width - t * 2 - 0.1, 0.06, depth - t * 2 - 0.1, floorMat);
  ifloor.position.y = DIMS.slabThickness + 0.03;
  ifloor.castShadow = false;
  house.add(ifloor);

  // Interior accents per package (3D furniture is placed via the interior
  // designer; the package here only drives the floor finish colour).
  const ceilingLight = new THREE.PointLight(0xffe8c0, 3.2, 24, 1);
  ceilingLight.position.set(0, wallH - 0.4, 0);
  ceilingLight.castShadow = false;
  house.add(ceilingLight);

  // Smart-home visuals
  smart.forEach(function (s) {
    if (s.visual === 'solar') {
      const panel = box(2.0, 0.05, 1.2, mat(0x1b2a44, { roughness: 0.2, metalness: 0.8 }));
      panel.position.set(0, wallH + (isGable ? DIMS.roofGableHeight / 2 : 0.35) + 0.06, depth / 4);
      panel.rotation.x = isGable ? -0.35 : -0.1;
      house.add(panel);
    }
    if (s.visual === 'battery') {
      const bat = box(0.7, 1.1, 0.3, mat(0xffffff, { roughness: 0.4 }));
      bat.position.set(width / 2 + 0.35, DIMS.slabThickness + 0.55, -depth / 2 + 1.2);
      house.add(bat);
    }
    if (s.visual === 'light') {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        mat(0xfff2b0, { emissive: 0xffe27a, emissiveIntensity: 1.2 })
      );
      bulb.position.set(0, wallH - 0.3, 0);
      house.add(bulb);
    }
  });
}

/** Collision bounds for the walkthrough camera (interior rectangle). */
export function interiorBounds(config) {
  const t = DIMS.wallThickness;
  return {
    minX: -config.width / 2 + t,
    maxX: config.width / 2 - t,
    minZ: -config.depth / 2 + t,
    maxZ: config.depth / 2 - t,
    eyeY: DIMS.eyeHeight
  };
}
