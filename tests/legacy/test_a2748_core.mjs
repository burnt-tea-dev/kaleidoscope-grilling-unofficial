import assert from 'node:assert/strict';
import {
 LEAF_DECAY_DISTANCE,STING_INTERVAL_TICKS,
 shouldFruitPepperLeaf,treeLeafStartsFruiting,harvestedPepperCount,
 saplingBonemealSucceeds,saplingRandomTickSucceeds,nextSaplingAction,pepperTreeHeight,
 pepperLogAxis,pepperLeafBreakPlan,pepperTreePlan
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2748_pepper_tree_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java growth constants and chances',()=>{
 assert.equal(LEAF_DECAY_DISTANCE,6);
 assert.equal(STING_INTERVAL_TICKS,20);
 assert.equal(shouldFruitPepperLeaf(0.049),true);
 assert.equal(shouldFruitPepperLeaf(0.05),false);
 assert.equal(treeLeafStartsFruiting(0.249),true);
 assert.equal(treeLeafStartsFruiting(0.25),false);
 assert.equal(saplingBonemealSucceeds(0.449),true);
 assert.equal(saplingBonemealSucceeds(0.45),false);
});

t('sapling is two-stage and random growth requires light 9',()=>{
 assert.equal(nextSaplingAction(0),'advance');
 assert.equal(nextSaplingAction(1),'grow');
 assert.equal(saplingRandomTickSucceeds(8,0),false);
 assert.equal(saplingRandomTickSucceeds(9,0),true);
 assert.equal(saplingRandomTickSucceeds(9,0.2),false);
});

t('tree height is Java 2 or 3',()=>{
 assert.equal(pepperTreeHeight(0),2);
 assert.equal(pepperTreeHeight(0.499),2);
 assert.equal(pepperTreeHeight(0.5),3);
 assert.equal(pepperTreeHeight(0.999),3);
});

t('harvest gives one or two pepper',()=>{
 assert.equal(harvestedPepperCount(0),1);
 assert.equal(harvestedPepperCount(.499),1);
 assert.equal(harvestedPepperCount(.5),2);
});

t('log face maps to vanilla pillar axis for stripping',()=>{
 assert.equal(pepperLogAxis('up'),'y');
 assert.equal(pepperLogAxis('down'),'y');
 assert.equal(pepperLogAxis('east'),'x');
 assert.equal(pepperLogAxis('west'),'x');
 assert.equal(pepperLogAxis('north'),'z');
 assert.equal(pepperLogAxis('south'),'z');
});

t('leaf break plan follows Java shears/silk and fortune chances',()=>{
 assert.deepEqual(pepperLeafBreakPlan({shears:true,hasPepper:true}),{leaves:1,saplings:0,sticks:0,pepper:1});
 assert.deepEqual(pepperLeafBreakPlan({silkTouch:true}),{leaves:1,saplings:0,sticks:0,pepper:0});
 const plain=pepperLeafBreakPlan({fortune:0,saplingRandom:.099,stickRandom:.019,hasPepper:true});
 assert.deepEqual(plain,{leaves:0,saplings:1,sticks:1,pepper:1});
 const f3=pepperLeafBreakPlan({fortune:3,saplingRandom:.199,stickRandom:.032});
 assert.deepEqual(f3,{leaves:0,saplings:1,sticks:1,pepper:0});
});

t('tree plan has Java trunk and crown anchors',()=>{
 const p=pepperTreePlan(2,Array(100).fill(0));
 assert.equal(p.logs.length,3);
 assert.deepEqual(p.logs,[{x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:2,z:0}]);
 for(const key of ['0,3,0','-1,3,0','1,3,0','0,3,-1','0,3,1'])
  assert.equal(p.leaves.some(x=>[x.x,x.y,x.z].join(',')===key),true,key);
 assert.equal(p.leaves.every(x=>x.hasPepper),true);
});

console.log('A2.7.48 Pepper Tree core: '+n+'/'+n);
