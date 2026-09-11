import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $=s=>document.querySelector(s), isTouch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const ui={intro:$('#intro'),start:$('#start'),hud:$('#hud'),pause:$('#pause'),resume:$('#resume'),result:$('#result'),restart:$('#restart'),health:$('#health'),armor:$('#armor'),healthBar:$('#health-bar'),armorBar:$('#armor-bar'),ammo:$('#ammo'),reserve:$('#reserve'),kills:$('#kills'),total:$('#total-enemies'),hit:$('#hitmarker'),damage:$('#damage-flash'),mobile:$('#mobile-controls'),objective:$('#objective')};

let renderer,scene,camera,composer,controls,clock=new THREE.Clock(),quality='high',running=false,won=false,initialized=false;
let health=100,armor=60,ammo=30,reserve=120,kills=0,reloading=false,velocityY=0,onGround=true,shootCooldown=0;
const enemies=[],tracers=[],keys={},moveTouch={x:0,y:0},look={id:null,x:0,y:0};

bindUI();

function bindUI(){
  ui.start.addEventListener('click',startGame);
  ui.resume.addEventListener('click',()=>{ui.pause.classList.add('hidden');if(controls&&!isTouch)controls.lock()});
  ui.restart.addEventListener('click',()=>location.reload());
  document.querySelectorAll('.quality').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.quality').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');quality=b.dataset.quality;if(initialized)applyQuality();
  }));
}

