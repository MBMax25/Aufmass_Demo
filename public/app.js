/* PWA + Formular + Fenster-Editor + Guided Demo + Laser-Simulation */
let deferredPrompt = null;

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}

// Install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.hidden = false;
});
document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').hidden = true;
});

// Online/Offline Badge
const connectionBadge = document.getElementById('connectionBadge');
function updateOnlineStatus(){
  const online = navigator.onLine;
  connectionBadge.textContent = online ? 'Online' : 'Offline';
  connectionBadge.className = 'badge';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ---------------------------
// State-Persistenz
// ---------------------------
const FORM_KEY = 'aufmass-demo-form-v4';
const MAX_PHOTOS = 3;

function saveState(){
  const form = document.getElementById('aufmassForm');
  const data = new FormData(form);
  const obj = Object.fromEntries(data.entries());
  obj._rooms = exportRooms();
  localStorage.setItem(FORM_KEY, JSON.stringify(obj));
}
function loadState(){
  const raw = localStorage.getItem(FORM_KEY);
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    const form = document.getElementById('aufmassForm');
    for (const [k,v] of Object.entries(obj)){
      if (k === '_rooms') continue;
      const el = form.querySelector(`[name="${CSS.escape(k)}"]`);
      if (el) el.value = v;
    }
    importRooms(obj._rooms || []);
    // Empfänger Readonly-Preview updaten
    syncEmpfReadonly();
  } catch(e){ console.warn('loadState failed', e); }
}
let saveTimer=null;
document.getElementById('aufmassForm').addEventListener('input', ()=>{
  clearTimeout(saveTimer); saveTimer=setTimeout(()=>{ syncEmpfReadonly(); saveState(); }, 250);
});

// Step navigation
const fsKunde = document.getElementById('kundendaten');
const fsAuftrag = document.getElementById('auftragsdaten');
const fsFenster = document.getElementById('fensterbereich');
document.getElementById('btnToAuftragsdaten')?.addEventListener('click', ()=>{ fsKunde.style.display='none'; fsAuftrag.style.display=''; });
document.getElementById('btnBackToKundendaten')?.addEventListener('click', ()=>{ fsAuftrag.style.display='none'; fsKunde.style.display=''; });
document.getElementById('btnToFensterbereich')?.addEventListener('click', ()=>{ fsAuftrag.style.display='none'; fsFenster.style.display=''; });
document.getElementById('btnBackToAuftragsdaten')?.addEventListener('click', ()=>{ fsFenster.style.display='none'; fsAuftrag.style.display=''; });

// Farbe
const farbeSelect = document.getElementById('farbeSelect');
const farbeSonstige = document.getElementById('farbeSonstige');
const farbeSwatches = document.getElementById('farbeSwatches');
function updateFarbe(){ farbeSonstige.style.display = farbeSelect.value === 'Sonstige' ? '' : 'none'; }
farbeSelect?.addEventListener('change', ()=>{ updateFarbe(); saveState();});
updateFarbe();
if (farbeSwatches){ ['Anthrazit','Weiß','Grau'].forEach(name=>{ const s=document.createElement('span'); s.className='sw'; s.dataset.name=name; s.title=name; farbeSwatches.appendChild(s); }); }

// Empfänger kompakt/editierbar
document.getElementById('toggleEmpfBtn')?.addEventListener('click', ()=>{
  const el = document.getElementById('empfaengerBlock');
  el.style.display = (el.style.display==='none' || !el.style.display) ? '' : 'none';
});
function syncEmpfReadonly(){
  const get = n => document.querySelector(`[name="${n}"]`)?.value || '';
  const name = get('empf_name') || 'Empfänger (TEST)';
  const plz = get('empf_plz'), ort = get('empf_ort');
  const str = get('empf_strasse');
  document.getElementById('empf_name_ro').textContent = name;
  document.getElementById('empf_ort_ro').textContent = `${plz} ${ort}`.trim();
  document.getElementById('empf_strasse_ro').textContent = str;
}

// ---------------------------
// Räume & Fenster
// ---------------------------
const raeumeContainer = document.getElementById('raeumeContainer');
const addRaumBtn = document.getElementById('addRaumBtn');
let windowCounter = 0;
addRaumBtn?.addEventListener('click', ()=> addRoom());

