// The Sandbox: Eli designs any network and trains it on any task he likes.
//
// An experiment is either
//   custom - 1-3 inputs and 1-3 outputs, with examples made from a typed rule, dots clicked
//            on the picture, or a typed table; trained on the usual training screen
//   digits - a network of his own design for the handwritten digits of Chapter 5
// Experiments are saved in the browser and can be shared as a link that carries the whole
// experiment (the task and the design, not trained weights). Anything read from a link is
// checked field by field, and rules are read by a small formula reader here, never run as code.
window.NL = window.NL || {};
NL.Sandbox = (function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const fmt = NL.fmt;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const IN_NAMES = ['a', 'b', 'c'];
  const outNames = n => (n === 1 ? ['y'] : ['y1', 'y2', 'y3'].slice(0, n));
  const ACTS = ['linear', 'sigmoid', 'tanh', 'relu', 'step'];
  const RATES = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3];
  const DRATES = [0.01, 0.03, 0.1, 0.3, 1];
  const TOLS = [0.05, 0.1, 0.2, 0.3, 0.5];
  const EXAMS = [0, 10, 20, 30, 50];
  const DSIZES = [4, 8, 16, 32, 64];
  const MAX_EXAMPLES = 400, MAX_EXPS = 60;

  // ======================================================================
  // The formula reader: + − × ÷, ^, comparisons (give 1 or 0), and/or/not,
  // and a few functions. Builds a function of the inputs; never uses eval.
  // ======================================================================
  const FUNCS = {
    max: [1, 9, (...a) => Math.max(...a)], min: [1, 9, (...a) => Math.min(...a)], abs: [1, 1, Math.abs],
    sqrt: [1, 1, Math.sqrt], sin: [1, 1, Math.sin], cos: [1, 1, Math.cos], tan: [1, 1, Math.tan],
    exp: [1, 1, Math.exp], log: [1, 1, Math.log], round: [1, 1, Math.round], floor: [1, 1, Math.floor],
    ceil: [1, 1, Math.ceil], sign: [1, 1, Math.sign], if: [3, 3, (c, a, b) => (c ? a : b)],
  };
  const CONSTS = { pi: Math.PI, e: Math.E };
  // Only the names listed above count (not built-in ones like "constructor").
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function compile(src, vars) {
    const toks = [];
    let i = 0;
    src = String(src);
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      let m = /^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/i.exec(src.slice(i));
      if (m) { toks.push({ t: 'num', v: parseFloat(m[1]) }); i += m[1].length; continue; }
      m = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i));
      if (m) { toks.push({ t: 'name', v: m[0].toLowerCase() }); i += m[0].length; continue; }
      m = /^(<=|>=|==|!=|&&|\|\||[-+*/%^(),<>!=×÷])/.exec(src.slice(i));
      if (m) {
        const v = { '×': '*', '÷': '/', '=': '==' }[m[1]] || m[1];
        toks.push({ t: 'op', v });
        i += m[1].length;
        continue;
      }
      throw new Error(`I don't understand the "${ch}".`);
    }
    if (!toks.length) throw new Error('Type a rule, like a + b.');
    let p = 0;
    const peek = () => toks[p], isOp = v => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    const isWord = v => toks[p] && toks[p].t === 'name' && toks[p].v === v;
    const expect = v => { if (!isOp(v)) throw new Error(`Expected "${v}".`); p++; };

    function or() {
      let l = and();
      while (isOp('||') || isWord('or')) { p++; const a = l, b = and(); l = env => (a(env) || b(env) ? 1 : 0); }
      return l;
    }
    function and() {
      let l = cmp();
      while (isOp('&&') || isWord('and')) { p++; const a = l, b = cmp(); l = env => (a(env) && b(env) ? 1 : 0); }
      return l;
    }
    function cmp() {
      let l = add();
      const OPS = { '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b, '==': (a, b) => Math.abs(a - b) < 1e-9, '!=': (a, b) => Math.abs(a - b) >= 1e-9 };
      while (peek() && peek().t === 'op' && OPS[peek().v]) {
        const f = OPS[toks[p++].v], a = l, b = add();
        l = env => (f(a(env), b(env)) ? 1 : 0);
      }
      return l;
    }
    function add() {
      let l = mul();
      while (isOp('+') || isOp('-')) {
        const op = toks[p++].v, a = l, b = mul();
        l = op === '+' ? env => a(env) + b(env) : env => a(env) - b(env);
      }
      return l;
    }
    function mul() {
      let l = unary();
      while (isOp('*') || isOp('/') || isOp('%')) {
        const op = toks[p++].v, a = l, b = unary();
        l = op === '*' ? env => a(env) * b(env) : op === '/' ? env => a(env) / b(env) : env => a(env) % b(env);
      }
      return l;
    }
    function unary() {
      if (isOp('-')) { p++; const a = unary(); return env => -a(env); }
      if (isOp('+')) { p++; return unary(); }
      if (isOp('!') || isWord('not')) { p++; const a = unary(); return env => (a(env) ? 0 : 1); }
      return pow();
    }
    function pow() {
      const base = atom();
      if (isOp('^')) { p++; const ex = unary(); return env => Math.pow(base(env), ex(env)); }
      return base;
    }
    function atom() {
      const tk = toks[p];
      if (!tk) throw new Error('The rule stops too early.');
      if (tk.t === 'num') { p++; return () => tk.v; }
      if (isOp('(')) { p++; const a = or(); expect(')'); return a; }
      if (tk.t === 'name') {
        p++;
        if (isOp('(')) {
          const fn = has(FUNCS, tk.v) ? FUNCS[tk.v] : null;
          if (!fn) throw new Error(`I don't know a function called "${tk.v}".`);
          p++;
          const args = [];
          if (!isOp(')')) { args.push(or()); while (isOp(',')) { p++; args.push(or()); } }
          expect(')');
          if (args.length < fn[0] || args.length > fn[1]) throw new Error(`${tk.v}( ) needs ${fn[0] === fn[1] ? fn[0] : 'at least ' + fn[0]} number${fn[0] > 1 ? 's' : ''}.`);
          return env => fn[2](...args.map(f => f(env)));
        }
        if (vars.includes(tk.v)) return env => env[tk.v];
        if (has(CONSTS, tk.v)) return () => CONSTS[tk.v];
        throw new Error(`"${tk.v}" isn't an input. You can use ${vars.join(', ')}.`);
      }
      throw new Error(`I didn't expect "${tk.v}" there.`);
    }
    const f = or();
    if (p < toks.length) throw new Error(`I didn't expect "${toks[p].v}" there.`);
    return f;
  }

  // ======================================================================
  // Experiments: making, checking and saving them
  // ======================================================================
  const newId = () => Math.random().toString(36).slice(2, 10) || 'x1';
  const num = (v, lo, hi, def) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  const pick = (v, list, def) => (list.indexOf(v) >= 0 ? v : def);
  const DEF_EXPRS = ['a + b', 'a * b', 'max(a, b)'];

  // Checks every field of an experiment (it may have come from a link) and fills in defaults.
  function sanitize(o) {
    o = o && typeof o === 'object' ? o : {};
    const e = {
      id: typeof o.id === 'string' && /^[a-z0-9]{1,16}$/.test(o.id) ? o.id : newId(),
      name: String(o.name == null ? 'My experiment' : o.name).replace(/[\u0000-\u001f]/g, '').slice(0, 40) || 'My experiment',
      kind: o.kind === 'digits' ? 'digits' : 'custom',
    };
    const net = o.net && typeof o.net === 'object' ? o.net : {};
    if (e.kind === 'digits') {
      const hid = Array.isArray(net.hidden) ? net.hidden.slice(0, 3) : [32];
      e.net = { hidden: hid.map(n => pick(+n, DSIZES, 16)), acts: hid.map((_, q) => pick((net.acts || [])[q], ACTS, 'relu')) };
      e.rate = pick(+o.rate, DRATES, 0.1);
      return e;
    }
    e.nIn = Math.round(num(o.nIn, 1, 3, 2));
    e.nOut = Math.round(num(o.nOut, 1, 3, 1));
    e.method = pick(o.method, ['rule', 'dots', 'table'], 'rule');
    if (e.method === 'dots' && (e.nIn > 2 || e.nOut > 1)) e.method = 'table';
    const r = o.rule && typeof o.rule === 'object' ? o.rule : {};
    e.rule = {
      exprs: Array.from({ length: e.nOut }, (_, k) => String((r.exprs || [])[k] == null ? DEF_EXPRS[k] : r.exprs[k]).slice(0, 120)),
      ranges: Array.from({ length: e.nIn }, (_, i) => {
        const g = (r.ranges || [])[i] || [0, 3];
        const lo = num(g[0], -1000, 1000, 0);
        let hi = num(g[1], -1000, 1000, 3);
        if (hi <= lo) hi = lo + 1;
        return [lo, hi];
      }),
      points: Array.from({ length: e.nIn }, (_, i) => Math.round(num((r.points || [])[i], 2, 21, 4))),
    };
    const dr = Array.isArray(o.dotRange) ? o.dotRange : [];
    e.dotRange = [0, 1].map(i => {
      const g = dr[i] || [-1, 1];
      const lo = num(g[0], -1000, 1000, -1);
      let hi = num(g[1], -1000, 1000, 1);
      if (hi <= lo) hi = lo + 1;
      return [lo, hi];
    });
    e.dotValue = num(o.dotValue, -1000, 1000, 1);
    e.examples = (Array.isArray(o.examples) ? o.examples : []).slice(0, 300).map(ex => {
      if (!Array.isArray(ex) || !Array.isArray(ex[0]) || !Array.isArray(ex[1])) return null;
      const x = Array.from({ length: e.nIn }, (_, i) => +ex[0][i]), t = Array.from({ length: e.nOut }, (_, k) => +ex[1][k]);
      return x.concat(t).every(v => isFinite(v) && Math.abs(v) <= 10000) ? [x, t] : null;
    }).filter(Boolean);
    const hid = Array.isArray(net.hidden) ? net.hidden.slice(0, 3) : [4];
    e.net = {
      hidden: hid.map(n => Math.round(num(n, 1, 8, 4))),
      acts: hid.map((_, q) => pick((net.acts || [])[q], ACTS, 'tanh')),
      outAct: pick(net.outAct, ACTS, 'linear'),
    };
    e.rate = pick(+o.rate, RATES, 0.03);
    e.tol = pick(+o.tol, TOLS, 0.2);
    e.examPct = pick(+o.examPct, EXAMS, 0);
    return e;
  }

  // The examples an experiment trains on: [[inputs], [right answers]], or an error message.
  function examples(e) {
    if (e.method !== 'rule') return { list: e.examples.map(([x, t]) => [x.slice(), t.slice()]) };
    const vars = IN_NAMES.slice(0, e.nIn), fs = [];
    for (let k = 0; k < e.nOut; k++) {
      try { fs.push(compile(e.rule.exprs[k], vars)); } catch (err) { return { list: [], error: `${outNames(e.nOut)[k]}: ${err.message}` }; }
    }
    const axes = e.rule.ranges.map(([lo, hi], i) => {
      const n = e.rule.points[i];
      return Array.from({ length: n }, (_, q) => Math.round((lo + ((hi - lo) * q) / (n - 1)) * 1000) / 1000);
    });
    const total = axes.reduce((s, a) => s * a.length, 1);
    if (total > MAX_EXAMPLES) return { list: [], error: `That makes ${total} examples. The most is ${MAX_EXAMPLES}: use fewer points.` };
    let grid = [[]];
    for (const ax of axes) grid = [].concat(...grid.map(g => ax.map(v => g.concat([v]))));
    const list = [];
    let skipped = 0;
    for (const x of grid) {
      const env = {};
      vars.forEach((v, i) => { env[v] = x[i]; });
      const t = fs.map(f => f(env));
      if (t.every(v => isFinite(v) && Math.abs(v) <= 10000)) list.push([x, t.map(v => Math.round(v * 10000) / 10000)]);
      else skipped++;
    }
    return { list, skipped };
  }

  // Splits the examples into the ones it learns from and the exam, the same way every time.
  function split(e, list) {
    if (!e.examPct || list.length < 2) return { train: list, exam: null };
    let h = 0;
    for (const ch of e.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = NL.rng(h), idx = list.map((_, k) => k);
    for (let k = idx.length - 1; k > 0; k--) { const q = Math.floor(rnd() * (k + 1)); [idx[k], idx[q]] = [idx[q], idx[k]]; }
    const n = Math.max(1, Math.min(list.length - 1, Math.round((list.length * e.examPct) / 100)));
    const ex = new Set(idx.slice(0, n));
    return { train: list.filter((_, k) => !ex.has(k)), exam: list.filter((_, k) => ex.has(k)) };
  }

  const r2 = v => Math.round(v * 100) / 100;
  const pad = (lo, hi, f) => { const d = (hi - lo) * f || 1; return [r2(lo - d), r2(hi + d)]; };

  // Builds the training level the game plays for an experiment.
  function levelFor(e) {
    const base = { id: 'sandbox', sandbox: true, sbId: e.id, title: e.name, idea: 'Sandbox', hints: [], story: '', ideaBox: '', goal: '' };
    if (e.kind === 'digits') {
      return Object.assign(base, { mode: 'digits', arch: { hidden: e.net.hidden.slice(), acts: e.net.acts.slice() }, rate: e.rate, rates: DRATES, target: null });
    }
    const made = examples(e), sp = split(e, made.list), ins = IN_NAMES.slice(0, e.nIn), outs = outNames(e.nOut);
    const sizes = [e.nIn].concat(e.net.hidden, [e.nOut]);
    const names = [ins].concat(e.net.hidden.map((n, q) => Array.from({ length: n }, (_, j) => ['h', 'k', 'm'][q] + (j + 1))), [outs]);
    const all = made.list, xs = i => all.map(([x]) => x[i]), ts = [].concat(...all.map(([, t]) => t));
    let lo = ts.length ? Math.min(...ts) : 0, hi = ts.length ? Math.max(...ts) : 1;
    if (e.method === 'dots' && e.nIn === 2) { lo = Math.min(lo, 0, e.dotValue); hi = Math.max(hi, 1, e.dotValue); }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const rangeOf = i => {
      if (e.method === 'dots') return e.dotRange[i];
      if (e.method === 'rule') return e.rule.ranges[i];
      return all.length ? pad(Math.min(...xs(i)), Math.max(...xs(i)), 0.08) : [0, 1];
    };
    let picture;
    if (e.nIn === 1) {
      const range = rangeOf(0), yRange = e.method === 'dots' ? e.dotRange[1] : pad(lo, hi, 0.12);
      picture = { kind: 'graph', range, yRange, xticks: NL.niceTicks(range[0], range[1]), yticks: NL.niceTicks(yRange[0], yRange[1]) };
    } else if (e.nIn === 2) {
      let range = rangeOf(0), rangeY = rangeOf(1);
      if (e.method === 'rule') {
        // Leave room around the outside dots.
        const half = i => (e.rule.ranges[i][1] - e.rule.ranges[i][0]) / (e.rule.points[i] - 1) / 2;
        range = [range[0] - half(0), range[1] + half(0)];
        rangeY = [rangeY[0] - half(1), rangeY[1] + half(1)];
      }
      picture = { kind: 'heat', range, rangeY, lo, hi, ticks: NL.niceTicks(range[0], range[1]), ticksY: NL.niceTicks(rangeY[0], rangeY[1]) };
    } else picture = { kind: 'none' };
    return Object.assign(base, {
      mode: 'train', names, sizes, acts: e.net.acts.concat([e.net.outAct]), sbSizes: sizes, sbNames: names,
      tests: sp.train, exam: sp.exam, tol: e.tol, rates: RATES, rate: e.rate, picture, editBias: true,
      lines: e.nIn === 2 && (e.net.hidden.length > 0 || ['sigmoid', 'step', 'tanh'].includes(e.net.outAct)),
      dotsEdit: e.method === 'dots', made,
    });
  }

  // ---------- starters ----------
  // Two spiral arms, one turn each: one arm is 1, the other 0.
  function spirals() {
    const out = [];
    for (let i = 0; i < 16; i++) {
      const r = 0.15 + (i / 15) * 0.82, a = (i / 15) * 2 * Math.PI;
      out.push([[+(r * Math.cos(a)).toFixed(2), +(r * Math.sin(a)).toFixed(2)], [1]]);
      out.push([[+(-r * Math.cos(a)).toFixed(2), +(-r * Math.sin(a)).toFixed(2)], [0]]);
    }
    return out;
  }
  const STARTERS = [
    { key: 'blank', label: 'Make up a task', about: 'Start from a + b and change it to anything.', make: () => ({ name: 'My task' }) },
    { key: 'digits', label: 'Handwritten digits', about: 'Design your own network for reading digits.', make: () => ({ name: 'My digit reader', kind: 'digits', net: { hidden: [32, 16], acts: ['relu', 'relu'] }, rate: 0.1 }) },
    { key: 'wave', label: 'A wave', about: 'One input, one output: can it learn sin(a)?', make: () => ({ name: 'A wave', nIn: 1, nOut: 1, rule: { exprs: ['sin(a)'], ranges: [[-3, 3]], points: [13] }, net: { hidden: [6], acts: ['tanh'], outAct: 'linear' }, rate: 0.1, tol: 0.2 }) },
    { key: 'spirals', label: 'Two spirals', about: 'A famously tricky pattern of dots. Takes a while!', make: () => ({ name: 'Two spirals', nIn: 2, nOut: 1, method: 'dots', examples: spirals(), net: { hidden: [8, 8], acts: ['relu', 'relu'], outAct: 'sigmoid' }, rate: 0.1, tol: 0.3 }) },
    { key: 'vote', label: 'Majority vote', about: 'Three inputs: fire when at least two are 1.', make: () => ({ name: 'Majority vote', nIn: 3, nOut: 1, method: 'table', examples: [0, 1, 2, 3, 4, 5, 6, 7].map(n => { const x = [n & 1, (n >> 1) & 1, (n >> 2) & 1]; return [x, [x[0] + x[1] + x[2] >= 2 ? 1 : 0]]; }), net: { hidden: [], acts: [], outAct: 'sigmoid' }, rate: 1 }) },
    { key: 'two', label: 'Two answers at once', about: 'One network that adds and multiplies.', make: () => ({ name: 'Add and multiply', nIn: 2, nOut: 2, rule: { exprs: ['a + b', 'a * b'], ranges: [[0, 3], [0, 3]], points: [4, 4] }, net: { hidden: [8, 8], acts: ['tanh', 'tanh'], outAct: 'linear' }, rate: 0.01, tol: 0.3 }) },
  ];

  // ---------- saving ----------
  let G = null; // the game's hooks
  const exps = () => {
    const sv = G.save();
    if (!sv.sandbox || !Array.isArray(sv.sandbox.exps)) sv.sandbox = { exps: [] };
    return sv.sandbox.exps;
  };
  const find = id => exps().find(e => e.id === id);
  function add(o) {
    const list = exps();
    const e = sanitize(Object.assign({}, o, { id: newId() }));
    list.unshift(e);
    if (list.length > MAX_EXPS) list.length = MAX_EXPS;
    G.store();
    return e;
  }

  function summary(e) {
    if (e.kind === 'digits') return `Handwritten digits · 196 → ${e.net.hidden.map(n => n + ' → ').join('')}10`;
    const lv = levelFor(e), n = lv.made.list.length;
    return `${e.nIn} input${e.nIn > 1 ? 's' : ''} → ${e.net.hidden.map(n => n + ' → ').join('')}${e.nOut} output${e.nOut > 1 ? 's' : ''} · ` +
      `${{ rule: 'rule', dots: 'dots', table: 'table' }[e.method]} · ${n} example${n === 1 ? '' : 's'}`;
  }

  // ======================================================================
  // The home screen: saved experiments and ways to start
  // ======================================================================
  let pendingShare = null;

  function home() {
    G.leaveLevel();
    $('#map').hidden = true;
    $('#level').hidden = true;
    $('#sbHome').hidden = false;
    document.title = 'Sandbox · NN Builder';
    const list = exps();
    $('#sbList').innerHTML = list.length ? list.map(e => `<div class="sbcard">
        <a class="sbname" href="#/sandbox/${e.id}">${esc(e.name)}</a>
        <span class="sbsum">${esc(summary(e))}</span>
        <span class="sbbtns"><a class="ghost" href="#/sandbox/${e.id}">Open</a><button class="ghost" data-dup="${e.id}">Copy</button><button class="ghost" data-del="${e.id}">Delete</button></span>
      </div>`).join('') : '<p class="dim">No experiments yet. Start one below!</p>';
    $('#sbStart').innerHTML = STARTERS.map(s => `<button class="sbstart" data-start="${s.key}"><b>${s.label}</b><span>${s.about}</span></button>`).join('');
    if (pendingShare) {
      $('#sbImport').hidden = false;
      $('#sbImportText').innerHTML = `Someone shared an experiment with you: <b>${esc(pendingShare.name)}</b> <span class="dim">(${esc(summary(pendingShare))})</span>`;
    } else $('#sbImport').hidden = true;
    window.scrollTo(0, 0);
  }

  // Opens a link like #/share/…: checks it, then offers to add it.
  function importLink(data) {
    let o = null;
    try {
      const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
      o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
    } catch (err) { o = null; }
    pendingShare = o && typeof o === 'object' ? sanitize(o) : null;
    if (!pendingShare) {
      home();
      $('#sbImport').hidden = false;
      $('#sbImportText').innerHTML = '<span class="bad">That link is broken: it may have been cut short when it was copied.</span>';
      $('#sbImportYes').hidden = true;
      return;
    }
    $('#sbImportYes').hidden = false;
    home();
  }

  function shareLink(e) {
    const o = JSON.parse(JSON.stringify(e));
    delete o.id;
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    const data = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#/share/' + data;
  }

  // ======================================================================
  // An experiment: the editor on the left, the training screen around it
  // ======================================================================
  let cur = null; // the experiment being edited

  function open(id) {
    const e = find(id);
    if (!e) { location.hash = '#/sandbox'; return; }
    $('#sbHome').hidden = true;
    const keep = cur && cur.id === id;
    cur = e;
    G.openLevel(levelFor(e), keep);
    renderEditor();
  }

  // After a change: save, rebuild the level (training starts again) and redraw the editor.
  function changed() {
    G.store();
    G.openLevel(levelFor(cur), true);
    renderEditor();
  }

  const segH = (attr, items, on) => `<div class="seg">${items.map(([v, l]) => `<button data-${attr}="${v}" class="${String(v) === String(on) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const actSelect = (attr, q, on) => `<select data-${attr}="${q}" aria-label="activation">${ACTS.map(a => `<option${a === on ? ' selected' : ''}>${a}</option>`).join('')}</select>`;

  function renderEditor() {
    const e = cur, lv = G.level();
    let h = `<div class="sbtop">
      <input id="sbName" class="sbnamein" maxlength="40" value="${esc(e.name)}" aria-label="Experiment name">
      <div class="sbacts"><button id="sbShareBtn" class="primary">🔗 Share</button><button id="sbDupBtn" class="ghost">Copy</button><a class="ghost" href="#/sandbox">All experiments</a></div>
      <p class="tip">Saved automatically. Changing the task or the network starts training again.</p></div>`;
    if (e.kind === 'digits') {
      h += `<h4 class="sbh">Network</h4><p class="small">196 pixels in, 10 output neurons out (sigmoid), one per digit.</p>` + designer(e, true);
      h += `<p class="small">Bigger networks learn more but take longer per step. Try a few designs and compare their exam scores!</p>`;
      $('#sbEditor').innerHTML = h;
      return;
    }
    // ---- the task ----
    h += `<h4 class="sbh">Task</h4>
      <div class="trow"><span class="lbl">Inputs</span>${segH('nin', [[1, '1'], [2, '2'], [3, '3']], e.nIn)}<span class="lbl">Outputs</span>${segH('nout', [[1, '1'], [2, '2'], [3, '3']], e.nOut)}</div>
      <div class="trow"><span class="lbl">Make the examples with</span>${segH('method', [['rule', 'a rule'], ['dots', 'dots'], ['table', 'a table']], e.method)}</div>`;
    const canDots = e.nIn <= 2 && e.nOut === 1;
    if (e.method === 'rule') {
      const outs = outNames(e.nOut);
      h += outs.map((o, k) => `<label class="rule"><b>${o} =</b><input data-expr="${k}" value="${esc(e.rule.exprs[k])}" spellcheck="false" aria-label="rule for ${o}"></label>`).join('');
      h += '<p class="tip">Use ' + IN_NAMES.slice(0, e.nIn).join(', ') + ', numbers, + − * / ^, &lt; &gt; = (they give 1 or 0), and, or, not, and max min abs sqrt sin cos round if(…, …, …).</p>';
      h += e.rule.ranges.map((r, i) => `<div class="trow range"><b>${IN_NAMES[i]}</b><span class="lbl">from</span><input type="number" step="any" data-rlo="${i}" value="${r[0]}"><span class="lbl">to</span><input type="number" step="any" data-rhi="${i}" value="${r[1]}"><span class="lbl">points</span><input type="number" min="2" max="21" step="1" data-rpts="${i}" value="${e.rule.points[i]}"></div>`).join('');
    } else if (e.method === 'dots') {
      const one = e.nIn === 1;
      h += `<p class="small">${one ? 'Click the graph to add a dot: across is the input a, up is the right answer.' : 'Click the picture to add a dot with the value below.'} Click a dot to remove it.</p>`;
      if (!one) h += `<div class="trow"><span class="lbl">New dots are</span>${segH('dotv', [[0, '0'], [1, '1']], e.dotValue)}<input type="number" step="any" id="sbDotV" value="${e.dotValue}" aria-label="value for new dots"></div>`;
      h += [0, 1].map(i => `<div class="trow range"><b>${one ? (i ? 'answer' : 'a') : IN_NAMES[i]}</b><span class="lbl">from</span><input type="number" step="any" data-dlo="${i}" value="${e.dotRange[i][0]}"><span class="lbl">to</span><input type="number" step="any" data-dhi="${i}" value="${e.dotRange[i][1]}"></div>`).join('');
      h += '<button id="sbClearDots" class="ghost">Remove all dots</button>';
    } else {
      h += `<button id="sbEditTable" class="primary">Edit the table (${e.examples.length} rows)</button>`;
    }
    if (!canDots && e.method !== 'dots') h += '<p class="tip">Dots work with 1 or 2 inputs and 1 output.</p>';
    const made = lv.made;
    h += `<p class="sbcount ${made.error ? 'bad' : ''}">${made.error ? esc(made.error) : `${made.list.length} example${made.list.length === 1 ? '' : 's'}` +
      (made.skipped ? `, leaving out ${made.skipped} where the rule gives no number (like dividing by 0)` : '') +
      (lv.exam ? `: ${lv.tests.length} to learn from, ${lv.exam.length} kept for the exam` : '')}</p>`;
    h += `<div class="trow"><span class="lbl">Keep back for an exam</span>${segH('exam', EXAMS.map(p => [p, p + '%']), e.examPct)}</div>`;
    h += `<div class="trow"><span class="lbl">Counts as right within</span>${segH('tol', TOLS.map(t => [t, fmt(t)]), e.tol)}</div>`;
    // ---- the network ----
    h += `<h4 class="sbh">Network</h4>` + designer(e, false);
    $('#sbEditor').innerHTML = h;
  }

  // Hidden layers, their sizes and activations, and (for custom tasks) the output activation.
  function designer(e, digits) {
    let h = `<div class="trow"><span class="lbl">Hidden layers</span>${segH('layers', [[0, 'none'], [1, '1'], [2, '2'], [3, '3']], e.net.hidden.length)}</div>`;
    e.net.hidden.forEach((n, q) => {
      h += `<div class="trow layer"><span class="lbl">layer ${q + 1}</span>`;
      if (digits) h += `<select data-dsize="${q}" aria-label="neurons in layer ${q + 1}">${DSIZES.map(s => `<option value="${s}"${s === n ? ' selected' : ''}>${s} neurons</option>`).join('')}</select>`;
      else h += `<span class="stepper"><button data-size="${q}" data-v="-1" aria-label="Fewer neurons"${n <= 1 ? ' disabled' : ''}>−</button><b>${n}</b><button data-size="${q}" data-v="1" aria-label="More neurons"${n >= 8 ? ' disabled' : ''}>+</button></span>`;
      h += actSelect('hact', q, e.net.acts[q]) + '</div>';
    });
    if (!digits) {
      h += `<div class="trow layer"><span class="lbl">output layer</span><b>${e.nOut}</b>${actSelect('oact', 0, e.net.outAct)}</div>`;
      h += `<p class="tip">Number answers: try a linear output. Yes/no answers (0 or 1): try sigmoid.</p>`;
    }
    return h;
  }

  // ---------- the table editor ----------
  function openTable() {
    const e = cur, cols = IN_NAMES.slice(0, e.nIn).concat(outNames(e.nOut));
    const row = (vals, k) => `<tr>${vals.map((v, i) => `<td><input type="number" step="any" value="${esc(v)}" aria-label="${cols[i]} in row ${k + 1}"></td>`).join('')}<td><button class="ghost del" aria-label="Remove row">✕</button></td></tr>`;
    const rows = e.examples.length ? e.examples.map(([x, t], k) => row(x.concat(t), k)) : [row(cols.map(() => 0), 0)];
    $('#sbTableHead').innerHTML = '<tr>' + cols.map((c, i) => `<th class="${i >= e.nIn ? 'out' : ''}">${c}</th>`).join('') + '<th></th></tr>';
    $('#sbTableBody').innerHTML = rows.join('');
    $('#sbTableMsg').textContent = '';
    $('#sbTable').hidden = false;
  }
  function saveTable() {
    const e = cur, list = [];
    let bad = false;
    $('#sbTableBody').querySelectorAll('tr').forEach(tr => {
      const vals = [...tr.querySelectorAll('input')].map(inp => {
        const v = parseFloat(inp.value);
        inp.classList.toggle('badcell', !isFinite(v));
        if (!isFinite(v)) bad = true;
        return v;
      });
      list.push([vals.slice(0, e.nIn), vals.slice(e.nIn)]);
    });
    if (bad) { $('#sbTableMsg').textContent = 'Some boxes are not numbers (shown in red).'; return; }
    if (list.length > 300) { $('#sbTableMsg').textContent = 'The most is 300 rows.'; return; }
    e.examples = list;
    $('#sbTable').hidden = true;
    changed();
  }

  // ---------- clicking dots onto the picture ----------
  function dotClick(pt) {
    const e = cur;
    if (!e || e.method !== 'dots' || !pt || !pt.every(isFinite)) return;
    const one = e.nIn === 1, R = e.dotRange;
    // A click near an existing dot removes it.
    const near = e.examples.findIndex(([x, t]) => {
      const p = one ? [x[0], t[0]] : x;
      return Math.abs(p[0] - pt[0]) / (R[0][1] - R[0][0]) < 0.03 && Math.abs(p[1] - pt[1]) / (R[1][1] - R[1][0]) < 0.03;
    });
    if (near >= 0) e.examples.splice(near, 1);
    else {
      if (pt[0] < R[0][0] || pt[0] > R[0][1] || pt[1] < R[1][0] || pt[1] > R[1][1]) return;
      if (e.examples.length >= 300) return;
      const r2 = v => Math.round(v * 100) / 100;
      e.examples.push(one ? [[r2(pt[0])], [r2(pt[1])]] : [[r2(pt[0]), r2(pt[1])], [e.dotValue]]);
    }
    changed();
  }

  // ---------- reacting to the editor ----------
  function wire() {
    const ed = $('#sbEditor');
    ed.addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b || !cur) return;
      const e = cur, d = b.dataset;
      if (b.id === 'sbShareBtn') { showShare(); return; }
      if (b.id === 'sbDupBtn') { const c = add(Object.assign({}, e, { name: (e.name + ' (copy)').slice(0, 40) })); location.hash = '#/sandbox/' + c.id; return; }
      if (b.id === 'sbEditTable') { openTable(); return; }
      if (b.id === 'sbClearDots') { if (confirm('Remove all the dots?')) { e.examples = []; changed(); } return; }
      if (d.nin) { resize(e, +d.nin, e.nOut); changed(); return; }
      if (d.nout) { resize(e, e.nIn, +d.nout); changed(); return; }
      if (d.method) { switchMethod(e, d.method); changed(); return; }
      if (d.dotv !== undefined) { e.dotValue = +d.dotv; changed(); return; }
      if (d.exam !== undefined) { e.examPct = +d.exam; changed(); return; }
      if (d.tol) { e.tol = +d.tol; changed(); return; }
      if (d.layers !== undefined) {
        const n = +d.layers, def = e.kind === 'digits' ? 16 : 4;
        e.net.hidden = Array.from({ length: n }, (_, q) => e.net.hidden[q] || def);
        e.net.acts = Array.from({ length: n }, (_, q) => e.net.acts[q] || (e.kind === 'digits' ? 'relu' : 'tanh'));
        changed();
        return;
      }
      if (d.size !== undefined) { const q = +d.size; e.net.hidden[q] = Math.max(1, Math.min(8, e.net.hidden[q] + +d.v)); changed(); }
    });
    ed.addEventListener('change', ev => {
      const t = ev.target, d = t.dataset, e = cur;
      if (!e) return;
      if (t.id === 'sbName') { e.name = t.value.replace(/[\u0000-\u001f]/g, '').slice(0, 40) || 'My experiment'; G.store(); $('#lvTitle').textContent = e.name; return; }
      if (t.id === 'sbDotV') { const v = parseFloat(t.value); if (isFinite(v)) { e.dotValue = Math.max(-1000, Math.min(1000, v)); changed(); } return; }
      if (d.expr !== undefined) { e.rule.exprs[+d.expr] = t.value.slice(0, 120); changed(); return; }
      if (d.hact !== undefined) { e.net.acts[+d.hact] = pick(t.value, ACTS, 'tanh'); changed(); return; }
      if (d.oact !== undefined) { e.net.outAct = pick(t.value, ACTS, 'linear'); changed(); return; }
      if (d.dsize !== undefined) { e.net.hidden[+d.dsize] = pick(+t.value, DSIZES, 16); changed(); return; }
      const v = parseFloat(t.value);
      if (!isFinite(v)) { renderEditor(); return; }
      if (d.rlo !== undefined || d.rhi !== undefined || d.rpts !== undefined || d.dlo !== undefined || d.dhi !== undefined) {
        if (d.rlo !== undefined) e.rule.ranges[+d.rlo][0] = v;
        if (d.rhi !== undefined) e.rule.ranges[+d.rhi][1] = v;
        if (d.rpts !== undefined) e.rule.points[+d.rpts] = v;
        if (d.dlo !== undefined) e.dotRange[+d.dlo][0] = v;
        if (d.dhi !== undefined) e.dotRange[+d.dhi][1] = v;
        Object.assign(e, sanitize(e)); // keeps every number in bounds
        changed();
      }
    });

    // home screen
    $('#sbHome').addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.start) {
        const s = STARTERS.find(x => x.key === b.dataset.start), e = add(s.make());
        location.hash = '#/sandbox/' + e.id;
      } else if (b.dataset.dup) {
        const src = find(b.dataset.dup), e = add(Object.assign({}, src, { name: (src.name + ' (copy)').slice(0, 40) }));
        location.hash = '#/sandbox/' + e.id;
      } else if (b.dataset.del) {
        const src = find(b.dataset.del);
        if (src && confirm(`Delete "${src.name}"? This can't be undone.`)) {
          const list = exps();
          list.splice(list.indexOf(src), 1);
          G.store();
          home();
        }
      } else if (b.id === 'sbImportYes' && pendingShare) {
        const e = add(pendingShare);
        pendingShare = null;
        location.hash = '#/sandbox/' + e.id;
      } else if (b.id === 'sbImportNo') {
        pendingShare = null;
        location.hash = '#/sandbox';
        home();
      }
    });

    // the table editor
    $('#sbTable').addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.classList.contains('del')) { b.closest('tr').remove(); return; }
      if (b.id === 'sbAddRow') {
        const n = cur.nIn + cur.nOut, k = $('#sbTableBody').rows.length;
        $('#sbTableBody').insertAdjacentHTML('beforeend', `<tr>${Array.from({ length: n }, () => '<td><input type="number" step="any" value="0"></td>').join('')}<td><button class="ghost del" aria-label="Remove row ${k + 1}">✕</button></td></tr>`);
        return;
      }
      if (b.id === 'sbTableDone') saveTable();
      if (b.id === 'sbTableCancel') $('#sbTable').hidden = true;
    });

    // sharing
    $('#sbShareCopy').addEventListener('click', () => {
      const inp = $('#sbShareLink');
      inp.select();
      const ok = () => { $('#sbShareMsg').textContent = 'Copied! Paste it into a message to share it.'; };
      if (navigator.clipboard) navigator.clipboard.writeText(inp.value).then(ok, () => { document.execCommand('copy'); ok(); });
      else { document.execCommand('copy'); ok(); }
    });
    $('#sbShareClose').addEventListener('click', () => { $('#sbShare').hidden = true; });
  }

  function showShare() {
    const link = shareLink(cur);
    $('#sbShareLink').value = link;
    $('#sbShareMsg').textContent = link.length > 8000 ? 'This link is very long because of all the examples. Some apps may cut it short.' : '';
    $('#sbShare').hidden = false;
  }

  // Changing the number of inputs or outputs keeps as much of the task as it can.
  function resize(e, nIn, nOut) {
    e.examples = e.examples.map(([x, t]) => [Array.from({ length: nIn }, (_, i) => x[i] || 0), Array.from({ length: nOut }, (_, k) => (t[k] == null ? 0 : t[k]))]);
    e.nIn = nIn;
    e.nOut = nOut;
    Object.assign(e, sanitize(e));
  }

  // Switching how examples are made carries the current examples across where it can.
  function switchMethod(e, m) {
    if (m === e.method) return;
    const current = examples(e).list;
    if (m === 'dots') {
      if (e.nIn > 2 || e.nOut > 1) { alert('Dots work with 1 or 2 inputs and 1 output. Change the inputs and outputs first.'); return; }
      e.examples = current.slice(0, 300);
      if (current.length) {
        const r = i => { const vs = current.map(([x, t]) => (e.nIn === 1 && i === 1 ? t[0] : x[i])); return pad(Math.min(...vs), Math.max(...vs), 0.1); };
        e.dotRange = [r(0), r(1)];
      }
    } else if (m === 'table') e.examples = current.slice(0, 300);
    e.method = m;
    Object.assign(e, sanitize(e));
  }

  return {
    init(hooks) { G = hooks; wire(); },
    home, open, importLink, dotClick, sanitize,
    isOpen: () => !!cur,
    leave() { cur = null; },
    sanitizeAll(o) {
      const list = o && Array.isArray(o.exps) ? o.exps.slice(0, MAX_EXPS).map(sanitize) : [];
      const seen = new Set();
      return { exps: list.filter(e => !seen.has(e.id) && seen.add(e.id)) };
    },
    _compile: compile,
  };
})();
