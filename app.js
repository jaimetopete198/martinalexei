(() => {
const C = window.CLINIC, K = C.colors;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wa = (t) => C.whatsapp ? `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(t)}` : "#";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const money = (n) => "$" + Math.round(n).toLocaleString("es-MX");
const pad = (n) => String(n).padStart(2, "0");
const img = (src, label, cls = "", eager = false) => src ? `<img class="ph-img" src="${esc(src)}" alt="${esc(label)}" loading="${eager ? "eager" : "lazy"}" decoding="async">` : `<div class="ph ${cls}">${esc(label)}</div>`;
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"], MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (d) => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
const tByKey = (k) => C.treatments.find(t => t.key === k);

/* ---------- Tema y textos ---------- */
const rs = document.documentElement.style;
Object.entries(K).forEach(([k, v]) => rs.setProperty("--" + k, v));
document.title = `${C.name} | ${C.specialty}`;
$("#heroSub").textContent = C.subtitle;
$("#footMeta").textContent = `${C.address} · ${C.phone}`;
if (C.whatsapp) $("#waFloat").href = wa("Hola, quisiera información sobre una cita."); else $("#waFloat").hidden = true;
$$("[data-sec]").forEach(s => { if (C.sections[s.dataset.sec] === false) s.remove(); });

/* ---------- Datos compartidos: citas, horarios ocupados y reels ----------
   En el Artifact usa la base de datos compartida; en el sitio local usa localStorage. */
const Store = (() => {
  const S = { mode: "local", admin: false, slots: {}, citas: {}, reels: {} };
  const subs = new Set(), emit = () => subs.forEach(f => f());
  const ls = (k) => { try { return JSON.parse(localStorage.getItem("mx_" + k) || "{}"); } catch { return {}; } };
  const sv = (k, v) => { try { localStorage.setItem("mx_" + k, JSON.stringify(v)); } catch {} };
  let db = null;
  return {
    S, on: (f) => subs.add(f),
    async init() {
      let user = null;
      try { db = await window.claude?.use?.("db"); user = await window.claude?.use?.("user"); } catch {}
      if (!db) { S.slots = ls("slots"); S.citas = ls("citas"); S.admin = true; emit(); addEventListener("storage", () => { S.slots = ls("slots"); S.citas = ls("citas"); emit(); }); return; }
      S.mode = "cloud"; S.admin = !!(user && (user.canEdit?.() || user.isOwner?.()));
      const watch = (col, key) => db.collection(col).onSnapshot(s => { const o = {}; s.docs.forEach(d => { o[d.id] = d.data(); }); S[key] = o; emit(); }, () => {});
      watch("slots", "slots"); watch("reels", "reels"); if (S.admin) watch("citas", "citas");
      emit();
    },
    async book(slot, code, data) {
      if (!db) {
        if (S.slots[slot]) return { ok: false, reason: "taken" };
        S.slots[slot] = { code }; S.citas[code] = { ...data, slot, status: "pendiente", createdAt: Date.now() }; sv("slots", S.slots); sv("citas", S.citas); emit(); return { ok: true };
      }
      try {
        const ref = db.doc("slots/" + slot), lease = await ref.acquire({ holder: code, ttlMs: 10000 });
        if (!lease.acquired) return { ok: false, reason: "taken" };
        const cur = await ref.get();
        if (cur.exists && cur.data()?.code) return { ok: false, reason: "taken" };
        await db.doc("citas/" + code).set({ ...data, slot, status: "pendiente", createdAt: Date.now() });
        await ref.set({ code, at: Date.now() });
        return { ok: true };
      } catch (e) { return { ok: false, reason: e?.code === "invalid_argument" ? "denied" : "error" }; }
    },
    async cancel(code) {
      const c = S.citas[code]; if (!c) return;
      if (!db) { delete S.citas[code]; delete S.slots[c.slot]; sv("slots", S.slots); sv("citas", S.citas); emit(); return; }
      await db.doc("citas/" + code).delete(); await db.doc("slots/" + c.slot).delete();
    },
    async status(code, status) {
      if (!db) { S.citas[code].status = status; sv("citas", S.citas); emit(); return; }
      await db.doc("citas/" + code).update({ status });
    },
    async addReel(r) { if (!db) throw new Error("local"); await db.doc("reels/" + r.id).set({ ...r, ts: Date.now() }); },
    async removeReel(id) { if (db) await db.doc("reels/" + id).delete(); }
  };
})();

/* ---------- Disponibilidad (la misma lógica para el hero y la agenda) ---------- */
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const slotKey = (d, t) => dkey(d) + "_" + t.replace(":", "");
const openDays = () => { const o = [], n = new Date(); for (let i = 0; o.length < C.daysAhead && i < 60; i++) { const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + i); if (C.schedule[d.getDay()]) o.push(d); } return o; };
const daySlots = (d) => {
  const sc = C.schedule[d.getDay()]; if (!sc) return [];
  const out = [], min = Date.now() + C.leadHours * 3600e3;
  for (let m = sc[0] * 60; m + C.slotMinutes <= sc[1] * 60; m += C.slotMinutes) {
    const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`, k = slotKey(d, t);
    out.push({ t, k, off: new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60).getTime() < min || !!Store.S.slots[k] });
  }
  return out;
};
const nextSlot = () => { for (const d of openDays()) { const s = daySlots(d).find(x => !x.off); if (s) return { d, t: s.t }; } return null; };

/* ---------- Nav, progreso, scroll-spy, atajos ---------- */
const secs = () => $$("main > section[id]").filter(s => !s.hidden);
$("#navLinks").innerHTML = [["smilelab", "Expediente"], ["tratamientos", "Tratamientos"], ["resultados", "Resultados"], ["redes", "Instagram"], ["doctor", "Doctor"], ["contacto", "Contacto"]]
  .filter(([id]) => document.getElementById(id)).map(([id, t]) => `<a href="#${id}">${t}</a>`).join("");
$("#dots").innerHTML = secs().filter(s => s.dataset.label).map(s => `<a href="#${s.id}" data-id="${s.id}"><span>${esc(s.dataset.label)}</span></a>`).join("");
$("#burger").onclick = () => $("#navLinks").classList.toggle("open");
$("#navLinks").onclick = () => $("#navLinks").classList.remove("open");
let hsUpd = () => {};
const fab = $(".fab");
function onScroll() {
  hsUpd(); parallax();
  { const y0 = scrollY; if (y0 < innerHeight * 1.3) $("#wallWrap").style.transform = `translate3d(0,${(-y0 * .22).toFixed(1)}px,0)`; }
  const dk = $$(".dk").some(s => { const r = s.getBoundingClientRect(); return r.top < 50 && r.bottom > 50; });
  if (dk !== document.body.classList.contains("navdark")) { document.body.classList.toggle("navdark", dk); $("#brandImg").src = dk ? "assets/logo-white.svg" : "assets/logo.svg"; }
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight, ct = document.getElementById("cita");
  $("#nav").classList.toggle("scrolled", y > 40);
  $("#progress").style.width = (max > 0 ? y / max * 100 : 0) + "%";
  fab.classList.toggle("show", y > innerHeight * .7 && !(ct && Math.abs(ct.getBoundingClientRect().top) < innerHeight * .6));
  let cur = null; secs().forEach(s => { if (s.dataset.label && s.getBoundingClientRect().top < innerHeight * .4) cur = s; });
  $$("#dots a").forEach(a => a.classList.toggle("on", !!cur && a.dataset.id === cur.id));
  $$("#navLinks a").forEach(a => a.classList.toggle("on", !!cur && a.getAttribute("href") === "#" + cur.id));
}
let tick = false;
addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(() => { onScroll(); tick = false; }); } }, { passive: true });
function parallax() {
  $$("[data-par]").forEach(e => { const r = e.parentElement.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return; e.style.setProperty("--py", ((r.top + r.height / 2 - innerHeight / 2) / innerHeight * -parseFloat(e.dataset.par) * 100).toFixed(1) + "px"); });
}
addEventListener("pointermove", e => {
  rs.setProperty("--mx", e.clientX + "px"); rs.setProperty("--my", e.clientY + "px");
  const s = e.target.closest?.(".spot"); if (s) { const r = s.getBoundingClientRect(); s.style.setProperty("--sx", e.clientX - r.left + "px"); s.style.setProperty("--sy", e.clientY - r.top + "px"); }
}, { passive: true });
addEventListener("keydown", e => {
  if (/input|textarea|select/i.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
  if (e.key.toLowerCase() === "a") document.getElementById("cita")?.scrollIntoView({ behavior: "smooth" });
});
$$(".magnet").forEach(b => {
  b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .12}px,${(e.clientY - r.top - r.height / 2) * .22}px)`; });
  b.addEventListener("pointerleave", () => { b.style.transform = ""; });
});

