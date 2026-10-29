import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
/** Owned, versioned reservation for one named Heavy Metal effect. This is a
 * persistence barrier, not a promise that Minecraft has flushed a world save.
 */
export const HEAVY_METAL_CLAIM_KEY=PersistedKey.HEAVY_METAL_CLAIM;
const validEffect=effect=>!!effect&&Number.isFinite(effect.until)&&Number.isInteger(effect.amp)&&effect.amp>=0;
export function parseHeavyMetalClaim(raw){
 if(raw===undefined)return undefined;
 if(typeof raw!=='string')throw Error('Heavy Metal claim state is unreadable');
 const claim=JSON.parse(raw);
 if(!claim||typeof claim!=='object'||Array.isArray(claim)||claim.version!==1||
  Object.keys(claim).length!==4||!validEffect(claim)||!Number.isFinite(claim.time)||claim.until<=claim.time)
  throw Error('Heavy Metal claim state is invalid');
 return claim;
}
export function heavyMetalClaimPayload(effect,time){
 if(!validEffect(effect)||!Number.isFinite(time)||effect.until<=time)
  throw Error('Heavy Metal claim requires an active finite effect');
 return JSON.stringify({version:1,until:effect.until,amp:effect.amp,time});
}
