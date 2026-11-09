import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRoutePlayback, blendAngle } from '../js/route-playback.mjs';
const data=JSON.parse(readFileSync(new URL('../assets/dataset/route.json',import.meta.url)));
const playback=createRoutePlayback(data.route);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('metric route clamps to exact source endpoints',()=>{
 assert.deepEqual(playback.poseAt(-1),data.route[0]);
 assert.deepEqual(playback.poseAt(playback.length+10),data.route.at(-1));
 near(playback.length,27.2);
});
test('seeking covers start, midpoint and goal',()=>{
 for(const fraction of [0,.25,.5,.75,1])near(playback.at(playback.timeAt(fraction)).distance,playback.length*fraction);
});
test('robot holds at goal, reverses and loops continuously',()=>{
 near(playback.at(playback.leg+1).distance,playback.length);
 assert.equal(playback.at(playback.leg+1).turning,true);
 const returning=playback.at(playback.leg+4);
 assert.equal(returning.outbound,false);assert.ok(returning.distance<playback.length);
 near(playback.at(playback.duration).distance,0);
 for(const boundary of [playback.leg,playback.leg+3,playback.duration-3,playback.duration]){
  const a=playback.at(boundary-1e-5).heading,b=playback.at(boundary+1e-5).heading;
  assert.ok(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))<.01);
 }
});
test('angle interpolation takes the short path across ±180 degrees',()=>{
 near(blendAngle(179*Math.PI/180,-179*Math.PI/180,.5),Math.PI);
});
test('capture positions align with the metric route',()=>{
 for(let i=0;i<data.captures.length;i++){
  const p=playback.poseAt(Math.min(playback.length,i*data.capture_spacing_m));
  data.captures[i].forEach((v,k)=>near(p[k],v));
 }
});
