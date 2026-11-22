// The game: the level map, the level screen, editing numbers, training, checking the tests,
// saving progress.
//
// A level has one of four modes:
//   build   - Eli sets every number by hand and must pass the tests (levels 1-11)
//   meter   - find a secret weight using only the error (level 12)
//   descent - pick a learning rate and roll down the error valley (level 13)
//   train   - watch gradient descent train the network (levels 14-16)
window.NL = window.NL || {};
(function (NL) {
  'use strict';
  const $ = s => document.querySelector(s);
  const fmt = NL.fmt, fmtn = NL.fmtn, LEVELS = NL.LEVELS, CHAPTERS = NL.CHAPTERS;
  const KEY = 'nnbuilder.v1';
  const ALL = new URLSearchParams(location.search).has('all'); // ?all opens every level, for testing
  const TOL = 1e-3;
  const MAX_STEPS = 30000;
  const SPEEDS = [['slow', 'Slow', { every: 600 }], ['medium', 'Medium', { per: 1 }], ['fast', 'Fast', { per: 20 }], ['turbo', 'Turbo', { per: 200 }]];
  // One colour per weight or bias, used for its dot on the diagram and its line on the chart.
  const PALETTE = ['#ffd166', '#ff6b9a', '#7ee081', '#c792ea', '#5eead4', '#ff8a65', '#a5b4fc', '#e2c08d',
    '#f9a8d4', '#c5e478', '#67e8f9', '#fca5a5', '#d4d4d8', '#fde047', '#86efac', '#fdba74', '#93c5fd'];

  // ---------- saved progress (this computer only) ----------
  // lab: the chosen task and network design, plus a star and the fewest training steps for each task.
  const freshLab = () => ({ task: 'add', arch: { hidden: [], act: 'tanh' }, stars: {}, best: {} });
  let save = { done: {}, params: {}, hints: {}, lab: freshLab() };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      const lab = Object.assign(freshLab(), s.lab || {});
      if (!NL.LAB.some(t => t.id === lab.task)) lab.task = 'add';
      const a = lab.arch || {};
      lab.arch = {
        hidden: Array.isArray(a.hidden) ? a.hidden.slice(0, 2).map(n => Math.max(1, Math.min(6, n | 0))) : [],
        act: ['sigmoid', 'tanh', 'relu'].indexOf(a.act) >= 0 ? a.act : 'tanh',
      };
      save = { done: s.done || {}, params: s.params || {}, hints: s.hints || {}, lab };
    }
  } catch (e) { /* start fresh */ }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* progress not saved */ }
  }

  const isDone = id => !!save.done[id];
  const isOpen = id => ALL || id === 1 || isDone(id) || isDone(id - 1);
  const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');
  const paren = (v, d) => (v < 0 ? `(${fmtn(v, d || 2)})` : fmtn(v, d || 2));
  const signed = (v, d) => (v > 0 ? '+' : '') + fmtn(v, d || 4);
  const getP = (net, p) => (p.i < 0 ? net.B[p.l][p.j] : net.W[p.l][p.j][p.i]);
  const setP = (net, p, v) => { if (p.i < 0) net.B[p.l][p.j] = v; else net.W[p.l][p.j][p.i] = v; };
  const seg = (el, items, on) => {
    el.innerHTML = items.map(([v, label]) => `<button data-v="${v}" class="${String(v) === String(on) ? 'on' : ''}">${label}</button>`).join('');
  };

  let cur = null; // the level being played
  let timer = null, raf = null;

  // ---------- routing ----------
  function route() {
    stopTraining();
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
    const stars = Object.keys(save.lab.stars).length;
    const badge = l.mode === 'lab' && open ? `<span class="stars">★ ${stars} of ${NL.LAB.length}</span>` : done ? '✓' : open ? '' : '🔒';
    return `<a class="tile ${done ? 'done' : open ? 'open' : 'locked'}"${open ? ` href="#/level/${l.id}"` : ''}>
      <span class="num">${l.id}</span><span class="tt">${l.title}</span><span class="tag">${l.idea}</span>
      <span class="badge">${badge}</span></a>`;
  }

  // ---------- the Lab: each task becomes a training level built from Eli's design ----------
  const labTask = () => NL.LAB.find(t => t.id === save.lab.task);
  function archText(a) {
    if (!a.hidden.length) return 'no hidden layer';
    return a.hidden.length === 1 ? `1 hidden layer of ${a.hidden[0]} ${a.act} neuron${a.hidden[0] > 1 ? 's' : ''}`
      : `2 hidden layers (${a.hidden.join(' and ')} ${a.act} neurons)`;
  }
  function labLevel(base) {
    const t = labTask(), best = save.lab.best[t.id];
    return Object.assign({}, base, {
      mode: 'train', lab: true, title: 'The Lab: ' + t.title, hintKey: 'lab-' + t.id,
      names: [t.names, [t.outName]], tests: t.tests, tol: t.tol, rates: t.rates, rate: t.rate, hints: t.hints,
      picture: { kind: 'heat', range: t.range, lo: t.lo, hi: t.hi, ticks: t.ticks },
      story: `<p>Welcome to the Lab! Pick a task, design a network for it, and train it. Each task has a star to earn.</p>
        <p>Then try to beat your record: earn the star again in fewer training steps.</p>`,
      ideaBox: `<h4>Task: ${t.title}</h4><p>${t.about}</p>` +
        `<p class="small">${t.out === 'linear' ? 'The answer is a number, so the output neuron is linear: it gives back its sum.' : 'The answer is yes (1) or no (0), so the output neuron is a sigmoid.'}</p>` +
        `<details><summary>Which hidden activation?</summary>${NL.ACT_PICS}<p class="small">sigmoid slides from 0 to 1. tanh slides from −1 to 1. relu gives 0 until its sum goes above 0, then gives back the sum.</p></details>`,
      goal: `Earn the star: get every example within ${fmt(t.tol)} of the right answer.` +
        (best ? `<p class="record">★ Your record: <b>${best.steps.toLocaleString()} steps</b> with ${archText(best.arch)}.</p>` : ''),
      learned: c => `<p>${t.learned}</p>` + c.recordNote,
    });
  }

  // ---------- opening a level ----------
  function openLevel(lv) {
    closeModals();
    const lab = lv.mode === 'lab';
    if (lab) lv = labLevel(lv);
    const mode = lv.mode || 'build';
    cur = { lv, mode, lab, sel: mode === 'train' ? -1 : 0, row: 0, view: 'out', passing: null, rate: lv.rate, speed: 'fast',
      act: lv.acts[0], hidden: lv.hidden || 0, tryX: lv.tryIt ? lv.tryIt.slice() : null };
    if (lv.secrets) {
      cur.secret = lv.secrets[Math.floor(Math.random() * lv.secrets.length)];
      cur.tests = lv.xs.map(x => [[x], cur.secret * x]);
    } else cur.tests = lv.tests;
    cur.samples = cur.tests.map(([x, t]) => ({ x, t }));
    makeNet(false);

    $('#map').hidden = true;
    $('#level').hidden = false;
    $('#lvNum').textContent = lab ? 'Chapter 4' : 'Level ' + lv.id;
    $('#lvTitle').textContent = lv.title;
    $('#lvIdea').textContent = lv.idea;
    $('#story').innerHTML = lv.story;
    $('#ideaBox').innerHTML = lv.ideaBox;
    $('#goal').innerHTML = '<h4>Goal</h4>' + lv.goal;
    $('#impossible').hidden = !lv.quiz;
    const show = (id, on) => { $(id).hidden = !on; };
    show('#editor', mode === 'build' || mode === 'meter');
    show('#calc', mode === 'build' || mode === 'meter');
    show('#descent', mode === 'descent');
    show('#trainer', mode === 'train');
    show('#charts', mode === 'train');
    show('#explain', mode === 'train' || mode === 'descent');
    show('#meter', mode === 'meter' || mode === 'descent');
    show('#examPanel', !!lv.exam);
    show('#labPanel', lab);
    show('#reset', mode === 'build' || mode === 'meter');
    show('#bar', mode === 'build' || mode === 'train');
    $('#testsTitle').textContent = mode === 'build' ? 'Tests' : 'Examples';
    $('#picTitle').textContent = mode === 'meter' || mode === 'descent' ? 'The Valley' : 'The Picture';
    renderHints();
    buildTable('#tests', cur.tests, true);
    if (lv.exam) buildTable('#exam', lv.exam, false);
    buildControls();
    document.title = `${lv.id}. ${lv.title} · NN Builder`;
    window.scrollTo(0, 0);
    update('init');
  }

  // Makes the network for the current level and settings; random = a new random start.
  function makeNet(random) {
    const lv = cur.lv;
    let sizes = lv.sizes, acts = lv.acts, names = lv.names;
    if (cur.lab) {
      const a = save.lab.arch, t = labTask();
      sizes = [2].concat(a.hidden, [1]);
      acts = a.hidden.map(() => a.act).concat([t.out]);
      names = [lv.names[0]].concat(a.hidden.map((n, q) => Array.from({ length: n }, (_, j) => (q ? 'k' : 'h') + (j + 1))), [lv.names[1]]);
      lv.lines = a.hidden.length > 0 || t.out === 'sigmoid';
    } else if (lv.hiddenChoice && cur.hidden) {
      sizes = [2, cur.hidden, 1];
      acts = ['sigmoid', 'sigmoid'];
      names = [lv.names[0], Array.from({ length: cur.hidden }, (_, j) => 'h' + (j + 1)), lv.names[1]];
    } else if (lv.actChoice) acts = [cur.act];
    cur.names = names;
    const net = cur.net = new NL.Net(sizes, acts);
    const P = cur.P = [], index = cur.index = {};
    for (let l = 0; l < net.W.length; l++) {
      for (let j = 0; j < net.W[l].length; j++) {
        for (let i = 0; i < net.W[l][j].length; i++) { index[`${l},${j},${i}`] = P.length; P.push({ l, j, i }); }
        if (lv.editBias) { index[`${l},${j},-1`] = P.length; P.push({ l, j, i: -1 }); }
      }
    }
    if (random || !lv.W) net.randomize(NL.rng((Math.random() * 4294967296) >>> 0), 1);
    else loadStart();
    if (cur.mode === 'build') {
      const saved = save.params[lv.id];
      if (Array.isArray(saved) && saved.length === P.length) P.forEach((p, k) => setP(net, p, isFinite(+saved[k]) ? +saved[k] : 0));
    }
    if (cur.mode === 'train') {
      cur.hist = [snapshot()];
      cur.errs = [net.loss(cur.samples)];
      cur.t = 0;
      cur.last = null;
      cur.msg = '';
      cur.won = false;
      if (cur.sel >= P.length) cur.sel = -1;
      // The order examples are shown in: as listed, or shuffled in the Lab where lists are long.
      cur.order = cur.tests.map((_, k) => k);
      if (cur.lab) {
        const rnd = NL.rng((Math.random() * 4294967296) >>> 0);
        for (let k = cur.order.length - 1; k > 0; k--) {
          const q = Math.floor(rnd() * (k + 1));
          [cur.order[k], cur.order[q]] = [cur.order[q], cur.order[k]];
        }
      }
    }
    if (cur.mode === 'descent') {
      cur.trail = [net.W[0][0][0]];
      cur.steps = 0;
      cur.last = null;
      cur.over = null;
    }
    if (cur.mode === 'meter') cur.tries = [];
    cur.pick = [sizes.length - 1, 0];
    if (cur.view !== 'out' && !(cur.view[0] > 0 && cur.view[0] < sizes.length - 1 && cur.view[1] < sizes[cur.view[0]])) cur.view = 'out';
  }

  function loadStart() {
    const { lv, net } = cur;
    lv.W.forEach((layer, l) => layer.forEach((row, j) => row.forEach((w, i) => { net.W[l][j][i] = w; })));
    lv.B.forEach((layer, l) => layer.forEach((b, j) => { net.B[l][j] = b; }));
  }

  const snapshot = () => cur.P.map(p => getP(cur.net, p));
  const setAll = vec => cur.P.forEach((p, k) => setP(cur.net, p, vec[k]));
  const nm = (l, j) => cur.names[l][j];
  const pname = p => (p.i < 0 ? `bias ${nm(p.l + 1, p.j)}` : `${nm(p.l, p.i)}→${nm(p.l + 1, p.j)}`);
  const color = k => PALETTE[k % PALETTE.length];

  function renderHints() {
    const lv = cur.lv, n = Math.min(save.hints[lv.hintKey || lv.id] || 0, lv.hints.length);
    $('#hints').innerHTML = lv.hints.slice(0, n).map((h, k) => `<div class="hint"><b>Hint ${k + 1}.</b> ${h}</div>`).join('');
    const b = $('#hintBtn');
    b.hidden = n >= lv.hints.length;
    b.textContent = n ? 'Another hint' : 'Show a hint';
  }

  const TABLE_MAX = 16; // longer lists of examples are summed up instead of listed

  function buildTable(sel, tests, main) {
    const { lv, mode } = cur, hide = mode === 'meter', check = mode === 'build' || mode === 'train' || !main;
    if (main) {
      $(sel).hidden = tests.length > TABLE_MAX;
      $('#testsTip').textContent = tests.length > TABLE_MAX
        ? `${tests.length} examples: too many to list. They are the dots on the Picture.`
        : 'Click a row to send that example through the network.';
      if (tests.length > TABLE_MAX) { $(sel).innerHTML = '<tbody></tbody>'; return; }
    }
    let h = '<thead><tr>' + lv.names[0].map(n => `<th>${n}</th>`).join('') +
      `<th>right answer</th><th>network</th>${check ? '<th></th>' : ''}</tr></thead><tbody>`;
    tests.forEach(([x, t], k) => {
      h += `<tr data-r="${main ? k : ''}">` + x.map(v => `<td>${fmt(v)}</td>`).join('') +
        `<td>${hide ? '🔒' : fmt(t)}</td><td class="y"></td>${check ? '<td class="ok"></td>' : ''}</tr>`;
    });
    if (main && cur.tryX) {
      h += '<tr data-r="try" class="try">' + cur.tryX.map((v, i) => `<td><input type="number" step="any" data-i="${i}" value="${v}" aria-label="${lv.names[0][i]}"></td>`).join('') +
        '<td class="dim">your turn!</td><td class="y"></td><td></td></tr>';
    }
    $(sel).innerHTML = h + '</tbody>';
  }

  // The Lab's task picker (with stars) and network designer.
  function renderLab() {
    const a = save.lab.arch;
    $('#labTasks').innerHTML = NL.LAB.map(t =>
      `<button data-v="${t.id}" class="${t.id === save.lab.task ? 'on' : ''}">${save.lab.stars[t.id] ? '<span class="star">★</span> ' : ''}${t.title}</button>`).join('');
    let h = `<div class="trow"><span class="lbl">Hidden layers</span><div class="seg">` +
      [0, 1, 2].map(n => `<button data-a="layers" data-v="${n}" class="${a.hidden.length === n ? 'on' : ''}">${n || 'none'}</button>`).join('') + '</div>';
    a.hidden.forEach((n, q) => {
      h += `<span class="lbl">layer ${q + 1}</span><span class="stepper"><button data-a="size" data-q="${q}" data-v="-1" aria-label="Fewer neurons"${n <= 1 ? ' disabled' : ''}>−</button>` +
        `<b>${n}</b><button data-a="size" data-q="${q}" data-v="1" aria-label="More neurons"${n >= 6 ? ' disabled' : ''}>+</button></span>`;
    });
    h += '</div>';
    if (a.hidden.length) {
      h += `<div class="trow"><span class="lbl">Hidden activation</span><div class="seg">` +
        ['sigmoid', 'tanh', 'relu'].map(v => `<button data-a="act" data-v="${v}" class="${a.act === v ? 'on' : ''}">${v}</button>`).join('') + '</div></div>';
    }
    $('#labDesign').innerHTML = h;
  }

  function buildControls() {
    const lv = cur.lv;
    if (cur.lab) renderLab();
    if (cur.mode === 'descent') seg($('#dRates'), lv.rates.map(r => [r, fmtn(r, 3)]), cur.rate);
    if (cur.mode !== 'train') return;
    seg($('#speeds'), SPEEDS.map(([v, label]) => [v, label]), cur.speed);
    seg($('#rates'), lv.rates.map(r => [r, fmtn(r, 3)]), cur.rate);
    if (lv.actChoice) {
      $('#choiceLbl').textContent = 'Activation';
      seg($('#choices'), lv.actChoice.map(a => [a, a]), cur.act);
    } else if (lv.hiddenChoice) {
      $('#choiceLbl').textContent = 'Hidden neurons';
      seg($('#choices'), lv.hiddenChoice.map(h => [h, h ? String(h) : 'none']), cur.hidden);
    }
    $('#choiceRow').hidden = !lv.actChoice && !lv.hiddenChoice;
  }

  // ---------- redrawing ----------
  // commit: true when Eli has finished changing a number (let go of the slider, pressed a
  // button), 'init' when the level opens. Wins are only checked on a commit.
  function update(commit) {
    const { lv, net, mode } = cur;
    const tol = lv.tol || TOL;
    let pass = 0;
    const rows = $('#tests').tBodies[0].rows;
    cur.tests.forEach(([x, t], k) => {
      const y = net.forward(x)[0], ok = Math.abs(y - t) < tol, tr = rows[k];
      if (ok) pass++;
      if (!tr) return;
      tr.className = (mode === 'meter' || mode === 'descent' ? '' : ok ? 'pass' : 'fail') + (cur.row === k ? ' sel' : '');
      tr.querySelector('.y').textContent = mode === 'train' ? fmtn(y, 3) : fmt(y);
      const okc = tr.querySelector('.ok');
      if (okc) okc.textContent = ok ? '✓' : '✗';
    });
    if (cur.tryX) {
      const tr = rows[cur.tests.length];
      tr.className = 'try' + (cur.row === 'try' ? ' sel' : '');
      tr.querySelector('.y').textContent = fmt(net.forward(cur.tryX)[0]);
    }
    let examPass = true;
    if (lv.exam) {
      const er = $('#exam').tBodies[0].rows;
      lv.exam.forEach(([x, t], k) => {
        const y = net.forward(x)[0], ok = Math.abs(y - t) < tol;
        if (!ok) examPass = false;
        er[k].className = ok ? 'pass' : 'fail';
        er[k].querySelector('.y').textContent = fmtn(y, 3);
        er[k].querySelector('.ok').textContent = ok ? '✓' : '✗';
      });
    }
    const n = cur.tests.length, all = pass === n;
    $('#score').textContent = mode === 'build' || mode === 'train' ? `${pass} of ${n} ${mode === 'build' ? 'passing' : 'right'}` : '';
    $('#barFill').style.width = (100 * pass) / n + '%';
    $('#barFill').classList.toggle('full', all);

    drawPicture();

    net.forward(cur.row === 'try' ? cur.tryX : cur.tests[cur.row][0]);
    const train = mode === 'train';
    NL.drawNet($('#net'), net, {
      name: nm, bias: lv.editBias, sel: cur.sel, pick: cur.pick, flow: true,
      color: train ? color : null,
      pidx: (l, j, i) => { const k = cur.index[`${l},${j},${i}`]; return k === undefined || mode === 'descent' ? -1 : k; },
    });

    if (mode === 'build' || mode === 'meter') { renderEditor(); renderCalc(); }
    if (mode === 'meter') renderMeter();
    if (mode === 'descent') renderDescent();
    if (train) { renderTrainer(); renderCharts(); renderExplain(); }

    if (mode === 'build') {
      save.params[lv.id] = snapshot();
      store();
      if (commit === 'init' || cur.passing === null) cur.passing = all;
      else if (commit) {
        const was = cur.passing;
        cur.passing = all;
        if (all && !was && !lv.quiz) complete();
      }
    }
    cur.allPass = all && examPass;
  }

  function drawPicture() {
    const { lv, net, mode } = cur, L = net.sizes.length, cv = $('#pic');
    let key = '';
    if (mode === 'meter' || mode === 'descent') {
      const w = net.W[0][0][0];
      NL.drawValley(cv, Object.assign({}, lv.valley, {
        f: valleyF, ball: w, curve: mode === 'descent' || cur.won,
        dots: mode === 'meter' ? cur.tries : null, trail: mode === 'descent' ? cur.trail : null,
        slope: mode === 'descent' && !cur.over ? valleySlope(w) : undefined,
      }));
      key = mode === 'meter'
        ? '<span class="k"><i class="dot blue"></i>your tries</span><span class="k"><i class="dot gold"></i>the weight now</span>'
        : '<span class="k"><i class="ln grey"></i>the whole valley</span><span class="k"><i class="dot gold"></i>the ball</span><span class="k"><i class="ln white"></i>slope under the ball</span>';
      $('#picTabs').innerHTML = '';
    } else if (lv.picture.kind === 'graph') {
      const step = lv.acts[0] === 'step', w = net.W[0][0][0];
      NL.drawGraph(cv, v => net.forward([v])[0], Object.assign({}, lv.picture, {
        names: [nm(0, 0), nm(1, 0)],
        points: cur.tests.map(([x, t]) => [x[0], t]),
        marks: step && w ? [-net.B[0][0] / w] : [],
      }));
      key = `<span class="k"><i class="ln"></i>network's answer</span><span class="k"><i class="dot"></i>right answers</span>` +
        (step ? '<span class="k"><i class="dash"></i>where Σ = 0</span>' : '');
      $('#picTabs').innerHTML = '';
    } else {
      // cur.view is 'out' for the network's answer, or [layer, neuron] for one hidden neuron.
      const pic = lv.picture, hid = cur.view !== 'out', [vl, vj] = hid ? cur.view : [L - 1, 0];
      const f = (a, b) => (net.forward([a, b]), net.a[vl][vj]);
      let lo = pic.lo, hi = pic.hi;
      if (hid) {
        const act = net.acts[vl - 1];
        lo = act === 'tanh' ? -1 : 0;
        hi = 1;
        if (act === 'relu') for (const [x] of cur.tests) { net.forward(x); hi = Math.max(hi, net.a[vl][vj]); }
      }
      // Dashed lines: where a first-layer neuron's sum is 0. Those are straight lines in the picture.
      let lines = null;
      if (lv.lines && (!hid || vl === 1)) {
        const js = L === 2 ? [0] : hid ? [vj] : net.W[0].map((_, j) => j);
        lines = js.map(j => [net.W[0][j][0], net.W[0][j][1], net.B[0][j]]);
      }
      NL.drawHeat(cv, f, {
        range: pic.range, lo, hi, ticks: pic.ticks, names: lv.names[0],
        points: cur.tests.map(([x, t]) => ({ x, t })), hollow: hid, lines,
      });
      const who = hid ? nm(vl, vj) : 'the network', act1 = net.acts[0];
      const at = { sigmoid: 'a sigmoid answers 0.5 there', tanh: 'a tanh answers 0 there', relu: 'a relu switches on there', step: 'a step flips there' }[act1];
      key = `<div class="grad"><span>${fmt(lo)}</span><i></i><span>${fmt(hi)}</span></div>` +
        `<p>Background: ${who}'s answer for every ${lv.names[0].join(' and ')}. ` +
        (hid ? 'Rings: the examples.' : 'Dots: the right answers.') +
        (lines ? (lines.length > 1 || L > 2 ? ` Dashed: where each first hidden neuron’s Σ = 0${at ? ` (${at})` : ''}.` : ` Dashed: where Σ = 0${at ? ` (${at})` : ''}.`) : '') + '</p>';
      if (L > 2) {
        const opts = [['out', nm(L - 1, 0)]];
        for (let l = 1; l < L - 1; l++) cur.names[l].forEach((n, j) => opts.push([l + ',' + j, n]));
        const on = hid ? cur.view.join(',') : 'out';
        $('#picTabs').innerHTML = 'Show: ' + opts.map(([v, n]) =>
          `<button data-v="${v}" class="${on === v ? 'on' : ''}">${n}</button>`).join('');
      } else $('#picTabs').innerHTML = '';
    }
    $('#picKey').innerHTML = key;
  }

  // The error for any weight, and its slope, for the one-weight levels.
  function valleyF(w) {
    let s = 0;
    for (const [[x], t] of cur.tests) s += (w * x - t) * (w * x - t);
    return s / cur.tests.length;
  }
  function valleySlope(w) {
    let s = 0;
    for (const [[x], t] of cur.tests) s += 2 * (w * x - t) * x;
    return s / cur.tests.length;
  }

  function renderEditor() {
    const { lv, net } = cur, p = cur.P[cur.sel], v = getP(net, p), bias = p.i < 0;
    const [mn, mx] = bias ? lv.bRange : lv.wRange;
    $('#eLabel').innerHTML = `<b class="${cls(v)}">${bias ? 'Bias' : 'Weight'}</b> ` +
      (bias ? `of ${nm(p.l + 1, p.j)}` : `on the wire ${nm(p.l, p.i)} → ${nm(p.l + 1, p.j)}`);
    const s = $('#slider');
    s.min = mn;
    s.max = mx;
    s.step = bias ? lv.bStep : lv.wStep;
    if (document.activeElement !== s) s.value = v;
    if (document.activeElement !== $('#num')) $('#num').value = +v.toFixed(4);
  }

  function renderCalc() {
    const { lv, net } = cur, [l, j] = cur.pick;
    let h;
    if (l === 0) {
      h = `<p><b>${nm(0, j)}</b> is an input. It doesn't calculate anything: it sends its value, <b>${fmt(net.a[0][j])}</b>, along its wires.</p>`;
    } else {
      const W = net.W[l - 1][j], src = net.a[l - 1], b = net.B[l - 1][j], z = net.z[l][j], a = net.a[l][j], act = net.acts[l - 1];
      const terms = W.map((w, i) => `<span class="${cls(w)}">${fmt(w)}</span> × ${paren(src[i])}`);
      if (lv.editBias) terms.push(`<span class="${cls(b)}">${paren(b)}</span>`);
      h = `<p class="who">Inside <b>${nm(l, j)}</b> for the selected example:</p>` +
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

  function renderMeter() {
    const e = valleyF(cur.net.W[0][0][0]);
    $('#meterVal').textContent = fmt(e);
    $('#meterVal').className = 'meterval' + (e < cur.lv.target ? ' zero' : '');
    const notes = {
      warmer: '🔥 Warmer! Less error than your last try.',
      colder: '🧊 Colder. More error than your last try.',
      same: 'The same as your last try.',
    };
    $('#meterNote').textContent = cur.note ? notes[cur.note] : 'Move the weight and let go to take a try.';
    $('#meterNote').className = 'meternote ' + (cur.note || '');
  }

  // ---------- level 12: tries on the error meter ----------
  function meterCommit() {
    const w = cur.net.W[0][0][0], e = valleyF(w), prev = cur.tries[cur.tries.length - 1];
    if (prev === undefined) cur.note = '';
    else {
      const pe = valleyF(prev);
      cur.note = e < pe - 1e-9 ? 'warmer' : e > pe + 1e-9 ? 'colder' : 'same';
    }
    if (prev !== w) cur.tries.push(w);
    if (e < cur.lv.target && !cur.won) {
      cur.won = true;
      update();
      complete();
    } else update();
  }

  // ---------- level 13: rolling down the valley ----------
  function descentStep() {
    if (cur.over) return;
    const lv = cur.lv, w = cur.net.W[0][0][0], s = valleySlope(w), nw = w - cur.rate * s;
    cur.net.W[0][0][0] = nw;
    cur.steps++;
    cur.trail.push(nw);
    const e = valleyF(nw);
    cur.last = { w, s, nw, e0: valleyF(w), e1: e, rate: cur.rate, step: cur.steps };
    if (e < lv.target) cur.over = 'win';
    else if (!isFinite(e) || e > lv.blowup) cur.over = 'boom';
    else if (cur.steps >= lv.maxSteps) cur.over = 'out';
    update();
    if (cur.over === 'win') complete();
  }

  function descentReset() {
    loadStart();
    cur.trail = [cur.net.W[0][0][0]];
    cur.steps = 0;
    cur.last = null;
    cur.over = null;
    update();
  }

  function renderDescent() {
    const lv = cur.lv, e = valleyF(cur.net.W[0][0][0]);
    $('#meterVal').textContent = isFinite(e) && e < 1e6 ? fmt(e) : '💥';
    $('#meterVal').className = 'meterval' + (e < lv.target ? ' zero' : '');
    $('#meterNote').textContent = `Goal: below ${fmt(lv.target)}`;
    $('#meterNote').className = 'meternote';
    $('#dCount').textContent = `Steps used: ${cur.steps} of ${lv.maxSteps}`;
    $('#dStep').disabled = !!cur.over;
    $('#dRates').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === cur.rate));
    const d = cur.last;
    let h;
    if (!d) {
      h = `<p class="dim">The ball starts at weight ${fmt(cur.net.W[0][0][0])}. Choose a learning rate and press <b>Roll one step</b>.</p>`;
    } else {
      h = `<h3>Step ${d.step}</h3>` +
        `<p>Slope under the ball: <b>${fmt(d.s)}</b> ${d.s < 0 ? '(negative, so downhill is to the right →)' : d.s > 0 ? '(positive, so downhill is to the left ←)' : '(flat: this is the bottom)'}</p>` +
        `<p class="eq">new weight = ${fmtn(d.w, 3)} − ${fmtn(d.rate, 3)} × ${paren(d.s)} = <b>${fmtn(d.nw, 3)}</b></p>` +
        `<p>Error: ${fmt(d.e0)} → <b>${isFinite(d.e1) && d.e1 < 1e6 ? fmt(d.e1) : '💥'}</b></p>`;
      const over = {
        win: '<p class="good">🎯 You reached the bottom!</p>',
        boom: '<p class="bad">💥 The ball flew right out of the valley! Each step overshot the bottom by more than the last. Start over with a smaller learning rate.</p>',
        out: '<p class="bad">Out of steps! Start over and try a different learning rate.</p>',
      };
      if (cur.over) h += over[cur.over];
      else if (Math.abs(d.nw - cur.secret) > Math.abs(d.w - cur.secret)) h += '<p class="bad">The ball went past the bottom and ended up higher than before!</p>';
      else if ((d.nw - cur.secret) * (d.w - cur.secret) < 0) h += '<p>The ball jumped right over the bottom to the other side.</p>';
    }
    $('#explain').innerHTML = h;
  }

  // ---------- levels 14-16: training ----------
  // Has training reached the goal? (Checked after every step, so it doesn't redraw anything.)
  function passes() {
    const lv = cur.lv, tol = lv.tol || TOL, net = cur.net;
    if (cur.won || (lv.needAct && cur.act !== lv.needAct)) return false;
    const ok = ([x, t]) => Math.abs(net.forward(x)[0] - t) < tol;
    return cur.tests.every(ok) && (!lv.exam || lv.exam.every(ok));
  }

  // Before training on, a rewound timeline drops the later steps.
  function cutHistory() {
    if (cur.t < cur.hist.length - 1) {
      cur.hist.length = cur.t + 1;
      cur.errs.length = cur.t + 1;
      cur.last = null;
      cur.msg = '';
    }
    setAll(cur.hist[cur.t]);
  }

  function trainStep(explain) {
    const { net, lv } = cur, k = cur.order[(cur.hist.length - 1) % cur.tests.length], [x, t] = cur.tests[k];
    const before = snapshot(), res = net.learn(x, t, cur.rate), after = snapshot();
    cur.hist.push(after);
    cur.errs.push(net.loss(cur.samples));
    cur.t = cur.hist.length - 1;
    cur.row = k;
    cur.last = explain ? { step: cur.t, x, t, res, before, after, rate: cur.rate } : null;
    if (!after.every(v => isFinite(v) && Math.abs(v) < 1e6)) {
      cur.msg = '💥 The numbers exploded! The learning rate is too big: every nudge overshoots, and the next one has to be even bigger. Drag the timeline back, or pick a smaller learning rate and press New random start.';
      return 'stop';
    }
    if (lv.needAct && cur.act !== lv.needAct && cur.t === 60) {
      cur.msg = '60 steps and the numbers haven’t moved at all. Press Step and look at the slope.';
    }
    if (cur.hist.length > MAX_STEPS) {
      cur.msg = `That's ${MAX_STEPS.toLocaleString()} steps! Something isn't working. Try a new random start or different settings.`;
      return 'stop';
    }
    return null;
  }

  function startTraining() {
    if (cur.running) return;
    cutHistory();
    if (!cur.hist[cur.t].every(v => isFinite(v) && Math.abs(v) < 1e6)) return;
    cur.running = true;
    schedule(0);
    update();
  }

  function stopTraining() {
    if (cur) cur.running = false;
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = timer = null;
  }

  function schedule(delay) {
    const sp = SPEEDS.find(s => s[0] === cur.speed)[2];
    if (sp.every) timer = setTimeout(tick, delay === undefined ? sp.every : delay);
    else raf = requestAnimationFrame(tick);
  }

  function tick() {
    timer = raf = null;
    if (!cur || !cur.running) return;
    const sp = SPEEDS.find(s => s[0] === cur.speed)[2], n = sp.per || 1;
    let stop = null;
    for (let k = 0; k < n && !stop; k++) {
      stop = trainStep(!!sp.every);
      if (!stop && passes()) stop = 'win';
    }
    if (stop) stopTraining();
    update();
    if (stop === 'win') complete();
    else if (cur.running) schedule();
  }

  function stepOnce() {
    stopTraining();
    cutHistory();
    if (!cur.hist[cur.t].every(v => isFinite(v) && Math.abs(v) < 1e6)) return;
    trainStep(true);
    const win = passes();
    update();
    if (win) complete();
  }

  function restart(random) {
    stopTraining();
    makeNet(random);
    update();
  }

  function renderTrainer() {
    $('#play').textContent = cur.running ? '⏸ Pause' : '▶ Train';
    const tl = $('#tl');
    tl.max = cur.hist.length - 1;
    if (document.activeElement !== tl || cur.running) tl.value = cur.t;
    $('#tlLabel').textContent = cur.t < cur.hist.length - 1 ? `⏪ step ${cur.t} of ${cur.hist.length - 1}` : `Step ${cur.t}`;
    $('#trainMsg').textContent = cur.msg || (cur.t < cur.hist.length - 1 ? 'You are looking back in time. Press ▶ Train or Step to carry on from here; the later steps will be replaced.' : '');
    $('#trainMsg').className = 'tmsg' + (cur.msg ? ' bad' : '');
  }

  function renderCharts() {
    NL.drawHistory($('#hist'), {
      n: cur.hist.length, count: cur.P.length, get: (i, k) => cur.hist[i][k], colors: PALETTE, sel: cur.sel, cursor: cur.t,
    });
    NL.drawLogChart($('#errc'), cur.errs, cur.t);
    const now = cur.hist[cur.t];
    $('#histKey').innerHTML = cur.P.map((p, k) =>
      `<button data-k="${k}" class="${cur.sel === k ? 'on' : ''}"><i style="background:${color(k)}"></i>${pname(p)} <b>${fmtn(now[k], 3)}</b></button>`).join('');
    const e = cur.errs[cur.t];
    $('#errNow').textContent = !isFinite(e) || e > 1e9 ? 'now 💥' : e < 1e-6 ? 'now below 0.000001' : `now ${fmtn(e, e < 0.01 ? 6 : 3)}`;
  }

  // Shows one training step worked out: the miss, then every nudge.
  function renderExplain() {
    const e = cur.last, el = $('#explain');
    if (!e || cur.t !== e.step) {
      el.innerHTML = cur.t < cur.hist.length - 1
        ? `<p class="dim">Looking back at step ${cur.t}.</p>`
        : cur.running ? '<p class="dim">Training… Pause, or choose the Slow speed, to see each nudge worked out.</p>'
          : '<p class="dim">Press <b>Step</b> to show the network one example and see exactly how it nudges every number.</p>';
      return;
    }
    const L = cur.net.sizes.length, out = e.res.out[0], miss = e.t - out, lr = e.rate;
    const acts = cur.net.acts;
    let h = `<h3>Step ${e.step}</h3>` +
      `<p>Example: ${cur.names[0].map((n, i) => `${n} = ${fmt(e.x[i])}`).join(', ')} · right answer <b>${fmt(e.t)}</b></p>` +
      `<p>The network guessed <b>${fmtn(out, 3)}</b>. miss = ${fmt(e.t)} − ${paren(out, 3)} = <b class="${cls(miss)}">${signed(miss, 3)}</b> ` +
      (Math.abs(miss) < 5e-4 ? '(spot on: nothing to change)' : miss > 0 ? '(too low: push the answer up)' : '(too high: push the answer down)') + '</p>';
    const outAct = acts[L - 2];
    if (outAct === 'step') h += '<p class="bad">A step is flat, so its slope is 0, and every nudge below is 0. Nothing can change!</p>';
    h += '<table class="nudges"><thead><tr><th>number</th><th>nudge</th><th>new</th></tr></thead><tbody>';
    for (const r of e.res.neurons) {
      const who = nm(r.l + 1, r.j), lin = acts[r.l] === 'linear', hidden = r.l < L - 2;
      const slope = lin ? '' : ` × ${fmtn(r.slope, 3)}`;
      if (hidden) {
        // The blame comes back along every wire this neuron feeds, from the layer after it.
        const nexts = e.res.neurons.filter(o => o.l === r.l + 1);
        const parts = nexts.map(o => `${paren(o.blame, 3)} × ${fmtn(o.slope, 3)} × ${paren(e.before[cur.index[`${r.l + 1},${o.j},${r.j}`]], 3)}`);
        if (nexts.length === 1) {
          const to = nm(r.l + 2, nexts[0].j), what = r.l + 2 === L - 1 ? 'miss' : `${to}'s blame`;
          h += `<tr class="sub"><td colspan="3">${who}'s share of the blame = ${what} × slope of ${to} × weight ${who}→${to} = ${parts[0]} = <b>${signed(r.blame, 4)}</b></td></tr>`;
        } else {
          h += `<tr class="sub"><td colspan="3">${who}'s share of the blame = add up, for each neuron it feeds, that neuron's blame × its slope × the weight between them = ` +
            `${parts.join(' + ')} = <b>${signed(r.blame, 4)}</b></td></tr>`;
        }
      } else {
        h += `<tr class="sub"><td colspan="3">${who}: nudge = learning rate × ${hidden ? 'blame' : 'miss'}${lin ? '' : ' × slope'} × input` +
          (lin ? '' : ` <span class="dim">(slope of the ${acts[r.l]} here = ${fmtn(r.slope, 3)})</span>`) + '</td></tr>';
      }
      if (hidden) {
        h += `<tr class="sub"><td colspan="3">${who}: nudge = learning rate × blame × slope × input <span class="dim">(slope here = ${fmtn(r.slope, 3)})</span></td></tr>`;
      }
      const row = (k, input) => {
        const nudge = e.after[k] - e.before[k];
        return `<tr><td><i class="swd" style="background:${color(k)}"></i>${pname(cur.P[k])}</td>` +
          `<td>${fmtn(lr, 3)} × ${paren(r.blame, 3)}${slope} × ${paren(input, 3)} = <b class="${cls(nudge)}">${signed(nudge, 4)}</b></td>` +
          `<td>${fmtn(e.after[k], 4)}</td></tr>`;
      };
      r.inputs.forEach((v, i) => { h += row(cur.index[`${r.l},${r.j},${i}`], v); });
      if (cur.lv.editBias) h += row(cur.index[`${r.l},${r.j},-1`], 1);
    }
    el.innerHTML = h + '</tbody></table>';
  }

  // ---------- editing numbers (build and meter) ----------
  function setVal(v, commit) {
    if (!isFinite(v)) return;
    setP(cur.net, cur.P[cur.sel], v);
    if (!commit) update();
    else if (cur.mode === 'meter') meterCommit();
    else update(true);
  }
  function nudge(d) {
    const p = cur.P[cur.sel], st = p.i < 0 ? cur.lv.bStep : cur.lv.wStep;
    setVal(+(getP(cur.net, p) + d * st).toFixed(4), true);
  }

  // ---------- finishing ----------
  function complete() {
    stopTraining();
    cur.won = true;
    save.done[cur.lv.id] = true;
    if (cur.lab) {
      const t = labTask(), old = save.lab.best[t.id], had = !!save.lab.stars[t.id];
      save.lab.stars[t.id] = true;
      const arch = { hidden: save.lab.arch.hidden.slice(), act: save.lab.arch.act };
      if (!old || cur.t < old.steps) save.lab.best[t.id] = { steps: cur.t, arch };
      cur.recordNote = `<p class="record">${!had ? '★ First star for this task!' : old && cur.t < old.steps ? '🏆 New record!' : 'Star earned again.'} ` +
        `This time: <b>${cur.t.toLocaleString()} steps</b> with ${archText(arch)}.` +
        (old && cur.t >= old.steps ? ` Your record is ${old.steps.toLocaleString()} steps.` : old ? ` Your old record was ${old.steps.toLocaleString()} steps.` : '') + '</p>';
    }
    store();
    const next = cur.lab ? null : LEVELS.find(l => l.id === cur.lv.id + 1);
    const learned = cur.lv.learned;
    $('#winBig').textContent = cur.lab ? '★ Star earned!' : '✓ Level complete!';
    if (cur.lab) {
      $('#goal').innerHTML = '<h4>Goal</h4>' + labLevel(cur.lv).goal;
      renderLab();
    }
    $('#winText').innerHTML = typeof learned === 'function' ? learned(cur) : learned;
    $('#winNext').textContent = cur.lab ? 'Try another task' : next ? 'Next level →' : 'Back to the map';
    const later = CHAPTERS.find(ch => !LEVELS.some(l => l.chapter === ch.id));
    $('#winNote').innerHTML = next || !later || cur.lab ? '' : `<p class="dim">That is everything for now. Chapter ${later.id}, ${later.title}, is coming soon!</p>`;
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
      if (c) {
        const k = +c.dataset.p;
        cur.sel = cur.mode === 'train' && cur.sel === k ? -1 : k;
        update();
        return;
      }
      const n = e.target.closest('[data-n]');
      if (n) {
        cur.pick = n.dataset.n.split(',').map(Number);
        const L = cur.net.sizes.length;
        if (L > 2 && cur.pick[0] > 0 && cur.pick[0] < L - 1) cur.view = cur.pick.slice();
        else if (L > 2 && cur.pick[0] === L - 1) cur.view = 'out';
        update();
      }
    });
    $('#picTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      cur.view = b.dataset.v === 'out' ? 'out' : b.dataset.v.split(',').map(Number);
      cur.pick = cur.view === 'out' ? [cur.net.sizes.length - 1, 0] : cur.view.slice();
      update();
    });

    // the Lab: changing the task opens it afresh; changing the design starts a new random network
    $('#labTasks').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b || b.dataset.v === save.lab.task) return;
      stopTraining();
      save.lab.task = b.dataset.v;
      store();
      openLevel(LEVELS.find(l => l.mode === 'lab'));
    });
    $('#labDesign').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = save.lab.arch, v = b.dataset.v;
      if (b.dataset.a === 'layers') {
        const n = +v;
        a.hidden = Array.from({ length: n }, (_, q) => a.hidden[q] || 3);
      } else if (b.dataset.a === 'size') {
        const q = +b.dataset.q;
        a.hidden[q] = Math.max(1, Math.min(6, a.hidden[q] + +v));
      } else if (b.dataset.a === 'act') a.act = v;
      store();
      renderLab();
      restart(true);
    });
    $('#tests').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-r]');
      if (!tr || tr.dataset.r === '') return;
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

    // While dragging or typing, only redraw; a win is checked when Eli lets go or presses Enter.
    $('#slider').addEventListener('input', e => setVal(+e.target.value, false));
    $('#slider').addEventListener('change', e => setVal(+e.target.value, true));
    $('#num').addEventListener('input', e => setVal(parseFloat(e.target.value), false));
    $('#num').addEventListener('change', e => setVal(parseFloat(e.target.value), true));
    $('#num').addEventListener('blur', renderEditor);
    $('#minus').addEventListener('click', () => nudge(-1));
    $('#plus').addEventListener('click', () => nudge(1));
    $('#reset').addEventListener('click', () => { loadStart(); update(true); });
    $('#hintBtn').addEventListener('click', () => {
      const key = cur.lv.hintKey || cur.lv.id;
      save.hints[key] = (save.hints[key] || 0) + 1;
      store();
      renderHints();
    });

    // level 13
    $('#dRates').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (b) { cur.rate = +b.dataset.v; update(); }
    });
    $('#dStep').addEventListener('click', descentStep);
    $('#dReset').addEventListener('click', descentReset);

    // levels 14-16
    $('#play').addEventListener('click', () => { if (cur.running) { stopTraining(); update(); } else startTraining(); });
    $('#stepBtn').addEventListener('click', stepOnce);
    $('#speeds').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      cur.speed = b.dataset.v;
      seg($('#speeds'), SPEEDS.map(([v, label]) => [v, label]), cur.speed);
      if (cur.running) { stopTraining(); startTraining(); }
    });
    $('#rates').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      cur.rate = +b.dataset.v;
      seg($('#rates'), cur.lv.rates.map(r => [r, fmtn(r, 3)]), cur.rate);
    });
    $('#choices').addEventListener('click', e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      if (cur.lv.actChoice) cur.act = b.dataset.v;
      else cur.hidden = +b.dataset.v;
      buildControls();
      restart(!cur.lv.actChoice);
    });
    $('#reroll').addEventListener('click', () => restart(true));
    $('#tl').addEventListener('input', e => {
      stopTraining();
      cur.t = +e.target.value;
      setAll(cur.hist[cur.t]);
      update();
    });
    $('#histKey').addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const k = +b.dataset.k;
      cur.sel = cur.sel === k ? -1 : k;
      update();
    });

    $('#winNext').addEventListener('click', () => {
      $('#win').hidden = true;
      if (cur.lab) { window.scrollTo(0, 0); return; }
      const next = LEVELS.find(l => l.id === cur.lv.id + 1);
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
      save = { done: {}, params: {}, hints: {}, lab: freshLab() };
      store();
      showMap();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModals(); return; }
      if (!cur || !$('#win').hidden || !$('#quiz').hidden || e.target.matches('input')) return;
      if (cur.mode === 'build' || cur.mode === 'meter') {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); nudge(d); }
      } else if (cur.mode === 'train' && e.key === ' ' && !e.target.matches('button')) {
        e.preventDefault();
        $('#play').click();
      }
    });
  }

  wire();
  route();
})(window.NL);
