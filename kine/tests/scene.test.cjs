'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Engine, defaults } = require('../src/core.js');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../src/scene.js'), 'utf8'), context);
const Scene = context.window.CBLScene;

function makeScene(simTime) {
  const engine = new Engine(defaults());
  const canvas = { getContext: type => type === 'webgl' ? null : {}, addEventListener() {} };
  return new Scene(canvas, () => engine.world, () => {}, simTime);
}

function lowestPoint(object) {
    const { data } = object.geom;
    const m = object.m;
    let low = Infinity;
    for (let i = 0; i < data.length; i += 6) {
      low = Math.min(low, m[1] * data[i] + m[5] * data[i + 1] + m[9] * data[i + 2] + m[13]);
    }
    return low;
}

function lowestLegPoints(scene) {
  return scene.objects.filter(object => object.part === 'legs').map(lowestPoint).sort((a, b) => a - b).slice(0, 2);
}

function position(m) { return m.slice(12, 15); }

test('walking gives each leg its own stride and lift', () => {
  const scene = makeScene();
  const world = scene.world();
  world.pose.walk = 1;
  const samples = [-Math.PI / 2, 0, Math.PI / 2, Math.PI].map(phase => {
    world.phase = phase;
    scene.build(1000);
    return [-1, 1].map(side => scene.rig?.legs?.[side]?.foot && position(scene.rig.legs[side].foot));
  });
  for (const side of [0, 1]) {
    const foot = samples.map(pair => pair[side]);
    assert.ok(foot.every(Boolean), `missing articulated foot ${side}`);
    assert.ok(Math.max(...foot.map(p => p[2])) - Math.min(...foot.map(p => p[2])) > .25);
    assert.ok(Math.max(...foot.map(p => p[1])) - Math.min(...foot.map(p => p[1])) > .09);
  }
  assert.ok(samples[1][0][1] > samples[1][1][1] + .09, 'legs must lift on opposite beats');
});

test('both arms swing independently and the sword stays fixed in the right grip', () => {
  const scene = makeScene();
  const world = scene.world();
  world.pose.walk = 1;
  const hands = [-Math.PI / 2, Math.PI / 2].map(phase => {
    world.phase = phase;
    scene.build(1000);
    assert.ok(scene.rig?.arms?.[-1]?.hand && scene.rig?.arms?.[1]?.hand && scene.rig?.sword?.grip);
    const right = position(scene.rig.arms[1].hand), grip = position(scene.rig.sword.grip);
    assert.ok(Math.hypot(...right.map((v, i) => v - grip[i])) < .09, 'sword grip leaves hand');
    return [-1, 1].map(side => position(scene.rig.arms[side].hand));
  });
  for (const side of [0, 1]) assert.ok(Math.abs(hands[0][side][2] - hands[1][side][2]) > .12);
  assert.ok((hands[0][0][2] - hands[1][0][2]) * (hands[0][1][2] - hands[1][1][2]) < 0);
});

test('the blade runs straight through the sword hand in every pose', () => {
  const scene = makeScene();
  const world = scene.world();
  for (const [walk, phase, attack, montageTime] of [[0, 0, 0, 0], [1, 0, 0, 0], [1, Math.PI, 0, 0], [0, 0, 1, .3], [0, 0, 1, .65]]) {
    Object.assign(world.pose, { walk, attack });
    world.phase = phase;
    world.montageTime = montageTime;
    scene.build(1000);
    const hand = scene.rig.arms[1].hand, sword = scene.rig.sword.grip;
    const handAxis = [-hand[4], -hand[5], -hand[6]];
    const bladeAxis = [sword[4], sword[5], sword[6]];
    const alignment = handAxis.reduce((sum, value, i) => sum + value * bladeAxis[i], 0);
    assert.ok(alignment > .98, `crooked grip in pose ${JSON.stringify([walk, phase, attack, montageTime])}: ${alignment}`);
  }
});

test('both shoes touch the floor in the initial idle pose', () => {
  const scene = makeScene();
  scene.build(0);
  for (const y of lowestLegPoints(scene)) assert.ok(Math.abs(y) < 0.01, `shoe height ${y} m`);
});

test('the sword visibly follows an idle arm motion', () => {
  const scene = makeScene();
  scene.build(0);
  const start = scene.objects.filter(object => object.part === 'arms').at(-1).m.slice(12, 15);
  scene.build(500);
  const end = scene.objects.filter(object => object.part === 'arms').at(-1).m.slice(12, 15);
  assert.ok(Math.hypot(...start.map((value, i) => value - end[i])) > 0.006);
});

