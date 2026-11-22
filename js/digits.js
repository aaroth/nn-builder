// Chapter 5: reading handwritten digits.
//
// Pictures are 14 × 14 = 196 pixels, each from 0 (no ink) to 1 (full ink). The digits the
// network learns from are drawn here from pen strokes with random slant, size and thickness,
// so nothing has to be downloaded. Eli can also draw his own and add them to the examples.
//
// Two kinds of level:
//   paint  - Eli paints the 196 weights of one neuron so it fires for 1s and not 0s (level 18)
//   digits - a network with 10 output neurons (one per digit) is trained (levels 19 and 20)
window.NL = window.NL || {};
NL.Digits = (function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const fmt = NL.fmt, fmtn = NL.fmtn;
  const G = 14, N = G * G;
  const BG = [14, 20, 32], POS = [63, 182, 255], NEG = [255, 157, 60], INK = [235, 240, 248];

  // ---------- drawing digits from pen strokes ----------
  // Shapes live in a box from (0, 0) at the top left to (1, 1) at the bottom right.
  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= (n || 14); i++) {
      const t = i / (n || 14), u = 1 - t;
      out.push([0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
    }
    return out;
  }
  function ell(cx, cy, rx, ry, start) {
    const out = [], a0 = start || -Math.PI / 2;
    for (let i = 0; i <= 30; i++) {
      const a = a0 + (i / 30) * Math.PI * 2;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  }
  const join = (...parts) => [].concat(...parts.map((p, i) => (i ? p.slice(1) : p)));

  // The pen strokes for digit d. j() wobbles a point a little; r() is a random number 0-1.
  function strokes(d, j, r) {
    switch (d) {
      case 0: {
        // an oval, sometimes leaning, sometimes not quite closed or overlapping
        const o = ell(0.5, 0.5, 0.24 + r() * 0.14, 0.4 + r() * 0.06, -Math.PI / 2 + (r() - 0.5) * 1.2);
        const cut = Math.floor((r() - 0.4) * 6);
        return [cut > 0 ? o.slice(0, o.length - cut) : cut < 0 ? o.concat(o.slice(1, 1 - cut)) : o];
      }
      case 1: {
        const top = j(0.52, 0.07), s = [[top, j(0.5, 0.93)]];
        if (r() < 0.5) s.push([j(0.3 + r() * 0.08, 0.22 + r() * 0.1), top]);
        if (r() < 0.2) s.push([j(0.32, 0.93), j(0.7, 0.93)]);
        return s;
      }
      case 2:
        if (r() < 0.3) { // a curly 2 with a little loop at the bottom
          return [join(bez(j(0.2, 0.3), j(0.22, 0.0), j(0.82, 0.0), j(0.76, 0.33)),
            bez(j(0.76, 0.33), j(0.7, 0.6), j(0.3, 0.75), j(0.22, 0.9)), ell(0.3, 0.84, 0.08, 0.07, Math.PI / 2), [j(0.86, 0.9)])];
        }
        return [join(bez(j(0.22, 0.3), j(0.25, 0.0), j(0.82, 0.02), j(0.76, 0.35)),
          bez(j(0.76, 0.35), j(0.7, 0.55), j(0.35, 0.7), j(0.16, 0.92)), [j(0.86, 0.91)])];
      case 3:
        if (r() < 0.3) { // a flat-topped 3
          return [join([j(0.2, 0.1), j(0.8, 0.1), j(0.44, 0.45)],
            bez(j(0.44, 0.45), j(0.95, 0.45), j(0.88, 0.98), j(0.42, 0.93)), [j(0.18, 0.82)])];
        }
        return [join(bez(j(0.2, 0.16), j(0.45, -0.03), j(0.88, 0.1), j(0.72, 0.32)),
          bez(j(0.72, 0.32), j(0.66, 0.45), j(0.52, 0.48), j(0.42, 0.48))),
        join(bez(j(0.42, 0.48), j(0.92, 0.5), j(0.88, 0.98), j(0.45, 0.93)), [j(0.2, 0.84)])];
      case 4:
        if (r() < 0.4) return [[j(0.32, 0.07), j(0.2, 0.62), j(0.86, 0.62)], [j(0.66, 0.28 - r() * 0.2), j(0.66, 0.93)]];
        return [[j(0.64, 0.93), j(0.64, 0.07), j(0.17, 0.66), j(0.86, 0.66)]];
      case 5: {
        const body = join([j(0.3, 0.08), j(0.26, 0.46)],
          bez(j(0.26, 0.46), j(0.72, 0.3), j(0.92, 0.68), j(0.6, 0.89)), bez(j(0.6, 0.89), j(0.45, 0.98), j(0.27, 0.91), j(0.2, 0.82)));
        return r() < 0.5 ? [join([j(0.78, 0.08)], body)] : [body, [j(0.3, 0.08), j(0.8, 0.06)]];
      }
      case 6:
        if (r() < 0.35) return [join([j(0.62, 0.06), j(0.3, 0.62)], ell(0.5, 0.71, 0.21, 0.2, Math.PI))];
        return [join(bez(j(0.72, 0.07), j(0.38, 0.15), j(0.24, 0.45), j(0.27, 0.7)), ell(0.5, 0.71, 0.23, 0.21, Math.PI))];
      case 7: {
        const s = r() < 0.3 ? [join([j(0.18, 0.1), j(0.82, 0.1)], bez(j(0.82, 0.1), j(0.6, 0.4), j(0.5, 0.6), j(0.48, 0.93)))]
          : [[j(0.18, 0.1), j(0.82, 0.1), j(0.42, 0.93)]];
        if (r() < 0.25) s.push([j(0.36, 0.52), j(0.72, 0.52)]);
        return s;
      }
      case 8:
        if (r() < 0.4) { // drawn in one go, crossing in the middle
          return [join(bez(j(0.68, 0.18), j(0.5, -0.05), j(0.2, 0.15), j(0.5, 0.48)),
            bez(j(0.5, 0.48), j(0.85, 0.72), j(0.62, 1.0), j(0.48, 0.94)), bez(j(0.48, 0.94), j(0.15, 0.9), j(0.2, 0.62), j(0.5, 0.48)),
            bez(j(0.5, 0.48), j(0.75, 0.35), j(0.78, 0.25), j(0.68, 0.18)))];
        }
        return [ell(0.5, 0.28, 0.17 + r() * 0.06, 0.2, Math.PI / 2), ell(0.5, 0.71, 0.22 + r() * 0.06, 0.22, -Math.PI / 2)];
      default:
        if (r() < 0.4) return [join(ell(0.46, 0.3, 0.23, 0.2, 0), [j(0.69, 0.3), j(0.68, 0.94)])]; // straight stem
        return [join(ell(0.46, 0.31, 0.23, 0.21, 0), bez(j(0.69, 0.31), j(0.71, 0.56), j(0.65, 0.76), j(0.58, 0.94)))];
    }
  }

  const big = document.createElement('canvas');
  big.width = big.height = 112;
  // Draws digit d with a random slant, size, wobble and pen thickness, and returns its pixels.
  function makeDigit(d, rnd) {
    const r = () => rnd(), wob = 0.05;
    const j = (x, y) => [x + (r() - 0.5) * 2 * wob, y + (r() - 0.5) * 2 * wob];
    const rot = (r() - 0.5) * 0.36, slant = (r() - 0.5) * 0.7, sx = 0.6 + r() * 0.55, sy = 0.8 + r() * 0.3;
    // A smooth random warp, like a shaky hand: every point is pushed a little, and nearby
    // points are pushed the same way.
    const wv = Array.from({ length: 4 }, () => [0.035 + r() * 0.05, 0.6 + r() * 1.4, r() * 6.3]);
    const tf = ([x0, y0]) => {
      const x = x0 + wv[0][0] * Math.sin(wv[0][1] * 6.3 * y0 + wv[0][2]) + wv[1][0] * Math.sin(wv[1][1] * 6.3 * x0 + wv[1][2]);
      const y = y0 + wv[2][0] * Math.sin(wv[2][1] * 6.3 * x0 + wv[2][2]) + wv[3][0] * Math.sin(wv[3][1] * 6.3 * y0 + wv[3][2]);
      let u = (x - 0.5) * sx, v = (y - 0.5) * sy;
      u += slant * -v;
      const c = Math.cos(rot), s = Math.sin(rot);
      return [56 + (u * c - v * s) * 80, 56 + (u * s + v * c) * 80];
    };
    const c = big.getContext('2d');
    c.clearRect(0, 0, 112, 112);
    c.strokeStyle = '#fff';
    c.lineWidth = 6 + r() * 10;
    c.lineCap = c.lineJoin = 'round';
    for (const s of strokes(d, j, r)) {
      c.beginPath();
      s.map(tf).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    return toPixels(big);
  }

  // Turns any drawing into 14 × 14 pixels: crop to the ink, scale it to a standard size,
  // centre it, then average each 4 × 4 block. Drawn digits and made digits go through the same steps.
  const work = document.createElement('canvas');
  work.width = work.height = 56;
  function toPixels(src) {
    const w = src.width, h = src.height, a = src.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
    }
    const px = new Array(N).fill(0);
    if (x1 < 0) return px;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = 40 / Math.max(bw, bh);
    const c = work.getContext('2d');
    c.clearRect(0, 0, 56, 56);
    c.imageSmoothingEnabled = true;
    c.drawImage(src, x0, y0, bw, bh, 28 - (bw * s) / 2, 28 - (bh * s) / 2, bw * s, bh * s);
    const d = c.getImageData(0, 0, 56, 56).data;
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        let sum = 0;
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sum += d[((gy * 4 + y) * 56 + gx * 4 + x) * 4 + 3];
        px[gy * G + gx] = Math.round(Math.min(1, (sum / 16 / 255) * 1.6) * 100) / 100;
      }
    }
    return px;
  }

  // The examples to learn from and the exam, made once and kept.
  let DATA = null;
  function data() {
    if (!DATA) {
      const make = (per, seed) => {
        const rnd = NL.rng(seed), out = [];
        for (let k = 0; k < per; k++) for (let d = 0; d < 10; d++) out.push({ x: makeDigit(d, rnd), d });
        return out;
      };
      DATA = { train: make(100, 11), exam: make(30, 22), paint: make(6, 33).filter(e => e.d <= 1) };
    }
    return DATA;
  }

  // ---------- small drawing helpers ----------
  function prep(cv, w, h) {
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.aspectRatio = w + ' / ' + h;
      cv.style.width = w + 'px';
    }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    return c;
  }
  const tileCv = document.createElement('canvas');
  tileCv.width = tileCv.height = G;
  const tileImg = tileCv.getContext('2d').createImageData(G, G);
  const mixc = (t, k) => BG.map((b, q) => Math.round(b + (t[q] - b) * k));
  // Draws 196 numbers as a 14 × 14 picture: ink in white, or weights in blue (+) and orange (−),
  // brighter for bigger, with `scale` as full brightness.
  function drawTile(c, vals, x, y, size, scale) {
    for (let i = 0; i < N; i++) {
      const v = vals[i];
      const col = scale === 'ink' ? mixc(INK, Math.max(0, Math.min(1, v))) : mixc(v >= 0 ? POS : NEG, Math.min(1, Math.abs(v) / (scale || 1)));
      tileImg.data.set([col[0], col[1], col[2], 255], i * 4);
    }
    tileCv.getContext('2d').putImageData(tileImg, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(tileCv, x, y, size, size);
  }
  const maxAbs = arrs => Math.max(1e-6, ...arrs.map(a => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  const argmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);
  const an = d => (d === 8 ? 'an ' : 'a ') + d; // "a 7", "an 8"
  const oneHot = d => Array.from({ length: 10 }, (_, k) => (k === d ? 1 : 0));

  let st = null; // the digit level being played
  let hooks = null;
  let timer = null, raf = null;

  // ======================================================================
  // Level 18: paint a neuron
  // ======================================================================
  function openPaint(lv) {
    const saved = hooks.save().params[lv.id];
    st = { lv, mode: 'paint', w: new Array(N).fill(0), bias: 0, brush: 1, sel: 0, passing: null };
    if (saved && Array.isArray(saved.w) && saved.w.length === N) {
      st.w = saved.w.map(v => (isFinite(+v) ? +v : 0));
      st.bias = isFinite(+saved.bias) ? +saved.bias : 0;
    }
    st.tests = data().paint.map(e => ({ x: e.x, t: e.d === 1 ? 1 : 0 }));
    paintRender(false);
  }

  const sigma = (w, b, x) => x.reduce((s, v, i) => s + v * w[i], b);

  function paintRender(commit) {
    const C = 22, c = prep($('#paintGrid'), G * C, G * C), sc = 1;
    drawTile(c, st.w, 0, 0, G * C, sc);
    c.strokeStyle = 'rgba(255,255,255,.07)';
    c.lineWidth = 1;
    for (let k = 1; k < G; k++) {
      c.beginPath(); c.moveTo(k * C + 0.5, 0); c.lineTo(k * C + 0.5, G * C); c.stroke();
      c.beginPath(); c.moveTo(0, k * C + 0.5); c.lineTo(G * C, k * C + 0.5); c.stroke();
    }
    // The selected picture's ink, outlined on top, so Eli can see where it falls on his weights.
    const x = st.tests[st.sel].x;
    c.strokeStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < N; i++) {
      if (x[i] > 0.3) c.strokeRect((i % G) * C + 3.5, Math.floor(i / G) * C + 3.5, C - 7, C - 7);
    }
    $('#pBias').value = st.bias;
    $('#pBiasVal').textContent = fmt(st.bias);
    $('#brushes').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === st.brush));

    // the tests
    let pass = 0;
    const cards = st.tests.map((e, k) => {
      const s = sigma(st.w, st.bias, e.x), fire = s > 0, ok = (fire ? 1 : 0) === e.t;
      if (ok) pass++;
      return { s, fire, ok, k };
    });
    $('#pScore').textContent = `${pass} of ${st.tests.length} right`;
    const gal = $('#pTests');
    if (gal.children.length !== st.tests.length) {
      gal.innerHTML = st.tests.map((e, k) => `<button class="dcard" data-k="${k}"><canvas></canvas><span class="dlab"></span></button>`).join('');
    }
    cards.forEach(r => {
      const b = gal.children[r.k], e = st.tests[r.k];
      b.className = 'dcard ' + (r.ok ? 'pass' : 'fail') + (r.k === st.sel ? ' sel' : '');
      drawTile(prep(b.querySelector('canvas'), 42, 42), e.x, 0, 0, 42, 'ink');
      b.querySelector('.dlab').innerHTML = `${e.t ? 'a 1' : 'a 0'}: Σ ${fmt(r.s)}<br>${r.fire ? '<b class="firing">fires</b>' : 'quiet'} ${r.ok ? '✓' : '✗'}`;
    });

    // pixels × weights = what each pixel adds
    const prod = x.map((v, i) => v * st.w[i]);
    drawTile(prep($('#pcPix'), 84, 84), x, 0, 0, 84, 'ink');
    drawTile(prep($('#pcW'), 84, 84), st.w, 0, 0, 84, 1);
    drawTile(prep($('#pcProd'), 84, 84), prod, 0, 0, 84, 1);
    const s = sigma(st.w, st.bias, x), pos = prod.reduce((a, v) => a + Math.max(0, v), 0), neg = prod.reduce((a, v) => a + Math.min(0, v), 0);
    $('#pcText').innerHTML = `blue adds up to <b class="pos">${fmt(pos)}</b>, orange to <b class="neg">${fmt(neg)}</b>, bias <b class="${st.bias > 0 ? 'pos' : st.bias < 0 ? 'neg' : 'zero'}">${fmt(st.bias)}</b>` +
      `<br>Σ = <b>${fmt(s)}</b> → ${s > 0 ? '<b class="firing">fires: 1</b>' : '<b>stays quiet: 0</b>'} <span class="dim">(should ${st.tests[st.sel].t ? 'fire: it is a 1' : 'stay quiet: it is a 0'})</span>`;

    const sv = hooks.save();
    sv.params[st.lv.id] = { w: st.w, bias: st.bias };
    hooks.store();
    const all = pass === st.tests.length;
    if (commit && all && st.passing === false) hooks.complete();
    if (commit || st.passing === null) st.passing = all;
  }

  // ======================================================================
  // Levels 19 and 20: train a network to read digits
  // ======================================================================
  const SPEEDS = [['slow', 'Slow', { every: 900 }], ['medium', 'Medium', { per: 1 }], ['fast', 'Fast', { per: 10 }], ['turbo', 'Turbo', { per: 4000, budget: 14 }]];
  const MAX_SNAPS = 300;

  function openDigits(lv) {
    const prev = st && st.lv && st.lv.id === lv.id ? st : null;
    st = {
      lv, mode: 'digits', H: prev ? prev.H : lv.hidden, rate: prev ? prev.rate : lv.rate, speed: prev ? prev.speed : 'fast',
      probe: null, running: false, padDirty: false,
    };
    newNet();
    buildControls();
    clearPad();
    digitsRender();
  }

  function trainSet() {
    const mine = (hooks.save().digits || {}).mine || [];
    return data().train.concat(mine.filter(e => Array.isArray(e.x) && e.x.length === N));
  }

  function newNet() {
    const sizes = st.H ? [N, st.H, 10] : [N, 10];
    st.net = new NL.Net(sizes, sizes.slice(1).map(() => 'sigmoid'));
    st.net.randomizeFan(NL.rng((Math.random() * 4294967296) >>> 0));
    st.step = 0;
    st.order = [];
    st.snaps = [];
    st.t = 0;
    st.last = null;
    st.msg = '';
    st.won = false;
    snap();
  }

  const flat = net => {
    const out = [];
    net.W.forEach((L, l) => L.forEach((row, j) => { out.push(...row, net.B[l][j]); }));
    return Float32Array.from(out);
  };
  const unflat = (net, a) => {
    let k = 0;
    net.W.forEach((L, l) => L.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) row[i] = a[k++];
      net.B[l][j] = a[k++];
    }));
  };

  // Scores the network on a set of pictures: how many it gets right, and its error.
  function score(set) {
    let right = 0, err = 0;
    for (const e of set) {
      const y = st.net.forward(e.x);
      if (argmax(y) === e.d) right++;
      for (let k = 0; k < 10; k++) err += (y[k] - (k === e.d ? 1 : 0)) ** 2;
    }
    return { acc: (100 * right) / set.length, err: err / set.length };
  }

  // Saves the weights and scores at this moment, for the charts and the timeline.
  function snap() {
    const tr = score(trainSet()), ex = score(data().exam);
    st.snaps.push({ step: st.step, w: flat(st.net), train: tr.acc, exam: ex.acc, err: tr.err });
    if (st.snaps.length > MAX_SNAPS) st.snaps = st.snaps.filter((_, k) => k % 2 === 0 || k === st.snaps.length - 1);
    st.t = st.snaps.length - 1;
    st.lastSnap = performance.now();
    return ex.acc;
  }

  function trainStep(explain) {
    const set = trainSet();
    if (!st.order.length) {
      st.order = set.map((_, k) => k);
      const rnd = NL.rng((Math.random() * 4294967296) >>> 0);
      for (let k = st.order.length - 1; k > 0; k--) {
        const q = Math.floor(rnd() * (k + 1));
        [st.order[k], st.order[q]] = [st.order[q], st.order[k]];
      }
    }
    const e = set[st.order.pop()] || set[0];
    const res = st.net.learn(e.x, oneHot(e.d), st.rate);
    st.step++;
    if (explain) st.last = { step: st.step, e, res, rate: st.rate };
    else st.last = null;
  }

  // Before training on, a rewound timeline drops the later moments.
  function cutHistory() {
    if (st.t < st.snaps.length - 1) {
      st.snaps.length = st.t + 1;
      unflat(st.net, st.snaps[st.t].w);
      st.step = st.snaps[st.t].step;
      st.msg = '';
      st.last = null;
    }
  }

  function checkWin(examAcc) {
    if (!st.won && examAcc >= st.lv.target) {
      st.won = true;
      stop();
      digitsRender();
      hooks.complete();
      return true;
    }
    return false;
  }

  function start() {
    if (st.running) return;
    cutHistory();
    st.running = true;
    schedule(0);
    digitsRender();
  }
  function stop() {
    if (st) st.running = false;
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = timer = null;
  }
  function schedule(delay) {
    const sp = SPEEDS.find(s => s[0] === st.speed)[2];
    if (sp.every) timer = setTimeout(tick, delay === undefined ? sp.every : delay);
    else raf = requestAnimationFrame(tick);
  }
  function tick() {
    timer = raf = null;
    if (!st || !st.running) return;
    const sp = SPEEDS.find(s => s[0] === st.speed)[2], t0 = performance.now();
    for (let k = 0; k < (sp.per || 1) && !(sp.budget && performance.now() - t0 > sp.budget); k++) trainStep(!!sp.every);
    // Score at most a few times a second: it takes longer than training does.
    if (sp.every || performance.now() - st.lastSnap > 150) {
      if (checkWin(snap())) return;
    }
    if (st.step >= 200000) {
      st.msg = 'That is 200,000 steps. Try a different learning rate or a new random start.';
      stop();
    }
    digitsRender();
    if (st.running) schedule();
  }
  function stepOnce() {
    stop();
    cutHistory();
    trainStep(true);
    if (!checkWin(snap())) digitsRender();
  }

  function buildControls() {
    const lv = st.lv, seg = (el, items, on) => {
      el.innerHTML = items.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(on) ? 'on' : ''}">${l}</button>`).join('');
    };
    seg($('#dSpeeds'), SPEEDS.map(([v, l]) => [v, l]), st.speed);
    seg($('#dRatesT'), lv.rates.map(r => [r, fmtn(r, 3)]), st.rate);
    $('#dHidRow').hidden = !lv.hiddenChoice;
    if (lv.hiddenChoice) seg($('#dHidSeg'), lv.hiddenChoice.map(h => [h, String(h)]), st.H);
    $('#teachSeg').innerHTML = Array.from({ length: 10 }, (_, d) => `<button data-v="${d}">${d}</button>`).join('');
  }

  function digitsRender() {
    const lv = st.lv, net = st.net, snapNow = st.snaps[st.t];
    const nW = net.W.reduce((s, L) => s + L.length * L[0].length, 0), nB = net.B.reduce((s, b) => s + b.length, 0);
    $('#dNetTitle').innerHTML = `${N} pixels → ${st.H ? `${st.H} hidden neurons → ` : ''}10 output neurons <span class="score">${nW.toLocaleString()} weights and ${nB} biases</span>`;

    // weight pictures
    $('#dHiddenWrap').hidden = !st.H;
    if (st.H) {
      const s = maxAbs(net.W[0]), cols = 8, T = 48, gap = 8, rows = Math.ceil(st.H / cols);
      const c = prep($('#dHidden'), cols * (T + gap), rows * (T + gap + 14));
      c.font = '11px "Segoe UI", system-ui, sans-serif';
      c.fillStyle = '#8a98ae';
      c.textAlign = 'center';
      net.W[0].forEach((w, j) => {
        const x = (j % cols) * (T + gap), y = Math.floor(j / cols) * (T + gap + 14);
        drawTile(c, w, x, y, T, s);
        c.fillText('h' + (j + 1), x + T / 2, y + T + 11);
      });
      $('#dHidScale').textContent = `brightest = ±${fmtn(s, 2)}`;
    }
    const outW = net.W[net.W.length - 1];
    if (!st.H) {
      const s = maxAbs(outW), T = 56, gap = 8;
      const c = prep($('#dOut'), 5 * (T + gap), 2 * (T + gap + 16));
      c.font = '600 12px "Segoe UI", system-ui, sans-serif';
      c.fillStyle = '#c4cede';
      c.textAlign = 'center';
      outW.forEach((w, d) => {
        const x = (d % 5) * (T + gap), y = Math.floor(d / 5) * (T + gap + 16);
        drawTile(c, w, x, y, T, s);
        c.fillText('neuron ' + d, x + T / 2, y + T + 13);
      });
      $('#dOutH').textContent = `Output neurons: what each one looks for (brightest = ±${fmtn(s, 2)})`;
    } else {
      // Each output neuron's weights from the hidden neurons, one coloured cell per hidden neuron.
      const s = maxAbs(outW), cw = Math.min(18, Math.floor(420 / st.H)), ch = 16, lw = 64;
      const c = prep($('#dOut'), lw + st.H * cw + 4, 10 * (ch + 3) + 16);
      c.font = '11px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'right';
      outW.forEach((w, d) => {
        const y = d * (ch + 3);
        c.fillStyle = '#c4cede';
        c.fillText('neuron ' + d, lw - 8, y + 12);
        w.forEach((v, j) => {
          c.fillStyle = 'rgb(' + mixc(v >= 0 ? POS : NEG, Math.min(1, Math.abs(v) / s)) + ')';
          c.fillRect(lw + j * cw, y, cw - 2, ch);
        });
      });
      c.fillStyle = '#8a98ae';
      c.textAlign = 'left';
      c.fillText('h1 … h' + st.H + ' →', lw, 10 * (ch + 3) + 12);
      $('#dOutH').textContent = `Output neurons: how much each one listens to each hidden neuron (brightest = ±${fmtn(s, 2)})`;
    }

    // controls
    $('#dPlay').textContent = st.running ? '⏸ Pause' : '▶ Train';
    const tl = $('#dTl');
    tl.max = st.snaps.length - 1;
    if (document.activeElement !== tl || st.running) tl.value = st.t;
    const back = st.t < st.snaps.length - 1;
    $('#dTlLabel').textContent = back ? `⏪ step ${snapNow.step.toLocaleString()}` : `Step ${st.step.toLocaleString()}`;
    $('#dMsg').textContent = st.msg || (back ? 'Looking back in time: the pictures show the weights as they were then. Press ▶ Train or Step to carry on from here.' : '');

    // charts
    drawAcc($("#dAcc"), st.snaps, st.t, lv.target);
    drawErr($('#dErr'), st.snaps, st.t);
    $('#dAccNow').textContent = `now ${fmtn(snapNow.exam, 1)}% right · goal ${lv.target}%`;
    $('#dErrNow').textContent = `now ${fmtn(snapNow.err, 3)}`;

    renderProbe();
    renderMistakes();
    renderExplain();
    const mine = ((hooks.save().digits || {}).mine || []).length;
    const n = data().train.length.toLocaleString();
    $('#mineCount').textContent = mine ? `You have added ${mine === 1 ? 'one' : mine} of your own digits to the ${n} examples it learns from.` : `It learns from ${n} examples. Add your own to help it read your writing.`;
  }

  function drawAcc(cv, snaps, cur, goal) {
    const W = 560, H = 150, c = prep(cv, W, H), l = 40, t = 10, w = W - l - 10, h = H - t - 26;
    const last = Math.max(1, snaps[snaps.length - 1].step);
    const px = s => l + (s / last) * w, py = v => t + (1 - v / 100) * h;
    c.font = '11px "Segoe UI", system-ui, sans-serif';
    c.lineWidth = 1;
    for (const v of [0, 25, 50, 75, 100]) {
      c.strokeStyle = '#1f293d';
      c.beginPath(); c.moveTo(l, py(v)); c.lineTo(l + w, py(v)); c.stroke();
      c.fillStyle = '#8a98ae'; c.textAlign = 'right'; c.fillText(v + '%', l - 6, py(v) + 4);
    }
    c.strokeStyle = '#4ade80';
    c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(l, py(goal)); c.lineTo(l + w, py(goal)); c.stroke();
    c.setLineDash([]);
    for (const [key, col] of [['train', '#a5b4fc'], ['exam', '#ffd166']]) {
      c.strokeStyle = col;
      c.lineWidth = 2.2;
      c.beginPath();
      snaps.forEach((s, i) => (i ? c.lineTo(px(s.step), py(s[key])) : c.moveTo(px(s.step), py(s[key]))));
      c.stroke();
    }
    c.fillStyle = '#8a98ae';
    c.textAlign = 'right';
    c.fillText('training steps →  ' + last.toLocaleString(), l + w, t + h + 20);
    if (cur < snaps.length - 1) {
      c.strokeStyle = '#fff';
      c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(px(snaps[cur].step), t); c.lineTo(px(snaps[cur].step), t + h); c.stroke();
      c.setLineDash([]);
    }
  }

  function drawErr(cv, snaps, cur) {
    const W = 560, H = 110, c = prep(cv, W, H), l = 40, t = 8, w = W - l - 10, h = H - t - 24;
    const last = Math.max(1, snaps[snaps.length - 1].step), top = Math.max(0.01, ...snaps.map(s => s.err));
    const px = s => l + (s / last) * w, py = v => t + (1 - v / top) * h;
    c.font = '11px "Segoe UI", system-ui, sans-serif';
    c.strokeStyle = '#33415c';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(l, t); c.lineTo(l, t + h); c.lineTo(l + w, t + h); c.stroke();
    c.fillStyle = '#8a98ae';
    c.textAlign = 'right';
    c.fillText(fmtn(top, 2), l - 6, t + 8);
    c.fillText('0', l - 6, t + h + 3);
    c.strokeStyle = '#ff6b6b';
    c.lineWidth = 2;
    c.beginPath();
    snaps.forEach((s, i) => (i ? c.lineTo(px(s.step), py(s.err)) : c.moveTo(px(s.step), py(s.err))));
    c.stroke();
    if (cur < snaps.length - 1) {
      c.strokeStyle = '#fff';
      c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(px(snaps[cur].step), t); c.lineTo(px(snaps[cur].step), t + h); c.stroke();
      c.setLineDash([]);
    }
  }

  // The ten output neurons' answers for the drawn digit (or a clicked example).
  function renderProbe() {
    const p = st.probe;
    drawTile(prep($('#padSmall'), 70, 70), p ? p.x : new Array(N).fill(0), 0, 0, 70, 'ink');
    if (!p) {
      $('#dBars').innerHTML = '';
      $('#dGuess').innerHTML = '<span class="dim">Draw a digit in the box (or click an exam mistake) to see what the network thinks.</span>';
      return;
    }
    const y = st.net.forward(p.x), best = argmax(y);
    $('#dBars').innerHTML = y.map((v, d) => `<div class="dbar${d === best ? ' best' : ''}"><i style="height:${Math.max(2, v * 100)}%"></i><b>${fmtn(v, 2)}</b><span>${d}</span></div>`).join('');
    $('#dGuess').innerHTML = `It thinks it is ${best === 8 ? 'an' : 'a'} <b class="big">${best}</b> <span class="dim">(neuron ${best} answers ${fmtn(y[best], 2)})</span>` +
      (p.label !== undefined ? `<br><span class="${p.label === best ? 'good' : 'bad'}">${p.label === best ? 'Right!' : `It is really ${an(p.label)}.`}</span>` : '');
  }

  function renderMistakes() {
    const wrong = [];
    for (const e of data().exam) {
      const g = argmax(st.net.forward(e.x));
      if (g !== e.d) wrong.push({ e, g });
    }
    $('#dMisCount').textContent = `${wrong.length} of ${data().exam.length} wrong`;
    const show = wrong.slice(0, 18), gal = $('#dMis');
    gal.innerHTML = show.map((m, k) => `<button class="dcard small" data-k="${k}"><canvas></canvas><span class="dlab">${an(m.e.d)}<br>said <b class="bad">${m.g}</b></span></button>`).join('') +
      (wrong.length > show.length ? `<p class="dim">… and ${wrong.length - show.length} more</p>` : '') +
      (!wrong.length ? '<p class="good">No mistakes at all!</p>' : '');
    show.forEach((m, k) => drawTile(prep(gal.children[k].querySelector('canvas'), 36, 36), m.e.x, 0, 0, 36, 'ink'));
    st.mistakes = show;
  }

  // One training step worked out: the picture, every output's miss, and every nudge as a picture.
  function renderExplain() {
    const e = st.last, el = $('#dExplain');
    if (!e || e.step !== st.step || st.t < st.snaps.length - 1) {
      el.innerHTML = st.running ? '<p class="dim">Training… Pause, or choose the Slow speed, to see each nudge worked out.</p>'
        : '<p class="dim">Press <b>Step</b> to show the network one picture and see exactly how it nudges every weight.</p>';
      return;
    }
    const outs = e.res.neurons.filter(n => n.l === st.net.W.length - 1).sort((a, b) => a.j - b.j);
    const hid = e.res.neurons.filter(n => n.l === 0 && st.H).sort((a, b) => a.j - b.j);
    const y = e.res.out, guess = argmax(y);
    let h = `<h3>Step ${e.step.toLocaleString()}</h3><div class="exrow"><canvas id="exPic"></canvas><div>` +
      `<p>The picture is <b>${an(e.e.d)}</b>. Right answers: neuron ${e.e.d} should say 1, every other neuron 0.</p>` +
      `<p>Its guess was <b>${guess}</b> ${guess === e.e.d ? '<span class="good">(right)</span>' : '<span class="bad">(wrong)</span>'}.</p></div></div>`;
    h += '<table class="nudges"><thead><tr><th>neuron</th><th>said</th><th>right</th><th>miss</th></tr></thead><tbody>' +
      outs.map(n => `<tr${n.j === e.e.d ? ' class="hl"' : ''}><td>${n.j}</td><td>${fmtn(y[n.j], 3)}</td><td>${n.j === e.e.d ? 1 : 0}</td><td class="${n.blame > 0 ? 'pos' : n.blame < 0 ? 'neg' : ''}">${(n.blame > 0 ? '+' : '') + fmtn(n.blame, 3)}</td></tr>`).join('') +
      '</tbody></table>';
    const shown = st.H ? hid : outs;
    h += `<p>Every weight gets <b>nudge = learning rate × ${st.H ? 'blame' : 'miss'} × slope × pixel</b>. A pixel with no ink is 0, so its weight doesn't move at all. ` +
      (st.H ? 'Here are the nudges to each hidden neuron’s 196 weights, as pictures. Their blame comes back from all ten output neurons.'
        : `Here are each output neuron’s 196 nudges, as pictures. Neuron ${e.e.d} should have said more, so it gets a blue copy of the picture; neurons that said too much get an orange copy.`) +
      ' <span class="dim">(blue = weight goes up, orange = down)</span></p><canvas id="exNudges"></canvas>';
    el.innerHTML = h;
    drawTile(prep($('#exPic'), 70, 70), e.e.x, 0, 0, 70, 'ink');
    const nudges = shown.map(n => n.inputs.map(v => e.rate * n.blame * n.slope * v));
    const s = maxAbs(nudges), T = 44, gap = 6, cols = 10, rows = Math.ceil(shown.length / cols);
    const c = prep($('#exNudges'), cols * (T + gap), rows * (T + gap + 14));
    c.font = '11px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = '#8a98ae';
    c.textAlign = 'center';
    shown.forEach((n, k) => {
      const x = (k % cols) * (T + gap), yy = Math.floor(k / cols) * (T + gap + 14);
      drawTile(c, nudges[k], x, yy, T, s);
      c.fillText(st.H ? 'h' + (n.j + 1) : String(n.j), x + T / 2, yy + T + 11);
    });
  }

  // ---------- the drawing pad ----------
  let drawing = false, lastPt = null, padQueued = false;
  function clearPad() {
    const pad = $('#pad');
    pad.getContext('2d').clearRect(0, 0, pad.width, pad.height);
    if (st && st.mode === 'digits') st.probe = null;
  }
  function padPoint(ev) {
    const pad = $('#pad'), r = pad.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * pad.width, ((ev.clientY - r.top) / r.height) * pad.height];
  }
  function padLine(a, b) {
    const c = $('#pad').getContext('2d');
    c.strokeStyle = '#fff';
    c.lineWidth = 20;
    c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  }
  function padChanged() {
    if (padQueued) return;
    padQueued = true;
    requestAnimationFrame(() => {
      padQueued = false;
      if (!st || st.mode !== 'digits') return;
      st.probe = { x: toPixels($('#pad')) };
      renderProbe();
    });
  }

  // Keeps a drag going even if the pointer leaves the box (not every pointer allows it).
  function capture(el, ev) {
    try { el.setPointerCapture(ev.pointerId); } catch (e) { /* the drag still works inside the box */ }
  }

  // ---------- events ----------
  function wire() {
    // painting weights
    let painting = false;
    const paintAt = ev => {
      const cv = $('#paintGrid'), r = cv.getBoundingClientRect();
      const gx = Math.floor(((ev.clientX - r.left) / r.width) * G), gy = Math.floor(((ev.clientY - r.top) / r.height) * G);
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) return;
      const i = gy * G + gx;
      if (st.w[i] !== st.brush) { st.w[i] = st.brush; paintRender(false); }
    };
    $('#paintGrid').addEventListener('pointerdown', ev => {
      if (!st || st.mode !== 'paint') return;
      painting = true;
      capture(ev.target, ev);
      paintAt(ev);
    });
    $('#paintGrid').addEventListener('pointermove', ev => { if (painting) paintAt(ev); });
    const endPaint = () => { if (painting) { painting = false; paintRender(true); } };
    $('#paintGrid').addEventListener('pointerup', endPaint);
    $('#paintGrid').addEventListener('pointercancel', endPaint);
    $('#brushes').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) { st.brush = +b.dataset.v; paintRender(false); }
    });
    $('#paintClear').addEventListener('click', () => { st.w = new Array(N).fill(0); st.bias = 0; paintRender(true); });
    $('#pBias').addEventListener('input', e => { st.bias = +e.target.value; paintRender(false); });
    $('#pBias').addEventListener('change', e => { st.bias = +e.target.value; paintRender(true); });
    $('#pbMinus').addEventListener('click', () => { st.bias = Math.max(-30, st.bias - 1); paintRender(true); });
    $('#pbPlus').addEventListener('click', () => { st.bias = Math.min(30, st.bias + 1); paintRender(true); });
    $('#pTests').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b) { st.sel = +b.dataset.k; paintRender(false); }
    });

    // training
    $('#dPlay').addEventListener('click', () => { if (st.running) { stop(); digitsRender(); } else start(); });
    $('#dStepBtn').addEventListener('click', stepOnce);
    $('#dSpeeds').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      st.speed = b.dataset.v;
      buildControls();
      if (st.running) { stop(); start(); }
    });
    $('#dRatesT').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) { st.rate = +b.dataset.v; buildControls(); }
    });
    $('#dHidSeg').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      stop();
      st.H = +b.dataset.v;
      buildControls();
      newNet();
      digitsRender();
    });
    $('#dReroll').addEventListener('click', () => { stop(); newNet(); digitsRender(); });
    $('#dTl').addEventListener('input', e => {
      stop();
      st.t = +e.target.value;
      unflat(st.net, st.snaps[st.t].w);
      digitsRender();
      if (st.t === st.snaps.length - 1) st.step = st.snaps[st.t].step;
    });

    // the drawing pad
    const pad = $('#pad');
    pad.addEventListener('pointerdown', ev => {
      if (!st || st.mode !== 'digits') return;
      drawing = true;
      lastPt = padPoint(ev);
      capture(pad, ev);
      padLine(lastPt, lastPt);
      padChanged();
    });
    pad.addEventListener('pointermove', ev => {
      if (!drawing || !lastPt) return;
      const p = padPoint(ev);
      padLine(lastPt, p);
      lastPt = p;
      padChanged();
    });
    const endDraw = () => { drawing = false; };
    pad.addEventListener('pointerup', endDraw);
    pad.addEventListener('pointercancel', endDraw);
    $('#padClear').addEventListener('click', () => { clearPad(); renderProbe(); });
    $('#teachSeg').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b || !st.probe || !st.probe.x.some(v => v > 0)) return;
      const sv = hooks.save();
      sv.digits = sv.digits || { mine: [] };
      sv.digits.mine.push({ d: +b.dataset.v, x: st.probe.x.slice() });
      if (sv.digits.mine.length > 200) sv.digits.mine.shift();
      hooks.store();
      st.order = [];
      $('#dGuess').insertAdjacentHTML('beforeend', `<br><span class="good">Added to the examples as ${an(+b.dataset.v)}. Train some more and try again!</span>`);
      clearPad();
      digitsRender();
    });
    $('#dMis').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (!b || !st.mistakes) return;
      const m = st.mistakes[+b.dataset.k];
      clearPad();
      st.probe = { x: m.e.x, label: m.e.d };
      renderProbe();
    });
  }

  let wired = false;
  return {
    // Opens a digit level; h gives access to the game's saving and finishing.
    open(lv, h) {
      hooks = h;
      if (!wired) { wire(); wired = true; }
      stop();
      const paint = lv.mode === 'paint';
      $('#dCenter').classList.toggle('painting', paint);
      $('#dSide').classList.toggle('painting', paint);
      if (paint) openPaint(lv);
      else openDigits(lv);
    },
    close() { stop(); },
    // For testing: make a digit picture.
    _make: (d, seed) => makeDigit(d, NL.rng(seed)),
    _data: data,
  };
})();
