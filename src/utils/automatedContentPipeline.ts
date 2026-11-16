export type AutomatedContentPackage = {
  id: string;
  createdAt: string;
  timezone: 'Asia/Kolkata';
  schedule: { cron: string[]; times: ['09:00', '21:00']; timezone: 'Asia/Kolkata' };
  topic: 'Political News Funny / Satire';
  formats: {
    short: { format: 'youtube_short'; targetDurationSeconds: 55; aspectRatio: '9:16'; scriptPrompt: string; scenePrompts: Array<{scene:number;durationSeconds:number;visualPrompt:string;narrationPrompt:string}>; elevenLabsPayload: {voiceId:string;modelId:string;textTemplate:string;outputFormat:string} };
    long: { format: 'youtube_long'; targetDurationSeconds: 900; aspectRatio: '16:9'; sceneCount: 15; scriptPrompt: string; scenePrompts: Array<{scene:number;durationSeconds:number;visualPrompt:string;narrationPrompt:string}>; elevenLabsPayload: {voiceId:string;modelId:string;textTemplate:string;outputFormat:string} };
  };
  editorialSafety: { factCheckRequired: true; noFabricatedClaims: true; humanReviewRequired: true };
  executionPolicy: { mode:'draft_only'; paidProviderCallsAllowed:false; publishAllowed:false; requiresHumanApproval:true; safetyMustBeEnabled:true };
};
const shortScenes = ['Newsroom host introduces editor-verified headline','A giant stack of policy paperwork','Town-hall microphone with competing speech bubbles','Neutral cartoon parliament debates a calendar','Closing studio shot with source and correction reminder'];
const longScenes = [
'Fictional newsroom introduces verified headline and source','Map-and-timeline explains policy background','Cartoon civic office processes a tower of forms','Neutral town hall asks fair public questions','Visual explainer separates facts from claims','Committee charts explain policy mechanics','Satirical bureaucracy montage jokes about paperwork','Balanced panel presents public arguments on each side','Animated data board explains supplied evidence','Fact-check desk labels confirmed, disputed and unknown','Cartoon budget calculator explains trade-offs','Public-service queue illustrates implementation','Neutral recap revisits the original source','Media-literacy segment explains what to verify','Closing newsroom recap with sources and corrections'
];
export function buildAutomatedContentPackage(input: {now?:Date;topic?:string;id?:string} = {}): AutomatedContentPackage {
 const now=input.now ?? new Date();
 const topic=(input.topic || 'Political News Funny / Satire').trim().slice(0,180) || 'Political News Funny / Satire';
 const scenes=(list:string[],duration:number)=>list.map((visualPrompt,index)=>({
  scene:index+1,durationSeconds:duration,
  visualPrompt:'Original family-friendly 3D cartoon satire, fictional generic characters only, no real politician likeness or party logos. '+visualPrompt+'. Topic: '+topic+'. Do not depict unverified events as real.',
  narrationPrompt:'Write balanced, witty narration using only editor-verified facts. Cite supplied sources and mark missing evidence [EDITOR FACT CHECK].'
 }));
 return {
  id:input.id || 'content_'+now.getTime(),createdAt:now.toISOString(),timezone:'Asia/Kolkata',
  schedule:{cron:['0 9 * * *','0 21 * * *'],times:['09:00','21:00'],timezone:'Asia/Kolkata'},
  topic:'Political News Funny / Satire',
  formats:{
   short:{format:'youtube_short',targetDurationSeconds:55,aspectRatio:'9:16',scriptPrompt:'Create a 55-second non-partisan political satire Short on '+topic+'. Use a hook, verified context, gentle humour and a source-led closing. Never invent quotes, statistics, allegations or breaking news. Mark missing evidence [EDITOR FACT CHECK].',scenePrompts:scenes(shortScenes,11),elevenLabsPayload:{voiceId:'21m00Tcm4TlvDq8ikWAM',modelId:'eleven_multilingual_v2',textTemplate:'{{approved_short_script}}',outputFormat:'mp3_44100_128'}},
   long:{format:'youtube_long',targetDurationSeconds:900,aspectRatio:'16:9',sceneCount:15,scriptPrompt:'Create a complete 15-minute (about 1,650–1,900 spoken words) 3D cartoon satire episode on '+topic+' using 15 scenes of about 60 seconds. Separate facts, claims and commentary; cite editor-provided sources; never invent quotes, statistics, allegations or events; flag gaps [EDITOR FACT CHECK].',scenePrompts:scenes(longScenes,60),elevenLabsPayload:{voiceId:'21m00Tcm4TlvDq8ikWAM',modelId:'eleven_multilingual_v2',textTemplate:'{{approved_long_script_or_scene_narration}}',outputFormat:'mp3_44100_128'}}
  },
  editorialSafety:{factCheckRequired:true,noFabricatedClaims:true,humanReviewRequired:true},
  executionPolicy:{mode:'draft_only',paidProviderCallsAllowed:false,publishAllowed:false,requiresHumanApproval:true,safetyMustBeEnabled:true}
 };
}
