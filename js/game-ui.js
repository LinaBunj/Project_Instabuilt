/**
 * InstaBuilt — game UI overlay for the house designer (js/game-ui.js).
 *
 * Layers game-feel on top of the existing preset configurator without touching
 * the save-to-Supabase flow or the price/energy calculator integrations:
 *   - step-tracker + wizard navigation ("Design Your Dream Home")
 *   - subtle feedback (pulse + optional sound) on each selection
 *   - interactive 3D objects → info popup (orbit: click; walkthrough: look)
 *   - room detection → toast + mini-map highlight in walkthrough mode
 */
import * as THREE from 'three';

export function createGameUI(opts) {
  const { scene, camera, renderer, house, interior, walkthrough, bounds, mode, minimap } = opts;
  const STEPS = opts.steps || ['Product line', 'Size', 'Materials', 'Interior', 'Smart home', 'Furnish'];
  const ROOM_NAMES = { living: 'Living Room', kitchen: 'Kitchen', bedroom: 'Bedroom', bath: 'Bathroom' };
  const SOUND_KEY = opts.soundKey || 'instabuilt.designer.sound';

  let current = 1;
  let interactiveRoots = [];
  let lookRoot = null;
  let lastRoom = null;
  let audioCtx = null;
  let soundOn = false;

  const raycaster = new THREE.Raycaster();
  const v3 = new THREE.Vector3();

  // ---- DOM ----
  const track = document.getElementById('game-step-track');
  const caption = document.getElementById('game-step-caption');
  const flash = document.getElementById('game-flash');
  const popup = document.getElementById('game-info-popup');
  const lookLabel = document.getElementById('game-look-label');
  const roomToast = document.getElementById('game-room-toast');
  const crosshair = document.getElementById('wt-crosshair');
  const mmWrap = document.getElementById('mm-wrap');
  const soundBtn = document.getElementById('sound-toggle');
  const prevBtn = document.getElementById('game-prev');
  const nextBtn = document.getElementById('game-next');

  try { soundOn = localStorage.getItem(SOUND_KEY) === '1'; } catch (e) { /* ignore */ }

  // ---- Step tracker + wizard ----
  const nodes = [];
  function buildTracker() {
    track.innerHTML = '';
    STEPS.forEach((title, i) => {
      const li = document.createElement('li');
      li.className = 'track-step';
      const node = document.createElement('span');
      node.className = 'track-step__node';
      node.setAttribute('aria-hidden', 'true');
      node.textContent = i + 1;
      const label = document.createElement('span');
      label.className = 'track-step__label';
      label.textContent = title;
      li.appendChild(node);
      li.appendChild(label);
      track.appendChild(li);
      nodes.push(li);
    });
  }

  function updateTracker() {
    nodes.forEach((li, i) => {
      const n = i + 1;
      li.classList.toggle('is-done', n < current);
      li.classList.toggle('is-current', n === current);
      li.classList.toggle('is-upcoming', n > current);
      const node = li.querySelector('.track-step__node');
      node.textContent = n < current ? '\u2713' : n;
    });
    caption.textContent = 'Step ' + current + ' of ' + STEPS.length + ': ' + STEPS[current - 1];
  }

  function showStep(n) {
    document.querySelectorAll('.designer-step').forEach((sec) => {
      sec.hidden = Number(sec.getAttribute('data-step')) !== n;
    });
    prevBtn.disabled = n <= 1;
    nextBtn.disabled = n >= STEPS.length;
  }

  function goToStep(n) {
    current = Math.max(1, Math.min(STEPS.length, n));
    showStep(current);
    updateTracker();
    if (opts.onStepChange) opts.onStepChange(current);
  }

  function next() { goToStep(current + 1); }
  function prev() { goToStep(current - 1); }
  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);

  // ---- Sound ----
  function renderSoundBtn() {
    if (!soundBtn) return;
    soundBtn.classList.toggle('is-on', soundOn);
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    soundBtn.setAttribute('title', soundOn ? 'Mute feedback sounds' : 'Enable feedback sounds');
  }
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0'); } catch (e) { /* ignore */ }
    renderSoundBtn();
  }
  if (soundBtn) soundBtn.addEventListener('click', toggleSound);

  function playPop() {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(740 + Math.random() * 140, audioCtx.currentTime);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.2);
    } catch (e) { /* audio unavailable */ }
  }

  // ---- Feedback pulse ----
  let flashTimer = null;
  function pulse() {
    if (!flash) return;
    flash.classList.add('is-on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => flash.classList.remove('is-on'), 380);
    playPop();
  }

  // ---- Interactive objects (collect + raycast) ----
  function collectInteractive() {
    const roots = [];
    if (house) house.traverse((o) => { if (o.userData && o.userData.info) roots.push(o); });
    if (interior && interior.interactive) {
      interior.interactive().forEach((it) => {
        if (it.group && it.group.userData && it.group.userData.info) roots.push(it.group);
      });
    }
    // de-dup by uuid
    const seen = new Set();
    interactiveRoots = roots.filter((r) => { if (seen.has(r.uuid)) return false; seen.add(r.uuid); return true; });
  }

  function setRayFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerSet((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }
  function pointerSet(nx, ny) {
    raycaster.setFromCamera(nx === 0 && ny === 0 ? { x: 0, y: 0 } : { x: nx, y: ny }, camera);
  }
  function pickRoot() {
    const hits = raycaster.intersectObjects(interactiveRoots, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !(o.userData && o.userData.info)) o = o.parent;
    return o || null;
  }

  // Orbit: click an object to see its info.
  function onOrbitClick(e) {
    if (mode() !== 'orbit') return;
    if (interior.getTool && interior.getTool()) return; // placing furniture — skip
    setRayFromEvent(e);
    const root = pickRoot();
    if (root) showInfoPopup(root, e.clientX, e.clientY);
    else hideInfoPopup();
  }
  if (renderer && renderer.domElement) renderer.domElement.addEventListener('click', onOrbitClick);
  if (popup) popup.addEventListener('click', (e) => { if (e.target === popup) hideInfoPopup(); });

  // Walkthrough: look-at label follows the object under the crosshair.
  function projectRootWorld(root) {
    root.getWorldPosition(v3);
    v3.y += 1.2;
    return v3;
  }
  function raycastCenter() {
    pointerSet(0, 0);
    return pickRoot();
  }

  function showLookLabel(root) {
    if (!lookLabel) return;
    const info = root.userData.info || {};
    const worldPos = projectRootWorld(root);
    const v = worldPos.clone().project(camera);
    if (v.z >= 1) { lookLabel.hidden = true; return; }
    const rect = renderer.domElement.getBoundingClientRect();
    lookLabel.hidden = false;
    lookLabel.style.left = ((v.x * 0.5 + 0.5) * rect.width) + 'px';
    lookLabel.style.top = ((-v.y * 0.5 + 0.5) * rect.height) + 'px';
    lookLabel.innerHTML = '<strong>' + esc(info.name || 'Object') + '</strong>' +
      (info.cost ? '<span class="game-look__cost">' + esc(info.cost) + '</span>' : '');
  }
  function hideLookLabel() { if (lookLabel) lookLabel.hidden = true; }

  // Orbit info popup.
  function showInfoPopup(root, cx, cy) {
    if (!popup) return;
    const info = root.userData.info || {};
    popup.innerHTML =
      '<button class="game-info__close" type="button" aria-label="Close">\u00D7</button>' +
      '<strong>' + esc(info.name || 'Object') + '</strong>' +
      (info.desc ? '<p>' + esc(info.desc) + '</p>' : '') +
      infoRows(info);
    popup.hidden = false;
    const rect = renderer.domElement.getBoundingClientRect();
    let left = cx - rect.left + 14;
    let top = cy - rect.top - 10;
    const pw = popup.offsetWidth || 220;
    const ph = popup.offsetHeight || 120;
    if (left + pw > rect.width - 8) left = cx - rect.left - pw - 14;
    if (top + ph > rect.height - 8) top = cy - rect.top - ph - 10;
    popup.style.left = Math.max(8, left) + 'px';
    popup.style.top = Math.max(8, top) + 'px';
    const close = popup.querySelector('.game-info__close');
    if (close) close.addEventListener('click', hideInfoPopup);
  }
  function hideInfoPopup() { if (popup) popup.hidden = true; }

  function infoRows(info) {
    let out = '';
    if (info.cost) out += '<div class="game-info__row"><span>Cost</span><b>' + esc(info.cost) + '</b></div>';
    if (info.energy) out += '<div class="game-info__row"><span>Energy</span><b>' + esc(info.energy) + '</b></div>';
    return out;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Room toast ----
  let toastTimer = null;
  function showRoomToast(name) {
    if (!roomToast || !name) return;
    roomToast.textContent = 'You are in the ' + name;
    roomToast.hidden = false;
    roomToast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { roomToast.classList.remove('is-on'); roomToast.hidden = true; }, 1800);
  }
  function hideRoomToast() {
    if (!roomToast) return;
    clearTimeout(toastTimer);
    roomToast.classList.remove('is-on');
    roomToast.hidden = true;
  }

  // ---- Per-frame ----
  function frame() {
    if (mode() === 'walkthrough') {
      if (crosshair) crosshair.hidden = false;
      if (mmWrap) mmWrap.hidden = false;
      lookRoot = raycastCenter();
      if (lookRoot) showLookLabel(lookRoot); else hideLookLabel();

      const b = bounds();
      minimap.setBounds(b);
      const pos = walkthrough.getPosition ? walkthrough.getPosition() : { x: 0, z: 0 };
      const yaw = walkthrough.getYaw ? walkthrough.getYaw() : 0;
      const roomId = minimap.update({ x: pos.x, z: pos.z, yaw: yaw });
      if (roomId && roomId !== lastRoom) { lastRoom = roomId; showRoomToast(minimap.roomName(roomId)); }
    } else {
      if (crosshair) crosshair.hidden = true;
      if (mmWrap) mmWrap.hidden = true;
      hideLookLabel();
      hideRoomToast();
      lastRoom = null;
    }
  }

  function init() {
    buildTracker();
    goToStep(1);
    renderSoundBtn();
    collectInteractive();
  }

  return {
    init: init,
    frame: frame,
    refresh: collectInteractive,
    onSelectionChange: pulse,
    goToStep: goToStep,
    setSoundOn: function (on) { soundOn = on; renderSoundBtn(); },
    isSoundOn: function () { return soundOn; },
    dispose: function () {
      if (renderer && renderer.domElement) renderer.domElement.removeEventListener('click', onOrbitClick);
      clearTimeout(flashTimer);
      clearTimeout(toastTimer);
    }
  };
}
