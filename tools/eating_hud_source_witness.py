"""Reverse only the reviewed G130/G141 HUD hooks for the immutable dispatcher witness.

The runtime is never modified here. Returned authoring text retains these hooks;
normalization is used only before the unchanged whole-G126-source hash check.
"""
import hashlib
from pathlib import Path
import subprocess

HUD_BASE_SHA256 = '84d0f1d892aebf036a7166f86a0303f57044eed9de68bbdf8ee78c477298ac3c'
HUD_AFTER_SHA256 = '27f03b18ce1cca46603ce390e7cb44762b27e3e1adea4b9a833001120b509c1e'
HUD_DISPLAY_DELTA = (("import {showJavaEatingHud} from './java_eating_hud_runtime.js';\n", "import {showJavaEatingHud,hideJavaEatingHud,forgetJavaEatingHud} from './java_eating_hud_runtime.js';\n"), (' stopEatSound(e.source,a.profile);SETTLED.set(e.source.id,system.currentTick);ACTIVE_EATS.delete(e.source.id);forgetEatingItem(e.source.id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{}\n', ' stopEatSound(e.source,a.profile);SETTLED.set(e.source.id,system.currentTick);ACTIVE_EATS.delete(e.source.id);hideJavaEatingHud(e.source);forgetEatingItem(e.source.id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{}\n'), (" const settleReleased=()=>{if(ACTIVE_EATS.get(id)!==a)return;ACTIVE_EATS.delete(id);forgetEatingItem(id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{};if(!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a))SETTLED.set(id,system.currentTick);if(a.id===SECRET_ID)try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held release] '+error)}};\n", " const settleReleased=()=>{if(ACTIVE_EATS.get(id)!==a)return;ACTIVE_EATS.delete(id);hideJavaEatingHud(e.source);forgetEatingItem(id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{};if(!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a))SETTLED.set(id,system.currentTick);if(a.id===SECRET_ID)try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held release] '+error)}};\n"), ('world.afterEvents.playerLeave.subscribe(e=>{forgetProjectileDodge(e.playerId);forgetHeavyMetalRescue(e.playerId);forgetEatingItem(e.playerId);stopSoundHandle(PENDING_USES.get(e.playerId)?.audio);stopSoundHandle(ACTIVE_EATS.get(e.playerId)?.audio);for(const map of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED])map.delete(e.playerId)});\n', 'world.afterEvents.playerLeave.subscribe(e=>{forgetJavaEatingHud(e.playerId);forgetProjectileDodge(e.playerId);forgetHeavyMetalRescue(e.playerId);forgetEatingItem(e.playerId);stopSoundHandle(PENDING_USES.get(e.playerId)?.audio);stopSoundHandle(ACTIVE_EATS.get(e.playerId)?.audio);for(const map of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED])map.delete(e.playerId)});\n'), ('world.afterEvents.playerSpawn.subscribe(e=>{forgetProjectileDodge(e.player);try{e.player.setProperty(EAT_PROJECTION_PROPERTY,false);e.player.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.player.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{};if(!e.initialSpawn){forgetHeavyMetalRescue(e.player.id);try{clearEffects(e.player)}catch{};stopSoundHandle(ACTIVE_EATS.get(e.player.id)?.audio);stopSoundHandle(PENDING_USES.get(e.player.id)?.audio);for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED,VIGOR_LAST,SNEAK_LAST])cache.delete(e.player.id);forgetNumbVisual(e.player.id);try{e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{}}});\n', 'world.afterEvents.playerSpawn.subscribe(e=>{hideJavaEatingHud(e.player);forgetProjectileDodge(e.player);try{e.player.setProperty(EAT_PROJECTION_PROPERTY,false);e.player.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.player.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{};if(!e.initialSpawn){forgetHeavyMetalRescue(e.player.id);try{clearEffects(e.player)}catch{};stopSoundHandle(ACTIVE_EATS.get(e.player.id)?.audio);stopSoundHandle(PENDING_USES.get(e.player.id)?.audio);for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED,VIGOR_LAST,SNEAK_LAST])cache.delete(e.player.id);forgetNumbVisual(e.player.id);try{e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{}}});\n'), ('   if(!active.plain&&!active.audioStarted&&(active.audioAttempts??0)<3&&system.currentTick%5===0)startEatingSound(p,active);!active.plain&&advanceBites(p,active);!active.plain&&grillingConfig().graphicalEatingHud&&showJavaEatingHud(p,active,system.currentTick);\n', '   if(!active.plain&&!active.audioStarted&&(active.audioAttempts??0)<3&&system.currentTick%5===0)startEatingSound(p,active);!active.plain&&advanceBites(p,active);if(!active.plain&&grillingConfig().graphicalEatingHud)showJavaEatingHud(p,active,system.currentTick);else hideJavaEatingHud(p);\n'), ('  }else if(active){\n', '  }else if(active){\n   hideJavaEatingHud(p);\n'), ('  } // Presentation never debits food.\n', '  }else hideJavaEatingHud(p); // Presentation never debits food.\n'))

