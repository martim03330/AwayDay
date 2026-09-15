// Looks for official fan information (meeting point, transport, gates) on the clubs' own news pages, for European
// away games of Portuguese clubs in the next 7 days that do not have a meeting point yet. Found articles become
// drafts for an admin to confirm; nothing is published here. pg_cron calls it with the shared secret.
// Only clubs whose news pages carry plain links are covered (Braga and Torreense render theirs with JavaScript).
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasCronSecret } from '../_shared/auth.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';

const NEWS_PAGES: Readonly<Record<string, string>> = {
  benfica: 'https://www.slbenfica.pt/pt-pt/agora/noticias',
  porto: 'https://www.fcporto.pt/pt/noticias',
  sporting: 'https://www.sporting.pt/pt/noticias',
};
const EUROPEAN = ['champions', 'liga-europa', 'conference'];
const LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const USER_AGENT = 'AwayDay/1.0 (official fan information check for a match-day app)';
const MAX_ARTICLES_PER_FIXTURE = 3;
const MAX_EXCERPT = 1800;

/** A fan-information article, on the normalised link text and address. */
const FAN_INFO =
  /informac(ao|oes)\b.{0,40}\b(adeptos|benfiquistas|portistas|sportinguistas)|ponto de encontro|meeting point/;
/** Sentences worth showing the admin. */
const USEFUL =
  /ponto de encontro|concentra|meeting point|autocarro|metro|escolta|porta|entrada|setor|bilhete|documento|proibid|acesso|transporte/;

type Link = { url: string; text: string };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Lowercase, no accents, dashes and slashes as spaces: "Informações-aos-Adeptos" -> "informacoes aos adeptos". */
function normalise(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ');
}

/** HTML entities the clubs' pages use, accented Portuguese letters included ("est&aacute;dio"). */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
  middot: '·',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  iacute: 'í',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  uacute: 'ú',
  uuml: 'ü',
  ccedil: 'ç',
  ntilde: 'ñ',
  Aacute: 'Á',
  Agrave: 'À',
  Acirc: 'Â',
  Atilde: 'Ã',
  Eacute: 'É',
  Ecirc: 'Ê',
  Iacute: 'Í',
  Oacute: 'Ó',
  Ocirc: 'Ô',
  Otilde: 'Õ',
  Uacute: 'Ú',
  Ccedil: 'Ç',
};

function decodeEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => NAMED_ENTITIES[name] ?? entity);
}

function plainText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

async function fetchText(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

function linksIn(html: string, base: string): Link[] {
  const links: Link[] = [];
  for (const match of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeEntities(match[1]), base);
      if (url.protocol !== 'https:') continue;
      links.push({ url: url.toString(), text: plainText(match[2]) });
    } catch {
      // Not a usable address.
    }
  }
  return links;
}

function titleOf(html: string, fallback: string) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return (plainText(h1 ?? title ?? '') || fallback || 'Informações para os adeptos').slice(0, 300);
}

