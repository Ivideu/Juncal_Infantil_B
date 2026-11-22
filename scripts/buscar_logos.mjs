// Busca candidatos a logo en las webs de los patrocinadores y los guarda en logos-candidatos/<id>/ (para revisarlos a mano).
import fs from "node:fs"; import path from "node:path";
const SITES = {
  ayuntamiento: "https://www.ayto-torrejon.es/", asiem: "https://www.administracionfincastorrejon.es/", provan: "https://www.provan.info/",
  hurtado: "https://www.hurtadosl.es/", lasercor: "https://www.lasercor.com/", cedecar: "https://cedecar.com/",
  delaoliva: "https://delaoliva.com/", bbva: "https://www.bbva.es/", cosmos: "https://www.cosmos.tel/"
};
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "accept-language": "es-ES,es;q=0.9" };
const OUT = "logos-candidatos"; fs.rmSync(OUT, { recursive: true, force: true });
const abs = (u, base) => { try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return null; } };
for (const [id, url] of Object.entries(SITES)) {
  fs.mkdirSync(path.join(OUT, id), { recursive: true });
  const log = [];
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const html = await r.text(); log.push(`${url} -> ${r.status} ${r.url} (${html.length} bytes)`);
    const c = new Map(); const add = (u, why) => { const a = u && abs(u, r.url); if (a && !/^data:/.test(a) && !c.has(a)) c.set(a, why); };
    for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/gi)) add(m[1], "og");
    for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/gi)) add(m[1], "og");
    for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch)[^"']*["'][^>]*href=["']([^"']+)/gi)) add(m[1], "icon");
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) { const t = m[0]; if (/logo/i.test(t)) { const s = t.match(/(?:data-src|src)=["']([^"']+)/i); if (s) add(s[1], "img-logo"); } }
    for (const m of html.matchAll(/["'(]([^"'()\s]*logo[^"'()\s]*\.(?:svg|png|webp|jpe?g))/gi)) add(m[1], "ref-logo");
    let n = 0;
    for (const [u, why] of c) {
      if (n >= 8) break;
      try {
        const rr = await fetch(u, { headers: { ...UA, referer: url }, signal: AbortSignal.timeout(25000) });
        const buf = Buffer.from(await rr.arrayBuffer());
        if (!rr.ok || buf.length < 300) { log.push(`  x ${rr.status} ${u}`); continue; }
        const ext = (u.split("?")[0].match(/\.(svg|png|webp|jpe?g|ico|gif)$/i) || [, "bin"])[1].toLowerCase();
        const f = `${++n}-${why}.${ext}`; fs.writeFileSync(path.join(OUT, id, f), buf); log.push(`  ${f} ${buf.length}B ${u}`);
      } catch (e) { log.push(`  x ${u} ${e.message}`); }
    }
  } catch (e) { log.push(`ERROR ${url}: ${e.message}`); }
  fs.writeFileSync(path.join(OUT, id, "_log.txt"), log.join("\n")); console.log(id, log.length);
}
