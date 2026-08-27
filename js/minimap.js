/**
 * InstaBuilt — live mini-map overlay for walkthrough mode (js/minimap.js).
 *
 * A top-down floor plan rendered into a <canvas>: room zones, a door marker and
 * the player's live position + facing arrow. The room the player currently
 * stands in is highlighted. Shown only during walkthrough mode.
 */
export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  let bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  let world = { x: 0, z: 0 };

  // Generic 2×2 room grid as fractions of the interior footprint.
  const ROOMS = [
    { id: 'living',  name: 'Living Room', fx: [0, 0.5], fz: [0, 0.5] },
    { id: 'kitchen', name: 'Kitchen',     fx: [0, 0.5], fz: [0.5, 1] },
    { id: 'bedroom', name: 'Bedroom',     fx: [0.5, 1], fz: [0, 0.5] },
    { id: 'bath',    name: 'Bathroom',    fx: [0.5, 1], fz: [0.5, 1] }
  ];

  function roomWorld(r) {
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    return {
      minX: bounds.minX + r.fx[0] * w,
      maxX: bounds.minX + r.fx[1] * w,
      minZ: bounds.minZ + r.fz[0] * d,
      maxZ: bounds.minZ + r.fz[1] * d
    };
  }

  function roomIdAt(x, z) {
    for (const r of ROOMS) {
      const b = roomWorld(r);
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return r.id;
    }
    return null;
  }

  function roomName(id) {
    const r = ROOMS.find((x) => x.id === id);
    return r ? r.name : '';
  }

  function draw(player) {
    const W = canvas.width;
    const H = canvas.height;
    const pad = 10;
    ctx.clearRect(0, 0, W, H);

    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    const scale = Math.min((W - pad * 2) / w, (H - pad * 2) / d);
    const ox = (W - w * scale) / 2;
    const oy = (H - d * scale) / 2;
    function px(x) { return ox + (x - bounds.minX) * scale; }
    function py(z) { return oy + (z - bounds.minZ) * scale; }

    // Room zones
    ROOMS.forEach((r) => {
      const b = roomWorld(r);
      const active = r.id === player.roomId;
      ctx.fillStyle = active ? 'rgba(107,124,63,0.30)' : 'rgba(237,240,225,0.55)';
      ctx.strokeStyle = active ? '#6b7c3f' : '#d0cec7';
      ctx.lineWidth = active ? 2 : 1;
      ctx.fillRect(px(b.minX), py(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
      ctx.strokeRect(px(b.minX), py(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);

      ctx.fillStyle = active ? '#4d5c2b' : '#8f8d86';
      ctx.font = '600 9px Outfit, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, px((b.minX + b.maxX) / 2), py((b.minZ + b.maxZ) / 2) + 3);
    });

    // House outline
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px(bounds.minX) - 3, py(bounds.minZ) - 3, w * scale + 6, d * scale + 6);

    // Door marker (front, maxZ side)
    ctx.fillStyle = '#6b7c3f';
    const doorX = px(bounds.minX + w / 2);
    const doorY = py(bounds.maxZ);
    ctx.fillRect(doorX - 3, doorY - 7, 6, 7);

    // Player arrow
    const cx = px(player.x);
    const cy = py(player.z);
    const heading = Math.atan2(-Math.sin(player.yaw), Math.cos(player.yaw));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-4.5, 5);
    ctx.lineTo(4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function update(st) {
    if (st) {
      world.x = st.x;
      world.z = st.z;
      const roomId = st.roomId === undefined ? roomIdAt(st.x, st.z) : st.roomId;
      draw({ x: st.x, z: st.z, yaw: st.yaw || 0, roomId: roomId });
      return roomId;
    }
    draw({ x: world.x, z: world.z, yaw: 0, roomId: roomIdAt(world.x, world.z) });
    return null;
  }

  return {
    setBounds: function (b) { bounds = b; },
    roomIdAt: roomIdAt,
    roomName: roomName,
    update: update,
    draw: draw
  };
}
