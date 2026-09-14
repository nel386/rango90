import assert from 'node:assert/strict';
import { buildRanking, selectTopRankPositions } from '../ranking.js';
import { parseUefaPlayerRankingPage, parseUefaWinnersPage, uefaCategorySlugForMetric } from '../providers/uefaChampionsLeagueClient.js';
import { parseBallonDorWinners } from '../providers/franceFootballClient.js';
import { parseRsssfInternationalGoals } from '../providers/rsssfInternationalClient.js';
import { parseRsssfCleanSheets } from '../providers/rsssfCleanSheetsClient.js';
import { fetchIffhsGoalkeeperRanking } from '../providers/iffhsGoalkeeperClient.js';
import { parseRsssfSerieAGoals } from '../providers/rsssfSerieAClient.js';
import { parseRsssfWorldCupGoals } from '../providers/rsssfWorldCupClient.js';
import { parseStatbunkerWorldCupAssists, parseStatbunkerWorldCupCountryIds } from '../providers/statbunkerWorldCupClient.js';
import { parseStatbunkerWorldCupCards } from '../providers/statbunkerWorldCupCardsClient.js';
import { parseStatbunkerCleanSheets, parseStatbunkerCompetitionOptions } from '../providers/statbunkerCleanSheetsClient.js';
import { parseStatbunkerUefaEuropaRows, parseStatbunkerUefaEuropaClubIds, parseStatbunkerConferenceAssistsClubPage, parseStatbunkerConferenceClubIds, parseStatbunkerConferenceGoals, parseStatbunkerConferenceYellowCards } from '../providers/statbunkerUefaEuropaLeagueClient.js';
import { parseDfbBundesligaGoals } from '../providers/dfbBundesligaClient.js';
import { parseBdfutbolLaLigaGoals } from '../providers/bdfutbolLaLigaClient.js';
import { parseBdfutbolLaLigaRanking } from '../providers/bdfutbolLaLigaRankingsClient.js';
import { parsePremierLeagueClubTitles } from '../providers/premierLeagueTitlesClient.js';
import { selectPremierLeagueGoalsTop200 } from '../providers/premierLeagueClient.js';
import { parseBundesligaChampionSeasons } from '../providers/bundesligaTitlesClient.js';
import { parseDflSupercupTitles } from '../providers/dflSupercupTitlesClient.js';
import { parseFaCupFinals } from '../providers/faCupTitlesClient.js';
import { parseDfbPokalWinners } from '../providers/dfbPokalTitlesClient.js';
import { parseSerieAClubTitles } from '../providers/serieAClubTitlesClient.js';
import { parseSupercoppaItalianaTitles } from '../providers/supercoppaItalianaTitlesClient.js';
import { parseWikipediaCopaDelReyClubTitles } from '../providers/wikipediaCopaDelReyClient.js';
import { parseWikipediaCopaLibertadoresClubTitles } from '../providers/wikipediaCopaLibertadoresClient.js';
import { parseBeSoccerCopaLibertadoresGoalsPage, parseBeSoccerCopaLibertadoresGoalsResponse } from '../providers/besoccerCopaLibertadoresClient.js';
import { parseTransfermarktCopaLibertadoresGoalsPage } from '../providers/transfermarktCopaLibertadoresClient.js';
import { parseWikipediaCopaSudamericanaClubTitles } from '../providers/wikipediaCopaSudamericanaClient.js';
import { parseWikipediaRecopaSudamericanaClubTitles } from '../providers/wikipediaRecopaSudamericanaClient.js';
import { parseLaLigaClubTitles } from '../providers/laLigaTitlesClient.js';
import { parseCoppaItaliaClubTitles } from '../providers/coppaItaliaTitlesClient.js';
import { copaAmericaTitleRows } from '../providers/copaAmericaTitlesClient.js';
import { aliasesForTheSportsDbPortrait, selectExactTheSportsDbTeam } from '../providers/theSportsDbClient.js';
import { assertRightsApproval } from '../mediaRights.js';

const ranking = buildRanking([
  { entityId: 'a', rawValue: 20 },
  { entityId: 'b', rawValue: 10 },
  { entityId: 'c', rawValue: 10 },
  { entityId: 'd', rawValue: 1 }
], { direction: 'desc', scoreCap: 100 });

assert.deepEqual(ranking.map((entry) => [entry.entityId, entry.rank, entry.scoreValue]), [
  ['a', 1, 1],
  ['b', 2, 2],
  ['c', 2, 2],
  ['d', 4, 4]
]);

const capped = buildRanking(Array.from({ length: 105 }, (_, index) => ({ entityId: `e-${index}`, rawValue: 105 - index })), { direction: 'desc', scoreCap: 100 });
assert.equal(capped[100]?.rank, 101);
assert.equal(capped[100]?.scoreValue, 100);
assert.equal(selectTopRankPositions(capped).length, 100);

assert.deepEqual(aliasesForTheSportsDbPortrait('Cabral'), ['Arthur Cabral']);
assert.deepEqual(aliasesForTheSportsDbPortrait('Orban'), ['Gift Orban']);
assert.deepEqual(aliasesForTheSportsDbPortrait('A. Thaqi'), ['Armend Thaqi']);
assert.deepEqual(aliasesForTheSportsDbPortrait('P. Dárdai'), ['Palkó Dárdai']);
assert.deepEqual(aliasesForTheSportsDbPortrait('Chakvetadze'), ['Giorgi Chakvetadze']);
assert.deepEqual(aliasesForTheSportsDbPortrait('V. Einarsson'), ['Viktor Karl Einarsson']);
assert.deepEqual(aliasesForTheSportsDbPortrait('Bislimi'), ['Uran Bislimi']);
assert.deepEqual(aliasesForTheSportsDbPortrait('unknown-player'), []);

