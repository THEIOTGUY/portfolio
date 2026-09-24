/*
 * Hero simulation: a mobile robot with a single 360° camera drives a figure-eight
 * and incrementally builds a 3D Gaussian Splatting map of the room around it.
 *
 * Rendering is plain Canvas 2D. Every splat is an anisotropic 3D Gaussian; each
 * frame its covariance is pushed through the projection Jacobian to get a 2D
 * ellipse, which is drawn as a pre-rendered Gaussian sprite under an affine
 * transform (Cholesky factor of the 2D covariance). The same splats are also
 * projected into an equirectangular image to show what the 360° camera sees.
 */
window.createSplatScene = function (mapCanvas, camCanvas, hud, reduceMotion) {
    const TAU = Math.PI * 2;
    const REVEAL = 2.8;   // radius (m) around the robot that gets mapped
    const LAP = 30;       // seconds per figure-eight; the map resets each lap
    const CAM_H = 0.9;    // 360° camera height on its mast (m)
    const INK = 0, INK2 = 1, INK3 = 2, ACCENT = 3;
    const SPR = 64, SIG = 2.6; // sprite resolution; sprite spans ±SIG standard deviations

    // Deterministic RNG so the scene is identical on every visit
    let seed = 11;
    const rand = () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const jit = (a) => (rand() - 0.5) * 2 * a;

    // ---------------------------------------------------------------- scene
    // A splat: centre, per-axis std-dev (sx along local x, sy up, sz along local z),
    // a yaw that orients the local x/z axes, palette colour and opacity.
    const splats = [];
    const obstacles = [];
    const add = (x, y, z, sx, sy, sz, rot, color, alpha, obs = -1) => {
        splats.push({ x, y, z, sx, sy, sz, c: Math.cos(rot), s: Math.sin(rot), color, alpha, obs, seen: 0, fresh: 0 });
    };

    // Floor
    for (let x = -6; x <= 6.01; x += 0.36) {
        for (let z = -4; z <= 4.01; z += 0.36) {
            add(x + jit(0.12), 0, z + jit(0.12), 0.07 + rand() * 0.08, 0.01, 0.055 + rand() * 0.05,
                rand() * TAU, rand() < 0.3 ? INK2 : INK3, 0.35 + rand() * 0.35);
        }
    }
    // Back wall (z = -4.25) and left wall (x = -6.25)
    for (let x = -6; x <= 6.01; x += 0.4) {
        for (let y = 0.12; y < 1.9; y += 0.36) {
            add(x + jit(0.08), y + jit(0.06), -4.25, 0.07 + rand() * 0.05, 0.06 + rand() * 0.05, 0.012,
                0, rand() < 0.5 ? INK2 : INK3, 0.35 + rand() * 0.3);
        }
    }
    for (let z = -4; z <= 4.01; z += 0.4) {
        for (let y = 0.12; y < 1.9; y += 0.36) {
            add(-6.25, y + jit(0.06), z + jit(0.08), 0.07 + rand() * 0.05, 0.06 + rand() * 0.05, 0.012,
                Math.PI / 2, rand() < 0.5 ? INK2 : INK3, 0.35 + rand() * 0.3);
        }
    }

    function box(name, cx, cz, w, h, d, rot) {
        const id = obstacles.length, start = splats.length, step = 0.18, g = step * 0.38;
        const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
        const put = (lx, ly, lz, sx, sy, sz, r) => add(
            cx + lx * c - lz * s, ly, cz + lx * s + lz * c, sx, sy, sz, rot + r, ACCENT, 0.6 + rand() * 0.35, id);
        for (let lx = -hw + step / 2; lx < hw; lx += step) {
            for (let ly = step / 2; ly < h; ly += step) {
                put(lx + jit(0.03), ly, hd, g, g, 0.01, 0);
                put(lx + jit(0.03), ly, -hd, g, g, 0.01, 0);
            }
            for (let lz = -hd + step / 2; lz < hd; lz += step) put(lx, h, lz + jit(0.03), g, 0.01, g, 0);
        }
        for (let lz = -hd + step / 2; lz < hd; lz += step) {
            for (let ly = step / 2; ly < h; ly += step) {
                put(hw, ly, lz + jit(0.03), g, g, 0.01, Math.PI / 2);
                put(-hw, ly, lz + jit(0.03), g, g, 0.01, Math.PI / 2);
            }
        }
        const footprint = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
            .map(([lx, lz]) => [cx + lx * c - lz * s, cz + lx * s + lz * c]);
        obstacles.push({ name, cx, cz, start, end: splats.length, footprint, detect: 0 });
    }

    function cylinder(name, cx, cz, r, h, head) {
        const id = obstacles.length, start = splats.length;
        const n = Math.max(10, Math.round(TAU * r / 0.15));
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            for (let y = 0.08; y < h; y += 0.16) {
                add(cx + r * Math.cos(a), y + jit(0.03), cz + r * Math.sin(a),
                    (TAU * r / n) * 0.42, 0.065, 0.01, a - Math.PI / 2, ACCENT, 0.6 + rand() * 0.35, id);
            }
        }
        add(cx, h, cz, r * 0.55, 0.01, r * 0.55, 0, ACCENT, 0.7, id);
        if (head) add(cx, h + 0.19, cz, 0.08, 0.1, 0.08, 0, ACCENT, 0.95, id);
        const footprint = [];
        for (let i = 0; i < 16; i++) footprint.push([cx + r * Math.cos(i / 16 * TAU), cz + r * Math.sin(i / 16 * TAU)]);
        obstacles.push({ name, cx, cz, start, end: splats.length, footprint, detect: 0 });
    }

    box('box', 2.4, 0.1, 1.1, 0.9, 0.8, 0.35);
    cylinder('pillar', -2.5, 0, 0.38, 1.9, false);
    box('crate', 0.3, 2.95, 0.8, 0.55, 0.7, -0.2);
    cylinder('person', -0.5, -3.0, 0.22, 1.3, true);
    box('shelf', 3.7, -3.75, 1.5, 1.3, 0.45, 0);

    // Floaters: the stray Gaussians every real splat map has
    for (let i = 0; i < 36; i++) {
        add(jit(5.5), 0.2 + rand() * 1.5, jit(3.6), 0.05 + rand() * 0.08, 0.05 + rand() * 0.08, 0.05 + rand() * 0.08,
            rand() * TAU, INK3, 0.15 + rand() * 0.2);
    }

    // Robot, in its own frame (x = forward, y = up, z = sideways)
    const robotParts = [
        [0, 0.15, 0, 0.2, 0.08, 0.15, INK, 0.95],       // chassis
        [0, 0.25, 0, 0.17, 0.02, 0.13, INK2, 0.9],      // deck
        [0.15, 0.06, 0.19, 0.05, 0.05, 0.018, INK, 0.95],
        [-0.15, 0.06, 0.19, 0.05, 0.05, 0.018, INK, 0.95],
        [0.15, 0.06, -0.19, 0.05, 0.05, 0.018, INK, 0.95],
        [-0.15, 0.06, -0.19, 0.05, 0.05, 0.018, INK, 0.95],
        [0, 0.58, 0, 0.016, 0.26, 0.016, INK, 0.95],    // mast
        [0, CAM_H, 0, 0.055, 0.055, 0.055, ACCENT, 1]   // the 360° camera
    ];
    const robotSplats = robotParts.map(() => ({ x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, c: 1, s: 0, color: 0, alpha: 1 }));

    // Figure-eight path through the room, threading between the obstacles
    const pathAt = (u) => { const t = u * TAU; return [4 * Math.sin(t), 2.3 * Math.sin(2 * t)]; };
    const headingAt = (u) => {
        const t = u * TAU, dx = 4 * Math.cos(t), dz = 4.6 * Math.cos(2 * t), l = Math.hypot(dx, dz);
        return [dx / l, dz / l];
    };

    // ---------------------------------------------------------------- colours
    let palette = [], sprites = [];
    function makeSprite(color) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = SPR;
        const g = cv.getContext('2d');
        const img = g.createImageData(SPR, SPR);
        const r0 = SPR / 2, sig = r0 / SIG;
        for (let y = 0; y < SPR; y++) {
            for (let x = 0; x < SPR; x++) {
                const dx = x + 0.5 - r0, dy = y + 0.5 - r0, i = (y * SPR + x) * 4;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
                img.data[i + 3] = Math.round(255 * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig)));
            }
        }
        g.putImageData(img, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, SPR, SPR);
        return cv;
    }
    function refreshColors() {
        const cs = getComputedStyle(document.documentElement);
        palette = ['--ink', '--ink-2', '--ink-3', '--accent', '--accent-ink', '--bg-elev'].map(v => cs.getPropertyValue(v).trim());
        sprites = palette.slice(0, 4).map(makeSprite);
    }
    refreshColors();

    // ---------------------------------------------------------------- canvases
    const mctx = mapCanvas.getContext('2d');
    const cctx = camCanvas ? camCanvas.getContext('2d') : null;
    let MW = 0, MH = 0, CW = 0, CH = 0, dpr = 1;
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        const m = mapCanvas.getBoundingClientRect();
        MW = m.width; MH = m.height;
        mapCanvas.width = Math.round(MW * dpr); mapCanvas.height = Math.round(MH * dpr);
        if (camCanvas) {
            const c = camCanvas.getBoundingClientRect();
            CW = c.width; CH = c.height;
            camCanvas.width = Math.round(CW * dpr); camCanvas.height = Math.round(CH * dpr);
        }
    }

    // Draw one Gaussian with 2D covariance [[m00, m01], [m01, m11]] (px²) centred at (px, py)
    function drawSplat(ctx, spr, px, py, m00, m01, m11, alpha) {
        m00 += 0.35; m11 += 0.35; // small low-pass so sub-pixel splats stay visible
        const a = Math.sqrt(m00), b = m01 / a, c = Math.sqrt(Math.max(m11 - b * b, 0.05));
        ctx.globalAlpha = alpha;
        ctx.setTransform(a * dpr, b * dpr, 0, c * dpr, px * dpr, py * dpr);
        ctx.drawImage(spr, -SIG, -SIG, 2 * SIG, 2 * SIG);
    }

    // ---------------------------------------------------------------- state
    let simT = 0, lap = -1;
    let userYaw = 0, userPitch = 0;
    let robot = { x: 0, z: 0, hx: 1, hz: 0, u: 0 };

    function step(dt) {
        simT += dt;
        const thisLap = Math.floor(simT / LAP);
        if (thisLap !== lap) {
            lap = thisLap;
            for (const sp of splats) { sp.seen = 0; sp.fresh = 0; }
            for (const ob of obstacles) ob.detect = 0;
        }
        const lapTime = simT - lap * LAP;
        const u = (simT / LAP) % 1;
        const [x, z] = pathAt(u), [hx, hz] = headingAt(u);
        robot = { x, z, hx, hz, u };

        // Grow the mapped radius at the start of each lap, then integrate everything in range
        const R = REVEAL * Math.min(1, lapTime / 1.5), R2 = R * R;
        for (const sp of splats) {
            if (sp.seen < 1) {
                const dx = sp.x - x, dz = sp.z - z;
                if (dx * dx + dz * dz < R2) {
                    if (sp.seen === 0) sp.fresh = 1;
                    sp.seen = Math.min(1, sp.seen + dt * 2);
                }
            }
            if (sp.fresh > 0) sp.fresh = Math.max(0, sp.fresh - dt * 1.2);
        }
        for (const ob of obstacles) {
            let s = 0;
            for (let i = ob.start; i < ob.end; i++) s += splats[i].seen;
            const target = s / (ob.end - ob.start) > 0.35 ? 1 : 0;
            ob.detect += (target - ob.detect) * Math.min(1, dt * 4);
        }
    }

    function mapFade() {
        const phase = (simT / LAP) % 1;
        return phase > 0.94 ? 1 - (phase - 0.94) / 0.06 : 1;
    }

    // ---------------------------------------------------------------- orbit view
    function renderMap() {
        const W = MW, H = MH, ctx = mctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (!W || !H) return;

        const yaw = 0.35 * Math.sin(simT * 0.09) + userYaw;
        const pitch = Math.max(0.3, Math.min(1.2, 0.7 + userPitch));
        const dist = 12.5, F = Math.min(W * (W < 600 ? 0.84 : 0.74), H * 1.55), ox = W / 2, oy = H / 2 + H * 0.03;
        const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
        const Cx = dist * cp * sy, Cy = dist * sp, Cz = dist * cp * cy;
        const fx = -cp * sy, fy = -sp, fz = -cp * cy;
        let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
        const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;

        const P = [0, 0, 0]; // scratch: screen x, screen y, depth
        const project = (x, y, z) => {
            const dx = x - Cx, dy = y - Cy, dz = z - Cz;
            const Z = dx * fx + dy * fy + dz * fz;
            if (Z < 0.3) return false;
            P[0] = ox + (dx * rx + dz * rz) * F / Z;
            P[1] = oy - (dx * ux + dy * uy + dz * uz) * F / Z;
            P[2] = Z;
            return true;
        };
        const fade = mapFade();

        // Floor grid
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette[INK];
        ctx.globalAlpha = 0.07;
        ctx.beginPath();
        for (let gx = -6; gx <= 6; gx++) {
            if (project(gx, 0, -4)) { ctx.moveTo(P[0], P[1]); if (project(gx, 0, 4)) ctx.lineTo(P[0], P[1]); }
        }
        for (let gz = -4; gz <= 4; gz++) {
            if (project(-6, 0, gz)) { ctx.moveTo(P[0], P[1]); if (project(6, 0, gz)) ctx.lineTo(P[0], P[1]); }
        }
        ctx.stroke();

        const floorPoly = (pts, close) => {
            ctx.beginPath();
            pts.forEach(([x, z], i) => { if (project(x, 0.005, z)) ctx[i ? 'lineTo' : 'moveTo'](P[0], P[1]); });
            if (close) ctx.closePath();
        };

        // Occupied footprint of detected obstacles (under the splats)
        ctx.fillStyle = palette[ACCENT];
        for (const ob of obstacles) {
            if (ob.detect < 0.02) continue;
            ctx.globalAlpha = 0.16 * ob.detect * fade;
            floorPoly(ob.footprint, true);
            ctx.fill();
        }

        // Robot trail for this lap
        ctx.strokeStyle = palette[INK];
        ctx.globalAlpha = 0.35 * fade;
        ctx.lineWidth = 1.25;
        const trail = [];
        for (let i = 0; i <= 90; i++) trail.push(pathAt(robot.u * i / 90)); // laps start at u = 0
        floorPoly(trail, false);
        ctx.stroke();

        // Splats, back to front
        const vis = [];
        for (let i = 0; i < splats.length; i++) {
            const s = splats[i];
            if (s.seen <= 0.01) continue;
            if (!project(s.x, s.y, s.z)) continue;
            if (P[0] < -80 || P[0] > W + 80 || P[1] < -80 || P[1] > H + 80) continue;
            s.px = P[0]; s.py = P[1]; s.pz = P[2];
            vis.push(s);
        }
        vis.sort((a, b) => b.pz - a.pz);

        const drawProjected = (s, alpha, spr) => {
            // Jacobian of the perspective projection at the splat centre
            const X = (s.px - ox) * s.pz / F, Y = (oy - s.py) * s.pz / F, Z = s.pz;
            let m00 = 0, m01 = 0, m11 = 0;
            const axis = (ex, ey, ez) => {
                const dX = ex * rx + ez * rz, dY = ex * ux + ey * uy + ez * uz, dZ = ex * fx + ey * fy + ez * fz;
                const vx = F * (dX - X * dZ / Z) / Z, vy = -F * (dY - Y * dZ / Z) / Z;
                m00 += vx * vx; m01 += vx * vy; m11 += vy * vy;
            };
            axis(s.c * s.sx, 0, s.s * s.sx);
            axis(0, s.sy, 0);
            axis(-s.s * s.sz, 0, s.c * s.sz);
            drawSplat(ctx, spr, s.px, s.py, m00, m01, m11, alpha);
        };

        for (const s of vis) {
            drawProjected(s, s.alpha * s.seen * fade, sprites[s.color]);
            if (s.fresh > 0.02 && s.color !== ACCENT) drawProjected(s, s.fresh * 0.55 * fade, sprites[ACCENT]);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Obstacle outlines with a safety margin
        ctx.strokeStyle = palette[ACCENT];
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        for (const ob of obstacles) {
            if (ob.detect < 0.02) continue;
            ctx.globalAlpha = 0.8 * ob.detect * fade;
            const grow = 0.28;
            floorPoly(ob.footprint.map(([x, z]) => {
                const dx = x - ob.cx, dz = z - ob.cz, l = Math.hypot(dx, dz) || 1;
                return [x + dx / l * grow, z + dz / l * grow];
            }), true);
            ctx.stroke();
        }

        // 360° mapping range and the outgoing capture pulse
        const ring = (r) => {
            const pts = [];
            for (let i = 0; i <= 64; i++) pts.push([robot.x + r * Math.cos(i / 64 * TAU), robot.z + r * Math.sin(i / 64 * TAU)]);
            floorPoly(pts, false);
        };
        ctx.setLineDash([2, 5]);
        ctx.globalAlpha = 0.55;
        ring(REVEAL);
        ctx.stroke();
        ctx.setLineDash([]);
        const pulse = (simT % 1.8) / 1.8;
        ctx.globalAlpha = (1 - pulse) * 0.6;
        ring(REVEAL * pulse);
        ctx.stroke();

        // Planned path ahead
        const ahead = [];
        for (let i = 0; i <= 30; i++) ahead.push(pathAt(robot.u + 0.1 * i / 30));
        ctx.fillStyle = palette[ACCENT];
        ctx.globalAlpha = 1;
        ahead.forEach(([x, z], i) => {
            if (i % 2 || !project(x, 0.01, z)) return;
            ctx.beginPath();
            ctx.arc(P[0], P[1], 1.8, 0, TAU);
            ctx.fill();
        });

        // Robot on top
        const { x: rX, z: rZ, hx, hz } = robot;
        const rs = [];
        robotParts.forEach((p, i) => {
            const s = robotSplats[i];
            s.x = rX + p[0] * hx - p[2] * hz; s.y = p[1]; s.z = rZ + p[0] * hz + p[2] * hx;
            s.sx = p[3]; s.sy = p[4]; s.sz = p[5]; s.c = hx; s.s = hz; s.color = p[6]; s.alpha = p[7];
            if (project(s.x, s.y, s.z)) { s.px = P[0]; s.py = P[1]; s.pz = P[2]; rs.push(s); }
        });
        rs.sort((a, b) => b.pz - a.pz);
        for (const s of rs) drawProjected(s, s.alpha, sprites[s.color]);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- 360° camera view
    function renderCam() {
        if (!cctx) return;
        const W = CW, H = CH, ctx = cctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (!W || !H) return;

        const k = W / TAU;          // pixels per radian
        const el0 = -0.06;          // look slightly below the horizon
        const { x: cx, z: cz, hx, hz } = robot;
        const toPx = (az, el) => [W / 2 + az * k, H / 2 - (el - el0) * k];

        const vis = [];
        for (const s of splats) {
            const dx = s.x - cx, dy = s.y - CAM_H, dz = s.z - cz;
            const a = dx * hx + dz * hz, b = -dx * hz + dz * hx;
            const rho2 = a * a + b * b, d2 = rho2 + dy * dy;
            if (d2 < 0.15) continue;
            const rho = Math.sqrt(rho2), az = Math.atan2(b, a), el = Math.atan2(dy, rho);
            const [px, py] = toPx(az, el);
            if (py < -30 || py > H + 30) continue;
            let m00 = 0, m01 = 0, m11 = 0;
            const axis = (ex, ey, ez) => {
                const da = ex * hx + ez * hz, db = -ex * hz + ez * hx;
                const daz = (a * db - b * da) / rho2;
                const drho = (a * da + b * db) / rho;
                const del = (rho * ey - dy * drho) / d2;
                const vx = daz * k, vy = -del * k;
                m00 += vx * vx; m01 += vx * vy; m11 += vy * vy;
            };
            axis(s.c * s.sx, 0, s.s * s.sx);
            axis(0, s.sy, 0);
            axis(-s.s * s.sz, 0, s.c * s.sz);
            if (m00 + m11 > 900) continue; // too close to the lens
            vis.push({ s, px, py, m00, m01, m11, d2 });
        }
        vis.sort((p, q) => q.d2 - p.d2);
        for (const v of vis) {
            const spr = sprites[v.s.color], al = Math.min(1, v.s.alpha * 1.25);
            drawSplat(ctx, spr, v.px, v.py, v.m00, v.m01, v.m11, al);
            if (v.px < 40) drawSplat(ctx, spr, v.px + W, v.py, v.m00, v.m01, v.m11, al);
            if (v.px > W - 40) drawSplat(ctx, spr, v.px - W, v.py, v.m00, v.m01, v.m11, al);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Horizon and heading ticks
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = palette[INK];
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        const hy = H / 2 + el0 * k;
        ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
        ctx.textBaseline = 'bottom';
        const labels = { '-4': 'B', '-2': 'L', '0': 'F', '2': 'R', '4': 'B' };
        for (let q = -4; q <= 4; q++) {
            const x = W / 2 + q * Math.PI / 4 * k;
            ctx.globalAlpha = 0.35;
            ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, H - (labels[q] ? 8 : 4)); ctx.stroke();
            if (labels[q]) {
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = palette[INK2];
                ctx.textAlign = q === -4 ? 'left' : q === 4 ? 'right' : 'center';
                ctx.fillText(labels[q], x + (q === -4 ? 4 : q === 4 ? -4 : 0), H - 10);
            }
        }

        // Obstacle detections as boxes in the panorama
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const ob of obstacles) {
            const dxc = ob.cx - cx, dzc = ob.cz - cz;
            const range = Math.hypot(dxc, dzc);
            if (range > 4.6) continue;
            const azc = Math.atan2(-dxc * hz + dzc * hx, dxc * hx + dzc * hz);
            let minA = Infinity, maxA = -Infinity, minE = Infinity, maxE = -Infinity;
            for (let i = ob.start; i < ob.end; i++) {
                const s = splats[i];
                const dx = s.x - cx, dy = s.y - CAM_H, dz = s.z - cz;
                const a = dx * hx + dz * hz, b = -dx * hz + dz * hx;
                let az = Math.atan2(b, a) - azc;
                if (az > Math.PI) az -= TAU; else if (az < -Math.PI) az += TAU;
                const el = Math.atan2(dy, Math.hypot(a, b));
                minA = Math.min(minA, az); maxA = Math.max(maxA, az);
                minE = Math.min(minE, el); maxE = Math.max(maxE, el);
            }
            const conf = Math.min(1, (4.6 - range) / 0.8);
            const x0 = W / 2 + (azc + minA) * k - 3, x1 = W / 2 + (azc + maxA) * k + 3;
            const y0 = H / 2 - (maxE - el0) * k - 3, y1 = H / 2 - (minE - el0) * k + 3;
            for (const shift of [0, W, -W]) {
                if (x1 + shift < 0 || x0 + shift > W) continue;
                ctx.globalAlpha = conf;
                ctx.strokeStyle = palette[ACCENT];
                ctx.lineWidth = 1.25;
                ctx.strokeRect(x0 + shift, y0, x1 - x0, y1 - y0);
                const label = `${ob.name} ${range.toFixed(1)}m`;
                const tw = ctx.measureText(label).width + 8;
                const ly = Math.max(7, y0 - 7);
                ctx.fillStyle = palette[ACCENT];
                ctx.fillRect(x0 + shift, ly - 7, tw, 14);
                ctx.fillStyle = palette[4];
                ctx.fillText(label, x0 + shift + 4, ly + 0.5);
            }
        }
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- HUD
    let hudTimer = 0;
    function updateHud() {
        let n = 0;
        for (const s of splats) if (s.seen > 0.5) n++;
        const obs = obstacles.filter(o => o.detect > 0.5).length;
        if (hud.splats) hud.splats.textContent = n.toLocaleString();
        if (hud.obs) hud.obs.textContent = `${obs} / ${obstacles.length}`;
        const deg = Math.round(Math.atan2(robot.hz, robot.hx) * 180 / Math.PI);
        if (hud.pose) hud.pose.textContent = `${robot.x.toFixed(2)}, ${robot.z.toFixed(2)} · ${deg}°`;
        const lt = simT - Math.max(0, lap) * LAP;
        if (hud.time) hud.time.textContent = `t ${String(Math.floor(lt / 60)).padStart(2, '0')}:${(lt % 60).toFixed(1).padStart(4, '0')}`;
    }

    function renderAll() { renderMap(); renderCam(); updateHud(); }

    // ---------------------------------------------------------------- interaction
    let dragging = false, lastX = 0, lastY = 0;
    mapCanvas.addEventListener('pointerdown', (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        mapCanvas.setPointerCapture(e.pointerId);
    });
    mapCanvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        userYaw -= (e.clientX - lastX) * 0.006;
        userPitch = Math.max(-0.3, Math.min(0.55, userPitch + (e.clientY - lastY) * 0.004));
        lastX = e.clientX; lastY = e.clientY;
        if (!running) renderAll();
    });
    const endDrag = () => { dragging = false; };
    mapCanvas.addEventListener('pointerup', endDrag);
    mapCanvas.addEventListener('pointercancel', endDrag);

    // ---------------------------------------------------------------- loop
    let running = false, rafId = 0, last = 0, visible = false;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000 || 0);
        last = now;
        step(dt);
        renderMap();
        renderCam();
        if ((hudTimer += dt) > 0.1) { hudTimer = 0; updateHud(); }
        rafId = requestAnimationFrame(frame);
    }
    const start = () => {
        if (running || reduceMotion || !visible || document.hidden) return;
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; cancelAnimationFrame(rafId); };

    resize();
    if (reduceMotion) {
        // Static frame: a finished map part-way round the loop
        simT = LAP * 0.3;
        lap = 0;
        const [x, z] = pathAt(0.3), [hx, hz] = headingAt(0.3);
        robot = { x, z, hx, hz, u: 0.3 };
        for (const sp of splats) sp.seen = 1;
        for (const ob of obstacles) ob.detect = 1;
    } else {
        step(0);
    }
    renderAll();

    const ro = new ResizeObserver(() => { resize(); if (!running) renderAll(); });
    ro.observe(mapCanvas);
    if (camCanvas) ro.observe(camCanvas);
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        visible ? start() : stop();
    }).observe(mapCanvas);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

    return {
        refreshColors() { refreshColors(); if (!running) renderAll(); }
    };
};