function init(){
  if(initialized)return;
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#game').append(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x8799a0);scene.fog=new THREE.FogExp2(0x78878a,.0085);
  camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,600);camera.position.set(0,5,34);scene.add(camera);
  controls=new PointerLockControls(camera,document.body);
  bindRuntime();buildLighting();buildWorld();buildEnemies();buildWeapon();buildPost();applyQuality();initialized=true;animate();
}
function buildLighting(){
  const hemi=new THREE.HemisphereLight(0xbfd0d6,0x392d22,1.25);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe2b8,4.2);sun.position.set(-80,110,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;sun.shadow.camera.near=1;sun.shadow.camera.far=250;scene.add(sun);
  const warm=new THREE.PointLight(0xff8a3d,35,70,2);warm.position.set(32,9,-43);scene.add(warm);
}
function buildWorld(){
  const groundGeo=new THREE.PlaneGeometry(260,260,100,100);groundGeo.rotateX(-Math.PI/2);const p=groundGeo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);const n=Math.sin(x*.045)*1.3+Math.cos(z*.05)*1.1+Math.sin((x+z)*.018)*2.1;const ridge=Math.max(0,Math.abs(x)-42)*.10+Math.max(0,-z-35)*.055;p.setY(i,n+ridge)}groundGeo.computeVertexNormals();
  const ground=new THREE.Mesh(groundGeo,new THREE.MeshStandardMaterial({color:0x5a5546,roughness:.96,metalness:.02}));ground.receiveShadow=true;scene.add(ground);
  for(let i=0;i<45;i++){const w=7+Math.random()*13,h=10+Math.random()*24,d=10+Math.random()*18;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.09,.14,.24+Math.random()*.1),roughness:1}));rock.scale.set(w,h,d);rock.position.set(-105+i*5+Math.random()*4,h*.45-3,-78-Math.random()*24);rock.rotation.set(Math.random(),Math.random(),Math.random());rock.castShadow=rock.receiveShadow=true;scene.add(rock)}
  const wallMat=new THREE.MeshStandardMaterial({color:0x8a775e,roughness:1});
  [[-25,-20],[12,-28],[35,-52],[-48,-56],[55,-18],[-8,-67]].forEach(([x,z],idx)=>{const g=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(10+idx%2*4,6+idx%3*2,9),wallMat);base.position.y=3;base.castShadow=base.receiveShadow=true;g.add(base);const roof=new THREE.Mesh(new THREE.BoxGeometry(11+idx%2*4,.6,10),new THREE.MeshStandardMaterial({color:0x59483a,roughness:1}));roof.position.y=6.25+idx%3;roof.rotation.z=(idx%2?.08:-.04);roof.castShadow=true;g.add(roof);g.position.set(x,terrainY(x,z),z);scene.add(g)});
  const shrine=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(3,.18,12,48),new THREE.MeshStandardMaterial({color:0xd5ae5d,metalness:.65,roughness:.35,emissive:0x4d3510,emissiveIntensity:.4}));ring.rotation.y=Math.PI/2;shrine.add(ring);for(let i=0;i<12;i++){const r=new THREE.Mesh(new THREE.BoxGeometry(.18,1.6,.18),ring.material);r.position.set(0,Math.cos(i*Math.PI/6)*4.0,Math.sin(i*Math.PI/6)*4.0);r.rotation.x=i*Math.PI/6;shrine.add(r)}shrine.position.set(-32,11,-46);scene.add(shrine);
  const road=new THREE.Mesh(new THREE.PlaneGeometry(18,190),new THREE.MeshStandardMaterial({color:0x665d4c,roughness:1}));road.rotation.x=-Math.PI/2;road.rotation.z=.08;road.position.set(10,.12,-30);road.receiveShadow=true;scene.add(road);
  for(let i=0;i<180;i++){const x=(Math.random()-.5)*180,z=(Math.random()-.5)*180;if(Math.abs(x-10)<12)continue;const bush=new THREE.Mesh(new THREE.ConeGeometry(.18+Math.random()*.45,.7+Math.random()*1.4,5),new THREE.MeshStandardMaterial({color:Math.random()>.5?0x5f603d:0x746b42,roughness:1}));bush.position.set(x,terrainY(x,z)+.4,z);bush.rotation.z=(Math.random()-.5)*.5;scene.add(bush)}
  const smokeTex=makeSmokeTexture();for(const [x,z] of [[38,-52],[-45,-60]]){for(let i=0;i<18;i++){const m=new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:.12,color:0x3e4141,depthWrite:false});const s=new THREE.Sprite(m);s.scale.setScalar(8+i*.5);s.position.set(x+(Math.random()-.5)*4,6+i*2.2,z+(Math.random()-.5)*4);scene.add(s)}}
}
function terrainY(x,z){return Math.sin(x*.045)*1.3+Math.cos(z*.05)*1.1+Math.sin((x+z)*.018)*2.1+Math.max(0,Math.abs(x)-42)*.10+Math.max(0,-z-35)*.055}
function makeSmokeTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,3,64,64,64);r.addColorStop(0,'rgba(255,255,255,.7)');r.addColorStop(.45,'rgba(180,180,180,.25)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
function buildEnemies(){
  const positions=[[-8,-25],[22,-35],[-38,-40],[45,-63],[-5,-72],[52,-28],[-58,-70],[26,-78],[61,-54]];
  positions.forEach((p,i)=>{const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.55,1.3,5,10),new THREE.MeshStandardMaterial({color:0x2c302a,roughness:.85}));body.position.y=1.45;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.42,12,10),new THREE.MeshStandardMaterial({color:0x6b513e,roughness:1}));head.position.y=2.75;head.castShadow=true;g.add(head);const vest=new THREE.Mesh(new THREE.BoxGeometry(1.15,.95,.62),new THREE.MeshStandardMaterial({color:0x171b18,roughness:.8}));vest.position.set(0,1.55,.1);g.add(vest);const gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,1.35),new THREE.MeshStandardMaterial({color:0x151515,metalness:.7,roughness:.35}));gun.position.set(.52,1.65,-.4);gun.rotation.x=-.15;g.add(gun);g.position.set(p[0],terrainY(p[0],p[1]),p[1]);g.userData={hp:100,alive:true,cooldown:Math.random()*2,phase:Math.random()*6.28,spawn:g.position.clone()};scene.add(g);enemies.push(g)});ui.total.textContent=enemies.length}