function addRoom(name){
  const idx = raeumeContainer.querySelectorAll('.room').length + 1;
  const r = roomElement(name || `Raum ${idx}`);
  raeumeContainer.appendChild(r);
  saveState(); return r;
}
function roomElement(title){
  const wrap = document.createElement('div');
  wrap.className='room';
  wrap.innerHTML = `
    <div class="room-head">
      <div class="room-title" contenteditable="true" spellcheck="false">${title}</div>
      <div class="win-actions">
        <button type="button" class="btn btn-ghost" data-action="add-window">+ Fenster</button>
        <button type="button" class="btn btn-danger" data-action="remove-room">Raum löschen</button>
      </div>
    </div>
    <div class="room-body"><div class="empty-hint">Noch keine Fenster hinzugefügt.</div></div>`;
  wrap.addEventListener('click', (e)=>{
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.action === 'remove-room') { wrap.remove(); saveState(); }
    if (t.dataset.action === 'add-window') { addWindow(wrap.querySelector('.room-body')); saveState(); }
  });
  return wrap;
}
function addWindow(parent, data){
  parent.querySelector('.empty-hint')?.remove();
  const id = `w${Date.now()}_${++windowCounter}`;
  const div = document.createElement('div');
  div.className='window';
  div.dataset.winId = id;
  div.innerHTML = windowHtml(id);
  parent.appendChild(div);
  wireWindow(div, data);
  return div;
}
function windowHtml(id){
  return `
  <div class="win-grid">
    <div class="win-row">
      <label><span>Bezeichnung:</span><input type="text" name="w_bez_${id}" placeholder="z.B. Fenster links" /></label>
      <label><span>Breite (mm):</span><input type="text" inputmode="numeric" name="w_breite_${id}" /></label>
      <label><span>Höhe (mm):</span><input type="text" inputmode="numeric" name="w_hoehe_${id}" /></label>
      <div class="win-actions"><button type="button" class="btn btn-ghost" data-action="remove-window">Fenster löschen</button></div>
    </div>
    <div class="win-row">
      <label class="inline-radio-item"><input type="radio" name="w_art_${id}" value="Festverglast" /> Festverglast</label>
      <label class="inline-radio-item"><input type="radio" name="w_art_${id}" value="Kipp" /> Kipp</label>
      <label class="inline-radio-item"><input type="radio" name="w_art_${id}" value="Drehkipp links" /> Drehkipp links</label>
      <label class="inline-radio-item"><input type="radio" name="w_art_${id}" value="Drehkipp rechts" /> Drehkipp rechts</label>
    </div>
    <div class="win-opts">
      <label class="inline-checkbox-item"><input type="checkbox" name="w_opt_struktur_${id}" /> Struktur</label>
      <label class="inline-checkbox-item"><input type="checkbox" name="w_opt_dav_${id}" /> Druckausgleichventil</label>
      <label class="inline-checkbox-item"><input type="checkbox" name="w_opt_schutz_${id}" /> Schallschutz</label>
      <label class="inline-checkbox-item"><input type="checkbox" name="w_opt_abs_${id}" /> Abschließbar</label>
    </div>

    <div class="card">
      <div class="card-title">Fotos (max. ${MAX_PHOTOS})</div>
      <div class="thumbs" data-role="thumbs"></div>
      <input type="file" accept="image/*" capture="environment" data-role="file" hidden />
      <div class="win-row">
        <button type="button" class="btn" data-action="add-photo">Foto aufnehmen/Hochladen</button>
        <small class="muted">Bilder werden automatisch komprimiert.</small>
      </div>
    </div>

    <div class="sketch">
      <div class="card-title">Skizze</div>
      <canvas data-role="canvas" width="800" height="440"></canvas>
      <div class="sketch-toolbar">
        <label>Stiftgröße <input type="range" min="1" max="12" value="3" data-role="penwidth" /></label>
        <button type="button" class="btn" data-action="sketch-clear">Leeren</button>
        <button type="button" class="btn" data-action="sketch-save">Übernehmen</button>
        <span data-role="sketch-status" style="opacity:.8; margin-left:8px;">noch nicht gespeichert</span>
      </div>
    </div>

    <div class="sim">
      <strong>Lasermesser (Simulation)</strong>
      <div class="win-row">
        <select data-role="sim-device">
          <option>BOSCH GLM (Sim)</option>
          <option>LEICA DISTO (Sim)</option>
        </select>
        <label class="inline-checkbox-item"><input type="checkbox" data-role="sim-enabled" /> aktivieren</label>
        <button type="button" class="btn" data-action="sim-breite" disabled>Messen Breite</button>
        <button type="button" class="btn" data-action="sim-hoehe" disabled>Messen Höhe</button>
        <button type="button" class="btn" data-action="sim-stream" disabled>Live-Stream 1 s</button>
        <span class="muted" data-role="sim-out"></span>
      </div>
    </div>
  </div>`;
}
function wireWindow(div, data){
  // Remove window
  div.querySelector('[data-action="remove-window"]').addEventListener('click', ()=>{ div.remove(); saveState(); });

  // Photos
  const fileInput = div.querySelector('[data-role="file"]');
  const thumbs = div.querySelector('[data-role="thumbs"]');
  div.querySelector('[data-action="add-photo"]').addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    for (const f of files){
      if (thumbs.querySelectorAll('.thumb').length >= MAX_PHOTOS) break;
      const dataUrl = await compressImage(f, 1400, 0.85);
      addThumb(thumbs, dataUrl);
    }
    fileInput.value = '';
    saveState();
  });
  function addThumb(container, dataUrl){
    const t = document.createElement('div'); t.className='thumb';
    t.innerHTML = `<img alt="Foto" /><button type="button" class="btn btn-danger remove">×</button>`;
    t.querySelector('img').src = dataUrl;
    t.querySelector('.remove').addEventListener('click', ()=>{ t.remove(); saveState(); });
    container.appendChild(t);
  }

  // Sketch
  const canvas = div.querySelector('[data-role="canvas"]');
  const ctx = canvas.getContext('2d');
  const pen = div.querySelector('[data-role="penwidth"]');
  const status = div.querySelector('[data-role="sketch-status"]');
  let drawing=false, last=null; ctx.lineCap='round'; ctx.lineJoin='round';
  function getPos(e){
    const r = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) return {x:(e.touches[0].clientX-r.left)*canvas.width/r.width, y:(e.touches[0].clientY-r.top)*canvas.height/r.height};
    return {x:(e.clientX-r.left)*canvas.width/r.width, y:(e.clientY-r.top)*canvas.height/r.height};
  }
  function start(e){ drawing=true; last=getPos(e); }
  function move(e){ if(!drawing) return; const p=getPos(e); ctx.strokeStyle='#111'; ctx.lineWidth=Number(pen.value||3); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; }
  function end(){ drawing=false; }
  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', (e)=>{start(e); e.preventDefault();},{passive:false});
  canvas.addEventListener('touchmove', (e)=>{move(e); e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend', end);
  div.querySelector('[data-action="sketch-clear"]').addEventListener('click', ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); status.textContent='geleert (nicht gespeichert)'; saveState(); });
  div.querySelector('[data-action="sketch-save"]').addEventListener('click', ()=>{ status.textContent='gespeichert'; saveState(); });

  // Laser-Simulation
  const en = div.querySelector('[data-role="sim-enabled"]');
  const out = div.querySelector('[data-role="sim-out"]');
  const bBtn = div.querySelector('[data-action="sim-breite"]');
  const hBtn = div.querySelector('[data-action="sim-hoehe"]');
  const sBtn = div.querySelector('[data-action="sim-stream"]');
  en.addEventListener('change', ()=>{
    const active = en.checked;
    bBtn.disabled = hBtn.disabled = sBtn.disabled = !active;
    out.textContent = active ? 'Simulation aktiv' : '';
  });
  bBtn.addEventListener('click', async ()=>{
    const val = await simulateMeasure(800, 2400); // Breite typischer
    div.querySelector(`[name="w_breite_${div.dataset.winId}"]`).value = val;
    out.textContent = `Breite: ${val} mm`;
    buzz(); saveState();
  });
  hBtn.addEventListener('click', async ()=>{
    const val = await simulateMeasure(900, 2600);
    div.querySelector(`[name="w_hoehe_${div.dataset.winId}"]`).value = val;
    out.textContent = `Höhe: ${val} mm`;
    buzz(); saveState();
  });
  sBtn.addEventListener('click', async ()=>{
    out.textContent = 'Live…';
    const samples = 5, dt = 200;
    let last = null;
    for (let i=0;i<samples;i++){
      last = await simulateMeasure(700, 2800, true);
      out.textContent = `Live: ${last} mm`;
      await sleep(dt);
    }
    out.textContent = `Übernommen: ${last} mm`;
    // setze auf Breite, wenn leer – sonst Höhe
    const bEl = div.querySelector(`[name="w_breite_${div.dataset.winId}"]`);
    const hEl = div.querySelector(`[name="w_hoehe_${div.dataset.winId}"]`);
    if (!bEl.value) bEl.value = last; else hEl.value = last;
    buzz(); saveState();
  });

  // Prefill
  if (data){
    const id = div.dataset.winId;
    div.querySelector(`[name="w_bez_${id}"]`).value = data.bezeichnung||'';
    div.querySelector(`[name="w_breite_${id}"]`).value = data.breite_mm||'';
    div.querySelector(`[name="w_hoehe_${id}"]`).value = data.hoehe_mm||'';
    if (data.art){ const r = div.querySelector(`input[name="w_art_${id}"][value="${CSS.escape(data.art)}"]`); if (r) r.checked = true; }
    div.querySelector(`[name="w_opt_struktur_${id}"]`).checked = !!(data.optionen&&data.optionen.struktur);
    div.querySelector(`[name="w_opt_dav_${id}"]`).checked = !!(data.optionen&&data.optionen.dav);
    div.querySelector(`[name="w_opt_schutz_${id}"]`).checked = !!(data.optionen&&data.optionen.schutz);
    div.querySelector(`[name="w_opt_abs_${id}"]`).checked = !!(data.optionen&&data.optionen.abschliessbar);
    (data.fotos||[]).forEach(u=> addThumb(thumbs, u));
    if (data.skizze){ const img=new Image(); img.onload=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); }; img.src=data.skizze; }
  }
}
function exportRooms(){
  const rooms = [];
  raeumeContainer.querySelectorAll('.room').forEach(room=>{
    const name = room.querySelector('.room-title')?.textContent?.trim() || '';
    const fenster=[];
    room.querySelectorAll('.window').forEach(w=>{
      const id = w.dataset.winId;
      const fotos = Array.from(w.querySelectorAll('.thumb img')).map(img=> img.src);
      const canvas = w.querySelector('[data-role="canvas"]');
      const skizze = canvas ? canvas.toDataURL('image/png') : null;
      const art = (w.querySelector(`input[name="w_art_${id}"]:checked`)||{}).value || '';
      fenster.push({
        bezeichnung: w.querySelector(`[name="w_bez_${id}"]`).value || '',
        breite_mm: w.querySelector(`[name="w_breite_${id}"]`).value || '',
        hoehe_mm: w.querySelector(`[name="w_hoehe_${id}"]`).value || '',
        art,
        optionen: {
          struktur: w.querySelector(`[name="w_opt_struktur_${id}"]`).checked,
          dav: w.querySelector(`[name="w_opt_dav_${id}"]`).checked,
          schutz: w.querySelector(`[name="w_opt_schutz_${id}"]`).checked,
          abschliessbar: w.querySelector(`[name="w_opt_abs_${id}"]`).checked,
        },
        fotos, skizze
      });
    });
    rooms.push({name, fenster});
  });
  return rooms;
}
function importRooms(list){
  if (!Array.isArray(list)) return;
  raeumeContainer.innerHTML='';
  list.forEach((r)=>{ const room = addRoom(r.name || 'Raum'); const body = room.querySelector('.room-body'); (r.fenster||[]).forEach(fw=> addWindow(body, fw)); });
}

