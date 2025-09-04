// Formatiertes A4-PDF mit Logo, Kopf (TESTKUNDE), Tabellen, Fotos & Skizze (helles Layout)
async function createPdfAndOpen(data){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  const A4 = { w: 595.28, h: 841.89 }, MARGIN = 36, CONTENT_W = A4.w - 2*MARGIN;
  const doc = await PDFDocument.create();
  const fontR = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);

  // Logo
  const logoBytes = await loadLogoPngBytes();
  const logoImg = logoBytes ? await doc.embedPng(logoBytes) : null;

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  let pageNo = 1;

  function newPage(){ drawFooter(page, pageNo); page = doc.addPage([A4.w, A4.h]); pageNo++; y = A4.h - MARGIN; }
  function ensure(h){ if (y - h < MARGIN + 24) newPage(); }
  function text(txt, x, yPos, opts={}){ const { size=10, font=fontR, color=rgb(0,0,0) }=opts; page.drawText(String(txt ?? ''), { x, y: yPos, size, font, color }); }
  function line(x1,y1,x2,y2,color=rgb(0.86,0.86,0.9)){ page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, color, thickness:1 }); }
  function wrap(txt, maxW, size=10, font=fontR){
    const words = String(txt||'').split(/\s+/); const lines=[]; let cur='';
    for (const w of words){ const tryLine = cur ? (cur+' '+w) : w;
      if (font.widthOfTextAtSize(tryLine, size) <= maxW) cur = tryLine; else { if (cur) lines.push(cur); cur = w; } }
    if (cur) lines.push(cur); return lines;
  }
  function badge(x, yPos, label, opts={}) {
    const { fill=rgb(1,0.59,0.2), padX=6, padY=3, size=9 } = opts;
    const w = fontB.widthOfTextAtSize(label, size) + padX*2, h = size + padY*2;
    page.drawRectangle({ x, y: yPos - h + 2, width: w, height: h, color: fill, opacity: 0.95 });
    page.drawText(label, { x: x+padX, y: yPos - size, size, font: fontB, color: rgb(1,1,1) });
    return w;
  }
  function sectionTitle(title){
    const size=13; ensure(26); y -= 10;
    text(title, MARGIN, y, { size, font: fontB, color: rgb(0.08,0.35,0.75) });
    y -= 6; line(MARGIN, y, MARGIN+CONTENT_W, y, rgb(0.85,0.85,0.9)); y -= 10;
  }
  function keyVal(label, val, colX, colW){
    const labelSize = 9, valSize=10; const lw = Math.min(110, colW*0.35); ensure(14);
    text(label, colX, y, { size: labelSize, font: fontB, color: rgb(0.25,0.28,0.35) });
    const lines = wrap(val, colW - lw - 8, valSize);
    const h = Math.max(14, lines.length * (valSize+2)); let yy = y;
    for (const ln of lines){ text(ln, colX+lw+8, yy, { size: valSize }); yy -= (valSize+2); }
    y -= h + 2;
  }

  // Header: Logo + Titel + Datum + Auftraggeber (TESTKUNDE)
  (function header(){
    const title = 'Aufmaß – DEMO';
    const dateStr = new Date().toLocaleDateString('de-DE');
    const headH = 60; ensure(headH);

    // Logo
    let lx = MARGIN;
    if (logoImg){
      const maxW = 150;
      const w = Math.min(maxW, logoImg.width), h = logoImg.height * (w / logoImg.width);
      page.drawImage(logoImg, { x:MARGIN, y:y - h + 8, width: w, height: h });
      lx = MARGIN + w + 12;
    }

    text(title, lx, y, { size:16, font: fontB });
    text(`Datum: ${dateStr}`, lx, y-18, { size:10, font: fontR, color: rgb(0.25,0.3,0.4) });

    y -= headH - 6;

    // Auftraggeber links (einspaltig)
    const kd = data.kundendaten || {};
    text('Auftraggeber', MARGIN, y, { size:11, font:fontB });
    badge(MARGIN+90, y+9, 'TESTKUNDE', { fill: rgb(0.95,0.55,0.18) });
    y -= 16;

    const leftW = CONTENT_W;
    const l0 = [
      ['Firma', kd.firma || ''],
      ['Name', kd.name || ''],
      ['Straße', kd.strasse || ''],
      ['PLZ/Ort', `${kd.plz||''} ${kd.ort||''}`.trim()],
      ['Telefon', kd.telefon || ''],
      ['E-Mail', kd.email || '']
    ];
    for (const [k,v] of l0){ keyVal(k, v, MARGIN, leftW); }
    y -= 8;
  })();

  // Auftragsdaten (zweispaltig)
  sectionTitle('Auftragsdaten');
  const ad = data.auftragsdaten || {};
  const adPairs = [
    ['Gebäudeart', ad.gebaeudeart || ''],
    ['Material', ad.material || ''],
    ['Farbe', ad.farbe === 'Sonstige' ? `${ad.farbe} – ${ad.farbeSonstige||''}` : (ad.farbe || '')],
    ['Glas', ad.glas || ''],
    ['FBA', ad.fba || '']
  ];
  const twoColW = (CONTENT_W - 12)/2;
  let yAdStart = y;
  for (let i=0;i<adPairs.length;i+=2){
    const [k1,v1] = adPairs[i]; keyVal(k1, v1, MARGIN, twoColW); const yAfterLeft = y;
    if (adPairs[i+1]){ y = yAdStart; const [k2,v2] = adPairs[i+1]; keyVal(k2, v2, MARGIN+twoColW+12, twoColW); yAdStart = y; y = Math.min(yAfterLeft, y); }
    else { y = yAfterLeft; }
    yAdStart = y;
  }
  y -= 4;

  // Räume & Fenster
  const rooms = Array.isArray(data.raeume) ? data.raeume : [];
  for (const room of rooms){
    sectionTitle(`Raum: ${room.name || ''}`);
    const windows = Array.isArray(room.fenster) ? room.fenster : [];
    if (!windows.length){ keyVal('Hinweis', 'Keine Fenster erfasst.', MARGIN, CONTENT_W); continue; }

    for (const w of windows){
      ensure(110);
      text(w.bezeichnung || 'Fenster', MARGIN, y, { size:11, font:fontB });
      y -= 14;

      const colW = (CONTENT_W - 12)/2;
      keyVal('Maße (mm)', `${w.breite_mm||'–'} × ${w.hoehe_mm||'–'}`, MARGIN, colW);
      const yAfterLeft = y; y += 14;
      keyVal('Öffnungsart', w.art || '–', MARGIN+colW+12, colW);
      const opts = []; if (w.optionen?.struktur) opts.push('Struktur'); if (w.optionen?.dav) opts.push('Druckausgleichventil'); if (w.optionen?.schutz) opts.push('Schallschutz'); if (w.optionen?.abschliessbar) opts.push('Abschließbar');
      keyVal('Optionen', opts.length ? opts.join(', ') : '–', MARGIN+colW+12, colW);
      y = Math.min(yAfterLeft, y);
      y -= 4;

      // Bilder
      const imgs = []; (w.fotos||[]).forEach(u=> imgs.push(u)); if (w.skizze) imgs.push(w.skizze);
      if (imgs.length){
        const perRow = 3, gapX = 8;
        const thumbW = Math.floor((CONTENT_W - gapX*(perRow-1)) / perRow);
        const thumbH = Math.floor(thumbW * 0.66);
        for (let i=0;i<imgs.length;i++){
          const col = i % perRow; if (col === 0){ ensure(thumbH + 6); }
          const x = MARGIN + col*(thumbW + gapX);
          const isPng = imgs[i].startsWith('data:image/png');
          const bytes = dataUrlToBytes(imgs[i]);
          const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const scale = Math.min(thumbW / img.width, thumbH / img.height);
          const wpt = img.width * scale, hpt = img.height * scale;
          page.drawImage(img, { x, y: y - hpt, width: wpt, height: hpt });
          if (col === perRow-1 || i === imgs.length-1){ y -= (thumbH + 6); }
        }
      }
      y -= 2; line(MARGIN, y, MARGIN+CONTENT_W, y, rgb(0.86,0.86,0.9)); y -= 6;
    }
  }

  // Footer
  drawFooter(page, pageNo);

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type:'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// ---- Hilfsfunktionen
async function loadLogoPngBytes(){
  try {
    const res = await fetch('assets/logo@2x.png', { cache:'no-cache' });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
  } catch {}
  try {
    const res = await fetch('assets/logo.svg', { cache:'no-cache' });
    if (!res.ok) return null;
    const svgText = await res.text();
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const targetW = 500;
    const scale = targetW / img.width;
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL('image/png', 1);
    return dataUrlToBytes(pngUrl);
  } catch { return null; }
}
function loadImage(url){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=url; }); }
function dataUrlToBytes(dataUrl){
  const b64 = dataUrl.substring(dataUrl.indexOf(',')+1);
  const bin = atob(b64); const len = bin.length; const bytes = new Uint8Array(len);
  for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i); return bytes;
}
function drawFooter(page, pageNo){
  const { rgb } = PDFLib; const margin = 36; const w = page.getWidth();
  page.drawText('API-ready • Automatisierungen möglich', { x: margin, y: 18, size: 9, color: rgb(0.35,0.4,0.5) });
  page.drawText(`Seite ${pageNo}`, { x: w - margin - 60, y: 18, size: 9, color: rgb(0.35,0.4,0.5) });
}
