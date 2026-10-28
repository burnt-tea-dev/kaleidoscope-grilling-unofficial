import {rackLocalHit,rackSlotAtLocalHit} from '../advanced_rack_layout.js';
// Hit positions are relative to the block's NW bottom. The renderer and meshes
// use the same fixed cell layout, including the fourth tool and empty cells.
export function rackSlotAtHit(direction,hit){
 return rackSlotAtLocalHit(rackLocalHit(direction,hit));
}
