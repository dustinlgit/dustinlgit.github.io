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

    /* ---------------- Decrypt text effect ---------------- */

    const GLYPHS = 'ABCDEF0123456789#$%&@*+=/<>\\[]{}';
    const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

    // Characters lock in left to right; the next few ahead show random glyphs
    function decrypt(str, resolved, lead = 4) {
        let out = '';
        for (let i = 0; i < str.length && i < resolved + lead; i++) {
            out += i < resolved || str[i] === ' ' ? str[i] : glyph();
        }
        return out;
    }

    // DOM version: the whole string scrambles, then each character settles in turn
    function decryptEl(el, duration = 900) {
        const text = el.dataset.text || (el.dataset.text = el.textContent);
        const start = performance.now();
        const settle = Array.from(text, (_, i) => (0.25 + 0.75 * (i / text.length)) * duration * (0.85 + Math.random() * 0.3));
        cancelAnimationFrame(el._decrypt);
        const step = now => {
            const e = now - start;
            let html = '', done = true;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === ' ' || e >= settle[i]) {
                    html += text[i];
                } else {
                    done = false;
                    html += `<span class="enc">${glyph().replace('<', '&lt;').replace('>', '&gt;')}</span>`;
                }
            }
            el.innerHTML = html;
            if (!done) el._decrypt = requestAnimationFrame(step);
        };
        el._decrypt = requestAnimationFrame(step);
    }

    /* ---------------- Intro: radar acquisition ---------------- */

    const intro = document.getElementById('intro');
    const canvas = intro.querySelector('.intro-canvas');
    const ctx = canvas.getContext('2d');
    const soundBtn = intro.querySelector('.intro-sound');

    const GREEN = '120, 255, 160';   // P7 phosphor
    const MAP = '70, 200, 120';      // map video overlay
    const SCOPE_BG = '#040A08';

    let W = 0, H = 0, raf = 0, t0 = 0, running = false, revealed = false, gated = false;

    // Deterministic pseudo-random so the scope looks the same every time
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    // Radar site sits offshore, west of Catalina. Everything is placed by real lat/lon.
    const SITE = { lat: 33.40, lon: -118.90 };
    const RANGE_NM = 80;
    const cosLat = Math.cos(SITE.lat * Math.PI / 180);
    const geo = (lat, lon) => {
        const x = (lon - SITE.lon) * 60 * cosLat;
        const y = (lat - SITE.lat) * 60;
        return { b: (Math.atan2(x, y) + Math.PI * 2) % (Math.PI * 2), r: Math.hypot(x, y) / RANGE_NM };
    };

    const LA = { lat: 34.0522, lon: -118.2437 };
    const target = geo(LA.lat, LA.lon);
    const targetBrg = String(Math.round(target.b * 180 / Math.PI)).padStart(3, '0');
    const targetRng = (target.r * RANGE_NM).toFixed(1);

    const COAST = [
        [34.58, -120.65], [34.45, -120.47], [34.47, -120.10], [34.42, -119.70], [34.39, -119.50],
        [34.28, -119.30], [34.15, -119.20], [34.10, -119.06], [34.04, -118.85], [34.03, -118.68],
        [34.01, -118.50], [33.90, -118.42], [33.80, -118.40], [33.74, -118.41], [33.71, -118.29],
        [33.75, -118.20], [33.74, -118.10], [33.65, -117.98], [33.60, -117.88], [33.54, -117.78],
        [33.46, -117.70], [33.38, -117.59], [33.20, -117.39], [33.05, -117.30], [32.85, -117.27],
        [32.75, -117.25], [32.68, -117.24], [32.53, -117.12], [32.30, -117.05], [32.00, -116.88]
    ].map(([la, lo]) => geo(la, lo));

    const ISLANDS = [
        [[33.48, -118.60], [33.45, -118.50], [33.40, -118.40], [33.33, -118.32], [33.31, -118.31], [33.36, -118.42], [33.43, -118.55], [33.48, -118.60]],
        [[33.03, -118.60], [32.95, -118.50], [32.82, -118.38], [32.84, -118.36], [32.98, -118.55], [33.03, -118.60]],
        [[34.06, -119.92], [34.03, -119.55], [33.96, -119.53], [33.98, -119.88], [34.06, -119.92]],
        [[34.02, -120.20], [33.95, -120.03], [33.90, -119.98], [33.90, -120.22], [34.02, -120.20]]
    ].map(poly => poly.map(([la, lo]) => geo(la, lo)));

    const PLACES = [
        ['SANTA BARBARA', 34.42, -119.70],
        ['SAN DIEGO', 32.72, -117.16],
        ['CATALINA', 33.40, -118.42]
    ].map(([name, la, lo]) => ({ name, ...geo(la, lo) }));

    const blips = Array.from({ length: 11 }, () => ({
        b: rnd() * Math.PI * 2,
        r: 0.18 + rnd() * 0.75,
        drift: (rnd() - 0.5) * 0.02
    })).filter(p => Math.abs(p.b - target.b) > 0.35 || Math.abs(p.r - target.r) > 0.2);

    const SWEEP_START = 0.9;   // seconds
    const SWEEP_PERIOD = 2.0;  // seconds per revolution
    const SAT_START = 1.2, SAT_END = 3.3;
    const LOCK_START = 3.0, LOCK_END = 3.8;
    const ZOOM_START = 4.8, ZOOM_END = 5.7;
    const REVEAL_AT = 5.35, FINISH_AT = 7.0;

    /* ---------------- Intro: sound ---------------- */

    // Everything is synthesized with Web Audio, so there are no audio files to load.
    const sound = (() => {
        const AC = window.AudioContext || window.webkitAudioContext;
        const VOLUME = 0.9;
        let ac = null, master = null, bus = null, noise = null;
        let muted = false;
        try { muted = localStorage.getItem('dl-intro-muted') === '1'; } catch (e) { /* storage unavailable */ }

        // Must be called from a click or key press, or the browser keeps audio blocked
        function unlock() {
            if (!AC) return;
            if (!ac) {
                ac = new AC();
                const comp = ac.createDynamicsCompressor();
                comp.threshold.value = -16;
                comp.ratio.value = 4;
                master = ac.createGain();
                master.gain.value = muted ? 0 : VOLUME;
                master.connect(comp);
                comp.connect(ac.destination);

                const len = ac.sampleRate * 2;
                noise = ac.createBuffer(1, len, ac.sampleRate);
                const d = noise.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

                // Older iOS Safari only unlocks after a sound plays inside the gesture
                const s = ac.createBufferSource();
                s.buffer = ac.createBuffer(1, 1, ac.sampleRate);
                s.connect(ac.destination);
                s.start(0);
            }
            if (ac.state === 'suspended') ac.resume();
        }

        function env(g, T, attack, peak, decay) {
            g.gain.setValueAtTime(0.0001, T);
            g.gain.exponentialRampToValueAtTime(peak, T + attack);
            g.gain.exponentialRampToValueAtTime(0.0001, T + attack + decay);
        }

        function tone(T, freq, dur, vol, type = 'sine', freqEnd = 0) {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, T);
            if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, T + dur);
            env(g, T, 0.004, vol, dur);
            o.connect(g);
            g.connect(bus);
            o.start(T);
            o.stop(T + dur + 0.05);
        }

        // Steady tone that holds, then releases (the solid lock tone)
        function held(T, freq, dur, vol) {
            const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
            o.type = 'square';
            o.frequency.value = freq;
            lp.type = 'lowpass';
            lp.frequency.value = 2600;
            g.gain.setValueAtTime(0.0001, T);
            g.gain.exponentialRampToValueAtTime(vol, T + 0.01);
            g.gain.setValueAtTime(vol, T + dur - 0.08);
            g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
            o.connect(lp); lp.connect(g); g.connect(bus);
            o.start(T);
            o.stop(T + dur + 0.05);
        }

        function noiseSrc(T, dur) {
            const s = ac.createBufferSource();
            s.buffer = noise;
            s.loop = true;
            s.start(T, Math.random() * 1.5);
            s.stop(T + dur + 0.05);
            return s;
        }

        // Teletype key click
        function click(T, vol) {
            const s = noiseSrc(T, 0.03), f = ac.createBiquadFilter(), g = ac.createGain();
            f.type = 'highpass';
            f.frequency.value = 2400;
            env(g, T, 0.001, vol, 0.018);
            s.connect(f); f.connect(g); g.connect(bus);
        }

        function output(node, T, dur, pan0, pan1) {
            if (ac.createStereoPanner && (pan0 || pan1)) {
                const p = ac.createStereoPanner();
                p.pan.setValueAtTime(pan0, T);
                p.pan.linearRampToValueAtTime(pan1, T + dur);
                node.connect(p);
                p.connect(bus);
            } else {
                node.connect(bus);
            }
        }

        // Band-passed noise that swells to a peak and drops in pitch after it, like a Doppler pass
        function whoosh(T, dur, vol, f0, fPeak, f1, peakAt, pan0 = 0, pan1 = 0, q = 1.3) {
            const s = noiseSrc(T, dur), f = ac.createBiquadFilter(), g = ac.createGain();
            const Tp = T + dur * peakAt;
            f.type = 'bandpass';
            f.Q.value = q;
            f.frequency.setValueAtTime(f0, T);
            f.frequency.exponentialRampToValueAtTime(fPeak, Tp);
            f.frequency.exponentialRampToValueAtTime(f1, T + dur);
            g.gain.setValueAtTime(0.0001, T);
            g.gain.exponentialRampToValueAtTime(vol, Tp);
            g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
            s.connect(f); f.connect(g);
            output(g, T, dur, pan0, pan1);
        }

        // Equipment hum: mains buzz plus faint receiver hiss
        function hum(T, dur, vol) {
            const g = ac.createGain(), lp = ac.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 320;
            g.gain.setValueAtTime(0.0001, T);
            g.gain.exponentialRampToValueAtTime(vol, T + 0.6);
            g.gain.setValueAtTime(vol, T + dur - 0.5);
            g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
            [[60, 'sawtooth', 1], [120, 'sine', 0.6], [180.5, 'sine', 0.25]].forEach(([fr, type, v]) => {
                const o = ac.createOscillator(), og = ac.createGain();
                o.type = type;
                o.frequency.value = fr;
                og.gain.value = v;
                o.connect(og); og.connect(lp);
                o.start(T);
                o.stop(T + dur + 0.1);
            });
            const s = noiseSrc(T, dur), bp = ac.createBiquadFilter(), sg = ac.createGain();
            bp.type = 'bandpass';
            bp.frequency.value = 1800;
            bp.Q.value = 0.5;
            sg.gain.value = 0.3;
            s.connect(bp); bp.connect(sg); sg.connect(g);
            lp.connect(g);
            g.connect(bus);
        }

        function boom(T) {
            tone(T, 120, 1.3, 0.55, 'sine', 30);
            const s = noiseSrc(T, 0.8), lp = ac.createBiquadFilter(), g = ac.createGain();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(900, T);
            lp.frequency.exponentialRampToValueAtTime(80, T + 0.7);
            env(g, T, 0.005, 0.5, 0.7);
            s.connect(lp); lp.connect(g); g.connect(bus);
        }

        function score(from) {
            const base = ac.currentTime - from + 0.03;
            const at = (t, fn) => { if (t >= from) fn(base + t); };

            at(0, T => hum(T, ZOOM_END + 0.2, 0.05));

            // Log lines: a beep, then teletype clicks while the line types out
            intro.querySelectorAll('.intro-log p').forEach(p => {
                const d = parseFloat(p.style.getPropertyValue('--d'));
                if (p.classList.contains('ok')) {
                    at(d, T => { tone(T, 1320, 0.09, 0.07, 'square'); tone(T + 0.1, 1760, 0.16, 0.07, 'square'); });
                } else {
                    at(d, T => tone(T, 1650, 0.05, 0.045, 'square'));
                }
                for (let k = 0; k < 7; k++) at(d + 0.05 + k * 0.065, T => click(T, 0.05 + Math.random() * 0.03));
            });

            // Soft return each time the beam paints Los Angeles, until the lock
            for (let k = 0; ; k++) {
                const tp = SWEEP_START + (target.b / (Math.PI * 2) + k) * SWEEP_PERIOD;
                if (tp >= LOCK_START) break;
                at(tp, T => tone(T, 1250, 0.12, 0.035));
            }

            // Satellite pass: swells as it crosses the screen, panning left to right
            const satDur = SAT_END - SAT_START;
            at(SAT_START, T => {
                whoosh(T, satDur, 0.4, 260, 2200, 340, 0.5, -0.9, 0.9);
                whoosh(T, satDur, 0.12, 2400, 7500, 1800, 0.5, -0.9, 0.9, 0.8);
            });
            // Telemetry chirp as the tracker tags it
            for (let k = 0; k < 8; k++) at(SAT_START + 0.55 + k * 0.035, T => tone(T, k % 2 ? 2100 : 1250, 0.03, 0.025, 'square'));

            // Lock: beeps speed up, then a solid tone
            let tl = LOCK_START, gap = 0.18;
            while (tl < LOCK_END) {
                at(tl, T => tone(T, 980, 0.05, 0.06, 'square'));
                tl += gap;
                gap = Math.max(0.05, gap * 0.78);
            }
            at(LOCK_END, T => held(T, 980, 0.55, 0.055));

            // Punch through: rising whoosh into a low boom
            const zDur = ZOOM_END - ZOOM_START + 0.3;
            at(ZOOM_START - 0.3, T => {
                whoosh(T, zDur, 0.55, 140, 3400, 1800, 0.93);
                tone(T, 180, zDur, 0.03, 'sine', 900);
            });
            at(ZOOM_END - 0.12, boom);

            // Data chatter while the name decrypts
            for (let k = 0; k < 22; k++) {
                at(REVEAL_AT + k * 0.045, T => tone(T, 900 + Math.random() * 2400, 0.025, 0.018, 'square'));
            }

            // Soft chime as the name appears
            at(REVEAL_AT, T => { tone(T, 880, 1.4, 0.03); tone(T + 0.06, 1318.5, 1.4, 0.022); });
        }

        function start(elapsed) {
            if (!ac) return;
            stop(0.02);
            bus = ac.createGain();
            bus.connect(master);
            const go = () => { if (bus) score(elapsed()); };
            if (ac.state === 'running') go();
            else ac.resume().then(go, () => {});
        }

        function stop(fade = 0.05) {
            if (!bus) return;
            const old = bus;
            bus = null;
            old.gain.setTargetAtTime(0, ac.currentTime, fade);
            setTimeout(() => old.disconnect(), fade * 8000 + 100);
        }

        function setMuted(m) {
            muted = m;
            try { localStorage.setItem('dl-intro-muted', m ? '1' : '0'); } catch (e) { /* storage unavailable */ }
            if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ac.currentTime, 0.03);
        }

        return { unlock, start, stop, setMuted, isMuted: () => muted, supported: !!AC };
    })();

    function syncSoundBtn() {
        const on = !sound.isMuted();
        soundBtn.setAttribute('aria-pressed', String(on));
        soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    }
    if (!sound.supported) soundBtn.hidden = true;
    syncSoundBtn();

    /* ---------------- Intro: drawing ---------------- */

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

    // Satellite ground track across the top of the screen
    function satPos(t) {
        const u = (t - SAT_START) / (SAT_END - SAT_START);
        return [
            lerp(-0.08 * W, 1.08 * W, u),
            lerp(H * 0.14, H * 0.40, u) - Math.sin(Math.PI * u) * H * 0.07
        ];
    }

    function drawSatellite(t) {
        if (t < SAT_START || t > SAT_END) return;
        const u = (t - SAT_START) / (SAT_END - SAT_START);
        const [x, y] = satPos(t);
        const [nx, ny] = satPos(t + 0.02);
        const edge = clamp(Math.min(u, 1 - u) * 8);

        // Predicted orbit, faint and dashed
        ctx.save();
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = `rgba(${GREEN}, ${0.1 * edge})`;
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
            const [px, py] = satPos(SAT_START + (SAT_END - SAT_START) * k / 40);
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.restore();

        // Phosphor trail behind it
        for (let k = 1; k <= 28; k++) {
            const tk = t - k * 0.025;
            if (tk < SAT_START) break;
            const [px, py] = satPos(tk);
            ctx.fillStyle = `rgba(${GREEN}, ${0.5 * (1 - k / 28)})`;
            ctx.fillRect(px - 1, py - 1, 2, 2);
        }

        // Body with solar panels, oriented along its heading
        ctx.save();
        ctx.translate(x, y);
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
        halo.addColorStop(0, `rgba(${GREEN}, 0.3)`);
        halo.addColorStop(1, `rgba(${GREEN}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();

        ctx.rotate(Math.atan2(ny - y, nx - x) + Math.PI / 2);
        ctx.strokeStyle = `rgba(${GREEN}, 0.95)`;
        ctx.fillStyle = `rgba(${GREEN}, 0.18)`;
        ctx.lineWidth = 1;
        [-1, 1].forEach(side => {
            const px = side < 0 ? -17 : 6;
            ctx.fillRect(px, -3, 11, 6);
            ctx.strokeRect(px + 0.5, -2.5, 10, 5);
            ctx.beginPath();
            ctx.moveTo(px + 4, -2.5); ctx.lineTo(px + 4, 2.5);
            ctx.moveTo(px + 7.5, -2.5); ctx.lineTo(px + 7.5, 2.5);
            ctx.moveTo(side * 3, 0); ctx.lineTo(side < 0 ? px + 11 : px, 0);
            ctx.stroke();
        });
        ctx.fillStyle = `rgba(${GREEN}, 1)`;
        ctx.fillRect(-3, -4, 6, 8);
        ctx.restore();

        // Sun glint off the panels
        const glint = Math.pow(Math.max(0, Math.sin(t * 7)), 12);
        if (glint > 0.02) {
            ctx.fillStyle = `rgba(230, 255, 240, ${glint})`;
            ctx.beginPath(); ctx.arc(x, y, 2 + glint * 2, 0, Math.PI * 2); ctx.fill();
        }

        // Tag
        const lines = ['NORAD 25544  ISS', 'ALT 418 KM  7.66 KM/S'];
        const chars = Math.floor((t - SAT_START - 0.5) * 40);
        if (chars > 0) {
            const flip = x + 200 > W;
            ctx.font = '10px "Share Tech Mono", monospace';
            ctx.textAlign = flip ? 'right' : 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = `rgba(${GREEN}, ${0.85 * edge})`;
            let used = 0;
            lines.forEach((line, i) => {
                const n = chars - used;
                used += line.length;
                if (n > -4) ctx.fillText(decrypt(line, n), flip ? x - 24 : x + 24, y - 14 + i * 13);
            });
        }
    }

    function frame(now) {
        const t = (now - t0) / 1000;
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.4;
        const toXY = (b, r) => [cx + Math.sin(b) * r * R, cy - Math.cos(b) * r * R];
        const [tx, ty] = toXY(target.b, target.r);

        ctx.fillStyle = SCOPE_BG;
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
        glow.addColorStop(0, `rgba(${GREEN}, ${0.07 * (1 - z)})`);
        glow.addColorStop(1, `rgba(${GREEN}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // Map video: Southern California coastline and islands, clipped to the scope
        const mapAlpha = clamp((t - 0.4) / 0.8);
        if (mapAlpha > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.clip();
            ctx.strokeStyle = `rgba(${MAP}, ${0.42 * mapAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.lineJoin = 'round';
            [COAST, ...ISLANDS].forEach(pts => {
                ctx.beginPath();
                pts.forEach((p, i) => {
                    const [x, y] = toXY(p.b, p.r);
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                });
                ctx.stroke();
            });
            ctx.lineWidth = 1;
            ctx.font = '9px "Share Tech Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(${MAP}, ${0.45 * mapAlpha})`;
            PLACES.forEach(p => {
                const [x, y] = toXY(p.b, p.r);
                ctx.fillRect(x - 1, y - 1, 2, 2);
                ctx.fillText(p.name, x + 6, y);
            });
            ctx.restore();
        }

        // Range rings, 20 NM apart
        ctx.lineWidth = 1;
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 1; i <= 4; i++) {
            const p = easeOut(clamp((t - 0.1 - i * 0.08) / 0.7));
            if (p <= 0) continue;
            ctx.strokeStyle = `rgba(${GREEN}, ${i === 4 ? 0.45 : 0.16})`;
            ctx.beginPath();
            ctx.arc(cx, cy, (R * i / 4) * p, 0, Math.PI * 2);
            ctx.stroke();
            if (i < 4 && p >= 1) {
                ctx.fillStyle = `rgba(${GREEN}, 0.35)`;
                const [lx, ly] = toXY(Math.PI * 1.12, i / 4);
                ctx.fillText(String(i * 20), lx, ly);
            }
        }

        // Crosshair and bearing ticks
        const tickAlpha = clamp((t - 0.5) / 0.6);
        if (tickAlpha > 0) {
            ctx.strokeStyle = `rgba(${GREEN}, ${0.1 * tickAlpha})`;
            ctx.beginPath();
            ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
            ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
            ctx.stroke();

            ctx.strokeStyle = `rgba(${GREEN}, ${0.45 * tickAlpha})`;
            ctx.fillStyle = `rgba(${GREEN}, ${0.6 * tickAlpha})`;
            ctx.font = '10px "Share Tech Mono", monospace';
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

        // Sea clutter near the site, flickering
        if (t > SWEEP_START) {
            for (let i = 0; i < 70; i++) {
                const a = Math.random() * Math.PI * 2;
                const rr = Math.pow(Math.random(), 2) * 0.2;
                ctx.fillStyle = `rgba(${GREEN}, ${(1 - rr / 0.2) * 0.3 * Math.random() * (1 - z)})`;
                const [x, y] = toXY(a, rr);
                ctx.fillRect(x, y, 1.4, 1.4);
            }
        }

        // Sweep beam with phosphor trail (fades out as we zoom)
        ctx.globalAlpha = fade * (1 - z);
        if (t > SWEEP_START) {
            const sb = sweepBearing(t);
            const trail = 1.3;
            const a1 = sb - Math.PI / 2;
            if (ctx.createConicGradient) {
                const cg = ctx.createConicGradient(a1 - trail, cx, cy);
                const f = trail / (Math.PI * 2);
                cg.addColorStop(0, `rgba(${GREEN}, 0)`);
                cg.addColorStop(f * 0.6, `rgba(${GREEN}, 0.05)`);
                cg.addColorStop(f, `rgba(${GREEN}, 0.26)`);
                cg.addColorStop(Math.min(f + 0.0005, 1), `rgba(${GREEN}, 0)`);
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
                    ctx.fillStyle = `rgba(${GREEN}, ${0.22 * Math.pow(1 - k / slices, 1.6)})`;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx, cy, R, end - step, end + 0.004);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.strokeStyle = `rgba(${GREEN}, 0.95)`;
            ctx.shadowColor = `rgba(${GREEN}, 0.8)`;
            ctx.shadowBlur = 8;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.sin(sb) * R, cy - Math.cos(sb) * R);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
        }
        ctx.globalAlpha = fade;

        // Contacts
        const drawBlip = (x, y, I, size) => {
            if (I < 0.02) return;
            ctx.fillStyle = `rgba(${GREEN}, ${I * 0.22})`;
            ctx.beginPath(); ctx.arc(x, y, size * 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(${GREEN}, ${I})`;
            ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        };

        blips.forEach(p => {
            const b = p.b + p.drift * t;
            const [x, y] = toXY(b, p.r);
            drawBlip(x, y, intensity(b, t) * 0.7, 2);
        });

        const lockP = easeOut(clamp((t - LOCK_START) / (LOCK_END - LOCK_START)));
        drawBlip(tx, ty, Math.max(intensity(target.b, t), lockP * 0.95), 2.6);

        // Lock brackets close in on Los Angeles
        if (lockP > 0) {
            const blink = t > LOCK_END && t < ZOOM_START ? (Math.floor((t - LOCK_END) * 6) % 2 ? 0.55 : 1) : 1;
            const s = lerp(110, 20, lockP);
            const arm = s * 0.38;
            ctx.strokeStyle = `rgba(${GREEN}, ${lockP * blink})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
                const x = tx + sx * s, y = ty + sy * s;
                ctx.moveTo(x, y - sy * arm); ctx.lineTo(x, y); ctx.lineTo(x - sx * arm, y);
            });
            ctx.stroke();
            ctx.lineWidth = 1;
        }

        // Track readout types out after lock
        if (t > LOCK_END - 0.1) {
            const lines = [
                ['TRK 0417  LOCKED', 11],
                ['LOS ANGELES, CA', 17],
                [`${LA.lat.toFixed(4)}N  ${Math.abs(LA.lon).toFixed(4)}W`, 11],
                [`BRG ${targetBrg}  RNG ${targetRng} NM`, 11]
            ];
            const chars = Math.floor((t - (LOCK_END - 0.1)) * 32);
            const flip = tx + 220 > W;
            const lx = flip ? tx - 32 : tx + 32;
            ctx.textAlign = flip ? 'right' : 'left';
            ctx.textBaseline = 'alphabetic';
            const a = clamp(1 - z * 4);
            let used = 0, ly = ty - 22;
            lines.forEach(([line, size], i) => {
                const n = chars - used;
                used += line.length;
                ly += size + 5;
                if (n <= -4) return;
                ctx.font = `${i === 1 ? 500 : 400} ${size}px "Share Tech Mono", monospace`;
                ctx.fillStyle = `rgba(${GREEN}, ${(i === 1 ? 1 : 0.8) * a})`;
                ctx.shadowColor = `rgba(${GREEN}, ${i === 1 ? 0.7 : 0})`;
                ctx.shadowBlur = i === 1 ? 10 : 0;
                ctx.fillText(decrypt(line, n), lx, ly);
            });
            ctx.shadowBlur = 0;
        }

        ctx.restore();

        drawSatellite(t);

        // Green flash as we punch through
        const flash = clamp(1 - Math.abs(t - (ZOOM_END - 0.15)) / 0.22);
        if (flash > 0) {
            ctx.fillStyle = `rgba(${GREEN}, ${flash * 0.08})`;
            ctx.fillRect(0, 0, W, H);
        }

        if (!revealed && t >= REVEAL_AT) {
            revealed = true;
            intro.classList.add('reveal');
            decryptEl(intro.querySelector('.intro-name-text'), 1000);
            decryptEl(intro.querySelector('.intro-name-sub'), 1300);
        }
        if (t >= FINISH_AT) {
            finish(true);
            return;
        }
        raf = requestAnimationFrame(frame);
    }

    /* ---------------- Intro: flow ---------------- */

    function play() {
        gated = false;
        intro.style.display = '';
        intro.classList.remove('done', 'reveal', 'playing', 'gated');
        void intro.offsetWidth; // restart CSS animations
        intro.classList.add('playing');
        body.classList.add('intro-active');
        body.classList.remove('ready');
        window.scrollTo(0, 0);
        resize();
        revealed = false;
        running = true;
        t0 = performance.now();
        sound.start(() => (performance.now() - t0) / 1000);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
    }

    // Start from a click or key press so audio is allowed
    function begin() {
        if (!gated) return;
        sound.unlock();
        play();
    }

    function finish(natural = false) {
        if (!running && !gated) return;
        running = false;
        gated = false;
        cancelAnimationFrame(raf);
        sound.stop(natural ? 0.4 : 0.05);
        intro.classList.remove('gated');
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

    intro.addEventListener('click', () => (gated ? begin() : finish()));
    intro.querySelector('.intro-skip').addEventListener('click', e => {
        e.stopPropagation();
        finish();
    });
    soundBtn.addEventListener('click', e => {
        e.stopPropagation();
        sound.unlock();
        sound.setMuted(!sound.isMuted());
        syncSoundBtn();
    });
    window.addEventListener('keydown', e => {
        if (gated) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); }
            else if (e.key === 'Escape') finish();
        } else if (running && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            finish();
        }
    });
    window.addEventListener('resize', () => { if (running) resize(); });

    document.getElementById('replay-intro').addEventListener('click', () => {
        sound.unlock();
        play();
    });

    let seen = false;
    try { seen = sessionStorage.getItem('dl-intro-seen') === '1'; } catch (e) { /* storage unavailable */ }

    if (reduceMotion || seen) {
        skipImmediately();
    } else {
        gated = true;
        intro.classList.add('gated');
        intro.querySelector('.intro-start').focus({ preventScroll: true });
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