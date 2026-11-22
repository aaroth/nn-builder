// The chapters and levels. Each level is a small network with starting numbers, the tests
// that must pass, and the words Eli reads.
window.NL = window.NL || {};
(function (NL) {
  'use strict';

  NL.CHAPTERS = [
    { id: 1, title: 'One Neuron', blurb: 'Set the weights and bias of a single neuron by hand.' },
    { id: 2, title: 'Teamwork', blurb: 'Neurons working together in layers.' },
    { id: 3, title: 'Learning', blurb: 'The network finds its own weights, and you watch it learn.' },
    { id: 4, title: 'The Lab', blurb: 'Design your own networks and train them on any task.' },
  ];

  const DEFAULTS = { editBias: true, wRange: [-5, 5], wStep: 0.5, bRange: [-10, 10], bStep: 0.5, lines: false };
  const level = o => Object.assign({}, DEFAULTS, o);
  // A truth table: every pair of 0/1 inputs with the right answer.
  const TT = f => [[0, 0], [0, 1], [1, 0], [1, 1]].map(x => [x, f(x[0], x[1]) ? 1 : 0]);
  const GATE_PIC = { kind: 'heat', range: [-0.5, 1.5], lo: 0, hi: 1, ticks: [0, 1] };
  const gate = (id, title, idea, out, f, start, text) => level(Object.assign({
    id, chapter: 1, title, idea, sizes: [2, 1], acts: ['step'], names: [['a', 'b'], [out]],
    W: [[start.slice(0, 2)]], B: [[start[2]]], tests: TT(f), picture: GATE_PIC, lines: true,
  }, text));

  NL.LEVELS = [
    level({
      id: 1, chapter: 1, title: 'The Wire', idea: 'Weight',
      sizes: [1, 1], acts: ['linear'], names: [['x'], ['answer']], editBias: false,
      W: [[[0.5]]], B: [[0]],
      tests: [[[1], 2], [[3], 6], [[5], 10], [[0], 0], [[7.5], 15], [[10], 20]], tryIt: [12],
      picture: { kind: 'graph', range: [0, 10], yRange: [0, 20], xticks: [0, 5, 10], yticks: [0, 10, 20] },
      story: `<p>Welcome to the lab! Neural networks are built from tiny calculators called <b>neurons</b>, joined by wires.</p>
        <p>Every wire has a number on it called its <b>weight</b>. Whatever travels along the wire gets <b>multiplied</b> by the weight.</p>`,
      ideaBox: `<h4>New idea: weight</h4><p class="formula">answer = weight × x</p>
        <p>A bigger weight makes a thicker wire.</p>
        <p><b>The Picture</b> shows the network's answer for every x (yellow line). The white dots are the right answers. Get the line through every dot!</p>`,
      goal: `Make a <b>doubler</b>: whatever number goes in, twice as much comes out.`,
      hints: ['Click the number on the wire to choose it, then use the − and + buttons, the slider or the arrow keys.',
        'Which number times 3 makes 6?'],
      learned: `<p>A <b>weight</b> is a multiplier. Every neural network is made of weights like this one. The AI chatbots you've heard of have <b>billions</b> of them.</p>
        <p>Try the last row of the tests: type in any number and watch your doubler handle it.</p>`,
    }),

    level({
      id: 2, chapter: 1, title: 'Head Start', idea: 'Bias',
      sizes: [1, 1], acts: ['linear'], names: [['miles'], ['fare $']],
      W: [[[1]]], B: [[0]],
      tests: [[[0], 3], [[1], 5], [[2], 7], [[4], 11], [[10], 23]], tryIt: [26],
      picture: { kind: 'graph', range: [0, 10], yRange: [0, 25], xticks: [0, 5, 10], yticks: [0, 5, 10, 15, 20, 25] },
      story: `<p>The Robo-Taxi charges <b>$3</b> as soon as you get in, plus <b>$2 for every mile</b>.</p>
        <p>A weight alone can't do this. With 0 miles, 0 × any weight is still 0, but the fare should be $3.</p>`,
      ideaBox: `<h4>New idea: bias</h4><p>Every neuron also has a <b>bias</b>: a number it adds on, whatever comes in. The neuron works out its <b>sum</b>, written Σ:</p>
        <p class="formula">Σ = weight × miles + bias</p>`,
      goal: `Make the neuron work out the fare for any number of miles.`,
      hints: ['Look at the 0-miles test first. There, only the bias counts.',
        'Every extra mile adds $2 to the fare. That is the weight.'],
      learned: `<p>Look at the graph: the <b>weight</b> sets how steep the line is, and the <b>bias</b> sets where it starts. You can make any straight line this way.</p>`,
    }),

    level({
      id: 3, chapter: 1, title: 'The Adder', idea: 'Two inputs',
      sizes: [2, 1], acts: ['linear'], names: [['a', 'b'], ['answer']],
      W: [[[0.5, 2]]], B: [[0]],
      tests: [[[1, 2], 3], [[3, 4], 7], [[0, 5], 5], [[8, 6], 14], [[2.5, 1.5], 4], [[10, 10], 20]], tryIt: [123, 456],
      picture: { kind: 'heat', range: [0, 10], lo: 0, hi: 20, ticks: [0, 5, 10] },
      story: `<p>A neuron can listen to more than one wire. Each input is multiplied by the weight on its own wire, then everything is added up, along with the bias.</p>`,
      ideaBox: `<h4>New idea: more inputs</h4><p class="formula">Σ = w₁ × a + w₂ × b + bias</p>
        <p><b>The Picture</b> now shows the network's answer for every a and b at once: orange is small, blue is big. The dots are the tests, coloured with the right answer. When the network is right, the dots blend into the background.</p>`,
      goal: `Build an <b>adder</b>: the answer should be a + b.`,
      hints: ['Each input should count exactly once.', 'Is the bias needed at all here?'],
      learned: `<p>You built an adder from a single neuron! In the Picture the colour changes just as fast going right (more a) as going up (more b), because both weights are the same.</p>
        <p>In Chapter 3 you'll start a neuron with random weights and watch it <b>learn</b> to add, all by itself.</p>`,
    }),

    level({
      id: 4, chapter: 1, title: 'Take Away', idea: 'Negative weights',
      sizes: [2, 1], acts: ['linear'], names: [['a', 'b'], ['answer']],
      W: [[[1, 1]]], B: [[0]],
      tests: [[[5, 2], 3], [[9, 4], 5], [[3, 3], 0], [[2, 7], -5], [[10, 1], 9], [[0, 6], -6]], tryIt: [100, 58],
      picture: { kind: 'heat', range: [0, 10], lo: -10, hi: 10, ticks: [0, 5, 10] },
      story: `<p>Here's an adder like the one you just built. Turn it into a <b>subtractor</b>.</p>
        <p>Weights can be <b>negative</b>. A negative weight flips its signal, so a bigger input pushes the sum <b>down</b>. Negative wires are orange.</p>`,
      ideaBox: `<h4>New idea: negative weights</h4><p>Blue wire: more input → bigger sum.<br>Orange wire: more input → smaller sum.</p>`,
      goal: `Make the answer <b>a − b</b>.`,
      hints: ['Only one number needs to change.', 'Subtracting b is the same as adding (−1) × b.'],
      learned: `<p>Positive weights <b>excite</b> a neuron and negative weights <b>calm it down</b>. Neurons in your brain work the same way: some connections make the next neuron more active and some make it less active.</p>`,
    }),

    level({
      id: 5, chapter: 1, title: 'Fire!', idea: 'Activation',
      sizes: [1, 1], acts: ['step'], names: [['temp °C'], ['alarm']],
      W: [[[1]]], B: [[0]], bRange: [-50, 50], bStep: 1,
      tests: [[[10], 0], [[25], 0], [[29], 0], [[31], 1], [[38], 1], [[45], 1]], tryIt: [33],
      picture: { kind: 'graph', range: [0, 50], yRange: [-0.25, 1.25], xticks: [0, 10, 20, 30, 40, 50], yticks: [0, 1] },
      story: `<p>Until now the neuron just gave back its sum. Real neurons are more like switches: they either <b>fire</b> or stay <b>quiet</b>.</p>
        <p>This neuron has a <b>step activation</b>. After working out its sum, it fires (answers 1) if the sum is more than 0. Otherwise it stays quiet (answers 0).</p>`,
      ideaBox: `<h4>New idea: activation</h4><p class="formula">Σ > 0 → 1 (fire!)<br>otherwise → 0 (quiet)</p>
        <p>A neuron glows yellow when it fires. On the graph, the dashed line shows where the sum is exactly 0.</p>`,
      goal: `Build a <b>heat alarm</b>: fire when the temperature is <b>above 30 °C</b>, stay quiet when it is 30 °C or cooler.`,
      hints: ['Keep the weight at 1. What bias makes the sum exactly 0 when it is 30 °C?',
        'Watch the dashed line on the graph and slide it to 30 with the bias.'],
      learned: `<p>The bias sets the neuron's <b>threshold</b>: how strong the input has to be before it fires.</p>
        <p>A firing neuron is a 1 and a quiet one is a 0, just like the wires in a computer. Next: logic gates!</p>`,
    }),

    gate(6, 'AND', 'One line', 'AND', (a, b) => a && b, [1, 0, 0], {
      story: `<p>Now the inputs are 0 or 1, like the wires in a computer. Can one neuron be a logic gate?</p>`,
      ideaBox: `<h4>New idea: one neuron draws one line</h4><p>In the Picture, the dashed line is where the neuron's sum is exactly 0. On one side it fires (blue), on the other it is quiet (orange).</p>
        <p>Changing the weights <b>turns</b> the line. Changing the bias <b>slides</b> it.</p>`,
      goal: `Make an <b>AND</b> gate: fire only when <b>both</b> inputs are 1.`,
      hints: ['With both weights at 1, the sum before the bias is 0, 1 or 2. You want it to fire only when that is 2.',
        'Try a bias of −1.5.'],
      learned: `<p>Your AND neuron's line cuts the (1, 1) corner off from the other three corners.</p>`,
    }),

    gate(7, 'OR', 'Threshold', 'OR', (a, b) => a || b, [1, 1, -1.5], {
      story: `<p>Here is a working AND neuron. Turn it into an <b>OR</b> gate.</p>`,
      ideaBox: `<h4>Same weights, different bias</h4><p>Watch the dashed line in the Picture while you change the bias.</p>`,
      goal: `Make an <b>OR</b> gate: fire when <b>at least one</b> input is 1. You only need to change one number.`,
      hints: ['Slide the line with the bias until it cuts off only the (0, 0) corner.'],
      learned: `<p>AND and OR use the <b>same weights</b>. Only the bias (the threshold) is different: AND needs two inputs to fire, OR needs just one.</p>`,
    }),

    level({
      id: 8, chapter: 1, title: 'NOT', idea: 'Firing on nothing',
      sizes: [1, 1], acts: ['step'], names: [['a'], ['NOT']],
      W: [[[1]]], B: [[0]],
      tests: [[[0], 1], [[1], 0]],
      picture: { kind: 'graph', range: [-0.5, 1.5], yRange: [-0.25, 1.25], xticks: [0, 1], yticks: [0, 1] },
      story: `<p>A NOT gate flips its input: 1 becomes 0 and 0 becomes 1. Right now this neuron just copies its input.</p>`,
      ideaBox: `<h4>Firing on nothing</h4><p>To fire when the input is 0, the bias alone has to push the sum above 0. Then the input has to pull it back down.</p>`,
      goal: `Make a <b>NOT</b> gate: fire when the input is <b>0</b>.`,
      hints: ['The bias must be more than 0, so the neuron fires when the input is 0.',
        'Now you need a weight that pulls the sum below 0 when the input is 1. Blue or orange?'],
      learned: `<p>A <b>negative weight</b> plus a <b>positive bias</b> makes a neuron that fires when its input is quiet.</p>`,
    }),

    gate(9, 'NAND', 'Flipping', 'NAND', (a, b) => !(a && b), [1, 1, -1.5], {
      story: `<p>NAND is the gate you can build every other gate from. Here is an AND neuron again.</p>`,
      ideaBox: `<h4>Flipping a neuron</h4><p>NAND means "NOT AND": it gives the opposite of AND for every input.</p>`,
      goal: `Make a <b>NAND</b> gate: fire unless <b>both</b> inputs are 1.`,
      hints: ['What happens to the sum if you flip the sign of every number in the AND neuron?',
        'Weights −1 and −1, and a bias of 1.5.'],
      learned: `<p>Flipping every number keeps the line in the same place but swaps which side fires.</p>
        <p>Any computer can be built from NAND gates, so a big enough team of neurons can work out anything a computer can!</p>`,
    }),

    gate(10, 'XOR?', 'The XOR wall', 'XOR', (a, b) => a !== b, [1, 1, -0.5], {
      story: `<p>XOR fires when <b>exactly one</b> input is 1. Try to build it with one neuron.</p>
        <p>If you decide it can't be done, press the <b>impossible</b> button and say why.</p>`,
      ideaBox: `<h4>Look at the Picture</h4><p>XOR's blue dots are on opposite corners. Can one straight line put both blue dots on one side and both orange dots on the other?</p>`,
      goal: `Make an <b>XOR</b> gate, or work out why it can't be done.`,
      hints: ['Try lots of numbers. What is the most tests you can pass at once?',
        'Draw it on paper: four dots in a square, with opposite corners the same colour. Now try to split the colours with one ruler line.'],
      quiz: {
        q: "Why can't one neuron make XOR?",
        options: [
          { text: 'The weights would need to be bigger than 5.', reply: 'Not quite. Bigger weights only turn or slide the line. It is still one straight line.' },
          { text: "One neuron splits the inputs with one straight line, and no straight line can put XOR's opposite corners on the same side.", right: true, reply: 'Exactly right!' },
          { text: 'A step neuron can only fire for one test at a time.', reply: 'Not true: your OR neuron fired for three tests.' },
        ],
      },
      learned: `<p>You found a famous limit! In 1969 Marvin Minsky and Seymour Papert showed that a single neuron (then called a <b>perceptron</b>) can't do XOR. For years afterwards, many scientists lost interest in neural networks.</p>
        <p>The way out: use more than one neuron.</p>`,
    }),

    level({
      id: 11, chapter: 2, title: 'Teamwork', idea: 'Hidden layer',
      sizes: [2, 2, 1], acts: ['step', 'step'], names: [['a', 'b'], ['hidden 1', 'hidden 2'], ['XOR']],
      W: [[[0, 0], [0, 0]], [[0, 0]]], B: [[0, 0], [0]],
      tests: TT((a, b) => a !== b), picture: GATE_PIC, lines: true,
      story: `<p>Time for a team! Two <b>hidden</b> neurons look at the inputs, and the output neuron looks at the hidden neurons.</p>
        <p>Each hidden neuron draws its own line, so together they can fence off the middle.</p>`,
      ideaBox: `<h4>New idea: hidden layer</h4><p>Hidden neurons sit between the inputs and the output. Click a neuron to see its own picture and its calculation.</p>`,
      goal: `Build <b>XOR</b> with three neurons.`,
      hints: ['XOR means "at least one is 1" AND "not both are 1".',
        'Make hidden 1 an OR gate and hidden 2 a NAND gate. You have built both already!',
        'Then make the output an AND gate that reads the two hidden neurons.',
        'OR: 1, 1, bias −0.5. NAND: −1, −1, bias 1.5. AND: 1, 1, bias −1.5.'],
      learned: `<p>Two lines beat one! A hidden layer lets a network combine simple ideas (OR, NAND) into harder ones (XOR). Big networks stack many hidden layers, which is what the "deep" in <b>deep learning</b> means.</p>
        <p>Setting all these numbers by hand was hard work. In Chapter 3 the network will find them by itself.</p>`,
    }),
  ];
})(window.NL);