assert.throws(() => buildRanking([{ entityId: 'a', rawValue: 1 }, { entityId: 'a', rawValue: 2 }], { direction: 'desc', scoreCap: 100 }));
assert.throws(() => buildRanking([{ entityId: 'a', rawValue: -1 }], { direction: 'desc', scoreCap: 100 }));

const premierLeagueGoalsRows = Array.from({ length: 205 }, (_, index) => ({
  owner: { id: index + 1 },
  value: index < 200 ? 200 - index : 0,
  rank: index < 200 ? index + 1 : 201
}));
const premierLeagueGoalsTop200 = selectPremierLeagueGoalsTop200(premierLeagueGoalsRows, premierLeagueGoalsRows.length);
assert.equal(premierLeagueGoalsTop200.length, 200);
assert.equal(premierLeagueGoalsTop200.at(-1)?.value, 1);
assert.equal(premierLeagueGoalsTop200.some((row) => row.value === 0), false);
assert.equal(premierLeagueGoalsTop200.at(-1)?.owner?.id, 200);
assert.throws(() => selectPremierLeagueGoalsTop200(premierLeagueGoalsRows.slice(0, 199), 199));

const uefaFixture = Array.from({ length: 10 }, (_, index) => `<pk-list-item class="stats-data-item">
  <span slot="prefix-card">${index === 1 ? 9 : index + 1}</span>
  <pk-avatar src="https://img.uefa.com/imgml/TP/players/1/history/${index + 1}.jpg"></pk-avatar>
  <span slot="secondary">${index === 0 ? 'Real Madrid' : 'Club ' + (index + 1)}</span>
  <span slot="primary">${index === 0 ? 'Ra&#xFA;l Gonz&#xE1;lez' : `Jugador ${index + 1}`}</span>
  <div class="pk-font-size--l" slot="suffix-card">${index === 0 ? 71 : 70 - index}</div>
</pk-list-item>`).join('\n');
const parsedUefa = parseUefaPlayerRankingPage(uefaFixture, 'https://www.uefa.com/test/');
assert.equal(parsedUefa.length, 10);
assert.deepEqual(parsedUefa[0], {
  rank: 1,
  name: 'Raúl González',
  teamName: 'Real Madrid',
  value: 71,
  imageUrl: 'https://img.uefa.com/imgml/TP/players/1/history/1.jpg',
  externalId: '/imgml/TP/players/1/history/1.jpg',
  sourceUrl: 'https://www.uefa.com/test/'
});
assert.equal(parsedUefa[1]?.rank, 9);
assert.equal(uefaCategorySlugForMetric('goals'), 'uefa-champions-league-goals');
assert.equal(uefaCategorySlugForMetric('assists'), 'uefa-champions-league-assists');
assert.equal(uefaCategorySlugForMetric('red_cards'), 'uefa-champions-league-red-cards');
assert.equal(uefaCategorySlugForMetric('goals', 'conference'), 'uefa-conference-league-goals');
assert.equal(uefaCategorySlugForMetric('red_cards', 'conference'), 'uefa-conference-league-red_cards');
assert.equal(uefaCategorySlugForMetric('goals', 'europa'), 'uefa-cup-europa-league-goals');
assert.equal(uefaCategorySlugForMetric('red_cards', 'euro'), 'euro-red_cards');

const laLigaPalmaresFixture = '<main>Títulos Real Madrid 36 FC Barcelona 27 Atlético de Madrid 11 Athletic Club 8 Valencia 6 Real Sociedad 2 RC Deportivo 1 Sevilla 1 Betis 1</main><footer>¿AÚN NO TE HAS REGISTRADO?</footer>';
assert.deepEqual(parseLaLigaClubTitles(laLigaPalmaresFixture), [
  { name: 'Real Madrid', titles: 36 },
  { name: 'FC Barcelona', titles: 27 },
  { name: 'Atlético de Madrid', titles: 11 },
  { name: 'Athletic Club', titles: 8 },
  { name: 'Valencia', titles: 6 },
  { name: 'Betis', titles: 1 },
  { name: 'RC Deportivo', titles: 1 },
  { name: 'Sevilla', titles: 1 },
  { name: 'Real Sociedad', titles: 2 }
].sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name)));

const coppaItaliaFixture = '<main>JUVENTUS Totale vittorie: 15 Tutte le vittorie: 1937-38 INTER Totale vittorie: 10 Tutte le vittorie: 1938-39 ROMA Totale vittorie: 9 Tutte le vittorie: 1963-64 LAZIO Totale vittorie: 7 Tutte le vittorie: 1958 NAPOLI Totale vittorie: 6 Tutte le vittorie: 1961-62 FIORENTINA Totale vittorie: 6 Tutte le vittorie: 1939-40 TORINO Totale vittorie: 5 Tutte le vittorie: 1935-36 MILAN Totale vittorie: 5 Tutte le vittorie: 1966-67 SAMPDORIA Totale vittorie: 4 Tutte le vittorie: 1984-85 BOLOGNA Totale vittorie: 3 Tutte le vittorie: 1969-70 PARMA Totale vittorie: 3 Tutte le vittorie: 1991-92 ATALANTA Totale vittorie: 1 Tutte le vittorie: 1962-63 L.R. VICENZA Totale vittorie: 1 Tutte le vittorie: 1996-97 VENEZIA Totale vittorie: 1 Tutte le vittorie: 1940-41 GENOA Totale vittorie: 1 Tutte le vittorie: 1936-37 VADO Totale vittorie: 1 Tutte le vittorie: 1922</main><footer>Lega Serie A</footer>';
assert.equal(parseCoppaItaliaClubTitles(coppaItaliaFixture).length, 16);
assert.deepEqual(parseCoppaItaliaClubTitles(coppaItaliaFixture).slice(0, 3), [
  { name: 'JUVENTUS', titles: 15 },
  { name: 'INTER', titles: 10 },
  { name: 'ROMA', titles: 9 }
]);

