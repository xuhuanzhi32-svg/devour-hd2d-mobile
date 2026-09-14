const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function load(){const ctx=vm.createContext({window:{__HD2D_MODULES:{}}});const source=scripts.find(s=>s.startsWith('window.__HD2D_MODULES["touch-input"]'));assert.ok(source,'real touch-input module is required');vm.runInContext(source,ctx);return ctx.window.__HD2D_MODULES['touch-input'];}
class Element{
 constructor(){this.listeners={};this.style={};this.captures=new Set();}
 addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
 getBoundingClientRect(){return{left:0,top:0,width:100,height:100};}
 setPointerCapture(id){this.captures.add(id);}
 releasePointerCapture(id){this.captures.delete(id);}
 emit(type,values={}){const e={pointerId:1,pointerType:'touch',button:0,clientX:82,clientY:50,detail:1,preventDefault(){this.prevented=true;},...values};for(const fn of this.listeners[type]||[])fn(e);return e;}
}
function fixture(){const {bindTouchInput}=load(),joy=new Element(),stick=new Element(),bite=new Element(),dash=new Element(),vectors=[],actions=[];let playing=true;
 const input=bindTouchInput({joystick:joy,stick,skills:[{element:bite,action:'bite'},{element:dash,action:'dash'}],isPlaying:()=>playing,onVector:(x,z)=>vectors.push([x,z]),onAction:kind=>actions.push(kind),onTouch:()=>{}});
 return{joy,stick,bite,dash,vectors,actions,input,setPlaying:v=>playing=v};
}
test('first finger retains joystick ownership while second finger activates a skill',()=>{
 const f=fixture();f.joy.emit('pointerdown');assert.deepEqual(f.vectors.at(-1),[1,0]);f.joy.emit('pointerdown',{pointerId:2,clientX:18});assert.deepEqual(f.vectors.at(-1),[1,0]);
 f.dash.emit('pointerdown',{pointerId:2,isPrimary:false});assert.deepEqual(f.actions,['dash']);f.dash.emit('click',{pointerId:2});assert.deepEqual(f.actions,['dash']);
 f.joy.emit('pointerup',{pointerId:2});assert.deepEqual(f.vectors.at(-1),[1,0]);f.joy.emit('pointerup');assert.deepEqual(f.vectors.at(-1),[0,0]);assert.equal(f.joy.captures.size,0);
});
test('cancel, lost capture and explicit reset release joystick and reject stale movement',()=>{
 for(const event of ['pointercancel','lostpointercapture','reset']){const f=fixture();f.joy.emit('pointerdown');event==='reset'?f.input.reset():f.joy.emit(event);assert.equal(f.stick.style.transform,'');assert.equal(f.joy.captures.size,0);f.joy.emit('pointermove',{clientX:5});assert.deepEqual(f.vectors.at(-1),[0,0]);}
});
test('joystick deadzone is quiet, diagonal speed bounded and hidden modes ignore input',()=>{
 const f=fixture();f.joy.emit('pointerdown',{clientX:51,clientY:51});assert.deepEqual(f.vectors.at(-1),[0,0]);f.joy.emit('pointermove',{clientX:500,clientY:500});assert.ok(Math.hypot(...f.vectors.at(-1))<=1.00001);f.setPlaying(false);f.input.reset();f.joy.emit('pointerdown');f.bite.emit('pointerdown');assert.equal(f.actions.length,0);assert.equal(f.joy.captures.size,0);
});
test('touch skills fire on press once, mouse and keyboard click remain supported',()=>{
 const f=fixture();f.bite.emit('pointerdown');assert.deepEqual(f.actions,['bite']);f.bite.emit('pointerup');f.bite.emit('click');assert.equal(f.actions.length,1);
 f.bite.emit('click',{detail:0});assert.equal(f.actions.length,2);f.bite.emit('pointerdown',{pointerType:'mouse'});f.bite.emit('click',{pointerType:'mouse'});assert.equal(f.actions.length,3);
});
test('delivery and high fidelity requirements are visible in the actual build',()=>{
 assert.match(html,/id="game-shell" hidden/);assert.match(html,/id="launch-help"/);assert.match(html,/https:\/\/xuhuanzhi32-svg.github.io\/devour-hd2d-mobile\//);
 assert.match(html,/HD2D_WEBGL_UNAVAILABLE/);assert.match(html,/options.compatibilityConfirmed/);assert.match(html,/webglcontextlost/);assert.match(html,/visualViewport/);
 assert.match(html,/\.touch-ui \.web-tools\{display:none/);assert.match(html,/v0\.11\.0 WEB/);
});
