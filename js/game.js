// The game: the level map, the level screen, editing numbers, checking the tests, saving progress.
window.NL = window.NL || {};
(function (NL) {
  'use strict';
  const $ = s => document.querySelector(s);
  const fmt = NL.fmt, LEVELS = NL.LEVELS, CHAPTERS = NL.CHAPTERS;
  const KEY = 'nnbuilder.v1';
  const ALL = new URLSearchParams(location.search).has('all'); // ?all opens every level, for testing
  const TOL = 1e-3;

  // ---------- saved progress (this computer only) ----------
  let save = { done: {}, params: {}, hints: {} };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') save = { done: s.done || {}, params: s.params || {}, hints: s.hints || {} };
  } catch (e) { /* start fresh */ }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* progress not saved */ }
  }

  const isDone = id => !!save.done[id];
  const isOpen = id => ALL || id === 1 || isDone(id) || isDone(id - 1);
  const nm = (lv, l, j) => lv.names[l][j];
  const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');
  const paren = v => (v < 0 ? `(${fmt(v)})` : fmt(v));
  const getP = (net, p) => (p.i < 0 ? net.B[p.l][p.j] : net.W[p.l][p.j][p.i]);
  const setP = (net, p, v) => { if (p.i < 0) net.B[p.l][p.j] = v; else net.W[p.l][p.j][p.i] = v; };

  let cur = null; // the level being played

  // ---------- routing ----------
  function route() {
    const m = location.hash.match(/^#\/level\/(\d+)/);
    const lv = m && LEVELS.find(l => l.id === +m[1]);
    if (lv && isOpen(lv.id)) openLevel(lv);
    else showMap();
  }

  function closeModals() {
    $('#win').hidden = true;
    $('#quiz').hidden = true;
  }

  // ---------- the map ----------
  function showMap() {
    cur = null;
    closeModals();
    $('#level').hidden = true;
    $('#map').hidden = false;
    const done = LEVELS.filter(l => isDone(l.id)).length;
    $('#progress').textContent = done ? `${done} of ${LEVELS.length} levels complete` : '';
    $('#chapters').innerHTML = CHAPTERS.map(ch => {
      const lvs = LEVELS.filter(l => l.chapter === ch.id);
      return `<section class="chapter${lvs.length ? '' : ' later'}">
        <h2><span class="chn">Chapter ${ch.id}</span> ${ch.title}</h2><p>${ch.blurb}</p>
        <div class="tiles">${lvs.length ? lvs.map(tile).join('') : '<div class="soon">Coming soon</div>'}</div></section>`;
    }).join('');
    document.title = 'NN Builder';
    window.scrollTo(0, 0);
  }

  function tile(l) {
    const open = isOpen(l.id), done = isDone(l.id);
    return `<a class="tile ${done ? 'done' : open ? 'open' : 'locked'}"${open ? ` href="#/level/${l.id}"` : ''}>
      <span class="num">${l.id}</span><span class="tt">${l.title}</span><span class="tag">${l.idea}</span>
      <span class="badge">${done ? '✓' : open ? '' : '🔒'}</span></a>`;
  }

  // ---------- a level ----------
  function openLevel(lv) {
    closeModals();
    const net = new NL.Net(lv.sizes, lv.acts);
    const P = [], index = {};
    for (let l = 0; l < net.W.length; l++) {
      for (let j = 0; j < net.W[l].length; j++) {
        for (let i = 0; i < net.W[l][j].length; i++) { index[`${l},${j},${i}`] = P.length; P.push({ l, j, i }); }
        if (lv.editBias) { index[`${l},${j},-1`] = P.length; P.push({ l, j, i: -1 }); }
      }
    }
    cur = {
      lv, net, P, index, sel: 0, row: 0, pick: [lv.sizes.length - 1, 0], view: 'out',
      tryX: lv.tryIt ? lv.tryIt.slice() : null, passing: null,
    };
    loadStart();
    const saved = save.params[lv.id];
    if (Array.isArray(saved) && saved.length === P.length) P.forEach((p, k) => setP(net, p, isFinite(+saved[k]) ? +saved[k] : 0));

    $('#map').hidden = true;
    $('#level').hidden = false;
    $('#lvNum').textContent = 'Level ' + lv.id;
    $('#lvTitle').textContent = lv.title;
    $('#lvIdea').textContent = lv.idea;
    $('#story').innerHTML = lv.story;
    $('#ideaBox').innerHTML = lv.ideaBox;
    $('#goal').innerHTML = '<h4>Goal</h4>' + lv.goal;
    $('#impossible').hidden = !lv.quiz;
    renderHints();
    buildTests();
    document.title = `${lv.id}. ${lv.title} · NN Builder`;
    window.scrollTo(0, 0);
    update();
  }

  function loadStart() {
    const { lv, net } = cur;
    lv.W.forEach((layer, l) => layer.forEach((row, j) => row.forEach((w, i) => { net.W[l][j][i] = w; })));
    lv.B.forEach((layer, l) => layer.forEach((b, j) => { net.B[l][j] = b; }));
  }

  function renderHints() {
    const lv = cur.lv, n = Math.min(save.hints[lv.id] || 0, lv.hints.length);
    $('#hints').innerHTML = lv.hints.slice(0, n).map((h, k) => `<div class="hint"><b>Hint ${k + 1}.</b> ${h}</div>`).join('');
    const b = $('#hintBtn');
    b.hidden = n >= lv.hints.length;
    b.textContent = n ? 'Another hint' : 'Show a hint';
  }

  function buildTests() {
    const { lv } = cur;
    let h = '<thead><tr>' + lv.names[0].map(n => `<th>${n}</th>`).join('') +
      '<th>right answer</th><th>network</th><th></th></tr></thead><tbody>';
    lv.tests.forEach(([x, t], k) => {
      h += `<tr data-r="${k}">` + x.map(v => `<td>${fmt(v)}</td>`).join('') + `<td>${fmt(t)}</td><td class="y"></td><td class="ok"></td></tr>`;
    });
    if (cur.tryX) {
      h += '<tr data-r="try" class="try">' + cur.tryX.map((v, i) => `<td><input type="number" step="any" data-i="${i}" value="${v}" aria-label="${lv.names[0][i]}"></td>`).join('') +
        '<td class="dim">your turn!</td><td class="y"></td><td></td></tr>';
    }
    $('#tests').innerHTML = h + '</tbody>';
  }

  // Recompute everything from the current numbers and redraw.
  function update() {
    const { lv, net } = cur;
    const rows = $('#tests').tBodies[0].rows;
    let pass = 0;
    lv.tests.forEach(([x, t], k) => {
      const y = net.forward(x)[0], ok = Math.abs(y - t) < TOL;
      if (ok) pass++;
      const tr = rows[k];
      tr.className = (ok ? 'pass' : 'fail') + (cur.row === k ? ' sel' : '');
      tr.cells[tr.cells.length - 2].textContent = fmt(y);
      tr.cells[tr.cells.length - 1].textContent = ok ? '✓' : '✗';
    });
    if (cur.tryX) {
      const tr = rows[lv.tests.length];
      tr.className = 'try' + (cur.row === 'try' ? ' sel' : '');
      tr.cells[tr.cells.length - 2].textContent = fmt(net.forward(cur.tryX)[0]);
    }
    const n = lv.tests.length, all = pass === n;
    $('#score').textContent = `${pass} of ${n} passing`;
    $('#barFill').style.width = (100 * pass) / n + '%';
    $('#barFill').classList.toggle('full', all);

    drawPicture();

    net.forward(cur.row === 'try' ? cur.tryX : lv.tests[cur.row][0]);
    NL.drawNet($('#net'), net, {
      name: (l, j) => nm(lv, l, j), bias: lv.editBias, sel: cur.sel, pick: cur.pick, flow: true,
      pidx: (l, j, i) => { const k = cur.index[`${l},${j},${i}`]; return k === undefined ? -1 : k; },
    });
    renderEditor();
    renderCalc();

    save.params[lv.id] = cur.P.map(p => getP(net, p));
    store();

    const was = cur.passing;
    cur.passing = all;
    if (all && was === false && !lv.quiz) complete();
  }

  function drawPicture() {
    const { lv, net } = cur, pic = lv.picture, L = net.sizes.length, cv = $('#pic');
    let key;
    if (pic.kind === 'graph') {
      const step = lv.acts[0] === 'step', w = net.W[0][0][0];
      NL.drawGraph(cv, v => net.forward([v])[0], Object.assign({}, pic, {
        names: [nm(lv, 0, 0), nm(lv, 1, 0)],
        points: lv.tests.map(([x, t]) => [x[0], t]),
        marks: step && w ? [-net.B[0][0] / w] : [],
      }));
      key = `<span class="k"><i class="ln"></i>network's answer</span><span class="k"><i class="dot"></i>right answers</span>` +
        (step ? '<span class="k"><i class="dash"></i>where Σ = 0</span>' : '');
      $('#picTabs').innerHTML = '';
    } else {
      const hid = cur.view !== 'out';
      const f = hid ? (a, b) => (net.forward([a, b]), net.a[1][cur.view]) : (a, b) => net.forward([a, b])[0];
      let lines = null;
      if (lv.lines) {
        const js = L === 2 ? [0] : hid ? [cur.view] : net.W[0].map((_, j) => j);
        lines = js.map(j => [net.W[0][j][0], net.W[0][j][1], net.B[0][j]]);
      }
      NL.drawHeat(cv, f, {
        range: pic.range, lo: pic.lo, hi: pic.hi, ticks: pic.ticks, names: lv.names[0],
        points: lv.tests.map(([x, t]) => ({ x, t })), hollow: hid, lines,
      });
      const who = hid ? nm(lv, 1, cur.view) : 'the network';
      key = `<div class="grad"><span>${fmt(pic.lo)}</span><i></i><span>${fmt(pic.hi)}</span></div>` +
        `<p>Background: ${who}'s answer for every a and b. ` +
        (hid ? 'Rings: the test inputs.' : 'Dots: the right answers.') +
        (lines ? (lines.length > 1 ? ' Dashed: where each hidden neuron’s Σ = 0.' : ' Dashed: where Σ = 0.') : '') + '</p>';
      if (L > 2) {
        const opts = [['out', nm(lv, L - 1, 0)]].concat(lv.names[1].map((n, j) => [j, n]));
        $('#picTabs').innerHTML = 'Show: ' + opts.map(([v, n]) =>
          `<button data-v="${v}" class="${String(cur.view) === String(v) ? 'on' : ''}">${n}</button>`).join('');
      } else $('#picTabs').innerHTML = '';
    }
    $('#picKey').innerHTML = key;
  }

  function renderEditor() {
    const { lv, net } = cur, p = cur.P[cur.sel], v = getP(net, p), bias = p.i < 0;
    const [mn, mx] = bias ? lv.bRange : lv.wRange;
    $('#eLabel').innerHTML = `<b class="${cls(v)}">${bias ? 'Bias' : 'Weight'}</b> ` +
      (bias ? `of ${nm(lv, p.l + 1, p.j)}` : `on the wire ${nm(lv, p.l, p.i)} → ${nm(lv, p.l + 1, p.j)}`);
    const s = $('#slider');
    s.min = mn;
    s.max = mx;
    s.step = bias ? lv.bStep : lv.wStep;
    s.value = v;
    if (document.activeElement !== $('#num')) $('#num').value = +v.toFixed(4);
  }

  function renderCalc() {
    const { lv, net } = cur, [l, j] = cur.pick;
    let h;
    if (l === 0) {
      h = `<p><b>${nm(lv, 0, j)}</b> is an input. It doesn't calculate anything: it sends its value, <b>${fmt(net.a[0][j])}</b>, along its wires.</p>`;
    } else {
      const W = net.W[l - 1][j], src = net.a[l - 1], b = net.B[l - 1][j], z = net.z[l][j], a = net.a[l][j], act = net.acts[l - 1];
      const terms = W.map((w, i) => `<span class="${cls(w)}">${fmt(w)}</span> × ${paren(src[i])}`);
      if (lv.editBias) terms.push(`<span class="${cls(b)}">${paren(b)}</span>`);
      h = `<p class="who">Inside <b>${nm(lv, l, j)}</b> for the selected test:</p>` +
        `<p class="eq">Σ = ${terms.join(' + ')} = <b>${fmt(z)}</b></p>` +
        `<p class="small">(each weight × its input${lv.editBias ? ', plus the bias' : ''})</p>`;
      if (act === 'linear') h += `<p class="eq">output = Σ = <b>${fmt(a)}</b></p>`;
      else if (act === 'step') {
        h += z > 0 ? `<p class="eq">${fmt(z)} is more than 0, so it <b class="firing">fires: 1</b></p>`
          : `<p class="eq">${fmt(z)} is not more than 0, so it <b>stays quiet: 0</b></p>`;
      }
    }
    $('#calc').innerHTML = h;
  }

  // ---------- editing numbers ----------
  function setVal(v) {
    if (!isFinite(v)) return;
    setP(cur.net, cur.P[cur.sel], v);
    update();
  }
  function nudge(d) {
    const p = cur.P[cur.sel], st = p.i < 0 ? cur.lv.bStep : cur.lv.wStep;
    setVal(+(getP(cur.net, p) + d * st).toFixed(4));
  }

  // ---------- finishing ----------
  function complete() {
    save.done[cur.lv.id] = true;
    store();
    const next = LEVELS.find(l => l.id === cur.lv.id + 1);
    $('#winText').innerHTML = cur.lv.learned;
    $('#winNext').textContent = next ? 'Next level →' : 'Back to the map';
    $('#winNote').innerHTML = next ? '' : '<p class="dim">That is everything for now. Chapter 3, where networks learn by themselves, is coming soon!</p>';
    $('#win').hidden = false;
  }

  function showQuiz() {
    const q = cur.lv.quiz;
    $('#quizQ').textContent = q.q;
    $('#quizOpts').innerHTML = q.options.map((o, k) => `<button data-k="${k}">${o.text}</button>`).join('');
    $('#quizReply').textContent = '';
    $('#quiz').hidden = false;
  }

  // ---------- events ----------
  function wire() {
    window.addEventListener('hashchange', route);

    $('#net').addEventListener('click', e => {
      const c = e.target.closest('[data-p]');
      if (c) { cur.sel = +c.dataset.p; update(); return; }
      const n = e.target.closest('[data-n]');
      if (n) {
        cur.pick = n.dataset.n.split(',').map(Number);
        const L = cur.lv.sizes.length;
        if (L > 2 && cur.pick[0] === 1) cur.view = cur.pick[1];
        else if (L > 2 && cur.pick[0] === L - 1) cur.view = 'out';
        update();
      }
    });
    $('#picTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      cur.view = b.dataset.v === 'out' ? 'out' : +b.dataset.v;
      cur.pick = cur.view === 'out' ? [cur.lv.sizes.length - 1, 0] : [1, cur.view];
      update();
    });
    $('#tests').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-r]');
      if (!tr) return;
      cur.row = tr.dataset.r === 'try' ? 'try' : +tr.dataset.r;
      update();
    });
    $('#tests').addEventListener('input', e => {
      const inp = e.target.closest('input[data-i]'), v = inp && parseFloat(inp.value);
      if (!inp || !isFinite(v)) return;
      cur.tryX[+inp.dataset.i] = v;
      cur.row = 'try';
      update();
    });

    $('#slider').addEventListener('input', e => setVal(+e.target.value));
    $('#num').addEventListener('input', e => setVal(parseFloat(e.target.value)));
    $('#num').addEventListener('blur', renderEditor);
    $('#minus').addEventListener('click', () => nudge(-1));
    $('#plus').addEventListener('click', () => nudge(1));
    $('#reset').addEventListener('click', () => { loadStart(); update(); });
    $('#hintBtn').addEventListener('click', () => {
      save.hints[cur.lv.id] = (save.hints[cur.lv.id] || 0) + 1;
      store();
      renderHints();
    });

    $('#winNext').addEventListener('click', () => {
      const next = LEVELS.find(l => l.id === cur.lv.id + 1);
      $('#win').hidden = true;
      location.hash = next ? '#/level/' + next.id : '#/';
    });
    $('#winStay').addEventListener('click', () => { $('#win').hidden = true; });

    $('#impossible').addEventListener('click', showQuiz);
    $('#quizClose').addEventListener('click', () => { $('#quiz').hidden = true; });
    $('#quizOpts').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const o = cur.lv.quiz.options[+b.dataset.k];
      b.classList.add(o.right ? 'right' : 'wrong');
      $('#quizReply').textContent = o.reply;
      if (o.right) setTimeout(() => { $('#quiz').hidden = true; complete(); }, 1100);
    });

    $('#wipe').addEventListener('click', () => {
      if (!confirm('Forget all progress and start again from level 1?')) return;
      save = { done: {}, params: {}, hints: {} };
      store();
      showMap();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModals(); return; }
      if (!cur || !$('#win').hidden || !$('#quiz').hidden || e.target.matches('input')) return;
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); nudge(d); }
    });
  }

  wire();
  route();
})(window.NL);