assert.equal(selectExactTheSportsDbTeam([
  { idTeam: '1', strTeam: 'Manchester 62' },
  { idTeam: '12', strTeam: 'Manchester United' }
], 'Manchester United')?.idTeam, '12');
assert.equal(selectExactTheSportsDbTeam([{ idTeam: '131', strTeam: 'Brighton & Hove Albion' }], 'Brighton and Hove Albion', ['Brighton & Hove Albion'])?.idTeam, '131');
assert.equal(selectExactTheSportsDbTeam([{ idTeam: '141', strTeam: 'Brighton WFC' }], 'Brighton and Hove Albion', ['Brighton & Hove Albion']), null);
assert.deepEqual(aliasesForTheSportsDbPortrait('Lewandowski'), ['Robert Lewandowski']);
assert.deepEqual(aliasesForTheSportsDbPortrait('Torres'), []);

const winnersFixture = `<pk-identifier class="history-winners__team-name"><pk-badge src="https://img.uefa.com/imgml/TP/teams/logos/70x70/1.png"></pk-badge><span slot="primary">Real Madrid</span></pk-identifier><span class="history-winners__team-stat">15</span>
<pk-identifier class="history-winners__team-name"><pk-badge src="https://img.uefa.com/imgml/TP/teams/logos/70x70/2.png"></pk-badge><span slot="primary">Milan</span></pk-identifier><span class="history-winners__team-stat">7</span>`;
assert.deepEqual(parseUefaWinnersPage(winnersFixture).map((row) => [row.name, row.titles]), [['Real Madrid', 15], ['Milan', 7]]);

const libertadoresFixture = `== Palmarés ==
{| class="sortable"
|-
| {{bandera|ARG}} '''[[Club Atlético Independiente|Independiente]]'''
| align=center | '''7'''
|-
| {{bandera|ARG}} '''[[Boca Juniors]]'''
| align=center | '''6'''
|}`;
assert.deepEqual(parseWikipediaCopaLibertadoresClubTitles(libertadoresFixture).map((row) => [row.name, row.titles]), [['Independiente', 7], ['Boca Juniors', 6]]);

const besoccerRankingFixture = `<tr class="row-body"><td><img loading="lazy" class="align-middle player-img" src="https://cdn.resfu.com/img_data/players/medium/1.jpg?size=120x" /></td><td class="ta-l"><a href="https://www.besoccer.com/player/uno-1" data-cy="player"><p class="player-name pb3"><b>Jugador Uno</b></p></a></td><td><b>54</b></td></tr>
<tr class="row-body"><td><img loading="lazy" class="align-middle player-img" src="https://cdn.resfu.com/img_data/players/medium/2.jpg?size=120x" /></td><td class="ta-l"><a href="https://www.besoccer.com/player/dos-2" data-cy="player"><p class="player-name pb3"><b>Jugador Dos</b></p></a></td><td><b>37</b></td></tr>`;
assert.deepEqual(parseBeSoccerCopaLibertadoresGoalsPage(besoccerRankingFixture).map((row) => [row.sourceRank, row.name, row.goals]), [[1, 'Jugador Uno', 54], [2, 'Jugador Dos', 37]]);
assert.deepEqual(parseBeSoccerCopaLibertadoresGoalsResponse(JSON.stringify({ html: besoccerRankingFixture })).map((row) => [row.sourceRank, row.externalId]), [[1, 'https://www.besoccer.com/player/uno-1'], [2, 'https://www.besoccer.com/player/dos-2']]);

const transfermarktRankingFixture = `<tr class="odd"><td class="zentriert ">1</td><td><table><tbody><tr><td><img src="https://img.a.transfermarkt.technology/portrait/small/1.jpg?lm=1"></td><td class="hauptlink"><a title="Alberto Spencer" href="https://www.transfermarkt.com/alberto-spencer/profil/spieler/1">Alberto Spencer</a></td></tr></tbody></table></td><td class="zentriert">88</td><td class="zentriert hauptlink">54</td></tr>
<tr class="even"><td class="zentriert ">2</td><td><table><tbody><tr><td><img src="https://img.a.transfermarkt.technology/portrait/small/2.jpg?lm=1"></td><td class="hauptlink"><a title="Fernando Morena" href="https://www.transfermarkt.com/fernando-morena/profil/spieler/2">Fernando Morena</a></td></tr></tbody></table></td><td class="zentriert">77</td><td class="zentriert hauptlink">37</td></tr>`;
assert.deepEqual(parseTransfermarktCopaLibertadoresGoalsPage(transfermarktRankingFixture).map((row) => [row.sourceRank, row.name, row.goals]), [[1, 'Alberto Spencer', 54], [2, 'Fernando Morena', 37]]);

