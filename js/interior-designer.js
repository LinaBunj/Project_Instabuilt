/**
 * InstaBuilt — interior designer (furniture placement).
 *
 * A furniture catalogue the client uses to furnish the house interior:
 *   - pick an item, click the floor to place it (orbit mode)
 *   - "Erase" tool removes an item on click
 * Items persist in their own group (they survive exterior changes), provide
 * AABB colliders for the walkthrough, and lamps add real point lights.
 */
import * as THREE from 'three';
import { DIMS } from './models-config.js';

const FLOOR_TOP = DIMS.slabThickness + 0.06; // top of the interior floor

function std(color, opts) {
  const m = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide });
  if (opts) {
    if (opts.roughness != null) m.roughness = opts.roughness;
    if (opts.metalness != null) m.metalness = opts.metalness;
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity || 1; }
  }
  return m;
}

function box(w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

function cyl(rt, rb, h, mat, seg) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 18), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---- furniture builders (each returns a THREE.Group with userData.halfX/halfZ) ----

function group(type, halfX, halfZ) {
  const g = new THREE.Group();
  g.userData = { type: type, halfX: halfX, halfZ: halfZ };
  return g;
}

const fabric = 0x8b8f95;      // sofa / armchair
const wood = 0x9a7248;        // tables, shelves
const woodDark = 0x5d4630;
const metal = 0x3a3d42;

function sofa() {
  const g = group('couch', 1.15, 0.5);
  const m = std(fabric, { roughness: 0.9 });
  g.add(at(box(2.2, 0.35, 0.9, m), 0, 0.18, 0));
  g.add(at(box(2.2, 0.55, 0.28, m), 0, 0.55, -0.31));
  g.add(at(box(0.26, 0.6, 0.9, m), -1.0, 0.5, 0));
  g.add(at(box(0.26, 0.6, 0.9, m), 1.0, 0.5, 0));
  g.add(at(box(0.5, 0.18, 0.5, std(0xc2c6cd, { roughness: 0.9 })), -0.55, 0.5, 0.1));
  g.add(at(box(0.5, 0.18, 0.5, std(0xc2c6cd, { roughness: 0.9 })), 0.55, 0.5, 0.1));
  return g;
}

function armchair() {
  const g = group('armchair', 0.55, 0.5);
  const m = std(fabric, { roughness: 0.9 });
  g.add(at(box(0.9, 0.32, 0.9, m), 0, 0.16, 0));
  g.add(at(box(0.9, 0.55, 0.26, m), 0, 0.5, -0.32));
  g.add(at(box(0.24, 0.55, 0.9, m), -0.36, 0.45, 0));
  g.add(at(box(0.24, 0.55, 0.9, m), 0.36, 0.45, 0));
  return g;
}

function coffeeTable() {
  const g = group('coffee-table', 0.6, 0.35);
  const top = std(wood, { roughness: 0.6 });
  g.add(at(box(1.1, 0.05, 0.6, top), 0, 0.42, 0));
  const leg = std(woodDark, { roughness: 0.7 });
  [[-0.45, -0.2], [-0.45, 0.2], [0.45, -0.2], [0.45, 0.2]].forEach(function (p) {
    g.add(at(box(0.06, 0.42, 0.06, leg), p[0], 0.21, p[1]));
  });
  return g;
}

function diningTable() {
  const g = group('dining-table', 0.95, 0.55);
  g.add(at(box(1.8, 0.06, 1.0, std(wood, { roughness: 0.6 })), 0, 0.74, 0));
  const leg = std(woodDark, { roughness: 0.7 });
  [[-0.8, -0.4], [-0.8, 0.4], [0.8, -0.4], [0.8, 0.4]].forEach(function (p) {
    g.add(at(box(0.07, 0.74, 0.07, leg), p[0], 0.37, p[1]));
  });
  return g;
}

function chair() {
  const g = group('chair', 0.28, 0.28);
  const m = std(wood, { roughness: 0.6 });
  g.add(at(box(0.45, 0.05, 0.45, m), 0, 0.45, 0));
  g.add(at(box(0.45, 0.5, 0.06, m), 0, 0.72, -0.2));
  const leg = std(woodDark, { roughness: 0.7 });
  [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]].forEach(function (p) {
    g.add(at(box(0.05, 0.45, 0.05, leg), p[0], 0.22, p[1]));
  });
  return g;
}

function bed() {
  const g = group('bed', 0.85, 1.05);
  g.add(at(box(1.6, 0.28, 2.0, std(woodDark, { roughness: 0.7 })), 0, 0.14, 0));
  g.add(at(box(1.5, 0.2, 1.9, std(0xdadde2, { roughness: 0.9 })), 0, 0.38, 0));
  g.add(at(box(1.4, 0.16, 0.4, std(0xf2f2f2, { roughness: 0.9 })), 0, 0.52, -0.72));
  return g;
}

