import { mascot } from './assets/mascot.js';
const poses=['peek','sit','sit-book','sit-magnifier','sit-pencil','head','head-sm'];
const edu=mascot('sit',{label:'Edu, your study buddy',follow:true});
document.querySelector('#hero').append(edu.el);
const status=text=>document.querySelector('#status').textContent=text;
for(const pose of poses){const opt=document.createElement('option');opt.value=pose;opt.textContent=pose;document.querySelector('#pose').append(opt);}
document.querySelector('#pose').value='sit';
document.querySelector('#pose').addEventListener('change',e=>{edu.setPose(e.target.value);status(e.target.value);});
for(const [id,names,run] of [['states',['idle','curious','thinking','happy','wave','sleepy'],n=>edu.state(n)],['reactions',['tap','love','surprise','sad','cheer','nod','look-up','spot','twirl','lights-on','lights-off'],n=>{edu.state('idle');edu.react(n);} ]]){
 for(const name of names){const b=document.createElement('button');b.textContent=name;b.addEventListener('click',()=>{run(name);status(name);});document.getElementById(id).append(b);}}
document.querySelector('#speak').onclick=()=>edu.say('Hi! Let’s learn something new together.');
document.querySelector('#talk').onclick=()=>edu.talk(2000);
let auto=false;document.querySelector('#auto').onclick=e=>{auto=!auto;edu.autoplay(auto);e.target.textContent=`Idle actions: ${auto?'on':'off'}`;e.target.setAttribute('aria-pressed',String(auto));};
document.querySelector('#theme').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;document.dispatchEvent(new CustomEvent('themechange',{detail:{theme}}));};
for(const pose of poses){const card=document.createElement('article');card.className='card';const host=document.createElement('div');host.className='drawing';const m=mascot(pose,{label:`Edu: ${pose}`,calm:true,interactive:false});host.append(m.el);const label=document.createElement('p');label.textContent=pose;card.append(host,label);document.querySelector('#gallery').append(card);}
