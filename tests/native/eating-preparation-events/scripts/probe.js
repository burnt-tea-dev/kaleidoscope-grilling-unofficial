import {EquipmentSlot, GameMode, ItemStack, system, world} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';

const TAG = '[Grilling preparation-events probe]';
const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
const emit = row => console.warn(TAG + ' ' + JSON.stringify(row));
const events = [];
let player, phase = 'setup';
for (const name of ['playerInventoryItemChange', 'playerHotbarSelectedSlotChange']) {
  const signal = world.afterEvents[name];
  if (!signal) { emit({kind: 'missing_event', name}); continue; }
  signal.subscribe(event => {
    if (event.player.id !== player?.id) return;
    const row = {name, phase, tick: system.currentTick, slot: event.slot,
      inventoryType: event.inventoryType, previousSlot: event.previousSlotSelected,
      selectedSlot: event.newSlotSelected, item: event.itemStack?.typeId,
      before: event.beforeItemStack?.typeId};
    events.push(row);
    emit({kind: 'event', ...row});
  });
}

system.run(async () => {
  try {
    const dimension = world.getDimension('overworld');
    let loaded = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { loaded = Boolean(dimension.getBlock({x: 2, y: 79, z: 66})); } catch {}
      if (loaded) break;
      await wait(5);
    }
    if (!loaded) throw Error('Probe chunk unavailable');
    player = spawnSimulatedPlayer({dimension, x: 2.5, y: 80, z: 66.5}, 'PreparationProbe', GameMode.Survival);
    const inventory = player.getComponent('minecraft:inventory').container;
    const equipment = player.getComponent('minecraft:equippable');
    const rows = [];
    const observe = async (name, action, readback) => {
      phase = name;
      const offset = events.length;
      action();
      await wait(5);
      rows.push({phase: name, state: readback(), events: events.slice(offset)});
    };
    await observe('main_inventory', () => inventory.setItem(0, new ItemStack('minecraft:apple', 2)), () => inventory.getItem(0)?.amount);
    inventory.setItem(1, new ItemStack('minecraft:apple', 3));
    await wait(5);
    await observe('hotbar_selection', () => { player.selectedSlotIndex = 1; }, () => player.selectedSlotIndex);
    await observe('main_metadata', () => {
      const stack = inventory.getItem(1); stack.nameTag = 'Native metadata control'; inventory.setItem(1, stack);
    }, () => inventory.getItem(1)?.nameTag);
    await observe('offhand_equipment', () => equipment.setEquipment(EquipmentSlot.Offhand, new ItemStack('minecraft:shield')),
      () => equipment.getEquipment(EquipmentSlot.Offhand)?.typeId);
    await observe('offhand_metadata', () => {
      const stack = equipment.getEquipment(EquipmentSlot.Offhand); stack.nameTag = 'Offhand metadata control'; equipment.setEquipment(EquipmentSlot.Offhand, stack);
    }, () => equipment.getEquipment(EquipmentSlot.Offhand)?.nameTag);
    emit({kind: 'result', ok: true, rows, client: false,
      scope: 'Actual API mutations and observed native events; no rendered inventory or human-input proof'});
  } catch (error) { emit({kind: 'result', ok: false, reason: String(error), client: false}); }
  finally { try { player?.disconnect(); } catch {} }
});
