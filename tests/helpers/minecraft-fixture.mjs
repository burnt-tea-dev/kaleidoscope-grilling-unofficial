/**
 * Small native-ESM Bedrock boundary for behavior scenarios.
 * Production modules execute unchanged, including all transitive subscribers.
 * This models deterministic server-visible state, not a native client or BDS.
 */
import {register} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readdirSync, readFileSync} from 'node:fs';

register('./minecraft-loader.mjs', import.meta.url);
const scripts = new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/', import.meta.url);
const registryKey = Symbol.for('grilling.test.minecraft.fixtures');
const registry = globalThis[registryKey] ??= new Map();
let nextFixture = 1;
const logging = new AsyncLocalStorage();
for (const level of ['log', 'warn', 'error', 'info', 'debug']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    const fixture = logging.getStore();
    if (fixture) fixture.logs.push({level, args, text: args.map(String).join(' ')});
    else original(...args);
  };
}
const copy = value => value === undefined ? undefined : structuredClone(value);
const positionKey = ({x, y, z}) => [Math.floor(x), Math.floor(y), Math.floor(z)].join(',');
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const rawText = value => typeof value === 'string' ? value : value?.text ?? value?.rawtext?.map(rawText).join('') ?? value?.translate ?? '';
const definitions = new Map();
const itemRoot = new URL('../../projects/grilling/gameplay_core/behavior_pack/items/', import.meta.url);
function readItems(dir) {
  for (const row of readdirSync(dir, {withFileTypes: true})) {
    const path = new URL(row.name + (row.isDirectory() ? '/' : ''), dir);
    if (row.isDirectory()) readItems(path);
    else if (row.name.endsWith('.json')) {
      const item = JSON.parse(readFileSync(path, 'utf8'))['minecraft:item'];
      if (item) definitions.set(item.description.identifier, item.components ?? {});
    }
  }
}
readItems(itemRoot);
const blockDomains = new Map(), blockDefinitions = new Map();
const traitDomains = {
  'minecraft:cardinal_direction': ['north', 'south', 'east', 'west'],
  'minecraft:facing_direction': ['down', 'up', 'north', 'south', 'west', 'east'],
  'minecraft:block_face': ['down', 'up', 'north', 'south', 'west', 'east'],
  'minecraft:vertical_half': ['bottom', 'top'],
};
function readBlocks(dir) {
  for (const row of readdirSync(dir, {withFileTypes: true})) {
    const path = new URL(row.name + (row.isDirectory() ? '/' : ''), dir);
    if (row.isDirectory()) readBlocks(path);
    else if (row.name.endsWith('.json')) {
      const definition = JSON.parse(readFileSync(path, 'utf8'))['minecraft:block'];
      const description = definition?.description;
      if (!description) continue;
      const domains = {...description.states};
      for (const trait of Object.values(description.traits ?? {})) {
        for (const name of trait.enabled_states ?? []) {
          if (!traitDomains[name]) throw new Error(`Unmodeled canonical block trait: ${name}`);
          domains[name] = traitDomains[name];
        }
      }
      blockDomains.set(description.identifier, domains);
      blockDefinitions.set(description.identifier, definition);
    }
  }
}
readBlocks(new URL('../../projects/grilling/gameplay_core/behavior_pack/blocks/', import.meta.url));
function validateStates(typeId, states) {
  const domains = blockDomains.get(typeId);
  const result = domains ? Object.fromEntries(Object.entries(domains).map(([name, values]) => [name, values[0]])) : {};
  for (const [name, value] of Object.entries(states)) {
    // Owned blocks are exact. Vanilla/foreign schemas are external to this BP;
    // only their shared trait domains are checked instead of inventing a registry.
    const allowed = domains ? domains[name] : traitDomains[name];
    if (domains && !allowed) throw new Error(`Unknown state ${name} for ${typeId}`);
    if (allowed && !allowed.includes(value)) throw new Error(`Invalid state ${name}=${JSON.stringify(value)} for ${typeId}`);
    result[name] = copy(value);
  }
  return result;
}