// Utility: Bild-Kompression
function compressImage(file, maxDim=1400, quality=0.85){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const ratio = Math.min(1, maxDim/Math.max(img.width, img.height));
        const cw = Math.round(img.width*ratio), ch = Math.round(img.height*ratio);
        const canvas = document.createElement('canvas'); canvas.width=cw; canvas.height=ch;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,cw,ch);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = fr.result;
    };
    fr.onerror = reject; fr.readAsDataURL(file);
  });
}
// Helpers
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function buzz(){ if ('vibrate' in navigator) navigator.vibrate(15); }
async function simulateMeasure(min=400, max=3000, jitterOnly=false){
  // Grundwert ~ gleichverteilt, plus Toleranz ±2 mm
  const base = Math.round(min + Math.random() * (max-min));
  const tol = Math.round((Math.random()*4)-2); // -2..+2
  const val = base + (jitterOnly ? Math.round((Math.random()*2)-1) : tol);
  return Math.max(min, Math.min(max, val));
}

// Testdaten
function fillDemo(){
  const set = (name, val)=>{ const el=document.querySelector(`[name="${name}"]`); if(el) el.value=val; };
  set('firma','Musterbau GmbH (TESTKUNDE)'); set('name','Max Mustermann');
  set('strasse','Beispielweg 12'); set('plz','70173'); set('ort','Stuttgart');
  set('telefon','0711 123456'); set('email','max@musterbau.example');
  document.querySelector('[name="gebaeudeart"][value="Altbau"]').checked = true;
  document.querySelector('[name="material"][value="Kunststoff"]').checked = true;
  document.querySelector('#farbeSelect').value = 'Anthrazit'; updateFarbe();
  document.querySelector('[name="glas"][value="3-fach"]').checked = true;
  document.querySelector('[name="fba"][value="Ja"]').checked = true;
  // Empfänger (TEST)
  set('empf_name','Frau Erika Beispiel (TEST)'); set('empf_tel','0711 98765');
  set('empf_strasse','Am Park 5'); set('empf_plz','70372'); set('empf_ort','Stuttgart-Bad Cannstatt');
  syncEmpfReadonly();
  // Raum+Fenster
  raeumeContainer.innerHTML=''; const room = addRoom('Wohnzimmer'); const body = room.querySelector('.room-body');
  const w1 = addWindow(body); const w2 = addWindow(body);
  const id1=w1.dataset.winId, id2=w2.dataset.winId;
  document.querySelector(`[name="w_bez_${id1}"]`).value='Fenster links';
  document.querySelector(`[name="w_breite_${id1}"]`).value='1200';
  document.querySelector(`[name="w_hoehe_${id1}"]`).value='1400';
  document.querySelector(`input[name="w_art_${id1}"][value="Drehkipp links"]`).checked=true;
  document.querySelector(`[name="w_bez_${id2}"]`).value='Fenster rechts';
  document.querySelector(`[name="w_breite_${id2}"]`).value='900';
  document.querySelector(`[name="w_hoehe_${id2}"]`).value='1200';
  document.querySelector(`input[name="w_art_${id2}"][value="Festverglast"]`).checked=true;
  saveState();
}
document.getElementById('fillDemoBtn')?.addEventListener('click', fillDemo);

