import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomatedContentPackage } from '../src/utils/automatedContentPipeline.ts';
test('daily IST schedule and both YouTube formats are present',()=>{
 const p=buildAutomatedContentPackage({now:new Date('2026-11-16T03:30:00.000Z'),id:'fixture'});
 assert.deepEqual(p.schedule.times,['09:00','21:00']);
 assert.equal(p.schedule.timezone,'Asia/Kolkata');
 assert.deepEqual(p.schedule.cron,['0 9 * * *','0 21 * * *']);
 assert.equal(p.formats.short.format,'youtube_short');
 assert.equal(p.formats.long.format,'youtube_long');
 assert.equal(p.formats.long.targetDurationSeconds,900);
 assert.equal(p.formats.long.scenePrompts.length,15);
});
test('scene prompts require fact checks and original 3D cartoon visuals',()=>{
 const p=buildAutomatedContentPackage();
 assert.ok(p.formats.short.scenePrompts.every(s=>s.visualPrompt.includes('3D cartoon')&&s.narrationPrompt.includes('[EDITOR FACT CHECK]')));
 assert.ok(p.formats.long.scenePrompts.every(s=>s.visualPrompt.includes('3D cartoon')&&s.narrationPrompt.includes('[EDITOR FACT CHECK]')));
});
test('pipeline is draft-only and cannot call paid providers or publish',()=>{
 const p=buildAutomatedContentPackage();
 assert.equal(p.executionPolicy.mode,'draft_only');
 assert.equal(p.executionPolicy.paidProviderCallsAllowed,false);
 assert.equal(p.executionPolicy.publishAllowed,false);
 assert.equal(p.executionPolicy.requiresHumanApproval,true);
});
