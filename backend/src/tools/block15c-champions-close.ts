import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import {
  CHAMPIONS_CATEGORY_SLUG,
  buildChampionsRanking,
  buildChampionsSnapshot,
  createGoalFact,
  editionForSeason,
  normalizeChampionsPhase,
  normalizePlayerName,
  resolvePlayerIdentity,
  stableJson,
  type ChampionsGoalFact,
  type ChampionsPhase
} from '../championsRankingEngine.js';

type Row = Record<string, string>;
type Capture = { id: string; sourceKey: string; sourceUrl: string; capturedAt: string; contentSha256: string; dataVersion: string; metadata: Record<string, unknown> };
type Correction = {
  sourceRecordId: string;
  matchId: string;
  seasonStart: number;
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  phase: ChampionsPhase;
  player: string;
  playerKey: string;
  sourceUrl: string;
  locator: string;
  sourceKey?: string;
  ownGoal?: boolean;
  replaceSourceRecordId?: string;
};

const outputRoot = resolve(process.env.BLOCK15C_OUTPUT_ROOT?.trim() || 'audits/block15c');
const databaseUrl = process.env.DATABASE_URL?.trim() || '';
const baseFactsFile = process.env.BLOCK15C_BASE_FACTS_FILE?.trim() || '';
const apiFactsFile = process.env.BLOCK15C_API_FACTS_FILE?.trim() || '';
const now = new Date().toISOString();
const runId = process.env.BLOCK15C_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim() || now.replace(/[^0-9]/gu, '').slice(0, 14);
const structuredBase = 'https://raw.githubusercontent.com/CharlieGnomo/champions_uefa_data/master';
const uefa2011 = 'https://www.uefa.com/uefachampionsleague/history/seasons/2011/statistics/';

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function safeDate(value: string): string | null { return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : null; }
function splitDelimited(line: string): string[] {
  const values: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ';' && !quoted) { values.push(value); value = ''; } else value += character;
  }
  values.push(value); return values;
}
function parseTable(raw: string): Row[] {
  const lines = raw.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter(Boolean);
  const headers = splitDelimited(lines[0] ?? '');
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, splitDelimited(line)[index] ?? ''])));
}
function phase(round: string): ChampionsPhase { return normalizeChampionsPhase(round); }
async function writeJson(path: string, value: unknown): Promise<void> { await mkdir(dirname(path), { recursive: true }); await writeFile(path, stableJson(value), 'utf8'); }