HUD_START_SOURCE_BASE = '8fd01d5fdfe15aaeb9acf40b76832710728e6c2e'
HUD_START_AFTER_SHA256 = '057a7f4d34c8633798dc2c20dec30bb0cda80b0665c8facb0f55b456972170e6'
HUD_START_BEFORE = ' if(a.plain)return; // JSON owns 25-tick vanilla use; no custom motion, sound or HUD.\n'
HUD_START_AFTER = HUD_START_BEFORE + ' if(grillingConfig().graphicalEatingHud)showJavaEatingHud(e.source,a,system.currentTick);\n'
PREPARATION_BEFORE = "  try{prepareBottleFillItems(p,!!active||PENDING_USES.has(p.id));prepareEatingItems(p,!!active,grillingConfig().enableEatingAnimations)}catch(error){if(system.currentTick%20===0)console.warn('[Grilling native eating item] '+error)}\n"
PREPARATION_AFTER = "  try{prepareBottleFillItems(p,!!active||PENDING_USES.has(p.id))}catch(error){if(system.currentTick%20===0)console.warn('[Grilling native bottle item] '+error)}\n" + "  try{prepareEatingItems(p,!!active,grillingConfig().enableEatingAnimations)}catch(error){if(system.currentTick%20===0)console.warn('[Grilling native eating item] '+error)}\n"

def dispatcher_witness_source(text):
    from build_slime_frame_selector import strip_main
    text = strip_main(text)
    marker = "import {showJavaEatingHud,hideJavaEatingHud,forgetJavaEatingHud}"
    if marker not in text:
        return text
    from public_source_witness import performance_witness_source
    result = performance_witness_source(text)
    if PREPARATION_AFTER in result:
        if result.count(PREPARATION_AFTER) != 1:
            raise ValueError('Ambiguous independent eating preparation hooks')
        result = result.replace(PREPARATION_AFTER, PREPARATION_BEFORE, 1)
    if HUD_START_AFTER in result:
        if result.count(HUD_START_AFTER) != 1:
            raise ValueError('Ambiguous reviewed G141 start hook')
        result = result.replace(HUD_START_AFTER, HUD_START_BEFORE, 1)
    for before, after in HUD_DISPLAY_DELTA:
        if result.count(after) != 1:
            raise ValueError('Incomplete or ambiguous reviewed G130 display hooks')
        result = result.replace(after, before, 1)
    return result


def apply_hud_display_hooks(source):
    if hashlib.sha256(source).hexdigest() != HUD_BASE_SHA256:
        raise AssertionError('G130 display delta has the wrong public preimage')
    result = source.decode('utf-8')
    for before, after in HUD_DISPLAY_DELTA:
        if result.count(before) != 1:
            raise AssertionError('G130 display delta has an ambiguous public anchor')
        result = result.replace(before, after, 1)
    result = result.encode('utf-8')
    if hashlib.sha256(result).hexdigest() != HUD_AFTER_SHA256:
        raise AssertionError('G130 public source differs outside its reviewed display delta')
    return result


def apply_hud_start_hook(source):
    """Admit only the reviewed start-frame call over the whole G140 preimage."""
    if hashlib.sha256(source).hexdigest() != HUD_AFTER_SHA256:
        raise AssertionError('G141 start delta has the wrong public preimage')
    text = source.decode('utf-8')
    if text.count(HUD_START_BEFORE) != 1:
        raise AssertionError('G141 start delta has an ambiguous public anchor')
    result = text.replace(HUD_START_BEFORE, HUD_START_AFTER, 1).encode('utf-8')
    if hashlib.sha256(result).hexdigest() != HUD_START_AFTER_SHA256:
        raise AssertionError('G141 public source differs outside its reviewed start delta')
    root = Path(__file__).resolve().parents[1]
    reviewed = subprocess.check_output(['git', 'show', HUD_START_SOURCE_BASE + ':projects/grilling/gameplay_core/behavior_pack/scripts/main.js'], cwd=root)
    if result != reviewed:
        raise AssertionError('G141 start delta differs from its immutable reviewed source')
    return result
