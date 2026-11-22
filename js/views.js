// Drawing: the network diagram (SVG) and the pictures (canvas).
// Every mark drawn here stands for a real number in the network.
window.NL = window.NL || {};
(function (NL) {
  'use strict';

  // Numbers shown to the player: at most two decimals, no trailing zeros, a real minus sign.
  const fmt = NL.fmt = function (v) {
    if (!isFinite(v)) return '💥';
    let s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    return s.replace('-', '−');
  };
  const sign = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');

  // Draws the network into an <svg viewBox="0 0 640 330">.
  // o: { name(l, j), bias, sel, pick: [l, j], pidx(l, j, i), flow }
  // Wire thickness = size of the weight, colour = its sign. Moving dots = the signal on that
  // wire for the selected example (weight × input), blue when it pushes the sum up, orange down.
  NL.drawNet = function (svg, net, o) {
    const W = 640, H = 330, L = net.sizes.length, mx = 76;
    const gap = l => Math.min(120, (H - 80) / net.sizes[l]);
    const X = l => mx + (l * (W - 2 * mx)) / (L - 1);
    const Y = (l, j) => H / 2 - 6 + (j - (net.sizes[l] - 1) / 2) * gap(l);
    const R = l => Math.max(9, Math.min(26, gap(l) / 2 - (net.sizes[l] <= 4 ? 13 : 4)));
    let wires = '', chips = '', nodes = '';

    const chip = (x, y, label, cls, pid) => {
      const w = Math.max(34, label.length * 7.6 + 14), h = 22;
      const on = pid >= 0;
      return `<g class="chip ${cls}${on ? ' edit' : ''}${on && pid === o.sel ? ' sel' : ''}"${on ? ` data-p="${pid}"` : ''}>` +
        `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>` +
        `<text x="${x}" y="${y + 0.5}">${label}</text></g>`;
    };

    for (let l = 0; l < L - 1; l++) {
      const n = net.sizes[l], m = net.sizes[l + 1];
      const showChips = m === 1 || (n * m <= 8 && m <= 4);
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
          const w = net.W[l][j][i];
          const x1 = X(l) + R(l), y1 = Y(l, i), x2 = X(l + 1) - R(l + 1), y2 = Y(l + 1, j);
          const sw = w === 0 ? 1.5 : 1.5 + 2.2 * Math.min(Math.abs(w), 4.5);
          const pos = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
          wires += `<line class="wire ${sign(w)}" ${pos} stroke-width="${sw}"/>`;
          const signal = w * net.a[l][i];
          if (o.flow && signal !== 0 && isFinite(signal)) wires += `<line class="flow ${sign(signal)}" ${pos}/>`;
          if (showChips) {
            const t = n === 1 && m === 1 ? 0.5 : 0.26 + 0.2 * (i % 2);
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
        const txt = r >= 22 ? fmt(a) : isFinite(a) ? a.toFixed(1) : '!';
        nodes += `<text class="val" x="${x}" y="${two ? y - 5 : y + 1}" font-size="${r >= 22 ? 16 : 10}">${txt}</text>`;
        if (two) nodes += `<text class="sum" x="${x}" y="${y + 12}">Σ ${fmt(net.z[l][j])}</text>`;
        const nm = o.name(l, j);
        if (nm) nodes += `<text class="lab" x="${x}" y="${y - r - 10}">${nm}${act && act !== 'linear' ? ' · ' + act : ''}</text>`;
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
        const lo = x0 - span, hi = x1 + span;
        c.beginPath();
        if (Math.abs(w2) >= Math.abs(w1)) {
          c.moveTo(px(lo), py(-(w1 * lo + b0) / w2));
          c.lineTo(px(hi), py(-(w1 * hi + b0) / w2));
        } else {
          c.moveTo(px(-(w2 * lo + b0) / w1), py(lo));
          c.lineTo(px(-(w2 * hi + b0) / w1), py(hi));
        }
        c.stroke();
      }
      c.restore();
    }
    const r = o.points.length > 30 ? 3.5 : 7;
    for (const p of o.points) {
      c.beginPath();
      c.arc(px(p.x[0]), py(p.x[1]), r, 0, 7);
      if (o.hollow) {
        c.lineWidth = 2.5;
        c.strokeStyle = '#fff';
      } else {
        c.fillStyle = heat((p.t - o.lo) / (o.hi - o.lo), true);
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = '#fff';
      }
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
      c.beginPath();
      c.moveTo(l, py(v));
      c.lineTo(l + w, py(v));
      c.stroke();
      c.textAlign = 'right';
      c.fillText(fmt(v), l - 6, py(v) + 4);
    }
    c.textAlign = 'center';
    for (const v of o.xticks) {
      c.fillText(fmt(v), px(v), t + h + 15);
      c.fillRect(px(v) - 0.5, t + h, 1, 4);
    }
    c.strokeStyle = LINE;
    c.beginPath();
    c.moveTo(l, t);
    c.lineTo(l, t + h);
    c.lineTo(l + w, t + h);
    c.stroke();
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
    for (const m of o.marks || []) {
      c.beginPath();
      c.moveTo(px(m), t - 6);
      c.lineTo(px(m), t + h + 6);
      c.stroke();
    }
    c.setLineDash([]);
    c.strokeStyle = '#ffd166';
    c.lineWidth = 2.5;
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i <= 280; i++) {
      const v = x0 + (i / 280) * (x1 - x0), y = Math.max(y0 - 1e3, Math.min(y1 + 1e3, f(v)));
      if (i) c.lineTo(px(v), py(y)); else c.moveTo(px(v), py(y));
    }
    c.stroke();
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

  // The error after each training step (used from Chapter 3).
  NL.drawChart = function (cv, vals) {
    const W = 280, H = 120, c = prep(cv, W, H), l = 34, t = 10, w = W - l - 8, h = H - t - 20;
    const ok = vals.filter(isFinite);
    const max = Math.max(1e-6, Math.max.apply(null, ok));
    c.strokeStyle = LINE;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(l, t);
    c.lineTo(l, t + h);
    c.lineTo(l + w, t + h);
    c.stroke();
    c.strokeStyle = '#ffd166';
    c.lineWidth = 2;
    c.lineJoin = 'round';
    c.beginPath();
    ok.forEach((v, i) => {
      const x = l + (ok.length > 1 ? i / (ok.length - 1) : 0) * w, y = t + (1 - v / max) * h;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    });
    c.stroke();
    c.fillStyle = DIM;
    c.font = FONT;
    c.textAlign = 'right';
    c.fillText(fmt(max), l - 5, t + 8);
    c.fillText('0', l - 5, t + h + 3);
    c.fillText('training steps →', l + w, t + h + 15);
  };
})(window.NL);
