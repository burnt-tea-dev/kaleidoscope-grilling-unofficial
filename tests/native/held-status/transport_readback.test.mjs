import test from 'node:test';
import assert from 'node:assert/strict';
import {writeHeldVisual,flushHeldVisual,FRAME_PROPERTY,HELD_VISUAL_PLATE} from '../../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';

test('real G206 transport cache is read into the published frame without item writes',()=>{
 const properties=new Map(),sent=[];
 const player={id:'qa-human',getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value),playAnimation:(name,options)=>sent.push({name,options})};
 const words=[101,202,303,404,505,606,707,808,909,1001,2,HELD_VISUAL_PLATE];
 assert.equal(writeHeldVisual(player,'off','plate',words),true);
 assert.equal(flushHeldVisual(player,42),true);
 assert.equal(properties.get(FRAME_PROPERTY),1);
 assert.equal(sent.length,1);
 const expression=sent[0].options.stopExpression;
 for(const [i,word] of words.entries())assert.match(expression,new RegExp('v\\.kg_held_o'+i+'='+word+';'));
 assert.equal(expression.includes('v.kg_held_m0=0;'),true);
 assert.equal(sent[0].name,'animation.kg_held_snapshot.carrier');
});
