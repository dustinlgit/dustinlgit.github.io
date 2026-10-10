(() => {
    const body = document.body;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easeIn = t => t * t * t;

    const AMBER = '255, 181, 71';
    const HAZE = '134, 152, 175';
    const ABYSS = '#07101C';

    /* ---------------- Clocks ---------------- */

    const localEl = document.getElementById('clock-local');
    const zuluEl = document.getElementById('clock-zulu');
    const localFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });

    function tick() {
        const now = new Date();
        if (localEl) localEl.textContent = localFmt.format(now);
        if (zuluEl) zuluEl.textContent = now.toISOString().slice(11, 19) + 'Z';
    }
    tick();
    setInterval(tick, 1000);

    /* ---------------- Nav border on scroll ---------------- */

    const nav = document.querySelector('.nav');
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------------- Intro: radar acquisition ---------------- */

    const intro = document.getElementById('intro');
    const canvas = intro.querySelector('.intro-canvas');
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0, raf = 0, t0 = 0, running = false, revealed = false;

    // Deterministic pseudo-random so the scope looks the same every time
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    const target = { b: 52 * Math.PI / 180, r: 0.58, drift: 0 };
    const blips = Array.from({ length: 11 }, () => ({
        b: rnd() * Math.PI * 2,
        r: 0.18 + rnd() * 0.75,
        drift: (rnd() - 0.5) * 0.02
    })).filter(p => Math.abs(p.b - target.b) > 0.35 || Math.abs(p.r - target.r) > 0.2);

    const SWEEP_START = 0.9;   // seconds
    const SWEEP_PERIOD = 2.0;  // seconds per revolution
    const LOCK_START = 2.6, LOCK_END = 3.4;
    const ZOOM_START = 4.2, ZOOM_END = 5.1;
    const REVEAL_AT = 4.75, FINISH_AT = 6.4;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sweepBearing(t) {
        return ((t - SWEEP_START) / SWEEP_PERIOD) * Math.PI * 2;
    }

    // Brightness of a contact: bright when the beam passes, then phosphor decay
    function intensity(b, t) {
        if (t < SWEEP_START) return 0;
        const sb = sweepBearing(t);
        if (sb < b) return 0;
        const delta = ((sb - b) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        return Math.exp(-delta / 2.4);
    }

    function frame(now) {
        const t = (now - t0) / 1000;
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.4;
        const toXY = (b, r) => [cx + Math.sin(b) * r * R, cy - Math.cos(b) * r * R];
        const [tx, ty] = toXY(target.b, target.r);

        ctx.fillStyle = ABYSS;
        ctx.fillRect(0, 0, W, H);

        // Zoom into the locked track
        const z = easeIn(clamp((t - ZOOM_START) / (ZOOM_END - ZOOM_START)));
        const scale = 1 + z * 16;
        const fade = 1 - clamp((t - (ZOOM_START + 0.45)) / 0.5);

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(lerp(tx, cx, z), lerp(ty, cy, z));
        ctx.scale(scale, scale);
        ctx.translate(-tx, -ty);

        // Scope face glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
        glow.addColorStop(0, `rgba(${AMBER}, ${0.05 * (1 - z)})`);
        glow.addColorStop(1, 'rgba(255, 181, 71, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // Range rings
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            const p = easeOut(clamp((t - 0.1 - i * 0.08) / 0.7));
            if (p <= 0) continue;
            ctx.strokeStyle = `rgba(${HAZE}, ${i === 4 ? 0.5 : 0.22})`;
            ctx.beginPath();
            ctx.arc(cx, cy, (R * i / 4) * p, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Crosshair and bearing ticks
        const tickAlpha = clamp((t - 0.5) / 0.6);
        if (tickAlpha > 0) {
            ctx.strokeStyle = `rgba(${HAZE}, ${0.14 * tickAlpha})`;
            ctx.beginPath();
            ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
            ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
            ctx.stroke();

            ctx.strokeStyle = `rgba(${HAZE}, ${0.5 * tickAlpha})`;
            ctx.fillStyle = `rgba(${HAZE}, ${0.7 * tickAlpha})`;
            ctx.font = '10px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.beginPath();
            for (let d = 0; d < 360; d += 5) {
                const a = d * Math.PI / 180;
                const len = d % 30 === 0 ? 10 : d % 10 === 0 ? 6 : 3;
                const s = Math.sin(a), c = Math.cos(a);
                ctx.moveTo(cx + s * R, cy - c * R);
                ctx.lineTo(cx + s * (R + len), cy - c * (R + len));
                if (d % 30 === 0) {
                    ctx.fillText(String(d).padStart(3, '0'), cx + s * (R + 24), cy - c * (R + 24));
                }
            }
            ctx.stroke();
        }

        // Sweep beam with phosphor trail (fades out as we zoom)
        ctx.globalAlpha = fade * (1 - z);
        if (t > SWEEP_START) {
            const sb = sweepBearing(t);
            const trail = 1.1;
            const a1 = sb - Math.PI / 2;
            if (ctx.createConicGradient) {
                // Smooth phosphor trail behind the beam
                const cg = ctx.createConicGradient(a1 - trail, cx, cy);
                const f = trail / (Math.PI * 2);
                cg.addColorStop(0, `rgba(${AMBER}, 0)`);
                cg.addColorStop(f * 0.6, `rgba(${AMBER}, 0.05)`);
                cg.addColorStop(f, `rgba(${AMBER}, 0.22)`);
                cg.addColorStop(Math.min(f + 0.0005, 1), `rgba(${AMBER}, 0)`);
                ctx.fillStyle = cg;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, R, a1 - trail, a1);
                ctx.closePath();
                ctx.fill();
            } else {
                const slices = 40, step = trail / slices;
                for (let k = 0; k < slices; k++) {
                    const end = a1 - k * step;
                    ctx.fillStyle = `rgba(${AMBER}, ${0.2 * Math.pow(1 - k / slices, 1.6)})`;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx, cy, R, end - step, end + 0.004);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.strokeStyle = `rgba(${AMBER}, 0.95)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.sin(sb) * R, cy - Math.cos(sb) * R);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
        ctx.globalAlpha = fade;

        // Contacts
        const drawBlip = (x, y, I, size) => {
            if (I < 0.02) return;
            ctx.fillStyle = `rgba(${AMBER}, ${I * 0.22})`;
            ctx.beginPath(); ctx.arc(x, y, size * 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(${AMBER}, ${I})`;
            ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        };

        blips.forEach(p => {
            const b = p.b + p.drift * t;
            const [x, y] = toXY(b, p.r);
            drawBlip(x, y, intensity(b, t) * 0.75, 2);
        });

        const lockP = easeOut(clamp((t - LOCK_START) / (LOCK_END - LOCK_START)));
        drawBlip(tx, ty, Math.max(intensity(target.b, t), lockP * 0.95), 2.6);

        // Lock brackets close in on the target
        if (lockP > 0) {
            const blink = t > LOCK_END && t < ZOOM_START ? (Math.floor((t - LOCK_END) * 6) % 2 ? 0.55 : 1) : 1;
            const s = lerp(110, 20, lockP);
            const arm = s * 0.38;
            ctx.strokeStyle = `rgba(${AMBER}, ${lockP * blink})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
                const x = tx + sx * s, y = ty + sy * s;
                ctx.moveTo(x, y - sy * arm); ctx.lineTo(x, y); ctx.lineTo(x - sx * arm, y);
            });
            ctx.stroke();
            ctx.lineWidth = 1;
        }

        // Track label types out after lock
        if (t > LOCK_END - 0.1) {
            const lines = ['TRK 0417  IFF FRIEND', 'BRG 052  RNG 34.2 NM'];
            const chars = Math.floor((t - (LOCK_END - 0.1)) * 40);
            const flip = tx + 190 > W;
            ctx.font = '11px "IBM Plex Mono", monospace';
            ctx.textAlign = flip ? 'right' : 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = `rgba(${AMBER}, ${0.95 * clamp(1 - z * 4)})`;
            const lx = flip ? tx - 32 : tx + 32;
            let used = 0;
            lines.forEach((line, i) => {
                const n = clamp(chars - used, 0, line.length);
                used += line.length;
                if (n > 0) ctx.fillText(line.slice(0, n), lx, ty - 10 + i * 16);
            });
        }

        ctx.restore();

        // Amber flash as we punch through
        const flash = clamp(1 - Math.abs(t - (ZOOM_END - 0.15)) / 0.22);
        if (flash > 0) {
            ctx.fillStyle = `rgba(${AMBER}, ${flash * 0.06})`;
            ctx.fillRect(0, 0, W, H);
        }

        if (!revealed && t >= REVEAL_AT) {
            revealed = true;
            intro.classList.add('reveal');
        }
        if (t >= FINISH_AT) {
            finish();
            return;
        }
        raf = requestAnimationFrame(frame);
    }

    function play() {
        intro.style.display = '';
        intro.classList.remove('done', 'reveal', 'playing');
        void intro.offsetWidth; // restart CSS animations
        intro.classList.add('playing');
        body.classList.add('intro-active');
        body.classList.remove('ready');
        window.scrollTo(0, 0);
        resize();
        revealed = false;
        running = true;
        t0 = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
    }

    function finish() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
        intro.classList.add('done');
        body.classList.remove('intro-active');
        body.classList.add('ready');
        try { sessionStorage.setItem('dl-intro-seen', '1'); } catch (e) { /* storage unavailable */ }
    }

    function skipImmediately() {
        intro.style.display = 'none';
        intro.classList.add('done');
        body.classList.remove('intro-active');
        body.classList.add('ready');
    }

    intro.addEventListener('click', finish);
    window.addEventListener('keydown', e => {
        if (running && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            finish();
        }
    });
    window.addEventListener('resize', () => { if (running) resize(); });

    document.getElementById('replay-intro').addEventListener('click', play);

    let seen = false;
    try { seen = sessionStorage.getItem('dl-intro-seen') === '1'; } catch (e) { /* storage unavailable */ }

    if (reduceMotion || seen) {
        skipImmediately();
    } else {
        // Wait for fonts so the scope labels render in the right face
        const go = () => play();
        if (document.fonts && document.fonts.ready) {
            Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))]).then(go);
        } else {
            go();
        }
    }

    /* ---------------- Hero: orbital tracks ---------------- */

    const hero = document.querySelector('.hero');
    const hc = document.querySelector('.hero-orbits');
    const hctx = hc.getContext('2d');
    let HW = 0, HH = 0, heroRaf = 0, heroVisible = true;

    const orbits = [
        { rx: 0.95, ry: 0.26, rot: -0.38, speed: 0.05, sats: [0.1, 3.4] },
        { rx: 0.62, ry: 0.46, rot: 0.55, speed: -0.075, sats: [1.8] },
        { rx: 1.25, ry: 0.16, rot: -0.12, speed: 0.03, sats: [4.6] }
    ];

    function heroResize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        HW = hero.clientWidth;
        HH = hero.clientHeight;
        hc.width = HW * dpr;
        hc.height = HH * dpr;
        hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function heroDraw(time) {
        const t = time / 1000;
        const mobile = HW < 900;
        const cx = mobile ? HW * 0.72 : HW * 0.68;
        const cy = mobile ? HH * 0.22 : HH * 0.36;
        const S = Math.min(HW * (mobile ? 0.42 : 0.3), HH * 0.42);
        const planetR = S * 0.34;

        hctx.clearRect(0, 0, HW, HH);

        const pointOn = (o, th) => {
            const x = Math.cos(th) * o.rx * S, y = Math.sin(th) * o.ry * S;
            const c = Math.cos(o.rot), s = Math.sin(o.rot);
            return [cx + x * c - y * s, cy + x * s + y * c];
        };

        const drawArc = (o, from, to, alpha) => {
            hctx.strokeStyle = `rgba(${HAZE}, ${alpha})`;
            hctx.beginPath();
            for (let i = 0; i <= 80; i++) {
                const [x, y] = pointOn(o, lerp(from, to, i / 80));
                i ? hctx.lineTo(x, y) : hctx.moveTo(x, y);
            }
            hctx.stroke();
        };

        hctx.lineWidth = 1;
        // Far side of each orbit
        orbits.forEach(o => drawArc(o, Math.PI, Math.PI * 2, 0.12));

        // Planet
        const g = hctx.createRadialGradient(cx - planetR * 0.35, cy - planetR * 0.4, planetR * 0.1, cx, cy, planetR);
        g.addColorStop(0, '#16263C');
        g.addColorStop(1, '#0A1422');
        hctx.fillStyle = g;
        hctx.beginPath(); hctx.arc(cx, cy, planetR, 0, Math.PI * 2); hctx.fill();
        hctx.strokeStyle = `rgba(${HAZE}, 0.3)`;
        hctx.stroke();

        // Graticule on the planet
        hctx.save();
        hctx.beginPath(); hctx.arc(cx, cy, planetR, 0, Math.PI * 2); hctx.clip();
        hctx.strokeStyle = `rgba(${HAZE}, 0.1)`;
        for (let i = -2; i <= 2; i++) {
            hctx.beginPath();
            hctx.ellipse(cx, cy + i * planetR * 0.36, planetR * Math.sqrt(1 - Math.pow(i * 0.36, 2)), planetR * 0.08, 0, 0, Math.PI * 2);
            hctx.stroke();
        }
        const spin = (t * 0.08) % (Math.PI / 3);
        for (let k = 0; k < 3; k++) {
            const a = spin + k * Math.PI / 3;
            hctx.beginPath();
            hctx.ellipse(cx, cy, Math.abs(Math.cos(a)) * planetR, planetR, 0, 0, Math.PI * 2);
            hctx.stroke();
        }
        hctx.restore();

        // Near side of each orbit
        orbits.forEach(o => drawArc(o, 0, Math.PI, 0.3));

        // Satellites
        orbits.forEach(o => {
            o.sats.forEach(phase => {
                const th = ((phase + t * o.speed * Math.PI * 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                const [x, y] = pointOn(o, th);
                const behind = th > Math.PI && Math.hypot(x - cx, y - cy) < planetR;
                if (behind) return;
                const far = th > Math.PI;
                hctx.fillStyle = `rgba(${AMBER}, ${far ? 0.18 : 0.25})`;
                hctx.beginPath(); hctx.arc(x, y, 6, 0, Math.PI * 2); hctx.fill();
                hctx.fillStyle = `rgba(${AMBER}, ${far ? 0.5 : 0.95})`;
                hctx.beginPath(); hctx.arc(x, y, 2.2, 0, Math.PI * 2); hctx.fill();
            });
        });
    }

    function heroLoop(time) {
        heroDraw(time);
        if (heroVisible && !reduceMotion) heroRaf = requestAnimationFrame(heroLoop);
    }

    heroResize();
    heroDraw(performance.now());
    window.addEventListener('resize', () => { heroResize(); heroDraw(performance.now()); });

    if (!reduceMotion) {
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(entries => {
                heroVisible = entries[0].isIntersecting;
                cancelAnimationFrame(heroRaf);
                if (heroVisible) heroRaf = requestAnimationFrame(heroLoop);
            }).observe(hero);
        } else {
            heroRaf = requestAnimationFrame(heroLoop);
        }
    }
})();