export function createFixture(options = {}) {
  const id = String(nextFixture++);
  let nextEntity = 1, nextJob = 1;
  const jobs = new Map(), dimensions = new Map(), entities = new Map(), namedTicks = new Map();
  const f = {
    id, logs: [], drops: [], sounds: [], particles: [], messages: [], effects: [],
    scriptEvents: [], commandCalls: [], writes: [], subscribers: new Map(),
    blockComponents: new Map(), itemComponents: new Map(), commands: new Map(),
    players: [],
  };
  const execute = callback => logging.run(f, callback);
  const faults = [];
  f.faults = {
    failNext(target, method, {phase = 'before', predicate = () => true, times = 1, error = new Error(`Injected ${method} ${phase}-write failure`)} = {}) {
      if (!['before', 'after'].includes(phase)) throw new Error('Fault phase must be before or after');
      if (typeof target[method] !== 'function') throw new Error(`No method ${method} on fault target`);
      const rule = {target, method, phase, predicate, times, error};
      faults.push(rule);
      return rule;
    },
    clear() { faults.length = 0; },
    get pending() { return [...faults]; },
  };
  function fault(target, method, phase, args) {
    const rule = faults.find(row => row.target === target && row.method === method && row.phase === phase && row.predicate(...args));
    if (!rule) return;
    if (--rule.times <= 0) faults.splice(faults.indexOf(rule), 1);
    throw rule.error;
  }
  function operation(target, method, args, body) {
    fault(target, method, 'before', args);
    const result = body();
    f.writes.push({target, method, args});
    fault(target, method, 'after', args);
    return result;
  }
  function dynamic(target, initial = {}) {
    const values = new Map(initial instanceof Map ? initial : Object.entries(initial));
    target.dynamicProperties = values;
    target.getDynamicProperty = key => {fault(target, 'getDynamicProperty', 'before', [key]); return copy(values.get(key));};
    target.getDynamicPropertyIds = () => [...values.keys()];
    target.getDynamicPropertyTotalByteCount = () => JSON.stringify([...values]).length;
    target.setDynamicProperty = (key, value) => operation(target, 'setDynamicProperty', [key, value], () => {
      if (value === undefined) values.delete(key); else values.set(key, copy(value));
    });
    target.clearDynamicProperties = () => operation(target, 'clearDynamicProperties', [], () => values.clear());
    for (const name of ['getDynamicProperty', 'getDynamicPropertyIds', 'getDynamicPropertyTotalByteCount', 'setDynamicProperty', 'clearDynamicProperties']) {
      Object.defineProperty(target, name, {enumerable: false});
    }
    return target;
  }
  const EquipmentSlot = Object.freeze({Mainhand: 'Mainhand', Offhand: 'Offhand', Head: 'Head', Chest: 'Chest', Legs: 'Legs', Feet: 'Feet'});
  const GameMode = Object.freeze({Survival: 'Survival', Creative: 'Creative', Adventure: 'Adventure', Spectator: 'Spectator'});
  const ItemComponentTypes = Object.freeze({Durability: 'minecraft:durability', Enchantable: 'minecraft:enchantable', Food: 'minecraft:food'});
  class EnchantmentType { constructor(id) { this.id = id; } }
  class ItemStack {
    constructor(type, amount = 1) {
      this.typeId = typeof type === 'string' ? type : type.id;
      this.type = {id: this.typeId};
      const components = options.itemDefinitions?.[this.typeId] ?? definitions.get(this.typeId) ?? {};
      // Public host tool identities are accepted by the rack; their host pack is not part of this repository.
      const hostTool = /^kaleidoscope_cookery:(?:(?:iron|gold|diamond|netherite)_kitchen_knife|kitchen_shovel)$/.test(this.typeId);
      const stack = components['minecraft:max_stack_size'];
      this.maxAmount = typeof stack === 'number' ? stack : stack?.value ?? (hostTool ? 1 : /(_sword|_axe|_pickaxe|_shovel|_hoe|_helmet|_chestplate|_leggings|_boots|_bucket)$|:(bow|crossbow|shield|shears|flint_and_steel|fishing_rod|trident)$/.test(this.typeId) ? 1 : 64);
      if (this.typeId === 'minecraft:bucket') this.maxAmount = 16;
      this.amount = amount;
      this.nameTag = undefined; this.keepOnDeath = false; this.lockMode = 'none';
      this.localizationKey = `item.${this.typeId.replace(':', '.')}.name`;
      this.tags = new Set(components['minecraft:tags']?.tags ?? []);
      this.rawLore = []; this.canDestroy = []; this.canPlaceOn = []; this.components = {};
      this._enchantments = [];
      const durable = components['minecraft:durability'];
      if (durable || this.maxAmount === 1) this.components['minecraft:durability'] = {damage: 0, maxDurability: durable?.max_durability ?? 1561};
      const food = components['minecraft:food'];
      if (food) this.components['minecraft:food'] = {nutrition: food.nutrition, saturationModifier: food.saturation_modifier, canAlwaysEat: food.can_always_eat};
      dynamic(this);
      const setProperty = this.setDynamicProperty;
      this.setDynamicProperty = (key, value) => {
        if (this.maxAmount > 1) throw new Error('Native dynamic properties require an unstackable ItemStack');
        return setProperty(key, value);
      };
    }
    clone() {
      const out = new ItemStack(this.typeId, this.amount);
      for (const key of ['maxAmount', 'nameTag', 'keepOnDeath', 'lockMode', 'localizationKey']) out[key] = this[key];
      out.tags = new Set(this.tags); out.rawLore = copy(this.rawLore);
      out.canDestroy = [...this.canDestroy]; out.canPlaceOn = [...this.canPlaceOn];
      out.components = copy(this.components); out._enchantments = copy(this._enchantments);
      for (const [key, value] of this.dynamicProperties) out.dynamicProperties.set(key, copy(value));
      return out;
    }
    getLore() { return this.rawLore.map(rawText); }
    getRawLore() { return copy(this.rawLore); }
    setLore(value = []) { return operation(this, 'setLore', [value], () => {this.rawLore = copy(value);}); }
    getTags() { return [...this.tags]; }
    hasTag(tag) { return this.tags.has(tag); }
    getCanDestroy() { return [...this.canDestroy]; }
    getCanPlaceOn() { return [...this.canPlaceOn]; }
    setCanDestroy(value) { this.canDestroy = [...value]; }
    setCanPlaceOn(value) { this.canPlaceOn = [...value]; }
    getComponent(id) {
      id = id.includes(':') ? id : `minecraft:${id}`;
      if (id === 'minecraft:enchantable') return {
        getEnchantments: () => copy(this._enchantments),
        getEnchantment: type => copy(this._enchantments.find(e => e.type.id === (type.id ?? type))),
        hasEnchantment: type => this._enchantments.some(e => e.type.id === (type.id ?? type)),
        removeAllEnchantments: () => {this._enchantments = [];},
        addEnchantments: rows => {this._enchantments.push(...copy(rows));},
        addEnchantment: row => {this._enchantments.push(copy(row));},
      };
      return this.components[id];
    }
    getComponents() { return Object.values(this.components); }
    isStackableWith(other) {
      if (!other || this.typeId !== other.typeId || this.maxAmount <= 1) return false;
      const snapshot = s => JSON.stringify({name: s.nameTag, lore: s.rawLore, props: [...s.dynamicProperties].sort(), keep: s.keepOnDeath, lock: s.lockMode, destroy: s.canDestroy, place: s.canPlaceOn, components: s.components, enchantments: s._enchantments});
      return snapshot(this) === snapshot(other);
    }
  }
  function container(size = 36) {
    const slots = Array(size).fill(undefined);
    const c = {
      size, isValid: true,
      get emptySlotsCount() {return slots.filter(s => !s).length;},
      getItem(slot) {fault(c, 'getItem', 'before', [slot]); return slots[slot]?.clone();},
      setItem(slot, stack) {return operation(c, 'setItem', [slot, stack], () => {
        if (!Number.isInteger(slot) || slot < 0 || slot >= size) throw new Error('Invalid inventory slot');
        slots[slot] = stack?.clone();
      });},
      getSlot(slot) {return {getItem: () => c.getItem(slot), setItem: stack => c.setItem(slot, stack), get hasItem() {return !!slots[slot];}};},
      addItem(stack) {
        const rest = stack.clone();
        for (let slot = 0; slot < size && rest.amount > 0; slot++) {
          const old = c.getItem(slot);
          if (!old || !old.isStackableWith(rest)) continue;
          const count = Math.min(old.maxAmount - old.amount, rest.amount);
          if (count > 0) {old.amount += count; rest.amount -= count; c.setItem(slot, old);}
        }
        for (let slot = 0; slot < size && rest.amount > 0; slot++) if (!c.getItem(slot)) {
          const part = rest.clone(); part.amount = Math.min(rest.maxAmount, rest.amount);
          rest.amount -= part.amount; c.setItem(slot, part);
        }
        return rest.amount > 0 ? rest : undefined;
      },
      clearAll() {for (let i = 0; i < size; i++) c.setItem(i, undefined);},
      items() {return slots.map(s => s?.clone());},
    };
    return c;
  }
  class BlockPermutation {
    constructor(typeId, states = {}) {this.type = {id: typeId}; this.states = validateStates(typeId, states);}
    static resolve(typeId, states = {}) {return new BlockPermutation(typeId, states);}
    getState(name) {return this.states[name];}
    getAllStates() {return copy(this.states);}
    withState(name, value) {return new BlockPermutation(this.type.id, {...this.states, [name]: value});}
    matches(typeId, states = {}) {return this.type.id === typeId && Object.entries(states).every(([key, value]) => this.states[key] === value);}
    getTags() {return [];}
    hasTag() {return false;}
    getItemStack(amount = 1) {return new ItemStack(this.type.id, amount);}
  }
  function eventGroup(prefix) {
    return new Proxy({}, {get(target, event) {
      if (typeof event !== 'string') return target[event];
      if (!target[event]) {
        const callbacks = [];
        f.subscribers.set(`${prefix}.${event}`, callbacks);
        target[event] = {subscribe(callback) {callbacks.push(callback); return callback;}, unsubscribe(callback) {const at = callbacks.indexOf(callback); if (at >= 0) callbacks.splice(at, 1);}};
      }
      return target[event];
    }});
  }
  const system = {
    currentTick: options.currentTick ?? 0,
    beforeEvents: eventGroup('system.beforeEvents'), afterEvents: eventGroup('system.afterEvents'),
    run(callback) {const job = nextJob++; jobs.set(job, {callback, tick: system.currentTick + 1}); return job;},
    runTimeout(callback, delay = 1) {const job = nextJob++; jobs.set(job, {callback, tick: system.currentTick + Math.max(1, Math.floor(delay))}); return job;},
    runInterval(callback, delay = 1) {const job = nextJob++; const interval = Math.max(1, Math.floor(delay)); jobs.set(job, {callback, interval, tick: system.currentTick + interval}); return job;},
    clearRun(job) {jobs.delete(job);},
    runJob(generator) {const advance = () => {if (!generator.next().done) system.run(advance);}; return system.run(advance);},
    clearJob(job) {jobs.delete(job);},
    sendScriptEvent(id, message) {f.scriptEvents.push({id, message});},
  };
  const world = dynamic({
    beforeEvents: eventGroup('world.beforeEvents'), afterEvents: eventGroup('world.afterEvents'),
    getPlayers(query = {}) {return f.players.filter(p => p.isValid && (!query.name || p.name === query.name));},
    getAllPlayers() {return this.getPlayers();},
    getEntity(id) {const entity = entities.get(id); return entity?.isValid ? entity : undefined;},
    getDimension(id) {return getDimension(id);},
    getAbsoluteTime() {return (options.absoluteTime ?? 0) + system.currentTick;},
    getTimeOfDay() {return this.getAbsoluteTime() % 24000;},
    sendMessage(message) {f.messages.push({source: world, message});},
    playSound(sound, location, options) {f.sounds.push({source: world, sound, location, options});},
  }, options.dynamicProperties ?? options.worldProperties ?? {});
  function entity(typeId, location, dimension) {
    const nativeEffects = new Map();
    const effectId = effect => {const value = typeof effect === 'string' ? effect : effect.id; return value.includes(':') ? value : `minecraft:${value}`;};
    const e = dynamic({id: `fixture-${id}-entity-${nextEntity++}`, typeId, location: copy(location), dimension, isValid: true, properties: {}, tags: new Set(), components: {},
      getComponent(name) {
        fault(e, 'getComponent', 'before', [name]);
        const component = e.components[name.includes(':') ? name : `minecraft:${name}`];
        fault(e, 'getComponent', 'after', [name]);return component;
      },
      getTags() {return [...e.tags];}, hasTag(tag) {return e.tags.has(tag);}, addTag(tag) {e.tags.add(tag);return true;}, removeTag(tag) {return e.tags.delete(tag);},
      setProperty(key, value) {return operation(e, 'setProperty', [key, value], () => {e.properties[key] = copy(value);});},
      getProperty(key) {return copy(e.properties[key]);},
      remove() {return operation(e, 'remove', [], () => {e.isValid = false;});},
      kill() {return e.remove();},
      teleport(location, opts = {}) {e.location = copy(location);if (opts.dimension) e.dimension = opts.dimension;},
      tryTeleport(location, opts) {e.teleport(location, opts);return true;},
      triggerEvent(event) {(e.triggeredEvents ??= []).push(event);},
      getRotation() {return e.rotation ?? {x: 0, y: 0};}, setRotation(value) {e.rotation = copy(value);},
      getVelocity() {return {x: 0, y: 0, z: 0};}, clearVelocity() {}, applyImpulse() {},
      runCommand(command) {f.commandCalls.push({source: e, command});return {successCount: 1};},
      sendMessage(message) {f.messages.push({source: e, message});},
      playSound(sound, opts) {f.sounds.push({source: e, sound, options: opts});},
      addEffect(effect, duration, opts = {}) {return operation(e, 'addEffect', [effect, duration, opts], () => {
        const typeId = effectId(effect);
        nativeEffects.set(typeId, {typeId, until: system.currentTick + duration, amplifier: opts.amplifier ?? 0});
        f.effects.push({source: e, effect, duration, options: opts});
        return e.getEffect(typeId);
      });},
      getEffect(effect) {
        const typeId = effectId(effect), row = nativeEffects.get(typeId);
        if (!row || row.until <= system.currentTick) {nativeEffects.delete(typeId);return undefined;}
        return {typeId, duration: row.until - system.currentTick, amplifier: row.amplifier};
      },
      getEffects() {return [...nativeEffects.keys()].map(typeId => e.getEffect(typeId)).filter(Boolean);},
      removeEffect(effect) {return operation(e, 'removeEffect', [effect], () => nativeEffects.delete(effectId(effect)));},
    });
    entities.set(e.id, e);
    return e;
  }
  function getDimension(name = 'overworld') {
    const dimId = name.includes(':') ? name : `minecraft:${name}`;
    if (dimensions.has(dimId)) return dimensions.get(dimId);
    const blocks = new Map();
    const dimension = {
      id: dimId, blocks,
      getBlock(location) {
        const key = positionKey(location);
        if (!blocks.has(key)) block('minecraft:air', {x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z)}, {dimension});
        return blocks.get(key);
      },
      getEntities(query = {}) {
        return [...entities.values()].filter(e => e.isValid && e.dimension === dimension && (!query.type || e.typeId === query.type) && (!query.location || query.maxDistance === undefined || distance(e.location, query.location) <= query.maxDistance) && (!query.tags || query.tags.every(tag => e.hasTag(tag))));
      },
      getPlayers(query = {}) {return dimension.getEntities({...query, type: 'minecraft:player'});},
      spawnItem(stack, location) {return operation(dimension, 'spawnItem', [stack, location], () => {
        const drop = entity('minecraft:item', location, dimension); drop.itemStack = stack.clone(); drop.stack = drop.itemStack;
        drop.components['minecraft:item'] = {itemStack: drop.itemStack.clone()};
        f.drops.push(drop); return drop;
      });},
      spawnEntity(typeId, location) {return operation(dimension, 'spawnEntity', [typeId, location], () => {
        const e = entity(typeId, location, dimension);
        const size = {'kaleidoscope_grilling:inventory_rack_v1': 9, 'kaleidoscope_grilling:inventory_grill_v1': 3, 'kaleidoscope_grilling:inventory_seasoning_v1': 4}[typeId];
        if (size) e.components['minecraft:inventory'] = {container: container(size)};
        return e;
      });},
      spawnParticle(particle, location, variables) {f.particles.push({dimension, particle, location: copy(location), variables});},
      playSound(sound, location, opts) {f.sounds.push({source: dimension, sound, location: copy(location), options: opts});},
      runCommand(command) {f.commandCalls.push({source: dimension, command});return {successCount: 1};},
    };
    dimensions.set(dimId, dimension);return dimension;
  }
  function block(typeId, location = {x: 0, y: 0, z: 0}, opts = {}) {
    const dimension = typeof opts.dimension === 'string' ? getDimension(opts.dimension) : opts.dimension ?? f.dimension;
    const scheduled = new Map();
    const b = {dimension, location: copy(location), ...location, permutation: BlockPermutation.resolve(typeId, opts.states), isValid: true,
      get typeId() {return b.permutation.type.id;},
      get type() {return b.permutation.type;},
      get isAir() {return b.typeId === 'minecraft:air';},
      get isLiquid() {return ['minecraft:water', 'minecraft:lava'].includes(b.typeId);},
            setPermutation(permutation) {return operation(b, 'setPermutation', [permutation], () => {if(b.typeId!==permutation.type.id)scheduled.clear();b.permutation = permutation;});},
      setType(type) {return operation(b, 'setType', [type], () => {const next=typeof type === 'string' ? type : type.id;if(b.typeId!==next)scheduled.clear();b.permutation = BlockPermutation.resolve(next);});},
      getComponent(name) {return ['minecraft:inventory', 'inventory'].includes(name) && b.inventory ? {container: b.inventory} : undefined;},
      hasScheduledNamedTick(name) {return scheduled.has(name);},
      scheduleNamedTick(name, delay) {
        if(typeof name!=='string'||!name.length||name.length>31||!Number.isInteger(delay)||delay<1)throw Error('Invalid named tick');
        if(!scheduled.has(name)&&scheduled.size>=4)throw Error('Named tick capacity');
        // This fixture has one script owner. Foreign events are tested directly.
        if(!scheduled.has(name))scheduled.set(name, delay);
      },
      removeScheduledNamedTicks(name) {if(name===undefined)scheduled.clear();else scheduled.delete(name);},
      getTags() {return opts.tags ?? [];}, hasTag(tag) {return b.getTags().includes(tag);},
      offset(delta) {return dimension.getBlock({x: b.x + delta.x, y: b.y + delta.y, z: b.z + delta.z});},
      above(n = 1) {return b.offset({x: 0, y: n, z: 0});}, below(n = 1) {return b.offset({x: 0, y: -n, z: 0});},
      north(n = 1) {return b.offset({x: 0, y: 0, z: -n});}, south(n = 1) {return b.offset({x: 0, y: 0, z: n});},
      east(n = 1) {return b.offset({x: n, y: 0, z: 0});}, west(n = 1) {return b.offset({x: -n, y: 0, z: 0});},
      center() {return {x: b.x + .5, y: b.y + .5, z: b.z + .5};},
      bottomCenter() {return {x: b.x + .5, y: b.y, z: b.z + .5};},
    };
    const size = opts.inventorySize ?? (typeId === 'kaleidoscope_grilling:advanced_rack_block' ? 9 : undefined);
    if (size) b.inventory = container(size);
    dimension.blocks.set(positionKey(location), b); namedTicks.set(b,scheduled); return b;
  }
  function player(opts = {}) {
    const dimension = typeof opts.dimension === 'string' ? getDimension(opts.dimension) : opts.dimension ?? f.dimension;
    const p = entity('minecraft:player', opts.location ?? {x: 0, y: 0, z: 2}, dimension);
    if (opts.id) {entities.delete(p.id);p.id = opts.id;entities.set(p.id, p);}
    p.name = opts.name ?? p.id; p.selectedSlotIndex = opts.selectedSlotIndex ?? 0;
    p.isSneaking = opts.isSneaking ?? false; p.gameMode = opts.gameMode ?? GameMode.Survival;
    p.inventory = container(opts.inventorySize ?? 36);
    const equipment = new Map();
    p.equipment = {
      getEquipment(slot) {return (slot === EquipmentSlot.Mainhand ? p.inventory.getItem(p.selectedSlotIndex) : equipment.get(slot)?.clone());},
      setEquipment(slot, stack) {return operation(p.equipment, 'setEquipment', [slot, stack], () => {
        if (slot === EquipmentSlot.Mainhand) p.inventory.setItem(p.selectedSlotIndex, stack);
        else if (stack) equipment.set(slot, stack.clone()); else equipment.delete(slot);
        return true;
      });},
    };
    p.components['minecraft:inventory'] = {container: p.inventory};
    p.components['minecraft:equippable'] = p.equipment;
    p.components['minecraft:health'] = {currentValue: 20, defaultValue: 20, effectiveMax: 20, setCurrentValue(value) {this.currentValue = value;}};
    p.getGameMode = () => p.gameMode;
    p.getHeadLocation = () => p.headLocation ?? {x: p.location.x, y: p.location.y + 1.62, z: p.location.z};
    p.getViewDirection = () => p.viewDirection ?? {x: 0, y: 0, z: -1};
    p.getBlockFromViewDirection = () => p.viewBlock;
    p.getEntitiesFromViewDirection = () => p.viewEntities ?? [];
    p.onScreenDisplay = {setActionBar(message) {f.messages.push({source: p, message, actionBar: true});}, setTitle(message) {f.messages.push({source: p, message, title: true});}};
    Object.defineProperties(p, {
      main: {get() {return p.inventory.getItem(p.selectedSlotIndex);}, set(stack) {p.inventory.setItem(p.selectedSlotIndex, stack);}},
      off: {get() {return p.equipment.getEquipment(EquipmentSlot.Offhand);}, set(stack) {p.equipment.setEquipment(EquipmentSlot.Offhand, stack);}},
    });
    if (opts.main) p.main = opts.main;
    if (opts.off) p.off = opts.off;
    f.players.push(p);return p;
  }
  class MolangVariableMap {
    constructor() {this.values = {};}
    setFloat(key, value) {this.values[key] = value;}
    setColorRGBA(key, value) {this.values[key] = copy(value);}
    setColorRGB(key, value) {this.values[key] = copy(value);}
    setVector3(key, value) {this.values[key] = copy(value);}
  }
  const enumValues = names => Object.freeze(Object.fromEntries(names.map(name => [name, name])));
  f.server = {
    world, system, ItemStack, BlockPermutation, EquipmentSlot, GameMode, ItemComponentTypes, EnchantmentType, MolangVariableMap,
    EntityComponentTypes: {Inventory: 'minecraft:inventory', Equippable: 'minecraft:equippable', Health: 'minecraft:health', Item: 'minecraft:item'},
    CommandPermissionLevel: enumValues(['Any', 'GameDirectors', 'Admin', 'Host', 'Owner']),
    CustomCommandParamType: enumValues(['String', 'Integer', 'Float', 'Boolean', 'PlayerSelector', 'EntitySelector', 'Position', 'Enum']),
    CustomCommandStatus: {Success: 0, Failure: 1},
    Direction: enumValues(['Up', 'Down', 'North', 'South', 'East', 'West']),
    ItemLockMode: {none: 'none', slot: 'slot', inventory: 'inventory'},
    ItemTypes: {get: id => ({id})}, BlockTypes: {get: id => ({id})},
  };
  Object.assign(f, {dp: world.dynamicProperties, world, system, ItemStack, BlockPermutation, EquipmentSlot, GameMode, container, block, player, getDimension});
  f.dimension = getDimension(options.dimension ?? 'overworld');
  f.item = (typeId, amount = 1, metadata = {}) => {
    const item = new ItemStack(typeId, amount);
    for (const key of ['maxAmount', 'nameTag', 'keepOnDeath', 'lockMode']) if (key in metadata) item[key] = metadata[key];
    if (metadata.tags) item.tags = new Set(metadata.tags);
    if (metadata.lore || metadata.rawLore) item.setLore(metadata.rawLore ?? metadata.lore);
    if (metadata.canDestroy) item.setCanDestroy(metadata.canDestroy);
    if (metadata.canPlaceOn) item.setCanPlaceOn(metadata.canPlaceOn);
    if (metadata.components) Object.assign(item.components, copy(metadata.components));
    if (metadata.damage !== undefined) item.getComponent('minecraft:durability').damage = metadata.damage;
    if (metadata.enchantments) item.getComponent('minecraft:enchantable').addEnchantments(metadata.enchantments.map(e => ({type: new EnchantmentType(e.id ?? e.type.id), level: e.level})));
    for (const [key, value] of Object.entries(metadata.dynamicProperties ?? {})) item.setDynamicProperty(key, value);
    return item;
  };
  f.load = async name => {
    const url = new URL(name, scripts);
    if (!url.href.startsWith(scripts.href)) throw new Error('Fixture can only import canonical runtime modules');
    url.searchParams.set('fixture', id);
    return execute(() => import(url.href));
  };
  f.emit = (name, event = {}) => execute(() => {
    for (const callback of [...(f.subscribers.get(name) ?? [])]) callback(event);
    return event;
  });
  f.startup = () => f.emit('system.beforeEvents.startup', {
    blockComponentRegistry: {registerCustomComponent(name, component) {f.blockComponents.set(name, component);}},
    itemComponentRegistry: {registerCustomComponent(name, component) {f.itemComponents.set(name, component);}},
    customCommandRegistry: {registerCommand(definition, callback) {f.commands.set(definition.name, {definition, callback});}, registerEnum() {}},
  });
  f.command = (name, origin, ...args) => execute(() => {
    const command = f.commands.get(name);if (!command) throw new Error(`Unregistered command: ${name}`);
    return command.callback(origin, ...args);
  });
  f.component = (name, callback, event) => execute(() => {
    const component = f.blockComponents.get(name);if (!component?.[callback]) throw new Error(`Missing component callback: ${name}.${callback}`);
    return component[callback](event);
  });
  f.tick = (count = 1) => execute(() => {
    let ran = 0;
    for (let step = 0; step < count; step++) {
      system.currentTick++;
      // Only a loaded, still-owned block advances. Native named ticks are not
      // wall-clock timers; unloaded blocks retain their remaining loaded ticks.
      for(const [block,scheduled] of namedTicks){
        if(block.dimension.blocks.get(positionKey(block.location))!==block){namedTicks.delete(block);continue;}
        let current;try{current=block.dimension.getBlock(block.location)}catch{continue;}
        if(current!==block)continue;
        const expired=[];
        for(const [name,remaining] of scheduled){
          if(remaining<=1){scheduled.delete(name);expired.push(name)}else scheduled.set(name,remaining-1);
        }
        for(const name of expired){
          const components=blockDefinitions.get(block.typeId)?.components??{};
          for(const component of Object.keys(components)){
            const callback=f.blockComponents.get(component)?.onNamedTick;
            if(callback){callback({block,dimension:block.dimension,name,isMine:()=>true});ran++;}
          }
        }
      }
      const due = [...jobs].filter(([, job]) => job.tick <= system.currentTick).sort(([a], [b]) => a - b);
      for (const [id, job] of due) {
        if (!jobs.has(id)) continue;
        if (job.interval) job.tick = system.currentTick + job.interval; else jobs.delete(id);
        job.callback(); ran++;
      }
    }
    return ran;
  });
  f.flush = (ticks = 1) => f.tick(ticks);
  f.pendingJobs = () => [...jobs].map(([id, job]) => ({id, tick: job.tick, interval: job.interval}));
  f.snapshotProperties = () => Object.fromEntries([...world.dynamicProperties].map(([key, value]) => [key, copy(value)]));
  f.dispose = () => {jobs.clear();namedTicks.clear();registry.delete(id);};
  registry.set(id, f);
  return f;
}