// Guided Demo: führt in 3 Klicks durch
document.getElementById('demoGuideBtn')?.addEventListener('click', async ()=>{
  fillDemo();
  // Schritt 1 -> 2
  flash(document.getElementById('btnToAuftragsdaten')); await sleep(700);
  document.getElementById('btnToAuftragsdaten').click();
  // Schritt 2 -> 3
  flash(document.getElementById('btnToFensterbereich')); await sleep(700);
  document.getElementById('btnToFensterbereich').click();
  // Raum anlegen
  flash(document.getElementById('addRaumBtn')); await sleep(700);
  if (!raeumeContainer.querySelector('.room')) document.getElementById('addRaumBtn').click();
  // Fenster hinzufügen
  const roomBody = raeumeContainer.querySelector('.room .room-body');
  const addBtn = raeumeContainer.querySelector('.room [data-action="add-window"]');
  flash(addBtn); await sleep(700); addBtn.click();
});
function flash(el){ if(!el) return; el.classList.add('hl'); setTimeout(()=>el.classList.remove('hl'), 1000); }

// Submit / Drucken -> echte PDF
document.getElementById('aufmassForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  document.getElementById('loadingBar').style.display='';
  try{
    await openPdfPreview();
    document.getElementById('abschlussSeite').style.display='';
    document.querySelector('.form-wrapper form').style.display='none';
  } finally {
    document.getElementById('loadingBar').style.display='none';
  }
});
document.getElementById('newAufmassBtn')?.addEventListener('click', ()=>{ location.reload(); });
document.getElementById('printBtn')?.addEventListener('click', async ()=>{ await openPdfPreview(); });

