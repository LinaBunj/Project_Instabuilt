/**
 * InstaBuilt — walkthrough mode (first-person camera inside the house).
 *
 * Desktop: pointer-lock mouse look + WASD/arrow keys.
 * Touch: left-half drag = move, right-half drag = look.
 * Collision: the camera is clamped to the interior rectangle so the user
 * cannot walk through the walls.
 */
import * as THREE from 'three';

export function createWalkthroughMode(camera, renderer, getBounds) {
  const state = {
    enabled: false,
    locked: false,
    yaw: 0,
    pitch: 0,
    keys: {},
    moveId: null,
    lookId: null,
    moveCenter: null,
    moveX: 0,
    moveY: 0,
    lookLast: null
  };
  const SPEED = 4.0;
  const SENS = 0.0022;
  const el = renderer.domElement;

  function onLockChange() { state.locked = document.pointerLockElement === el; }
  document.addEventListener('pointerlockchange', onLockChange);

  function onMouseMove(e) {
    if (!state.enabled || !state.locked) return;
    state.yaw -= e.movementX * SENS;
    state.pitch -= e.movementY * SENS;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
  }
  document.addEventListener('mousemove', onMouseMove);

  function onKey(e) {
    if (!state.enabled) return;
    state.keys[e.code] = e.type === 'keydown';
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);

  function requestLock() {
    if (state.enabled && el.requestPointerLock) el.requestPointerLock();
  }

  function onTouchStart(e) {
    if (!state.enabled) return;
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth / 2) {
        state.moveId = t.identifier;
        state.moveCenter = { x: t.clientX, y: t.clientY };
      } else {
        state.lookId = t.identifier;
        state.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }
  function onTouchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === state.moveId && state.moveCenter) {
        state.moveX = (t.clientX - state.moveCenter.x) / 42;
        state.moveY = (t.clientY - state.moveCenter.y) / 42;
      } else if (t.identifier === state.lookId && state.lookLast) {
        state.yaw -= (t.clientX - state.lookLast.x) * 0.005;
        state.pitch -= (t.clientY - state.lookLast.y) * 0.005;
        state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
        state.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }
  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === state.moveId) { state.moveId = null; state.moveX = 0; state.moveY = 0; state.moveCenter = null; }
      if (t.identifier === state.lookId) { state.lookId = null; state.lookLast = null; }
    }
  }
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  el.addEventListener('touchend', onTouchEnd, { passive: true });

  function enable() {
    state.enabled = true;
    const b = getBounds();
    camera.position.set(0, b.eyeY, b.maxZ - 0.8);
    state.yaw = 0;
    state.pitch = 0;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0);
  }

  function disable() {
    state.enabled = false;
    state.locked = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function update(dt) {
    if (!state.enabled) return;
    const b = getBounds();

    let fwd = 0, strafe = 0;
    if (state.keys.KeyW || state.keys.ArrowUp) fwd += 1;
    if (state.keys.KeyS || state.keys.ArrowDown) fwd -= 1;
    if (state.keys.KeyA || state.keys.ArrowLeft) strafe -= 1;
    if (state.keys.KeyD || state.keys.ArrowRight) strafe += 1;
    if (state.moveX || state.moveY) { strafe += state.moveX; fwd -= state.moveY; }

    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    let dx = -sin * fwd + cos * strafe;
    let dz = -cos * fwd - sin * strafe;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx = (dx / len) * SPEED * dt;
      dz = (dz / len) * SPEED * dt;
      camera.position.x += dx;
      camera.position.z += dz;
    }

    const m = 0.25;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX + m, b.maxX - m);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ + m, b.maxZ - m);
    camera.position.y = b.eyeY;

    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  function dispose() {
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKey);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  return {
    enable: enable,
    disable: disable,
    update: update,
    dispose: dispose,
    requestLock: requestLock,
    isLocked: function () { return state.locked; }
  };
}
