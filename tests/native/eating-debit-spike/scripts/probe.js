import {GameMode, ItemStack, system, world} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';

const TAG = '[Grilling eating-debit probe]';
const ITEM = 'grilling_eating_probe:meal';
const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
const actors = new Map();
const events = [];
const emit = data => console.warn(TAG + ' ' + JSON.stringify(data));
const amount = player => player.getComponent('minecraft:inventory').container.getItem(0)?.amount ?? 0;

for (const name of ['itemStartUse', 'itemStopUse', 'itemCompleteUse']) {
  world.afterEvents[name].subscribe(event => {
    const actor = actors.get(event.source.id);
    if (!actor) return;
    const row = {kind: 'event', case: actor.name, event: name,
      elapsed: system.currentTick - actor.start, remaining: event.useDuration,
      amount: amount(event.source)};
    events.push(row);
    emit(row);
  });
}

system.run(async () => {
  const players = [];
  try {
    if (typeof gameTest.spawnSimulatedPlayer !== 'function') {
      emit({kind: 'result', ok: false, reason: 'standalone_simulated_player_unavailable', client: false});
      return;
    }
    const dimension = world.getDimension('overworld');
    let loaded = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { loaded = Boolean(dimension.getBlock({x: 1, y: 79, z: 65})); } catch {}
      if (loaded) break;
      await wait(5);
    }
    if (!loaded) throw Error('Isolated probe chunk unavailable');
    const cases = [
      {name: 'native_control', initial: 2, debit: null},
      {name: 'debit_90_stack_2', initial: 2, debit: 90},
      {name: 'debit_25_stack_2', initial: 2, debit: 25},
      {name: 'debit_90_stack_1', initial: 1, debit: 90},
    ];
    for (let index = 0; index < cases.length; index++) {
      // Keep every test block inside the single chunk whose load was observed.
      const actor = cases[index], x = 2 + index * 3;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        dimension.getBlock({x: x + dx, y: 79, z: 66 + dz}).setType('minecraft:stone');
        for (let dy = 80; dy <= 82; dy++) dimension.getBlock({x: x + dx, y: dy, z: 66 + dz}).setType('minecraft:air');
      }
      const player = gameTest.spawnSimulatedPlayer({dimension, x: x + .5, y: 80, z: 66.5}, 'EatingProbe' + index, GameMode.Survival);
      players.push(player);
      actor.player = player;
      player.getComponent('minecraft:inventory').container.setItem(0, new ItemStack(ITEM, actor.initial));
      player.selectedSlotIndex = 0;
      actor.start = system.currentTick;
      actors.set(player.id, actor);
      actor.useAccepted = player.useItemInSlot(0);
      emit({kind: 'start', case: actor.name, accepted: actor.useAccepted, initial: actor.initial});
    }
    for (let elapsed = 1; elapsed <= 135; elapsed++) {
      await wait(1);
      for (const actor of cases) {
        const actual = system.currentTick - actor.start;
        if (actor.debit !== null && actual >= actor.debit && !actor.debited) {
          const inventory = actor.player.getComponent('minecraft:inventory').container;
          const stack = inventory.getItem(0);
          actor.beforeDebit = stack?.amount ?? 0;
          if (!stack || stack.typeId !== ITEM) throw Error('Expected test meal before debit');
          if (stack.amount === 1) inventory.setItem(0);
          else { stack.amount--; inventory.setItem(0, stack); }
          actor.debited = true;
          emit({kind: 'script_debit', case: actor.name, elapsed: actual, before: actor.beforeDebit, after: amount(actor.player)});
        }
        if ([24, 25, 26, 89, 90, 91, 99, 100, 101, 120, 135].includes(actual)) {
          emit({kind: 'sample', case: actor.name, elapsed: actual, amount: amount(actor.player)});
        }
      }
    }
    const rows = cases.map(actor => ({name: actor.name, initial: actor.initial, debit: actor.debit,
      useAccepted: actor.useAccepted, beforeDebit: actor.beforeDebit, final: amount(actor.player),
      completions: events.filter(row => row.case === actor.name && row.event === 'itemCompleteUse').length}));
    const control = rows[0];
    const nativeControl = control.useAccepted && control.final === 1;
    const eventControl = control.completions === 1;
    const debitSafe = nativeControl && eventControl && rows.slice(1).every(row => row.useAccepted && row.beforeDebit === row.initial && row.final === row.initial - 1 && row.completions === 0);
    emit({kind: 'result', ok: true, nativeControl, eventControl, debitSafe, rows,
      scope: 'Engine capability only; simulated-player item events need a positive control', client: false});
  } catch (error) {
    emit({kind: 'result', ok: false, reason: String(error), client: false});
  } finally {
    for (const player of players) {
      try { player.stopUsingItem(); } catch {}
      try { player.disconnect(); } catch {}
    }
    actors.clear();
  }
});