let weapon,recoil=0,muzzle;
function buildWeapon(){weapon=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0x202324,metalness:.75,roughness:.3});const stock=new THREE.Mesh(new THREE.BoxGeometry(.23,.25,.9),mat);stock.position.set(.36,-.33,-.65);weapon.add(stock);const receiver=new THREE.Mesh(new THREE.BoxGeometry(.25,.28,.85),mat);receiver.position.set(.35,-.33,-1.42);weapon.add(receiver);const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.2,10),mat);barrel.rotation.x=Math.PI/2;barrel.position.set(.35,-.29,-2.35);weapon.add(barrel);muzzle=new THREE.PointLight(0xffb36b,0,4,2);muzzle.position.set(.35,-.29,-3);weapon.add(muzzle);weapon.position.set(.28,-.22,-.2);camera.add(weapon)}
function buildPost(){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.22,.7,.92);composer.addPass(bloom);composer.addPass(new OutputPass())}
function bindRuntime(){
  addEventListener('resize',()=>{if(!camera||!renderer||!composer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});
  addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyR')reload();if(e.code==='Space')jump();if(e.code==='Escape'&&running&&!isTouch)showPause()});addEventListener('keyup',e=>keys[e.code]=false);
  renderer.domElement.addEventListener('mousedown',e=>{if(e.button===0&&running&&!isTouch)shoot()});
  controls.addEventListener('unlock',()=>{if(running&&!won&&!isTouch)showPause()});
  if(isTouch)bindTouch();
}
function startGame(){
  if(running)return;
  ui.start.disabled=true;const old=ui.start.innerHTML;ui.start.textContent='جارٍ تحميل اللعبة…';
  requestAnimationFrame(()=>{
    try{
      init();ui.intro.classList.add('hidden');ui.hud.classList.remove('hidden');if(isTouch)ui.mobile.classList.remove('hidden');else controls.lock();running=true;clock.getDelta();
    }catch(err){console.error(err);ui.start.disabled=false;ui.start.innerHTML=old;const note=document.querySelector('.mobile-note');if(note)note.textContent='تعذر تشغيل محرك 3D على هذا المتصفح. جرّب Chrome أو حدّث المتصفح.';}
  });
}
function showPause(){if(won)return;ui.pause.classList.remove('hidden')}
function bindTouch(){
  const joy=$('#joystick'),stick=$('#stick');let jid=null,cx=0,cy=0;
  joy.addEventListener('pointerdown',e=>{e.preventDefault();jid=e.pointerId;const r=joy.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;joy.setPointerCapture(jid)});joy.addEventListener('pointermove',e=>{if(e.pointerId!==jid)return;e.preventDefault();let dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),m=35;if(d>m){dx*=m/d;dy*=m/d}moveTouch.x=dx/m;moveTouch.y=-dy/m;stick.style.transform=`translate(${dx}px,${dy}px)`});const endJoy=()=>{jid=null;moveTouch.x=moveTouch.y=0;stick.style.transform=''};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.clientX<innerWidth*.42)return;e.preventDefault();look={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture?.(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerId!==look.id)return;e.preventDefault();const dx=e.clientX-look.x,dy=e.clientY-look.y;camera.rotation.order='YXZ';camera.rotation.y-=dx*.0032;camera.rotation.x=Math.max(-1.1,Math.min(1.1,camera.rotation.x-dy*.0032));look.x=e.clientX;look.y=e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===look.id)look.id=null});renderer.domElement.addEventListener('pointercancel',e=>{if(e.pointerId===look.id)look.id=null});
  $('#fire-mobile').addEventListener('pointerdown',e=>{e.preventDefault();shoot()});$('#reload-mobile').addEventListener('pointerdown',e=>{e.preventDefault();reload()});$('#jump-mobile').addEventListener('pointerdown',e=>{e.preventDefault();jump()});
}
function applyQuality(){if(!renderer||!scene)return;const q=quality==='high'?1.7:quality==='medium'?1.25:1;renderer.setPixelRatio(Math.min(devicePixelRatio,q));renderer.shadowMap.enabled=quality!=='low';if(scene.fog)scene.fog.density=quality==='low'?.011:.0085}
function jump(){if(onGround){velocityY=7.2;onGround=false}}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;ui.objective.textContent='إعادة تعبئة...';setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateHUD();ui.objective.textContent='طهّر المنطقة من العناصر المعادية'},1050)}
function shoot(){if(!running||won||shootCooldown>0||reloading)return;if(ammo<=0){reload();return}ammo--;shootCooldown=.095;recoil=.055;muzzle.intensity=18;setTimeout(()=>muzzle.intensity=0,35);updateHUD();
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const aliveMeshes=[];enemies.filter(e=>e.userData.alive).forEach(e=>e.traverse(o=>{if(o.isMesh){o.userData.enemy=e;aliveMeshes.push(o)}}));const hits=ray.intersectObjects(aliveMeshes,false);if(hits.length){const e=hits[0].object.userData.enemy;e.userData.hp-=hits[0].object.geometry.type==='SphereGeometry'?65:38;flashHit();if(e.userData.hp<=0)killEnemy(e)}
}
function flashHit(){ui.hit.classList.add('show');setTimeout(()=>ui.hit.classList.remove('show'),90)}
function killEnemy(e){e.userData.alive=false;kills++;ui.kills.textContent=kills;const start=e.rotation.z;let t=0;const fall=()=>{t+=.08;e.rotation.z=THREE.MathUtils.lerp(start,Math.PI*.48,Math.min(1,t));e.position.y-=.035;if(t<1)requestAnimationFrame(fall);else e.visible=false};fall();if(kills===enemies.length)win()}
function enemyAI(dt){const player=camera.position;for(const e of enemies){if(!e.userData.alive)continue;const d=e.position.distanceTo(player);e.userData.cooldown-=dt;e.userData.phase+=dt;if(d<52&&d>12){const dir=player.clone().sub(e.position).setY(0).normalize();e.position.addScaledVector(dir,dt*(d<25?.5:1.1));e.lookAt(player.x,e.position.y+1.5,player.z)}else e.rotation.y+=Math.sin(e.userData.phase)*dt*.08;if(d<58&&e.userData.cooldown<=0){e.userData.cooldown=1.1+Math.random()*1.5;if(Math.random()<Math.max(.22,.8-d/90))takeDamage(7+Math.random()*8)}}}
function takeDamage(v){let left=v;if(armor>0){const a=Math.min(armor,left*.65);armor-=a;left-=a}health=Math.max(0,health-left);ui.damage.style.background='rgba(150,0,0,.25)';setTimeout(()=>ui.damage.style.background='rgba(150,0,0,0)',120);updateHUD();if(health<=0)lose()}
function win(){won=true;running=false;ui.result.classList.remove('hidden');ui.mobile.classList.add('hidden');if(controls.isLocked)controls.unlock();ui.result.querySelector('#result-title').textContent='تم تأمين الممر';ui.result.querySelector('#result-text').textContent=`أنهيت المهمة بعد تحييد ${kills} عناصر معادية.`}
function lose(){won=true;running=false;ui.result.classList.remove('hidden');ui.mobile.classList.add('hidden');if(controls.isLocked)controls.unlock();$('#result-title').textContent='انتهت المهمة';$('#result-text').textContent='أُصيب المقاتل. أعد المهمة وحاول استخدام التضاريس كغطاء.'}
function updateHUD(){ui.health.textContent=Math.round(health);ui.armor.textContent=Math.round(armor);ui.healthBar.style.width=health+'%';ui.armorBar.style.width=(armor/60*100)+'%';ui.ammo.textContent=ammo;ui.reserve.textContent=reserve}
function movePlayer(dt){let f=(keys.KeyW?1:0)-(keys.KeyS?1:0)+moveTouch.y,r=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveTouch.x;const len=Math.hypot(f,r);if(len>1){f/=len;r/=len}const speed=(keys.ShiftLeft?11:6.4);if(isTouch){const yaw=camera.rotation.y,forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));camera.position.addScaledVector(forward,f*speed*dt);camera.position.addScaledVector(right,r*speed*dt)}else{controls.moveForward(f*speed*dt);controls.moveRight(r*speed*dt)}camera.position.x=THREE.MathUtils.clamp(camera.position.x,-90,90);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-105,65);const gy=terrainY(camera.position.x,camera.position.z)+2.15;velocityY-=18*dt;camera.position.y+=velocityY*dt;if(camera.position.y<=gy){camera.position.y=gy;velocityY=0;onGround=true}weapon.position.y=-.22+Math.sin(performance.now()*.012)*(Math.abs(f)+Math.abs(r))*.012;weapon.rotation.x=-recoil;recoil*=.72}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033);shootCooldown=Math.max(0,shootCooldown-dt);if(running){movePlayer(dt);enemyAI(dt)}composer.render()}
