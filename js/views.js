// Drawing: the network diagram (SVG) and the pictures and charts (canvas).
// Every mark drawn here stands for a real number in the network.
window.NL = window.NL || {};
(function (NL) {
  'use strict';

  // Numbers shown to the player: at most d decimals, no trailing zeros, a real minus sign.
  const fmtn = NL.fmtn = function (v, d) {
    if (!isFinite(v)) return '💥';
    const k = Math.pow(10, d);
    let s = (Math.round(v * k) / k).toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    if (/^-0$/.test(s)) s = '0';
    return s.replace('-', '−');
  };
  const fmt = NL.fmt = v => fmtn(v, 2);
  const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');

  // Draws the network into an SVG 640 wide; the height grows for layers of 3 or 4 neurons.
  // o: { name(l, j), bias, sel, pick: [l, j], pidx(l, j, i), color(pid), flow }
  // Wire thickness = size of the weight, colour = its sign. Moving dots = the signal on that
  // wire for the selected example (weight × input), blue when it pushes the sum up, orange down.
  NL.drawNet = function (svg, net, o) {
    const L = net.sizes.length, mx = 76, W = 640;
    const small = Math.max.apply(null, net.sizes.filter(n => n <= 4));
    const H = Math.max(330, (small - 1) * 110 + 110);
    const gap = l => (net.sizes[l] <= 4 ? 110 : (H - 80) / net.sizes[l]);
    const X = l => mx + (l * (W - 2 * mx)) / (L - 1);
    const Y = (l, j) => H / 2 - 6 + (j - (net.sizes[l] - 1) / 2) * gap(l);
    const R = l => (net.sizes[l] <= 4 ? 26 : Math.max(5, Math.min(14, gap(l) / 2 - 2)));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let wires = '', chips = '', nodes = '';
    // Moving dots on more than 40 wires are too busy to read and slow to draw.
    let wireCount = 0;
    for (let l = 0; l < L - 1; l++) wireCount += net.sizes[l] * net.sizes[l + 1];
    const flow = o.flow && wireCount <= 40;

    const chip = (x, y, label, cls, pid) => {
      const on = pid >= 0, col = on && o.color ? o.color(pid) : null;
      const w = Math.max(34, label.length * 7.6 + 14) + (col ? 12 : 0), h = 22;
      return `<g class="chip ${cls}${on ? ' edit' : ''}${on && pid === o.sel ? ' sel' : ''}"${on ? ` data-p="${pid}"` : ''}>` +
        `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>` +
        (col ? `<circle cx="${x - w / 2 + 11}" cy="${y}" r="4" fill="${col}"/>` : '') +
        `<text x="${x + (col ? 6 : 0)}" y="${y + 0.5}">${label}</text></g>`;
    };

    for (let l = 0; l < L - 1; l++) {
      const n = net.sizes[l], m = net.sizes[l + 1];
      const showChips = (m === 1 && n <= 4) || n * m <= 4;
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
          const w = net.W[l][j][i];
          const x1 = X(l) + R(l), y1 = Y(l, i), x2 = X(l + 1) - R(l + 1), y2 = Y(l + 1, j);
          const sw = w === 0 ? 1.5 : 1.5 + 2.2 * Math.min(Math.abs(w), 4.5);
          const pos = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
          wires += `<line class="wire ${sign(w)}" ${pos} stroke-width="${sw}"/>`;
          const signal = w * net.a[l][i];
          if (flow && signal !== 0 && isFinite(signal)) wires += `<line class="flow ${sign(signal)}" ${pos}/>`;
          if (showChips) {
            // Where along the wire its number sits: staggered so neighbouring numbers don't touch,
            // and away from the bias numbers when 3 or 4 wires meet at one neuron.
            const t = n === 1 && m === 1 ? 0.5 : m === 1 && n > 2 ? 0.48 + 0.2 * (i % 2) : 0.26 + 0.2 * (i % 2);
            chips += chip(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, fmt(w), sign(w), o.pidx(l, j, i));
          }
        }
      }
    }

    for (let l = 0; l < L; l++) {
      for (let j = 0; j < net.sizes[l]; j++) {
        const x = X(l), y = Y(l, j), r = R(l), a = net.a[l][j], act = l ? net.acts[l - 1] : '';
        // Brightness = size of the output (up to 1), blue for positive, orange for negative.
        const k = Math.min(1, Math.abs(a)) * 0.6, base = [20, 27, 40], tint = a >= 0 ? [63, 182, 255] : [255, 157, 60];
        const fill = base.map((b, q) => Math.round(b + (tint[q] - b) * k));
        const fire = act === 'step' && a > 0;
        const picked = o.pick && o.pick[0] === l && o.pick[1] === j;
        nodes += `<circle class="node${fire ? ' fire' : ''}${picked ? ' pick' : ''}" data-n="${l},${j}" cx="${x}" cy="${y}" r="${r}" fill="rgb(${fill})"/>`;
        const two = l && act !== 'linear' && r >= 24;
        const txt = r >= 22 ? fmt(a) : fmtn(a, 1);
        nodes += `<text class="val" x="${x}" y="${two ? y - 5 : y + 1}" font-size="${r >= 22 ? 16 : 10}">${txt}</text>`;
        if (two) nodes += `<text class="sum" x="${x}" y="${y + 12}">Σ ${fmt(net.z[l][j])}</text>`;
        const nm = o.name(l, j);
        if (nm && net.sizes[l] <= 4) nodes += `<text class="lab" x="${x}" y="${y - r - 10}">${nm}${act && act !== 'linear' ? ' · ' + act : ''}</text>`;
        else if (nm) {
          // Small layers: the name sits just off the node, on the side away from its wires.
          const up = j < net.sizes[l] / 2;
          nodes += `<text class="lab small" x="${x + r + 2}" y="${y + (up ? -r + 2 : r)}">${nm}</text>`;
        }
        if (l && o.bias && net.sizes[l] <= 4) {
          const b = net.B[l - 1][j];
          chips += chip(x, y + r + 16, 'bias ' + fmt(b), sign(b), o.pidx(l - 1, j, -1));
        }
      }
    }
    svg.innerHTML = wires + nodes + chips;
  };

  // --- canvas helpers ---
  function prep(cv, w, h) {
    const d = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) {
      cv.width = Math.round(w * d);
      cv.height = Math.round(h * d);
      cv.style.aspectRatio = w + ' / ' + h;
    }
    const c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, w, h);
    return c;
  }
  const DIM = '#8a98ae', LINE = '#33415c', GRID = '#1f293d', FONT = '11px "Segoe UI", system-ui, sans-serif';
  const mix = (c1, c2, k) => c1.map((v, i) => Math.round(v + (c2[i] - v) * k));
  const SOFT = [[170, 84, 22], [30, 36, 52], [22, 112, 196]];
  const BRIGHT = [[255, 157, 60], [196, 202, 214], [63, 182, 255]];
  // Orange for low answers, blue for high ones.
  function heat(v, bright) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const p = bright ? BRIGHT : SOFT;
    return 'rgb(' + (v < 0.5 ? mix(p[0], p[1], v * 2) : mix(p[1], p[2], v * 2 - 1)) + ')';
  }
  // A round step size giving about n ticks across range.
  function niceStep(range, n) {
    const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function polyline(c, pts) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }

  // The network's answer for every pair of inputs, with the examples drawn on top as dots.
  // o: { range: [min, max], lo, hi, points: [{x, t}], hollow, lines: [[w1, w2, bias]], ticks, names }
  NL.drawHeat = function (cv, f, o) {
    const S = 280, c = prep(cv, S, S), pl = 24, pt = 6, size = S - pl - 8, N = 56, cell = size / N;
    const x0 = o.range[0], x1 = o.range[1], span = x1 - x0;
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const a = x0 + ((ix + 0.5) / N) * span, b = x1 - ((iy + 0.5) / N) * span;
        c.fillStyle = heat((f(a, b) - o.lo) / (o.hi - o.lo), false);
        c.fillRect(pl + ix * cell, pt + iy * cell, cell + 0.6, cell + 0.6);
      }
    }
    const px = a => pl + ((a - x0) / span) * size, py = b => pt + ((x1 - b) / span) * size;
    if (o.lines) {
      c.save();
      c.beginPath();
      c.rect(pl, pt, size, size);
      c.clip();
      c.strokeStyle = 'rgba(255,255,255,.85)';
      c.lineWidth = 1.5;
      c.setLineDash([5, 4]);
      for (const [w1, w2, b0] of o.lines) {
        if (!w1 && !w2) continue;
        if (!isFinite(w1 + w2 + b0)) continue;
        const lo = x0 - span, hi = x1 + span;
        if (Math.abs(w2) >= Math.abs(w1)) {
          polyline(c, [[px(lo), py(-(w1 * lo + b0) / w2)], [px(hi), py(-(w1 * hi + b0) / w2)]]);
        } else {
          polyline(c, [[px(-(w2 * lo + b0) / w1), py(lo)], [px(-(w2 * hi + b0) / w1), py(hi)]]);
        }
      }
      c.restore();
    }
    const r = o.points.length > 30 ? 3.5 : 7;
    for (const p of o.points) {
      c.beginPath();
      c.arc(px(p.x[0]), py(p.x[1]), r, 0, 7);
      if (o.hollow) {
        c.lineWidth = 2.5;
      } else {
        c.fillStyle = heat((p.t - o.lo) / (o.hi - o.lo), true);
        c.fill();
        c.lineWidth = 1.5;
      }
      c.strokeStyle = '#fff';
      c.stroke();
    }
    c.fillStyle = DIM;
    c.font = FONT;
    for (const t of o.ticks) {
      c.textAlign = 'center';
      c.fillText(fmt(t), px(t), pt + size + 14);
      c.textAlign = 'right';
      c.fillText(fmt(t), pl - 6, py(t) + 4);
    }
    c.textAlign = 'right';
    c.fillText(o.names[0] + ' →', pl + size, pt + size + 14);
    c.save();
    c.translate(12, pt + 4);
    c.rotate(-Math.PI / 2);
    c.fillText(o.names[1] + ' →', 0, 0);
    c.restore();
  };

  // A graph of the network's answer for every value of its one input.
  // o: { range, yRange, xticks, yticks, names: [input, output], points: [[x, t]], marks: [x] }
  NL.drawGraph = function (cv, f, o) {
    const W = 280, H = 220, c = prep(cv, W, H), l = 36, t = 22, w = W - l - 10, h = H - t - 38;
    const [x0, x1] = o.range, [y0, y1] = o.yRange;
    const px = v => l + ((v - x0) / (x1 - x0)) * w, py = v => t + (1 - (v - y0) / (y1 - y0)) * h;
    c.font = FONT;
    c.lineWidth = 1;
    c.fillStyle = DIM;
    for (const v of o.yticks) {
      c.strokeStyle = GRID;
      polyline(c, [[l, py(v)], [l + w, py(v)]]);
      c.textAlign = 'right';
      c.fillText(fmt(v), l - 6, py(v) + 4);
    }
    c.textAlign = 'center';
    for (const v of o.xticks) {
      c.fillText(fmt(v), px(v), t + h + 15);
      c.fillRect(px(v) - 0.5, t + h, 1, 4);
    }
    c.strokeStyle = LINE;
    polyline(c, [[l, t], [l, t + h], [l + w, t + h]]);
    c.textAlign = 'right';
    c.fillText(o.names[0] + ' →', l + w, t + h + 32);
    c.textAlign = 'left';
    c.fillText('↑ ' + o.names[1], 4, 12);

    c.save();
    c.beginPath();
    c.rect(l - 2, t - 16, w + 10, h + 22);
    c.clip();
    c.strokeStyle = 'rgba(255,255,255,.8)';
    c.lineWidth = 1.5;
    c.setLineDash([5, 4]);
    for (const m of o.marks || []) polyline(c, [[px(m), t - 6], [px(m), t + h + 6]]);
    c.setLineDash([]);
    c.strokeStyle = '#ffd166';
    c.lineWidth = 2.5;
    c.lineJoin = 'round';
    const pts = [];
    for (let i = 0; i <= 280; i++) {
      const v = x0 + (i / 280) * (x1 - x0), y = Math.max(y0 - 1e3, Math.min(y1 + 1e3, f(v)));
      pts.push([px(v), py(y)]);
    }
    polyline(c, pts);
    c.fillStyle = '#fff';
    c.strokeStyle = '#0c111b';
    c.lineWidth = 2;
    for (const [x, y] of o.points) {
      c.beginPath();
      c.arc(px(x), py(y), 5, 0, 7);
      c.fill();
      c.stroke();
    }
    c.restore();
  };

  // The error for every possible value of one weight: a valley.
  // o: { x0, x1, ymax, f(w), curve, dots: [w], trail: [w], ball: w, slope }
  NL.drawValley = function (cv, o) {
    const W = 280, H = 230, c = prep(cv, W, H), l = 40, t = 20, w = W - l - 12, h = H - t - 40;
    const px = v => l + ((v - o.x0) / (o.x1 - o.x0)) * w;
    const py = e => t + (1 - Math.min(1.06, Math.max(-0.02, e / o.ymax))) * h;
    c.font = FONT;
    c.lineWidth = 1;
    c.fillStyle = DIM;
    const ys = niceStep(o.ymax, 4);
    for (let v = 0; v <= o.ymax + 1e-9; v += ys) {
      c.strokeStyle = GRID;
      polyline(c, [[l, py(v)], [l + w, py(v)]]);
      c.textAlign = 'right';
      c.fillText(fmt(v), l - 6, py(v) + 4);
    }
    c.textAlign = 'center';
    for (let v = Math.ceil(o.x0); v <= o.x1; v += 1) {
      c.fillText(fmt(v), px(v), t + h + 15);
      c.fillRect(px(v) - 0.5, t + h, 1, 4);
    }
    c.strokeStyle = LINE;
    polyline(c, [[l, t], [l, t + h], [l + w, t + h]]);
    c.textAlign = 'right';
    c.fillText('weight →', l + w, t + h + 32);
    c.textAlign = 'left';
    c.fillText('↑ error', 4, 12);
    c.save();
    c.beginPath();
    c.rect(l - 8, t - 14, w + 16, h + 15);
    c.clip();
    if (o.curve) {
      c.strokeStyle = '#51627f';
      c.lineWidth = 2.5;
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const v = o.x0 + (i / 200) * (o.x1 - o.x0);
        pts.push([px(v), py(o.f(v))]);
      }
      polyline(c, pts);
    }
    c.fillStyle = '#3fb6ff';
    for (const v of o.dots || []) {
      c.beginPath();
      c.arc(px(v), py(o.f(v)), 4, 0, 7);
      c.fill();
    }
    if (o.trail && o.trail.length > 1) {
      c.strokeStyle = 'rgba(255,209,102,.6)';
      c.lineWidth = 1.5;
      polyline(c, o.trail.map(v => [px(v), py(o.f(v))]));
      c.fillStyle = 'rgba(255,209,102,.7)';
      for (const v of o.trail) {
        c.beginPath();
        c.arc(px(v), py(o.f(v)), 3, 0, 7);
        c.fill();
      }
    }
    if (o.slope !== undefined && isFinite(o.slope)) {
      // The slope under the ball, drawn as a short straight line touching the valley.
      const e = o.f(o.ball), dw = 0.9 / Math.sqrt(1 + Math.pow((o.slope * (o.x1 - o.x0)) / o.ymax / 3, 2));
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      polyline(c, [[px(o.ball - dw), py(e - o.slope * dw)], [px(o.ball + dw), py(e + o.slope * dw)]]);
    }
    if (o.ball !== undefined && isFinite(o.ball)) {
      c.fillStyle = '#ffd166';
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(px(o.ball), py(o.f(o.ball)) - 1, 7, 0, 7);
      c.fill();
      c.stroke();
    }
    c.restore();
  };

  // Every weight and bias over the training steps, one coloured line each.
  // o: { n, count, get(step, k), colors, sel, cursor }
  NL.drawHistory = function (cv, o) {
    const W = 560, H = 190, c = prep(cv, W, H), l = 40, t = 10, w = W - l - 10, h = H - t - 30;
    let lo = 0, hi = 0;
    for (let i = 0; i < o.n; i += Math.max(1, Math.floor(o.n / 400))) {
      for (let k = 0; k < o.count; k++) {
        const v = o.get(i, k);
        if (isFinite(v) && Math.abs(v) < 1e6) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
    }
    for (let k = 0; k < o.count; k++) {
      const v = o.get(o.n - 1, k);
      if (isFinite(v) && Math.abs(v) < 1e6) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const st = niceStep(hi - lo, 4);
    lo = Math.floor(lo / st) * st;
    hi = Math.ceil(hi / st) * st;
    const last = o.n - 1;
    const px = i => l + (i / Math.max(1, last)) * w, py = v => t + (1 - (v - lo) / (hi - lo)) * h;
    c.font = FONT;
    c.lineWidth = 1;
    for (let v = lo; v <= hi + st / 2; v += st) {
      c.strokeStyle = Math.abs(v) < st / 2 ? '#3a4867' : GRID;
      polyline(c, [[l, py(v)], [l + w, py(v)]]);
      c.fillStyle = DIM;
      c.textAlign = 'right';
      c.fillText(fmt(v), l - 6, py(v) + 4);
    }
    c.textAlign = 'right';
    c.fillText('training steps →  ' + (o.n - 1), l + w, t + h + 22);
    c.textAlign = 'left';
    c.fillText('0', l, t + h + 22);
    c.save();
    c.beginPath();
    c.rect(l, t - 4, w + 4, h + 8);
    c.clip();
    const cols = Math.min(w, o.n);
    const order = [];
    for (let k = 0; k < o.count; k++) if (k !== o.sel) order.push(k);
    if (o.sel >= 0) order.push(o.sel);
    for (const k of order) {
      const pts = [];
      for (let q = 0; q <= cols; q++) {
        const i = Math.round((q / cols) * last), v = o.get(i, k);
        pts.push([px(i), py(Math.max(lo - 1e3, Math.min(hi + 1e3, isFinite(v) ? v : hi + 1e3)))]);
      }
      c.globalAlpha = o.sel >= 0 && k !== o.sel ? 0.25 : 1;
      c.strokeStyle = o.colors[k % o.colors.length];
      c.lineWidth = k === o.sel ? 3.5 : 2;
      c.lineJoin = 'round';
      polyline(c, pts);
    }
    c.globalAlpha = 1;
    c.restore();
    if (o.cursor < o.n - 1) {
      c.strokeStyle = '#fff';
      c.setLineDash([3, 3]);
      polyline(c, [[px(o.cursor), t], [px(o.cursor), t + h]]);
      c.setLineDash([]);
    }
  };

  // The error after each training step, on a scale where each line is 10 times smaller.
  NL.drawLogChart = function (cv, vals, cursor) {
    const W = 560, H = 130, c = prep(cv, W, H), l = 52, t = 8, w = W - l - 10, h = H - t - 24;
    const ok = vals.filter(v => isFinite(v) && v > 0);
    let top = ok.length ? Math.ceil(Math.log10(Math.max.apply(null, ok))) : 0;
    let bot = ok.length ? Math.floor(Math.log10(Math.min.apply(null, ok))) : -1;
    bot = Math.max(bot, top - 12);
    if (top - bot < 2) bot = top - 2;
    const every = Math.ceil((top - bot) / 6);
    const last = vals.length - 1;
    const px = i => l + (i / Math.max(1, last)) * w;
    const py = v => t + ((top - Math.log10(Math.max(v, Math.pow(10, bot - 0.3)))) / (top - bot)) * h;
    c.font = FONT;
    c.lineWidth = 1;
    for (let e = bot; e <= top; e++) {
      const v = Math.pow(10, e);
      c.strokeStyle = GRID;
      polyline(c, [[l, py(v)], [l + w, py(v)]]);
      if ((top - e) % every) continue;
      c.fillStyle = DIM;
      c.textAlign = 'right';
      c.fillText(e >= 0 ? String(v) : fmtn(v, -e), l - 6, py(v) + 4);
    }
    c.textAlign = 'right';
    c.fillText('training steps →  ' + (vals.length - 1), l + w, t + h + 18);
    c.save();
    c.beginPath();
    c.rect(l, t - 4, w + 4, h + 8);
    c.clip();
    const cols = Math.min(w, vals.length);
    const pts = [];
    for (let q = 0; q <= cols; q++) {
      const i = Math.round((q / cols) * last), v = vals[i];
      pts.push([px(i), isFinite(v) ? py(v) : t - 10]);
    }
    c.strokeStyle = '#ff6b6b';
    c.lineWidth = 2;
    c.lineJoin = 'round';
    polyline(c, pts);
    c.restore();
    if (cursor < vals.length - 1) {
      c.strokeStyle = '#fff';
      c.setLineDash([3, 3]);
      polyline(c, [[px(cursor), t], [px(cursor), t + h]]);
      c.setLineDash([]);
    }
  };
})(window.NL);
