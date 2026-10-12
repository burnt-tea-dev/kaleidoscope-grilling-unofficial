"""Reverse only the reviewed G130 display hooks for the immutable dispatcher witness.

The runtime is never modified here. Returned authoring text retains these hooks;
normalization is used only before the unchanged whole-G126-source hash check.
"""
import hashlib

HUD_BASE_SHA256 = '84d0f1d892aebf036a7166f86a0303f57044eed9de68bbdf8ee78c477298ac3c'
HUD_AFTER_SHA256 = '27f03b18ce1cca46603ce390e7cb44762b27e3e1adea4b9a833001120b509c1e'
HUD_DISPLAY_DELTA = (("import {showJavaEatingHud} from './java_eating_hud_runtime.js';\n", "import {showJavaEatingHud,hideJavaEatingHud,forgetJavaEatingHud} from './java_eating_hud_runtime.js';\n"), (' stopEatSound(e.source,a.profile);SETTLED.set(e.source.id,system.currentTick);ACTIVE_EATS.delete(e.source.id);forgetEatingItem(e.source.id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{}\n', ' stopEatSound(e.source,a.profile);SETTLED.set(e.source.id,system.currentTick);ACTIVE_EATS.delete(e.source.id);hideJavaEatingHud(e.source);forgetEatingItem(e.source.id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{}\n'), (" const settleReleased=()=>{if(ACTIVE_EATS.get(id)!==a)return;ACTIVE_EATS.delete(id);forgetEatingItem(id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{};if(!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a))SETTLED.set(id,system.currentTick);if(a.id===SECRET_ID)try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held release] '+error)}};\n", " const settleReleased=()=>{if(ACTIVE_EATS.get(id)!==a)return;ACTIVE_EATS.delete(id);hideJavaEatingHud(e.source);forgetEatingItem(id);try{e.source.setProperty(EAT_PROFILE_PROPERTY,0);e.source.setProperty(EAT_HAND_PROPERTY,0);e.source.setProperty(EAT_PROJECTION_PROPERTY,false);e.source.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.source.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)}catch{};if(!a.plain&&e.itemStack&&used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a))SETTLED.set(id,system.currentTick);if(a.id===SECRET_ID)try{syncSecretHeld(e.source)}catch(error){console.warn('[Grilling held release] '+error)}};\n"), ('world.afterEvents.playerLeave.subscribe(e=>{forgetProjectileDodge(e.playerId);forgetHeavyMetalRescue(e.playerId);forgetEatingItem(e.playerId);stopSoundHandle(PENDING_USES.get(e.playerId)?.audio);stopSoundHandle(ACTIVE_EATS.get(e.playerId)?.audio);for(const map of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED])map.delete(e.playerId)});\n', 'world.afterEvents.playerLeave.subscribe(e=>{forgetJavaEatingHud(e.playerId);forgetProjectileDodge(e.playerId);forgetHeavyMetalRescue(e.playerId);forgetEatingItem(e.playerId);stopSoundHandle(PENDING_USES.get(e.playerId)?.audio);stopSoundHandle(ACTIVE_EATS.get(e.playerId)?.audio);for(const map of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED])map.delete(e.playerId)});\n'), ('world.afterEvents.playerSpawn.subscribe(e=>{forgetProjectileDodge(e.player);try{e.player.setProperty(EAT_PROJECTION_PROPERTY,false);e.player.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.player.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{};if(!e.initialSpawn){forgetHeavyMetalRescue(e.player.id);try{clearEffects(e.player)}catch{};stopSoundHandle(ACTIVE_EATS.get(e.player.id)?.audio);stopSoundHandle(PENDING_USES.get(e.player.id)?.audio);for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED,VIGOR_LAST,SNEAK_LAST])cache.delete(e.player.id);forgetNumbVisual(e.player.id);try{e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{}}});\n', 'world.afterEvents.playerSpawn.subscribe(e=>{hideJavaEatingHud(e.player);forgetProjectileDodge(e.player);try{e.player.setProperty(EAT_PROJECTION_PROPERTY,false);e.player.setProperty(EAT_NATIVE_TICKS_PROPERTY,0);e.player.setProperty(EAT_ELAPSED_TICKS_PROPERTY,0);e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{};if(!e.initialSpawn){forgetHeavyMetalRescue(e.player.id);try{clearEffects(e.player)}catch{};stopSoundHandle(ACTIVE_EATS.get(e.player.id)?.audio);stopSoundHandle(PENDING_USES.get(e.player.id)?.audio);for(const cache of [ACTIVE_EATS,CUISINE_EATS,PLATE_EATS,PENDING_USES,SETTLED,VIGOR_LAST,SNEAK_LAST])cache.delete(e.player.id);forgetNumbVisual(e.player.id);try{e.player.setProperty(EAT_PROFILE_PROPERTY,0);e.player.setProperty(EAT_HAND_PROPERTY,0)}catch{}}});\n'), ('   if(!active.plain&&!active.audioStarted&&(active.audioAttempts??0)<3&&system.currentTick%5===0)startEatingSound(p,active);!active.plain&&advanceBites(p,active);!active.plain&&grillingConfig().graphicalEatingHud&&showJavaEatingHud(p,active,system.currentTick);\n', '   if(!active.plain&&!active.audioStarted&&(active.audioAttempts??0)<3&&system.currentTick%5===0)startEatingSound(p,active);!active.plain&&advanceBites(p,active);if(!active.plain&&grillingConfig().graphicalEatingHud)showJavaEatingHud(p,active,system.currentTick);else hideJavaEatingHud(p);\n'), ('  }else if(active){\n', '  }else if(active){\n   hideJavaEatingHud(p);\n'), ('  } // Presentation never debits food.\n', '  }else hideJavaEatingHud(p); // Presentation never debits food.\n'))

def dispatcher_witness_source(text):
    marker = "import {showJavaEatingHud,hideJavaEatingHud,forgetJavaEatingHud}"
    if marker not in text:
        return text
    result = text
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