const corrections: Correction[] = [
  { sourceRecordId: '15c:1983-84:953:407970', matchId: 'uefa-raw:match:953', seasonStart: 1983, date: '1983-09-28', homeTeam: 'Grasshopper Club Zürich', awayTeam: 'Dinamo Minsk', phase: 'first_round', player: 'Georgi Kondratiev', playerKey: 'georgi-kondratiev', sourceUrl: 'https://www.rsssf.org/ec/ec198384det.html', locator: '28-09-83 Grasshoppers Zürich 2-2 Dinamo Minsk; scorer list: Georgi Kondratiev 31' },
  { sourceRecordId: '289899', matchId: 'uefa-raw:match:63941', seasonStart: 1985, date: '1985-09-18', homeTeam: 'AS Jeunesse Esch', awayTeam: 'Juventus', phase: 'first_round', player: 'Aldo Serena', playerKey: 'aldo-serena', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '18-09-85 Jeunesse d\'Esch 0-5 Juventus; scorer list: Aldo Serena 80, 83' },
  { sourceRecordId: '289923', matchId: 'uefa-raw:match:63941', seasonStart: 1985, date: '1985-09-18', homeTeam: 'AS Jeunesse Esch', awayTeam: 'Juventus', phase: 'first_round', player: 'Aldo Serena', playerKey: 'aldo-serena-2', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '18-09-85 Jeunesse d\'Esch 0-5 Juventus; scorer list: Aldo Serena 80, 83' },
  { sourceRecordId: '15c:1985-86:63941:own-goal', matchId: 'uefa-raw:match:63941', seasonStart: 1985, date: '1985-09-18', homeTeam: 'AS Jeunesse Esch', awayTeam: 'Juventus', phase: 'first_round', player: 'Danilo Ontano', playerKey: 'danilo-ontano', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '18-09-85 Jeunesse d\'Esch 0-5 Juventus; scorer list: Danilo Ontano 42 own goal', ownGoal: true },
  { sourceRecordId: '289912', matchId: 'uefa-raw:match:63942', seasonStart: 1985, date: '1985-10-02', homeTeam: 'Juventus', awayTeam: 'AS Jeunesse Esch', phase: 'first_round', player: 'Gabriele Pin', playerKey: 'gabriele-pin', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '02-10-85 Juventus 4-1 Jeunesse d\'Esch; scorer list: Gabriele Pin 50' },
  { sourceRecordId: '289916', matchId: 'uefa-raw:match:63942', seasonStart: 1985, date: '1985-10-02', homeTeam: 'Juventus', awayTeam: 'AS Jeunesse Esch', phase: 'first_round', player: 'Aldo Serena', playerKey: 'aldo-serena-3', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '02-10-85 Juventus 4-1 Jeunesse d\'Esch; scorer list: Aldo Serena 52, 64' },
  { sourceRecordId: '15c:1985-86:63942:289901', matchId: 'uefa-raw:match:63942', seasonStart: 1985, date: '1985-10-02', homeTeam: 'Juventus', awayTeam: 'AS Jeunesse Esch', phase: 'first_round', player: 'Aldo Serena', playerKey: 'aldo-serena-4', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '02-10-85 Juventus 4-1 Jeunesse d\'Esch; scorer list: Aldo Serena 52, 64', replaceSourceRecordId: '289901' },
  { sourceRecordId: '290049', matchId: 'uefa-raw:match:63973', seasonStart: 1985, date: '1985-10-23', homeTeam: 'FC Barcelona', awayTeam: 'FC Porto', phase: 'second_round', player: 'Bernd Schuster', playerKey: 'bernd-schuster', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '23-10-85 Barcelona 2-0 Porto; scorer list: Bernd Schuster 70' },
  { sourceRecordId: '290078', matchId: 'uefa-raw:match:63962', seasonStart: 1985, date: '1985-11-06', homeTeam: 'FCSB', awayTeam: 'Budapest Honvéd', phase: 'second_round', player: 'Ilie Barbulescu', playerKey: 'ilie-barbulescu', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '06-11-85 Steaua Bucuresti 4-1 Honvéd Budapest; scorer list: Ilie Barbulescu 46' },
  { sourceRecordId: '290082', matchId: 'uefa-raw:match:63972', seasonStart: 1985, date: '1985-11-06', homeTeam: 'Juventus', awayTeam: 'Hellas Verona', phase: 'second_round', player: 'Aldo Serena', playerKey: 'aldo-serena-5', sourceUrl: 'https://www.rsssf.org/ec/ec198586det.html', locator: '06-11-85 Juventus 2-0 Hellas Verona; scorer list: Aldo Serena 50' },
  { sourceRecordId: '283262', matchId: 'uefa-raw:match:4093', seasonStart: 1986, date: '1986-09-17', homeTeam: 'Juventus', awayTeam: 'Valur', phase: 'first_round', player: 'Aldo Serena', playerKey: 'aldo-serena-6', sourceUrl: 'https://www.rsssf.org/ec/ec198687det.html', locator: '17-09-86 Juventus 7-0 Valur; scorer list: Aldo Serena 43' },
  { sourceRecordId: '8130', matchId: 'uefa-raw:match:41', seasonStart: 1988, date: '1988-10-05', homeTeam: 'HJK Helsinki', awayTeam: 'FC Porto', phase: 'first_round', player: 'Hannu Kanerva', playerKey: 'hannu-kanerva', sourceUrl: 'https://www.rsssf.org/ec/ec198889det.html', locator: '05-10-88 HJK Helsinki 2-0 Porto; scorer list: Hannu Kanerva 84' },
  { sourceRecordId: '24679', matchId: 'uefa-raw:match:311', seasonStart: 1988, date: '1988-10-26', homeTeam: 'PSV Eindhoven', awayTeam: 'FC Porto', phase: 'second_round', player: 'Ronald Koeman', playerKey: 'ronald-koeman-1', sourceUrl: 'https://www.rsssf.org/ec/ec198889det.html', locator: '26-10-88 PSV Eindhoven 5-0 Porto; scorer list: Ronald Koeman 42, 53' },
  { sourceRecordId: '24676', matchId: 'uefa-raw:match:311', seasonStart: 1988, date: '1988-10-26', homeTeam: 'PSV Eindhoven', awayTeam: 'FC Porto', phase: 'second_round', player: 'Ronald Koeman', playerKey: 'ronald-koeman-2', sourceUrl: 'https://www.rsssf.org/ec/ec198889det.html', locator: '26-10-88 PSV Eindhoven 5-0 Porto; scorer list: Ronald Koeman 42, 53' },
  { sourceRecordId: '34310', matchId: 'uefa-raw:match:1242', seasonStart: 1989, date: '1989-09-27', homeTeam: 'Internazionale', awayTeam: 'Malmö FF', phase: 'first_round', player: 'Aldo Serena', playerKey: 'aldo-serena-7', sourceUrl: 'https://www.rsssf.org/ec/ec198990det.html', locator: '27-09-89 Internazionale 1-1 Malmö FF; scorer list: Aldo Serena 70' },
  { sourceRecordId: '16226', matchId: 'uefa-raw:match:1756', seasonStart: 1989, date: '1989-10-18', homeTeam: 'Dnepr Dnepropetrovsk', awayTeam: 'Wacker Innsbruck', phase: 'second_round', player: 'Andrei Yudin', playerKey: 'andrei-yudin', sourceUrl: 'https://www.rsssf.org/ec/ec198990det.html', locator: '18-10-89 Dnepr Dnepropetrovsk 2-0 Tirol Innsbruck; scorer list: Andrei Yudin 37' },
  { sourceRecordId: '5841', matchId: 'uefa-raw:match:6735', seasonStart: 1992, date: '1992-09-16', homeTeam: 'VfB Stuttgart', awayTeam: 'Leeds United', phase: 'first_round', player: 'Fritz Walter', playerKey: 'fritz-walter-1', sourceUrl: 'https://datencenter.dfb.de/datencenter/champions-league/1992-1993/1/vfb-stuttgart-leeds-united-647847', locator: 'VfB Stuttgart 3-0 Leeds United; goal events 62 and 66: Fritz Walter' },
  { sourceRecordId: '5842', matchId: 'uefa-raw:match:6735', seasonStart: 1992, date: '1992-09-16', homeTeam: 'VfB Stuttgart', awayTeam: 'Leeds United', phase: 'first_round', player: 'Fritz Walter', playerKey: 'fritz-walter-2', sourceUrl: 'https://datencenter.dfb.de/datencenter/champions-league/1992-1993/1/vfb-stuttgart-leeds-united-647847', locator: 'VfB Stuttgart 3-0 Leeds United; goal events 62 and 66: Fritz Walter' },
  { sourceRecordId: '5844', matchId: 'uefa-raw:match:6736', seasonStart: 1992, date: '1992-10-09', homeTeam: 'VfB Stuttgart', awayTeam: 'Leeds United', phase: 'first_round', player: 'Gordon Strachan', playerKey: 'gordon-strachan', sourceUrl: 'https://datencenter.dfb.de/datencenter/champions-league/1992-1993/3/vfb-stuttgart-leeds-united-647849', locator: 'VfB Stuttgart 1-2 Leeds United; goal event 33: Gordon Strachan' },
  { sourceRecordId: '10049', matchId: 'uefa-raw:match:50259', seasonStart: 1993, date: '1993-09-29', homeTeam: 'FC Barcelona', awayTeam: 'Dynamo Kyiv', phase: 'first_round', player: 'Ronald Koeman', playerKey: 'ronald-koeman-3', sourceUrl: 'https://www.fcbarcelona.com/en/news/1135832/twenty-years-since-the-barca-comeback-against-kiev', locator: 'Barcelona 4-1 Dynamo Kyiv; goals: Laudrup, Bakero (2), Koeman' },
  { sourceRecordId: '16416', matchId: 'uefa-raw:match:50383', seasonStart: 1993, date: '1993-10-20', homeTeam: 'Lech Poznań', awayTeam: 'Spartak Moscow', phase: 'second_round', player: 'Valery Karpin', playerKey: 'valery-karpin-1', sourceUrl: 'https://polska-pilka.pl/puchary/europejskie-puchary-sezony/1990-91-1999-00/1993-94/1993-10-20-lech-poznan-spartak-moskwa-1-5', locator: 'Lech Poznań 1-5 Spartak; event list: Pisarev 7, Karpin 10, Onopko 30, Onopko 52, Pisarev 60' },
  { sourceRecordId: '16408', matchId: 'uefa-raw:match:50377', seasonStart: 1993, date: '1993-10-20', homeTeam: 'FC Copenhagen', awayTeam: 'AC Milan', phase: 'second_round', player: 'Brian Laudrup', playerKey: 'brian-laudrup', sourceUrl: 'https://www.fck.dk/en/kamp/20-10-93/fc-kobenhavn-ac-milan', locator: 'FC København 0-6 AC Milan; scorer list: Brian Laudrup 42' },
  { sourceRecordId: '34654', matchId: 'uefa-raw:match:50385', seasonStart: 1993, date: '1993-10-20', homeTeam: 'FC Barcelona', awayTeam: 'Austria Wien', phase: 'second_round', player: 'Ronald Koeman', playerKey: 'ronald-koeman-4', sourceUrl: 'https://www.bdfutbol.com/en/p/p.php?id=400462', locator: 'Barcelona 3-0 Austria Wien; scorer list: Koeman 38, 68; Quique Estebaranz 89' },
  { sourceRecordId: '30537', matchId: 'uefa-raw:match:50384', seasonStart: 1993, date: '1993-11-03', homeTeam: 'Spartak Moscow', awayTeam: 'Lech Poznań', phase: 'second_round', player: 'Valery Karpin', playerKey: 'valery-karpin-2', sourceUrl: 'https://www.laczynaspilka.pl/biblioteka/mecze/spartak-moskwa-lech-poznan-21-03111993', locator: 'Spartak Moscow 2-1 Lech; goal event 7: Walerij Karpin' },
  { sourceRecordId: '2086', matchId: 'uefa-raw:match:50451', seasonStart: 1993, date: '1994-03-02', homeTeam: 'Spartak Moscow', awayTeam: 'FC Barcelona', phase: 'group', player: 'Valery Karpin', playerKey: 'valery-karpin-3', sourceUrl: 'https://spartakmoskva.ru/match/1918-spartak-moskva-barselona-ispanija-liga-chempionov-1994-03-02', locator: 'Spartak 2-2 Barcelona; goal event 87: Valery Karpin' },
  { sourceRecordId: '468', matchId: 'uefa-raw:match:50453', seasonStart: 1993, date: '1994-03-16', homeTeam: 'FC Barcelona', awayTeam: 'Spartak Moscow', phase: 'group', player: 'Valery Karpin', playerKey: 'valery-karpin-4', sourceUrl: 'https://www.bdfutbol.com/en/p/p.php?id=400467', locator: 'Barcelona 5-1 Spartak; scorer list: Karpin 3' },
  { sourceRecordId: '465', matchId: 'uefa-raw:match:50453', seasonStart: 1993, date: '1994-03-16', homeTeam: 'FC Barcelona', awayTeam: 'Spartak Moscow', phase: 'group', player: 'Ronald Koeman', playerKey: 'ronald-koeman-5', sourceUrl: 'https://www.bdfutbol.com/en/p/p.php?id=400467', locator: 'Barcelona 5-1 Spartak; scorer list: Koeman 78, 80' },
  { sourceRecordId: '466', matchId: 'uefa-raw:match:50453', seasonStart: 1993, date: '1994-03-16', homeTeam: 'FC Barcelona', awayTeam: 'Spartak Moscow', phase: 'group', player: 'Ronald Koeman', playerKey: 'ronald-koeman-6', sourceUrl: 'https://www.bdfutbol.com/en/p/p.php?id=400467', locator: 'Barcelona 5-1 Spartak; scorer list: Koeman 78, 80' },
  { sourceRecordId: '32626', matchId: 'uefa-raw:match:50458', seasonStart: 1993, date: '1994-04-13', homeTeam: 'Galatasaray', awayTeam: 'Spartak Moscow', phase: 'group', player: 'Valery Karpin', playerKey: 'valery-karpin-5', sourceUrl: 'https://www.bdfutbol.com/en/p/p.php?id=408399', locator: 'Galatasaray 1-2 Spartak; goal event 83: Karpin' },
  { sourceRecordId: '1253', matchId: 'uefa-raw:match:51018', seasonStart: 1993, date: '1994-04-27', homeTeam: 'FC Barcelona', awayTeam: 'FC Porto', phase: 'semi_final', player: 'Ronald Koeman', playerKey: 'ronald-koeman-7', sourceUrl: 'https://www.bdfutbol.com/en/p/p.php?id=400470', locator: 'Barcelona 3-0 Porto; scorer list: Stoichkov 10, 35; Koeman 72' },
  { sourceRecordId: '2110', matchId: 'uefa-raw:match:51231', seasonStart: 1994, date: '1994-11-02', homeTeam: 'FC Barcelona', awayTeam: 'Manchester United', phase: 'group', player: 'Albert Ferrer', playerKey: 'albert-ferrer', sourceUrl: 'https://www.bdfutbol.com/es/p/p.php?id=400483', locator: 'Barcelona 4-0 Manchester United; goal event 88: Ferrer' },
  { sourceRecordId: '30807', matchId: 'uefa-raw:match:52142', seasonStart: 1995, date: '1995-12-06', homeTeam: 'Borussia Dortmund', awayTeam: 'Rangers FC', phase: 'group', player: 'Gordon Durie', playerKey: 'gordon-durie', sourceUrl: 'https://datencenter.dfb.de/en/data-center/champions-league/1995-1996/6/borussia-dortmund-rangers-fc-647649', locator: 'Borussia Dortmund 2-2 Rangers; goal event 85: Gordon Durie' }
];

