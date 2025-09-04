// Erzeugt ein formatiertes A4-PDF mit Logo, TEST-Markierungen, Tabellen, Fotos & Skizze
async function createPdfAndOpen(data){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  // ---- Setup
  const A4 = { w: 595.28, h: 841.89 };
  const MARGIN = 36;
  const CONTENT_W = A4.w - 2*MARGIN;

  const doc = await PDFDocument.create();
  const fontR = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);

  // Logo (PNG empfohlen)
  let logoImg = null;
  try {
    const res = await fetch('assets/logo@2x.png');
    if (res.ok) {
      const bytes = await res.arrayBuffer();
      // versuchen PNG, fallback JPG
      try { logoImg = await doc.embedPng(bytes); } catch { logoImg = await doc.embedJpg(bytes); }
    }
  } catch {}

  // Seiten-Verwaltung
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  let pageNo = 1;
  const pagesForFooter = [];

  function newPage(){
    drawFooter(page, pageNo);
    pagesForFooter.push(page);
    page = doc.addPage([A4.w, A4.h]);
    pageNo++; y = A4.h - MARGIN;
  }
  function ensure(h){
    if (y - h < MARGIN + 24) newPage(); // 24pt Footer-Raum
  }
  function text(txt, x, yPos, opts={}){
    const { size=10, font=fontR, color=rgb(0,0,0) } = opts;
    page.drawText(String(txt ?? ''), { x, y: yPos, size, font, color });
  }
  function line(x1,y1,x2,y2,color=rgb(0.85,0.85,0.9)){ page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, color, thickness:1 }); }
  function wrap(txt, maxW, size=10, font=fontR){
    const words = String(txt||'').split(/\s+/);
    const lines=[]; let cur='';
    for (const w of words){
      const tryLine = cur ? (cur+' '+w) : w;
      if (font.widthOfTextAtSize(tryLine, size) <= maxW) cur = tryLine;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function badge(x, yPos, label, opts={}) {
    const { fill=rgb(0.06,0.65,0.38), padX=6, padY=3, size=9 } = opts;
    const w = fontB.widthOfTextAtSize(label, size) + padX*2;
    const h = size + padY*2;
    page.drawRectangle({ x, y: yPos - h + 2, width: w, height: h, color: fill, opacity: 0.9 });
    page.drawText(label, { x: x+padX, y: yPos - size, size, font: fontB, color: rgb(1,1,1) });
    return w;
  }
  function sectionTitle(title){
    const size=13;
    ensure(26);
    y -= 10;
    text(title, MARGIN, y, { size, font: fontB, color: rgb(0.09,0.45,0.8) });
    y -= 6;
    line(MARGIN, y, MARGIN+CONTENT_W, y, rgb(0.7,0.78,0.9));
    y -= 10;
  }
  function keyVal(label, val, colX, colW){
    const labelSize = 9, valSize=10;
    const lw = Math.min(110, colW*0.35);
    text(label, colX, y, { size: labelSize, font: fontB, color: rgb(0.2,0.25,0.35) });
    const lines = wrap(val, colW - lw - 8, valSize);
    const h = Math.max(14, lines.length * (valSize+2));
    ensure(h);
    // value
    let yy = y;
    for (const ln of lines){ text(ln, colX+lw+8, yy, { size: valSize }); yy -= (valSize+2); }
    y -= h + 2;
  }

  // ---- Header
  (function header(){
    const title = 'Aufmaß – DEMO';
    const dateStr = new Date().toLocaleDateString('de-DE');
    const headH = 54;
    ensure(headH);

    // Logo links
    let lx = MARGIN, lw = 0, lh = 0;
    if (logoImg){
      lw = Math.min(120, logoImg.width); lh = logoImg.height * (lw / logoImg.width);
      page.drawImage(logoImg, { x:MARGIN, y:y - lh + 8, width: lw, height: lh });
      lx = MARGIN + lw + 12;
    }

    // Titel rechts vom Logo
    text(title, lx, y, { size:16, font: fontB });
    text(`Datum: ${dateStr}`, lx, y-18, { size:10, font: fontR, color: rgb(0.25,0.3,0.4) });

    y -= headH - 8;

    // Auftraggeber + Empfänger in zwei Spalten
    const leftW = (CONTENT_W - 12)/2;
    const rightW = leftW;
    // Links: Auftraggeber (TESTKUNDE)
    let yStart = y;
    text('Auftraggeber', MARGIN, y, { size:11, font:fontB }); const bw = badge(MARGIN+90, y+9, 'TESTKUNDE', { fill: rgb(0.91,0.45,0.1) });
    y -= 16;
    const kd = data.kundendaten || {};
    const l0 = [
      ['Firma', kd.firma || ''],
      ['Name', kd.name || ''],
      ['Straße', kd.strasse || ''],
      ['PLZ/Ort', `${kd.plz||''} ${kd.ort||''}`.trim()],
      ['Telefon', kd.telefon || ''],
      ['E-Mail', kd.email || '']
    ];
    const yLeftStart = y;
    for (const [k,v] of l0){ keyVal(k, v, MARGIN, leftW); }
    const yLeftEnd = y;

    // Rechts: Empfänger (TEST)
    y = yStart;
    const emp = kd.empfaenger;
    text('Empfänger', MARGIN+leftW+12, y, { size:11, font:fontB });
    badge(MARGIN+leftW+12+70, y+9, 'TEST', { fill: rgb(0.15,0.65,0.9) });
    y -= 16;
    if (emp){
      const r0 = [
        ['Name', emp.name || ''],
        ['Telefon', emp.tel || ''],
        ['Straße', emp.strasse || ''],
        ['PLZ/Ort', `${emp.plz||''} ${emp.ort||''}`.trim()]
      ];
      for (const [k,v] of r0){ keyVal(k, v, MARGIN+leftW+12, rightW); }
    } else {
      keyVal('Hinweis', 'Kein Empfänger erfasst.', MARGIN+leftW+12, rightW);
    }
    // Unterkante beider Spalten angleichen
    y = Math.min(yLeftEnd, y);
    y -= 8;
  })();

  // ---- Auftragsdaten
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
  // zeichne in zwei Spalten
  let yAdStart = y;
  for (let i=0;i<adPairs.length;i+=2){
    // linke Spalte
    const [k1,v1] = adPairs[i];
    keyVal(k1, v1, MARGIN, twoColW);
    const yAfterLeft = y;
    // rechte Spalte (falls vorhanden)
    if (adPairs[i+1]){
      y = yAdStart;
      const [k2,v2] = adPairs[i+1];
      keyVal(k2, v2, MARGIN+twoColW+12, twoColW);
      yAdStart = y; // kleiner von beiden
      y = Math.min(yAfterLeft, y);
    } else {
      y = yAfterLeft;
    }
    yAdStart = y;
  }
  y -= 4;

  // ---- Räume & Fenster
  const rooms = Array.isArray(data.raeume) ? data.raeume : [];
  for (const room of rooms){
    sectionTitle(`Raum: ${room.name || ''}`);
    const windows = Array.isArray(room.fenster) ? room.fenster : [];
    if (!windows.length){
      keyVal('Hinweis', 'Keine Fenster erfasst.', MARGIN, CONTENT_W);
      continue;
    }

    for (const w of windows){
      // window card metrics
      const cardPad = 8, gap=6;
      const cardTop = y;
      // Schätze Mindesthöhe ohne Bilder
      ensure(110);

      // Rahmen
      const cardW = CONTENT_W;
      const cardHmin = 110; // Mindesthöhe
      // Wir zeichnen Inhalte und passen y nach Bildern an

      // Titelzeile
      text(w.bezeichnung || 'Fenster', MARGIN+cardPad, y, { size:11, font:fontB });
      y -= 14;

      // Metadaten
      const mLeftW = (CONTENT_W - 12)/2;
      keyVal('Maße (mm)', `${w.breite_mm||'–'} × ${w.hoehe_mm||'–'}`, MARGIN+cardPad, mLeftW - cardPad);
      const yAfterLeft = y;
      y = cardTop - 14; // neben Titel starten
      keyVal('Öffnungsart', w.art || '–', MARGIN+cardPad+mLeftW+12, mLeftW - cardPad);
      // Optionen in eine Zeile
      const opts = [];
      if (w.optionen?.struktur) opts.push('Struktur');
      if (w.optionen?.dav) opts.push('Druckausgleichventil');
      if (w.optionen?.schutz) opts.push('Schallschutz');
      if (w.optionen?.abschliessbar) opts.push('Abschließbar');
      const optStr = opts.length ? opts.join(', ') : '–';
      keyVal('Optionen', optStr, MARGIN+cardPad+mLeftW+12, mLeftW - cardPad);
      y = Math.min(yAfterLeft, y);
      y -= 4;

      // Bilder (Fotos + Skizze) in Grid (max 3 pro Zeile)
      const imgs = [];
      (w.fotos||[]).forEach(u=> imgs.push(u));
      if (w.skizze) imgs.push(w.skizze);
      if (imgs.length){
        const perRow = 3;
        const gapX = 8;
        const thumbW = Math.floor((CONTENT_W - cardPad*2 - gapX*(perRow-1)) / perRow);
        const thumbH = Math.floor(thumbW * 0.66);

        for (let i=0;i<imgs.length;i++){
          const col = i % perRow, row = Math.floor(i/perRow);
          if (col === 0){ ensure(thumbH + 6); }
          const x = MARGIN+cardPad + col*(thumbW + gapX);
          const yImgTop = y;
          // Daten-URL -> Bytes
          const isPng = imgs[i].startsWith('data:image/png');
          const bytes = dataUrlToBytes(imgs[i]);
          const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const scale = Math.min(thumbW / img.width, thumbH / img.height);
          const wpt = img.width * scale, hpt = img.height * scale;
          page.drawImage(img, { x, y: y - hpt, width: wpt, height: hpt });
          // nächste Spalte
          if (col === perRow-1 || i === imgs.length-1){
            y -= (thumbH + 6);
          }
        }
      }

      // dünne Trennlinie
      y -= 4; line(MARGIN, y, MARGIN+CONTENT_W, y, rgb(0.85,0.85,0.9)); y -= 6;
    }
  }

  // Footer letzte Seite
  drawFooter(page, pageNo);
  pagesForFooter.push(page);

  // Ausgabe
  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type:'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// ---- Helfer
function dataUrlToBytes(dataUrl){
  const comma = dataUrl.indexOf(',');
  const b64 = dataUrl.substring(comma+1);
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function drawFooter(page, pageNo){
  const { rgb, StandardFonts } = PDFLib;
  const fontSize = 9;
  const margin = 36;
  const text = 'API-ready • Automatisierungen möglich';
  const w = page.getWidth();
  const ctx = page.doc; // not used
  // Linke Fußnote
  page.drawText(text, { x: margin, y: 18, size: fontSize, font: page.node.doc.context.standardFont || undefined, color: rgb(0.35,0.4,0.5) });
  // Rechte Seitenzahl
  const s = `Seite ${pageNo}`;
  page.drawText(s, { x: w - margin - 60, y: 18, size: fontSize, color: rgb(0.35,0.4,0.5) });
}
