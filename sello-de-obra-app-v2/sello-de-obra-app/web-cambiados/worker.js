/* Sello de Obra — procesador en segundo plano: miniaturas y fotos finales sin bloquear la pantalla */
importScripts("stamp.js");

let logo = null;
const FONTS = [
  ["Archivo", "400", "normal", "archivo-latin-400-normal"],
  ["Archivo", "400", "italic", "archivo-latin-400-italic"],
  ["Archivo", "500", "normal", "archivo-latin-500-normal"],
  ["Archivo", "600", "normal", "archivo-latin-600-normal"],
  ["Archivo", "700", "normal", "archivo-latin-700-normal"],
  ["IBM Plex Mono", "400", "normal", "ibm-plex-mono-latin-400-normal"],
  ["IBM Plex Mono", "500", "normal", "ibm-plex-mono-latin-500-normal"]
];

async function init() {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return { ok: false, fonts: false };
  try { const t = new OffscreenCanvas(4, 4); if (!t.getContext("2d") || !t.convertToBlob) return { ok: false, fonts: false }; }
  catch (e) { return { ok: false, fonts: false }; }
  let fonts = false;
  try {
    if (self.fonts && typeof FontFace !== "undefined") {
      await Promise.all(FONTS.map(async ([fam, w, st, file]) => {
        const f = new FontFace(fam, "url(fonts/" + file + ".woff2)", { weight: w, style: st });
        await f.load(); self.fonts.add(f);
      }));
      fonts = true;
    }
  } catch (e) { fonts = false; }
  return { ok: true, fonts };
}

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.type === "init") { self.postMessage({ type: "init", ...(await init()) }); return; }
    if (m.type === "logo") { if (logo && logo.close) logo.close(); logo = m.bitmap || null; return; }
    if (m.type === "thumb") {
      const r = await Sello.makeThumb(m.file, m.size);
      self.postMessage({ id: m.id, ok: true, blob: r.blob, w: r.w, h: r.h });
      return;
    }
    if (m.type === "render") {
      const r = await Sello.renderPhoto(m.file, m.lines, m.s, logo, m.opt);
      self.postMessage({ id: m.id, ok: true, blob: r.blob, crc: r.crc, size: r.size, w: r.w, h: r.h });
      return;
    }
  } catch (e) {
    self.postMessage({ id: m.id, ok: false, error: (e && e.message) || String(e) });
  }
};
