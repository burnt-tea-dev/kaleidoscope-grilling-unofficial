/** New scalar/source checks only; no Minecraft player or client certification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {flatulenceSoundOrigin,flatulenceSoundPitch} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/flatulence_sound_runtime.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/java-flatulence-sound-160.json',import.meta.url),'utf8'));
const bits=value=>{const b=new ArrayBuffer(4),v=new DataView(b);v.setFloat32(0,value);return v.getUint32(0).toString(16).padStart(8,'0')};

test('actual sound origin uses all three block centers for fractional, negative and integer locations',()=>{
 const cases=[
  [{x:1.2,y:80.1,z:-0.2},{x:1.5,y:80.5,z:-0.5}],
  [{x:-1.01,y:-0.2,z:-3.9},{x:-1.5,y:-0.5,z:-3.5}],
  [{x:0,y:80,z:-2},{x:0.5,y:80.5,z:-1.5}]
 ];
 for(const [location,expected] of cases){const actual=flatulenceSoundOrigin({location});assert.deepEqual(actual,expected);assert.notEqual(actual,location)}
});

test('origin takes one actual location snapshot without querying or changing particle/gameplay state',()=>{
 let reads=0;const location={x:-0.01,y:70.99,z:5.01};
 const entity={get location(){reads++;return location},get dimension(){throw Error('No sound command here')},applyImpulse(){throw Error('No movement here')},getDynamicProperty(){throw Error('No effect query here')}};
 const origin=flatulenceSoundOrigin(entity);location.x=10;
 assert.equal(reads,1);assert.deepEqual(origin,{x:-0.5,y:70.5,z:5.5});
});

test('unreadable/nonfinite/out-of-BlockPos coordinates do not fabricate a sound position',()=>{
 for(const location of [undefined,{x:NaN,y:1,z:2},{x:1,y:Infinity,z:2},{x:1,y:2,z:'3'},{x:2147483648,y:0,z:0},{x:0,y:-2147483648.1,z:0}])assert.equal(flatulenceSoundOrigin({location}),undefined);
 assert.equal(flatulenceSoundOrigin({get location(){throw Error('Removed entity')}}),undefined);
});

test('actual pitch matches independent Java scalar bits, including the final-round-only counterexample',()=>{
 for(const oracle of fixture.pitch_oracle.cases){let draws=0;const pitch=flatulenceSoundPitch(()=>{draws++;return oracle.draw});assert.equal(draws,1);assert.equal(pitch,oracle.pitch);assert.equal(bits(pitch),oracle.float_bits)}
 const oracle=fixture.pitch_oracle.cases.find(x=>x.draw===0.1),actual=flatulenceSoundPitch(()=>oracle.draw);
 assert.notEqual(actual,0.8+oracle.draw*0.4);assert.equal(Math.fround(0.8+oracle.draw*0.4),oracle.final_round_only_pitch);assert.notEqual(actual,oracle.final_round_only_pitch);
 assert.equal(flatulenceSoundPitch(()=>1-2**-25),1.2000000476837158);
});

test('invalid or unavailable random input takes at most one draw and never substitutes another sample',()=>{
 for(const draw of [-0.1,1,NaN,Infinity,'0.5',undefined]){let count=0;assert.equal(flatulenceSoundPitch(()=>{count++;return draw}),undefined);assert.equal(count,1)}
 let count=0;assert.equal(flatulenceSoundPitch(()=>{count++;throw Error('Unavailable generator')}),undefined);assert.equal(count,1);assert.equal(flatulenceSoundPitch(null),undefined);
});
