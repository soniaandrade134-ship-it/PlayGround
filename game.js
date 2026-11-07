(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, TILE = 48;
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('overlayTitle');
  const textEl = document.getElementById('overlayText');
  const playButton = document.getElementById('playButton');
  const toast = document.getElementById('toast');
  const keys = { left:false, right:false, jump:false };
  const world = { width: 5200, floor: 438 };
  let camera = 0, last = 0, playing = false, won = false, soundOn = true, audio;
  let score = 0, coinCount = 0, lives = 3, timeLeft = 300, timerTicks = 0;
  const player = { x:100,y:300,w:31,h:39,vx:0,vy:0,grounded:false,facing:1,invuln:0,anim:0,dead:false };
  const groundGaps = [[760,900],[1450,1580],[2200,2330],[3100,3260],[4050,4200],[4720,4850]];
  const solids = [];
  const blocks = [];
  const coins = [];
  const enemies = [];
  const scenery = [];
  const goalX = 5050;
  function addSolid(x,y,w,h,kind='brick'){ solids.push({x,y,w,h,kind}); }
  function addBlock(x,y,kind='question'){ blocks.push({x,y,w:42,h:42,kind,used:false,bump:0}); addSolid(x,y,42,42,'question'); }
  function addCoin(x,y){ coins.push({x,y,r:10,taken:false,phase:Math.random()*6}); }
  function addEnemy(x,y=world.floor-31,range=130){ enemies.push({x,y,w:34,h:30,vx:38,alive:true,min:x-range,max:x+range,anim:0}); }
  // Floating brickwork and golden question blocks.
  [[370,324],[412,324],[454,324],[496,324],[538,324],[580,324],[538,198],
   [1030,330],[1072,330],[1114,330],[1156,330],[1198,330],[1240,288],[1282,288],
   [1740,330],[1782,330],[1824,330],[1866,288],[1908,288],[1950,246],[1992,246],
   [2460,330],[2502,330],[2544,330],[2586,288],[2628,288],[2670,246],[2712,246],
   [3400,324],[3442,324],[3484,324],[3526,282],[3568,282],[3610,240],[3652,240],
   [4320,330],[4362,330],[4404,330],[4446,288],[4488,288],[4530,246],[4572,246]].forEach(p=>addSolid(p[0],p[1],42,42));
  [[454,276],[1072,282],[1198,240],[1782,282],[1908,198],[2502,282],[2628,198],[3442,276],[3568,234],[4362,282],[4488,240]].forEach(p=>addBlock(p[0],p[1]));
  // Platforms, coin trails, and little enemy patrols.
  [[660,354,100],[1320,340,90],[2025,360,100],[2800,340,120],[3730,340,110],[4620,355,90]].forEach(p=>addSolid(p[0],p[1],p[2],20,'ledge'));
  [[370,276],[412,276],[496,276],[580,276],[660,316],[700,316],[740,316],
   [1030,282],[1114,282],[1240,240],[1320,302],[1360,302],
   [1740,282],[1866,240],[1992,198],[2025,320],[2065,320],
   [2460,282],[2586,240],[2712,198],[2800,302],[2840,302],[2880,302],
   [3400,276],[3526,234],[3652,192],[3730,302],[3770,302],
   [4320,282],[4446,240],[4572,198],[4620,317],[4660,317]].forEach(p=>addCoin(p[0]+21,p[1]-17));
  [[620,world.floor-31,110],[1210,world.floor-31,100],[1680,world.floor-31,115],[2130,world.floor-31,75],[2730,world.floor-31,110],[3000,world.floor-31,80],[3590,world.floor-31,100],[3900,world.floor-31,115],[4490,world.floor-31,90],[4800,world.floor-31,60]].forEach(p=>addEnemy(...p));
  // Trees and layered hills are distributed deterministically for a hand-built feel.
  for(let i=0;i<36;i++){ let x=170+i*143; if(!groundGaps.some(g=>x>g[0]-100&&x<g[1]+35)) scenery.push({x,scale:[.72,.92,1.08][i%3],type:i%4===0?'tree':'bush'}); }
  function groundAt(x){return !groundGaps.some(g=>x>g[0]&&x<g[1]);}
  function updateHud(){ document.getElementById('score').textContent=String(score).padStart(6,'0'); document.getElementById('coins').textContent='× '+String(coinCount).padStart(2,'0'); document.getElementById('lives').textContent='♥ '.repeat(Math.max(0,lives)).trim()||'—'; document.getElementById('time').textContent=String(Math.max(0,timeLeft)); document.getElementById('progress').style.width=Math.min(100,player.x/(goalX-70)*100)+'%'; }
  function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>toast.classList.remove('show'),1250);}
  function tone(freq=620,duration=.08,type='sine'){ if(!soundOn)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(e){} }
  function startGame(){
    if(won||lives<=0||timeLeft<=0){score=0;coinCount=0;lives=3;timeLeft=300;coins.forEach(c=>c.taken=false);blocks.forEach(b=>b.used=false);enemies.forEach(e=>e.alive=true);}
    player.x=100;player.y=300;player.vx=player.vy=0;player.invuln=0;player.dead=false;camera=0;timerTicks=0;won=false;playing=true;overlay.classList.add('hidden');playButton.blur();tone(520,.1);
  }
  function showEnd(success){playing=false;won=success;titleEl.innerHTML=success?'Field <em>cleared!</em>':'One more <em>try?</em>';textEl.textContent=success?`You made it to the flag with ${coinCount} shiny coin${coinCount===1?'':'s'} in your pocket. Lovely running!`:'The field is still there, and so are the coins. Shake it off and go again!';playButton.innerHTML=success?'PLAY AGAIN <span>↻</span>':'TRY AGAIN <span>→</span>';overlay.classList.remove('hidden');}
  playButton.addEventListener('click',startGame);
  document.getElementById('soundButton').addEventListener('click',e=>{soundOn=!soundOn;e.currentTarget.innerHTML=(soundOn?'♫ <span>Sound on</span>':'♫ <span>Sound off</span>');if(soundOn)tone(600,.08);});
  const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump'};
  window.addEventListener('keydown',e=>{const k=keyMap[e.code];if(k){e.preventDefault();if(k==='jump'&&!keys.jump&&player.grounded&&playing){player.vy=-590;player.grounded=false;tone(390,.09,'square');}keys[k]=true;}if(e.code==='Enter'&&!playing)startGame();});
  window.addEventListener('keyup',e=>{const k=keyMap[e.code];if(k){keys[k]=false;if(k==='jump'&&player.vy< -210)player.vy=-210;}});
  document.querySelectorAll('.mobile-controls button').forEach(button=>{const key=button.dataset.key;const on=e=>{e.preventDefault();if(key==='jump'&&!keys.jump&&player.grounded&&playing){player.vy=-590;player.grounded=false;tone(390,.09,'square');}keys[key]=true;};const off=e=>{e.preventDefault();keys[key]=false;if(key==='jump'&&player.vy< -210)player.vy=-210;};button.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(ev=>button.addEventListener(ev,off));});
  function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function update(dt){
    if(!playing)return;
    timerTicks+=dt;if(timerTicks>=1){const n=Math.floor(timerTicks);timerTicks-=n;timeLeft-=n;if(timeLeft<=0){timeLeft=0;showEnd(false);}}
    const accel=keys.left?-1:keys.right?1:0; if(accel){player.vx+=accel*1800*dt;player.vx=Math.max(-260,Math.min(260,player.vx));player.facing=accel;}else player.vx*=Math.pow(.001,dt); if(Math.abs(player.vx)<4)player.vx=0;
    player.anim+=dt*Math.abs(player.vx)*.045;player.invuln=Math.max(0,player.invuln-dt);
    // Horizontal movement and side collisions.
    player.x+=player.vx*dt;player.x=Math.max(0,Math.min(world.width-player.w,player.x));
    for(const s of solids){if(rectsOverlap(player,s)){if(player.vx>0)player.x=s.x-player.w;else if(player.vx<0)player.x=s.x+s.w;player.vx=0;}}
    const oldY=player.y;player.vy=Math.min(850,player.vy+1550*dt);player.y+=player.vy*dt;player.grounded=false;
    // Flat ground has intentional gaps; check feet across the player's width.
    if(player.vy>=0&&oldY+player.h<=world.floor+4&&player.y+player.h>=world.floor&&groundAt(player.x+player.w*.5)){player.y=world.floor-player.h;player.vy=0;player.grounded=true;}
    for(const s of solids){if(!rectsOverlap(player,s))continue;if(player.vy>0&&oldY+player.h<=s.y+9){player.y=s.y-player.h;player.vy=0;player.grounded=true;}else if(player.vy<0&&oldY>=s.y+s.h-7){player.y=s.y+s.h;player.vy=20;if(s.kind==='brick'){s.bump=1;tone(250,.05,'square');}else{const b=blocks.find(b=>Math.abs(b.x-s.x)<2&&Math.abs(b.y-s.y)<2);if(b&&!b.used){b.used=true;b.bump=1;score+=100;coinCount++;updateHud();notify('+ 100  •  COIN!');tone(880,.13);}}}}
    for(const b of blocks){b.bump=Math.max(0,b.bump-dt*3);}
    // Collectibles.
    for(const c of coins){if(!c.taken&&rectsOverlap(player,{x:c.x-c.r,y:c.y-c.r,w:c.r*2,h:c.r*2})){c.taken=true;coinCount++;score+=100;updateHud();tone(900,.1);}}
    for(const e of enemies){if(!e.alive)continue;e.anim+=dt*8;e.x+=e.vx*dt;if(e.x<e.min||e.x+e.w>e.max){e.vx*=-1;e.x=Math.max(e.min,Math.min(e.max-e.w,e.x));}const er={x:e.x,y:e.y,w:e.w,h:e.h};if(rectsOverlap(player,er)&&player.invuln<=0){if(player.vy>100&&oldY+player.h<e.y+12){e.alive=false;player.vy=-360;score+=250;updateHud();notify('+ 250  •  NICE STOMP!');tone(300,.09,'square');}else{hurt();}}
    }
    if(player.y>H+30)loseLife();
    if(player.x>goalX-30){score+=500;updateHud();showEnd(true);tone(740,.2);}
    camera=Math.max(0,Math.min(world.width-W,player.x-W*.36));updateHud();
  }
  function hurt(){player.invuln=1.5;player.vy=-300;player.vx=-player.facing*180;lives--;updateHud();tone(160,.22,'sawtooth');if(lives<=0){player.dead=true;setTimeout(()=>showEnd(false),450);}else notify('OOPS!  KEEP GOING');}
  function loseLife(){if(!playing)return;lives--;updateHud();tone(150,.3,'sawtooth');if(lives<=0){showEnd(false);return;}player.x=Math.max(80,player.x-180);player.y=250;player.vx=0;player.vy=0;player.invuln=1.8;camera=Math.max(0,player.x-W*.36);notify('A FRESH START!');}
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawBackground(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#83d8f3');sky.addColorStop(.72,'#b4ecf1');sky.addColorStop(1,'#e6f4d7');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // warm sun and atmospheric halo
    ctx.fillStyle='#ffecb3';ctx.beginPath();ctx.arc(790,92,42,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff4c980';ctx.beginPath();ctx.arc(790,92,61,0,Math.PI*2);ctx.fill();
    for(let i=0;i<7;i++){const x=((i*220-camera*.18)%(W+200)+W+200)%(W+200)-80;const y=65+(i%3)*49;drawCloud(x,y,.76+(i%2)*.25);}
    // dreamy distant hills
    ctx.fillStyle='#95d8bc';for(let i=0;i<9;i++){let x=i*150-(camera*.27%150);ctx.beginPath();ctx.ellipse(x+60,416,110,110,0,Math.PI,0);ctx.lineTo(x+170,438);ctx.lineTo(x-50,438);ctx.fill();}
    ctx.fillStyle='#76cba9';for(let i=0;i<10;i++){let x=i*140-(camera*.43%140);ctx.beginPath();ctx.ellipse(x+55,436,86,74,0,Math.PI,0);ctx.lineTo(x+141,438);ctx.lineTo(x-31,438);ctx.fill();}
  }
  function drawCloud(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#ffffffb8';ctx.beginPath();ctx.arc(0,10,19,0,7);ctx.arc(21,0,26,0,7);ctx.arc(48,11,18,0,7);ctx.rect(-1,10,50,18);ctx.fill();ctx.restore();}
  function drawWorld(){
    drawBackground();ctx.save();ctx.translate(-camera,0);
    // Ground strips and checker-dotted turf edge.
    let runStart=0;for(const gap of [...groundGaps,[world.width,world.width+1]]){const end=gap[0];if(end>runStart){ctx.fillStyle='#d99554';ctx.fillRect(runStart,world.floor,end-runStart,H-world.floor);ctx.fillStyle='#74c969';ctx.fillRect(runStart,world.floor,end-runStart,13);ctx.fillStyle='#5caf62';for(let x=runStart;x<end;x+=24){ctx.fillRect(x,world.floor+12,12,4);ctx.fillStyle='#e7b46e';ctx.fillRect(x+4,world.floor+28,3,3);ctx.fillStyle='#5caf62';}for(let x=runStart;x<end;x+=48){ctx.fillStyle='#c37d47';ctx.fillRect(x,world.floor+46,46,2);} }if(gap[1]>runStart)runStart=gap[1];}
    // little grass blades at ledges
    for(const g of groundGaps){ctx.fillStyle='#6fc56e';ctx.fillRect(g[0]-7,world.floor,g[1]-g[0]+14,5);}
    scenery.forEach(o=>{if(o.x<camera-100||o.x>camera+W+100)return;ctx.save();ctx.translate(o.x,world.floor);ctx.scale(o.scale,o.scale);if(o.type==='tree'){ctx.fillStyle='#b57649';ctx.fillRect(-6,-45,12,45);ctx.fillStyle='#5cbd7d';ctx.beginPath();ctx.arc(0,-55,23,0,7);ctx.arc(-14,-42,17,0,7);ctx.arc(15,-40,17,0,7);ctx.fill();ctx.fillStyle='#87d78b';ctx.beginPath();ctx.arc(-5,-63,9,0,7);ctx.fill();}else{ctx.fillStyle='#68c982';ctx.beginPath();ctx.ellipse(0,-9,24,16,0,Math.PI,0);ctx.lineTo(24,0);ctx.lineTo(-24,0);ctx.fill();ctx.fillStyle='#9ce195';ctx.beginPath();ctx.arc(-8,-13,4,0,7);ctx.fill();}ctx.restore();});
    // floating bricks with warm beveled edges
    for(const s of solids){if(s.x+s.w<camera-60||s.x>camera+W+60||s.kind==='question')continue;if(s.kind==='ledge'){ rounded(s.x,s.y,s.w,s.h,5,'#63be77');ctx.fillStyle='#96df89';ctx.fillRect(s.x+3,s.y+3,s.w-6,5);continue;}rounded(s.x,s.y,s.w,s.h,5,'#da8c56');ctx.fillStyle='#f6b16b';ctx.fillRect(s.x+4,s.y+4,s.w-8,5);ctx.fillStyle='#b96e4a';ctx.fillRect(s.x+4,s.y+20,s.w-8,3);ctx.fillRect(s.x+20,s.y+5,3,15);ctx.fillRect(s.x+11,s.y+24,3,14);ctx.fillStyle='#efaa69';ctx.fillRect(s.x+4,s.y+8,4,10);}
    for(const b of blocks){if(b.x<camera-60||b.x>camera+W+60)continue;const by=b.y-Math.sin(b.bump*Math.PI)*9;if(b.used){rounded(b.x,by,b.w,b.h,5,'#c98d5d');ctx.fillStyle='#e5b17b';ctx.fillRect(b.x+5,by+6,b.w-10,4);}else{rounded(b.x,by,b.w,b.h,6,'#f5b940');ctx.fillStyle='#ffdc70';ctx.fillRect(b.x+4,by+4,b.w-8,5);ctx.strokeStyle='#cb8930';ctx.lineWidth=2;ctx.strokeRect(b.x+3,by+3,b.w-6,b.h-6);ctx.fillStyle='#fff3c7';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText('?',b.x+21,by+30);}}
    for(const c of coins){if(c.taken||c.x<camera-30||c.x>camera+W+30)continue;const cy=c.y+Math.sin(performance.now()*.004+c.phase)*4;ctx.fillStyle='#f9b935';ctx.beginPath();ctx.ellipse(c.x,cy,8,11,0,0,7);ctx.fill();ctx.strokeStyle='#fff0a5';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(c.x,cy,3,7,0,0,7);ctx.stroke();}
    // goal flag and little pennant
    ctx.fillStyle='#f5f0d7';ctx.fillRect(goalX,world.floor-178,6,178);ctx.fillStyle='#ff755f';ctx.beginPath();ctx.moveTo(goalX+6,world.floor-174);ctx.lineTo(goalX+67,world.floor-153);ctx.lineTo(goalX+6,world.floor-131);ctx.closePath();ctx.fill();ctx.fillStyle='#fff1ba';ctx.beginPath();ctx.arc(goalX+3,world.floor-181,7,0,7);ctx.fill();ctx.fillStyle='#8ccf78';ctx.beginPath();ctx.ellipse(goalX+3,world.floor-1,31,9,0,0,7);ctx.fill();
    enemies.forEach(e=>{if(!e.alive||e.x<camera-40||e.x>camera+W+40)return;const squash=Math.sin(e.anim)*2;rounded(e.x,e.y+squash,e.w,e.h-squash,12,'#b96b52');ctx.fillStyle='#eaa276';ctx.beginPath();ctx.ellipse(e.x+17,e.y+11+squash,11,9,0,0,7);ctx.fill();ctx.fillStyle='#263c47';ctx.fillRect(e.x+9,e.y+10+squash,3,5);ctx.fillRect(e.x+22,e.y+10+squash,3,5);ctx.fillStyle='#fff';ctx.fillRect(e.x+9,e.y+9+squash,2,2);ctx.fillRect(e.x+22,e.y+9+squash,2,2);ctx.fillStyle='#6d4c48';ctx.fillRect(e.x+6,e.y+26,8,4);ctx.fillRect(e.x+22,e.y+26,8,4);});
    drawPlayer();ctx.restore();
  }
  function drawPlayer(){
    if(player.invuln>0&&Math.floor(performance.now()/90)%2===0)return;
    const x=player.x,y=player.y,run=Math.sin(player.anim)*3,flip=player.facing<0;ctx.save();ctx.translate(x+player.w/2,y+player.h/2);if(flip)ctx.scale(-1,1);ctx.translate(-player.w/2,-player.h/2);
    // shadow
    ctx.fillStyle='#315d5960';ctx.beginPath();ctx.ellipse(15,41,17,4,0,0,7);ctx.fill();
    // boots and legs
    rounded(4,29+Math.max(0,run),11,9,3,'#5d4260');rounded(18,29+Math.max(0,-run),11,9,3,'#5d4260');ctx.fillStyle='#7d5369';ctx.fillRect(3,34+Math.max(0,run),13,3);ctx.fillRect(17,34+Math.max(0,-run),13,3);
    // overalls
    rounded(5,18,22,14,5,'#4d87bd');ctx.fillStyle='#75b5d5';ctx.fillRect(9,20,4,9);ctx.fillRect(20,20,4,9);ctx.fillStyle='#ffdb75';ctx.fillRect(10,21,3,3);ctx.fillRect(21,21,3,3);
    // face, hair, cap
    rounded(5,7,22,17,7,'#f3bf92');ctx.fillStyle='#594253';ctx.fillRect(5,13,4,9);ctx.fillRect(23,9,4,6);ctx.fillStyle='#e96858';rounded(2,4,25,8,4,'#e96858');ctx.fillStyle='#ff9a76';ctx.fillRect(6,5,14,3);ctx.fillStyle='#dc594d';ctx.fillRect(15,11,17,4);ctx.fillStyle='#283c51';ctx.fillRect(19,13,3,4);ctx.fillStyle='#fff';ctx.fillRect(20,13,1,1);ctx.fillStyle='#f0a27d';ctx.fillRect(23,18,5,3);
    // arms
    rounded(1,19+run*.3,7,9,3,'#f3bf92');rounded(25,19-run*.3,6,9,3,'#f3bf92');ctx.restore();
  }
  function frame(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;update(dt);drawWorld();requestAnimationFrame(frame);}
  updateHud();requestAnimationFrame(frame);
})();