test('the sword stays above the floor throughout the idle loop', () => {
  const scene = makeScene();
  for (let ms = 0; ms <= 3000; ms += 125) {
    scene.build(ms);
    const blade = scene.objects.filter(object => object.part === 'arms').at(-1);
    assert.ok(lowestPoint(blade) >= -0.005, `blade below floor at ${ms} ms`);
  }
});

test('walking keeps the support foot near the floor', () => {
  const scene = makeScene();
  const world = scene.world();
  world.pose.walk = 1;
  const samples = [];
  for (let phase = 0; phase < Math.PI * 2; phase += 0.25) {
    world.phase = phase;
    scene.build(1000);
    const [support] = lowestLegPoints(scene);
    samples.push([Number(phase.toFixed(2)), Number(support.toFixed(3))]);
  }
  assert.ok(samples.every(([, support]) => support >= -0.01 && support <= 0.04), `support heights ${JSON.stringify(samples)}`);
});

test('the sword swing remains above the ground', () => {
  const scene = makeScene();
  const world = scene.world();
  world.pose.attack = 1;
  const samples = [];
  for (let time = 0; time <= 1.1; time += 0.05) {
    world.montageTime = time;
    scene.build(time * 1000);
    const blade = scene.objects.filter(object => object.part === 'arms').at(-1);
    samples.push(Number(lowestPoint(blade).toFixed(3)));
  }
  assert.ok(samples.every(y => y >= -0.005), `blade heights ${JSON.stringify(samples)}`);
});

test('the straight held sword clears the floor through both walking strides', () => {
  const scene = makeScene();
  const world = scene.world();
  world.pose.walk = 1;
  for (let phase = 0; phase <= Math.PI * 2; phase += .1) {
    world.phase = phase;
    scene.build(1000);
    const blade = scene.objects.filter(object => object.part === 'arms').at(-1);
    assert.ok(lowestPoint(blade) > .01, `blade touches floor at phase ${phase.toFixed(2)}`);
  }
});

test('the attack carries the blade outside the face while the hand follows its arc', () => {
  const scene = makeScene();
  const world = scene.world();
  world.pose.attack = 1;
  const handHeights = [];
  for (let time = 0; time <= 1.1; time += .025) {
    world.montageTime = time;
    scene.build(time * 1000);
    const blade = scene.objects.filter(object => object.part === 'arms').at(-1);
    const face = scene.points.head;
    const m = blade.m, data = blade.geom.data;
    let separation = Infinity;
    for (let i = 0; i < data.length; i += 6) {
      const p = [m[0]*data[i]+m[4]*data[i+1]+m[8]*data[i+2]+m[12],m[1]*data[i]+m[5]*data[i+1]+m[9]*data[i+2]+m[13],m[2]*data[i]+m[6]*data[i+1]+m[10]*data[i+2]+m[14]];
      separation = Math.min(separation, Math.hypot(...p.map((v, j) => v - face[j])));
    }
    assert.ok(separation > .15, `blade too close to face at ${time.toFixed(3)} s: ${separation.toFixed(3)} m`);
    if (time >= .18 && time <= .4) {
      assert.ok(scene.rig.sword.grip[12] > face[0] + .25, `windup grip crosses the face at ${time.toFixed(3)} s`);
      const grip = scene.rig.sword.grip;
      const screenRight = Math.cos(.53) * (grip[12] - face[0]) - Math.sin(.53) * (grip[14] - face[2]);
      assert.ok(screenRight > .14, `windup projects over the face at ${time.toFixed(3)} s: ${screenRight.toFixed(3)} m`);
    }
    handHeights.push(position(scene.rig.arms[1].hand)[1]);
  }
  assert.ok(Math.max(...handHeights) - Math.min(...handHeights) > .35, 'sword hand needs a visible attack arc');
});

test('idle animation follows simulation time so pause freezes the pose', () => {
  let simTime = 0;
  const scene = makeScene(() => simTime);
  scene.build(0);
  const pose = () => scene.objects.filter(object => object.part === 'arms').at(-1).m.slice(12, 15);
  const start = pose();
  scene.build(1000);
  assert.deepEqual(pose(), start);
  simTime = 0.5;
  scene.build(1000);
  assert.ok(Math.hypot(...pose().map((value, i) => value - start[i])) > 0.006);
});