function wardrobe() {
  const g = group('wardrobe', 0.85, 0.35);
  g.add(at(box(1.6, 2.0, 0.6, std(0x6f5a45, { roughness: 0.7 })), 0, 1.0, 0));
  return g;
}

function bookshelf() {
  const g = group('bookshelf', 0.65, 0.22);
  g.add(at(box(1.2, 1.8, 0.35, std(0x6f5a45, { roughness: 0.7 })), 0, 0.9, 0));
  const shelf = std(0x4a3b2c, { roughness: 0.8 });
  for (let i = 0; i < 4; i++) g.add(at(box(1.1, 0.05, 0.32, shelf), 0, 0.25 + i * 0.4, 0));
  return g;
}

function tv() {
  const g = group('tv', 0.75, 0.28);
  g.add(at(box(1.4, 0.4, 0.35, std(woodDark, { roughness: 0.7 })), 0, 0.2, 0));
  g.add(at(box(1.3, 0.75, 0.05, std(0x0c0e12, { roughness: 0.3, emissive: 0x1a2030, emissiveIntensity: 0.4 })), 0, 0.82, 0));
  return g;
}

function floorLamp() {
  const g = group('floor-lamp', 0.2, 0.2);
  const m = std(metal, { roughness: 0.4, metalness: 0.7 });
  g.add(at(cyl(0.18, 0.18, 0.04, m), 0, 0.02, 0));
  g.add(at(cyl(0.025, 0.025, 1.5, m), 0, 0.77, 0));
  g.add(at(cyl(0.22, 0.12, 0.34, std(0xd8d4c8, { roughness: 0.9 })), 0, 1.62, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), std(0xfff2c0, { emissive: 0xffe27a, emissiveIntensity: 1.4 })), 0, 1.45, 0));
  const light = new THREE.PointLight(0xffe2b0, 1.6, 9, 2);
  light.position.set(0, 1.42, 0);
  light.castShadow = false;
  g.add(light);
  return g;
}

function tableLamp() {
  const g = group('table-lamp', 0.14, 0.14);
  g.add(at(cyl(0.1, 0.1, 0.03, std(metal, { roughness: 0.4, metalness: 0.7 })), 0, 0.015, 0));
  g.add(at(cyl(0.14, 0.08, 0.22, std(0xd8d4c8, { roughness: 0.9 })), 0, 0.2, 0));
  const light = new THREE.PointLight(0xffe2b0, 1.2, 6, 2);
  light.position.set(0, 0.35, 0);
  light.castShadow = false;
  g.add(light);
  return g;
}

function rug() {
  const g = group('rug', 0, 0); // no collision
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), std(0xb9b3a4, { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.01;
  rug.receiveShadow = true;
  g.add(rug);
  return g;
}

function plant() {
  const g = group('plant', 0.25, 0.25);
  g.add(at(cyl(0.18, 0.13, 0.35, std(0xa06a4a, { roughness: 0.9 })), 0, 0.18, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), std(0x5a7a3a, { roughness: 0.9 })), 0, 0.6, 0));
  return g;
}

function kitchenCounter() {
  const g = group('kitchen-counter', 1.05, 0.38);
  g.add(at(box(2.0, 0.85, 0.65, std(0xe8e4dc, { roughness: 0.8 })), 0, 0.425, 0));
  g.add(at(box(2.1, 0.06, 0.7, std(0x6b7c3f, { roughness: 0.5 })), 0, 0.88, 0));
  return g;
}

function bathpod() {
  const g = group('bathpod', 0.55, 0.85);
  g.add(at(box(1.0, 0.5, 1.6, std(0xdfe3e8, { roughness: 0.5 })), 0, 0.25, 0));
  g.add(at(box(1.04, 0.04, 1.64, std(0xc3c9cf, { roughness: 0.4 })), 0, 0.5, 0));
  return g;
}

const CATALOG = [
  { id: 'couch', label: 'Sofa', build: sofa },
  { id: 'armchair', label: 'Armchair', build: armchair },
  { id: 'coffee-table', label: 'Coffee table', build: coffeeTable },
  { id: 'dining-table', label: 'Dining table', build: diningTable },
  { id: 'chair', label: 'Chair', build: chair },
  { id: 'bed', label: 'Bed', build: bed },
  { id: 'wardrobe', label: 'Wardrobe', build: wardrobe },
  { id: 'bookshelf', label: 'Bookshelf', build: bookshelf },
  { id: 'tv', label: 'TV', build: tv },
  { id: 'floor-lamp', label: 'Floor lamp', build: floorLamp },
  { id: 'table-lamp', label: 'Table lamp', build: tableLamp },
  { id: 'rug', label: 'Rug', build: rug },
  { id: 'plant', label: 'Plant', build: plant },
  { id: 'kitchen-counter', label: 'Kitchen', build: kitchenCounter },
  { id: 'bathpod', label: 'Bathpod', build: bathpod }
];

