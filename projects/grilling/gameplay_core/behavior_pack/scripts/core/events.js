import {world,system} from '@minecraft/server';
import {blockEvents,playerCraftRecipeEvents,scriptEvents} from '../host_api/event_router.js';

const blocks=blockEvents(world);
export const onBlockInteraction=blocks.interact;
export const onBeforeBlockBreak=blocks.beforeBreak;
export const onAfterBlockBreak=blocks.afterBreak;
export const onExplosion=blocks.explosion;
export const onScriptEvent=scriptEvents(system);
export const onPlayerCraftRecipe=playerCraftRecipeEvents(world);