// PDF Hook
async function openPdfPreview(){
  if (!window.PDFLib) { alert('PDF-Bibliothek nicht geladen. Prüfe vendor/pdf-lib.min.js'); return; }
  const data = collectAllData();
  await createPdfAndOpen(data);
}
function collectAllData(){
  const form = document.getElementById('aufmassForm');
  const fd = new FormData(form);
  const obj = Object.fromEntries(fd.entries());
  obj._rooms = exportRooms();
  return {
    kundendaten: {
      firma: obj.firma || '', name: obj.name || '', strasse: obj.strasse||'', plz: obj.plz||'', ort: obj.ort||'',
      telefon: obj.telefon||'', email: obj.email||'',
      empfaenger: { // in der Demo immer als TEST im PDF
        name: obj.empf_name||'Empfänger (TEST)', tel: obj.empf_tel||'',
        strasse: obj.empf_strasse||'', plz: obj.empf_plz||'', ort: obj.empf_ort||''
      }
    },
    auftragsdaten: {
      gebaeudeart: (form.querySelector('input[name="gebaeudeart"]:checked')||{}).value || '',
      material: (form.querySelector('input[name="material"]:checked')||{}).value || '',
      farbe: document.getElementById('farbeSelect')?.value || '',
      farbeSonstige: document.getElementById('farbeSonstige')?.value || '',
      glas: (form.querySelector('input[name="glas"]:checked')||{}).value || '',
      fba: (form.querySelector('input[name="fba"]:checked')||{}).value || ''
    },
    raeume: exportRooms()
  };
}

// Init
loadState();
