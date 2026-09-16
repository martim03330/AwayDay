// Põe os grandes estádios da Europa no passaporte.
//
// O passaporte tinha os 57 nacionais e os estádios onde as equipas portuguesas já jogaram fora. Faltavam os que
// qualquer adepto quer visitar um dia — Camp Nou, Wembley, Signal Iduna Park — e que não aparecem em nenhum jogo da
// app. Passam a estar lá para carimbar.
//
// De onde vêm: Wikidata (nome, capacidade, país e coordenadas) e Nominatim (a cidade, em português). Só entram
// estádios que **são casa de um clube** e que **não foram demolidos** — nada de ruínas nem de projetos.
//
// Estes estádios entram sem clube associado: as cores de um clube estrangeiro não se adivinham, e a app já sabe
// mostrar um estádio sem dono.
//
// Uso:
//   npm run --silent db:estadios-europa > /tmp/estadios-europa.sql   (relatório no stderr)
//   supabase db query --linked -f /tmp/estadios-europa.sql
//
// Dados: Wikidata (CC0) e © contribuidores do OpenStreetMap (Nominatim).

const WIKIDATA = 'https://query.wikidata.org/sparql';
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'AwayDay/0.1 (passport stadiums import; developer machine)';
/** Um estádio grande é o que enche uma cidade em dia de jogo. */
const CAPACIDADE_MINIMA = 40000;
/** Já temos este estádio se houver outro a esta distância. */
const MESMO_ESTADIO_M = 500;

/**
 * Recintos que o Wikidata dá como casa de um clube mas que ninguém visita hoje: ruínas, campos desativados e
 * capacidades históricas de bancadas que já lá não estão. Verificados um a um; sem isto, entravam no passaporte
 * como se fossem estádios a sério.
 */
const FORA = new Set([
  'Q5053042', // Cathkin Park, Glasgow: ruína desde 1967.
  'Q700462', // Parkstadion, Gelsenkirchen: desativado desde 2001.
  'Q462720', // Preußenstadion, Münster: capacidade histórica.
  'Q2066462', // Stade des Trois Tilleuls, Bruxelas: capacidade histórica.
  'Q668606', // Stade Olympique de la Pontaise, Lausanne: capacidade histórica.
]);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).'
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(h)));
}

/** "Signal Iduna Park" -> "signal-iduna-park". */
function idDoNome(nome) {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Em português diz-se «o Camp Nou» mas «a Allianz Arena»: o artigo segue a palavra que manda no nome. */
function artigo(nome) {
  return /\barena\b/i.test(nome) ? 'a' : 'o';
}

async function sparql(consulta) {
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    try {
      const resposta = await fetch(`${WIKIDATA}?query=${encodeURIComponent(consulta)}`, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
      });
      if (resposta.ok) return (await resposta.json()).results.bindings;
      console.error(`Wikidata respondeu ${resposta.status}; nova tentativa daqui a pouco.`);
    } catch (erro) {
      console.error('Wikidata falhou:', erro instanceof Error ? erro.message : erro);
    }
    await sleep(10000);
  }
  return null;
}

