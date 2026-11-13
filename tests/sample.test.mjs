import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,sampleWorkout} from '../sample.mjs';
import {program,totals} from '../functions/domain.mjs';
test('sample workspace starts with valid published prescriptions and completed records',()=>{
 const s=seed();assert.equal(s.relationships.length,3);assert.equal(s.scheduled.length,9);assert.equal(s.sessions.length,12);
 s.programs.forEach(p=>assert.doesNotThrow(()=>program(p)));
 s.sessions.forEach(w=>assert.ok(totals(w).volumeKg>0));
});
test('new sample workouts have unique stable exercise and set identifiers',()=>{
 const a=sampleWorkout(),b=sampleWorkout();assert.notEqual(a.id,b.id);
 const ids=[a,b].flatMap(w=>w.exercises.flatMap(e=>[e.id,...e.sets.map(s=>s.id)]));assert.equal(new Set(ids).size,ids.length);
});
test('sample sessions and assignment prescriptions do not share mutable set objects',()=>{
 const s=seed(), before=s.sessions[0].exercises[0].sets[0].weightKg;
 s.scheduled[0].workout.exercises[0].sets[0].weightKg=999;
 assert.equal(s.sessions[0].exercises[0].sets[0].weightKg,before);
});