function excerptOf(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && USEFUL.test(normalise(sentence)));
  let excerpt = '';
  for (const sentence of sentences) {
    if (excerpt.length + sentence.length + 1 > MAX_EXCERPT) break;
    excerpt += (excerpt ? '\n' : '') + sentence;
  }
  return excerpt;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!hasCronSecret(request)) return json(401, { error: 'not_authorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const [fixtures, points, drafts] = await Promise.all([
    admin
      .from('fixture')
      .select('id, home_club_id, away_club_id, venue_id, competition_id, kickoff_at')
      .in('competition_id', EUROPEAN)
      .in('away_club_id', Object.keys(NEWS_PAGES))
      .gte('kickoff_at', now.toISOString())
      .lte('kickoff_at', new Date(now.getTime() + LOOKAHEAD_MS).toISOString()),
    admin.from('fixture_meeting_point').select('fixture_id'),
    admin.from('meeting_point_draft').select('fixture_id, source_url'),
  ]);
  if (fixtures.error || points.error || drafts.error) return json(500, { error: 'read_failed' });

  const published = new Set((points.data ?? []).map((row) => text(asRecord(row)?.fixture_id)));
  const drafted = new Set(
    (drafts.data ?? []).map(
      (row) => `${text(asRecord(row)?.fixture_id)}|${text(asRecord(row)?.source_url)}`
    )
  );
  const pending = (fixtures.data ?? [])
    .map((row) => asRecord(row))
    .filter(
      (row): row is Readonly<Record<string, unknown>> =>
        row !== null && !published.has(text(row.id))
    );

  const summary = { fixtures: pending.length, articles_checked: 0, drafts_created: 0 };
  if (pending.length === 0) return json(200, summary);

  const clubIds = [
    ...new Set(pending.flatMap((row) => [text(row.home_club_id), text(row.away_club_id)])),
  ];
  const venueIds = [...new Set(pending.map((row) => text(row.venue_id)))];
  const [clubs, venues] = await Promise.all([
    admin.from('club').select('id, name, short_name').in('id', clubIds),
    admin.from('venue').select('id, city').in('id', venueIds),
  ]);
  if (clubs.error || venues.error) return json(500, { error: 'read_failed' });
  const clubById = new Map(
    (clubs.data ?? []).map((row) => [text(asRecord(row)?.id), asRecord(row)])
  );
  const cityByVenue = new Map(
    (venues.data ?? []).map((row) => [text(asRecord(row)?.id), text(asRecord(row)?.city)])
  );

  const newsByClub = new Map<string, Link[]>();
  for (const clubId of new Set(pending.map((row) => text(row.away_club_id)))) {
    const page = NEWS_PAGES[clubId];
    const html = page ? await fetchText(page) : null;
    newsByClub.set(clubId, html && page ? linksIn(html, page) : []);
  }

  for (const fixture of pending) {
    const fixtureId = text(fixture.id);
    const awayId = text(fixture.away_club_id);
    const home = clubById.get(text(fixture.home_club_id));
    // Words that tie an article to this game: the opponent's names and the host city.
    const tokens = [
      text(home?.short_name),
      text(home?.name),
      cityByVenue.get(text(fixture.venue_id)) ?? '',
    ]
      .flatMap((value) => normalise(value).split(/\s+/))
      .filter(
        (word) =>
          word.length >= 4 && !['clube', 'club', 'football', 'futbol', 'sport'].includes(word)
      );

    const candidates = (newsByClub.get(awayId) ?? []).filter((link) => {
      const haystack = normalise(`${link.url} ${link.text}`);
      return FAN_INFO.test(haystack) && tokens.some((token) => haystack.includes(token));
    });
    const unique = [...new Map(candidates.map((link) => [link.url, link])).values()]
      .filter((link) => !drafted.has(`${fixtureId}|${link.url}`))
      .slice(0, MAX_ARTICLES_PER_FIXTURE);

    for (const link of unique) {
      summary.articles_checked += 1;
      const html = await fetchText(link.url);
      if (!html) continue;
      const excerpt = excerptOf(plainText(html));
      if (!excerpt) continue;
      const inserted = await admin.from('meeting_point_draft').insert({
        fixture_id: fixtureId,
        club_id: awayId,
        source_url: link.url,
        source_title: titleOf(html, link.text),
        excerpt,
      });
      if (!inserted.error) summary.drafts_created += 1;
    }
  }

  if (summary.drafts_created > 0) {
    const admins = await admin.from('profile').select('id').eq('is_admin', true);
    const adminIds = (admins.data ?? []).map((row) => text(asRecord(row)?.id)).filter(Boolean);
    const tokens = adminIds.length
      ? await admin.from('device_token').select('token').in('profile_id', adminIds)
      : { data: [] };
    const messages = (tokens.data ?? []).map((row) => ({
      to: text(asRecord(row)?.token),
      title: 'Ponto de encontro por confirmar',
      body:
        summary.drafts_created === 1
          ? 'Um clube publicou informações para os adeptos. Confirma na app antes de aparecer.'
          : `${summary.drafts_created} artigos com informações para os adeptos. Confirma na app antes de aparecerem.`,
      data: { type: 'meeting-point-draft' },
    }));
    const outcome = await sendExpoPush(messages.filter((message) => message.to));
    if (outcome.invalidTokens.length > 0) {
      await admin.from('device_token').delete().in('token', outcome.invalidTokens);
    }
  }

  return json(200, summary);
});
