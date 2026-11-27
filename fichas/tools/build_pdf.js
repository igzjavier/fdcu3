// Genera un PDF por ficha (A4 vertical, dos columnas, título a todo el ancho).
// Uso:  node fichas/tools/build_pdf.js            -> todas las fichas
//       node fichas/tools/build_pdf.js 01 05      -> solo las indicadas
// Los textos viven en fichas/data/NN.json; el formato de cada bloque viene de fichas/index.html.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const fnSrc = script.slice(script.indexOf('var TAG='), script.indexOf('function home('));
const lib = new Function(fnSrc + '; return {esc, rich, groupsOf, entHTML, TAG};')();

const CSS = `
@page{size:A4 portrait}
:root{--fg:#111;--mute:#555;--hair:#cfcfcf;--accent:#d4001a;--accent-text:#d4001a;
--c-def:#1f4fd8;--c-mec:#7b3fe4;--c-cau:#0a8754;--c-cli:#b86e00;--c-exa:#c2185b;--c-dif:#00838f;--c-con:#4a5568;
--sans:'Inter','Helvetica Neue',Arial,sans-serif;--mono:'DejaVu Sans Mono',monospace}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:var(--sans);font-size:7.9pt;line-height:1.32;color:var(--fg)}
.cols{column-count:2;column-gap:7mm;column-rule:.4pt solid var(--hair)}
.dh{column-span:all;display:grid;grid-template-columns:auto 1fr;gap:1mm 5mm;align-items:end;border-bottom:1.6pt solid var(--fg);padding-bottom:2.2mm;margin-bottom:3mm}
.dh .big{font-weight:900;font-size:44pt;line-height:.8;letter-spacing:-.06em;color:var(--accent-text)}
.dh h1{margin:0;font-size:19pt;line-height:1;letter-spacing:-.035em;font-weight:900}
.dh .sub{grid-column:2;color:var(--mute);font-size:8.5pt}
.gh{column-span:all;display:flex;gap:4mm;align-items:baseline;border-top:1.6pt solid var(--fg);padding-top:1.5mm;margin:2mm 0 3mm}
.gh .k{font:500 6.5pt var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.gh h2{margin:0;font-size:11pt;font-weight:800;letter-spacing:-.02em}
.ent{margin:0 0 3.2mm;padding-top:1mm;border-top:2.4pt solid var(--kc,var(--fg))}
.ent h3{margin:0 0 1mm;font-size:9.6pt;font-weight:800;letter-spacing:-.02em;line-height:1.15;display:flex;justify-content:space-between;gap:2mm;align-items:baseline;break-after:avoid}
.ent h3 span{box-shadow:inset 0 -.38em 0 color-mix(in srgb,var(--kc,var(--fg)) 22%,transparent)}
.ent h3 em{font:500 5.8pt var(--mono);font-style:normal;text-transform:uppercase;letter-spacing:.08em;color:var(--kc);white-space:nowrap}
.k-sintoma{--kc:var(--c-def)}.k-signo{--kc:var(--c-cau)}.k-sindrome{--kc:var(--c-mec)}.k-tabla{--kc:var(--c-cli)}
.ent p{margin:0 0 1.1mm;break-inside:avoid;orphans:2;widows:2}
.ent p b{font-weight:800;font-size:6.6pt;text-transform:uppercase;letter-spacing:.04em;margin-right:1.2mm;color:var(--lc,var(--fg))}
.l-def{--lc:var(--c-def)}.l-mec{--lc:var(--c-mec)}.l-cau{--lc:var(--c-cau)}.l-cli{--lc:var(--c-cli)}.l-exa{--lc:var(--c-exa)}.l-dif{--lc:var(--c-dif)}.l-con{--lc:var(--c-con)}
.ent p u{text-decoration:underline;text-decoration-thickness:1.1pt;text-underline-offset:1pt;text-decoration-color:var(--lc,var(--fg));text-decoration-skip-ink:none}
td u{text-decoration:underline;text-decoration-thickness:1pt;text-underline-offset:1pt;text-decoration-color:var(--kc)}
.w{color:var(--accent-text);font-weight:800}
.tw{margin:1mm 0 1.6mm;break-inside:avoid}
.cap{font:500 5.8pt var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--kc);margin:0 0 .5mm}
table{border-collapse:collapse;width:100%;font-size:6.9pt;line-height:1.25}
th,td{padding:.55mm 1.4mm .55mm 0;text-align:left;vertical-align:top;border-bottom:.4pt solid var(--hair)}
th{font:500 5.8pt var(--mono);text-transform:uppercase;letter-spacing:.05em;border-bottom:1.2pt solid var(--kc,var(--fg))}
td:first-child{font-weight:700}
.flow{display:flex;flex-wrap:wrap;gap:.8mm;margin:.6mm 0 1.6mm;font-size:6.8pt;font-weight:600;break-inside:avoid}
.flow span{background:color-mix(in srgb,var(--kc) 14%,transparent);border-left:1.6pt solid var(--kc);padding:.5mm 1.4mm;line-height:1.2}
.flow i{font-style:normal;align-self:center;color:var(--mute)}
.al{background:var(--accent);color:#fff;padding:1.2mm 1.8mm;margin-top:1.4mm;font-size:7.2pt;font-weight:600;line-height:1.3;break-inside:avoid}
.al b{display:block;font:500 5.6pt var(--mono);text-transform:uppercase;letter-spacing:.1em;opacity:.9;margin:0 0 .3mm}
`;

function pageHTML(d) {
  const gs = lib.groupsOf(d);
  let h = `<div class="cols"><header class="dh"><div class="big">${d.id}</div><h1>${lib.esc(d.titulo)}</h1><div class="sub">${lib.esc(d.sub || '')}</div></header>`;
  gs.forEach((g, gi) => {
    if (g.titulo || gs.length > 1) h += `<div class="gh"><span class="k">Ficha ${gi + 1} de ${gs.length}</span><h2>${lib.esc(g.titulo || d.titulo)}</h2></div>`;
    g.ents.forEach((e, ei) => { h += lib.entHTML(e, d.id, gi, ei, ''); });
  });
  return `<!doctype html><html lang="es"><meta charset="utf-8"><style>${CSS}</style><body>${h}</div></body></html>`;
}

(async () => {
  const want = process.argv.slice(2);
  const ids = want.length ? want : fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('.json')).map(f => f.slice(0, 2)).sort();
  const browser = await chromium.launch();
  for (const id of ids) {
    const d = JSON.parse(fs.readFileSync(path.join(root, 'data', id + '.json'), 'utf8'));
    const page = await browser.newPage();
    await page.setContent(pageHTML(d), { waitUntil: 'load' });
    const out = path.join(root, 'pdf', `${id} ${d.titulo}.pdf`);
    await page.pdf({
      path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
      margin: { top: '11mm', bottom: '13mm', left: '10mm', right: '10mm' },
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font:7px 'DejaVu Sans Mono',monospace;color:#777;padding:0 10mm;display:flex;justify-content:space-between"><span>FDC · U3 · ${id} ${d.titulo.replace(/[<&]/g, '')}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`
    });
    await page.close();
    console.log('OK', out);
  }
  await browser.close();
})();
