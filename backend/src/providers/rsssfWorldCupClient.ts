import { createHash } from 'node:crypto';
import type { RankingInput } from '../imports/rankingInput.js';

const sourceUrl = 'https://www.rsssf.org/tables/30all-scor.html';

export type RsssfWorldCupGoalEntry = {
  sourceRank: number;
  name: string;
  country: string;
  goals: number;
  tournaments: string;
  externalId: string;
};

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match: string, entity: string) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

const knownDisplayNames: Record<string, string> = {
  'RONALDO Luis Nazário de Lima': 'Ronaldo',
  'Gerhard MÜLLER': 'Gerd Müller',
  'Harry Edward KANE': 'Harry Kane',
  'PELÉ - Edson Arantes do Nascimento': 'Pelé',
  'Cristiano RONALDO dos Santos Aveiro': 'Cristiano Ronaldo',
  'Sándor KOCSIS Péter': 'Sándor Kocsis',
  'Gabriel Omar BATISTUTA': 'Gabriel Batistuta',
  'Gary Winston LINEKER': 'Gary Lineker',
  'Grzegorz Boleslaw LATO': 'Grzegorz Lato',
  'EUSEBIO da Silva Ferreira': 'Eusébio',
  'Jairzinho - Jair Ventura Filho': 'Jairzinho',
  'Karl Heinz RUMMENIGGE': 'Karl-Heinz Rummenigge',
  'RIVALDO Victor Borba Ferreira': 'Rivaldo',
  'Rivaldo Victor Borba Ferreira': 'Rivaldo',
  'Romelu Menama LUKAKU': 'Romelu Lukaku',
  'Rudolf VÖLLER': 'Rudi Völler',
  'Just FONTAINE': 'Just Fontaine',
  'Teófilo CUBILLAS Arizaga': 'Teófilo Cubillas',
  'NEYMAR da Silva Santos Júnior': 'Neymar',
  'David VILLA': 'David Villa',
  'VAVÁ - Edvaldo Izidio Neto': 'Vavá',
  'Christian VIERI': 'Christian Vieri',
  'Paolo ROSSI': 'Paolo Rossi',
  'JAIRZINHO - Jair Ventura Filho': 'Jairzinho',
  'Roberto BAGGIO': 'Roberto Baggio',
  'ADEMIR Marques de Menezes': 'Ademir',
  'LEÔNIDAS da Silva': 'Leônidas',
  'Guillermo STÁBILE': 'Guillermo Stábile',
  'Oscar Omar MÍGUEZ': 'Óscar Míguez',
  'Diego Armando MARADONA': 'Diego Maradona',
  'CARECA - Antônio de Oliveira Filho': 'Careca',
  'Lajos TICHY': 'Lajos Tichy',
  'Andrzej SZARMACH': 'Andrzej Szarmach',
  'Careca - Antônio de Oliveira Filho': 'Careca',
  'Erling HAALAND': 'Erling Haaland',
  'Hans SCHÄFER': 'Hans Schäfer',
  'Ivan PERIŠIĆ': 'Ivan Perišić',
  'Johannes Nicolaus REP': 'Johnny Rep',
  'Luis Alberto SUÁREZ': 'Luis Suárez',
  'Oldrich NEJEDLÝ': 'Oldřich Nejedlý',
  'Arjen ROBBEN': 'Arjen Robben',
  'Asamoah GYAN': 'Asamoah Gyan',
  'Bebeto - José Roberto Gama de Oliveira': 'Bebeto',
  'Christo STOICHKOV': 'Hristo Stoichkov',
  'Cody GAKPO': 'Cody Gakpo',
  'Davor ŠUKER': 'Davor Šuker',
  'Dennis BERGKAMP': 'Dennis Bergkamp',
  'Diego Martín FORLÁN Corazo': 'Diego Forlán',
  'Enner VALENCIA': 'Enner Valencia',
  'Lothar Herbert MATTHÄUS': 'Lothar Matthäus',
  'Mario Alberto KEMPES': 'Mario Kempes',
  'Oleg SALENKO': 'Oleg Salenko',
  'Roberto RIVELINO': 'Rivelino',
  'Robert Pieter RENSENBRINK': 'Rob Rensenbrink',
  'Robin VAN PERSIE': 'Robin van Persie',
  'Salvatore SCHILLACI': 'Salvatore Schillaci',
  'Thierry HENRY': 'Thierry Henry',
  'Wesley SNEIJDER': 'Wesley Sneijder',
  'Zbigniew Kazimierz BONIEK': 'Zbigniew Boniek',
  'Emilio BUTRAGUENO Santos': 'Emilio Butragueño',
  'Fernando RUIZ Hierro': 'Fernando Hierro',
  'Franz BECKENBAUER': 'Franz Beckenbauer',
  'Garrincha - Manuel Francisco dos Santos': 'Garrincha',
  'Geoffrey Charles HURST': 'Geoff Hurst',
  'Gyula ZSENGELLÉR': 'Gyula Zsengellér',
  'Johannes Jacobus NEESKENS': 'Johan Neeskens',
  'Johann KRANKL': 'Hans Krankl',
  'Jon Dahl TOMASSON': 'Jon Dahl Tomasson',
  'Juan Alberto SCHIAFFINO': 'Juan Schiaffino',
  'Lukas PODOLSKI': 'Lukas Podolski',
  'Marc Robert WILMOTS': 'Marc Wilmots',
  'Raúl González Blanco': 'Raúl',
  'Romario da Sousa Faria Filho': 'Romário',
  'Valentin Kozmich IVANOV': 'Valentin Ivanov',
  'Zico - Arthur Antunes Coimbra': 'Zico'
};

