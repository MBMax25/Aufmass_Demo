/* PWA registration + UI glue for Schritt 1 */
});
}


// Testdaten füllen
function fillDemo(){
const set = (name, val)=>{ const el=document.querySelector(`[name="${name}"]`); if(el) el.value=val; };
set('firma','Musterbau GmbH (TESTKUNDE)');
set('name','Max Mustermann');
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
set('empf_name','Frau Erika Beispiel (TEST)');
set('empf_tel','0711 98765');
set('empf_strasse','Am Park 5'); set('empf_plz','70372'); set('empf_ort','Stuttgart-Bad Cannstatt');
// Räume/Fenster
raeumeContainer.innerHTML='';
const r = addRoom();
const body = raeumeContainer.querySelector('.room:last-child .room-body');
addWindow(body); addWindow(body);
const winds = body.querySelectorAll('.window');
winds[0].querySelector('[name="w_bez[]"]').value='Fenster links';
winds[0].querySelector('[name="w_breite[]"]').value='1200';
winds[0].querySelector('[name="w_hoehe[]"]').value='1400';
winds[1].querySelector('[name="w_bez[]"]').value='Fenster rechts';
winds[1].querySelector('[name="w_breite[]"]').value='900';
winds[1].querySelector('[name="w_hoehe[]"]').value='1200';
saveState();
}


document.getElementById('fillDemoBtn')?.addEventListener('click', fillDemo);


// Formular submit -> PDF Vorschau (Schritt 4 wird echte PDF generieren)
document.getElementById('aufmassForm')?.addEventListener('submit', (e)=>{
e.preventDefault();
document.getElementById('loadingBar').style.display='';
setTimeout(()=>{ // kurze Demo-Verzögerung
document.getElementById('loadingBar').style.display='none';
openPdfPreview();
document.getElementById('abschlussSeite').style.display='';
document.querySelector('.form-wrapper form').style.display='none';
}, 500);
});


document.getElementById('newAufmassBtn')?.addEventListener('click', ()=>{
location.reload();
});


document.getElementById('printBtn')?.addEventListener('click', ()=>{
openPdfPreview();
});


// Platzhalter für PDF-Vorschau
function openPdfPreview(){
// In Schritt 4 ersetzen wir das durch pdf-lib und ein echtes Blob-URL-PDF
const w = window.open('', '_blank');
if (!w) return;
const now = new Date();
const dt = now.toLocaleDateString('de-DE');
w.document.write(`
<style>body{font-family:system-ui; padding:24px; line-height:1.5}</style>
<h1>PDF-Vorschau (Platzhalter)</h1>
<p>Die echte PDF-Erstellung folgt in <strong>Schritt 4</strong>. Dieses Tab zeigt nur an, dass der Button korrekt verdrahtet ist.</p>
<p><strong>Datum:</strong> ${dt}</p>
<p><em>Hinweis:</em> Im finalen PDF wird der Kopf <strong>TESTKUNDE</strong> &amp; Empfänger <strong>(TEST)</strong> klar gekennzeichnet sein, mit Logo und Tabellenlayout.</p>
`);
}


// Initial load
loadState();