const sudamericanaFixture = `== Palmarés ==
=== Títulos por equipo ===
{| class="sortable"
|-
| '''{{bandera|Ecuador}} [[Liga Deportiva Universitaria de Quito|Liga de Quito]]'''
| align="center" | '''2'''
|-
| '''{{bandera|Argentina}} [[Club Atlético Lanús|Lanús]]'''
| align="center" | '''2'''
|-
| '''{{bandera|Argentina}} [[Club Atlético Independiente|Independiente]]'''
| align="center" | '''2'''
|}`;
assert.deepEqual(parseWikipediaCopaSudamericanaClubTitles(sudamericanaFixture).map((row) => [row.name, row.titles]), [['Liga de Quito', 2], ['Lanús', 2], ['Independiente', 2]]);

const recopaFixture = `== Palmarés ==
=== Títulos por equipo ===
{| class="sortable"
|-
| '''{{bandera|Argentina}} [[Club Atlético Boca Juniors|Boca Juniors]]'''
| align=center | '''4'''
|-
| '''{{bandera|Argentina}} [[Club Atlético River Plate|River Plate]]'''
| align=center | '''3'''
|}`;
assert.deepEqual(parseWikipediaRecopaSudamericanaClubTitles(recopaFixture).map((row) => [row.name, row.titles]), [['Boca Juniors', 4], ['River Plate', 3]]);

const ballonFixturePlayers = Array.from({ length: 60 }, (_, index) => `{IDJOUEUR:'${index + 1}',NOM:'Jugador ${index + 1}',YEAR:'${2025 - index}',LINK:'https://www.francefootball.fr/winner/${index + 1}',URLMEDIA:'https://medias.lequipe.fr/player/${index + 1}.jpg',CODEPAYS:'ESP'}`).join(',');
const ballonFixture = `<script>window.__NUXT__=(function(){return {fetch:{'Palmares:0':{palmaresObjectItems:[{id:'male',players:[${ballonFixturePlayers}]}]}}}})()</script>`;
const parsedBallon = parseBallonDorWinners(ballonFixture);
assert.equal(parsedBallon.length, 60);
assert.deepEqual(parsedBallon.slice(0, 2).map((row) => [row.year, row.playerId, row.name]), [[2025, '1', 'Jugador 1'], [2024, '2', 'Jugador 2']]);

const rsssfFixture = `<h2><a name="goals">International Goals</a></h2><pre>${Array.from({ length: 200 }, (_, index) => `  ${index + 1}.<a href="player-${index + 1}-intlg.html">${index === 0 ? '&quot;Pel&#xE9;&quot;' : `Jugador ${index + 1}`}</a> [<a href="esp-recintlp.html"><i>Spain</i></a>] ${300 - index} (${100 + index}) (1900-2025)`).join('\n')}</pre>`;
const parsedRsssf = parseRsssfInternationalGoals(rsssfFixture);
assert.equal(parsedRsssf.length, 200);
assert.deepEqual(parsedRsssf[0], { sourceRank: 1, displayedRank: 1, name: 'Pelé', country: 'Spain', goals: 300, caps: 100, externalId: 'player-1-intlg.html' });
assert.equal(parsedRsssf[199]?.sourceRank, 200);

const cleanSheetsFixture = `<pre>NB: last updated after matches on Jul 19, 2026.\n\nFabio\t\t521*\t(3)**\t\t527\t(1434)\t\t34 (2025)\nBuffon, Gianluigi \t\t515\t(22)\t\t520\t(1179)\t\t31\nCech, Petr\t\t411\t(18)\t\t428\t(968)\t\t32\n${Array.from({ length: 17 }, (_, index) => `Keeper ${index + 4}\t\t${410 - index}\t(1)\t\t${420 - index}\t(900)\t\t30`).join('\n')}\n\nTop Level\nFabio\t\t489</pre>`;
const parsedCleanSheets = parseRsssfCleanSheets(cleanSheetsFixture);
assert.equal(parsedCleanSheets.length, 20);
assert.deepEqual(parsedCleanSheets.slice(0, 2).map((row) => [row.name, row.cleanSheetsProfessional, row.incompleteGames]), [['Fabio', 521, 3], ['Gianluigi Buffon', 515, 22]]);
assert.equal(parsedCleanSheets[0]?.gamesAll, 1434);

const serieAFixture = `<pre> 1.      <a href="../players/pioladata.html">Silvio Piola</a>              274              537
         <a href="../players/tottidata.html">Francesco Totti</a>         250              619
 3.      <a href="../players/altafinidata.html">Jos&#xE9; Altafini</a>       216              459*</pre>`;
const parsedSerieA = parseRsssfSerieAGoals(serieAFixture);
assert.deepEqual(parsedSerieA.map((row) => [row.displayedRank, row.name, row.goals, row.matches]), [
  [1, 'Silvio Piola', 274, 537],
  [null, 'Francesco Totti', 250, 619],
  [3, 'José Altafini', 216, 459]
]);

const worldCupRows = Array.from({ length: 100 }, (_, index) => `${index === 0 ? 'Kylian MBAPPÉ' : `Jugador ${index + 1}`} (France) ${100 - Math.floor(index / 5)} 2018-2026`).join('\n');
const parsedWorldCup = parseRsssfWorldCupGoals(`<pre>${worldCupRows}</pre>`);
assert.equal(parsedWorldCup.length, 100);
assert.deepEqual(parsedWorldCup[0], { sourceRank: 1, name: 'Kylian Mbappé', country: 'France', goals: 100, tournaments: '2018-2026', externalId: 'Kylian MBAPPÉ|France' });
assert.equal(parsedWorldCup[99]?.sourceRank, 100);
const concatenatedWorldCupRows = `${Array.from({ length: 98 }, (_, index) => `Jugador ${index + 1} (France) ${200 - index} 2018-2026`).join('\n')}\nRIVALDO Victor Borba Ferreira(Brazil) 1 1998-2002 Romelu Menama LUKAKU (Belgium) 1 2014-2026`;
const parsedConcatenatedWorldCup = parseRsssfWorldCupGoals(`<pre>${concatenatedWorldCupRows}</pre>`);
assert.deepEqual(parsedConcatenatedWorldCup.slice(-2).map((row) => [row.name, row.country]), [['Rivaldo', 'Brazil'], ['Romelu Lukaku', 'Belgium']]);

