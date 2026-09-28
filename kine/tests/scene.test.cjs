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
