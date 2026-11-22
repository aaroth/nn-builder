// The maths of a small neural network: neurons in layers, each neuron adds up
// its weighted inputs plus a bias and passes the sum through an activation.
window.NL = window.NL || {};
(function (NL) {
  'use strict';

  // A repeatable random number generator, so a level starts the same way each time.
  NL.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // f is the activation, d its slope (given the sum z and the output a).
  const ACT = {
    linear: { f: z => z, d: () => 1 },
    step: { f: z => (z > 0 ? 1 : 0), d: () => 0 },
    relu: { f: z => (z > 0 ? z : 0), d: z => (z > 0 ? 1 : 0) },
    sigmoid: { f: z => 1 / (1 + Math.exp(-z)), d: (z, a) => a * (1 - a) },
    tanh: { f: Math.tanh, d: (z, a) => 1 - a * a },
  };

  const targets = t => (Array.isArray(t) ? t : [t]);

  class Net {
    // sizes: neurons per layer, inputs first. acts: one activation name per layer after the inputs.
    constructor(sizes, acts) {
      this.sizes = sizes.slice();
      this.acts = acts.slice();
      this.W = [];
      this.B = [];
      for (let l = 1; l < sizes.length; l++) {
        this.W.push(Array.from({ length: sizes[l] }, () => new Array(sizes[l - 1]).fill(0)));
        this.B.push(new Array(sizes[l]).fill(0));
      }
      this.a = sizes.map(n => new Array(n).fill(0)); // outputs of each layer
      this.z = sizes.map(n => new Array(n).fill(0)); // sums before the activation
    }

    randomize(rand, scale) {
      for (const layer of this.W) for (const row of layer) for (let i = 0; i < row.length; i++) row[i] = (rand() * 2 - 1) * scale;
      for (const layer of this.B) for (let j = 0; j < layer.length; j++) layer[j] = (rand() * 2 - 1) * scale;
    }

    forward(x) {
      const a = this.a, z = this.z;
      for (let i = 0; i < this.sizes[0]; i++) a[0][i] = x[i];
      for (let l = 0; l < this.W.length; l++) {
        const f = ACT[this.acts[l]].f, W = this.W[l], B = this.B[l], src = a[l];
        for (let j = 0; j < W.length; j++) {
          const w = W[j];
          let s = B[j];
          for (let i = 0; i < w.length; i++) s += w[i] * src[i];
          z[l + 1][j] = s;
          a[l + 1][j] = f(s);
        }
      }
      return a[a.length - 1];
    }

    // The error: the average of (answer - right answer) squared over the examples.
    // A right answer t is a number, or a list with one number per output neuron.
    loss(samples) {
      let s = 0;
      for (const p of samples) {
        const y = this.forward(p.x), t = targets(p.t);
        for (let k = 0; k < y.length; k++) s += (y[k] - t[k]) * (y[k] - t[k]);
      }
      return s / samples.length;
    }

    // One step of gradient descent on the given examples.
    train(samples, lr) {
      const L = this.W.length, N = samples.length, dOut = ACT[this.acts[L - 1]].d;
      const gW = this.W.map(layer => layer.map(row => row.map(() => 0)));
      const gB = this.B.map(layer => layer.map(() => 0));
      for (const p of samples) {
        const y = this.forward(p.x), t = targets(p.t);
        let delta = y.map((v, k) => (2 * (v - t[k]) / N) * dOut(this.z[L][k], v));
        for (let l = L - 1; l >= 0; l--) {
          const src = this.a[l], W = this.W[l];
          for (let j = 0; j < W.length; j++) {
            gB[l][j] += delta[j];
            for (let i = 0; i < src.length; i++) gW[l][j][i] += delta[j] * src[i];
          }
          if (l > 0) {
            const d = ACT[this.acts[l - 1]].d, prev = new Array(src.length);
            for (let i = 0; i < src.length; i++) {
              let s = 0;
              for (let j = 0; j < W.length; j++) s += W[j][i] * delta[j];
              prev[i] = s * d(this.z[l][i], src[i]);
            }
            delta = prev;
          }
        }
      }
      for (let l = 0; l < L; l++) {
        for (let j = 0; j < this.W[l].length; j++) {
          this.B[l][j] -= lr * gB[l][j];
          for (let i = 0; i < this.W[l][j].length; i++) this.W[l][j][i] -= lr * gW[l][j][i];
        }
      }
    }
  }

  NL.Net = Net;
})(window.NL);