const statbunkerWorldCupRows = Array.from({ length: 50 }, (_, index) => `<tr><td>${50 - Math.floor(index / 5)}</td><td><a href='/players/GetHistoryStats?player_id=${1000 + index}'><p>${index === 0 ? 'Kylian Mbappe' : `Jugador ${index + 1}`}</p></a></td></tr>`).join('');
const parsedStatbunkerWorldCup = parseStatbunkerWorldCupAssists(statbunkerWorldCupRows, 50);
assert.equal(parsedStatbunkerWorldCup.length, 50);
assert.deepEqual(parsedStatbunkerWorldCup[0], { sourceRank: 1, providerPlayerId: 1000, name: 'Kylian Mbappé', assists: 50 });
assert.equal(parsedStatbunkerWorldCup[49]?.sourceRank, 50);
assert.throws(() => parseStatbunkerWorldCupAssists(statbunkerWorldCupRows), /cobertura insuficiente/iu);
const statbunkerWorldCupRootRows = Array.from({ length: 200 }, (_, index) => `<tr><td>${200 - Math.floor(index / 5)}</td><td><a href='/players/GetHistoryStats?player_id=${2000 + index}'><p>Jugador ${index + 1}</p></a></td></tr>`).join('');
const parsedStatbunkerWorldCupRoot = parseStatbunkerWorldCupAssists(statbunkerWorldCupRootRows, 200);
assert.equal(parsedStatbunkerWorldCupRoot.length, 200);
assert.equal(parsedStatbunkerWorldCupRoot[199]?.sourceRank, 200);
assert.throws(() => parseStatbunkerWorldCupAssists(statbunkerWorldCupRows, 200), /cobertura insuficiente/iu);
assert.deepEqual(parseStatbunkerWorldCupCountryIds("AllTimeLeadingScorers?comp_code=WC&club_id=404 AllTimeLeadingScorers?comp_code=WC&club_id=404 AllTimeLeadingScorers?comp_code=WC&club_id=678"), ['404', '678']);
const statbunkerCleanSheetsFixture = `<select><option value="727">2022 FIFA World Cup</option><option value="607">2018 FIFA World Cup</option><option value="999">UEFA Europa League</option></select>
<tbody><tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=10"><p>Portero Uno</p></a></td><td class="mob">Argentina</td><td class="nonMob">Argentina</td><td class="mob">3</td><td class="mob">7</td><td class="mob">42.86%</td></tr>
<tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=11"><p>Portero Dos</p></a></td><td class="mob">Brasil</td><td class="nonMob">Brasil</td><td class="mob">1</td><td class="mob">4</td><td class="mob">25.00%</td></tr></tbody>`;
assert.deepEqual(parseStatbunkerCompetitionOptions(statbunkerCleanSheetsFixture, /^(?:\d{4} )?(?:FIFA )?World Cup(?: \d{4})?$/iu), [
  { id: 727, label: '2022 FIFA World Cup' }, { id: 607, label: '2018 FIFA World Cup' }
]);
assert.deepEqual(parseStatbunkerCleanSheets(statbunkerCleanSheetsFixture, 727, '2022 FIFA World Cup').map((row) => [row.providerPlayerId, row.name, row.cleanSheets, row.appearances]), [
  [10, 'Portero Uno', 3, 7], [11, 'Portero Dos', 1, 4]
]);
const statbunkerCardsFixture = `<tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=18258"><p>Javier Mascherano</p></a></td><td class="mob">7</td></tr><tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=1965"><p>Zinedine Zidane</p></a></td><td class="mob">2</td></tr>`;
assert.deepEqual(parseStatbunkerWorldCupCards(statbunkerCardsFixture, 2).map((row) => [row.providerPlayerId, row.name, row.cards]), [[18258, 'Javier Mascherano', 7], [1965, 'Zinedine Zidane', 2]]);
const statbunkerEuropaFixture = `<a href="/alltimestats/AllTimeLeadingScorers?comp_code=UCUP&club_id=12">Club</a>
<tbody><tr><td class="mob tdInline"><a href="/players/GetHistoryStats?player_id=101"><p>Jugador Uno</p></a></td><td class="mob">7</td></tr>
<tr><td class="mob tdInline"><a href="/players/GetHistoryStats?player_id=102"><p>Jugador Dos</p></a></td><td class="mob">4</td></tr>
<tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=103"><p>Jugador Tres</p></a></td><td class="mob">2</td></tr></tbody>`;
assert.deepEqual(parseStatbunkerUefaEuropaRows(statbunkerEuropaFixture, 'goals').map((row) => [row.providerPlayerId, row.value]), [[101, 7], [102, 4], [103, 2]]);
const statbunkerEuropaAssistsFixture = `<tbody><tr><td>4</td><td><a href="/players/GetHistoryStats?player_id=102"><p>Jugador Dos</p></a></td></tr></tbody>`;
assert.deepEqual(parseStatbunkerUefaEuropaRows(statbunkerEuropaAssistsFixture, 'assists').map((row) => [row.providerPlayerId, row.value]), [[102, 4]]);
assert.deepEqual(parseStatbunkerUefaEuropaClubIds(statbunkerEuropaFixture), ['12']);
assert.deepEqual(parseStatbunkerUefaEuropaClubIds('AllTimeLeadingScorers?comp_code=EC&club_id=34', 'EC'), ['34']);
const statbunkerConferenceFixture = `<tbody><tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=201"><p>Jugador Uno</p></a></td><td>Club Uno</td><td class="mob">5</td></tr><tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=202"><p>Jugador Dos</p></a></td><td>Club Dos</td><td class="mob">2</td></tr></tbody>`;
assert.deepEqual(parseStatbunkerConferenceYellowCards(statbunkerConferenceFixture).map((row) => [row.providerPlayerId, row.value]), [[201, 5], [202, 2]]);
const statbunkerConferenceGoalsFixture = `<tbody><tr><td class="tdInline mob"><a href="/players/GetHistoryStats?player_id=301"><p>Jugador Tres</p></a></td><td>Club Tres</td><td class="mob">7</td></tr></tbody>`;
assert.deepEqual(parseStatbunkerConferenceGoals(statbunkerConferenceGoalsFixture).map((row) => [row.providerPlayerId, row.value]), [[301, 7]]);
const statbunkerConferenceAssistsFixture = `<tbody><tr><td>3</td><td><a href="/players/GetHistoryStats?player_id=401"><p>Jugador Cuatro</p></a></td><td>Jugador Cinco</td><td>1</td></tr><tr class="hide"><td><a href="/players/GetHistoryStats?player_id=402"><p>Jugador Oculto</p></a></td></tr></tbody>`;
assert.deepEqual(parseStatbunkerConferenceAssistsClubPage(statbunkerConferenceAssistsFixture).map((row) => [row.providerPlayerId, row.value]), [[401, 3]]);
assert.deepEqual(parseStatbunkerConferenceClubIds('MostAssists?comp_id=706&club_id=13 MostAssists?comp_id=706&club_id=13', 706), ['13']);

