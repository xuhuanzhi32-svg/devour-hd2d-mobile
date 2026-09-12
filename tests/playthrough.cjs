// Public API driver. No health, level, unlock, position or reward injection.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]),c=vm.createContext({window:{__HD2D_MODULES:{}},console});
for(const n of ['progression','journey','game','navigation'])vm.runInContext(scripts.find(s=>s.startsWith('window.__HD2D_MODULES["'+n+'"]')),c);
const {Game}=c.window.__HD2D_MODULES.game,{navigate}=c.window.__HD2D_MODULES.navigation,values=new Map(),g=new Game({storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),priority=['power','fang','regen','feast','hunter','vitality','armor','maw','pulse','haste','critical','scavenger','ultimate','speed','magnet','meal'];
function run(options){
 assert.ok(g.start(options));let route=[],targetId='',planned=-1;let attacks=0;
 for(let i=0;i<30*1200;i++){
  const s=g.state,h=s.hero;if(['victory','dead'].includes(s.mode))break;
  if(s.mode==='upgrade'){const scores=s.upgradeChoices.map(u=>priority.indexOf(u.id));g.chooseUpgrade(scores.indexOf(Math.min(...scores)));continue;}
  if(s.mode==='event'){g.chooseExpedition(g.getExpedition().choices.findIndex(c=>c.available));continue;}
  if(g.interact())continue;
  const foes=s.enemies.filter(e=>!e.dead),near=foes.filter(e=>d(h,e)<4+e.r),closest=foes.sort((a,b)=>d(a,h)-d(b,h))[0];
  if(closest&&d(h,closest)<2.6){g.aim(closest.x,closest.z);if(g.attack())attacks++;}
  if(s.mode!=='playing')continue;if(near.length)g.skill('pulse');if(s.mode!=='playing')continue;
  if(h.ultimate>=100&&(near.some(e=>e.boss)||near.length>=3||h.hp<h.maxHp*.4))g.skill('ultimate');if(s.mode!=='playing')continue;
  let target=s.portal.active?{...s.portal,id:'portal'+s.zone}:s.objectives.landmarks<s.objectives.targetLandmarks?s.landmarks.filter(l=>!l.found).sort((a,b)=>d(a,h)-d(b,h))[0]:foes.find(e=>e.boss)||closest;
  if(!target)target={x:0,z:0,id:'center'};
  if(target.id!==targetId||s.time-planned>.4){route=navigate(h,target,h.r);targetId=target.id;planned=s.time;}
  while(route.length&&d(h,route[0])<.3)route.shift();const next=route[0]||target;
  let x=next.x-h.x,z=next.z-h.z;
  const warning=s.effects.find(e=>e.type==='telegraph'&&!e.fired&&!e.action&&e.delay-e.age<.6&&d(e,h)<e.radius+h.r+.5);
  if(warning){x=h.x-warning.x;z=h.z-warning.z;if(Math.hypot(x,z)<.1)x=1;}
  const n=Math.hypot(x,z);g.update(1/30,n>.01?{x:x/n,z:z/n}:{x:0,z:0});
 }
 const s=g.state,record={...options,result:s.mode,seconds:+s.time.toFixed(2),zones:s.stats.zonesCleared,hp:+s.hero.hp.toFixed(2),propsBroken:s.stats.propsBroken||0,maxChain:s.stats.maxChain||0,attacks};
 console.log(JSON.stringify(record));assert.equal(s.mode,'victory');return record;
}
const results=[run({difficulty:'story',seed:420})];assert.ok(g.canStartTrial());
results.push(run({journey:'trial',difficulty:'story',origin:'fangborn',seed:420}));
fs.mkdirSync(path.join(__dirname,'../qa'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../qa/playthrough-v070.json'),JSON.stringify({kind:'public-api-accelerated-simulation',noStateInjection:true,notBrowserPlaythrough:true,results},null,2)+'\n');
