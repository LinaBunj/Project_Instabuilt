/**
 * InstaBuilt — 3D scene setup (scene, camera, renderer, lighting).
 * ES module; imported by house-designer.js.
 */
import * as THREE from 'three';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xededeb);
  scene.fog = new THREE.Fog(0xededeb, 40, 140);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  camera.position.set(14, 9, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8b95a5, 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(14, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0xe3e2dd, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let running = false;
  let rafId = 0;
  let onFrame = null;

  function start(cb) {
    onFrame = cb || null;
    if (running) return;
    running = true;
    const loop = function () {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (onFrame) onFrame(dt);
      renderer.render(scene, camera);
    };
    loop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function dispose() {
    stop();
    window.removeEventListener('resize', resize);
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return { scene, camera, renderer, container, resize, start, stop, dispose };
}
