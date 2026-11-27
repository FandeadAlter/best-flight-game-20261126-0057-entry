// The renderer: a hand-written software 3D chase view in plain Canvas 2D —
// sky, sun and clouds, a heightmapped coast (bay, beach, hills, river, city,
// runway), gold rings, the aircraft seen from behind-above, a lit instrument
// panel and the HUD. No images, no libraries, no network.

import { COLORS, COURSE, RINGS, VIEW } from './config.js';
import { nextRing, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './physics.js';

const { width: W, height: H } = VIEW;
const FOCAL = 660;
const VIEW_CY = H * 0.52;
const PANEL_H = 118;
const DEG = Math.PI / 180;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

// Parse '#rrggbb' once per call site is wasteful; these helpers work on [r,g,b].
function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mix(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}
function shade(c, f) {
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;
}

const C = {};
for (const [k, v] of Object.entries(COLORS)) C[k] = hexRgb(v);

const GROUND_COLORS = {
  water: C.sea,
  waterDeep: C.seaDeep,
  sand: C.sand,
  grass: C.grass,
  grassDry: C.grassDry,
  forest: C.forest,
  hill: C.hill,
  rock: C.rock,
  city: C.cityGround,
  runway: C.asphalt,
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function camera(state) {
    const h = state.heading * DEG;
    const camPitch = (state.pitch * 0.45 - 3) * DEG;
    const sinH = Math.sin(h);
    const cosH = Math.cos(h);
    const sinP = Math.sin(camPitch);
    const cosP = Math.cos(camPitch);
    const f = [sinH * cosP, sinP, cosH * cosP]; // forward
    const r = [cosH, 0, -sinH]; // right
    const u = [-sinH * sinP, cosP, -cosH * sinP]; // up
    const cam = [
      state.x - sinH * 17,
      state.y + 5.4,
      state.z - cosH * 17,
    ];
    return { f, r, u, cam, camPitch };
  }

  function project(cam, p) {
    const dx = p[0] - cam.cam[0];
    const dy = p[1] - cam.cam[1];
    const dz = p[2] - cam.cam[2];
    const zc = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
    if (zc < 3) return null;
    const xc = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
    const yc = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
    const s = FOCAL / zc;
    return { x: W / 2 + xc * s, y: VIEW_CY - yc * s, s, z: zc };
  }

  function drawSky(cam, time) {
    const horizonY = VIEW_CY + Math.tan(cam.camPitch) * FOCAL;
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    grad.addColorStop(0, COLORS.skyTop);
    grad.addColorStop(0.55, COLORS.skyMid);
    grad.addColorStop(1, COLORS.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, Math.max(horizonY, 0));
    // Sun, west-northwest, high.
    const sunDir = [-0.62, 0.34, 0.7];
    const len = Math.hypot(...sunDir);
    const sp = project(cam, [
      cam.cam[0] + (sunDir[0] / len) * 1800,
      cam.cam[1] + (sunDir[1] / len) * 1800,
      cam.cam[2] + (sunDir[2] / len) * 1800,
    ]);
    if (sp) {
      const glow = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 120);
      glow.addColorStop(0, 'rgba(255,244,190,0.95)');
      glow.addColorStop(0.25, 'rgba(255,226,130,0.55)');
      glow.addColorStop(1, 'rgba(255,226,130,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sp.x - 130, sp.y - 130, 260, 260);
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    return horizonY;
  }

  function drawClouds(cam, terrain) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const cloud of terrain.clouds) {
      const p = project(cam, [cloud.x, cloud.y, cloud.z]);
      if (!p || p.z > 900) continue;
      const r = cloud.s * p.s * 0.7;
      if (r < 4) continue;
      ctx.globalAlpha = clamp(1.3 - p.z / 900, 0.55, 0.92);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - r * 0.55, p.y + r * 0.08, r * 0.6, r * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + r * 0.55, p.y + r * 0.06, r * 0.62, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function groundColor(type, x, z, height, dist) {
    let base = GROUND_COLORS[type] || C.grass;
    if (type === 'water') {
      const shimmer = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.031);
      base = [lerp(C.seaDeep[0], C.sea[0], shimmer), lerp(C.seaDeep[1], C.sea[1], shimmer), lerp(C.seaDeep[2], C.sea[2], shimmer)];
    } else if (type === 'grass') {
      const patch = 0.5 + 0.5 * Math.sin(x * 0.021 + 3.1) * Math.sin(z * 0.017 + 1.4);
      base = [lerp(C.grass[0], C.grassDry[0], patch * 0.3), lerp(C.grass[1], C.grassDry[1], patch * 0.3), lerp(C.grass[2], C.grassDry[2], patch * 0.3)];
    } else if (type === 'hill') {
      const v = 0.5 + 0.5 * Math.sin(x * 0.013 + z * 0.011);
      base = [lerp(C.hill[0], C.grassDry[0], v * 0.25), lerp(C.hill[1], C.grassDry[1], v * 0.25), lerp(C.hill[2], C.grassDry[2], v * 0.25)];
    }
    // Atmospheric haze: far ground fades toward the horizon colour. Water
    // keeps more of its blue.
    const hazeCap = type === 'water' ? 0.32 : 0.45;
    const haze = clamp((dist - 120) / 600, 0, hazeCap);
    const shaded = mix(base, C.skyHorizon, haze);
    return shaded;
  }

  function drawTerrain(cam, terrain, state) {
    const camZ = cam.cam[2];
    const camX = cam.cam[0];
    // Two bands: a fine near band and a coarse far band that reaches the
    // horizon, so no flat base-colour strip shows past the drawn ground.
    const bands = [
      { z0: Math.max(0, camZ + 16), z1: camZ + 560, rows: 24, cols: 25, span: 470 },
      { z0: camZ + 560, z1: camZ + 1700, rows: 12, cols: 13, span: 700 },
    ];
    for (let bi = bands.length - 1; bi >= 0; bi -= 1) {
      const band = bands[bi];
      const x0 = camX - band.span;
      const x1 = camX + band.span;
      const dx = (x1 - x0) / band.cols;
      const dz = (band.z1 - band.z0) / band.rows;
      // Painter's algorithm: far rows first.
      for (let ri = band.rows - 1; ri >= 0; ri -= 1) {
        const zA = band.z0 + ri * dz;
        const zB = zA + dz;
        for (let ci = 0; ci < band.cols; ci += 1) {
          const xa = x0 + ci * dx;
          const xb = xa + dx;
          const cxm = (xa + xb) / 2;
          const czm = (zA + zB) / 2;
          const type = terrain.type(cxm, czm);
          const hA = terrain.height(xa, zA);
          const hB = terrain.height(xb, zA);
          const hC = terrain.height(xb, zB);
          const hD = terrain.height(xa, zB);
          const pA = project(cam, [xa, hA, zA]);
          const pB = project(cam, [xb, hB, zA]);
          const pC = project(cam, [xb, hC, zB]);
          const pD = project(cam, [xa, hD, zB]);
          if (!pA || !pB || !pC || !pD) continue;
          const dist = (pA.z + pC.z) / 2;
          // Facet shading from the slope across the quad, so hills read as 3D.
          const slope = Math.abs(hA - hC) + Math.abs(hB - hD);
          const slopeShade = clamp(1 - slope * 0.012, 0.86, 1.04);
          const col = groundColor(type, cxm, czm, (hA + hC) / 2, dist);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.lineTo(pC.x, pC.y);
          ctx.lineTo(pD.x, pD.y);
          ctx.closePath();
          ctx.fill();
          // Same-colour stroke hides the antialiasing seam between neighbours.
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.stroke();
          if (slopeShade !== 1) {
            ctx.fillStyle = slopeShade < 1 ? `rgba(0,0,0,${1 - slopeShade})` : `rgba(255,255,255,${slopeShade - 1})`;
            ctx.fill();
          }
        }
      }
    }
    // Runway markings, drawn over the asphalt quads.
    drawRunway(cam, state);
  }

  function drawRunway(cam, state) {
    const { runway } = COURSE;
    if (cam.cam[2] > runway.z1 + 40 || cam.cam[2] + 560 < runway.z0) return;
    const stripe = (xA, zA, xB, zB, color, width = 3.2) => {
      const pA = project(cam, [xA, runway.groundY + 0.3, zA]);
      const pB = project(cam, [xB, runway.groundY + 0.3, zB]);
      if (!pA || !pB) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.min(9, Math.max(1, width * ((pA.s + pB.s) / 2)));
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    };
    // Edge lines.
    stripe(runway.x0 + 2, runway.z0, runway.x0 + 2, runway.z1, 'rgba(242,242,232,0.9)');
    stripe(runway.x1 - 2, runway.z0, runway.x1 - 2, runway.z1, 'rgba(242,242,232,0.9)');
    // Centreline dashes.
    for (let z = runway.z0 + 30; z < runway.z1 - 20; z += 60) {
      stripe(0, z, 0, z + 28, 'rgba(242,242,232,0.95)');
    }
    // Threshold bars at both ends.
    for (const z of [runway.z0 + 12, runway.z1 - 12]) {
      for (const x of [-20, -10, 0, 10, 20]) {
        stripe(x - 3, z, x + 3, z, 'rgba(242,242,232,0.95)', 7);
      }
    }
  }

  function drawBuildings(cam, terrain) {
    const camZ = cam.cam[2];
    const camX = cam.cam[0];
    const list = terrain.buildings.filter((b) => b.z > camZ - 30 && b.z < camZ + 560 && Math.abs(b.x - camX) < 480);
    list.sort((a, b) => b.z - a.z); // far first
    const faceColors = [
      [176, 182, 186], [150, 168, 178], [186, 172, 150], [140, 150, 160],
    ];
    for (const b of list) {
      const gy = terrain.height(b.x, b.z);
      const hw = b.w / 2;
      const hd = b.d / 2;
      const top = gy + b.h;
      // South face (toward the camera), top face, and the side the camera sees.
      const corners = {
        swb: project(cam, [b.x - hw, gy, b.z - hd]),
        seb: project(cam, [b.x + hw, gy, b.z - hd]),
        set: project(cam, [b.x + hw, top, b.z - hd]),
        swt: project(cam, [b.x - hw, top, b.z - hd]),
        nwb: project(cam, [b.x - hw, gy, b.z + hd]),
        neb: project(cam, [b.x + hw, gy, b.z + hd]),
        net: project(cam, [b.x + hw, top, b.z + hd]),
        nwt: project(cam, [b.x - hw, top, b.z + hd]),
      };
      if (!corners.swb || !corners.seb || !corners.set || !corners.swt) continue;
      const dist = corners.swb.z;
      const haze = clamp((dist - 90) / 520, 0, 0.7);
      const base = faceColors[b.hue];
      const quad = (a, c, d, e, f) => {
        if (!a || !c || !d || !e) return;
        ctx.fillStyle = shade(mix(base, C.skyHorizon, haze), f);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        ctx.fill();
      };
      // South face.
      quad(corners.swb, corners.seb, corners.set, corners.swt, 0.82);
      // Top face.
      quad(corners.swt, corners.set, corners.net, corners.nwt, 1.05);
      // Side face on the camera's side.
      if (camX < b.x) quad(corners.seb, corners.neb, corners.net, corners.set, 0.62);
      else quad(corners.swb, corners.nwb, corners.nwt, corners.swt, 0.62);
      // Lit windows on near buildings.
      if (dist < 320) {
        ctx.fillStyle = 'rgba(255,214,120,0.9)';
        const rowsN = Math.min(5, Math.floor(b.h / 8));
        const colsN = Math.min(4, Math.floor(b.w / 6));
        for (let wi = 0; wi < rowsN * colsN; wi += 1) {
          const pseudo = Math.sin(b.seed * 7.3 + wi * 12.9898) * 43758.5453;
          if ((pseudo - Math.floor(pseudo)) < 0.55) continue;
          const fx = b.x - hw + ((wi % colsN) + 0.5) * (b.w / colsN);
          const fy = gy + 4 + Math.floor(wi / colsN) * 7;
          const wp = project(cam, [fx, fy, b.z - hd - 0.4]);
          if (wp) ctx.fillRect(wp.x - 1, wp.y - 1, 2.4, 2.4);
        }
      }
    }
  }

  function drawTrees(cam, terrain) {
    for (const t of terrain.trees) {
      if (t.z < cam.cam[2] - 10 || t.z > cam.cam[2] + 540) continue;
      if (Math.abs(t.x - cam.cam[0]) > 460) continue;
      const gy = terrain.height(t.x, t.z);
      const p = project(cam, [t.x, gy, t.z]);
      if (!p || p.z < 25) continue;
      const s = t.s * p.s;
      if (s < 2.5) continue;
      ctx.fillStyle = shade(C.forest, 0.9);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.7);
      ctx.lineTo(p.x - s * 0.7, p.y);
      ctx.lineTo(p.x + s * 0.7, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRings(cam, state) {
    const now = state.time;
    for (let i = 0; i < RINGS.length; i += 1) {
      const ring = RINGS[i];
      if (state.ringPassed[i]) continue;
      if (ring.z < cam.cam[2] - 20 || ring.z > cam.cam[2] + 560) continue;
      const near = state.z > ring.z - 260;
      const pts = [];
      const n = 26;
      for (let k = 0; k <= n; k += 1) {
        const a = (k / n) * Math.PI * 2;
        pts.push(project(cam, [
          ring.x + Math.cos(a) * ring.r,
          ring.y + Math.sin(a) * ring.r,
          ring.z,
        ]));
      }
      if (pts.some((p) => p === null)) continue;
      const scale = pts[0].s;
      const pulse = 0.75 + 0.25 * Math.sin(now * 3 + i);
      // Glow pass, then the bright core (widths capped so a near ring
      // does not swallow the screen).
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(255,157,0,${0.4 * pulse})`;
      ctx.lineWidth = Math.min(26, Math.max(2, 11 * scale));
      ctx.beginPath();
      pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = COLORS.ringGold;
      ctx.lineWidth = Math.min(10, Math.max(1.5, 4.5 * scale));
      ctx.beginPath();
      pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      if (near) {
        const c = project(cam, [ring.x, ring.y, ring.z]);
        if (c) {
          ctx.fillStyle = '#fff';
          ctx.font = '700 14px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;
          ctx.fillText(`RING ${i + 1}`, c.x, c.y - ring.r * c.s - 10);
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  // --- The aircraft, seen from behind and slightly above. ---
  function drawPlane(state, time) {
    const cx = W / 2;
    const cy = H * 0.60;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.roll * DEG);
    const strobe = (time % 1.2) < 0.12;

    // Main wings: broad, slightly swept, far end first.
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(-152, -26);
    ctx.lineTo(-32, -30);
    ctx.lineTo(-28, 26);
    ctx.lineTo(-152, 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(152, -26);
    ctx.lineTo(32, -30);
    ctx.lineTo(28, 26);
    ctx.lineTo(152, 10);
    ctx.closePath();
    ctx.fill();
    // Orange wingtips.
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-152, -26); ctx.lineTo(-130, -27); ctx.lineTo(-130, 16); ctx.lineTo(-152, 10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(152, -26); ctx.lineTo(130, -27); ctx.lineTo(130, 16); ctx.lineTo(152, 10);
    ctx.closePath(); ctx.fill();

    // Fuselage: tail (near, bottom) to nose (far, top) — foreshortened.
    const fus = ctx.createLinearGradient(-26, 0, 26, 0);
    fus.addColorStop(0, '#e8eef2');
    fus.addColorStop(0.5, '#ffffff');
    fus.addColorStop(1, '#cfd8de');
    ctx.fillStyle = fus;
    ctx.beginPath();
    ctx.moveTo(-25, 56);
    ctx.quadraticCurveTo(-29, -8, -12, -56);
    ctx.quadraticCurveTo(0, -66, 12, -56);
    ctx.quadraticCurveTo(29, -8, 25, 56);
    ctx.quadraticCurveTo(0, 66, -25, 56);
    ctx.closePath();
    ctx.fill();
    // Teal cheatline along the fuselage.
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(-24, 28); ctx.lineTo(-19, -30); ctx.lineTo(-12, -30); ctx.lineTo(-16, 28); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(24, 28); ctx.lineTo(19, -30); ctx.lineTo(12, -30); ctx.lineTo(16, 28); ctx.closePath(); ctx.fill();
    // Canopy glint (top of the canopy, seen from behind-above).
    ctx.fillStyle = '#7cc7e8';
    ctx.beginPath();
    ctx.ellipse(0, -38, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-3, -42, 3, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Tailplane.
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(-62, 42); ctx.lineTo(-18, 38); ctx.lineTo(-18, 50); ctx.lineTo(-62, 58); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(62, 42); ctx.lineTo(18, 38); ctx.lineTo(18, 50); ctx.lineTo(62, 58); ctx.closePath(); ctx.fill();
    // Vertical fin.
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(-12, 60); ctx.lineTo(-8, 22); ctx.lineTo(8, 22); ctx.lineTo(12, 60); ctx.closePath(); ctx.fill();
    // Registration on the tail of the fuselage.
    ctx.fillStyle = '#0f766e';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PK-CND', 0, 52);

    // Propeller at the nose: a faint spinning disc seen almost edge-on.
    ctx.save();
    ctx.translate(0, -64);
    ctx.fillStyle = 'rgba(30,41,59,0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(state.propAngle);
    ctx.fillStyle = 'rgba(30,41,59,0.4)';
    ctx.fillRect(-1.5, -38, 3, 76);
    ctx.restore();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -64, 4, 0, Math.PI * 2);
    ctx.fill();

    // Navigation lights.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(-150, -8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#34e07a';
    ctx.beginPath(); ctx.arc(150, -8, 4, 0, Math.PI * 2); ctx.fill();
    if (strobe) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 62, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // --- Lit instruments. ---
  function gauge(x, y, r, label, drawFace) {
    ctx.save();
    ctx.translate(x, y);
    // Bezel.
    ctx.fillStyle = '#05080c';
    ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();
    // Face.
    ctx.fillStyle = COLORS.gaugeFace;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    drawFace(r);
    ctx.restore();
    // Glass glint.
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r - 4, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = '#cfe8d8';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, r - 8);
    ctx.restore();
  }

  function needle(angle, len, color, width = 2.5) {
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, -len);
    ctx.stroke();
    ctx.restore();
  }

  function drawPanel(state, time) {
    const y0 = H - PANEL_H;
    // Panel body.
    const grad = ctx.createLinearGradient(0, y0, 0, H);
    grad.addColorStop(0, '#1a232e');
    grad.addColorStop(1, '#0b0f14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, W, PANEL_H);
    ctx.fillStyle = COLORS.panelEdge;
    ctx.fillRect(0, y0, W, 2);
    ctx.shadowColor = COLORS.litCyan;
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(77,216,255,0.55)';
    ctx.fillRect(0, y0, W, 1);
    ctx.shadowBlur = 0;

    const cy = y0 + PANEL_H / 2 + 4;
    const speed = state.speed;
    const altFt = Math.round(state.y * 3.28084);

    // Airspeed.
    gauge(92, cy, 44, 'AIRSPEED', (r) => {
      ctx.fillStyle = COLORS.litGreen;
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let v = 40; v <= 170; v += 10) {
        const a = (-225 + ((v - 40) / 130) * 270) * DEG;
        const major = v % 30 === 10;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = v < 55 ? COLORS.litRed : COLORS.litGreen;
        ctx.fillRect(-0.75, -r + 4, 1.5, major ? 9 : 5);
        ctx.restore();
        if (major) {
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = '#cfe8d8';
          ctx.fillText(String(v), 0, -r + 20);
          ctx.restore();
        }
      }
      needle((-225 + ((clamp(speed, 40, 170) - 40) / 130) * 270) * DEG, r - 12, COLORS.litAmber, 3);
      ctx.fillStyle = '#0a0f14';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    });
    // (Digital airspeed is on the HUD, top left — the dial stays uncluttered.)

    // Artificial horizon.
    gauge(232, cy, 44, 'ATTITUDE', (r) => {
      ctx.save();
      ctx.rotate(-state.roll * DEG);
      const pOff = clamp(state.pitch * 1.4, -r, r);
      ctx.fillStyle = '#2f7fc4';
      ctx.fillRect(-r, -r, r * 2, r + pOff);
      ctx.fillStyle = '#7a5a34';
      ctx.fillRect(-r, pOff, r * 2, r - pOff);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-r, pOff); ctx.lineTo(r, pOff); ctx.stroke();
      ctx.restore();
      // Fixed aircraft symbol.
      ctx.strokeStyle = COLORS.litAmber;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-16, 0); ctx.lineTo(-5, 0); ctx.moveTo(5, 0); ctx.lineTo(16, 0);
      ctx.moveTo(0, 0); ctx.lineTo(0, 4);
      ctx.stroke();
      ctx.fillStyle = COLORS.litAmber;
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    });

    // Altimeter.
    gauge(372, cy, 44, 'ALTITUDE', (r) => {
      ctx.fillStyle = COLORS.litCyan;
      for (let v = 0; v < 10; v += 1) {
        const a = (-225 + (v / 10) * 270) * DEG;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(-0.75, -r + 4, 1.5, 8);
        ctx.restore();
      }
      const hundreds = (altFt / 100) % 10;
      needle((-225 + (hundreds / 10) * 270) * DEG, r - 12, COLORS.litCyan, 3);
      const thousands = Math.floor(altFt / 1000) % 10;
      needle((-225 + (thousands / 10) * 270) * DEG, r - 22, '#ffffff', 2);
      ctx.fillStyle = '#0a0f14';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    });
    // (Digital altitude is on the HUD, top left — the dial stays uncluttered.)

    // Heading tape (centre of the panel).
    const hx0 = 470;
    const hx1 = 810;
    const hxc = (hx0 + hx1) / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(hx0, y0 + 12, hx1 - hx0, 34); ctx.clip();
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(hx0, y0 + 12, hx1 - hx0, 34);
    const hdg = state.heading;
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((Math.round(hdg) + d) % 360 + 360) % 360;
      const x = hxc + d * 2.4;
      const major = deg % 30 === 0;
      ctx.fillStyle = major ? COLORS.litAmber : '#8fa8b8';
      ctx.fillRect(x - 0.75, y0 + 16, 1.5, major ? 12 : 6);
      if (major) {
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] || String(deg).padStart(3, '0');
        ctx.fillStyle = '#e8f4ff';
        ctx.fillText(label, x, y0 + 42);
      }
    }
    ctx.restore();
    // Heading caret + digital readout.
    ctx.fillStyle = COLORS.litAmber;
    ctx.beginPath();
    ctx.moveTo(hxc - 6, y0 + 12); ctx.lineTo(hxc + 6, y0 + 12); ctx.lineTo(hxc, y0 + 22); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HDG ${String(Math.round(hdg) % 360).padStart(3, '0')}°`, hxc, y0 + 64);
    // Vertical speed under the tape.
    const vs = state.verticalSpeed;
    ctx.fillStyle = vs > 0.5 ? COLORS.litGreen : vs < -0.5 ? COLORS.litRed : '#8fa8b8';
    ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`, hxc, y0 + 84);

    // Throttle lever (right side).
    const tx = 900;
    ctx.fillStyle = '#0a0f14';
    ctx.fillRect(tx - 14, y0 + 14, 28, PANEL_H - 34);
    ctx.strokeStyle = '#3a4a5a';
    ctx.strokeRect(tx - 14, y0 + 14, 28, PANEL_H - 34);
    const leverY = y0 + PANEL_H - 22 - state.throttle * (PANEL_H - 44);
    ctx.fillStyle = COLORS.litAmber;
    ctx.fillRect(tx - 12, leverY - 3, 24, 6);
    ctx.fillStyle = '#cfe8d8';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', tx, y0 + 12);
    ctx.fillText(`${Math.round(state.throttle * 100)}%`, tx, y0 + PANEL_H - 8);

    // Ring progress (far right).
    const rx = 1060;
    ctx.fillStyle = '#cfe8d8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RINGS', rx, y0 + 26);
    for (let i = 0; i < RINGS.length; i += 1) {
      const bx = rx + (i % 4) * 30;
      const by = y0 + 42 + Math.floor(i / 4) * 26;
      ctx.beginPath();
      ctx.arc(bx + 8, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = state.ringPassed[i] ? COLORS.ringGold : '#22303c';
      ctx.fill();
      ctx.strokeStyle = state.ringPassed[i] ? COLORS.ringGlow : '#3a4a5a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (state.ringPassed[i]) {
        ctx.fillStyle = '#3a2a00';
        ctx.font = '700 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', bx + 8, by + 3);
      }
    }
    ctx.fillStyle = COLORS.litGreen;
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score}`, rx, y0 + PANEL_H - 8);
  }

  // --- HUD (top of the screen). ---
  function drawHUD(state, time) {
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft % 60);
    const timeText = `${mins}:${String(secs).padStart(2, '0')}`;
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ALT ${Math.round(state.y * 3.28084).toLocaleString('en-US')} FT`, 16, 28);
    ctx.fillText(`SPD ${Math.round(state.speed)} KT`, 16, 50);
    ctx.fillText(`HDG ${String(Math.round(state.heading) % 360).padStart(3, '0')}°`, 16, 72);
    ctx.textAlign = 'right';
    ctx.fillStyle = state.timeLeft < 30 ? COLORS.litRed : '#ffffff';
    ctx.fillText(`TIME ${timeText}`, W - 16, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE ${state.score}`, W - 16, 50);
    ctx.fillStyle = COLORS.ringGold;
    ctx.fillText(`RINGS ${state.ringsHit}/${RINGS.length}`, W - 16, 72);
    ctx.shadowBlur = 0;

    // Next-ring pointer.
    const nxt = nextRing(state);
    if (nxt && state.screen === SCREEN_PLAY) {
      const cam = camera(state);
      const p = project(cam, [nxt.ring.x, nxt.ring.y, nxt.ring.z]);
      const dist = Math.round(Math.hypot(nxt.ring.x - state.x, nxt.ring.y - state.y, nxt.ring.z - state.z));
      if (p && p.x > 40 && p.x < W - 40 && p.y > 100 && p.y < H - PANEL_H - 30) {
        ctx.strokeStyle = COLORS.ringGold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = COLORS.ringGold;
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${dist} m`, p.x, p.y - 22);
      } else {
        // Off-screen: an edge arrow.
        const px = p ? p.x : W / 2;
        const py = p ? p.y : 100;
        const ax = clamp(px, 60, W - 60);
        const ay = clamp(py, 110, H - PANEL_H - 40);
        const ang = Math.atan2(py - (H * 0.6), px - W / 2);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = COLORS.ringGold;
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = COLORS.ringGold;
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${nxt.index + 1} · ${dist} m`, ax, ay - 16);
      }
    }

    // Centre message.
    if (state.messageTime > 0 && state.message) {
      ctx.font = '700 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = state.message === 'PULL UP' ? COLORS.litRed : COLORS.ringGold;
      ctx.fillText(state.message, W / 2, 120);
      ctx.shadowBlur = 0;
    }
    // Low-speed stall warning.
    if (state.speed < 55 && state.screen === SCREEN_PLAY) {
      const blink = Math.sin(time * 10) > 0;
      if (blink) {
        ctx.font = '700 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.litRed;
        ctx.fillText('STALL — ADD THROTTLE', W / 2, 150);
      }
    }
    // Final approach callout (lower when a centre message is showing).
    if (!nxt && state.screen === SCREEN_PLAY && state.z < COURSE.runway.z1) {
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.litGreen;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText('FINAL — GEAR DOWN · LAND ON THE RUNWAY', W / 2, state.messageTime > 0 ? 152 : 120);
      ctx.shadowBlur = 0;
    }
  }

  // --- Full-screen overlays. ---
  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4,10,18,0.62)';
    ctx.fillRect(0, 0, W, H - PANEL_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    ctx.fillText(title, W / 2, 190);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eef6fb';
    ctx.font = '400 18px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 240 + i * 30));
  }

  function drawTitle(state) {
    overlay('CENDRAWASIH COAST RUN', [
      'A morning mail run along the coast — thread eight gold rings,',
      'cross the river, skim the rooftops, and bring her home on the runway.',
      '',
      '↑ ↓ pitch      ← → bank & turn      SHIFT / CTRL throttle',
      'Mouse steers · wheel = throttle · P pause · M mute · R restart',
      '',
      'Press ENTER or click to fly',
    ], COLORS.ringGold);
  }

  function drawOver(state) {
    overlay('FLIGHT OVER', [
      state.reason,
      `Score ${state.score} · Rings ${state.ringsHit}/${RINGS.length}`,
      '',
      'Press R to fly again',
    ], COLORS.litRed);
  }

  function drawWin(state) {
    overlay('WELCOME HOME', [
      state.reason,
      `Final score ${state.score} · Rings ${state.ringsHit}/${RINGS.length}`,
      state.landedSoft ? 'A feather-soft touchdown — the tower is impressed.' : 'Down safe on the runway.',
      '',
      'Press R to fly again',
    ], COLORS.litGreen);
  }

  function drawPause() {
    overlay('PAUSED', ['Press P to keep flying'], '#e8f4ff');
  }

  // --- Frame. ---
  function draw(state, terrain, ui) {
    const cam = camera(state);
    // Base fill so no pixel is ever left unpainted.
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(0, 0, W, H);
    const horizonY = drawSky(cam, state.time);
    ctx.fillStyle = mix(C.grass, C.skyHorizon, 0.25);
    ctx.fillRect(0, horizonY, W, H - horizonY);
    drawClouds(cam, terrain);
    drawTerrain(cam, terrain, state);
    drawBuildings(cam, terrain);
    drawTrees(cam, terrain);
    drawRings(cam, state);
    if (state.screen !== SCREEN_TITLE) drawPlane(state, state.time);
    drawPanel(state, state.time);
    if (state.screen === SCREEN_PLAY || ui.paused) drawHUD(state, state.time);
    if (state.screen === SCREEN_TITLE) drawTitle(state);
    else if (state.screen === SCREEN_OVER) drawOver(state);
    else if (state.screen === SCREEN_WIN) drawWin(state);
    else if (ui.paused) drawPause();
  }

  return { draw, project, camera };
}
