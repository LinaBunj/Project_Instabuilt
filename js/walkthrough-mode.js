/**
 * InstaBuilt — walkthrough mode (first-person, game-like).
 *
 * Desktop: pointer-lock mouse look + WASD/arrows, Shift to sprint, Space to
 * jump. Touch: left-half drag = move, right-half drag = look.
 * Collision: the camera is clamped inside the room AND pushed out of furniture
 * AABBs, so the player can't walk through walls or furniture.
 */
import * as THREE from 'three';

export function createWalkthroughMode(camera, renderer, getBounds, getColliders) {
  const state = {
    enabled: false,
    locked: false,
    yaw: 0,
    pitch: 0,
    keys: {},
    velX: 0,
    velZ: 0,
    velY: 0,
    jumpY: 0,
    grounded: true,
    bobT: 0,
    moving: false,
    moveId: null,
    lookId: null,
    moveCenter: null,
    moveX: 0,
    moveY: 0,
    lookLast: null
  };
  const WALK_SPEED = 3.6;
  const SPRINT_SPEED = 6.4;
  const JUMP_VEL = 3.1;
  const GRAVITY = 9.8;
  const SENS = 0.0022;
  const PLAYER_R = 0.35;
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
    if (e.type === 'keydown' && e.code === 'Space' && state.grounded) {
      state.velY = JUMP_VEL;
      state.grounded = false;
    }
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
    state.velX = state.velZ = state.velY = 0;
    state.jumpY = 0;
    state.grounded = true;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0);
  }

  function disable() {
    state.enabled = false;
    state.locked = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function resolveColliders(x, z, colliders) {
    let px = x, pz = z;
    for (const c of colliders) {
      const cx = THREE.MathUtils.clamp(px, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(pz, c.minZ, c.maxZ);
      let dx = px - cx;
      let dz = pz - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 >= PLAYER_R * PLAYER_R) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = PLAYER_R - d;
        px += (dx / d) * push;
        pz += (dz / d) * push;
      } else {
        // player centre inside the collider: push out along smallest penetration
        const penX = Math.min(px - c.minX, c.maxX - px);
        const penZ = Math.min(pz - c.minZ, c.maxZ - pz);
        if (penX < penZ) px += (px - c.minX < c.maxX - px ? -1 : 1) * (penX + PLAYER_R);
        else pz += (pz - c.minZ < c.maxZ - pz ? -1 : 1) * (penZ + PLAYER_R);
      }
    }
    return { x: px, z: pz };
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

    const sprinting = !!(state.keys.ShiftLeft || state.keys.ShiftRight);
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    state.moving = fwd !== 0 || strafe !== 0;

    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    const targetX = (-sin * fwd + cos * strafe) * speed;
    const targetZ = (-cos * fwd - sin * strafe) * speed;

    // smooth acceleration
    const k = 1 - Math.exp(-12 * dt);
    state.velX += (targetX - state.velX) * k;
    state.velZ += (targetZ - state.velZ) * k;

    let px = camera.position.x + state.velX * dt;
    let pz = camera.position.z + state.velZ * dt;

    // furniture + wall collision
    const resolved = resolveColliders(px, pz, getColliders ? getColliders() : []);
    px = resolved.x;
    pz = resolved.z;
    const m = 0.25;
    px = THREE.MathUtils.clamp(px, b.minX + m, b.maxX - m);
    pz = THREE.MathUtils.clamp(pz, b.minZ + m, b.maxZ - m);

    camera.position.x = px;
    camera.position.z = pz;

    // jump / gravity
    if (!state.grounded) {
      state.velY -= GRAVITY * dt;
      state.jumpY += state.velY * dt;
      if (state.jumpY <= 0) { state.jumpY = 0; state.velY = 0; state.grounded = true; }
    }

    // head bob
    let bob = 0;
    if (state.moving && state.grounded) {
      state.bobT += dt * (sprinting ? 11 : 8);
      bob = Math.sin(state.bobT) * 0.035;
    }

    camera.position.y = b.eyeY + state.jumpY + bob;

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