export const FURNITURE_CATALOG = CATALOG;

export function createInteriorDesigner(scene, furnitureGroup, domElement, camera) {
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP);
  const items = []; // { id, type, group }
  let tool = null; // { kind: 'place', id } | { kind: 'erase' }
  let ghost = null;
  let bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const pointer = new THREE.Vector2();

  function buildDef(id) {
    const def = CATALOG.find(function (d) { return d.id === id; });
    return def ? def.build() : null;
  }

  function setGhostTransparent(g) {
    g.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(function (m) { m.transparent = true; m.opacity = 0.45; });
        }
      }
      if (o.isLight) o.visible = false;
    });
  }

  function makeGhost(id) {
    if (ghost) { scene.remove(ghost); ghost = null; }
    const g = buildDef(id);
    if (!g) return;
    setGhostTransparent(g);
    scene.add(g);
    ghost = g;
  }

  function placeAt(id, x, z) {
    const g = buildDef(id);
    if (!g) return;
    g.position.set(x, FLOOR_TOP, z);
    furnitureGroup.add(g);
    items.push({ id: id, type: id, group: g });
    return g;
  }

  function removeItem(g) {
    const idx = items.findIndex(function (it) { return it.group === g; });
    if (idx >= 0) items.splice(idx, 1);
    furnitureGroup.remove(g);
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
    });
  }

  function raycastFloor(e) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(floorPlane, hit) ? hit : null;
  }

  function raycastFurniture(e) {
    const rect = domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = [];
    items.forEach(function (it) { it.group.traverse(function (o) { if (o.isMesh) meshes.push(o); }); });
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    // climb to the owning furniture group
    let obj = hits[0].object;
    while (obj && !obj.userData.type) obj = obj.parent;
    return obj || null;
  }

  function clampToBounds(v) {
    const m = 0.25;
    v.x = THREE.MathUtils.clamp(v.x, bounds.minX + m, bounds.maxX - m);
    v.z = THREE.MathUtils.clamp(v.z, bounds.minZ + m, bounds.maxZ - m);
    return v;
  }

  function setTool(t) { tool = t; }

  function onPointerMove(e) {
    if (!tool || tool.kind !== 'place' || !ghost) return;
    const hit = raycastFloor(e);
    if (!hit) { ghost.visible = false; return; }
    ghost.visible = true;
    clampToBounds(hit);
    ghost.position.set(hit.x, FLOOR_TOP, hit.z);
  }

  let downX = 0, downY = 0;
  function onPointerDown(e) { downX = e.clientX; downY = e.clientY; }
  function onPointerUp(e) {
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (dx * dx + dy * dy > 36) return; // was a drag (orbit), not a click
    if (!tool) return;
    if (tool.kind === 'place') {
      const hit = raycastFloor(e);
      if (!hit) return;
      clampToBounds(hit);
      placeAt(tool.id, hit.x, hit.z);
    } else if (tool.kind === 'erase') {
      const g = raycastFurniture(e);
      if (g) removeItem(g);
    }
  }

  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointerup', onPointerUp);

  return {
    catalog: CATALOG,
    setTool: setTool,
    getTool: function () { return tool; },
    placeAt: placeAt,
    clearGhost: function () { if (ghost) { scene.remove(ghost); ghost = null; } },
    setBounds: function (b) { bounds = b; },
    clampAll: function () {
      items.forEach(function (it) {
        const p = clampToBounds(it.group.position);
        it.group.position.set(p.x, FLOOR_TOP, p.z);
      });
    },
    colliders: function () {
      const out = [];
      items.forEach(function (it) {
        const hx = it.group.userData.halfX, hz = it.group.userData.halfZ;
        if (!hx && !hz) return;
        const p = it.group.position;
        out.push({ minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz });
      });
      return out;
    },
    summary: function () {
      const counts = {};
      items.forEach(function (it) {
        const def = CATALOG.find(function (d) { return d.id === it.id; });
        const label = def ? def.label : it.id;
        counts[label] = (counts[label] || 0) + 1;
      });
      return Object.keys(counts).map(function (k) { return k + ' ×' + counts[k]; });
    },
    dispose: function () {
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointerup', onPointerUp);
    }
  };
}
