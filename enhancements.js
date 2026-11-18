
/* VELO v2: races, private travel, activity imports and dynamic planning guidance. */
let raceCatalog=[], raceChoices={}, travelBlocks=[], actualRides={}, raceFilter='all';
try{raceChoices=JSON.parse(localStorage.getItem('velo-race-choices-v2')||'{}')}catch{}
try{travelBlocks=JSON.parse(localStorage.getItem('velo-trips-v2')||'[]')}catch{}
try{actualRides=JSON.parse(localStorage.getItem('velo-activities-v2')||'{}')}catch{}
const storeV2=()=>{localStorage.setItem('velo-race-choices-v2',JSON.stringify(raceChoices));localStorage.setItem('velo-trips-v2',JSON.stringify(travelBlocks));localStorage.setItem('velo-activities-v2',JSON.stringify(actualRides))};
const selectedRaces=()=>raceCatalog.filter(r=>['A','B'].includes(raceChoices[r.id]));
const datesBetween=(start,end,date)=>date>=start&&date<=end;
const tripsOn=date=>travelBlocks.filter(t=>datesBetween(t.start,t.end,date));
const racesOn=date=>raceCatalog.filter(r=>r.date===date&&(raceChoices[r.id]||'considering')!=='skip');
const chosenOn=date=>selectedRaces().filter(r=>r.date===date);
const dayIdx=date=>(parse(date).getDay()+6)%7;
const raceNext=date=>selectedRaces().filter(r=>r.date>=date).sort((a,b)=>a.date.localeCompare(b.date))[0];
const escapeV2=s=>clean(s||'');
const recommendedDate=r=>r?pretty(r.date)+' · '+r.name:'No target race selected';
function adapted(date) {
 const x=workouts[date]||{name:'Rest / unplanned',type:'rest'};
 const tr=tripsOn(date).find(t=>t.status!=='tentative')||tripsOn(date)[0];
 const race=chosenOn(date)[0];
 if(race) return {name:'RACE · '+race.name,type:'hard',reason:raceChoices[race.id]+' priority event replaces planned workout'};
 if(tr&&tr.status!=='tentative') {
   if(tr.bike==='none')return{name:'Travel · no bike',type:'rest',reason:tr.name+' · planned session is excused'};
   if(tr.bike==='limited')return{name:'Travel · optional short ride',type:'easy',reason:tr.name+' · reduce planned workload'};
   if(tr.bike==='possible')return{name:'Travel · adaptable ride',type:'easy',reason:tr.name+' · bike may be available'};
 }
 const dates=[plus(date,1),plus(date,2),plus(date,3)];
 const nearA=dates.some(d=>chosenOn(d).some(r=>raceChoices[r.id]==='A'));
 if(nearA&&x.type==='hard')return{name:'Easy / openers (A race ahead)',type:'easy',reason:'Avoid adding race-week intensity'};
 if(nearA&&x.type==='key'&&dates.some(d=>chosenOn(d).some(r=>raceChoices[r.id]==='A'&&d<=plus(date,2))))return{name:'Short sharpening / Z2',type:'easy',reason:'Prioritize freshness'};
 if(dates.slice(0,1).some(d=>chosenOn(d).some(r=>raceChoices[r.id]==='B'))&&x.type==='hard')return{name:'Easy before B race',type:'easy',reason:'Replace redundant group intensity'};
 return {...x,reason:''};
}
const beforeDate=(d,n)=>plus(d,-n);
function weekAdvice(w) {
 const end=plus(w.start,6), races=selectedRaces().filter(r=>datesBetween(w.start,end,r.date)),trips=travelBlocks.filter(t=>t.end>=w.start&&t.start<=end&&t.status!=='tentative');
 const a=races.filter(r=>raceChoices[r.id]==='A');
 const b=races.filter(r=>raceChoices[r.id]==='B');
 if(a.length)return 'A-race week: '+a.map(r=>r.name).join(', ')+'. Reduce training volume, avoid Thursday intensity, keep short openers and replace the long group ride with racing.';
 if(trips.some(t=>t.bike==='none'))return 'Travel-limited week: protect recovery and prioritize the sessions you can do before or after the trip. Do not make up missed volume.';
 if(b.length)return 'B-race week: '+b.map(r=>r.name).join(', ')+'. Count racing as hard training; skip additional group intensity if necessary.';
 if(trips.length)return 'Travel week: flexible aerobic riding if the bike is available, otherwise use the trip as a lower-load block.';
 const upcoming=raceNext(w.start);
 if(upcoming&&upcoming.date<=plus(w.start,28))return 'Building toward '+upcoming.name+' on '+pretty(upcoming.date)+'. Keep Tuesday quality; adjust Thursday and Saturday around freshness.';
 return 'Normal training week: preserve Tuesday key work, use Thursday conditionally, and keep Saturday social.';
}
document.querySelector('.tabs').insertAdjacentHTML('beforeend','<button class="tab" data-tab="races">Races</button><button class="tab" data-tab="travel">Travel</button><button class="tab" data-tab="actual">Actual rides</button>');
document.querySelector('#settings-view').insertAdjacentHTML('afterend',
 '<div id="races-view" class="hide extra"><div class="toolbar"><div><div class="month-label">2027 race calendar</div><p class="tip">NCNCA candidates · updated November 17, 2026. Only A and B selections change your plan.</p></div><a href="https://ncnca.org/events/" target="_blank" rel="noopener" class="button">NCNCA source ↗</a></div><div id="raceSummary" class="overview"></div><div class="filter-area" id="raceFilters"></div><div id="raceList"></div></div>'+
 '<div id="travel-view" class="hide extra"><div class="toolbar"><div><div class="month-label">Travel and availability</div><p class="tip">Private to this browser. Nothing imported here is sent to GitHub or Vercel.</p></div></div><div class="extra-grid"><section><label class="upload">Import your private travel JSON file<input id="tripImport" type="file" accept=".json,application/json"/></label><p class="tip">Google Calendar trips can be exported to a VELO import file in ChatGPT. Uploaded events stay in local browser storage.</p><div class="panel"><h3>Add or change a trip</h3><div class="field"><label>Trip name</label><input id="tripName" placeholder="e.g. Family vacation"/></div><div class="field"><label>Start date</label><input id="tripStart" type="date"/></div><div class="field"><label>End date (inclusive)</label><input id="tripEnd" type="date"/></div><div class="field"><label>Bike access</label><select id="tripBike"><option value="none">No bike</option><option value="limited">Limited riding</option><option value="possible">Bike likely available</option><option value="unknown">Not decided</option></select></div><button class="button primary" id="addTrip">Add travel block</button></div></section><div><div id="tripList"></div></div></div></div>'+
 '<div id="actual-view" class="hide extra"><div class="toolbar"><div><div class="month-label">Planned vs. actual</div><p class="tip">Import Strava activities CSV (manual for now). Automatic Strava OAuth is not connected.</p></div></div><div class="extra-grid"><div><label class="upload">Import Strava activity export CSV<input id="stravaImport" type="file" accept=".csv,text/csv"/></label><p class="tip">From Strava, request an account export and use the activities.csv file. Imports remain in this browser and are not uploaded to any server. This is not live Strava syncing.</p><div class="panel"><h3>How the score works</h3><p class="tip">Endurance compliance compares ride duration with the rough planned duration. Key interval sessions require reviewing the workout details; average watts cannot prove intervals were completed. A race or no-bike travel day is not treated as a missed session.</p><p class="tip">This is a coverage estimate, not a training-stress or fitness score.</p><button class="button" id="clearActivities">Clear imported rides</button></div></div><div id="actualList"></div></div></div>');