const dfbFixture = `<tr class="c-Table-body-row"><td>1.</td><td><a href="https://datencenter.dfb.de/datencenter/personen/gerd-mueller/spieler">Gerd M&#xFC;ller</a></td><td>365</td><td>51</td></tr>\n<tr class="c-Table-body-row"><td>2.</td><td><a href="https://datencenter.dfb.de/datencenter/personen/robert-lewandowski/spieler">Robert Lewandowski</a></td><td>312</td><td>40</td></tr>`;
assert.deepEqual(parseDfbBundesligaGoals(dfbFixture).map((row) => [row.displayedRank, row.name, row.goals, row.appearances]), [
  [1, 'Gerd Müller', 365, 51],
  [2, 'Robert Lewandowski', 312, 40]
]);

const bdfutbolFixture = `<table><tr class=""><td class="fit">1</td><td class="text-left"><a href="../j/j1753.html">Messi</a></td><td class="text-left"><a href="../j/j1753.html">Lionel Andr&#xE9;s Messi Cuccittini</a></td><td class="text-nowrap"><span class=""><a href='../p/j1753.html?g=1&amp;cat=1a'>474</a></span></td></tr>`;
assert.deepEqual(parseBdfutbolLaLigaGoals(bdfutbolFixture).map((row) => [row.displayedRank, row.shortName, row.fullName, row.goals, row.externalId]), [
  [1, 'Messi', 'Lionel Andrés Messi Cuccittini', 474, 'https://www.bdfutbol.com/en/j/j1753.html']
]);

const bdfutbolRankingFixture = Array.from({ length: 200 }, (_, index) => `<tr>
  <td class="fit">${index + 1}</td>
  <td class="text-left"><a href="../j/j${index + 1}.html">Jugador ${index + 1}</a></td>
  <td class="text-left"><a href="../j/j${index + 1}.html">Jugador Completo ${index + 1}</a></td>
  <td><div class="por"></div></td><td class="">01/01/1960</td>
  <td class="text-nowrap"><span><a href='../p/j${index + 1}.html?x=1'>${200 - index}</a></span></td>
</tr>`).join('');
const parsedBdfutbolRanking = parseBdfutbolLaLigaRanking(bdfutbolRankingFixture, 'clean_sheets');
assert.equal(parsedBdfutbolRanking.length, 200);
assert.deepEqual(parsedBdfutbolRanking[0], {
  sourceRank: 1,
  displayedRank: 1,
  shortName: 'Jugador 1',
  fullName: 'Jugador Completo 1',
  value: 200,
  externalId: 'https://www.bdfutbol.com/en/j/j1.html',
  dateOfBirth: '01/01/1960',
  position: 'G'
});
assert.throws(() => parseBdfutbolLaLigaRanking(bdfutbolRankingFixture.replace('<td class="fit">2</td>', '<td class="fit">3</td>'), 'clean_sheets'));

