// Animated images: light detection (src/anim/analyse.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLights } from '../src/anim/analyse.js';

test('detectLights finds the hub, the city nodes and the stars on the SolwAI network map', async () => {
  const a = await detectLights('themes/solwai/public/img/hero-solway.jpg');
  assert.equal(a.width, 1920);
  assert.equal(a.height, 1080);
  assert.ok(a.lights.nodes.length >= 20 && a.lights.nodes.length <= 80, `nodes: ${a.lights.nodes.length}`);
  assert.ok(Math.hypot(a.lights.hub[0] - 1240, a.lights.hub[1] - 404) < 20, `hub: ${a.lights.hub}`);
  assert.equal(a.lights.stars.length, 700);
  // Nodes are sorted biggest first and kept apart.
  const [first, second] = a.lights.nodes;
  assert.ok(first[2] >= second[2]);
});