function displayName(value: string): string {
  return value.split(/(\s+|-)/).map((part) => {
    if (!part.trim() || part === '-') return part;
    if (/^[A-ZÀ-ÖØ-Þ0-9]+$/u.test(part)) {
      const lower = part.toLocaleLowerCase('es-ES');
      return lower.charAt(0).toLocaleUpperCase('es-ES') + lower.slice(1);
    }
    return part;
  }).join('').replace(/\s+/g, ' ').trim();
}

function extractScorersBlock(html: string): string {
  const preStart = html.search(/<pre[^>]*>/i);
  if (preStart < 0) throw new Error('RSSSF World Cup: bloque de goleadores incompleto');
  const contentStart = html.indexOf('>', preStart) + 1;
  const preEnd = html.search(/<\/pre>/i);
  if (contentStart <= 0 || preEnd < contentStart) throw new Error('RSSSF World Cup: bloque de goleadores incompleto');
  return html.slice(contentStart, preEnd);
}

export function parseRsssfWorldCupGoals(html: string): RsssfWorldCupGoalEntry[] {
  const block = extractScorersBlock(html);
  const rows: RsssfWorldCupGoalEntry[] = [];
  const normalizedBlock = decodeHtml(block);
  // The source is fixed-width text, but a few records are concatenated on
  // one physical line. Matching the complete country/goals/years suffix
  // keeps those records separate and also handles wrapped names.
  const rowPattern = /(.+?)\s*\(([^()]+)\)\s+(\d+)\s+(\d{4}(?:-\d{4})?)(?=\s|$)/gu;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(normalizedBlock)) !== null) {
    const rawName = match[1]?.trim() ?? '';
    const country = match[2]?.trim() ?? '';
    const goals = Number(match[3]);
    const tournaments = match[4] ?? '';
    if (!rawName || !country || !Number.isInteger(goals) || goals < 1 || !/^\d{4}(?:-\d{4})?$/u.test(tournaments)) continue;
    const externalId = `${rawName}|${country}`;
    rows.push({ sourceRank: rows.length + 1, name: knownDisplayNames[rawName] ?? displayName(rawName), country, goals, tournaments, externalId });
  }

  const topTwoHundred = rows.slice(0, 200);
  if (topTwoHundred.some((row, index) => index > 0 && row.goals > topTwoHundred[index - 1]!.goals)) {
    throw new Error('RSSSF World Cup: tabla fuera de orden descendente');
  }
  return topTwoHundred;
}

export async function fetchRsssfWorldCupGoals(): Promise<RankingInput> {
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Rango90-data-import/0.1' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`RSSSF World Cup ${response.status}`);
  const html = new TextDecoder('utf-16le').decode(await response.arrayBuffer());
  const rows = parseRsssfWorldCupGoals(html);
  if (rows.length < 200) throw new Error(`RSSSF World Cup: cobertura insuficiente (${rows.length} filas parseables)`);
  return {
    categorySlug: 'world-cup-goals',
    source: { key: 'rsssf-world-cup-records', name: 'RSSSF World Cup final-tournament top scorers', sourceType: 'reference', baseUrl: sourceUrl, rightsStatus: 'review_required' },
    dataVersion: `rsssf-world-cup-goals-top-200-${new Date().toISOString().slice(0, 10)}`,
    coverageComplete: true,
    reviewed: false,
    entries: rows.map((row) => ({
      entityId: `rsssf:world-cup:player:${createHash('sha256').update(row.externalId).digest('hex').slice(0, 24)}`,
      entityType: 'player' as const,
      name: row.name,
      rawValue: row.goals,
      evidence: {
        sourceRank: row.sourceRank,
        externalId: row.externalId,
        country: row.country,
        tournamentSpan: row.tournaments,
        sourceUrl,
        scope: 'FIFA World Cup masculino; fases finales de 1930 a 2026; top 200 de goleadores publicado por RSSSF; no incluye eliminatorias'
      }
    }))
  };
}
