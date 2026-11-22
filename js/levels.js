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

  const fmt = v => NL.fmt(v);
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

    // ---------- Chapter 3: Learning ----------
    level({
      id: 12, chapter: 3, mode: 'meter', title: 'Warmer, Colder', idea: 'Error',
      sizes: [1, 1], acts: ['linear'], names: [['x'], ['answer']], editBias: false,
      W: [[[0]]], B: [[0]], wRange: [-2, 8], wStep: 0.1,
      xs: [1, 2, 3, 4, 5], secrets: [2.7, 3.4, 1.6, 4.3, 3.8, 5.2], target: 0.05,
      valley: { x0: -2, x1: 8, ymax: 150 },
      story: `<p>So far you could see the right answers, so you could work out the weight in your head. A real network can't do that. All it finds out is <b>how wrong</b> it is.</p>
        <p>This neuron has a secret weight. The right answers are locked away, and your only clue is the <b>error meter</b>.</p>`,
      ideaBox: `<h4>New idea: error</h4><p class="formula">error = average of<br>(guess − right answer)²</p>
        <p>Squaring makes every miss count as positive, and makes big misses count a lot. An error of 0 means every answer is perfect.</p>
        <p>Each time you let go of the weight, your try is plotted on <b>The Valley</b>: the weight across, the error up.</p>`,
      goal: `Find the secret weight: get the error down to 0.`,
      hints: ['When the error gets smaller you are getting warmer, so keep going the same way.',
        'Look at the shape your dots make. Where would the bottom be?'],
      learned: c => `<p>The secret weight was <b>${fmt(c.secret)}</b>. Your tries traced out a <b>valley</b>, and the right weight is at the very bottom, where the error is smallest.</p>
        <p>Training a neural network means finding the bottom of its error valley. Next, the computer walks downhill by itself.</p>`,
    }),

    level({
      id: 13, chapter: 3, mode: 'descent', title: 'Roll Downhill', idea: 'Gradient descent',
      sizes: [1, 1], acts: ['linear'], names: [['x'], ['answer']], editBias: false,
      W: [[[0]]], B: [[0]], xs: [1, 2, 3, 4, 5], secrets: [3], target: 0.01, maxSteps: 6, blowup: 400,
      rates: [0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1], rate: 0.005,
      valley: { x0: -2, x1: 8, ymax: 150 },
      story: `<p>Now the computer looks for the bottom of the valley. It can't see the whole valley. It only knows how steep the ground is under the ball: the <b>slope</b>.</p>
        <p>Each step, the ball moves downhill. How far it moves is set by the <b>learning rate</b>.</p>`,
      ideaBox: `<h4>New idea: gradient descent</h4><p class="formula">new weight =<br>weight − learning rate × slope</p>
        <p>A negative slope means downhill is to the right, so the weight goes up. Steep ground gives big steps; near the bottom the ground is flat and the steps get tiny.</p>
        <p>The grey curve shows you the whole valley, but the computer only knows the slope under the ball (the white line).</p>`,
      goal: `Pick a learning rate that rolls the ball to the bottom (error below 0.01) in <b>6 steps or fewer</b>.`,
      hints: ['Try the smallest learning rate first, then the biggest.',
        'Too small crawls, too big bounces out. You want something in between.'],
      learned: () => `<p>That's <b>gradient descent</b>, the way almost every neural network learns. Too small a learning rate wastes time; too big and the steps overshoot the bottom, and can even fly out of the valley.</p>
        <p>Real networks have millions of weights, so their valley has millions of directions. Gradient descent still works: it nudges every weight downhill at once.</p>`,
    }),

    level({
      id: 14, chapter: 3, mode: 'train', title: 'Teach It to Add', idea: 'Training',
      sizes: [2, 1], acts: ['linear'], names: [['a', 'b'], ['answer']],
      tests: [[[1, 2], 3], [[3, 1], 4], [[0, 4], 4], [[2, 2], 4], [[4, 3], 7], [[5, 0], 5], [[1, 5], 6], [[3, 4], 7]],
      exam: [[[12, 30], 42], [[25, 17], 42], [[100, 250], 350], [[7.5, 0.25], 7.75]],
      tol: 0.05, rates: [0.001, 0.01, 0.03, 0.1, 0.2], rate: 0.01,
      picture: { kind: 'heat', range: [0, 5], lo: 0, hi: 10, ticks: [0, 5] },
      story: `<p>Remember your adder? This time the computer builds it. The neuron starts with <b>random</b> weights and learns from 8 examples, one at a time.</p>
        <p>After each example it nudges every number a little in the direction that makes its answer better.</p>`,
      ideaBox: `<h4>New idea: training</h4><p class="formula">miss = right answer − guess<br>nudge = learning rate × miss × input</p>
        <p>An input that was bigger had more to do with the miss, so its weight gets a bigger nudge. The bias works like a weight on an input that is always 1.</p>
        <p>Press <b>Step</b> to see one nudge worked out, or <b>▶ Train</b> to watch. Click a number on the diagram to follow its line on the chart.</p>`,
      goal: `Train the neuron until it passes the <b>exam</b>: sums it has never seen.`,
      hints: ['Press ▶ Train and watch the chart of the numbers. Where do the lines end up?',
        'If it is slow, try a bigger learning rate. If the numbers explode, a smaller one.'],
      learned: () => `<p>The neuron found weights very close to 1 and 1 and a bias very close to 0: the adder you built by hand in level 3. Nobody told it how adding works.</p>
        <p>It only saw 8 small examples, yet it can add big numbers it has never seen, because it learned the rule rather than memorising the examples.</p>`,
    }),

    level({
      id: 15, chapter: 3, mode: 'train', title: 'Smooth Step', idea: 'Sigmoid',
      sizes: [2, 1], acts: ['step'], actChoice: ['step', 'sigmoid'], needAct: 'sigmoid',
      names: [['a', 'b'], ['AND']], W: [[[0.3, -0.2]]], B: [[0.1]],
      tests: TT((a, b) => a && b), tol: 0.2, rates: [0.1, 0.5, 2, 5], rate: 0.5,
      picture: GATE_PIC, lines: true,
      story: `<p>Can training build a logic gate too? This neuron uses the step activation from Chapter 1. Press <b>▶ Train</b> and watch the numbers.</p>`,
      ideaBox: `<h4>The trouble with steps</h4><p>A step is flat everywhere: nudging a weight a tiny bit doesn't change the answer at all. Its slope is 0, so every nudge is 0.</p>
        <h4>New idea: the sigmoid</h4>
        <svg class="mini" viewBox="0 0 220 70" aria-label="A step jumps from 0 to 1; a sigmoid slides smoothly">
          <path d="M10 58 H110 V12 H210" fill="none" stroke="#5b6884" stroke-width="2" stroke-dasharray="4 4"/>
          <path d="${sigmoidPath()}" fill="none" stroke="#ffd166" stroke-width="2.5"/>
          <text x="12" y="10" fill="#8a98ae" font-size="10">step (grey) and sigmoid (yellow)</text></svg>
        <p>The <b>sigmoid</b> is a smooth step: it slides from 0 up to 1 instead of jumping, so it has a slope and training can tell which way to go.</p>
        <p class="formula">nudge = learning rate × miss<br>× slope × input</p>
        <p>An answer counts as right when it is within 0.2 of the right answer.</p>`,
      goal: `Train an <b>AND</b> gate. You will need to change something first.`,
      hints: ['Press Step and read how the nudges are worked out. What is the slope of a step?',
        'Switch the activation to sigmoid, then train.'],
      learned: () => `<p>Real networks use smooth activations so that training can feel the slope. The sigmoid answers exactly 0.5 on the dashed line, where the step would flip, and gets surer of itself the further away you go.</p>`,
    }),

    level({
      id: 16, chapter: 3, mode: 'train', title: 'XOR Learns', idea: 'Backpropagation',
      sizes: [2, 1], acts: ['sigmoid'], hiddenChoice: [0, 2, 3, 4], hidden: 0,
      names: [['a', 'b'], ['XOR']],
      tests: TT((a, b) => a !== b), tol: 0.2, rates: [0.5, 1, 2, 5], rate: 2,
      picture: GATE_PIC, lines: true,
      story: `<p>In level 11 you set nine numbers by hand to make XOR. Can training find them by itself?</p>
        <p>Start with no hidden neurons, then add some.</p>`,
      ideaBox: `<h4>New idea: passing the blame back</h4><p>The output neuron's miss is shared out to the hidden neurons along their wires: a heavier wire carries more of the blame. Each hidden neuron then nudges its own numbers the same way as before. This is called <b>backpropagation</b>.</p>
        <p>Watch the Picture: each hidden neuron's dashed line moves as it learns.</p>`,
      goal: `Train a network that passes all four XOR tests.`,
      hints: ['With no hidden neurons this is level 10 all over again. Add some hidden neurons.',
        'Sometimes a network gets stuck partway. Press New random start, or add another hidden neuron.',
        'A bigger learning rate is faster here. Try 2 or 5.'],
      learned: () => `<p>The network found its own way to make XOR. Look at the hidden neurons' lines: did it find the OR and NAND trick you used, or something else?</p>
        <p>A different random start can find a different answer, and sometimes gets stuck. Extra neurons make getting stuck less likely, which is one reason real networks are so big.</p>`,
    }),
  ];

  // ---------- Chapter 4: the Lab ----------
  NL.LEVELS.push(level({
    id: 17, chapter: 4, mode: 'lab', title: 'The Lab', idea: 'Experiments',
    sizes: [2, 1], acts: ['linear'], names: [['a', 'b'], ['answer']],
  }));

  const grid = (vals, f) => [].concat(...vals.map(a => vals.map(b => [[a, b], f(a, b)])));
  const NUMBER = { out: 'linear', rates: [0.003, 0.01, 0.03, 0.1, 0.3], rate: 0.01, ticks: [0, 1, 2, 3], range: [-0.5, 3.5] };
  const YESNO = { out: 'sigmoid', rates: [0.03, 0.1, 0.3, 1, 3], rate: 0.3, lo: 0, hi: 1 };
  const circlePts = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const x = +(-1 + i / 3).toFixed(2), y = +(-1 + j / 3).toFixed(2), r = Math.hypot(x, y);
      if (Math.abs(r - Math.sqrt(0.45)) > 0.12) circlePts.push([[x, y], r * r < 0.45 ? 1 : 0]);
    }
  }

  // Each task: its examples, how close counts as right, and the words around it.
  NL.LAB = [
    Object.assign({}, NUMBER, {
      id: 'add', title: 'a + b', outName: 'a + b', names: ['a', 'b'], tol: 0.1, lo: 0, hi: 6,
      tests: grid([0, 1, 2, 3], (a, b) => a + b),
      about: 'Add the two numbers.',
      hints: ['You built this in level 3. How many neurons did it need?', 'Try no hidden layers. Simpler networks often learn faster.'],
      learned: 'A single neuron can add, so no hidden layer is needed. Extra neurons only give training more numbers to sort out.',
    }),
    Object.assign({}, NUMBER, {
      id: 'max', title: 'bigger of a, b', outName: 'bigger', names: ['a', 'b'], tol: 0.25, lo: 0, hi: 3,
      tests: grid([0, 1, 2, 3], (a, b) => Math.max(a, b)),
      about: 'Answer whichever of a and b is bigger. If they are the same, answer that number.',
      hints: ['One neuron can only make a flat slope. This answer has a fold in it (look at the Picture), so you need hidden neurons.',
        'Try each activation. One of them is much better at this task than the others.',
        'relu answers 0 until its sum gets above 0, then follows the sum. "bigger of a and b" = b + (how much a is above b, or 0).'],
      learned: 'bigger of a and b = b + relu(a − b): a relu neuron switches on only when a is bigger than b. That is why relu is so good at this.',
    }),
    Object.assign({}, NUMBER, {
      id: 'mul', title: 'a × b', outName: 'a × b', names: ['a', 'b'], tol: 0.3, lo: 0, hi: 9,
      tests: grid([0, 1, 2, 3], (a, b) => a * b),
      about: 'Multiply the two numbers. Neurons can only multiply by their weights and add up, so this one is hard!',
      hints: ['You will need a hidden layer with plenty of neurons, and patience. Turbo speed helps.',
        'Try 6 hidden neurons with tanh or sigmoid, and a small learning rate like 0.01 or 0.03.'],
      learned: 'No single neuron can multiply, but a team of hidden neurons can bend the Picture into a curved shape that matches a × b closely. That is the real trick of neural networks: building curves out of lots of simple pieces.',
    }),
    Object.assign({}, YESNO, {
      id: 'xor', title: 'XOR', outName: 'XOR', names: ['a', 'b'], tol: 0.2, range: [-0.5, 1.5], ticks: [0, 1],
      tests: grid([0, 1], (a, b) => (a !== b ? 1 : 0)),
      about: 'Fire when exactly one input is 1. You know this one!',
      hints: ['What is the smallest network that can learn it?', 'Try tanh. Does it learn faster than sigmoid?'],
      learned: 'XOR needs at least two hidden neurons, because it needs two lines. With a few more neurons it gets stuck less often.',
    }),
    Object.assign({}, YESNO, {
      id: 'gt', title: 'is a > b?', outName: 'a > b?', names: ['a', 'b'], tol: 0.2, range: [-0.5, 3.5], ticks: [0, 1, 2, 3],
      tests: grid([0, 1, 2, 3], (a, b) => (a > b ? 1 : 0)).filter(([[a, b]]) => a !== b),
      about: 'Answer yes (1) when a is bigger than b, and no (0) when it is smaller.',
      hints: ['Look at the Picture. Can one straight line split the yes dots from the no dots?'],
      learned: 'One neuron is enough: the line a = b splits the yes answers from the no answers.',
    }),
    Object.assign({}, YESNO, {
      id: 'circle', title: 'inside the circle', outName: 'inside?', names: ['x', 'y'], tol: 0.3, range: [-1.2, 1.2], ticks: [-1, 0, 1],
      tests: circlePts,
      about: 'Answer yes (1) for the points inside the circle and no (0) for the points outside.',
      hints: ['Each hidden neuron draws one straight line. How many lines does it take to fence in a circle?',
        'Three lines make a triangle around the middle. Four make a square. Try 4 to 6 hidden neurons.',
        'tanh with a learning rate of 0.3 or 1 works well.'],
      learned: 'Each hidden neuron draws one straight line, and the output neuron combines them into a fence around the middle. Look at the dashed lines in the Picture: that is how a network makes a round shape out of straight pieces.',
    }),
  ];

  // Little pictures of the three hidden activations for the Lab.
  NL.ACT_PICS = (function () {
    const fs = { sigmoid: z => 1 / (1 + Math.exp(-z)), tanh: Math.tanh, relu: z => Math.max(0, z) / 2 };
    const pic = name => {
      let d = '';
      for (let i = 0; i <= 40; i++) {
        const z = -4 + i / 5, y = 30 - fs[name](z) * 22;
        d += (i ? ' L' : 'M') + (4 + i * 2.2).toFixed(1) + ' ' + y.toFixed(1);
      }
      return `<figure><svg viewBox="0 0 96 56"><line x1="4" y1="30" x2="92" y2="30" stroke="#33415c"/><line x1="48" y1="4" x2="48" y2="54" stroke="#33415c"/>` +
        `<path d="${d}" fill="none" stroke="#ffd166" stroke-width="2.5"/></svg><figcaption>${name}</figcaption></figure>`;
    };
    return `<div class="actpics">${pic('sigmoid')}${pic('tanh')}${pic('relu')}</div>`;
  })();

  // An SVG path of the sigmoid for the little picture in level 15.
  function sigmoidPath() {
    let d = '';
    for (let i = 0; i <= 50; i++) {
      const x = 10 + i * 4, y = 58 - 46 / (1 + Math.exp(-(x - 110) / 14));
      d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }
})(window.NL);
