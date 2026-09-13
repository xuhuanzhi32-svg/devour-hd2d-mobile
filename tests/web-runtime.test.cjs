const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const assetScripts=[...html.matchAll(/<script src="(assets\/embedded\/asset-[^"]+\.js)"><\/script>/g)].map(m=>m[1]);
const context=vm.createContext({window:{__HD2D_MODULES:{}},console});
for(const name of ['progression','journey','game','navigation'])vm.runInContext(scripts.find(s=>s.startsWith('window.__HD2D_MODULES["'+name+'"]')),context);
const {Game}=context.window.__HD2D_MODULES.game;
const clone=v=>JSON.parse(JSON.stringify(v));
function make(){const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};const g=new Game({storage});g.start({difficulty:'story'});return{g,storage};}
function settle(g){for(let i=0;g.state.mode==='upgrade'&&i<100;i++)g.chooseUpgrade(0);}
// Unit fixtures position actors to isolate distance, arc, save and reward boundaries.
test('published HTML parses all inline scripts and references every local PNG data chunk',()=>{
 assert.equal(scripts.length,18);for(const s of scripts)new vm.Script(s);
 assert.equal(assetScripts.length,30);
 assert.equal(new Set(assetScripts).size,30);
 for(const source of assetScripts){assert.ok(fs.existsSync(path.join(__dirname,'..',source)));assert.ok(fs.statSync(path.join(__dirname,'..',source)).size<1024*1024);}
 assert.doesNotMatch(html,/<script[^>]+type=["']module/);
 assert.doesNotMatch(html,/<script src="(?!assets\/embedded\/asset-)/);
 assert.match(html,/v0\.9\.1 WEB/);assert.match(html,/id="renderer-mode"/);
});
test('directional attack breaks supplies in its arc and grants only one persistent pickup',()=>{
 const {g,storage}=make(),p=g.state.props[0],h=g.state.hero;g.state.enemies=[];h.x=p.x;h.z=p.z+1;g.aim(p.x,p.z);
 for(let i=0;i<4&&!p.broken;i++){h.biteCooldown=0;g.attack();}assert.equal(p.broken,true);assert.equal(g.state.pickups.length,1);
 const n=g.state.pickups.length;h.biteCooldown=0;g.attack();assert.equal(g.state.pickups.length,n);
 const reload=new Game({storage});assert.ok(reload.resume());assert.equal(reload.state.props[0].broken,true);assert.equal(reload.state.pickups.length,1);
});
test('melee arc, distance and pause prevent accidental destruction; valid aim rejects nonfinite input',()=>{
 const {g}=make(),p=g.state.props[0],h=g.state.hero;g.state.enemies=[];h.x=p.x;h.z=p.z+1;g.aim(p.x,p.z+5);g.attack();assert.equal(p.hp,p.maxHp);
 h.biteCooldown=0;h.x=0;h.z=16;g.aim(p.x,p.z);g.attack();assert.equal(p.hp,p.maxHp);
 g.pause();const before=JSON.stringify(g.state);assert.equal(g.aim(p.x,p.z),false);assert.equal(g.attack(),false);assert.equal(JSON.stringify(g.state),before);
 g.unpause();assert.equal(g.aim(NaN,0),false);assert.equal(g.aim(0,Infinity),false);
});
test('pulse can destroy nearby supply and currency is only granted when actually collected',()=>{
 const {g}=make(),p=g.state.props.find(p=>p.kind==='essence'),h=g.state.hero;g.state.enemies=[];h.x=p.x;h.z=p.z+1;const before=g.meta.essence;
 g.skill('pulse');assert.equal(p.broken,true);assert.equal(g.meta.essence,before);
 const loot=g.state.pickups.find(p=>p.type==='essence');h.x=loot.x;h.z=loot.z;g.update(.05);assert.equal(g.meta.essence,before+1);g.update(.05);assert.equal(g.meta.essence,before+1);
});
test('pulse finishes supply damage when its enemy kill opens an upgrade',()=>{
 const {g}=make(),p=g.state.props[0],h=g.state.hero;g.state.enemies=[];h.x=p.x;h.z=p.z+1;h.xp=h.nextXp-1;
 const e=g._spawnEnemy('slime',false,{x:h.x,z:h.z});e.hp=1;g.skill('pulse');
 assert.equal(g.state.mode,'upgrade');assert.equal(p.broken,true);assert.equal(g.attack(),false);assert.equal(g.skill('pulse'),false);
});
test('perfect dodge rewards once inside the dash window and never converts ordinary invulnerability',()=>{
 const {g}=make(),h=g.state.hero;g.state.enemies=[];h.hp=h.maxHp;h.ultimate=0;h.invulnerable=0;g.state.cooldowns.pulse=4;
 assert.equal(g.skill('dash'),true);const hp=h.hp;assert.equal(g._hurt(25),false);assert.equal(h.hp,hp);assert.equal(h.ultimate,16);assert.equal(g.state.cooldowns.pulse,3);assert.equal(g.state.stats.perfectDodges,1);
 assert.equal(g._hurt(25),false);assert.equal(g.state.stats.perfectDodges,1);
 h.invulnerable=.5;g.state.cooldowns.dash=0;assert.equal(g.skill('dash'),true);assert.equal(h.dodgeReady,false);assert.equal(g._hurt(25),false);assert.equal(g.state.stats.perfectDodges,1);
 h.invulnerable=0;h.dodgeWindow=0;h.dodgeReady=false;assert.equal(g._hurt(25),true);assert.ok(h.hp<hp);assert.equal(g.state.stats.perfectDodges,1);
});
test('three boss perfect dodges open one 2.5 second break window and persist safely',()=>{
 const {g,storage}=make();g.state.enemies=[];g._spawnBoss();const boss=g.state.enemies[0],h=g.state.hero;h.ultimate=0;h.invulnerable=0;
 for(let i=0;i<3;i++){if(i===2){g._warning(h.x,h.z,2,1,30,{enemyId:boss.id});g._projectile(h.x-2,h.z,Math.PI/2,2,30,{enemyId:boss.id});}g.state.cooldowns.dash=0;h.invulnerable=0;assert.equal(g.skill('dash'),true);assert.equal(g._hurt(30,{enemyId:boss.id}),false);}
 assert.equal(boss.guard,3);assert.equal(boss.stagger,2.5);assert.equal(g.state.stats.bossBreaks,1);assert.equal(g.state.stats.perfectDodges,3);assert.equal(h.ultimate,48);
 assert.equal(g.state.effects.some(f=>f.type==='telegraph'&&f.enemyId===boss.id&&!f.fired),false);assert.equal(g.state.projectiles.some(p=>p.enemyId===boss.id),false);
 boss.hp=boss.maxHp=100;g._damageEnemy(boss,20,'bite');assert.equal(boss.hp,73);
 g.pause();const reload=new Game({storage});assert.ok(reload.resume());const savedBoss=reload.state.enemies.find(e=>e.boss);assert.equal(savedBoss.guard,3);assert.equal(savedBoss.stagger,2.5);
});
test('four-second chain grants capped extra energy from third kill; damage and expiration reset it',()=>{
 const {g}=make(),s=g.state,h=s.hero;s.enemies=[];h.nextXp=10000;h.ultimate=0;
 const kill=()=>{const e=g._spawnEnemy('slime',false,{x:0,z:5});g._devour(e);};
 kill();kill();const before=h.ultimate;kill();assert.equal(h.ultimate-before,5);assert.equal(s.chain.count,3);assert.equal(s.stats.maxChain,3);
 h.invulnerable=0;g._hurt(5);assert.equal(s.chain.count,0);kill();s.enemies=[];s.spawnTimer=1000;s.hunt.status='failed';s.environmentTimer=1000;
 for(let i=0;i<85;i++)g.update(.05);assert.equal(s.chain.count,0);assert.equal(s.chain.time,0);
});
test('damage numbers report applied damage, remain bounded, and pause freezes cosmetic time',()=>{
 const {g}=make();g.state.enemies=[];const e=g._spawnEnemy('knight',false,{x:0,z:5});e.hp=e.maxHp=10000;
 for(let i=0;i<220;i++)g._damageEnemy(e,1,'bite');assert.ok(g.state.effects.length<=180);
 assert.ok(g.state.effects.some(f=>f.type==='number'&&f.value===1));g.pause();const before=JSON.stringify(g.state.effects);g.update(.15);assert.equal(JSON.stringify(g.state.effects),before);
});
test('v0.6 save migrates new supplies once and preserves old stats and RNG ID allocation',()=>{
 const {g,storage}=make();g.pause();const raw=JSON.parse(storage.getItem('devourHD2D.v1'));delete raw.state.props;delete raw.state.chain;const id=raw.nextId;
 storage.setItem('devourHD2D.v1',JSON.stringify(raw));const reload=new Game({storage});assert.ok(reload.resume());assert.equal(reload.state.props.length,6);assert.equal(reload.nextId,id+6);
 assert.equal(reload.state.hero.hp,raw.state.hero.hp);reload.save();const again=new Game({storage});assert.ok(again.resume());assert.equal(again.nextId,reload.nextId);assert.deepEqual(clone(again.state.props),clone(reload.state.props));
});
test('older boss saves migrate dodge and guard state while corrupt combat fields are rejected',()=>{
 const {g,storage}=make();g.state.enemies=[];g._spawnBoss();g.pause();const raw=JSON.parse(storage.getItem('devourHD2D.v1')),boss=raw.state.enemies.find(e=>e.boss);
 delete raw.state.hero.dodgeWindow;delete raw.state.hero.dodgeReady;delete raw.state.stats.perfectDodges;delete raw.state.stats.bossBreaks;delete boss.guard;delete boss.stagger;
 storage.setItem('devourHD2D.v1',JSON.stringify(raw));const reload=new Game({storage});assert.ok(reload.resume());const migrated=reload.state.enemies.find(e=>e.boss);assert.equal(reload.state.hero.dodgeWindow,0);assert.equal(reload.state.hero.dodgeReady,false);assert.equal(migrated.guard,3);assert.equal(migrated.stagger,0);
 reload.pause();const corrupt=JSON.parse(storage.getItem('devourHD2D.v1'));corrupt.state.enemies.find(e=>e.boss).stagger=99;storage.setItem('devourHD2D.v1',JSON.stringify(corrupt));assert.equal(new Game({storage}).resume(),false);
});
test('corrupt supply state is rejected without overwriting the original save',()=>{
 for(const change of [p=>p.hp=-1,p=>p.kind='script',p=>p.broken=true,p=>p.x=Infinity]){
  const {storage}=make(),raw=JSON.parse(storage.getItem('devourHD2D.v1'));change(raw.state.props[0]);const str=JSON.stringify(raw);storage.setItem('devourHD2D.v1',str);
  const g=new Game({storage});assert.equal(g.resume(),false);g.setSettings({muted:true});assert.equal(storage.getItem('devourHD2D.v1'),str);
 }
});
test('trial and cleared portal save remain valid; new props do not respawn in boss trial',()=>{
 const {g,storage}=make();g.meta.chronicle.unlockedTrial=true;g.start({journey:'trial'});assert.equal(g.state.props.length,0);settle(g);
 g._devour(g.state.enemies.find(e=>e.boss));settle(g);for(let i=0;i<400;i++)g.update(.05);g.save();const reload=new Game({storage});assert.ok(reload.resume());assert.equal(reload.state.props.length,0);assert.ok(reload.state.portal.active);
});
test('Three.js supply visuals use shared real geometry, retain broken state and remove prior-zone meshes',()=>{
 for(const name of ['three','art','animation','renderer'])vm.runInContext(scripts.find(s=>s.startsWith('window.__HD2D_MODULES["'+name+'"]')),context);
 const T=context.window.__HD2D_MODULES.three,{WorldRenderer}=context.window.__HD2D_MODULES.renderer;
 const r=Object.create(WorldRenderer.prototype);r.materials=new Map();r.dynamic=new T.Group();r.geometries=new Map([['box',new T.BoxGeometry(1,1,1)],['cylinder',new T.CylinderGeometry(1,1,1,8)],['octa',new T.OctahedronGeometry(1)]]);
 const {g}=make();r.syncProps(g.state.props);assert.equal(r.dynamic.children.length,6);
 const first=r.propMeshes.get(g.state.props[0].id);assert.equal(first.children.length,4);assert.equal(first.children[0].geometry,r.geometries.get('box'));
 g.state.props[0].broken=true;r.syncProps(g.state.props);assert.equal(first.scale.y,.12);r.syncProps([]);assert.equal(r.dynamic.children.length,0);assert.equal(r.propMeshes.size,0);
});
test('Canvas compatibility renderer draws dimensional, zone-specific structures instead of flat house placeholders',()=>{
 const {CanvasFallbackRenderer}=context.window.__HD2D_MODULES.renderer,calls=[];
 const ctx=new Proxy({}, {get(target,key){if(!(key in target))target[key]=(...args)=>calls.push([key,...args]);return target[key];},set(target,key,value){target[key]=value;return true;}});
 const r=Object.create(CanvasFallbackRenderer.prototype);Object.assign(r,{ctx,scale:20,width:1280,height:720,cameraX:0,cameraZ:0,drawCalls:0});
 const palette={stone:0xa5a08b,plaster:0xd5bd8b,wood:0x665041,roof:0x555f5d,water:0x5e9d90,glow:0xffc571};
 for(let zone=0;zone<5;zone++)r.drawStructure(zone*2,zone,palette,zone,zone);
 assert.equal(r.drawCalls,5);assert.ok(calls.filter(c=>c[0]==='lineTo').length>30);assert.ok(calls.some(c=>c[0]==='quadraticCurveTo'));assert.ok(calls.some(c=>c[0]==='strokeRect'));assert.ok(calls.filter(c=>c[0]==='ellipse').length>=4);
});
test('WebGL architecture response opens real hinged doors nearby and keeps smoke bounded',()=>{
 const {WorldRenderer,architectureResponse}=context.window.__HD2D_MODULES.renderer;
 assert.equal(architectureResponse(0,2,.1,false)>0,true);assert.equal(architectureResponse(1,8,.1,false)<1,true);assert.equal(architectureResponse(0,2,.1,true),1);assert.equal(architectureResponse(1,8,.1,true),0);
 const door={type:'door',node:{rotation:{y:0}},x:0,z:0,openness:0,sign:1},smoke={type:'smoke',node:{position:{y:0},scale:{setScalar(v){this.value=v;}},material:{opacity:0}},baseY:4,phase:.2};
 const r=Object.create(WorldRenderer.prototype);Object.assign(r,{zone:0,time:2,options:{reducedMotion:false},zoneCache:new Map([[0,{userData:{architecture:[door,smoke]}}]])});r.updateArchitecture({x:0,z:0},.16);
 assert.ok(door.openness>0&&door.openness<=1);assert.ok(door.node.rotation.y>0);assert.ok(smoke.node.position.y>=4&&smoke.node.position.y<5.85);assert.ok(smoke.node.scale.value>=.34&&smoke.node.scale.value<=.8);assert.ok(smoke.node.material.opacity>=0&&smoke.node.material.opacity<=.19);
 assert.match(html,/house\(11,10,4\.55,4\.35,3\.05\)/);assert.match(html,/A real hinged door replaces the old facade decal/);
});
module.exports={Game,context,make,html,scripts};