/** A cidade, como se diz em português. `null` quando não se sabe: o estádio fica de fora. */
async function cidadeDe(ponto) {
  const parametros = new URLSearchParams({
    format: 'jsonv2',
    lat: String(ponto.latitude),
    lon: String(ponto.longitude),
    zoom: '10',
    'accept-language': 'pt',
  });
  try {
    const resposta = await fetch(`${NOMINATIM}?${parametros}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    await sleep(1100);
    if (!resposta.ok) return null;
    const morada = (await resposta.json())?.address ?? {};
    const nome = morada.city ?? morada.town ?? morada.municipality ?? morada.county ?? null;
    return typeof nome === 'string' && nome.length >= 2 ? nome.slice(0, 80) : null;
  } catch {
    await sleep(2000);
    return null;
  }
}

// 1. Os estádios grandes da Europa, com capacidade, país e coordenadas.
const grandes = await sparql(`
SELECT ?item ?itemLabel ?countryLabel ?capacity ?coord WHERE {
  ?item wdt:P31/wdt:P279* wd:Q483110 ;
        wdt:P641 wd:Q2736 ;
        wdt:P1083 ?capacity ;
        wdt:P17 ?country ;
        wdt:P625 ?coord .
  ?country wdt:P30 wd:Q46 .
  FILTER(?capacity >= ${CAPACIDADE_MINIMA})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
}`);
if (!grandes) {
  console.error('Não deu para falar com o Wikidata. Tenta mais tarde.');
  process.exit(1);
}

const porItem = new Map();
for (const linha of grandes) {
  const qid = linha.item.value.split('/').pop();
  const capacidade = Math.round(Number(linha.capacity.value));
  const anterior = porItem.get(qid);
  if (!anterior || capacidade > anterior.capacidade) {
    const [, longitude, latitude] = /Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(linha.coord.value) ?? [];
    porItem.set(qid, {
      qid,
      nome: linha.itemLabel.value.charAt(0).toUpperCase() + linha.itemLabel.value.slice(1),
      pais: linha.countryLabel.value,
      capacidade,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }
}

// 2. Fora os demolidos e os que não são casa de clube nenhum.
const valores = [...porItem.keys()].map((qid) => `wd:${qid}`).join(' ');
const estado = await sparql(`
SELECT ?item ?fim ?clube WHERE {
  VALUES ?item { ${valores} }
  OPTIONAL { ?item wdt:P576 ?fim }
  OPTIONAL { ?clube wdt:P115 ?item }
}`);
if (!estado) {
  console.error('Não deu para confirmar quais ainda existem. Tenta mais tarde.');
  process.exit(1);
}

const demolidos = new Set();
const comClube = new Set();
for (const linha of estado) {
  const qid = linha.item.value.split('/').pop();
  if (linha.fim) demolidos.add(qid);
  if (linha.clube) comClube.add(qid);
}

const candidatos = [...porItem.values()].filter(
  (estadio) =>
    !demolidos.has(estadio.qid) &&
    !FORA.has(estadio.qid) &&
    comClube.has(estadio.qid) &&
    Number.isFinite(estadio.latitude) &&
    Number.isFinite(estadio.longitude)
);

// 3. Os que a app já conhece ficam como estão: têm jogos, clube e tudo o resto.
const resposta = await fetch(`${SUPABASE_URL}/rest/v1/venue?select=id,name,latitude,longitude`, {
  headers: { apikey: SUPABASE_KEY },
});
const existentes = await resposta.json();

const statements = [];
const relatorio = { novos: 0, jaExistiam: 0, semCidade: [] };

for (const estadio of candidatos.sort((a, b) => b.capacidade - a.capacidade)) {
  const perto = existentes.find(
    (outro) =>
      outro.latitude !== null &&
      distanceMeters(estadio, { latitude: outro.latitude, longitude: outro.longitude }) <=
        MESMO_ESTADIO_M
  );
  if (perto) {
    relatorio.jaExistiam += 1;
    continue;
  }

  const cidade = await cidadeDe(estadio);
  if (!cidade) {
    relatorio.semCidade.push(estadio.nome);
    continue;
  }

  const id = idDoNome(estadio.nome);
  statements.push(
    `insert into public.venue (id, name, name_article, city, country, region, capacity, location) values (` +
      `${literal(id)}, ${literal(estadio.nome)}, ${literal(artigo(estadio.nome))}, ${literal(cidade)}, ` +
      `${literal(estadio.pais)}, 'abroad', ${estadio.capacidade}, ` +
      `extensions.st_setsrid(extensions.st_makepoint(${estadio.longitude}, ${estadio.latitude}), 4326)::extensions.geography) ` +
      `on conflict (id) do nothing;`
  );
  relatorio.novos += 1;
  console.error(`${estadio.nome} · ${cidade}, ${estadio.pais} · ${estadio.capacidade} lugares`);
}

console.log('-- Generated by scripts/importar-estadios-europa.mjs. Wikidata (CC0) + Nominatim (ODbL).');
console.log('begin;');
console.log(statements.join('\n'));
console.log('commit;');
console.error(
  `\n${relatorio.novos} estádios novos; ${relatorio.jaExistiam} já existiam; ${relatorio.semCidade.length} sem cidade conhecida.`
);
for (const nome of relatorio.semCidade) console.error(`  - ${nome}`);