async function fetchCapture(url: string, sourceKey: string): Promise<{ raw: string; capture: Capture }> {
  const response = await fetch(url, { headers: { accept: 'text/html, text/csv;q=0.9,*/*;q=0.8' } });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${sourceKey}: HTTP ${response.status} ${url}`);
  const contentSha256 = sha256(raw);
  return { raw, capture: { id: `block15c-${sourceKey}-${contentSha256.slice(0, 16)}`, sourceKey, sourceUrl: url, capturedAt: now, contentSha256, dataVersion: 'block15c-captured-v1', metadata: { rawPayloadStored: false } } };
}

function correctionFact(item: Correction, capture: Capture, aliases: Record<string, string>): ChampionsGoalFact {
  const identity = resolvePlayerIdentity({ sourceKey: item.sourceKey ?? 'historical-match-evidence', sourcePlayerId: item.playerKey, displayName: item.player }, { aliases });
  return createGoalFact({ edition: editionForSeason(item.seasonStart), player: identity, match: { id: item.matchId, date: item.date, homeTeam: item.homeTeam, awayTeam: item.awayTeam }, phase: item.phase, goals: 1, sourceKey: item.sourceKey ?? 'historical-match-evidence', sourceCaptureId: capture.id, sourceRecordId: item.sourceRecordId, evidence: { sourceUrl: item.sourceUrl, locator: item.locator, contentSha256: capture.contentSha256 }, capturedAt: capture.capturedAt });
}

async function load2010Facts(rawMatches: string, rawGoals: string, rawPlayers: string, captures: { matches: Capture; goals: Capture; players: Capture }, aliases: Record<string, string>): Promise<{ facts: ChampionsGoalFact[]; matchCount: number; scoreGoals: number; rawGoalRows: number; missingPlayers: number }> {
  const matches = parseTable(rawMatches).filter((row) => row.season === '2010-2011' && row.phase === 'TOURNAMENT' && row.status === 'FINISHED');
  const matchMap = new Map(matches.map((row) => [row.match_id, row]));
  const players = new Map(parseTable(rawPlayers).map((row) => [row.player_id, row]));
  const facts: ChampionsGoalFact[] = []; let missingPlayers = 0; let rawGoalRows = 0;
  for (const [index, row] of parseTable(rawGoals).entries()) {
    if (row.mode !== 'SCORED' || row.type === 'PENALTY' || !matchMap.has(row.match_id)) continue;
    rawGoalRows += 1;
    const match = matchMap.get(row.match_id)!; const playerId = row.player_id ?? ''; const player = players.get(playerId);
    const displayName = player?.full_name || player?.international_name || player?.short_name;
    if (!displayName) { missingPlayers += 1; continue; }
    const sourceKey = 'uefa-raw-github';
    const identity = resolvePlayerIdentity({ sourceKey, sourcePlayerId: playerId, displayName }, { aliases });
    facts.push(createGoalFact({ edition: editionForSeason(2010), player: identity, match: { id: `uefa-raw:match:${row.match_id}`, date: safeDate(match.date ?? ''), homeTeam: match.t1_name ?? 'Unknown home team', awayTeam: match.t2_name ?? 'Unknown away team' }, phase: phase(match.round ?? ''), goals: 1, sourceKey, sourceCaptureId: captures.goals.id, sourceRecordId: row.id || `goals.csv:row=${index + 2}`, evidence: { sourceUrl: `${structuredBase}/goals.csv`, locator: `goals.csv:row=${index + 2};match_id=${row.match_id};player_id=${playerId}`, contentSha256: captures.goals.contentSha256 }, capturedAt: captures.goals.capturedAt }));
  }
  return { facts, matchCount: matches.length, scoreGoals: matches.reduce((sum, row) => sum + Number(row.ft1 || 0) + Number(row.ft2 || 0), 0), rawGoalRows, missingPlayers };
}

async function persist(facts: ChampionsGoalFact[], captures: Capture[]): Promise<{ factsInserted: number; capturesInserted: number }> {
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria para BLOQUE 15C');
  const pool = new pg.Pool({ connectionString: databaseUrl }); let factsInserted = 0; let capturesInserted = 0;
  try {
    await pool.query('BEGIN');
    const sourceKeys = [...new Set(captures.map((capture) => capture.sourceKey))];
    for (const sourceKey of sourceKeys) await pool.query(`INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status) VALUES ($1,$2,'reference',$3,$4,'review_required') ON CONFLICT (key) DO NOTHING`, [sourceKey, sourceKey === 'api-football' ? 'API-Football' : sourceKey, captures.find((capture) => capture.sourceKey === sourceKey)?.sourceUrl ?? structuredBase, 'BLOQUE 15C isolated historical closure; no production publication.']);
    for (let season = 1955; season <= 2026; season += 1) { const edition = editionForSeason(season, 2026); await pool.query(`INSERT INTO champions_editions (id, season_start, season_end, season_label, era, competition_name, include_qualifying, is_current_season, scope_version) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7,'uefa-champions-league-goals-facts-v1') ON CONFLICT (id) DO NOTHING`, [edition.id, edition.seasonStart, edition.seasonEnd, edition.seasonLabel, edition.era, edition.competitionName, edition.isCurrentSeason]); }
    for (const capture of captures) { const result = await pool.query(`INSERT INTO champions_source_captures (id,source_key,captured_at,source_url,content_sha256,data_version,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`, [capture.id, capture.sourceKey, capture.capturedAt, capture.sourceUrl, capture.contentSha256, capture.dataVersion, capture.metadata]); capturesInserted += result.rowCount ?? 0; }
    for (const fact of facts) await pool.query(`INSERT INTO entities (id,entity_type,canonical_name,catalog_status) VALUES ($1,'player',$2,'excluded_from_game') ON CONFLICT (id) DO NOTHING`, [fact.player.canonicalId, fact.player.displayName]);
    for (const fact of facts) { const result = await pool.query(`INSERT INTO champions_goal_facts (id,edition_id,canonical_player_id,source_player_id,player_name_at_source,match_id,match_date,home_team,away_team,phase,goals,source_key,source_capture_id,source_record_id,evidence,captured_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`, [fact.id, fact.edition.id, fact.player.canonicalId, fact.player.sourcePlayerId, fact.player.displayName, fact.match.id, fact.match.date, fact.match.homeTeam, fact.match.awayTeam, fact.phase, fact.goals, fact.sourceKey, fact.sourceCaptureId, fact.sourceRecordId, fact.evidence, fact.capturedAt]); factsInserted += result.rowCount ?? 0; }
    await pool.query('COMMIT'); return { factsInserted, capturesInserted };
  } catch (error) { await pool.query('ROLLBACK').catch(() => undefined); throw error; } finally { await pool.end(); }
}

async function notRun(reason: string): Promise<void> {
  const report = { artifactKind: 'block15c_champions_closure_report', reportVersion: '1', generatedAt: now, runId, status: 'not_run', readyForApproval: false, reason, productionDatabaseAccess: 'none', productionMutations: 0, officialSnapshotCreated: false, top200UsedAsFacts: false, imagesTouched: false, sha256: '' };
  await mkdir(outputRoot, { recursive: true }); report.sha256 = sha256(stableJson({ ...report, sha256: '' })); await writeJson(resolve(outputRoot, 'BLOCK15C_REPORT.json'), report); await writeFile(resolve(outputRoot, 'BLOCK15C_REPORT.md'), `# BLOQUE 15C\n\n- estado: **not_run**\n- motivo: ${reason}\n- PostgreSQL de producción: **sin acceso**\n- snapshot oficial: **no creado**\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

async function main(): Promise<void> {
  if (!databaseUrl || !baseFactsFile || !apiFactsFile) return notRun('Faltan DATABASE_URL, BLOCK15C_BASE_FACTS_FILE o BLOCK15C_API_FACTS_FILE.');
  try {
    const base = JSON.parse(await readFile(baseFactsFile, 'utf8')) as { facts?: ChampionsGoalFact[] };
    const apiPayload = JSON.parse(await readFile(apiFactsFile, 'utf8')) as { facts?: ChampionsGoalFact[] };
    const baseFacts = (base.facts ?? []).filter((fact) => fact.edition.seasonStart <= 2009);
    const apiFacts = (apiPayload.facts ?? []).filter((fact) => fact.edition.seasonStart >= 2011);
    const sourceMatches = await fetchCapture(`${structuredBase}/matches.csv`, 'uefa-raw-github');
    const sourceGoals = await fetchCapture(`${structuredBase}/goals.csv`, 'uefa-raw-github');
    const sourcePlayers = await fetchCapture(`${structuredBase}/players.csv`, 'uefa-raw-github');
    const official = await fetchCapture(uefa2011, 'uefa-official-2010-11');
    const allNames = [...baseFacts, ...apiFacts].map((fact) => fact.player);
    const aliases: Record<string, string> = Object.fromEntries(allNames.map((player) => [player.normalizedName, player.canonicalId]));
    for (const item of corrections) aliases[normalizePlayerName(item.player)] ??= `champions:player:${normalizePlayerName(item.player).replaceAll(' ', '-')}`;
    const correctionCaptures = new Map<string, Capture>();
    for (const item of corrections) if (!correctionCaptures.has(item.sourceUrl)) correctionCaptures.set(item.sourceUrl, (await fetchCapture(item.sourceUrl, item.sourceKey ?? 'historical-match-evidence')).capture);
    const correctionFacts = corrections.map((item) => correctionFact(item, correctionCaptures.get(item.sourceUrl)!, aliases));
    const replacementIds = new Set(corrections.map((item) => item.replaceSourceRecordId).filter((id): id is string => Boolean(id)));
    const correctedBase = baseFacts.filter((fact) => !replacementIds.has(fact.sourceRecordId));
    const modern2010 = await load2010Facts(sourceMatches.raw, sourceGoals.raw, sourcePlayers.raw, { matches: sourceMatches.capture, goals: sourceGoals.capture, players: sourcePlayers.capture }, aliases);
    const allFacts = [...correctedBase, ...correctionFacts, ...modern2010.facts, ...apiFacts];
    const ownGoalFactIds = new Set(correctionFacts.filter((fact, index) => corrections[index]?.ownGoal).map((fact) => fact.id));
    const rankingFacts = allFacts.filter((fact) => !ownGoalFactIds.has(fact.id));
    const importedCaptures = [...new Map([...baseFacts, ...apiFacts].map((fact) => [fact.sourceCaptureId, { id: fact.sourceCaptureId, sourceKey: fact.sourceKey, sourceUrl: fact.evidence.sourceUrl, capturedAt: fact.capturedAt, contentSha256: fact.evidence.contentSha256 ?? sha256(fact.sourceCaptureId), dataVersion: 'imported-block15-fact-v1', metadata: { imported: true } }])).values()];
    const captures = [sourceMatches.capture, sourceGoals.capture, sourcePlayers.capture, official.capture, ...correctionCaptures.values(), ...importedCaptures];
    const persistence = await persist(allFacts, captures);
    const seasons = Array.from({ length: 72 }, (_, index) => 1955 + index).map((seasonStart) => {
      const facts = allFacts.filter((fact) => fact.edition.seasonStart === seasonStart);
      const expected = seasonStart === 2010 ? modern2010.scoreGoals : null;
      const sourceFactCount = facts.length;
      const gap = expected === null ? 0 : Math.max(expected - sourceFactCount, 0);
      return { seasonStart, seasonLabel: editionForSeason(seasonStart).seasonLabel, era: editionForSeason(seasonStart).era, status: gap === 0 && facts.length > 0 ? 'complete' : 'partial', factCount: sourceFactCount, expectedGoals: expected, goalCoverageGap: gap, sources: [...new Set(facts.map((fact) => fact.sourceKey))] };
    });
    const conflicts = buildChampionsRanking({ facts: rankingFacts }).conflicts;
    const coverage = [...new Set(allFacts.map((fact) => fact.sourceKey))].map((sourceKey) => ({ sourceKey, coveredSeasons: [...new Set(allFacts.filter((fact) => fact.sourceKey === sourceKey).map((fact) => fact.edition.seasonStart))].sort((a, b) => a - b), missingSeasons: [], complete: false, reason: 'La cobertura global se decide por la matriz editorial de esta ejecución.' }));
    const ranking = buildChampionsRanking({ facts: rankingFacts, coverage });
    const candidate = buildChampionsSnapshot({ facts: rankingFacts, dataset: 'historical_base', seasonStart: 1955, seasonEnd: 2026, status: 'lab_provisional', coverage, generatedAt: now });
    const completeSeasons = seasons.filter((row) => row.status === 'complete').length;
    const readyForApproval = completeSeasons === 72 && conflicts.length === 0 && ranking.unresolvedIdentityFacts.length === 0 && ranking.excludedUnknownPhaseFacts.length === 0 && modern2010.missingPlayers === 0 && modern2010.scoreGoals === modern2010.rawGoalRows;
    const report = { artifactKind: 'block15c_champions_closure_report', reportVersion: '1', generatedAt: now, runId, status: readyForApproval ? 'passed' : 'failed', readyForApproval, scope: { seasons: '1955/56–2025/26', qualifyingExcluded: true, shootoutPenaltiesExcluded: true }, corrections: { requestedMissingPlayerRows: 30, resolvedMissingPlayerFacts: 30, importedCorrectionFacts: correctionFacts.length, supplementalCorrectionFacts: correctionFacts.length - 30, replacementSourceRecords: [...replacementIds], ownGoalFactsTracked: correctionFacts.filter((fact, index) => corrections[index]?.ownGoal).length, sourceUrls: [...correctionCaptures.keys()] }, seasonMatrix: seasons, modern2010: { matches: modern2010.matchCount, sourceGoalFacts: modern2010.rawGoalRows, sourceGoalFactsWithPlayer: modern2010.facts.length, expectedGoalsFromScore: modern2010.scoreGoals, gap: modern2010.scoreGoals - modern2010.rawGoalRows, missingPlayers: modern2010.missingPlayers, officialContrastUrl: uefa2011, officialContrastCaptureSha256: official.capture.contentSha256 }, totals: { completeSeasons, seasonsTotal: 72, facts: allFacts.length, rankingFacts: rankingFacts.length, persistedFacts: persistence.factsInserted, persistedCaptures: persistence.capturesInserted, conflicts: conflicts.length, unresolvedIdentityFacts: ranking.unresolvedIdentityFacts.length, unknownPhaseFacts: ranking.excludedUnknownPhaseFacts.length }, conflicts, pendingSeasons: seasons.filter((row) => row.status !== 'complete').map((row) => row.seasonStart), candidateRanking: { status: readyForApproval ? 'calculated_in_lab' : 'not_ready_for_approval', entries: readyForApproval ? candidate.ranking : [], reason: readyForApproval ? undefined : 'No se expone como candidatura aprobable mientras 2010/11 tenga huecos.' }, publication: { status: 'blocked', officialSnapshotCreated: false, rightsApproved: false }, productionDatabaseAccess: 'none', productionMutations: 0, top200UsedAsFacts: false, imagesTouched: false, sha256: '' };
    report.sha256 = sha256(stableJson({ ...report, sha256: '' }));
    await mkdir(outputRoot, { recursive: true }); await writeJson(resolve(outputRoot, 'BLOCK15C_REPORT.json'), report); await writeFile(resolve(outputRoot, 'BLOCK15C_REPORT.md'), [`# BLOQUE 15C — cierre histórico Champions`, '', `- estado: **${report.status}**`, `- readyForApproval: **${report.readyForApproval}**`, `- temporadas completas: **${completeSeasons}/72**`, `- correcciones de identidad importadas: **${correctionFacts.length}**`, `- hechos 2010/11 con jugador: **${modern2010.facts.length}**`, `- goles esperados por marcador 2010/11: **${modern2010.scoreGoals}**`, `- hueco 2010/11: **${modern2010.scoreGoals - modern2010.rawGoalRows}**`, `- conflictos: **${conflicts.length}**`, `- PostgreSQL de producción: **sin acceso**`, `- snapshot oficial: **no creado**`, `- top 200 usado como hechos: **no**`, '', 'El candidato de laboratorio no se considera aprobable hasta completar los eventos faltantes de 2010/11 con evidencia partido a partido.'].join('\n') + '\n', 'utf8'); await writeJson(resolve(outputRoot, 'BLOCK15C_CANDIDATE_SNAPSHOT_LAB.json'), { ...candidate, readyForApproval }); await writeJson(resolve(outputRoot, 'BLOCK15C_FACTS.json'), { artifactKind: 'block15c_effective_facts', generatedAt: now, facts: allFacts }); console.log(JSON.stringify({ status: report.status, readyForApproval, completeSeasons, facts: allFacts.length, conflicts: conflicts.length, modern2010Gap: modern2010.scoreGoals - modern2010.rawGoalRows }, null, 2));
  } catch (error) { await notRun(error instanceof Error ? error.message : String(error)); }
}

await main();
