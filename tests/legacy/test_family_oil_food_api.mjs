import test from 'node:test';
import assert from 'node:assert/strict';
import {registerSecretIngredientBehavior,applySecretBehaviorExtension,resetSecretCompatRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';

test('custom food inherits all containers, effects and chili damage without duplicating base effects',()=>{
 resetSecretCompatRegistry();assert(registerSecretIngredientBehavior({input:'qa:food',behavior:{mode:'replace',effects:[{effect:'speed',ticks:200}],convertTo:'minecraft:bowl',remainders:[{id:'minecraft:flower_pot',count:1},{id:'minecraft:blue_ice',count:1}],damage:2}}));
 const b=applySecretBehaviorExtension({effects:[{effect:'speed',ticks:200}]},{id:'qa:food'});assert.equal(b.effects.length,1);assert.equal(b.remainders.length,2);assert.equal(b.convertTo,'minecraft:bowl');assert.equal(b.damage,2);
});
