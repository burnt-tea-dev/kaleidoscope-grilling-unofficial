import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../native/heavy-metal/absorption-ledger-probe.js', import.meta.url), 'utf8');

test('absorption ledger probe observes effect, before-hurt and after-hurt without taking ownership', () => {
  assert.match(source, /world\.afterEvents\.effectAdd\.subscribe/);
  assert.match(source, /world\.beforeEvents\.entityHurt\.subscribe/);
  assert.match(source, /world\.afterEvents\.entityHurt\.subscribe/);
  assert.match(source, /world\.afterEvents\.entityDie\.subscribe/);
  assert.doesNotMatch(source, /event\.cancel\s*=/);
  assert.doesNotMatch(source, /handleHeavyMetalBeforeHurt/);
  assert.doesNotMatch(source, /HEAVY_METAL_CLAIM_KEY|heavy_metal_poisoning/);
});

test('probe distinguishes fresh, spent, re-applied, resistance and external-health cases', () => {
  for (const name of ['fresh_absorption', 'spent_absorption', 'effect_reapply', 'armor_resistance', 'external_health_change', 'simulated_player']) {
    assert.ok(source.includes(name), 'missing diagnostic case: ' + name);
  }
  assert.match(source, /overkillAmbiguous/);
  assert.match(source, /candidateRemaining/);
  assert.match(source, /observedHealthDelta/);
  assert.match(source, /productionHandlerImported:false/);
  assert.match(source, /eventCancellation:false/);
});
