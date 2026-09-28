const test = require('node:test');
const assert = require('node:assert/strict');
const DM = require('../src/core.js');

test('shipped exercise graphs remain valid after import', () => {
  for (const id of ['first', 'walk', 'repair', 'light', 'door']) {
    assert.doesNotThrow(() => DM.validateGraph(DM.starter(id)), `${id} starter`);
    assert.doesNotThrow(() => DM.validateGraph(DM.solution(id)), `${id} solution`);
  }
});

test('the first solved lesson executes its visible print action', () => {
  const runtime = new DM.Runtime(DM.solution('first'));
  runtime.start();
  assert.equal(runtime.world.actions.find(action => action.type === 'print')?.text, 'Γεια σου, Άρη!');
});

test('the solved movement lesson moves forward and backward with input value', () => {
  const runtime = new DM.Runtime(DM.solution('walk'));
  runtime.start();
  runtime.frame(0.05, 1);
  assert.ok(runtime.world.x > -220);
  const afterForward = runtime.world.x;
  runtime.frame(0.05, -1);
  assert.ok(runtime.world.x < afterForward);
});

test('a graph import rejects incompatible pin types', () => {
  const graph = DM.starter('walk');
  graph.edges.push(DM.edge('a', 'value', 'c', 'direction'));
  assert.throws(() => DM.validateGraph(graph), /Ασυμβατότητα/);
});