/* ---------- Hero: estado, video en loop, próxima cita, cifras ---------- */
(() => {
  const n = new Date(), h = n.getHours() + n.getMinutes() / 60, s = C.schedule[n.getDay()];
  let txt, open = false;
  if (s && h >= s[0] && h < s[1]) { open = true; txt = `Abierto ahora · cierra a las ${s[1]}:00`; }
  else for (let i = 0; i < 8; i++) {
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + i), ss = C.schedule[d.getDay()];
    if (ss && (i > 0 || h < ss[0])) { txt = `Cerrado · abre ${i === 0 ? "hoy" : i === 1 ? "mañana" : DOW[d.getDay()]} ${ss[0]}:00`; break; }
  }
  $("#openTxt").textContent = txt; $("#openDot").classList.toggle("off", !open);
})();
/* muro 3D de videos: todos mudos, en loop, y solo se reproducen los que se ven */
const wall = $("#wall"), wallVideos = [];
(function () {
  const vids = [C.heroVideo, ...C.reels.map(r => r.video)].filter(Boolean);
  if (!vids.length) return;
  const cols = innerWidth < 760 ? 3 : 5, per = 3;
  wall.innerHTML = Array.from({ length: cols }, (_, c) => `<div class="wcol" style="--c:${c}">${Array.from({ length: per }, (_, k) => `<div class="tile"><video muted loop playsinline preload="auto" src="${esc(vids[(c * 2 + k * 3 + (c % 2)) % vids.length])}"></video></div>`).join("")}</div>`).join("");
  $$("video", wall).forEach(v => { v.muted = true; wallVideos.push(v); });
  const vis = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) x.target.play().catch(() => {}); else x.target.pause(); }), { threshold: .05 });
  wallVideos.forEach(v => vis.observe(v));
  const hero = $("#inicio");
  if (matchMedia("(hover:hover)").matches) {
    hero.addEventListener("pointermove", e => { const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; wall.style.setProperty("--wx", (50 - y * 7).toFixed(2) + "deg"); wall.style.setProperty("--wz", (-20 + x * 6).toFixed(2) + "deg"); }, { passive: true });
    hero.addEventListener("pointerleave", () => { wall.style.setProperty("--wx", "50deg"); wall.style.setProperty("--wz", "-20deg"); });
  }
})();
$("#stats").innerHTML = C.stats.map(s => `<div><b data-n="${esc(s.n)}">${esc(s.n)}</b><span>${esc(s.t)}</span></div>`).join("");
function countUp(b) {
  const m = b.dataset.n.match(/([\d,.]+)/); if (!m) return;
  const target = parseFloat(m[1].replace(/,/g, "")), dec = (m[1].split(".")[1] || "").length, t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / 1400), v = target * (1 - Math.pow(1 - p, 3)); b.textContent = b.dataset.n.replace(m[1], v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function renderNext() {
  const n = nextSlot(), box = $("#heroNext");
  box.innerHTML = n ? `<small>Próxima cita disponible</small><button class="link" id="nextBook"><b>${fmt(n.d)} · ${n.t}</b> <i>→</i></button>` : `<small>Agenda</small><a class="link" href="${wa("Hola, quisiera una cita.")}" target="_blank" rel="noopener"><b>Escríbenos por WhatsApp</b> <i>→</i></a>`;
  const b = $("#nextBook"); if (b) b.onclick = () => goBook({ date: n.d, time: n.t });
}

/* ---------- Motor de dientes: recolorea solo los dientes de una foto real ---------- */
const imgCache = {};
const loadImg = (src) => (imgCache[src] ||= new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
const sstep = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
async function teeth(src, crop = [0, 0, 1, 1], roi = [0, 0, 1, 1], W = 900) {
  const im = await loadImg(src), [cx, cy, cw, ch] = crop, sw = im.naturalWidth * cw, sh = im.naturalHeight * ch, H = Math.round(W * sh / sw);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(im, im.naturalWidth * cx, im.naturalHeight * cy, sw, sh, 0, 0, W, H);
  const base = ctx.getImageData(0, 0, W, H), d = base.data, out = new ImageData(new Uint8ClampedArray(d), W, H), idx = [], wts = [];
  for (let y = Math.floor(roi[1] * H); y < roi[3] * H; y++) for (let x = Math.floor(roi[0] * W); x < roi[2] * W; x++) {
    const p = (y * W + x) * 4, r = d[p], g = d[p + 1], b = d[p + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    const w = (1 - sstep(.13, .27, sat)) * sstep(.42, .62, mx / 255) * (1 - sstep(38, 70, r - b));
    if (w > .03) { idx.push(p); wts.push(w); }
  }
  return {
    paint(canvas, tone) {
      const t = tone / 100, T0 = .8, o = out.data;
      for (let k = 0; k < idx.length; k++) {
        const p = idx[k], w = wts[k]; let r = d[p], g = d[p + 1], b = d[p + 2];
        if (t < T0) { const y = (T0 - t) / T0 * w; r *= 1 - .01 * y; g *= 1 - .12 * y; b *= 1 - .50 * y; const dk = 1 - .07 * y; r *= dk; g *= dk; b *= dk; }
        else { const f = (t - T0) / (1 - T0) * .32 * w; r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
        o[p] = r; o[p + 1] = g; o[p + 2] = b;
      }
      canvas.width = W; canvas.height = H; canvas.getContext("2d").putImageData(out, 0, 0);
    }
  };
}

/* ---------- EXPEDIENTE: sonrisa HD sin recorte; el tono solo cambia en los dientes ---------- */
if ($("#teethCv")) {
  const M = C.teethMap, W = M.w, H = M.h, T = M.teeth;
  const cv = $("#teethCv"), ctx = cv.getContext("2d"), ovl = $("#ovl"), stage = $("#stage");
  cv.width = W; cv.height = H; ovl.setAttribute("viewBox", `0 0 ${W} ${H}`);
  $("#stageIn").style.aspectRatio = `${W} / ${H}`;
  const SH = [["A4", 8], ["A3.5", 22], ["A3", 36], ["A2", 50], ["A1", 64], ["B1", 78], ["0M1", 100]];
  const NAMES = { 1: "Incisivo central", 2: "Incisivo lateral", 3: "Canino", 4: "Primer premolar", 5: "Segundo premolar" };
  const CATS = [
    { id: "alin", name: "Alineación", opts: ["Recta", "Algo chueca", "Muy chueca"], plan: "orto" },
    { id: "gap", name: "Espacios", opts: ["Ninguno", "Pocos", "Varios"], plan: "carilla" },
    { id: "forma", name: "Forma", opts: ["Pareja", "Desgastada", "Irregular"], plan: "carilla" },
    { id: "encia", name: "Encía", opts: ["Normal", "Se ve mucha", "Desigual"], plan: "encia" },
    { id: "sim", name: "Simetría", opts: ["Simétrica", "Leve diferencia", "Notoria"], plan: "carilla" }
  ];
  const FLAGS = { alin: [[], [12], [12, 13, 14]], forma: [[], [11, 21], [11, 21, 12, 13]], encia: [[], [11, 12, 13], [21, 12]], sim: [[], [12], [21, 12, 13]] };
  const GAPS = [[], [1, 3], [0, 1, 2, 3, 4]];
  const S = { tab: "tono", tone: 36, sel: 2, goal: false, saved: 2, v: { alin: 1, gap: 1, forma: 0, encia: 0, sim: 0 } };
  const now = new Date(); $("#expNo").textContent = `EXP-${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  let base = null, out = null, idx = [], wts = [], raf = 0; const toneCv = document.createElement("canvas"), light = { on: false, x: 0, y: 0 };
  toneCv.width = W; toneCv.height = H; const toneCtx = toneCv.getContext("2d");

  // piezas (una por diente): número, ficha al pasar el cursor y marcas de enfoque
  $("#pieces").innerHTML = T.map(t => `<button class="pc" data-f="${t.f}" style="left:${t.x0 / W * 100}%;top:${t.top / H * 100}%;width:${(t.x1 - t.x0) / W * 100}%;height:${(t.bot - t.top) / H * 100}%" aria-label="Pieza ${t.f}"><em></em><b>${t.f}</b></button>`).join("");
  const flagsOf = (f) => {
    const res = [], i = T.findIndex(t => t.f === f);
    ["alin", "forma", "encia", "sim"].forEach(k => { if (FLAGS[k][S.v[k]].includes(f)) res.push(CATS.find(c => c.id === k).name); });
    if (GAPS[S.v.gap].some(b => b === i || b === i - 1)) res.push("Espacios");
    return res;
  };
  function refreshPieces() {
    $$(".pc").forEach(p => { const f = +p.dataset.f, fl = flagsOf(f); p.classList.toggle("flag", fl.length > 0); $("em", p).innerHTML = `${f} · ${NAMES[f % 10]}<small>${fl.length ? fl.join(" · ") : "Sin hallazgos"}</small>`; });
  }

  // lienzo: foto HD + luz suave que sigue al cursor
  function draw() {
    ctx.clearRect(0, 0, W, H); ctx.drawImage(toneCv, 0, 0);
    if (light.on) { ctx.globalCompositeOperation = "soft-light"; const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, W * .22); g.addColorStop(0, "rgba(255,255,255,.7)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
  }
  function tone() {
    if (!base) return;
    const d = base.data, o = out.data, t = S.tone / 100, T0 = .8;
    for (let k = 0; k < idx.length; k++) {
      const p = idx[k], w = wts[k]; let r = d[p], g = d[p + 1], b = d[p + 2];
      if (t < T0) { const y = (T0 - t) / T0 * w; r *= 1 - .01 * y; g *= 1 - .12 * y; b *= 1 - .50 * y; const dk = 1 - .07 * y; r *= dk; g *= dk; b *= dk; }
      else { const f = (t - T0) / (1 - T0) * .32 * w; r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
      o[p] = r; o[p + 1] = g; o[p + 2] = b;
    }
    toneCtx.putImageData(out, 0, 0); draw();
  }
  Promise.all([loadImg(C.smilePhoto), loadImg(C.smileMask)]).then(([im, mk]) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
    base = x.getImageData(0, 0, W, H); out = new ImageData(new Uint8ClampedArray(base.data), W, H);
    const m = document.createElement("canvas"); m.width = W; m.height = H; const mx = m.getContext("2d", { willReadFrequently: true }); mx.drawImage(mk, 0, 0, W, H);
    const md = mx.getImageData(0, 0, W, H).data;
    for (let p = 0; p < md.length; p += 4) {
      const lum = (base.data[p] + base.data[p + 1] + base.data[p + 2]) / 765, lw = Math.min(1, Math.max(0, (lum - .22) / .3)), a = md[p] / 255 * lw * lw * (3 - 2 * lw);
      if (a > .02) { idx.push(p); wts.push(a); }
    }
    tone();
  }).catch(() => { stage.insertAdjacentHTML("beforeend", `<div class="ph">Falta la foto en assets/fotos/sonrisa-hd.jpg</div>`); });

  // capas de análisis sobre la foto (guías, marcas y medidas)
  const mid = (t) => (t.x0 + t.x1) / 2;
  const dot = (x, y) => `<circle class="d" cx="${x}" cy="${y}" r="9"/><circle class="r" cx="${x}" cy="${y}" r="14"/>`;
  function drawOvl() {
    let h = ""; const tf = (f) => T.find(t => t.f === f);
    if (S.tab === "alin") {
      h += `<path class="l" d="M ${T.map(t => `${mid(t)} ${t.bot + 14}`).join(" L ")}"/>`;
      FLAGS.alin[S.v.alin].forEach(f => { const t = tf(f); h += dot(mid(t), t.bot + 14) + `<text x="${mid(t) - 10}" y="${t.top - 24}">↻</text>`; });
    }
    if (S.tab === "gap") GAPS[S.v.gap].forEach(i => { const x = T[i].x1, y = (T[i].top + T[i].bot) / 2; h += `<path class="l s" d="M ${x - 10} ${y - 60} V ${y + 60} M ${x + 10} ${y - 60} V ${y + 60}"/>` + dot(x, y); });
    if (S.tab === "forma") FLAGS.forma[S.v.forma].forEach(f => { const t = tf(f); h += `<path class="l s" d="M ${t.x0 + 24} ${t.bot - 8} L ${t.x1 - 24} ${t.bot - 8}"/>` + dot(mid(t), t.bot - 8); });
    if (S.tab === "encia") { h += `<path class="l" d="M ${T.map(t => `${mid(t)} ${t.top - 26}`).join(" L ")}"/>`; FLAGS.encia[S.v.encia].forEach(f => { const t = tf(f); h += dot(mid(t), t.top - 26); }); }
    if (S.tab === "sim") { const x = (T[0].x1 + T[1].x0) / 2; h += `<path class="l" d="M ${x} 40 V ${H - 40}"/>`; FLAGS.sim[S.v.sim].forEach(f => { const t = tf(f); h += dot(mid(t), (t.top + t.bot) / 2); }); }
    ovl.innerHTML = h;
  }

  // dock: pestañas grandes + opciones
  function renderDock() {
    const tabs = [{ id: "tono", name: "Tono" }, ...CATS];
    $("#dTabs").innerHTML = tabs.map(c => `<button class="${c.id === S.tab ? "on" : ""}" data-t="${c.id}" role="tab">${c.name}</button>`).join("");
    const lerp = (a, b, t) => Math.round(a + (b - a) * t), color = (t) => `rgb(${lerp(226, 252, t / 100)},${lerp(205, 252, t / 100)},${lerp(140, 250, t / 100)})`;
    $("#dOpts").innerHTML = S.tab === "tono"
      ? SH.map(([n, t], i) => `<button class="shade ${i === S.sel ? "on" : ""}" data-i="${i}" aria-label="Tono ${n}"><i style="background:${color(t)}"></i><span>${n}</span></button>`).join("")
      : CATS.find(c => c.id === S.tab).opts.map((o, i) => `<button class="o ${S.v[S.tab] === i ? "on" : ""}" data-i="${i}">${o}</button>`).join("");
  }
  function renderRec() {
    const keys = new Set(); if (S.sel < 5) keys.add("blanq");
    CATS.forEach(c => { if (S.v[c.id] > 0) keys.add(c.plan); });
    if (!keys.size) keys.add("limpieza");
    const items = [...keys].map(tByKey).filter(Boolean);
    $("#rec").innerHTML = `<div><h3><small>${$("#expNo").textContent}</small>Hallazgos</h3><ul><li>Tono<span>${SH[S.sel][0]}</span></li>${CATS.map(c => `<li>${c.name}<span>${c.opts[S.v[c.id]]}</span></li>`).join("")}</ul></div>
      <div><h3><small>Plan</small>${items.length} ${items.length > 1 ? "tratamientos" : "tratamiento"}</h3><ul>${items.map(t => `<li>${esc(t.name)}<span>${esc(t.price)}</span></li>`).join("")}</ul><button class="btn btn-lg" id="labBook">Agendar con este expediente</button></div>`;
    $("#labBook").onclick = () => goBook("Expediente: " + items.map(t => t.name).join(" + "));
  }
  function renderAll() { renderDock(); drawOvl(); refreshPieces(); renderRec(); $("#labGoal").textContent = S.goal ? "Volver a hoy" : "Ver mi meta"; }
  function go(i) {
    S.sel = i; cancelAnimationFrame(raf); const from = S.tone, to = SH[i][1], t0 = performance.now();
    const st = (t) => { const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3); S.tone = from + (to - from) * e; tone(); if (p < 1) raf = requestAnimationFrame(st); }; raf = requestAnimationFrame(st);
    renderAll();
  }
  $("#dTabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.tab = b.dataset.t; renderDock(); drawOvl(); };
  $("#dOpts").onclick = e => { const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i; if (S.tab === "tono") { S.goal = false; go(i); } else { S.v[S.tab] = i; renderAll(); } };
  $("#labGoal").onclick = (e) => { e.stopPropagation(); S.goal = !S.goal; if (S.goal) { S.saved = S.sel; go(6); } else go(S.saved); };
  $("#pieces").onclick = e => { const p = e.target.closest(".pc"); if (!p) return; const was = p.classList.contains("on"); $$(".pc").forEach(x => x.classList.remove("on")); if (!was) p.classList.add("on"); };
  // luz y perspectiva con el cursor (solo con mouse)
  if (matchMedia("(hover:hover)").matches) {
    let tk = false, ev = null;
    stage.addEventListener("pointermove", e => { ev = e; if (tk) return; tk = true; requestAnimationFrame(() => { tk = false; const r = cv.getBoundingClientRect(), sr = stage.getBoundingClientRect(); light.on = true; light.x = (ev.clientX - r.left) / r.width * W; light.y = (ev.clientY - r.top) / r.height * H; draw(); stage.style.setProperty("--ry", (((ev.clientX - sr.left) / sr.width - .5) * 4).toFixed(2) + "deg"); stage.style.setProperty("--rx", ((.5 - (ev.clientY - sr.top) / sr.height) * 3).toFixed(2) + "deg"); }); });
    stage.addEventListener("pointerleave", () => { light.on = false; draw(); stage.style.setProperty("--ry", "0deg"); stage.style.setProperty("--rx", "0deg"); });
  }
  renderAll();
}

/* ---------- Tratamientos (índice tipográfico) + financiamiento ---------- */
if ($("#txList")) {
  const N = C.treatments.length; let cur = -1; const media = $("#txMedia");
  $("#txList").innerHTML = C.treatments.map((t, i) => `<li><button class="tx-row" data-i="${i}"><span class="n">${pad(i + 1)}</span><span class="nm">${esc(t.name)}</span><span class="t">${esc(t.time)}</span></button>
    <div class="det"><div class="det-in"><p>${esc(t.desc)}</p><p class="meta">${esc(t.price)}</p><button class="link" data-book="${i}">Agendar este tratamiento <i>→</i></button></div></div></li>`).join("");
  function select(i) {
    i = (i + N) % N; if (i === cur) return; cur = i; const t = C.treatments[i];
    $$(".tx-row").forEach((b, k) => b.classList.toggle("on", k === i));
    const im = document.createElement("div"); im.className = "txi"; im.innerHTML = img(t.img, t.name, "", true); im.style.clipPath = "inset(100% 0 0 0)";
    media.append(im); void im.offsetWidth; im.style.clipPath = "inset(0 0 0 0)";
    setTimeout(() => { $$(".txi", media).slice(0, -1).forEach(x => x.remove()); }, 1200);
  }
  $("#txList").addEventListener("pointerover", e => { const b = e.target.closest(".tx-row"); if (b && matchMedia("(hover:hover)").matches) select(+b.dataset.i); });
  $("#txList").onclick = e => { const bk = e.target.closest("[data-book]"); if (bk) return goBook(C.treatments[+bk.dataset.book].name); const b = e.target.closest(".tx-row"); if (b) select(+b.dataset.i); };
  media.onclick = () => goBook(C.treatments[cur].name);
  select(0);
  addEventListener("keydown", e => { if (/input|textarea/i.test(e.target.tagName)) return; const r = $("#tratamientos").getBoundingClientRect(); if (r.top < innerHeight * .5 && r.bottom > innerHeight * .3) { if (e.key === "ArrowRight" || e.key === "ArrowDown") select(cur + 1); if (e.key === "ArrowLeft" || e.key === "ArrowUp") select(cur - 1); } });
}

/* ---------- Resultados antes/después ---------- */
function baSlider(top, bottom) {
  const n = el(`<div class="ba" data-cur="Arrastra"><span class="after"></span><span class="top"></span><span class="tag l">ANTES</span><span class="tag r">DESPUÉS</span><span class="bar"></span><input type="range" min="0" max="100" value="50" aria-label="Comparar antes y después"></div>`);
  $(".after", n).replaceWith(bottom); $(".top", n).replaceWith(top); top.classList.add("top"); bottom.classList.add("after");
  const bar = $(".bar", n); $("input", n).oninput = e => { const v = e.target.value; top.style.clipPath = `inset(0 ${100 - v}% 0 0)`; bar.style.left = v + "%"; };
  return n;
}
if ($("#cases")) {
  C.cases.forEach(c => {
    const card = el(`<article class="case"><div class="case-body"></div><div class="case-info"><b>${esc(c.title)}</b><span>${c.demo ? "Ejemplo · " : ""}${esc(c.tag || "")}</span></div></article>`);
    let top, bottom;
    if (c.demo || c.src) {
      top = document.createElement("canvas"); bottom = document.createElement("canvas");
      teeth(c.src, c.crop, c.roi, 800).then(e => { e.paint(bottom, c.to); e.paint(top, c.from); }).catch(() => {});
    } else {
      top = el(`<div>${img(c.before, "Antes")}</div>`); bottom = el(`<div>${img(c.after, "Después")}</div>`);
    }
    $(".case-body", card).replaceWith(baSlider(top, bottom)); $("#cases").append(card);
  });
}

/* ---------- Reels: se desplazan a los lados; el cliente puede subir los suyos desde el panel ---------- */
const reelsEl = $("#reels");
const reelLoad = reelsEl && new IntersectionObserver(es => es.forEach(x => { if (!x.isIntersecting) return; const v = $("video", x.target); if (v && !v.src) { v.src = v.dataset.src; v.preload = "metadata"; } reelLoad.unobserve(x.target); }), { rootMargin: "500px 600px" });
const reelPlay = reelsEl && new IntersectionObserver(es => es.forEach(x => { const v = $("video", x.target); if (!v || !v.src) return; if (x.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: .5 });
function reelList() {
  const cloud = Object.entries(Store.S.reels).map(([id, r]) => ({ ...r, id, title: r.title || "Reel", video: r.url })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return [...cloud, ...C.reels];
}
function renderReels() {
  if (!reelsEl) return;
  reelsEl.innerHTML = ""; const list = reelList();
  $("#reelCount").textContent = `${pad(list.length)} VIDEOS`;
  list.forEach((r, k) => {
    const n = el(`<div class="reel" style="--k:${k}" data-cur="Sonido">${r.video ? `<video data-src="${esc(r.video)}" muted loop playsinline preload="none"></video>` : `<div class="ph">${esc(r.title)}</div>`}<span class="live"></span><button class="rsnd" tabindex="-1">Sonido</button><div class="cap"><span>${esc(r.title)}</span>${r.ig ? `<a href="${esc(r.ig)}" target="_blank" rel="noopener">IG ↗</a>` : ""}</div></div>`);
    n.onclick = (e) => {
      if (e.target.closest("a")) return; const v = $("video", n); if (!v) return;
      $$(".reel video").forEach(o => { if (o !== v) { o.muted = true; $(".rsnd", o.parentElement).textContent = "Sonido"; o.parentElement.dataset.cur = "Sonido"; } });
      v.muted = !v.muted; $(".rsnd", n).textContent = v.muted ? "Sonido" : "Silenciar"; n.dataset.cur = v.muted ? "Sonido" : "Silenciar"; v.play().catch(() => {});
    };
    reelsEl.append(n); reelLoad.observe(n); reelPlay.observe(n);
  });
  reelsEl.dispatchEvent(new Event("scroll"));
}
if (reelsEl) {
  $("#social").innerHTML = C.social.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(s.name)}</b><span>${esc(s.handle)}</span></a>`).join("");
  const bar = $("#reelBar"), upd = () => { const sw = reelsEl.scrollWidth, cw = reelsEl.clientWidth, w = Math.min(100, cw / sw * 100), p = sw > cw ? reelsEl.scrollLeft / (sw - cw) : 0; bar.style.width = w + "%"; bar.style.marginLeft = p * (100 - w) + "%"; };
  reelsEl.addEventListener("scroll", upd, { passive: true }); addEventListener("resize", upd);
}

/* ---------- Visita (scroll vertical que mueve horizontal) ---------- */
if ($("#hsTrack")) {
  const tr = $("#hsTrack"), hs = $("#visita");
  tr.innerHTML = C.visit.map(s => `<article class="hs-card"><div class="im">${img(s.img, s.t, "", true)}</div><div class="tb"><span class="num">${s.m}</span><h4>${esc(s.t)}</h4><p>${esc(s.d)}</p></div></article>`).join("");
  hsUpd = () => { const r = hs.getBoundingClientRect(), total = hs.offsetHeight - innerHeight, p = Math.min(1, Math.max(0, -r.top / total)), max = Math.max(0, tr.scrollWidth - tr.parentElement.clientWidth); tr.style.transform = `translateX(${-p * max}px)`; $("#hsBar").style.width = p * 100 + "%"; };
}

/* ---------- Doctor, tecnología, opiniones, preguntas, contacto ---------- */
if ($("#docName")) {
  $("#docSpec").textContent = C.specialty; $("#docName").textContent = C.doctor;
  $("#docBio").innerHTML = C.doctorBio.map(p => `<p>${esc(p)}</p>`).join("");
  $("#docCreds").innerHTML = C.credentials.map(c => `<li>${esc(c)}</li>`).join("");
  $("#docMedia").innerHTML = img(C.doctorPhoto, "Foto del doctor");
  $("#tech").innerHTML = C.tech.map(t => `<div><b>${esc(t.t)}</b><span>${esc(t.d)}</span></div>`).join("");
}
if ($("#qTrack")) {
  const N = C.testimonials.length; let qi = 0, timer;
  $("#qTrack").innerHTML = C.testimonials.map(t => `<div class="q-slide"><div class="st">${"★".repeat(t.stars)}</div><p>“${esc(t.text)}”</p><div class="who">${esc(t.name.toUpperCase())} · ${esc(t.treatment.toUpperCase())} · ${esc(C.rating)} ★ ${esc(C.ratingCount.toUpperCase())}</div></div>`).join("");
  $("#qDots").innerHTML = C.testimonials.map((_, i) => `<i data-i="${i}"></i>`).join("");
  const go = k => { qi = (k + N) % N; $("#qTrack").style.transform = `translateX(${-qi * 100}%)`; $$("#qDots i").forEach((d, i) => d.classList.toggle("on", i === qi)); $$(".q-slide").forEach((s, i) => s.classList.toggle("on", i === qi)); clearInterval(timer); timer = setInterval(() => go(qi + 1), 7500); };
  $("#qPrev").onclick = () => go(qi - 1); $("#qNext").onclick = () => go(qi + 1);
  $("#qDots").onclick = e => { const i = e.target.closest("i"); if (i) go(+i.dataset.i); };
  let qx = null; $("#qTrack").addEventListener("pointerdown", e => { qx = e.clientX; });
  addEventListener("pointerup", e => { if (qx === null) return; const dx = e.clientX - qx; qx = null; if (Math.abs(dx) > 60) go(qi + (dx < 0 ? 1 : -1)); });
  go(0);
}
if ($("#faqList")) $("#faqList").innerHTML = C.faqs.map(f => `<details class="rv"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
if ($("#contactList")) {
  $("#contactList").innerHTML = `<li><small>DIRECCIÓN</small><span>${esc(C.address)}</span></li><li><small>HORARIO</small><span>${esc(C.hoursText)}</span></li>
    <li><small>TELÉFONO</small><a href="tel:${esc(C.phone.replace(/\s/g, ""))}">${esc(C.phone)}</a></li>
    ${C.whatsapp ? `<li><small>WHATSAPP</small><a href="${wa("Hola, quisiera información.")}" target="_blank" rel="noopener">Escribir ahora</a></li>` : ""}
    <li><small>CORREO</small><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li>`;
  const mf = $("#mapFrame"), mq = encodeURIComponent(C.mapQuery);
  if (mf.tagName === "IFRAME") mf.src = `https://www.google.com/maps?q=${mq}&output=embed`; else mf.href = `https://www.google.com/maps/search/?api=1&query=${mq}`;
}

/* ---------- AGENDA: chat + ticket en vivo + horarios reales ---------- */
let startBooking = () => {};
const goBook = (o) => { startBooking(o); document.getElementById("cita")?.scrollIntoView({ behavior: "smooth" }); };
if ($("#clog")) {
  const log = $("#clog"), ctl = $("#cctl");
  const motives = ["Estética / sonrisa", "Implantes", "Ortodoncia", "Limpieza / revisión", "Niños", "Otro / no sé"];
  const blank = () => ({ pre: null, step: 0, motive: "", first: "", pain: "", date: null, time: "", name: "", phone: "", note: "", code: "", pending: false });
  let S = blank();
  const Q = [
    () => `Hola, soy el asistente de <b>${esc(C.name)}</b>. ¿Qué te gustaría mejorar?`,
    () => `Perfecto: <b>${esc(S.motive)}</b>. ¿Es tu primera vez con nosotros?`,
    () => `Gracias. ¿Sientes dolor o molestia ahora?`,
    () => S.pain === "Fuerte" ? `Lamento escucharlo. Te muestro primero lo más próximo. Elige día y hora:` : `Elige el día y la hora que mejor te acomode. Los horarios tachados ya están tomados:`,
    () => `Apartado: <b>${esc(fmt(S.date))}</b> a las <b>${S.time}</b>. ¿A nombre de quién?`,
    () => `Revisa tu cita. Al confirmar, el horario queda reservado para ti.`
  ];
  const ANS = [() => S.motive, () => S.first, () => S.pain, () => `${fmt(S.date)} · ${S.time}`, () => S.name];
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const msg = (h, who) => { const m = el(`<div class="msg ${who}">${h}</div>`); log.append(m); scroll(); return m; };
  async function botSay(h) { const t = el(`<div class="msg bot typing"><i></i><i></i><i></i></div>`); log.append(t); scroll(); await sleep(380); t.remove(); msg(h, "bot"); }
  const waMsg = () => wa(`Hola, quiero ${S.code ? "confirmar mi cita " + S.code : "agendar una cita"}.\nMotivo: ${S.motive}\nFecha: ${fmt(S.date)} a las ${S.time}\nNombre: ${S.name}\nTel: ${S.phone}\n${S.first} · Dolor: ${S.pain}${S.note ? "\nNota: " + S.note : ""}`);
  const gcal = () => { const [h, m] = S.time.split(":").map(Number), b = dkey(S.date).replace(/-/g, ""), e = h + Math.floor(C.slotMinutes / 60); return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Cita dental · " + C.name)}&dates=${b}T${pad(h)}${pad(m)}00/${b}T${pad(e)}${pad(m)}00&location=${encodeURIComponent(C.address)}`; };

  function ticket() {
    const done = [S.motive, S.first && S.pain, S.date && S.time, S.name && S.phone].filter(Boolean).length, pct = S.code ? 100 : done / 4 * 100;
    const row = (k, v) => `<div class="trow"><span>${k}</span><b class="${v ? "" : "empty"}">${v ? esc(v) : "—"}</b></div>`;
    $("#ticket").innerHTML = `<small>TU CITA · EN VIVO</small>${S.code ? `<div class="code">${esc(S.code)}</div><small>CÓDIGO DE RESERVA</small>` : `<div class="ring"><svg viewBox="0 0 64 64"><circle class="rt" cx="32" cy="32" r="27"/><circle class="rg" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="${pct} 100"/></svg><b>${Math.round(pct)}%</b></div>`}
      ${row("Motivo", S.motive)}${row("Fecha", S.date ? fmt(S.date) : "")}${row("Hora", S.time)}${row("Paciente", S.name)}${row("Clínica", C.name)}`;
  }

  function controls() {
    ctl.innerHTML = ""; ctl.style.animation = "none"; void ctl.offsetWidth; ctl.style.animation = "";
    const back = S.step > 0 && S.step < 6 ? `<div class="row"><button class="back" data-back>← Corregir respuesta anterior</button></div>` : "";
    if (S.step === 0) ctl.innerHTML = `<div class="opts">${motives.map(t => `<button class="opt" data-m="${esc(t)}">${t}</button>`).join("")}<button class="opt urgent" data-m="URGENCIA: tengo dolor">Tengo dolor</button></div>`;
    if (S.step === 1) ctl.innerHTML = `<div class="qr">${["Sí, primera vez", "Ya soy paciente"].map(v => `<button class="opt" data-f="${v}">${v}</button>`).join("")}</div>`;
    if (S.step === 2) ctl.innerHTML = `<div class="qr">${["No", "Leve", "Fuerte"].map(v => `<button class="opt" data-p="${v}">${v}</button>`).join("")}</div>`;
    if (S.step === 3) {
      const days = openDays(); if (!S.date || !days.some(d => dkey(d) === dkey(S.date))) S.date = days.find(d => daySlots(d).some(s => !s.off)) || days[0];
      ctl.innerHTML = `<div class="days">${days.map(d => `<button class="day ${dkey(d) === dkey(S.date) ? "on" : ""} ${daySlots(d).every(s => s.off) ? "full" : ""}" data-d="${dkey(d)}"><small>${DOW[d.getDay()]}</small><b>${d.getDate()}</b><small>${MON[d.getMonth()]}</small></button>`).join("")}</div>
        <div class="slots">${daySlots(S.date).map(s => `<button class="slot ${s.off ? "off" : ""}" data-t="${s.t}">${s.t}</button>`).join("")}</div>`;
    }
    if (S.step === 4) ctl.innerHTML = `<label class="field"><span>Nombre completo</span><input id="fName" value="${esc(S.name)}" autocomplete="name"></label>
      <label class="field"><span>WhatsApp</span><input id="fPhone" value="${esc(S.phone)}" inputmode="tel" autocomplete="tel" placeholder="10 dígitos"></label>
      <label class="field"><span>¿Algo que debamos saber? (opcional)</span><textarea id="fNote" rows="2">${esc(S.note)}</textarea></label>
      <div class="row"><span></span><button class="btn btn-sm" id="fGo" disabled>Continuar →</button></div>`;
    if (S.step === 5) ctl.innerHTML = `<div class="row" style="margin-top:0"><button class="btn" id="confirm">Confirmar cita</button></div>`;
    if (S.step === 6) ctl.innerHTML = `<div class="done"><h4>${S.pending ? "Solicitud lista" : "Cita reservada"}</h4><p class="muted">${S.pending ? (C.whatsapp ? `Tu código es <b>${esc(S.code)}</b>. Envía la solicitud por WhatsApp para que el consultorio la confirme.` : `Tu código es <b>${esc(S.code)}</b>. El consultorio te contactará para confirmar.`) : `Tu código es <b>${esc(S.code)}</b>. Te esperamos el ${esc(fmt(S.date))} a las ${S.time}.`}</p>
      <div class="acts">${C.whatsapp ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(waMsg())}">${S.pending ? "Enviar por WhatsApp" : "Enviarme confirmación"}</a>` : ""}<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="${esc(gcal())}">Agregar al calendario</a><button class="back" id="again">Agendar otra cita</button></div></div>`;
    if (back) ctl.insertAdjacentHTML("beforeend", back);
    bind(); ticket();
  }

  async function advance(answer) {
    msg(esc(answer), "me"); S.step++;
    if (S.step === 2 && S.motive.startsWith("URGENCIA")) { S.pain = "Fuerte"; S.step = 3; }
    if (S.step === 3 && S.pre) { S.date = S.pre.date; S.time = S.pre.time; S.pre = null; S.step = 4; }
    ticket(); ctl.innerHTML = "";
    if (S.step <= 5) await botSay(Q[S.step]());
    controls();
  }
  function rewind() {
    S.step = Math.max(0, S.step - 1); if (S.step === 2 && S.motive.startsWith("URGENCIA")) S.step = 1;
    if (S.step <= 0) S.motive = ""; if (S.step <= 1) S.first = ""; if (S.step <= 2) S.pain = ""; if (S.step <= 3) S.time = ""; if (S.step <= 4) { S.name = ""; S.phone = ""; }
    log.innerHTML = "";
    for (let i = 0; i <= S.step; i++) { msg(Q[i](), "bot"); if (i < S.step && !(i === 2 && S.motive.startsWith("URGENCIA"))) msg(esc(ANS[i]()), "me"); }
    controls();
  }
  const newCode = () => "MX-" + [...crypto.getRandomValues(new Uint8Array(5))].map(n => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[n % 31]).join("");

  function bind() {
    $$("[data-m]", ctl).forEach(b => b.onclick = () => { S.motive = b.dataset.m; advance(b.textContent.trim()); });
    $$("[data-f]", ctl).forEach(b => b.onclick = () => { S.first = b.dataset.f; advance(S.first); });
    $$("[data-p]", ctl).forEach(b => b.onclick = () => { S.pain = b.dataset.p; advance(S.pain); });
    $$("[data-d]", ctl).forEach(b => b.onclick = () => { S.date = openDays().find(d => dkey(d) === b.dataset.d); S.time = ""; controls(); });
    $$("[data-t]", ctl).forEach(b => b.onclick = () => { S.time = b.dataset.t; advance(`${fmt(S.date)} · ${S.time}`); });
    $$("[data-back]", ctl).forEach(b => b.onclick = rewind);
    const go = $("#fGo", ctl);
    if (go) {
      const chk = () => { S.name = $("#fName").value.trim(); S.phone = $("#fPhone").value.trim(); S.note = $("#fNote").value.trim(); go.disabled = !(S.name.length > 2 && S.phone.replace(/\D/g, "").length >= 10); ticket(); };
      $$("input,textarea", ctl).forEach(i => { i.oninput = chk; }); chk();
      go.onclick = () => { chk(); advance(S.name); };
    }
    const cf = $("#confirm", ctl);
    if (cf) cf.onclick = async () => {
      cf.disabled = true; cf.textContent = "Reservando…"; S.code = newCode();
      const r = await Store.book(slotKey(S.date, S.time), S.code, { motive: S.motive, first: S.first, pain: S.pain, name: S.name, phone: S.phone, note: S.note });
      if (r.ok) {
        msg("Confirmar cita", "me"); S.step = 6; S.pending = Store.S.mode !== "cloud";
        await botSay(S.pending ? `Listo, tu solicitud tiene el código <b>${esc(S.code)}</b>. ${C.whatsapp ? "Envíala por WhatsApp para que el consultorio la confirme." : "El consultorio te contactará para confirmar."}` : `Listo. Tu cita quedó registrada con el código <b>${esc(S.code)}</b>.`); controls();
      }
      else if (r.reason === "taken") { S.code = ""; S.time = ""; S.step = 3; await botSay("Ese horario se acaba de ocupar. Elige otro, por favor:"); controls(); }
      else { S.code = ""; S.pending = true; msg("Confirmar cita", "me"); S.step = 6; await botSay("Tu solicitud está lista, pero el calendario compartido no te dejó reservar directo. Envíala por WhatsApp y te la confirmamos."); controls(); }
    };
    const ag = $("#again", ctl); if (ag) ag.onclick = () => start();
  }

  async function start(o) {
    S = blank(); log.innerHTML = ""; ctl.innerHTML = ""; ticket();
    const opt = typeof o === "string" ? { motive: o } : (o || {});
    if (opt.date && opt.time) S.pre = { date: opt.date, time: opt.time };
    await botSay(Q[0]());
    if (opt.motive) { S.motive = opt.motive; await advance(opt.motive); } else controls();
  }
  startBooking = start;

  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function answer(q) {
    const n = norm(q); let best = null, sc = 0;
    C.faqs.forEach(f => { const s = f.k.filter(k => n.includes(norm(k))).length; if (s > sc) { sc = s; best = f; } });
    if (best) return best.a;
    if (/hola|buenas/.test(n)) return "Hola. Pregúntame por precios, tratamientos u horarios, o sigue con tu cita.";
    return C.whatsapp ? `Esa pregunta mejor te la responde el equipo: <a target="_blank" rel="noopener" href="${wa("Hola, tengo una duda: " + q)}">escríbenos por WhatsApp</a>.` : `Esa pregunta mejor te la responde el equipo: revisa los datos de contacto al final de la página.`;
  }
  $("#cform").onsubmit = async e => { e.preventDefault(); const v = $("#cin").value.trim(); if (!v) return; $("#cin").value = ""; msg(esc(v), "me"); await botSay(answer(v) + (S.step < 6 ? "<br><small>Seguimos con tu cita.</small>" : "")); };

  // los horarios se actualizan en vivo si alguien más reserva
  let lastSlots = "";
  Store.on(() => { const sig = Object.keys(Store.S.slots).join(); if (sig === lastSlots) return; lastSlots = sig; if (S.step === 3 && log.children.length) controls(); });
  const io0 = new IntersectionObserver(es => { if (es[0].isIntersecting) { io0.disconnect(); if (!log.children.length) start(); } }, { threshold: .15 });
  io0.observe($("#cita")); ticket();
}

/* ---------- PANEL DEL CONSULTORIO: citas y reels ---------- */
const panel = $("#panel"); let ptab = "citas";
function slotDate(k) { const [d, t] = k.split("_"), [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd, +t.slice(0, 2), +t.slice(2)); }
async function renderPanel() {
  if (panel.hidden) return;
  $("#panelMode").textContent = Store.S.mode === "cloud" ? "DATOS COMPARTIDOS" : "SOLO ESTE NAVEGADOR";
  $$("#panelTabs button").forEach(b => b.classList.toggle("on", b.dataset.t === ptab));
  const body = $("#panelBody");
  if (!Store.S.admin) { body.innerHTML = `<div class="pempty">Acceso solo para el consultorio. Abre esta página con tu cuenta de editor para ver y administrar las citas.</div>`; return; }
  if (ptab === "citas") {
    const rows = Object.entries(Store.S.citas).map(([code, c]) => ({ code, ...c })).sort((a, b) => a.slot.localeCompare(b.slot));
    body.innerHTML = rows.length ? `<div class="plist">${rows.map(c => { const d = slotDate(c.slot), ok = c.status === "confirmada"; return `<div class="prow"><div><b>${fmt(d)}</b><small>${pad(d.getHours())}:${pad(d.getMinutes())} · ${esc(c.code)}</small></div>
      <div><b>${esc(c.name)}</b><small><a href="${wa("Hola " + c.name + ", te confirmamos tu cita " + c.code)}" target="_blank" rel="noopener">${esc(c.phone)}</a></small></div>
      <div>${esc(c.motive)}<small>${esc(c.first)} · dolor ${esc((c.pain || "").toLowerCase())}${c.note ? " · " + esc(c.note) : ""}</small></div>
      <div><span class="st ${ok ? "ok" : ""}">${ok ? "CONFIRMADA" : "PENDIENTE"}</span> ${ok ? "" : `<button class="pbtn" data-a="ok" data-c="${esc(c.code)}">Confirmar</button>`} <button class="pbtn" data-a="cancel" data-c="${esc(c.code)}">Cancelar</button></div></div>`; }).join("")}</div>` : `<div class="pempty">Todavía no hay citas. Las reservas aparecerán aquí al instante.</div>`;
  } else {
    const mine = Object.entries(Store.S.reels).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    body.innerHTML = `<form class="pform" id="reelForm"><label class="field"><span>Título del reel</span><input id="rTitle" placeholder="Ej. Carillas en 2 citas" required></label><label class="field"><span>Enlace en Instagram (opcional)</span><input id="rIg" placeholder="https://www.instagram.com/reel/…"></label><label class="field"><span>Archivo (.mp4, máx. 20 MB)</span><input id="rFile" type="file" accept="video/mp4,video/*" required></label>
      <button class="btn btn-sm" id="rGo" style="grid-column:1/-1;justify-self:start">Subir reel</button></form><p class="muted" id="rMsg">Descarga tu reel de Instagram como video y súbelo aquí: aparece al inicio de la sección Instagram.</p>
      ${mine.length ? `<div class="plist" style="margin-top:14px">${mine.map(r => `<div class="prow" style="grid-template-columns:1fr auto"><div><b>${esc(r.title)}</b><small>${r.ig ? esc(r.ig) : "Subido desde el panel"}</small></div><button class="pbtn" data-a="delrl" data-c="${esc(r.id)}">Eliminar</button></div>`).join("")}</div>` : ""}`;
    $("#reelForm").onsubmit = async e => {
      e.preventDefault(); const m = $("#rMsg"), f = $("#rFile").files[0]; if (!f) return;
      if (f.size > 20 * 1024 * 1024) { m.textContent = "El archivo pesa más de 20 MB. Comprímelo o recórtalo e inténtalo de nuevo."; return; }
      $("#rGo").disabled = true; m.textContent = "Subiendo…";
      try {
        const assets = await window.claude?.use?.("assets");
        if (!assets) throw new Error("noassets");
        const r = await assets.upload(f);
        await Store.addReel({ id: r.id, title: $("#rTitle").value.trim(), url: r.url, ig: $("#rIg").value.trim() });
        m.textContent = "Listo: el reel ya aparece en la sección Instagram."; renderPanel();
      } catch (err) { m.textContent = err.message === "noassets" || err.message === "local" ? "La subida directa está disponible en la versión publicada para editores. En el sitio final, copia el .mp4 a assets/videos/ y agrega una línea en config.js." : "No se pudo subir el reel. Revisa el archivo e inténtalo de nuevo."; $("#rGo").disabled = false; }
    };
  }
}
$("#panelBody").onclick = async e => {
  const b = e.target.closest("[data-a]"); if (!b) return; b.disabled = true;
  try {
    if (b.dataset.a === "ok") await Store.status(b.dataset.c, "confirmada");
    if (b.dataset.a === "cancel") await Store.cancel(b.dataset.c);
    if (b.dataset.a === "delrl") { await Store.removeReel(b.dataset.c); try { (await window.claude?.use?.("assets"))?.delete?.(b.dataset.c); } catch {} }
  } catch {}
  renderPanel();
};
$("#panelTabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; ptab = b.dataset.t; renderPanel(); };
const openPanel = () => { panel.hidden = false; renderPanel(); panel.scrollIntoView({ behavior: "smooth" }); };
$("#openPanel").onclick = (e) => { e.preventDefault(); openPanel(); };

/* ---------- Carruseles horizontales: botones, arrastre y teclas ---------- */
function carousel(track, wrap) {
  const btns = $$("button[data-dir]", wrap), upd = () => { btns[0].disabled = track.scrollLeft < 4; btns[1].disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4; };
  btns.forEach(b => { b.onclick = () => track.scrollBy({ left: +b.dataset.dir * track.clientWidth * .75, behavior: "smooth" }); });
  track.addEventListener("scroll", upd, { passive: true }); addEventListener("resize", upd); setTimeout(upd, 400);
  let down = false, sx = 0, sl = 0;
  track.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.target.closest("input,button,a")) return; down = true; sx = e.clientX; sl = track.scrollLeft; });
  addEventListener("pointermove", e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) track.classList.add("drag"); track.scrollLeft = sl - dx; });
  addEventListener("pointerup", () => { down = false; track.classList.remove("drag"); });
}
[["cases", "#cases"], ["reels", "#reels"]].forEach(([k, sel]) => { const t = $(sel), w = $(`[data-car="${k}"]`); if (t && w) carousel(t, w); });

/* ---------- Titular del inicio ---------- */
(function () {
  const H = $("#h1"), lines = Array.isArray(C.headline) ? C.headline : [C.headline];
  H.setAttribute("aria-label", lines.join(" "));
  H.innerHTML = lines.map((t, i) => `<span class="ln l${i}" aria-hidden="true"><span class="in">${esc(t)}</span></span>`).join("");
})();

/* ---------- Palabras que suben (h2), cursor con etiqueta ---------- */
function split(el) {
  let i = 0;
  const walk = (n) => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) {
      const f = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) f.append(" "); else { const w = document.createElement("span"); w.className = "w"; w.innerHTML = `<span class="in" style="--i:${i++}">${esc(t)}</span>`; f.append(w); } });
      c.replaceWith(f);
    } else if (c.nodeType === 1) walk(c);
  });
  walk(el);
}
$$(".split").forEach(split);
const cur = $("#cur");
if (cur && matchMedia("(hover:hover)").matches) {
  let x = 0, y = 0, tx = 0, ty = 0;
  addEventListener("pointermove", e => {
    tx = e.clientX; ty = e.clientY; cur.classList.add("on");
    const t = e.target.closest?.("[data-cur]");
    if (t) { cur.firstElementChild.textContent = t.dataset.cur; cur.classList.add("big"); } else cur.classList.remove("big");
  }, { passive: true });
  document.addEventListener("pointerleave", () => cur.classList.remove("on"));
  const f = () => { x += (tx - x) * .22; y += (ty - y) * .22; cur.style.transform = `translate(${x}px,${y}px)`; requestAnimationFrame(f); }; f();
}

/* ---------- Agenda negra: la luz sigue al cursor ---------- */
(function () {
  const s = $("#cita"); if (!s || !matchMedia("(hover:hover)").matches) return;
  s.addEventListener("pointermove", e => { const r = s.getBoundingClientRect(); s.style.setProperty("--bx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%"); s.style.setProperty("--by", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%"); }, { passive: true });
})();

/* ---------- Revelado al hacer scroll + arranque ---------- */
const io = new IntersectionObserver(es => es.forEach(x => {
  if (!x.isIntersecting) return;
  x.target.classList.add("in"); x.target.classList.remove("pre"); io.unobserve(x.target);
  $$("[data-n]", x.target).forEach(countUp);
}), { threshold: .12 });
const watch = () => $$(".rv,.cr,.split").forEach(n => { if (n.dataset.w) return; n.dataset.w = 1; if (!n.classList.contains("split") && n.getBoundingClientRect().top > innerHeight) n.classList.add("pre"); io.observe(n); });
watch(); new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });

Store.on(() => { renderNext(); renderPanel(); $("#openPanel").hidden = !(Store.S.mode === "cloud" && Store.S.admin); });
let lastReels = "";
Store.on(() => { const sig = Object.keys(Store.S.reels).join(); if (sig !== lastReels) { lastReels = sig; renderReels(); } });
renderReels(); renderNext(); onScroll();
Store.init();
if (location.hash === "#panel") openPanel();
window.ldHold?.(Promise.all([document.fonts?.ready, Promise.race([Promise.all(wallVideos.slice(0, 4).map(v => new Promise(r => { if (v.readyState >= 2) return r(); v.addEventListener("loadeddata", r, { once: true }); v.addEventListener("error", r, { once: true }); }))), sleep(5000)])]));
})();
