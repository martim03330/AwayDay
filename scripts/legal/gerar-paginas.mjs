// Gera as páginas públicas da política de privacidade, dos termos e do «sobre» a partir de src/lib/legal.ts — os
// mesmos textos da app. São estas páginas que a App Store e o Google Play pedem (link da política de privacidade).
//
// Corre na raiz do projeto:  node --experimental-strip-types scripts/legal/gerar-paginas.mjs
// Escreve em docs/legal/*.html.

import { mkdirSync, writeFileSync } from 'node:fs';
import { DOCUMENTOS_LEGAIS } from '../../src/lib/legal.ts';

const escapar = (texto) =>
  texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function pagina(doc) {
  const outros = DOCUMENTOS_LEGAIS.filter((outro) => outro.id !== doc.id)
    .map((outro) => `<a href="./${outro.id}.html">${escapar(outro.titulo)}</a>`)
    .join(' · ');
  const seccoes = doc.seccoes
    .map((seccao) => {
      const blocos = seccao.blocos
        .map((bloco) =>
          bloco.tipo === 'paragrafo'
            ? `<p>${escapar(bloco.texto)}</p>`
            : `<ul>${bloco.itens.map((item) => `<li>${escapar(item)}</li>`).join('')}</ul>`
        )
        .join('\n');
      return `<section>\n<h2>${escapar(seccao.titulo)}</h2>\n${blocos}\n</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(doc.titulo)} · AwayDay</title>
<meta name="description" content="${escapar(doc.resumo)}">
<style>
  :root { color-scheme: light dark; --texto: #13241B; --fundo: #F8F7F2; --suave: #4A5A50; --verde: #16713F; }
  @media (prefers-color-scheme: dark) { :root { --texto: #E7EEE8; --fundo: #0E1512; --suave: #A6B5AA; --verde: #68CE93; } }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 1.2rem; margin: 32px 0 8px; }
  p, li { color: var(--texto); }
  .resumo, .data { color: var(--suave); }
  a { color: var(--verde); font-weight: 600; }
  a:focus-visible { outline: 3px solid var(--verde); outline-offset: 2px; }
  nav { margin-top: 48px; padding-top: 16px; border-top: 1px solid currentColor; opacity: 0.9; }
</style>
</head>
<body>
<main>
<h1>${escapar(doc.titulo)}</h1>
<p class="resumo">${escapar(doc.resumo)}</p>
<p class="data">Atualizado a ${escapar(doc.atualizadoEm)}</p>
${seccoes}
<nav aria-label="Outros documentos">${outros}</nav>
</main>
</body>
</html>
`;
}

function indice() {
  const itens = DOCUMENTOS_LEGAIS.map(
    (doc) => `<li><a href="./${doc.id}.html">${escapar(doc.titulo)}</a><br><span class="resumo">${escapar(doc.resumo)}</span></li>`
  ).join('\n');
  return pagina({
    id: 'index',
    titulo: 'AwayDay',
    resumo: 'Documentos da app AwayDay.',
    atualizadoEm: DOCUMENTOS_LEGAIS[0].atualizadoEm,
    seccoes: [],
  }).replace('<nav aria-label="Outros documentos">', `<ul>${itens}</ul>\n<nav aria-label="Outros documentos" hidden>`);
}

mkdirSync('docs/legal', { recursive: true });
writeFileSync('docs/legal/index.html', indice());
console.log('docs/legal/index.html');
for (const doc of DOCUMENTOS_LEGAIS) {
  writeFileSync(`docs/legal/${doc.id}.html`, pagina(doc));
  console.log(`docs/legal/${doc.id}.html`);
}
