/* Sello de Obra — núcleo compartido (página y procesador en segundo plano) */
(function (G) {
  "use strict";
  const Sello = {};

  /* ---------- Geodesia WGS84 <-> UTM ---------- */
  const A = 6378137, F = 1 / 298.257223563, K0 = 0.9996, E2 = F * (2 - F), EP2 = E2 / (1 - E2);
  Sello.toUTM = function (lat, lon) {
    const zone = Math.min(60, Math.floor((lon + 180) / 6) + 1);
    const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180, lam0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
    const N = A / Math.sqrt(1 - E2 * s * s), T = t * t, C = EP2 * c * c, Aa = c * (lam - lam0);
    const e4 = E2 * E2, e6 = e4 * E2;
    const M = A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) - (35 * e6 / 3072) * Math.sin(6 * phi));
    const E = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
    let Nn = K0 * (M + N * t * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
    if (lat < 0) Nn += 10000000;
    const bands = "CDEFGHJKLMNPQRSTUVWXX";
    const band = bands[Math.max(0, Math.min(20, Math.floor((lat + 80) / 8)))];
    return { zone, band, E, N: Nn };
  };
  Sello.fromUTM = function (E, Nn, zone, south) {
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const x = E - 500000, y = south ? Nn - 10000000 : Nn;
    const M = y / K0, e4 = E2 * E2, e6 = e4 * E2;
    const mu = M / (A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
    const N1 = A / Math.sqrt(1 - E2 * s * s), T1 = t * t, C1 = EP2 * c * c, R1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5), D = x / (N1 * K0);
    const lat = p1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / c;
    return { lat: lat * 180 / Math.PI, lon: ((zone - 1) * 6 - 180 + 3) + lon * 180 / Math.PI };
  };

  /* ---------- Lugares (ciudad automática) ---------- */
  const PLACES = [
    ["Cusco","Cusco",-13.5167,-71.9781],["Wánchaq","Cusco",-13.5250,-71.9670],["San Sebastián","Cusco",-13.5310,-71.9360],
    ["San Jerónimo","Cusco",-13.5450,-71.8850],["Santiago","Cusco",-13.5300,-71.9900],["Saylla","Cusco",-13.5700,-71.8300],
    ["Poroy","Cusco",-13.4950,-72.0430],["Ccorca","Cusco",-13.5850,-72.0590],["Calca","Cusco",-13.3220,-71.9560],["Pisac","Cusco",-13.4220,-71.8490],
    ["Lamay","Cusco",-13.3640,-71.9220],["Coya","Cusco",-13.3870,-71.9020],["Taray","Cusco",-13.4280,-71.8670],["Urubamba","Cusco",-13.3050,-72.1160],
    ["Huayoccari","Cusco",-13.3330,-72.0700],["Yucay","Cusco",-13.3190,-72.0840],["Huayllabamba","Cusco",-13.3400,-72.0640],["Ollantaytambo","Cusco",-13.2580,-72.2630],
    ["Chinchero","Cusco",-13.3920,-72.0480],["Maras","Cusco",-13.3360,-72.1560],["Anta","Cusco",-13.4690,-72.1480],["Huarocondo","Cusco",-13.4140,-72.2080],
    ["Limatambo","Cusco",-13.4800,-72.4420],["Zurite","Cusco",-13.4560,-72.2560],["Oropesa","Cusco",-13.5940,-71.7650],["Lucre","Cusco",-13.6330,-71.7380],
    ["Andahuaylillas","Cusco",-13.6730,-71.6780],["Huaro","Cusco",-13.6900,-71.6400],["Urcos","Cusco",-13.6870,-71.6240],["Paucartambo","Cusco",-13.3170,-71.5960],
    ["Ocongate","Cusco",-13.6280,-71.3880],["Quillabamba","Cusco",-12.8630,-72.6920],["Machupicchu","Cusco",-13.1550,-72.5250],["Combapata","Cusco",-14.1010,-71.4290],
    ["Sicuani","Cusco",-14.2700,-71.2260],["Yauri (Espinar)","Cusco",-14.7920,-71.4100],["Santo Tomás","Cusco",-14.4500,-72.0820],["Acomayo","Cusco",-13.9190,-71.6830],
    ["Paruro","Cusco",-13.7610,-71.8470],["Abancay","Apurímac",-13.6340,-72.8810],["Andahuaylas","Apurímac",-13.6560,-73.3870],["Puno","Puno",-15.8400,-70.0219],
    ["Juliaca","Puno",-15.5000,-70.1330],["Arequipa","Arequipa",-16.3989,-71.5350],["Moquegua","Moquegua",-17.1960,-70.9350],["Tacna","Tacna",-18.0066,-70.2463],
    ["Puerto Maldonado","Madre de Dios",-12.5933,-69.1891],["Ayacucho","Ayacucho",-13.1600,-74.2240],["Huancayo","Junín",-12.0651,-75.2049],["Ica","Ica",-14.0678,-75.7286],
    ["Lima","Lima",-12.0464,-77.0428],["Huaraz","Áncash",-9.5278,-77.5278],["Trujillo","La Libertad",-8.1116,-79.0288],["Cajamarca","Cajamarca",-7.1617,-78.5128],
    ["Chiclayo","Lambayeque",-6.7714,-79.8409],["Piura","Piura",-5.1945,-80.6328],["Iquitos","Loreto",-3.7491,-73.2538],["Pucallpa","Ucayali",-8.3791,-74.5539]];
  function hav(a, b, c, d) { const r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); }
  Sello.nearestCity = function (lat, lon) {
    let best = null, bd = 1e9;
    for (const p of PLACES) { const d = hav(lat, lon, p[2], p[3]); if (d < bd) { bd = d; best = p; } }
    if (!best) return "";
    const name = best[0] + ", " + best[1] + ", Perú";
    return bd > 30 ? "Cerca de " + name + " (~" + Math.round(bd) + " km)" : name;
  };

  /* ---------- Formatos ---------- */
  const pad = (n, k) => String(n).padStart(k || 2, "0");
  Sello.pad = pad;
  Sello.fmtDate = d => pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + "  " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  Sello.grp = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  Sello.dirName = deg => ["N","NE","E","SE","S","SO","O","NO"][Math.round(((deg % 360) + 360) % 360 / 45) % 8];

  /* ---------- Dibujo del sello ---------- */
  Sello.stamp = function (ctx, W, H, lines, s, logo) {
    if (!lines.length && !logo) return;
    const fs = Math.max(9, Math.min(W, H) * s.size / 100);
    const lh = fs * 1.38, padd = fs * 0.8, bar = Math.max(2, fs * 0.22);
    const fUI = '"Archivo", system-ui, "Segoe UI", Roboto, sans-serif', fM = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
    const raw = lines.map(l => {
      const size = l.b ? fs * 1.18 : fs;
      const keyFont = "600 " + (fs * 0.78) + "px " + fUI;
      const valFont = (l.b ? "700 " : l.i ? "italic 400 " : "500 ") + size + "px " + (l.m ? fM : fUI);
      ctx.font = keyFont; const kw = l.k ? ctx.measureText(l.k.toUpperCase()).width : 0;
      ctx.font = valFont; const vw = ctx.measureText(l.t).width;
      return { l, keyFont, valFont, kw, vw, h: l.b ? lh * 1.12 : lh };
    });
    const kmax = Math.max(0, ...raw.map(i => i.kw));
    const keyCol = kmax ? kmax + fs * 0.6 : 0;
    /* Partir en varias líneas los textos largos (descripción, ubicación, nota) */
    const fixedW = Math.max(0, ...raw.filter(i => !i.l.w).map(i => (i.l.k ? keyCol : 0) + i.vw));
    const limit = Math.max(fixedW, Math.min(W * 0.55, W - fs * 4));
    const items = [];
    for (const it of raw) {
      const off = it.l.k ? keyCol : 0;
      if (!it.l.w || off + it.vw <= limit) { items.push(it); continue; }
      ctx.font = it.valFont;
      const words = it.l.t.split(/\s+/); let cur = "", first = true;
      const flush = () => {
        const l = Object.assign({}, it.l, { t: cur, k: first ? it.l.k : "" , cont: !first && !!it.l.k });
        items.push(Object.assign({}, it, { l, vw: ctx.measureText(cur).width })); first = false; cur = "";
      };
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (cur && off + ctx.measureText(test).width > limit) flush();
        cur = cur ? cur + " " + w : w;
      }
      if (cur) flush();
    }
    let tw = Math.max(0, ...items.map(i => ((i.l.k || i.l.cont) ? keyCol : 0) + i.vw));
    const logoH = logo ? fs * 2.8 : 0, logoW = logo ? logoH * logo.width / logo.height : 0;
    tw = Math.max(tw, logoW);
    const maxW = W - fs * 2 - padd * 2 - bar;
    const scale = tw > maxW ? maxW / tw : 1;
    const th = items.reduce((a, i) => a + i.h, 0) + (logo && items.length ? logoH + fs * 0.5 : logoH);
    const boxW = (tw * scale) + padd * 2 + bar, boxH = th * scale + padd * 1.6;
    const m = fs * 0.9;
    let x, y, bw = boxW;
    if (s.pos === "band") { x = 0; y = H - boxH; bw = W; }
    else { x = s.pos.endsWith("l") ? m : W - m - boxW; y = s.pos.startsWith("b") ? H - m - boxH : m; }
    ctx.save();
    if (s.style === "box" || s.style === "light") {
      ctx.fillStyle = s.style === "box" ? "rgba(10,14,18," + (s.opacity != null ? s.opacity : 0.62) + ")" : "rgba(255,255,255," + Math.min(0.95, (s.opacity != null ? s.opacity : 0.62) + 0.2) + ")";
      const r = s.pos === "band" ? 0 : fs * 0.35;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, bw, boxH, r); else ctx.rect(x, y, bw, boxH); ctx.fill();
      ctx.fillStyle = s.accent === "#ffffff" && s.style === "light" ? "#222" : s.accent;
      ctx.fillRect(x, y + r, bar, boxH - 2 * r);
    }
    const dark = s.style === "light";
    const txt = dark ? "#121820" : "#ffffff", key = dark ? "#4a5560" : "rgba(255,255,255,0.74)";
    if (s.style === "shadow") { ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = fs * 0.45; ctx.shadowOffsetY = fs * 0.06; }
    ctx.translate(x + bar + padd, y + padd * 0.8); ctx.scale(scale, scale);
    ctx.textBaseline = "alphabetic";
    let cy = 0;
    if (logo) { ctx.drawImage(logo, 0, 0, logoW, logoH); cy += logoH + (items.length ? fs * 0.5 : 0); }
    for (const it of items) {
      cy += it.h; const base = cy - it.h * 0.3;
      let cx = it.l.cont ? keyCol : 0;
      if (it.l.k) { ctx.font = it.keyFont; ctx.fillStyle = (it.l.hl && !dark) ? s.accent : key; ctx.fillText(it.l.k.toUpperCase(), 0, base); cx = keyCol; }
      ctx.font = it.valFont; ctx.fillStyle = it.l.b && !dark ? s.accent : txt; ctx.fillText(it.l.t, cx, base);
    }
    ctx.restore();
  };

  /* ---------- CRC32 (para ZIP) ---------- */
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  Sello.crc32 = function (u8, prev) {
    let c = (prev === undefined ? 0 : prev) ^ 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  /* ---------- EXIF: copiar el bloque original a la foto sellada ---------- */
  function extractExif(u8) {
    if (u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    let i = 2;
    while (i + 4 <= u8.length) {
      if (u8[i] !== 0xFF) return null;
      const mk = u8[i + 1];
      if (mk === 0xDA || mk === 0xD9) return null;
      const len = (u8[i + 2] << 8) | u8[i + 3];
      if (mk === 0xE1 && i + 10 <= u8.length && u8[i + 4] === 0x45 && u8[i + 5] === 0x78 && u8[i + 6] === 0x69 && u8[i + 7] === 0x66 && u8[i + 8] === 0 && u8[i + 9] === 0) {
        if (i + 2 + len > u8.length) return null;
        const seg = u8.slice(i, i + 2 + len);
        fixOrientation(seg);
        return seg;
      }
      i += 2 + len;
    }
    return null;
  }
  function fixOrientation(seg) {
    try {
      const t = 10, le = seg[t] === 0x49;
      const g16 = o => le ? seg[o] | (seg[o + 1] << 8) : (seg[o] << 8) | seg[o + 1];
      const g32 = o => le ? (seg[o] | (seg[o + 1] << 8) | (seg[o + 2] << 16) | (seg[o + 3] << 24)) >>> 0 : ((seg[o] << 24) | (seg[o + 1] << 16) | (seg[o + 2] << 8) | seg[o + 3]) >>> 0;
      const ifd = t + g32(t + 4);
      if (ifd + 2 > seg.length) return;
      const n = g16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > seg.length) return;
        if (g16(e) === 0x0112) { if (le) { seg[e + 8] = 1; seg[e + 9] = 0; } else { seg[e + 8] = 0; seg[e + 9] = 1; } return; }
      }
    } catch (e) { }
  }

  /* ---------- Lienzos ---------- */
  Sello.makeCanvas = function (w, h) {
    if (typeof OffscreenCanvas !== "undefined" && typeof document === "undefined") return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
  };
  Sello.canvasToBlob = function (c, type, q) {
    if (c.convertToBlob) return c.convertToBlob({ type, quality: q });
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("No se pudo codificar la imagen")), type, q));
  };
  async function decode(file, opts) {
    try { return await createImageBitmap(file, Object.assign({ imageOrientation: "from-image" }, opts || {})); }
    catch (e) { return await createImageBitmap(file, opts || {}); }
  }
  Sello.decode = decode;

  /* Miniatura liviana (JPEG pequeño) */
  Sello.makeThumb = async function (file, size) {
    const bmp = await decode(file, { resizeWidth: size, resizeQuality: "medium" });
    let w = bmp.width, h = bmp.height;
    if (Math.max(w, h) > size * 1.4) { const k = size / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
    const c = Sello.makeCanvas(w, h);
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const blob = await Sello.canvasToBlob(c, "image/jpeg", 0.8);
    c.width = c.height = 0;
    return { blob, w, h };
  };

  /* Foto final con sello: devuelve blob JPEG, su CRC y tamaño */
  Sello.renderPhoto = async function (file, lines, s, logo, opt) {
    const bmp = await decode(file);
    const W = bmp.width, H = bmp.height;
    let k = 1;
    if (opt.maxSide && Math.max(W, H) > opt.maxSide) k = opt.maxSide / Math.max(W, H);
    if (W * H * k * k > opt.maxPixels) k = Math.sqrt(opt.maxPixels / (W * H));
    const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    let c = Sello.makeCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    Sello.stamp(ctx, w, h, lines, s, logo);
    const enc = await Sello.canvasToBlob(c, "image/jpeg", opt.q);
    c.width = c.height = 0; c = null;
    const u8 = new Uint8Array(await enc.arrayBuffer());
    let parts = [u8];
    if (opt.keepExif) {
      try {
        const head = new Uint8Array(await file.slice(0, 1048576).arrayBuffer());
        const app1 = extractExif(head);
        if (app1 && u8[0] === 0xFF && u8[1] === 0xD8) {
          let j = 2;
          if (u8[2] === 0xFF && u8[3] === 0xE0) j = 4 + ((u8[4] << 8) | u8[5]);
          parts = [u8.subarray(0, 2), app1, u8.subarray(j)];
        }
      } catch (e) { }
    }
    let crc = 0, size = 0;
    for (const p of parts) { crc = Sello.crc32(p, crc); size += p.length; }
    return { blob: new Blob(parts, { type: "image/jpeg" }), crc, size, w, h };
  };

  G.Sello = Sello;
})(typeof self !== "undefined" ? self : this);
