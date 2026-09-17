/**
 * BONK! — Puppy rig (procedural cut-out character)
 * ---------------------------------------------------------------
 * The puppy is not a sprite sheet any more: 7 painted parts (assets/images/puppy/rig/*) are
 * driven by a small skeleton every frame, so he runs at ANY speed with paws that never skate,
 * looks at the bone he's chasing, flops his ears when he stops, wags, blinks, squashes on
 * landing and leans into acceleration — all continuous, never a frame-snap.
 *
 *   Rig.update(dt, I)            I = { speed (0..1.4 of max), state, hop, lookX, lookY, wind, stateT }
 *   Rig.draw(ctx, x, gy, h, face, I)   x = paw centre (px), gy = ground (px), h = standing height (px)
 *
 * Rig space: origin = torso centre, +x = nose direction, +y = UP, 1000 units ≈ nose-to-tail.
 * Canvas angles are the negative of rig angles (canvas y points down).
 * Secondary motion (ears, tail, head) = under-damped springs fed by the body's acceleration and
 * bounce — that, more than anything, is what makes him feel alive rather than "translated".
 */
const Rig = (() => {
  // --- parts: asset · pivot (fractions of the part image) · height in rig units · draw order ------
  const PARTS = {
    tail:      { img: 'rig_tail',      pivot: [0.10, 0.92], h: 300, z: 0 },
    earFar:    { img: 'rig_ear',       pivot: [0.55, 0.06], h: 330, z: 1 },
    legHindB:  { img: 'rig_leg_hind',  pivot: [0.55, 0.10], h: 400, z: 2 },
    legFrontB: { img: 'rig_leg_front', pivot: [0.50, 0.08], h: 400, z: 3 },
    torso:     { img: 'rig_torso',     pivot: [0.50, 0.50], h: 470, z: 4 },
    legHindF:  { img: 'rig_leg_hind',  pivot: [0.55, 0.10], h: 400, z: 5 },
    legFrontF: { img: 'rig_leg_front', pivot: [0.50, 0.08], h: 400, z: 6 },
    head:      { img: 'rig_head',      pivot: [0.22, 0.70], h: 420, z: 7 },
    mouth:     { img: 'rig_mouth',     pivot: [0.15, 0.30], h: 120, z: 8 },
    earNear:   { img: 'rig_ear',       pivot: [0.55, 0.06], h: 330, z: 9 },
  };
  // anchors (rig units). Body anchors are relative to the torso centre; head anchors relative to the neck joint.
  const TC_Y = 462;                                                    // torso centre height above ground when standing
  const B = { neck: [225, 164], shoulder: [162, -94], hip: [-175, -94], tail: [-281, 103] };
  const H = { earNear: [52, 202], earFar: [28, 200], mouth: [177, -42], eye: [165, 126] };
  const TOTAL_H = 920;                                                 // ground → top of head, standing

  const spring = (k, d) => ({ k, d, v: 0, x: 0 });
  const S = {
    earNear: spring(170, 9), earFar: spring(170, 9), tail: spring(130, 7), head: spring(240, 15),
    stride: 0, bounce: 0, pb: 0, lean: 0, squash: 1, prevSpeed: 0, accel: 0,
    blink: 0, nextBlink: 2.5, wag: 0, lookX: 0, lookY: 0, pant: 0, mouthOpen: 0,
    idleT: 0, fidget: null, fidgetT: 0, nextFidget: 4, dizzyT: 0, breath: 0,
  };
  const img = k => Assets.img(k);
  // --- skins: cosmetic overlays drawn in rig space (vector, so they scale/rotate with the parts) ------
  // Each skin lists layers keyed by where they attach: neck (after torso, under the head), head (over the
  // ears), face (over the eye). Layers draw in canvas space around the joint (x right = nose, y DOWN) —
  // a head anchor [x, y] from H becomes translate(x, -y).
  let skin = 'classic';
  const SKIN_LAYERS = {
    classic: {},
    bandana: { neck: c => {                                                  // red scarf: band round the neck, triangle hangs down the chest (drawn over the head base)
      c.save(); c.translate(40, 30);
      c.fillStyle = '#d3302a'; c.beginPath(); c.moveTo(-95, -30); c.quadraticCurveTo(0, -62, 100, -22); c.quadraticCurveTo(105, 6, 95, 18); c.quadraticCurveTo(0, -20, -95, 14); c.closePath(); c.fill();   // band
      c.fillStyle = '#c0281f'; c.beginPath(); c.moveTo(-40, 6); c.quadraticCurveTo(0, -8, 60, 2); c.lineTo(22, 120); c.closePath(); c.fill();                                                            // hanging triangle
      c.fillStyle = '#e94a3f'; c.beginPath(); c.moveTo(-30, 4); c.lineTo(22, 110); c.lineTo(26, 60); c.closePath(); c.fill();                                                                            // fold highlight
      c.fillStyle = '#fff'; for (const [x, y, r] of [[-60, -8, 6], [-20, -22, 5], [30, -22, 6], [75, -6, 5], [10, 40, 5], [30, 80, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill(); }
      c.restore();
    } },
    party: { head: c => {                                                    // cone hat with pompom, sits between the ears
      c.save(); c.translate(80, -205); c.rotate(.20); c.scale(.8, .8);
      c.fillStyle = '#3a8ee6'; c.beginPath(); c.moveTo(-95, 0); c.lineTo(95, 0); c.lineTo(0, -250); c.closePath(); c.fill();
      c.fillStyle = '#ffd23a'; for (let i = 0; i < 3; i++) { const y = -55 - i * 65, w = 95 * (1 + y / 250); c.beginPath(); c.moveTo(-w, y - 11); c.lineTo(w, y - 11); c.lineTo(w * (1 - 22 / (250 + y)), y + 11); c.lineTo(-w * (1 - 22 / (250 + y)), y + 11); c.closePath(); c.fill(); }
      c.fillStyle = '#ff5fa2'; c.beginPath(); c.arc(0, -255, 30, 0, 6.28); c.fill(); c.fillStyle = '#ffffff88'; c.beginPath(); c.arc(-9, -265, 10, 0, 6.28); c.fill();
      c.fillStyle = '#1f5fb0'; c.beginPath(); c.ellipse(0, 0, 97, 18, 0, 0, 6.28); c.fill(); c.restore();
    } },
    shades: { face: c => {                                                   // cool sunglasses over the eye (+ bridge to the far side)
      c.save(); c.translate(4, -2); c.fillStyle = '#1b1b24'; c.strokeStyle = '#ffd23a'; c.lineWidth = 8;
      c.beginPath(); c.ellipse(6, 0, 58, 42, .1, 0, 6.28); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-50, -6); c.quadraticCurveTo(-95, -4, -135, 30); c.stroke();                    // arm to the far ear
      c.beginPath(); c.moveTo(62, -8); c.quadraticCurveTo(80, -14, 92, -10); c.stroke();                      // nose bridge stub
      c.fillStyle = '#ffffff55'; c.beginPath(); c.ellipse(-14, -16, 22, 10, -.5, 0, 6.28); c.fill(); c.restore();
    } },
    crown: { head: c => {                                                    // golden crown with jewels (Club)
      c.save(); c.translate(80, -208); c.rotate(.10); c.scale(1.05, 1.05);
      c.fillStyle = '#f5c53a'; c.strokeStyle = '#b8860b'; c.lineWidth = 5; c.beginPath();
      c.moveTo(-78, 0); c.lineTo(-84, -90); c.lineTo(-42, -48); c.lineTo(0, -110); c.lineTo(42, -48); c.lineTo(84, -90); c.lineTo(78, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffe9a0'; c.fillRect(-78, -14, 156, 10);
      for (const [x, col] of [[-84, '#e53d3d'], [0, '#3d8ee5'], [84, '#3fc46a']]) { c.fillStyle = col; c.beginPath(); c.arc(x, x ? -92 : -112, 12, 0, 6.28); c.fill(); }
      c.fillStyle = '#e53d3d'; c.beginPath(); c.arc(0, -30, 13, 0, 6.28); c.fill(); c.restore();
    } },
  };
  const skinLayer = (c, at) => { const L = SKIN_LAYERS[skin] && SKIN_LAYERS[skin][at]; if (L) L(c); };
  const step = (sp, target, dt) => { sp.v += (sp.k * (target - sp.x) - sp.d * sp.v) * dt; sp.x += sp.v * dt; return sp.x; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };

  // --- simulation ----------------------------------------------------------------------------
  function update(dt, I) {
    const sp = clamp(Math.abs(I.speed || 0), 0, 1.4), st = I.state || 'idle', running = st === 'run' && sp > .02;
    S.accel = lerp(S.accel, ((I.speed || 0) - S.prevSpeed) / Math.max(dt, 1e-3), Math.min(1, dt * 12)); S.prevSpeed = I.speed || 0;
    const aFwd = S.accel * Math.sign(I.face || 1);                    // acceleration along the nose direction (+ = speeding up forward)
    // gait: cadence rises with speed, stride length does the rest (legPose)
    const cadence = 1.5 + sp * 2.1;
    if (running) S.stride = (S.stride + cadence * dt) % 1;
    else if (S.stride > 0) { S.stride += dt * 2.5; if (S.stride >= 1) S.stride = 0; }   // finish the step, then stand
    const gallop = sp > .55, ph = S.stride * Math.PI * 2;
    // bounce: trot = 2 per stride, gallop = 1 big one (suspension phase)
    const bT = running ? (gallop ? Math.max(0, Math.sin(ph)) * (26 + sp * 30) : (0.5 - 0.5 * Math.cos(ph * 2)) * (10 + sp * 20)) : 0;
    S.bounce = lerp(S.bounce, bT, Math.min(1, dt * 20));
    // pitch (rig angle, + = nose up): lean nose-down when accelerating forward, sit back when braking; gallop rocks
    const leanT = clamp(-aFwd * .10, -.22, .22) + (gallop ? Math.sin(ph + .6) * .06 : 0) - (I.wind || 0) * (I.face || 1) * .05;
    S.lean = lerp(S.lean, leanT, Math.min(1, dt * 8));
    // secondary motion: springs are kicked by acceleration & bounce; ears trail back with speed, tail lifts with speed
    const kick = aFwd * .010 + (S.bounce - S.pb) * .010; S.pb = S.bounce;
    step(S.earNear, -kick * 1.2 - sp * .22 * (running ? 1 : 0), dt);
    step(S.earFar, -kick * 1.1 - sp * .20 * (running ? 1 : 0), dt);
    const happy = st === 'yay' || st === 'celebrate';
    S.wag += dt * (happy ? 17 : st === 'idle' ? 4.5 : 9 + sp * 6);
    const wagA = happy ? .5 : st === 'idle' ? .16 : .08 + sp * .10;
    step(S.tail, kick * 1.5 + Math.sin(S.wag) * wagA + (running ? .25 + sp * .25 : happy ? .3 : 0), dt);
    // head: eased look-at + stride nod + accel kick
    S.lookX = lerp(S.lookX, I.lookX == null ? 0 : clamp(I.lookX, -1, 1), Math.min(1, dt * 6));
    S.lookY = lerp(S.lookY, I.lookY == null ? 0 : clamp(I.lookY, -1, 1), Math.min(1, dt * 6));
    step(S.head, -kick * .7 + (gallop ? Math.sin(ph + 1.2) * .05 : 0) + S.lookY * .25, dt);
    // blink, breath, mouth
    S.nextBlink -= dt; if (S.nextBlink <= 0) { S.blink = 1; S.nextBlink = 2 + Math.random() * 3.5; }
    if (S.blink > 0) S.blink = Math.max(0, S.blink - dt * 8);
    S.breath += dt * 1.9;
    const mo = happy ? 1 : st === 'dizzy' ? .5 : sp > .6 ? .75 : 0;
    S.pant += dt * 10; S.mouthOpen = lerp(S.mouthOpen, mo * (.8 + .2 * Math.sin(S.pant)), Math.min(1, dt * 8));
    S.squash = lerp(S.squash, 1, Math.min(1, dt * 9));
    // idle fidgets
    if (st === 'idle' && sp < .02) {
      S.idleT += dt; S.nextFidget -= dt;
      if (!S.fidget && S.nextFidget <= 0) { S.fidget = ['sniff', 'shake', 'scratch'][Math.floor(Math.random() * 3)]; S.fidgetT = 0; }
    } else { S.idleT = 0; S.fidget = null; S.nextFidget = 3 + Math.random() * 3; }
    if (S.fidget) { S.fidgetT += dt; if (S.fidgetT > { sniff: 1.6, shake: .7, scratch: 1.4 }[S.fidget]) { S.fidget = null; S.nextFidget = 4 + Math.random() * 4; } }
    S.dizzyT = st === 'dizzy' ? S.dizzyT + dt : 0;
  }

  // Leg pose for a gait phase (0..1). Stance (first ~55 %): the paw is on the ground and sweeps BACK linearly —
  // that is what locks paws to the ground at any speed. Swing (rest): the paw lifts, folds and arcs forward.
  // Returns rig angle (+ = forward), length factor (fold) and a shear that reads as the knee/hock bending.
  function legPose(phase, sp, hind) {
    const reach = (0.20 + sp * 0.46) * (hind ? 1.12 : 1), duty = sp > .55 ? .45 : .58;
    let ang, lift;
    if (phase < duty) { const k = phase / duty; ang = reach * (1 - 2 * k); lift = 0; }                    // stance: front → back
    else { const k = (phase - duty) / (1 - duty), e = 0.5 - 0.5 * Math.cos(k * Math.PI); ang = -reach + 2 * reach * e; lift = Math.sin(k * Math.PI); }   // swing: back → front
    return { ang, len: 1 - lift * (0.20 + sp * .12), shear: lift * (hind ? -.35 : .30) * (0.6 + sp * .5), lift };
  }
  function standLegs(fid, ft) {
    const scratch = fid === 'scratch' ? Math.sin(ft * 22) * .35 : 0;
    return { hB: { ang: -.06, len: 1 }, fB: { ang: .05, len: 1 }, hF: { ang: .05 + scratch, len: fid === 'scratch' ? .8 : 1, shear: fid === 'scratch' ? -.3 : 0 }, fF: { ang: -.04, len: 1 } };
  }

  // --- drawing -------------------------------------------------------------------------------
  function part(c, name, x, y, rigAng, sx, sy, alpha, shear) {
    const P = PARTS[name], im = img(P.img); if (!im || !im.width) return;
    const h = P.h, w = h * im.width / im.height;
    c.save(); c.translate(x, y); c.rotate(-rigAng); c.scale(sx || 1, sy || 1); if (shear) c.transform(1, 0, shear, 1, 0, 0); if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(im, -P.pivot[0] * w, -P.pivot[1] * h, w, h); c.restore();
  }
  function draw(c, x, gy, h, face, I) {
    const u = h / TOTAL_H, st = I.state || 'idle', sp = clamp(Math.abs(I.speed || 0), 0, 1.4);
    const fid = S.fidget, ft = S.fidgetT, happy = st === 'yay' || st === 'celebrate';
    c.save(); c.translate(x, gy - (I.hop || 0)); c.scale(face * u, u); c.scale(1 / S.squash, S.squash);
    // torso centre in canvas rig coords (y down): bounce + breathing lift
    const breathe = st === 'idle' ? Math.sin(S.breath) * 4 : 0;
    const tcy = -(TC_Y + S.bounce + breathe), lean = S.lean + (fid === 'scratch' ? .12 : 0) + (st === 'bonk' ? -.12 : 0);
    const bp = p => { const q = rot(p, lean); return [q[0], tcy - q[1]]; };           // body anchor → canvas
    const nk = bp(B.neck), sho = bp(B.shoulder), hip = bp(B.hip), tb = bp(B.tail);
    // head angle (rig): look pitch, stride nod, expressions, fidgets
    const headA = lean + S.head.x + (st === 'bonk' ? -.45 : 0) + (st === 'dizzy' ? Math.sin(S.dizzyT * 6) * .12 : 0)
                + (fid === 'sniff' ? -.5 * Math.sin(Math.min(1, ft / .6) * Math.PI / 2) : 0) + (fid === 'scratch' ? -.2 : 0) + (happy ? .18 : 0);
    const hp = p => { const q = rot(p, headA); return [nk[0] + q[0], nk[1] - q[1]]; };  // head anchor → canvas
    const en = hp(H.earNear), ef = hp(H.earFar), mo = hp(H.mouth), eye = hp(H.eye);
    // legs
    const gallop = sp > .55, moving = st === 'run' || S.stride > 0;
    let L;
    if (moving) {
      const pF = S.stride, pH = (S.stride + .5) % 1, off = gallop ? .14 : .5;
      L = { fF: legPose(pF, sp, false), fB: legPose((pF + off) % 1, sp, false), hF: legPose(pH, sp, true), hB: legPose((pH + off) % 1, sp, true) };
    } else L = standLegs(fid, ft);
    if (st === 'celebrate' || (st === 'yay' && (I.hop || 0) > 2)) { const k = clamp((I.hop || 0) / (h * .25), 0, 1); L.fF = { ang: .9 * k, len: .85 }; L.fB = { ang: .7 * k, len: .85 }; L.hF = { ang: -.35 * k, len: 1 }; L.hB = { ang: -.25 * k, len: 1 }; }
    // ears: hang (0) → trail back with speed (spring), lift when happy, droop when bonked, shake fidget
    const earBase = (happy ? .28 : 0) + (st === 'bonk' ? -.35 : 0) + (fid === 'shake' ? Math.sin(ft * 42) * .55 : 0) + headA * .4;
    const tailA = S.tail.x + (st === 'dizzy' ? -.5 : 0) + (st === 'bonk' ? -.8 : 0) + lean;

    const q = [];
    const push = (name, pos, ang, sx, sy, al, sh) => q.push([PARTS[name].z, name, pos[0], pos[1], ang, sx, sy, al, sh]);
    push('tail', tb, tailA);
    push('earFar', ef, earBase + S.earFar.x, .92, .96, .88);
    push('legHindB', hip, L.hB.ang + lean, 1, L.hB.len, .9, L.hB.shear || 0);
    push('legFrontB', sho, L.fB.ang + lean, 1, L.fB.len, .9, L.fB.shear || 0);
    push('torso', [0, tcy], lean);
    if (SKIN_LAYERS[skin] && SKIN_LAYERS[skin].neck) q.push([7.5, 'skin:neck', nk[0], nk[1], lean, 1, 1, null, 0]);
    push('legHindF', hip, L.hF.ang + lean, 1, L.hF.len, null, L.hF.shear || 0);
    push('legFrontF', sho, L.fF.ang + lean, 1, L.fF.len, null, L.fF.shear || 0);
    push('head', nk, headA, 1 - Math.abs(S.lookX) * .05, 1);
    if (S.mouthOpen > .05) push('mouth', mo, headA - .1, 1, .3 + .7 * S.mouthOpen);
    push('earNear', en, earBase + S.earNear.x);
    if (SKIN_LAYERS[skin] && SKIN_LAYERS[skin].head) q.push([10, 'skin:head', nk[0], nk[1], headA, 1, 1, null, 0]);
    q.sort((a, b) => a[0] - b[0]);
    for (const [, nm, px, py, a, sx, sy, al, sh] of q) {
      if (nm.startsWith('skin:')) { c.save(); c.translate(px, py); c.rotate(-a); skinLayer(c, nm.slice(5)); c.restore(); }   // layers draw in canvas space (y down) around the joint
      else part(c, nm, px, py, a, sx, sy, al, sh);
    }
    drawEye(c, eye, headA, st);
    if (SKIN_LAYERS[skin] && SKIN_LAYERS[skin].face) { c.save(); c.translate(eye[0], eye[1]); c.rotate(-headA); skinLayer(c, 'face'); c.restore(); }
    if (st === 'dizzy') { c.save(); c.translate(nk[0] + 80, nk[1] - 330); c.scale(face, 1); c.fillStyle = '#ffd23a'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const a = S.dizzyT * 4 + i * 2.09; c.globalAlpha = .7 + .3 * Math.sin(a); c.fillText('★', Math.cos(a) * 120, Math.sin(a) * 26); } c.restore(); }
    c.restore();
  }
  // eye overlay: a pupil dot that follows the look target + an eyelid for blinks / expressions
  function drawEye(c, eye, headA, st) {
    c.save(); c.translate(eye[0], eye[1]); c.rotate(-headA);
    const px = S.lookX * 7, py = -S.lookY * 6;
    c.fillStyle = '#20140a'; c.beginPath(); c.ellipse(px + 5, py + 3, 7.5, 8.5, 0, 0, 6.28); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px + 2, py - 2, 3, 0, 6.28); c.fill();
    const lid = st === 'bonk' ? 1 : st === 'dizzy' ? .5 + Math.sin(S.dizzyT * 5) * .1 : S.blink > .5 ? (1 - S.blink) * 2 : S.blink * 2;
    if (lid > .02) { c.fillStyle = '#c98a45'; c.beginPath(); c.ellipse(2, -6, 30, 30 * lid, 0, Math.PI, 2 * Math.PI); c.closePath(); c.fill(); }
    c.restore();
  }

  return {
    update, draw,
    squash(v) { S.squash = v; },
    kick(v) { S.earNear.v += v; S.earFar.v += v * .9; S.tail.v += v * 1.4; S.head.v += v * .5; },
    reset() { Object.assign(S, { stride: 0, bounce: 0, pb: 0, lean: 0, squash: 1, prevSpeed: 0, accel: 0, blink: 0, lookX: 0, lookY: 0, mouthOpen: 0, idleT: 0, fidget: null, dizzyT: 0 }); for (const k of ['earNear', 'earFar', 'tail', 'head']) { S[k].x = 0; S[k].v = 0; } },
    get S() { return S; }, PARTS, TOTAL_H,
    get skin() { return skin; }, setSkin(id) { skin = SKIN_LAYERS[id] ? id : 'classic'; }, SKINS: Object.keys(SKIN_LAYERS),
  };
})();
