/* PWA + Formular + Fenster-Editor (wie zuvor) – plus Hook für echte PDF-Erzeugung */
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
  connectionBadge.className = 'badge ' + (online ? 'badge-online' : 'badge-offline');
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ---------------------------
// State-Persistenz
// ---------------------------
const FORM_KEY = 'aufmass-demo-form-v2';
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
    if (obj.empf_name || obj.empf_tel || obj.empf_strasse){
      document.getElementById('empfaengerToggle').checked = true;
      document.getElementById('empfaengerBlock').style.display = '';
    }
    importRooms(obj._rooms || []);
  } catch(e){ console.warn('loadState failed', e); }
}
let saveTimer=null;
document.getElementById('aufmassForm').addEventListener('input', ()=>{
  clearTimeout(saveTimer); saveTimer=setTimeout(saveState, 300);
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

// Empfänger Toggle
const empfaengerToggle = document.getElementById('empfaengerToggle');
empfaengerToggle?.addEventListener('change', (e)=>{ document.getElementById('empfaengerBlock').style.display = e.target.checked ? '' : 'none'; });

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
        <label class="inline-checkbox-item"><input type="checkbox" data-role="sim-enabled" /> aktivieren</label>
        <button type="button" class="btn" data-action="sim-breite" disabled>Messen Breite</button>
        <button type="button" class="btn" data-action="sim-hoehe" disabled>Messen Höhe</button>
        <button type="button" class="btn" data-action="sim-stream" disabled>Live-Stream 1 s</button>
        <small>Simulation wird in Schritt 3 aktiviert.</small>
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
  function move(e){ if(!drawing) return; const p=getPos(e); ctx.strokeStyle='#e6eef7'; ctx.lineWidth=Number(pen.value||3); ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; }
  function end(){ drawing=false; }
  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', (e)=>{start(e); e.preventDefault();},{passive:false});
  canvas.addEventListener('touchmove', (e)=>{move(e); e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend', end);
  div.querySelector('[data-action="sketch-clear"]').addEventListener('click', ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); status.textContent='geleert (nicht gespeichert)'; saveState(); });
  div.querySelector('[data-action="sketch-save"]').addEventListener('click', ()=>{ status.textContent='gespeichert'; saveState(); });

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
    if (data.skizze){ const img=new Image(); img.onload=()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); status.textContent='gespeichert'; }; img.src=data.skizze; }
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
  document.getElementById('empfaengerToggle').checked = true;
  document.getElementById('empfaengerBlock').style.display = '';
  set('empf_name','Frau Erika Beispiel (TEST)'); set('empf_tel','0711 98765');
  set('empf_strasse','Am Park 5'); set('empf_plz','70372'); set('empf_ort','Stuttgart-Bad Cannstatt');
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

// Submit / Drucken
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

// ECHTE PDF
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
      empfaenger: (document.getElementById('empfaengerToggle').checked ? { name: obj.empf_name||'', tel: obj.empf_tel||'', strasse: obj.empf_strasse||'', plz: obj.empf_plz||'', ort: obj.empf_ort||'' } : null)
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

// Initial
loadState();
