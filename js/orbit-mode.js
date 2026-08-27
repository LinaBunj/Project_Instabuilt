/**
 * InstaBuilt — orbit mode (rotate / pan / zoom around the exterior).
 * Wraps OrbitControls; exposes enable / disable / resetView.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createOrbitMode(scene, camera, renderer) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minPolarAngle = 0.05;
  controls.target.set(0, 1.5, 0);
  controls.update();

  const defaults = {
    pos: camera.position.clone(),
    target: controls.target.clone()
  };

  function resetView() {
    camera.position.copy(defaults.pos);
    controls.target.copy(defaults.target);
    controls.update();
  }

  return {
    controls,
    enable: function () { controls.enabled = true; },
    disable: function () { controls.enabled = false; },
    update: function () { controls.update(); },
    setTarget: function (v) { controls.target.copy(v); controls.update(); },
    setDefaults: function (pos, target) {
      defaults.pos.copy(pos);
      defaults.target.copy(target);
      controls.target.copy(target);
      controls.update();
    },
    resetView: resetView,
    dispose: function () { controls.dispose(); }
  };
}