const premierLeagueTitlesFixture = `<h6>Most Premier League titles</h6><table><tbody>
<tr><th>Club</th><td>Titles</td></tr>
<tr><th>Man Utd</th><td>13</td></tr><tr><th>Man City</th><td>8</td></tr>
<tr><th>Chelsea</th><td>5</td></tr><tr><th>Arsenal</th><td>4</td></tr>
<tr><th>Liverpool</th><td>2</td></tr><tr><th>Blackburn Rovers</th><td>1</td></tr>
<tr><th>Leicester City</th><td>1</td></tr></tbody></table>`;
assert.deepEqual(parsePremierLeagueClubTitles(premierLeagueTitlesFixture).map((row) => [row.name, row.titles]), [
  ['Man Utd', 13], ['Man City', 8], ['Chelsea', 5], ['Arsenal', 4], ['Liverpool', 2], ['Blackburn Rovers', 1], ['Leicester City', 1]
]);

const bundesligaFixture = `${Array.from({ length: 61 }, (_, index) => {
  const startYear = 1963 + index;
  const endYear = startYear === 1999 ? '2000' : String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${endYear} – ${index === 60 ? 'Bayer Leverkusen' : 'Bayern Munich'}\tCoach: Test`;
}).join('\n')}`;
assert.equal(parseBundesligaChampionSeasons(bundesligaFixture).length, 61);
assert.deepEqual(parseBundesligaChampionSeasons(bundesligaFixture).slice(-2), [
  { season: '2022/23', name: 'Bayern Munich' },
  { season: '2023/24', name: 'Bayer Leverkusen' }
]);

const dflSupercupFixture = `List of Supercup winners 2 titles: Bayern Munich (1987, 1990) 1 title: Kaiserslautern (1991), VfB Stuttgart (1992) All Supercup matches since 1987`;
assert.deepEqual(parseDflSupercupTitles(dflSupercupFixture, false).map((row) => [row.name, row.titles]), [
  ['Bayern Munich', 2], ['Kaiserslautern', 1], ['VfB Stuttgart', 1]
]);

const faCupFixture = `<p><strong>2022:</strong> Chelsea 0-0 Liverpool (Liverpool win 6-5 after penalty shootout)</p>
<p><strong>1990:</strong> Manchester United 3-3 Crystal Palace (AET)<br><strong>Replay:</strong> Manchester United 1-0 Crystal Palace</p>
<p>1872: Wanderers 1-0 Royal Engineers</p>`;
assert.deepEqual(parseFaCupFinals(faCupFixture, false).map((row) => [row.name, row.titles]), [
  ['Liverpool', 1],
  ['Manchester United', 1],
  ['Wanderers', 1]
]);

const dfbPokalFixture = `<table><tbody><tr><td><strong>2025/2026</strong></td><td><strong>FC Bayern München</strong></td><td>23. Mai 2026</td></tr>
<tr><td colspan="4">FC Bayern München - VfB Stuttgart 3:0</td></tr>
<tr><td><strong>2003/2004</strong></td><td><strong>SV Werder Bremen</strong></td><td>29. Mai 2004</td></tr>
<tr><td colspan="4">Werder Bremen - Aachen 3:1</td></tr>
<tr><td><strong>1992/1993</strong></td><td><strong>Werder Bremen</strong></td><td>12. Juni 1993</td></tr></tbody></table>`;
assert.deepEqual(parseDfbPokalWinners(dfbPokalFixture, false).map((row) => [row.name, row.titles]), [
  ['Werder Bremen', 2],
  ['FC Bayern München', 1]
]);

const serieAClubTitlesFixture = `<div>Inicio</div><h3>JUVENTUS</h3><p><strong>Totale vittorie:</strong> 2<br><strong>Tutte le vittorie:</strong> 1904-05 1925-26</p><h3>BOL0GNA</h3><p><strong>Totale vittorie:</strong> 1<br><strong>Tutte le vittorie:</strong> 1963-64</p><div>Lega Serie A</div>`;
assert.deepEqual(parseSerieAClubTitles(serieAClubTitlesFixture, false).map((row) => [row.name, row.titles]), [
  ['Juventus', 2],
  ['Bologna', 1]
]);

const supercoppaItalianaFixture = `JUVENTUS Totale vittorie: 9 Tutte le vittorie: 1995-96 1997-98 2002-03 2003-04 2012-13 2013-14 2015-16 2018-19 2020-21 INTER Totale vittorie: 8 Tutte le vittorie: 1989-90 2005-06 2006-07 2008-09 2010-11 2021-22 2022-23 2023-24 MILAN Totale vittorie: 8 Tutte le vittorie: 1988-89 1992-93 1993-94 1994-95 2004-05 2011-12 2016-17 2024-25 LAZIO Totale vittorie: 5 Tutte le vittorie: 1998-99 2000-01 2009-10 2017-18 2019-20 NAPOLI Totale vittorie: 3 Tutte le vittorie: 1990-91 2014-15 2025-2026 ROMA Totale vittorie: 2 Tutte le vittorie: 2001-02 2007-08 SAMPDORIA Totale vittorie: 1 Tutte le vittorie: 1991-92 PARMA Totale vittorie: 1 Tutte le vittorie: 1999-00 FIORENTINA Totale vittorie: 1 Tutte le vittorie: 1996-97 Lega Serie A`;
assert.deepEqual(parseSupercoppaItalianaTitles(supercoppaItalianaFixture).map((row) => [row.name, row.titles]), [
  ['Juventus', 9], ['Inter', 8], ['Milan', 8], ['Lazio', 5], ['Napoli', 3], ['Roma', 2], ['Fiorentina', 1], ['Parma', 1], ['Sampdoria', 1]
]);

const copaDelReyFixture = `== Palmarés ==
{| class="wikitable sortable"
|-
| '''[[Fútbol Club Barcelona]]''' || '''32''' || 11
|-
| '''[[Athletic Club]]''' || '''24''' || 16
|-
| '''[[Real Madrid Club de Fútbol|Real Madrid]]''' || '''20''' || 21
|}
== Otra sección ==`;
assert.deepEqual(parseWikipediaCopaDelReyClubTitles(copaDelReyFixture).map((row) => [row.name, row.titles]), [
  ['Fútbol Club Barcelona', 32],
  ['Athletic Club', 24],
  ['Real Madrid', 20]
]);
assert.equal(copaAmericaTitleRows.length, 8);
assert.equal(copaAmericaTitleRows.reduce((sum, row) => sum + row.titles, 0), 48);
assert.deepEqual(copaAmericaTitleRows.slice(0, 3).map((row) => [row.code, row.titles]), [['ARG', 16], ['URU', 15], ['BRA', 9]]);

const iffhsGoalkeepers = fetchIffhsGoalkeeperRanking();
assert.equal(iffhsGoalkeepers.entries.length, 50);
assert.equal(iffhsGoalkeepers.entries[0]?.name, 'Gianluigi Buffon');
assert.equal(iffhsGoalkeepers.entries[0]?.points, 357);
assert.equal(iffhsGoalkeepers.entries.filter((row) => row.displayedRank === 48).length, 3);
assert.equal(new Set(iffhsGoalkeepers.entries.map((row) => row.externalId)).size, 50);

const rightsEvidence = 'https://example.test/licence';
const rightsScope = 'web,pwa,android,cdn,local_storage';
assert.deepEqual(assertRightsApproval({
  assetKind: 'portrait', entityType: 'player', provider: 'wikimedia-commons',
  licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceRightsStatus: 'review_required', rightsBasis: 'open_license', commercialUse: true,
  attributionRequired: true, attributionText: 'Autor — CC BY 4.0', trademarkStatus: undefined,
  rightsEvidenceUrl: rightsEvidence, usageScope: rightsScope, allowShareAlike: false
}).rightsBasis, 'open_license');
assert.deepEqual(assertRightsApproval({
  assetKind: 'badge', entityType: 'club', provider: 'thesportsdb',
  licenseName: null, licenseUrl: null, sourceRightsStatus: 'approved', rightsBasis: 'provider_license',
  commercialUse: true, attributionRequired: false, attributionText: undefined, trademarkStatus: 'cleared',
  rightsEvidenceUrl: rightsEvidence, usageScope: rightsScope, allowShareAlike: false
}).trademarkStatus, 'cleared');
assert.throws(() => assertRightsApproval({
  assetKind: 'portrait', entityType: 'player', provider: 'api-football',
  licenseName: null, licenseUrl: null, sourceRightsStatus: 'review_required', rightsBasis: 'provider_license', commercialUse: true,
  attributionRequired: false, attributionText: undefined, trademarkStatus: undefined,
  rightsEvidenceUrl: rightsEvidence, usageScope: rightsScope, allowShareAlike: false
}));
assert.throws(() => assertRightsApproval({
  assetKind: 'badge', entityType: 'club', provider: 'wikimedia-commons',
  licenseName: 'Public domain', licenseUrl: null, sourceRightsStatus: 'review_required', rightsBasis: 'public_domain', commercialUse: true,
  attributionRequired: false, attributionText: undefined, trademarkStatus: 'not_applicable',
  rightsEvidenceUrl: rightsEvidence, usageScope: rightsScope, allowShareAlike: false
}));
assert.throws(() => assertRightsApproval({
  assetKind: 'portrait', entityType: 'player', provider: 'wikimedia-commons',
  licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceRightsStatus: 'review_required', rightsBasis: 'open_license', commercialUse: true,
  attributionRequired: true, attributionText: undefined, trademarkStatus: undefined,
  rightsEvidenceUrl: rightsEvidence, usageScope: rightsScope, allowShareAlike: false
}));
assert.deepEqual(assertRightsApproval({
  assetKind: 'portrait', entityType: 'player', provider: 'thesportsdb',
  licenseName: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceRightsStatus: 'review_required', rightsBasis: 'open_license', commercialUse: true,
  attributionRequired: true, attributionText: 'TheSportsDB player artwork — CC BY-SA 4.0', trademarkStatus: undefined,
  rightsEvidenceUrl: 'https://www.thesportsdb.com/player/34175608', usageScope: rightsScope, allowShareAlike: true,
  assetLevelOpenLicense: true
}).rightsBasis, 'open_license');
assert.throws(() => assertRightsApproval({
  assetKind: 'portrait', entityType: 'player', provider: 'thesportsdb',
  licenseName: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceRightsStatus: 'review_required', rightsBasis: 'open_license', commercialUse: true,
  attributionRequired: true, attributionText: 'TheSportsDB player artwork — CC BY-SA 4.0', trademarkStatus: undefined,
  rightsEvidenceUrl: 'https://www.thesportsdb.com/player/34175608', usageScope: rightsScope, allowShareAlike: true,
  assetLevelOpenLicense: false
}));
assert.throws(() => assertRightsApproval({
  assetKind: 'portrait', entityType: 'player', provider: 'thesportsdb',
  licenseName: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', sourceRightsStatus: 'review_required', rightsBasis: 'open_license', commercialUse: true,
  attributionRequired: true, attributionText: 'TheSportsDB player artwork — CC BY-SA 4.0', trademarkStatus: undefined,
  rightsEvidenceUrl: 'https://www.thesportsdb.com/player/34175608', usageScope: rightsScope, allowShareAlike: true,
  assetLevelOpenLicense: true
}));

console.log('ranking tests passed');
