/* PWA registration + UI glue (Schritt 1) + Fenster-Editor (Schritt 2) */
}


document.getElementById('fillDemoBtn')?.addEventListener('click', fillDemo);


// Formular submit -> PDF Vorschau (Schritt 4 liefert echtes PDF)
document.getElementById('aufmassForm')?.addEventListener('submit', (e)=>{
e.preventDefault();
document.getElementById('loadingBar').style.display='';
setTimeout(()=>{
document.getElementById('loadingBar').style.display='none';
openPdfPreview();
document.getElementById('abschlussSeite').style.display='';
document.querySelector('.form-wrapper form').style.display='none';
}, 500);
});


document.getElementById('newAufmassBtn')?.addEventListener('click', ()=>{ location.reload(); });


document.getElementById('printBtn')?.addEventListener('click', ()=>{ openPdfPreview(); });


// Platzhalter für PDF-Vorschau (Schritt 4 ersetzt dies)
function openPdfPreview(){
const w = window.open('', '_blank');
if (!w) return;
const now = new Date();
const dt = now.toLocaleDateString('de-DE');
const data = collectAllData();
w.document.write(`
<style>body{font-family:system-ui; padding:24px; line-height:1.5} .mono{font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; white-space:pre-wrap;}</style>
<h1>PDF-Vorschau (Platzhalter)</h1>
<p>Die echte PDF-Erstellung folgt in <strong>Schritt 4</strong>. Dieses Tab zeigt nur an, dass der Button korrekt verdrahtet ist.</p>
<p><strong>Datum:</strong> ${dt}</p>
<h3>Daten (Kurzfassung)</h3>
<div class="mono">${escapeHtml(JSON.stringify({kundendaten: data.kundendaten, auftragsdaten: data.auftragsdaten, raeume: data.raeume.map(r=>({name:r.name, fenster:r.fenster.map(f=>({bez:f.bezeichnung,b:f.breite_mm,h:f.hoehe_mm,art:f.art,fotos:f.fotos.length,skizze: !!f.skizze}))}))}, null, 2))}</div>
<p><em>Im finalen PDF werden TESTKUNDE & Empfänger (TEST) im Kopf klar markiert, inkl. Logo und Tabellenlayout.</em></p>
`);
}


function collectAllData(){
const form = document.getElementById('aufmassForm');
const fd = new FormData(form);
const obj = Object.fromEntries(fd.entries());
obj._rooms = exportRooms();
return {
kundendaten: {
firma: obj.firma || '', name: obj.name || '', strasse: obj.strasse||'', plz: obj.plz||'', ort: obj.ort||'', telefon: obj.telefon||'', email: obj.email||'',
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


function escapeHtml(s){
return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}


// Initial load
loadState();
