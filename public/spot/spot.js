'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const speed = v => number(v) == null ? 'Unavailable' : `${v.toFixed(1)} km/h`;
  const distance = (a,b,c,d) => { const r=Math.PI/180; return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2))); };
  let config, spot, map, markers=[], controller, sequence=0, data=null, result=null, fitted=false, setup={weight:null,board:'twin-tip',quiver:[]}, lastEvent='';
  const text = (id,v) => { $(id).textContent=v; };
  let eventQueue=Promise.resolve();
  const event = type => {const body=JSON.stringify({spot:spot.id,type});eventQueue=eventQueue.then(()=>fetch('/spot/events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true})).catch(()=>{});};
  function stamp(value, offset=0) {
    if(typeof value!=='string') return NaN;
    const zoned=/Z$|[+-]\d\d:\d\d$/.test(value);
    return Date.parse(zoned?value:`${value}Z`)-(zoned?0:offset*1000);
  }
  function stations(payload) {
    const e=payload.extended||{}, seen=new Map();
    for(const group of ['wind_sensors','metar_stations','iem_stations','synoptic_stations','windy_stations','weatherlink_stations','buoys']) {
      for(const s of Array.isArray(e[group])?e[group]:[]) {
        if(s.is_hardware!==true || number(s.wind_speed_kmh)==null || s.wind_speed_kmh<0 || number(s.lat)==null || number(s.lng)==null) continue;
        const observed=stamp(s.observed_at||s.obs_time||s.updated);
        const age=(Date.now()-observed)/60000;
        if(!Number.isFinite(age)||age<0||age>config.maxStationAgeMinutes)continue;
        const row={...s,observed,age,distance:distance(spot.lat,spot.lng,s.lat,s.lng)};
        // Different networks can publish the same physical station; keep one observation.
        const key=`${s.station_id||s.name}:${s.lat.toFixed(3)}:${s.lng.toFixed(3)}`;
        if(!seen.has(key)||seen.get(key).observed<observed)seen.set(key,row);
      }
    }
    return [...seen.values()].sort((a,b)=>a.distance-b.distance);
  }
  function evaluate(payload) {
    const rows=stations(payload), local=rows.filter(s=>s.distance<=config.localRadiusKm);
    const a=payload.sensors?.layers?.atmosphere||{};
    // Never read the fused current wind as a model value.
    const model=a.model_current||(a.current_source?.mode==='model_only'?a.current:null);
    const modelAge=(Date.now()-stamp(model?.time,a.utc_offset_seconds||0))/60000;
    const forecast=Number.isFinite(modelAge)&&modelAge>=-5&&modelAge<=60?number(model?.wind_speed_10m):null;
    const values=rows.map(s=>s.wind_speed_kmh), low=Math.min(...values),high=Math.max(...values);
    const directions=rows.map(s=>number(s.wind_direction)).filter(v=>v!=null);
    const directionConflict=directions.some(a=>directions.some(b=>Math.min(Math.abs(a-b),360-Math.abs(a-b))>=60));
    const unresolved=(rows.length>1 && high-low>=config.majorDifferenceKmh)||directionConflict||rows.some(s=>s.wind_variable===true);
    const state=String(payload.assessment_state||'').toUpperCase();
    const insufficient=state.includes('INSUFFICIENT')||state==='UNAVAILABLE'||!local.length||forecast==null||unresolved;
    const gap=rows.length&&forecast!=null?Math.max(...values.map(v=>Math.abs(v-forecast))):null;
    return {rows,local,forecast,model,modelAge,low,high,unresolved,insufficient,gap,atmosphere:a};
  }
  function kiteAdvice(r) {
    if(r.insufficient) return r.unresolved?'Wind unresolved. No kite size recommended.':'Wind cannot be verified here. No kite size recommended.';
    if(!setup.weight||!setup.quiver.length)return 'Save your weight, board and kite sizes in My gear.';
    const gusts=r.local.map(s=>number(s.wind_gust_kmh));
    const missing=gusts.some(g=>g==null);
    if(missing)return 'Measured gusts missing. No kite size recommended, including your largest kite.';
    // Only approved, cited equipment charts may authorize a size; no invented sizing formula.
    const rules=(config.kiteRanges||[]).filter(x=>x.approvedBy&&x.sourceUrl&&x.board===setup.board&&setup.weight>=x.minWeightKg&&setup.weight<=x.maxWeightKg);
    if(!rules.length)return 'No approved wind-range chart for your setup yet. Sizing confidence unavailable; check your kite manufacturer’s chart.';
    const minimum=Math.min(...r.local.map(s=>s.wind_speed_kmh));
    const maximum=Math.max(...gusts,...r.local.map(s=>s.wind_speed_kmh));
    const sizes=setup.quiver.filter(size=>rules.some(x=>x.sizeM2===size&&minimum>=x.minWindKmh&&maximum<=x.maxWindKmh));
    return sizes.length?`Chart-matched options: ${sizes.join(' / ')} m². Limited confidence: measured wind and gusts fit the approved chart; confirm conditions on site.`:'None of your kites fits the approved range for measured wind and gusts. No size recommended.';
  }
  function render() {
    if(!data)return;
    result=evaluate(data); const r=result;
    const level=r.gap>=config.majorDifferenceKmh?'major':r.gap>=config.minorDifferenceKmh?'minor':'agreement';
    document.querySelector('.answer').dataset.level=r.unresolved?'major':r.insufficient?'minor':level;
    text('verdict',r.unresolved?'Wind unresolved':r.insufficient?'Wind unverified here':level==='major'?'Major disagreement':level==='minor'?'Some disagreement':'Forecast agrees');
    text('forecast',speed(r.forecast));
    text('measured',!r.rows.length?'Unavailable':r.high-r.low>=0.1?`${r.low.toFixed(1)}–${r.high.toFixed(1)} km/h`:speed(r.low));
    const closest=r.rows[0];
    text('evidence',!closest?`No fresh wind instrument found. Need a measurement within ${config.localRadiusKm} km and ${config.maxStationAgeMinutes} minutes.`:`${closest.name||closest.station_id} · ${closest.source} · ${closest.distance.toFixed(1)} km away.${!r.local.length?' Nearby context only; no local instrument covers this spot.':''}${r.gap!=null?` Forecast difference up to ${r.gap.toFixed(1)} km/h.`:''}`);
    text('age',closest?`Measurements ${Math.floor(Math.min(...r.rows.map(s=>s.age)))}–${Math.ceil(Math.max(...r.rows.map(s=>s.age)))} min old`:'Fresh measurement missing');
    text('kite',kiteAdvice(r));
    $('sources').replaceChildren();
    for(const s of r.rows){const p=document.createElement('p');p.textContent=`MEASURED · ${s.source} / ${s.name||s.station_id}: ${speed(s.wind_speed_kmh)}, ${s.distance.toFixed(1)} km, ${Math.ceil(s.age)} min old; gusts ${speed(s.wind_gust_kmh)}.`;$('sources').append(p);}
    for(const h of data.health||[]){if(['windy_stations','windy_webcams','synoptic'].includes(h.source)){const p=document.createElement('p');p.textContent=`${h.source}: ${h.status}`;$('sources').append(p);}}
    const status=r.insufficient?'abstention':'resolved';if(status!==lastEvent){event(status);lastEvent=status;}
    draw(r);
  }
  function marker(lng,lat,label,description,predicted=false,direction=null) {
    if(!map)return;
    const button=document.createElement('button');button.type='button';button.className=`station-marker${predicted?' model-marker':''}`;button.textContent=label;
    if(number(direction)!=null){const arrow=document.createElement('span');arrow.className='wind-arrow';arrow.textContent='↑';arrow.style.transform=`rotate(${(direction+180)%360}deg)`;arrow.setAttribute('aria-label',`Wind from ${direction} degrees`);button.prepend(arrow);}
    const p=document.createElement('p');p.textContent=description;
    markers.push(new maplibregl.Marker({element:button}).setLngLat([lng,lat]).setPopup(new maplibregl.Popup({offset:20}).setDOMContent(p)).addTo(map));
  }
  function draw(r) {
    markers.forEach(m=>m.remove());markers=[];
    if(map&&!fitted&&r.rows.length){const padding=map.getPadding(),side=Math.max(80,Math.min(innerWidth-padding.left-padding.right,innerHeight-padding.top-padding.bottom)-100);const radius=Math.max(2,...r.rows.map(s=>s.distance))*1400;const zoom=Math.log2(78271.5*Math.cos(spot.lat*Math.PI/180)/(2*radius/side));map.jumpTo({center:[spot.lng,spot.lat],zoom:Math.max(2,Math.min(11,zoom))});fitted=true;}
    marker(spot.lng,spot.lat,spot.name,`Selected spot: ${spot.lat}, ${spot.lng}`);
    for(const s of r.rows)marker(s.lng,s.lat,`${s.source} · ${speed(s.wind_speed_kmh)} · ${s.distance.toFixed(1)} km`,`MEASURED · ${s.name||s.station_id} · ${s.source} · ${speed(s.wind_speed_kmh)} · ${s.distance.toFixed(1)} km · ${Math.ceil(s.age)} min old`,false,s.wind_direction);
    if(r.forecast!=null&&number(r.atmosphere.longitude)!=null&&number(r.atmosphere.latitude)!=null)marker(r.atmosphere.longitude,r.atmosphere.latitude,`MODEL · ${speed(r.forecast)}`,`PREDICTED at model grid coordinate · ${speed(r.forecast)} · valid ${r.model.time}; not a measurement.`,true,r.model.wind_direction_10m);
  }
  async function load() {
    controller?.abort();controller=new AbortController();const current=++sequence;data=null;result=null;lastEvent='';fitted=false;
    markers.forEach(m=>m.remove());markers=[];text('spot-name',spot.name);text('verdict','Checking instruments…');text('forecast','—');text('measured','—');text('evidence','Waiting for live evidence. No reading assumed.');text('age','Measurement age pending');text('kite','Kite sizing waits for verified local wind.');$('sources').replaceChildren();document.querySelector('.answer').setAttribute('aria-busy','true');
    $('note').hidden=!(spot.localNote&&spot.noteAuthor);text('note',spot.localNote?`${spot.noteAuthor}: ${spot.localNote}`:'');
    map?.jumpTo({center:[spot.lng,spot.lat],zoom:10});event('view');
    const timeout=setTimeout(()=>controller.abort(),25000);
    try {const response=await fetch(`/api/pwm?lat=${spot.lat}&lng=${spot.lng}&field=kitesurfing&view=full`,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);const payload=await response.json();if(current!==sequence)return;
      const coords=payload.sensors?.coordinates;if(!coords||Math.abs(coords.lat-spot.lat)>0.001||Math.abs(coords.lng-spot.lng)>0.001)throw Error('Location mismatch');data=payload;render();
    }catch(e){if(current!==sequence)return;text('verdict','Evidence unavailable');text('evidence','Could not load current readings. Check your connection and tap Refresh.');text('age','Current data not verified');text('kite','No kite size recommended.');event('abstention');}
    finally{clearTimeout(timeout);if(current===sequence)document.querySelector('.answer').setAttribute('aria-busy','false');}
  }
  function select(next){spot=next;const params=new URLSearchParams(next.id==='custom'?{lat:next.lat,lng:next.lng}:{spot:next.id});history.replaceState(null,'',`/spot?${params}`);$('spots').value=spot.id;load();}
  async function init(){
    config=await(await fetch('/spot/config.json',{cache:'no-store'})).json();
    $('spots').replaceChildren();for(const s of config.spots)$('spots').add(new Option(s.name,s.id));$('spots').add(new Option('Map location','custom'));
    const q=new URLSearchParams(location.search),lat=Number(q.get('lat')),lng=Number(q.get('lng'));
    spot=config.spots.find(s=>s.id===q.get('spot'))||config.spots[0];
    if(q.has('lat')&&q.has('lng')&&q.get('lat').trim()&&q.get('lng').trim()&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=85&&Math.abs(lng)<=180)spot={id:'custom',name:'Map location',lat,lng};
    $('spots').value=spot.id;$('spots').onchange=()=>{const s=config.spots.find(s=>s.id===$('spots').value);if(s)select(s);};
    try{setup={...setup,...JSON.parse(localStorage.getItem('senlay-spot-profile')||'{}')};if(!Array.isArray(setup.quiver))setup.quiver=[];}catch(_){}
    $('weight').value=setup.weight||'';$('board').value=setup.board;
    for(const size of [3,4,5,6,7,8,9,10,11,12,13,14,15,17,19,21]){const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.value=size;i.checked=setup.quiver.includes(size);l.append(i,`${size}`);$('quiver').append(l);}
    $('profile-open').onclick=()=>{$('profile').showModal();event('profile');};$('profile-close').onclick=()=>$('profile').close();
    $('profile-form').onsubmit=()=>{setup={weight:Number($('weight').value)||null,board:$('board').value,quiver:[...$('quiver').querySelectorAll(':checked')].map(x=>Number(x.value))};try{localStorage.setItem('senlay-spot-profile',JSON.stringify(setup));}catch(_){text('storage-note','Browser storage unavailable; setup lasts for this visit.');}if(result)text('kite',kiteAdvice(result));event('profile');};
    $('refresh').onclick=load;
    try{map=new maplibregl.Map({container:'map',center:[spot.lng,spot.lat],zoom:10,attributionControl:false,style:{version:8,sources:{base:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'base',type:'raster',source:'base'}]}});map.addControl(new maplibregl.AttributionControl({compact:false}),'top-right');map.on('load',()=>text('map-status','Tap the map to choose a spot · arrows point downwind'));map.on('error',()=>text('map-status','Map tiles unavailable · readings still work'));map.on('click',e=>{if(e.originalEvent.target.closest('button'))return;select({id:'custom',name:'Map location',lat:+e.lngLat.lat.toFixed(5),lng:+e.lngLat.lng.toFixed(5)});});}catch(_){text('map-status','Map unavailable on this device · use the spot selector');}
    if(map){const position=()=>{const small=innerWidth<700;map.setPadding({top:115,bottom:small?Math.min(document.querySelector('.answer').offsetHeight+30,innerHeight-220):30,left:small?15:470,right:15});map.jumpTo({center:[spot.lng,spot.lat]});};new ResizeObserver(position).observe(document.querySelector('.answer'));position();}
    load();setInterval(()=>{if(data)render();},30000);
  }
  init().catch(()=>{text('verdict','Unable to load spots');text('evidence','Check your connection and reload. No kite size recommended.');});
})();