const originalSwitchTab=switchTab;
switchTab=function(t){tab=t;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));['calendar','weeks','blocks','settings','races','travel','actual'].forEach(s=>document.getElementById(s+'-view').classList.toggle('hide',s!==t));render();if(t==='races')renderRaces();if(t==='travel')renderTravel();if(t==='actual')renderActual()};
document.querySelectorAll('.tab').forEach(x=>{if(['races','travel','actual'].includes(x.dataset.tab))x.onclick=()=>switchTab(x.dataset.tab)});
const priorCalendar=renderCalendar;
renderCalendar=function(){
priorCalendar();
const parent=document.getElementById('calendar');
const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;
parent.querySelectorAll('.day').forEach((box,i)=>{
 const date=iso(new Date(month.getFullYear(),month.getMonth(),i-offset+1,12));
 const r=racesOn(date),t=tripsOn(date),a=actualRides[date]||[];
 if(t.length){const el=document.createElement('button');el.className='event travel';el.innerHTML='✈ '+escapeV2(t[0].name)+'<small>'+escapeV2(t[0].bike==='none'?'No bike':t[0].bike)+' · '+escapeV2(t[0].status)+'</small>';el.onclick=()=>switchTab('travel');box.appendChild(el)}
 r.forEach(event=>{const el=document.createElement('button');el.className='event race';el.innerHTML='★ '+escapeV2(event.name)+'<small>'+escapeV2(raceChoices[event.id]||'considering')+'</small>';el.onclick=()=>{raceFilter='all';switchTab('races')};box.appendChild(el)});
 if(a.length){const hrs=a.reduce((s,x)=>s+x.hours,0);const el=document.createElement('button');el.className='event actual';el.textContent='✓ Actual '+hrs.toFixed(1)+'h';el.onclick=()=>switchTab('actual');box.appendChild(el)}
 const planned=box.querySelector('.event:not(.travel):not(.race):not(.actual)');
 if(planned&&workouts[date]){const adj=adapted(date);if(adj.reason){planned.innerHTML='↪ '+escapeV2(adj.name)+'<small>'+escapeV2(adj.reason)+'</small>';planned.className='event '+adj.type}}
});
const context=document.getElementById('weekcontext'),w=currentWeek(iso(new Date(month.getFullYear(),month.getMonth(),15,12)));
if(w)context.insertAdjacentHTML('beforeend','<div class="overview">Dynamic guidance: '+escapeV2(weekAdvice(w))+'</div>');
};
const priorWeeks=renderWeeks;renderWeeks=function(){priorWeeks();document.querySelectorAll('.week-row').forEach((el,i)=>{const node=el.querySelector('p');if(node)node.insertAdjacentHTML('beforeend','<div style="margin-top:5px;color:#347a70">'+escapeV2(weekAdvice(weeks[i]))+'</div>')})};
function renderRaces(){
 const a=selectedRaces().filter(x=>raceChoices[x.id]==='A'),b=selectedRaces().filter(x=>raceChoices[x.id]==='B');
 document.getElementById('raceSummary').textContent=a.length+' A races · '+b.length+' B races · '+raceCatalog.length+' published candidates. Unselected races are only possibilities and do not affect workouts.';
 document.getElementById('raceFilters').innerHTML=['all','considering','A','B','skip'].map(x=>'<button data-filter="'+x+'" class="'+(raceFilter===x?'active':'')+'">'+(x==='all'?'All races':x==='A'?'A race':x==='B'?'B race':x==='skip'?'Skipping':'Considering')+'</button>').join('');
 document.querySelectorAll('[data-filter]').forEach(x=>x.onclick=()=>{raceFilter=x.dataset.filter;renderRaces()});
 const shown=raceCatalog.filter(r=>raceFilter==='all'||(raceChoices[r.id]||'considering')===raceFilter);
 document.getElementById('raceList').innerHTML=shown.map(r=>'<div class="extra-card"><div><strong>'+escapeV2(pretty(r.date)+' · '+r.name)+'</strong><p>'+escapeV2(r.type+' · '+r.location)+'</p></div><select data-race="'+r.id+'" aria-label="Priority for '+escapeV2(r.name)+'">'+[['considering','Considering'],['B','B race'],['A','A race'],['skip','Skipping']].map(x=>'<option value="'+x[0]+'"'+((raceChoices[r.id]||'considering')===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>').join('')||'<div class="empty">No races match this filter.</div>';
 document.querySelectorAll('[data-race]').forEach(sel=>sel.onchange=()=>{raceChoices[sel.dataset.race]=sel.value;storeV2();renderRaces();renderCalendar();renderWeeks()});
}
function renderTravel(){
 const root=document.getElementById('tripList');
 root.innerHTML=travelBlocks.length?travelBlocks.slice().sort((a,b)=>a.start.localeCompare(b.start)).map(t=>'<div class="extra-card"><div><strong>✈ '+escapeV2(t.name)+'</strong><p>'+escapeV2(pretty(t.start)+' – '+pretty(t.end))+' · '+escapeV2(t.status||'confirmed')+'</p></div><div><select data-trip="'+escapeV2(t.id)+'"><option value="none" '+(t.bike==='none'?'selected':'')+'>No bike</option><option value="limited" '+(t.bike==='limited'?'selected':'')+'>Limited</option><option value="possible" '+(t.bike==='possible'?'selected':'')+'>Bike available</option><option value="unknown" '+(t.bike==='unknown'?'selected':'')+'>Unknown</option></select><button class="button" data-remove-trip="'+escapeV2(t.id)+'" title="Remove trip">×</button></div></div>').join(''):'<div class="empty">No travel blocks imported. Use your private import file or add a trip.</div>';
 root.querySelectorAll('[data-trip]').forEach(sel=>sel.onchange=()=>{const t=travelBlocks.find(t=>t.id===sel.dataset.trip);if(t)t.bike=sel.value;storeV2();renderTravel();renderCalendar();renderWeeks()});
 root.querySelectorAll('[data-remove-trip]').forEach(btn=>btn.onclick=()=>{travelBlocks=travelBlocks.filter(t=>t.id!==btn.dataset.removeTrip);storeV2();renderTravel();renderCalendar();renderWeeks()});
}
document.getElementById('tripImport').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.format!=='velo-travel-v1'||!Array.isArray(data.trips))throw Error('This is not a VELO travel import');const valid=data.trips.filter(t=>/^\\d{4}-\\d{2}-\\d{2}$/.test(t.start)&&/^\\d{4}-\\d{2}-\\d{2}$/.test(t.end)&&t.end>=t.start&&typeof t.name==='string').map(t=>({id:String(t.id||('import-'+t.start+'-'+t.name)),name:t.name.slice(0,160),start:t.start,end:t.end,bike:['none','limited','possible','unknown'].includes(t.bike)?t.bike:'unknown',status:t.status==='tentative'?'tentative':'confirmed'}));travelBlocks=[...travelBlocks.filter(t=>!valid.some(v=>v.id===t.id)),...valid];storeV2();renderTravel();renderCalendar();renderWeeks();alert('Imported '+valid.length+' private travel blocks.')}catch(err){alert('Travel import failed: '+err.message)}e.target.value=''};
document.getElementById('addTrip').onclick=()=>{const name=document.getElementById('tripName').value.trim(),start=document.getElementById('tripStart').value,end=document.getElementById('tripEnd').value;if(!name||!start||!end||end<start)return alert('Enter a valid trip name and date range');travelBlocks.push({id:'manual-'+Date.now(),name,start,end,bike:document.getElementById('tripBike').value,status:'confirmed'});storeV2();renderTravel();renderCalendar();renderWeeks();document.getElementById('tripName').value=''};
function csvRows(text){const rows=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){field+='"';i++}else quote=!quote}else if(c===','&&!quote){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}else field+=c}row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows}
function hoursFrom(s){if(!s)return 0;const x=String(s).trim();if(/^\\d+(\\.\\d+)?$/.test(x))return Number(x)/3600;const p=x.split(':').map(Number);if(p.some(Number.isNaN))return 0;return p.length===3?p[0]+p[1]/60+p[2]/3600:p.length===2?p[0]/60+p[1]/3600:0}
function readStravaCSV(text){
 const rows=csvRows(text);if(rows.length<2)throw Error('CSV has no activity rows');const header=rows[0].map(x=>x.toLowerCase().trim().replace(/[^a-z0-9]/g,''));const field=(r,...cols)=>{for(const k of cols){const i=header.indexOf(k);if(i>=0&&r[i])return r[i]}return ''};
 let imported=0;const map={};
 for(const row of rows.slice(1)){
  const dateStr=field(row,'activitydate','startdate','date');if(!dateStr)continue;
  const dt=new Date(dateStr);if(Number.isNaN(dt.getTime()))continue;
  const date=iso(dt);
  const type=field(row,'activitytype','type','sporttype');
  if(type&& !/ride|cycling|virtualride|ebike|gravel|mountainbike/i.test(type))continue;
  let h=hoursFrom(field(row,'movingtime','elapsedtime','duration'));
  if(h<=0||h>30)continue;
  const title=field(row,'activityname','name','title')||'Ride';
  if(!map[date])map[date]=[];
  map[date].push({name:title.slice(0,100),hours:h,type,power:field(row,'averagewatts','weightedaveragepower','averagepower')});
  imported++;
 }
 if(!imported)throw Error('No cycling activities recognized (expected Activity Date, Activity Type and Moving Time columns).');
 return{map,imported};
}
document.getElementById('stravaImport').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const {map,imported}=readStravaCSV(await f.text());actualRides={...actualRides,...map};storeV2();renderActual();renderCalendar();alert('Imported '+imported+' rides from CSV.')}catch(err){alert('Activity import failed: '+err.message)}e.target.value=''};
document.getElementById('clearActivities').onclick=()=>{if(confirm('Clear all imported activity data from this browser?')){actualRides={};storeV2();renderActual();renderCalendar()}};
function durationGoal(date){
 const x=adapted(date);if(x.name.startsWith('Travel · no bike'))return 0;
 if(x.name.startsWith('RACE'))return null;
 if(x.type==='rest')return 0;
 const i=dayIdx(date);
 if(i===5)return 4.5;if(i===6)return 2.75;if(i===2)return 1.75;if(i===4)return 1;
 return i===1?1.5:i===3?1.5:0;
}
function renderActual(){
 const entries=Object.entries(actualRides).sort((a,b)=>b[0].localeCompare(a[0]));
 document.getElementById('actualList').innerHTML=entries.length?entries.slice(0,90).map(([date,rides])=>{
  const hrs=rides.reduce((s,x)=>s+x.hours,0),target=durationGoal(date),score=target===null?'Race day':target===0?'No session required':Math.min(100,Math.round(hrs/target*100))+'% duration';
  const note=target===null?'Race execution needs manual review':target===0?'Not scored as a missed session':adapted(date).type==='key'?'Interval quality not verified by aggregate data':'Duration coverage only';
  return '<div class="extra-card"><div style="flex:1"><strong>'+escapeV2(pretty(date))+' · '+escapeV2(rides.map(r=>r.name).join(' + '))+'</strong><p>'+hrs.toFixed(1)+'h actual · '+escapeV2(adapted(date).name)+'</p><p>'+escapeV2(note)+'</p></div><span class="score">'+escapeV2(score)+'</span></div>'}).join(''):'<div class="empty">No Strava activities imported. Upload a CSV to start comparing completed rides with the calendar.</div>';
}
fetch('races-2027.json').then(r=>{if(!r.ok)throw Error('race catalog unavailable');return r.json()}).then(data=>{raceCatalog=data.events||[];renderRaces();renderCalendar();renderWeeks()}).catch(e=>{document.getElementById('raceList').textContent='Could not load the race calendar: '+e.message});
renderTravel();renderActual();render();
