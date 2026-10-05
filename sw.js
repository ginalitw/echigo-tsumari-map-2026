/* 大地藝術祭 2026 作品地圖：離線快取
   網頁：先連網，連不上用快取；底圖與路線計算：先連網，成功就存一份，離線時用存過的。
   底圖（OpenStreetMap 與國土地理院）只存看過的圖磚（不預先下載），合計最多約 1500 張，超過就刪最舊的。 */
const V = "v6";  // 每次改快取內容就加一，讓舊快取被清掉
const PAGE = "etmap-page-" + V, TILE = "etmap-tiles-" + V, API = "etmap-api-" + V;
const MAX = {[TILE]: 1500, [API]: 150};
self.addEventListener("install", e => {
  e.waitUntil(caches.open(PAGE).then(c => c.addAll(["./"]).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("etmap-") && ![PAGE, TILE, API].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
let puts = 0;
async function trim(name){
  const c = await caches.open(name), ks = await c.keys(), over = ks.length - MAX[name];
  for (let i = 0; i < over; i++) await c.delete(ks[i]);
}
async function netFirst(req, name, key){
  const c = await caches.open(name);
  try {
    const r = await fetch(req);
    if (r && (r.ok || r.type === "opaque") && req.method === "GET"){
      c.put(key || req, r.clone()).then(() => { if (MAX[name] && ++puts % 40 === 0) trim(name); }).catch(() => {});
    }
    return r;
  } catch (err){
    const hit = await c.match(key || req, {ignoreSearch: name === PAGE});
    if (hit) return hit;
    if (name === PAGE){ const any = await c.match("./"); if (any) return any; }
    throw err;
  }
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (req.mode === "navigate" && u.origin === location.origin){ e.respondWith(netFirst(req, PAGE, u.origin + u.pathname)); return; }
  if (u.origin === location.origin){ e.respondWith(netFirst(req, PAGE)); return; }
  if (u.hostname === "tile.openstreetmap.org" || u.hostname === "cyberjapandata.gsi.go.jp"){ e.respondWith(netFirst(req, TILE)); return; }  // 兩種底圖共用同一個 1500 張上限
  if (u.hostname === "router.project-osrm.org" || u.hostname === "routing.openstreetmap.de"){ e.respondWith(netFirst(req, API)); return; }
});
