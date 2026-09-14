import type { PoolClient } from 'pg';
import { findUniqueCanonicalEntity, moveEntityDataToCanonical, normalizeIdentityName, recordIdentityLink, resolveCanonicalEntityId } from './entityIdentity.js';

const curatedApiFootballCanonicalIds: Record<string, string> = {
  // API-Football uses the legal first name; the official PL catalogue uses the
  // established short name. Provider IDs make these mappings deterministic.
  'api-football:player:18931': 'pl:player:3756', // Christopher Wood -> Chris Wood
  'api-football:player:19366': 'pl:player:8658', // Oliver Watkins -> Ollie Watkins
  // Soldado was imported once through API-Football and once through the
  // LaLiga catalogue. The same Commons file and exact birth/name identity
  // make this an explicit, reviewed consolidation rather than a fuzzy match.
  'api-football:player:1375': 'bdfutbol:la-liga:player:e694f06d956a426228a19925'
};

// UEFA's public ranking uses a stable player path, but not the same entity
// namespace as the historical catalog. These are explicit, reviewed links;
// ambiguous names (for example "Torres", "Vieira" or "Müller" without a
// first name) are intentionally not included.
const curatedUefaChampionsCanonicalIds: Record<string, string> = {
  'uefa:player:b9a71ac2ace226ffaf90e4fb': 'pl:player:9198', // Luuk de Jong (250005343; exact name and national-team identity)
  // These current UEFA IDs are returned with shortened display names in the
  // historical ranking. The stable UEFA player IDs make the consolidation
  // deterministic even when the label is only a surname.
  'uefa:player:8be214babfea59740bcb24d4': 'dfb:bundesliga:player:c50065a141a513c2431d1c08', // Thomas Müller (250003318)
  'uefa:player:0fab6630f268fc62f94f1af1': 'pl:player:52723', // Julián Alvarez (250172668)
  'uefa:player:f192dfb290258be8330c6c6e': 'pl:player:19680', // Gabriel Jesus (250106649)
  'uefa:player:da9cd04b4f3b44a970194516': 'pl:player:4481', // Olivier Giroud (250020851)
  'uefa:player:a2cd912d517ec2bec376b081': 'france-football:player:58303', // Ousmane Dembélé (250066886)
  'uefa:player:d9429dd25a0e59c16392d316': 'pl:player:2457', // Hernán Crespo (33820)
  'uefa:player:aee47f15eb6c7c9ebd0248dc': 'dfb:bundesliga:player:2a87a9d8d8dbd1e97af1b247', // Mario Gómez (62588)
  'uefa:player:329d6f8bdfd8af49b09d13e5': 'pl:player:3420', // Fernando Torres (58686)
  'uefa:player:e14fcd6000cfa6d3cce90218': 'pl:player:14732', // Trent Alexander-Arnold
  'uefa:player:5239f573b3cdb2bc2208111a': 'pl:player:4973', // Alexis Sánchez
  'uefa:player:1cdc2a8e2ce0b91e0552efa3': 'pl:player:5067', // Bernardo Silva
  'uefa:player:6e0318f27a7074c7acc51107': 'pl:player:23396', // Bruno Fernandes
  'uefa:player:79003b3d9f37e17eab23b7d8': 'pl:player:6615', // Juan Cuadrado
  'uefa:player:638d8b2fa3c89b27e7863fa2': 'pl:player:4145', // David Silva (ranking alias)
  'uefa:player:e3b17aaac588255ef6c7c540': 'pl:player:4288', // Kevin De Bruyne
  'uefa:player:96abe47fb469444f07f6b460': 'pl:player:3592', // Deco (ranking alias)
  'uefa:player:7980b7583290e3d3595c8930': 'pl:player:13511', // Roberto Firmino
  'uefa:player:08c9588344cb6184470aa05a': 'pl:player:14805', // Phil Foden
  'uefa:player:fe376b1b1dd25893b003a2f3': 'pl:player:4478', // Serge Gnabry
  'uefa:player:badc38fe3ce250e3a2933b84': 'pl:player:4803', // Jesús Navas
  'uefa:player:bd581cd5a2cca18d3faa14bb': 'pl:player:5051', // João Cancelo
  'uefa:player:b166b6429d88603686d507ae': 'pl:player:4287', // Juan Mata
  'uefa:player:06bcac4bf36e7aec09b31f66': 'pl:player:2100', // James Milner
  'uefa:player:0bc76438d2e8218bec8e00b6': 'pl:player:2116', // Juan Sebastián Verón
  'uefa:player:a5c9c55bbd43290817168fd2': 'pl:player:2839', // Theo Walcott
  'uefa:player:1b5821093a9706d93c727911': 'pl:player:4748', // Willian
  'uefa:player:b21b6112ae476128becfca76': 'pl:player:20750', // Hakim Ziyech
  'uefa:player:0600f758bca55fa1b571905f': 'pl:player:2662', // Didier Drogba
  'uefa:player:08adf07a2a6a0d9df23a1774': 'pl:player:5772', // Zlatan Ibrahimovic
  'uefa:player:074377aa8967cb38274bb89a': 'france-football:player:22047', // Karim Benzema
  'uefa:player:1c22d89f9530dbe7b58d6c06': 'pl:player:4138', // Luis Suárez
  'uefa:player:1f63ff814b8ea71cb1fefc24': 'pl:player:800', // Frank Lampard
  'uefa:player:233fea6a304b0523cd525067': 'pl:player:3960', // Harry Kane
  'uefa:player:319b80152cf9bfe1e627ad4d': 'pl:player:5794', // Ángel Di María
  'uefa:player:35dd1bcfc5b46c4f1b30fd1c': 'pl:player:4316', // Raheem Sterling
  'uefa:player:49dce47dea3b83569a2b6ab2': 'pl:player:2658', // Arjen Robben
  'uefa:player:4d3289b796d6208d99e1e7db': 'pl:player:5271', // Bastian Schweinsteiger
  'uefa:player:4dae56eb5c705d854bcf8dea': 'france-football:player:4013', // Luís Figo
  'uefa:player:4f23f246105f065f4cc8089f': 'pl:player:336', // Paul Scholes
  'uefa:player:6253484c07506d1bef62c762': 'pl:player:4751', // Samuel Eto'o
  'uefa:player:6446fdb0096c23c6bb75365d': 'pl:player:3106', // Andriy Shevchenko
  'uefa:player:665578163bb3167cbd26c5b3': 'france-football:player:21740', // Lionel Messi
  'uefa:player:7b4f58014c5dd9948462ed4f': 'pl:player:5178', // Mohamed Salah
  'uefa:player:8a157ece0a3bcd721a3b8f5e': 'pl:player:2417', // Cesc Fàbregas
  'uefa:player:9050280f50e79a9d21921517': 'pl:player:1575', // Steven Gerrard
  'uefa:player:92a2858f4ced1b3f846096e0': 'pl:player:8983', // Riyad Mahrez
  'uefa:player:a274843d0a4493300e5f87e9': 'pl:player:2117', // Ruud van Nistelrooij
  'uefa:player:be602a35c9e842dfcb82c9c7': 'pl:player:2522', // Cristiano Ronaldo
  'uefa:player:e34af0e294aa05c0084b1d40': 'pl:player:2064', // Wayne Rooney
  'uefa:player:e42531732bdba6949301d91d': 'pl:player:1659', // Thierry Henry
  'uefa:player:e5ca5484e2ebfbf02d7aaa1a': 'pl:player:335', // Ryan Giggs
  'uefa:player:e5ecf82949c72ca93810cd62': 'france-football:player:46710', // Kaká
  'uefa:player:e7d409615484e51d09031588': 'pl:player:2616', // Robin van Persie
  'uefa:player:06d43c099e56fb93f08011c8': 'pl:player:4328', // Sergio Agüero
  'uefa:player:17d1bb07a2f5cb9835c0d826': 'pl:player:5804', // Álvaro Morata
  'uefa:player:88b0ede726fd9e2bff613487': 'pl:player:2757', // Patrick Kluivert
  'uefa:player:ebdd8b2e752c8f72db64cff2': 'france-football:player:9446', // Gerd Müller (ranking alias)
  'uefa:player:99563b816550f97a9f3591b8': 'france-football:player:10294', // Eusébio
  'uefa:player:c897aa8f027670bb683c7b9a': 'france-football:player:9627', // Johan Cruyff
  'uefa:player:3cdbf263a38f1b827e812ca5': 'france-football:player:10288', // Alfredo Di Stefano
  'uefa:player:ae6efd2652389cd5819473b1': 'pl:player:6519', // Sadio Mané (250061119)
  'uefa:player:6304030b802ec25cd99f3abf': 'pl:player:4290', // Romelu Lukaku (250010802)
  'uefa:player:29ed65fb19b2c2f1a1a83497': 'pl:player:1135', // Nicolas Anelka (27578)
};

// The Conference League ranking shares the UEFA namespace with the other
// competitions, but its shortened labels can create a second entity for a
// player already present in the Champions League catalogue. These are only
// deterministic duplicate links verified by the stable UEFA player path;
// ambiguous surnames remain untouched until they have a second identity
// signal.
const curatedUefaConferenceCanonicalIds: Record<string, string> = {
  'uefa:player:8e1c376597511127445b429c': 'uefa:player:f7cddab2791916f36d46f81d', // Edin Džeko (same UEFA player path)
  'uefa:player:24f7040d1d90cae2ab2be574': 'uefa:player:2cf051a8f2dbc23185ff683c', // Christian Eriksen
  'uefa:player:6be6e6bc183c880234e21f0f': 'uefa:player:3de8af5c3024c563843d65a0', // Álex Grimaldo
  // UEFA's full-name row is the same Nicolò Zaniolo already identified by
  // the Premier League catalogue; the official/API birth date is the second
  // signal used to keep this mapping deterministic.
  'uefa:player:abbb901952dc98cc287ca7c9': 'pl:player:22795'
};

// A small number of historical DFB rows have an unambiguous canonical record
// outside the league catalogue. Keep these as explicit links instead of
// relying on a provider-name heuristic.
const curatedDfbBundesligaCanonicalIds: Record<string, string> = {
  'dfb:bundesliga:player:7a5b5cc244dc5663e597d008': 'france-football:player:9446', // Gerd Müller
};

// BDFutbol includes the legal surname in this record while UEFA uses the
// established display name. The source IDs make this equivalence explicit;
// it must not be inferred from a loose surname match.
const curatedBdfutbolCanonicalIds: Record<string, string> = {
  'bdfutbol:la-liga:player:aac6625435f910488c3b44a2': 'uefa:player:04cf3fda53c4035a29db57f9', // Sergio Ramos García -> Sergio Ramos
  'bdfutbol:la-liga:player:e3048915a0b3671068e4c5c1': 'rsssf:goalkeeper:player:3c848e2ddb30c985550710c0', // Andoni Zubizarreta Urreta -> Andoni Zubizarreta
  'bdfutbol:ligue-1:player:3ca0f95619da2ef6c6a8f34e': 'rsssf:international:player:d2dea9babfad8c25e0bbb6dc' // Kylian Mbappé Lottin -> Kylian Mbappé
};

// Club rankings use a separate UEFA namespace from the current league
// catalogue. These are only clubs with an unambiguous canonical Premier
// League record already present; other European clubs remain in their UEFA
// namespace until a canonical club record and a reviewed mapping exist.
const curatedUefaClubCanonicalIds: Array<{ sourceEntityId: string; canonicalEntityId: string; sourceKey: string }> = [
  ['uefa:champions:club:2fa9bd880a4d7139b4a42c4a', 'pl:club:2', 'uefa-champions-league-official'], // Aston Villa
  ['uefa:champions:club:6a5ed83658ef85afc77709cc', 'pl:club:10', 'uefa-champions-league-official'], // Liverpool
  ['uefa:champions:club:836530272c76ba5639ab8c1f', 'pl:club:4', 'uefa-champions-league-official'], // Chelsea
  ['uefa:champions:club:266882bcfc57492612bea9fa', 'pl:club:15', 'uefa-champions-league-official'], // Nottingham Forest
  ['uefa:champions:club:fd920dd0f865a80a1f0c4d31', 'pl:club:12', 'uefa-champions-league-official'], // Manchester United
  ['uefa:champions:club:88002d9c115ac7318a275ee0', 'pl:club:11', 'uefa-champions-league-official'], // Manchester City
  ['uefa:europa:club:2fa9bd880a4d7139b4a42c4a', 'pl:club:2', 'uefa-europa-league-official'], // Aston Villa
  ['uefa:europa:club:6a5ed83658ef85afc77709cc', 'pl:club:10', 'uefa-europa-league-official'], // Liverpool
  ['uefa:europa:club:836530272c76ba5639ab8c1f', 'pl:club:4', 'uefa-europa-league-official'], // Chelsea
  ['uefa:conference:club:4d48f1753671fbe369593a06', 'pl:club:6', 'uefa-conference-league-official'], // Crystal Palace
  ['uefa:conference:club:836530272c76ba5639ab8c1f', 'pl:club:4', 'uefa-conference-league-official'], // Chelsea
  ['dfb:bundesliga:club:hamburg', 'uefa:champions:club:47afcff3dcb9e9891e7b329e', 'bundesliga-honours-official'], // Hamburg
  // UEFA's display labels are shortened in these feeds; the stable club
  // records and the national competition catalog make these four mappings
  // unambiguous. They are deliberately explicit instead of name-based.
  ['uefa:europa:club:61d6f57edf9f3d273eabba3b', 'wikipedia-es:copa-del-rey:club:1062bf49fd57223c47600fea', 'uefa-europa-league-official'], // Atleti -> Atlético de Madrid
  ['uefa:europa:club:a3fb8a4dfff4bea4edd4c2f7', 'dfb:dfb-pokal:club:eintracht-frankfurt', 'uefa-europa-league-official'], // Frankfurt -> Eintracht Frankfurt
  ['uefa:europa:club:d33a051b24ccf99ec450ffb2', 'dfb:bundesliga:club:bayer-leverkusen', 'uefa-europa-league-official'], // Leverkusen -> Bayer Leverkusen
  ['uefa:europa:club:fd920dd0f865a80a1f0c4d31', 'pl:club:12', 'uefa-europa-league-official'] // Man Utd -> Manchester United
].map(([sourceEntityId, canonicalEntityId, sourceKey]) => ({ sourceEntityId: sourceEntityId!, canonicalEntityId: canonicalEntityId!, sourceKey: sourceKey! }));

// The FA Cup catalogue has its own namespace. Only reviewed aliases to an
// already canonical club are listed here; historical or extinct clubs remain
// separate until an equally strong identity target exists.
const curatedFaCupCanonicalIds: Array<{ sourceEntityId: string; canonicalEntityId: string; sourceKey: string }> = [
  ['fa:club:leeds-united', 'pl:club:9', 'fa-cup-official']
].map(([sourceEntityId, canonicalEntityId, sourceKey]) => ({ sourceEntityId: sourceEntityId!, canonicalEntityId: canonicalEntityId!, sourceKey: sourceKey! }));

const curatedRsssfCanonicalByExternalId: Record<string, string> = {
  'cronaldo-intlg.html': 'pl:player:2522',
  'messi-intlg.html': 'france-football:player:21740',
  'kane-intlg.html': 'pl:player:3960',
  'dzeko-intlg.html': 'uefa:player:f7cddab2791916f36d46f81d',
  'dimaria-intlg.html': 'pl:player:5794',
  'drogba-intlg.html': 'pl:player:2662',
  'ibrahimovic-intlg.html': 'pl:player:5772',
  'egy-salah-intlg.html': 'pl:player:5178',
  'cavani-intlg.html': 'uefa:player:1e55bc7ed04280152efb1a25',
  'fran-giroud-intlg.html': 'pl:player:4481',
  'etoo-intlg.html': 'pl:player:4751',
  'rooney-intlg.html': 'pl:player:2064',
  'henry-intlg.html': 'pl:player:1659',
  'vpersie-intl.html': 'pl:player:2616',
  'shevchenko-intlg.html': 'pl:player:3106',
  'skor-son-hm-intlg.html': 'pl:player:4999', // Son Heung-Min
  'puskas-intlg.html': 'uefa:player:519291d14b5654664901bf09',
  'bijtertje-intlg.html': 'pl:player:4138'
};

// The World Cup top-scorer table has its own RSSSF entity namespace. These
// links are restricted to players with an existing, unambiguous catalogue
// record; historical names without a strong target remain separate until
// they receive a reviewed canonical record.
const curatedRsssfWorldCupCanonicalByEntityId: Record<string, string> = {
  'rsssf:world-cup:player:c97e6fa2563ad9f49eb3542e': 'rsssf:international:player:d2dea9babfad8c25e0bbb6dc', // Kylian Mbappé
  'rsssf:world-cup:player:33a2ed377508c1d9ad959510': 'france-football:player:21740', // Lionel Messi
  'rsssf:world-cup:player:3963656093138b571ccc915b': 'dfb:bundesliga:player:67a030395b5d81b6c462f4e7', // Miroslav Klose
  'rsssf:world-cup:player:0f7dbc00823a902539feeccf': 'france-football:player:53960', // Ronaldo
  'rsssf:world-cup:player:3ee009457ab7c626ffb5e22b': 'pl:player:3960', // Harry Kane
  'rsssf:world-cup:player:5ab8b9d45067fc277420b764': 'france-football:player:9446', // Gerd Müller
  'rsssf:world-cup:player:6f97ba192642aa285cefe600': 'rsssf:international:player:3a2f79afbeb7ae44fac0d76a', // Pelé
  'rsssf:world-cup:player:228f736141233a158fea699c': 'pl:player:2522', // Cristiano Ronaldo
  'rsssf:world-cup:player:5de1707bf991e8fb8ca2329d': 'pl:player:965', // Jürgen Klinsmann
  'rsssf:world-cup:player:a81f61f5fe798cfa0b2ab830': 'dfb:bundesliga:player:c50065a141a513c2431d1c08', // Thomas Müller
  'rsssf:world-cup:player:3093ad294afc4651986174a6': 'france-football:player:10294', // Eusébio
  'rsssf:world-cup:player:348f39eebfb17912845ea49b': 'rsssf:international:player:59a6d8eacede0829eec4413b', // Neymar
  'rsssf:world-cup:player:4cac6e8d1283bf123ad93e6a': 'rsssf:international:player:f99ff9fb513907a5537ff5a1', // David Villa
  'rsssf:world-cup:player:c8903e7eb204ca9ce3a9b662': 'france-football:player:4251', // Roberto Baggio
  'rsssf:world-cup:player:46462ece9821be1a9246c43e': 'france-football:player:4022', // Rivaldo
  'rsssf:world-cup:player:e4495c31949f129a243e159b': 'pl:player:4290', // Romelu Lukaku
  'rsssf:world-cup:player:f20d5ff37e69226d8e2fe6b6': 'france-football:player:4839', // Hristo Stoichkov
  'rsssf:world-cup:player:82a46c7e0bac7d8bfc01918f': 'france-football:player:3757', // Lothar Matthäus
  'rsssf:world-cup:player:f7b829a7882926c4f45ab910': 'rsssf:international:player:e20f3626c0482a37adccab7a', // Zico
  'rsssf:world-cup:player:c96de4e5291582217042b654': 'france-football:player:4112', // Zinedine Zidane
  'rsssf:world-cup:player:c051f10dbc290f538b69d87b': 'pl:player:1659' // Thierry Henry
};

// The EURO ranking uses a different UEFA player identifier set from the
// Champions League ranking. Only exact, manually reviewed identifiers are
// included here. Short surnames and ambiguous names are deliberately omitted
// until a second independent identity signal is available.
const curatedUefaEuroCanonicalIds: Record<string, string> = {
  'uefa:player:28e04a10a1cbc62268899ef5': 'pl:player:3513', // Gareth Bale
  'uefa:player:be1ead67c83cddb2bab1e98c': 'pl:player:3103', // Michael Ballack
  'uefa:player:25539ce053317935fab84f99': 'pl:player:331', // David Beckham (alternate UEFA ID)
  'uefa:player:392936553d6a291dbba34e5e': 'france-football:player:22047', // Karim Benzema
  'uefa:player:09978ead09663a7f56e565a9': 'pl:player:2522', // Cristiano Ronaldo
  'uefa:player:46b731d63bd8d51026f30013': 'pl:player:4145', // David Silva
  'uefa:player:39ea6cfe6690368e557376e3': 'pl:player:4288', // Kevin De Bruyne
  'uefa:player:5b9a7375eeeab844e1ba9e39': 'pl:player:3592', // Deco
  'uefa:player:5e10037022f8bbbac8238d6b': 'pl:player:2417', // Cesc Fàbregas
  'uefa:player:5e16edd6eb26b644a66b3207': 'pl:player:1575', // Steven Gerrard
  'uefa:player:93d5b6e5da9560501630100b': 'pl:player:4481', // Olivier Giroud
  'uefa:player:537add525f29ae85d7564b2e': 'pl:player:5772', // Zlatan Ibrahimovic
  'uefa:player:f9d95e23812387b3eb668960': 'pl:player:3960', // Harry Kane
  'uefa:player:e2b222f945964dfc4e9fa056': 'pl:player:965', // Jürgen Klinsmann
  'uefa:player:4dac78e9bc39c719068fa8e1': 'pl:player:2757', // Patrick Kluivert
  'uefa:player:007d204f5ffae3e49d6ddb61': 'pl:player:800', // Frank Lampard
  'uefa:player:cd729d0b88bd16ff9b9917bd': 'france-football:player:4013', // Luís Figo
  'uefa:player:5b6481a3d9f6349f1c89844e': 'france-football:player:3757', // Lothar Matthäus
  'uefa:player:29aada6525ae4af51a4ee716': 'france-football:player:3929', // Michael Owen
  'uefa:player:03ed061f6a334e658189cd41': 'pl:player:4714', // Mesut Özil
  'uefa:player:c28bf9e3a2efb2ed29ef6da7': 'france-football:player:9663', // Michel Platini
  'uefa:player:0eb9f3749591685a450b1908': 'pl:player:2658', // Arjen Robben
  'uefa:player:b9fbf7c866a30c24f3e94f7b': 'pl:player:2064', // Wayne Rooney
  'uefa:player:7b4f58014c5dd9948462ed4f': 'pl:player:5178', // Mohamed Salah
  'uefa:player:54c6a29a50933fc231bac14f': 'rsssf:international:player:d2dea9babfad8c25e0bbb6dc', // Kylian Mbappé (shared UEFA player path)
  'uefa:player:162572bf72270a0a29662401': 'rsssf:goalkeeper:player:695368e714433174e8efc28f', // Manuel Neuer
  'uefa:player:21038f15dd956a51087669f1': 'pl:player:5271', // Bastian Schweinsteiger
  'uefa:player:20f8785d364ee7489ae8f46a': 'pl:player:5267', // Xherdan Shaqiri
  'uefa:player:7bb815386b36657138bddc61': 'pl:player:89', // Alan Shearer
  'uefa:player:cca466eeaab9bb47d30da7a1': 'pl:player:4316', // Raheem Sterling
  'uefa:player:9ee1dd233a95a024c31a7b64': 'france-football:player:4839', // Hristo Stoichkov
  'uefa:player:b8a3d1fbaa3a00289f9ec36e': 'france-football:player:15463', // Marco van Basten
  'uefa:player:c460973a9c80ecba5d454518': 'pl:player:2117', // Ruud van Nistelrooy
  'uefa:player:76c0364f0db282e68011a51c': 'pl:player:2616', // Robin van Persie
  'uefa:player:793e799a5d0ac6ad3c97a99c': 'france-football:player:4112', // Zinedine Zidane
  'uefa:player:b2aa09c133773a56e9db2a8e': 'france-football:player:9446', // Gerd Müller (initial-only UEFA label)
  'uefa:player:804ae7c8aeded55360b4d126': 'pl:player:4503' // Eden Hazard (UEFA provider id 1902160; 2016/2020)
};

export type IdentityMoveCounts = {
  stats: number;
  assets: number;
  aliases: number;
  externalIds: number;
  profiles: number;
  rankings: number;
  facts: number;
  honours: number;
  awards: number;
  challengeItems: number;
  matchStats: number;
  matches: number;
};

function emptyMoveCounts(): IdentityMoveCounts {
  return { stats: 0, assets: 0, aliases: 0, externalIds: 0, profiles: 0, rankings: 0, facts: 0, honours: 0, awards: 0, challengeItems: 0, matchStats: 0, matches: 0 };
}

function addMoveCounts(total: IdentityMoveCounts, moved: IdentityMoveCounts): void {
  for (const key of Object.keys(total) as Array<keyof IdentityMoveCounts>) total[key] += moved[key];
}

/**
 * Repair links created by older imports or migrations that recorded the
 * redirect but did not move the rows already stored under the source entity.
 * Each link is isolated by a savepoint so an ambiguous/conflicting record is
 * reported and left untouched instead of being merged speculatively.
 */
export async function repairIdentityLinks(client: PoolClient): Promise<{
  repaired: number;
  skipped: number;
  conflicts: Array<{ sourceEntityId: string; canonicalEntityId: string; error: string }>;
  moved: IdentityMoveCounts;
}> {
  const links = await client.query<{ source_entity_id: string; canonical_entity_id: string }>(
    `SELECT source_entity_id, canonical_entity_id
     FROM entity_identity_links
     ORDER BY source_entity_id`
  );
  const moved = emptyMoveCounts();
  const conflicts: Array<{ sourceEntityId: string; canonicalEntityId: string; error: string }> = [];
  let repaired = 0;
  let skipped = 0;
  for (const link of links.rows) {
    const canonicalEntityId = await resolveCanonicalEntityId(client, link.canonical_entity_id);
    if (canonicalEntityId === link.source_entity_id) {
      skipped += 1;
      continue;
    }
    const source = await client.query<{ id: string }>('SELECT id FROM entities WHERE id = $1', [link.source_entity_id]);
    const canonical = await client.query<{ id: string }>('SELECT id FROM entities WHERE id = $1', [canonicalEntityId]);
    if (!source.rows[0] || !canonical.rows[0]) {
      skipped += 1;
      continue;
    }
    await client.query('SAVEPOINT repair_identity_link');
    try {
      addMoveCounts(moved, await moveEntityDataToCanonical(client, link.source_entity_id, canonicalEntityId));
      if (canonicalEntityId !== link.canonical_entity_id) {
        await client.query(
          `UPDATE entity_identity_links
           SET canonical_entity_id = $2, updated_at = NOW()
           WHERE source_entity_id = $1`,
          [link.source_entity_id, canonicalEntityId]
        );
      }
      await client.query('RELEASE SAVEPOINT repair_identity_link');
      repaired += 1;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT repair_identity_link');
      await client.query('RELEASE SAVEPOINT repair_identity_link');
      conflicts.push({
        sourceEntityId: link.source_entity_id,
        canonicalEntityId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { repaired, skipped, conflicts, moved };
}

export async function consolidateApiFootballIdentities(client: PoolClient): Promise<{
  players: number;
  clubs: number;
  skipped: number;
  conflicts: Array<{ sourceEntityId: string; canonicalEntityId: string; error: string }>;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'api-football';
  const sourceEntities = await client.query<{ id: string; entity_type: 'player' | 'club'; canonical_name: string; birth_date: string | null }>(
    `SELECT DISTINCT e.id, e.entity_type, e.canonical_name, e.birth_date
     FROM entities e JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1
       AND e.entity_type IN ('player', 'club')
       AND e.catalog_status = 'active'
       -- The game only needs identity consolidation for the active ranked
       -- pool.  API-Football also stores tens of thousands of archival
       -- provider rows; scanning those against the whole catalog makes this
       -- maintenance command quadratic without improving a playable ranking.
       AND (
         EXISTS (
           SELECT 1
           FROM ranking_entries re
           JOIN ranking_snapshots rs ON rs.id = re.snapshot_id AND rs.status <> 'superseded'
           WHERE re.entity_id = e.id AND re.rank <= 200
         )
         OR EXISTS (
           SELECT 1 FROM entity_game_profiles egp
           WHERE egp.entity_id = e.id AND egp.playable_default = TRUE
         )
       )
     ORDER BY e.entity_type, e.canonical_name, e.id`, [sourceKey]
  );
  let players = 0; let clubs = 0; let skipped = 0;
  const conflicts: Array<{ sourceEntityId: string; canonicalEntityId: string; error: string }> = [];
  const moved = emptyMoveCounts();
  for (const source of sourceEntities.rows) {
    const preferredPrefix = `pl:${source.entity_type}:`;
    const manualClubAliases: Record<string, string> = { Newcastle: 'pl:club:23' };
    const canonical = curatedApiFootballCanonicalIds[source.id]
      ?? (source.entity_type === 'club' && manualClubAliases[source.canonical_name]
        ? manualClubAliases[source.canonical_name]
        : await findUniqueCanonicalEntity(client, source.entity_type, 'api-football:', source.canonical_name, source.birth_date, preferredPrefix));
    if (!canonical || canonical === source.id) { skipped += 1; continue; }
    await client.query('SAVEPOINT consolidate_api_football_identity');
    try {
      await recordIdentityLink(client, source.id, canonical, sourceKey, 'Coincidencia única de nombre y fecha de nacimiento compatible; fuente API-Football enlazada al registro canónico');
      const result = await moveEntityDataToCanonical(client, source.id, canonical);
      addMoveCounts(moved, result);
      await client.query('RELEASE SAVEPOINT consolidate_api_football_identity');
      if (source.entity_type === 'player') players += 1; else clubs += 1;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT consolidate_api_football_identity');
      await client.query('RELEASE SAVEPOINT consolidate_api_football_identity');
      conflicts.push({
        sourceEntityId: source.id,
        canonicalEntityId: canonical,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { players, clubs, skipped, conflicts, moved };
}

export async function consolidateUefaChampionsLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'uefa-champions-league-official';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  for (const [sourceEntityId, canonicalEntityId] of Object.entries(curatedUefaChampionsCanonicalIds)) {
    const source = await client.query<{ entity_type: 'player' }>(
      `SELECT e.entity_type
       FROM entities e JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE e.id = $1 AND e.entity_type = 'player' AND x.source_key = $2`,
      [sourceEntityId, sourceKey]
    );
    const canonical = await client.query<{ entity_type: 'player' }>(
      "SELECT entity_type FROM entities WHERE id = $1 AND entity_type = 'player'",
      [canonicalEntityId]
    );
    if (!source.rows[0] || !canonical.rows[0]) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [sourceEntityId]
    );
    if (existingLink.rows[0]?.canonical_entity_id === canonicalEntityId) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      sourceEntityId,
      canonicalEntityId,
      sourceKey,
      'Coincidencia revisada por identificador UEFA y catálogo canónico; nombre inequívoco'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, canonicalEntityId));
    linked += 1;
  }
  return { linked, skipped, moved };
}

/**
 * UEFA exposes the same stable player image identifier in different
 * competition feeds.  The ranking entity IDs are feed-specific, so a name
 * match is not enough; the shared stable image path is a strong source-level
 * identity signal and lets us join the records without guessing homonyms.
 */
export async function consolidateUefaSharedPlayerIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKeys = [
    'uefa-champions-league-official',
    'uefa-europa-league-official',
    'uefa-conference-league-official',
    'uefa-euro-official'
  ];
  const linkSourceKey = 'uefa-shared-player-identifiers';
  await client.query(
    `INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status)
     VALUES ($1, 'UEFA shared player identifiers', 'reference', 'https://www.uefa.com/', $2, 'review_required')
     ON CONFLICT (key) DO NOTHING`,
    [linkSourceKey, 'Identity evidence only: shared stable UEFA player image identifier across competition feeds; not a media licence.']
  );
  const rows = await client.query<{ id: string; source_key: string; external_id: string }>(
    `SELECT DISTINCT e.id, x.source_key, x.external_id
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE e.entity_type = 'player' AND x.source_key = ANY($1::text[])
     ORDER BY e.id, x.source_key, x.external_id`,
    [sourceKeys]
  );
  const groups = new Map<string, Map<string, Set<string>>>();
  const sourcePriority = new Map(sourceKeys.map((sourceKey, index) => [sourceKey, index]));
  for (const row of rows.rows) {
    const match = row.external_id.match(/\/(\d+)\.(?:jpe?g|png)$/iu);
    if (!match) continue;
    const stableId = match[1];
    if (!stableId) continue;
    const byEntity = groups.get(stableId) ?? new Map<string, Set<string>>();
    const entitySources = byEntity.get(row.id) ?? new Set<string>();
    entitySources.add(row.source_key);
    byEntity.set(row.id, entitySources);
    groups.set(stableId, byEntity);
  }
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;
  for (const byEntity of groups.values()) {
    if (byEntity.size < 2) continue;
    const entityIds = [...byEntity.keys()];
    const resolvedIds = new Map<string, string>();
    for (const entityId of entityIds) resolvedIds.set(entityId, await resolveCanonicalEntityId(client, entityId));
    const outsideTargets = [...new Set(resolvedIds.values())].filter((id) => !byEntity.has(id));
    if (outsideTargets.length > 1) {
      skipped += byEntity.size;
      continue;
    }
    const target = outsideTargets[0] ?? [...entityIds].sort((left, right) => {
      const leftPriority = Math.min(...[...(byEntity.get(left) ?? [])].map((key) => sourcePriority.get(key) ?? 99));
      const rightPriority = Math.min(...[...(byEntity.get(right) ?? [])].map((key) => sourcePriority.get(key) ?? 99));
      return leftPriority - rightPriority || left.localeCompare(right);
    })[0];
    if (!target) {
      skipped += byEntity.size;
      continue;
    }
    for (const sourceEntityId of entityIds) {
      const resolvedSource = resolvedIds.get(sourceEntityId);
      if (!resolvedSource || resolvedSource === target) {
        skipped += 1;
        continue;
      }
      if (resolvedSource !== sourceEntityId) {
        skipped += 1;
        continue;
      }
      await client.query('SAVEPOINT uefa_shared_player_identity');
      try {
        await recordIdentityLink(
          client,
          sourceEntityId,
          target,
          linkSourceKey,
          'Mismo identificador estable de jugador en rutas de imagen UEFA de competiciones distintas'
        );
        addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, target));
        await client.query('RELEASE SAVEPOINT uefa_shared_player_identity');
        linked += 1;
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT uefa_shared_player_identity');
        await client.query('RELEASE SAVEPOINT uefa_shared_player_identity');
        conflicts += 1;
        skipped += 1;
      }
    }
  }
  return { linked, skipped, conflicts, moved };
}

export async function consolidateUefaConferenceLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'uefa-conference-league-official';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  for (const [sourceEntityId, canonicalEntityId] of Object.entries(curatedUefaConferenceCanonicalIds)) {
    const source = await client.query<{ entity_type: 'player' }>(
      `SELECT e.entity_type
       FROM entities e JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE e.id = $1 AND e.entity_type = 'player' AND x.source_key = $2`,
      [sourceEntityId, sourceKey]
    );
    const canonical = await client.query<{ entity_type: 'player' }>(
      "SELECT entity_type FROM entities WHERE id = $1 AND entity_type = 'player'",
      [canonicalEntityId]
    );
    if (!source.rows[0] || !canonical.rows[0]) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [sourceEntityId]
    );
    if (existingLink.rows[0]?.canonical_entity_id === canonicalEntityId) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      sourceEntityId,
      canonicalEntityId,
      sourceKey,
      'Duplicado revisado por identificador UEFA estable compartido con el catálogo Champions League'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, canonicalEntityId));
    linked += 1;
  }
  return { linked, skipped, moved };
}

async function consolidateStatbunkerCompetitionIdentities(client: PoolClient, competition: 'club_world_cup' | 'copa_libertadores' | 'conference' | 'euro' | 'nations_league' | 'copa_america' | 'europa' | 'champions_league'): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = competition === 'club_world_cup'
    ? 'statbunker-club-world-cup-clean-sheets'
    : competition === 'copa_libertadores'
      ? 'statbunker-copa-libertadores-clean-sheets'
    : competition === 'conference'
      ? 'statbunker-uefa-conference-league'
    : competition === 'euro' ? 'statbunker-euro'
      : competition === 'nations_league' ? 'statbunker-nations-league-clean-sheets'
        : competition === 'copa_america' ? 'statbunker-copa-america-clean-sheets'
          : competition === 'champions_league' ? 'statbunker-uefa-champions-league'
            : 'statbunker-uefa-europa-league';
  const sourceKeys = [sourceKey, `${sourceKey}-clean-sheets`];
  // The Conference importer has existed under both namespaces over time.
  // Read both spellings so older rows are not silently skipped during
  // identity consolidation; all other competitions use one namespace.
  const sourcePrefixes = competition === 'conference'
    ? ['statbunker:conference:player:', 'statbunker:uefa-conference:player:']
    : [`statbunker:${competition}:player:`];
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;
  const canonicalCandidates = await client.query<{ id: string; canonical_name: string; birth_date: string | null; aliases: string[] }>(
    `SELECT e.id, e.canonical_name, e.birth_date,
            COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
     FROM entities e
     LEFT JOIN entity_aliases a ON a.entity_id = e.id
     WHERE e.entity_type = 'player' AND NOT (e.id LIKE ANY($1::text[]))
     GROUP BY e.id, e.canonical_name, e.birth_date`,
    [sourcePrefixes.map((prefix) => `${prefix}%`)]
  );
  const existingLinks = await client.query<{ source_entity_id: string; canonical_entity_id: string }>(
    'SELECT source_entity_id, canonical_entity_id FROM entity_identity_links'
  );
  const linkedBySource = new Map(existingLinks.rows.map((link) => [link.source_entity_id, link.canonical_entity_id]));
  const resolveIndexedIdentity = (entityId: string): string => {
    let current = entityId;
    const visited = new Set<string>();
    while (linkedBySource.has(current) && !visited.has(current)) {
      visited.add(current);
      current = linkedBySource.get(current)!;
    }
    return current;
  };
  const nameIndex = new Map<string, Array<{ id: string; birthDate: string | null }>>();
  for (const candidate of canonicalCandidates.rows) {
    for (const name of [candidate.canonical_name, ...(candidate.aliases ?? [])]) {
      const key = normalizeIdentityName(name);
      if (!key) continue;
      const matches = nameIndex.get(key) ?? [];
      if (!matches.some((match) => match.id === candidate.id)) matches.push({ id: candidate.id, birthDate: candidate.birth_date });
      nameIndex.set(key, matches);
    }
  }
  const sourceEntities = await client.query<{ id: string; canonical_name: string; birth_date: string | null }>(
    `SELECT DISTINCT e.id, e.canonical_name, e.birth_date
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id AND x.source_key = ANY($1::text[])
     WHERE e.entity_type = 'player' AND e.id LIKE ANY($2::text[])
     ORDER BY e.canonical_name, e.id`,
    [sourceKeys, sourcePrefixes.map((prefix) => `${prefix}%`)]
  );
  for (const source of sourceEntities.rows) {
    const sourceKeyName = normalizeIdentityName(source.canonical_name);
    const matches = (nameIndex.get(sourceKeyName) ?? []).filter((candidate) => {
      if (!source.birth_date || !candidate.birthDate) return true;
      return new Date(source.birth_date).toISOString().slice(0, 10) === new Date(candidate.birthDate).toISOString().slice(0, 10);
    });
    const resolvedIds = [...new Set(matches.map((candidate) => resolveIndexedIdentity(candidate.id)))];
    const preferredIds = [...new Set(matches
      .filter((candidate) => candidate.id.startsWith('api-football:'))
      .map((candidate) => resolveIndexedIdentity(candidate.id)))];
    const canonical = preferredIds.length === 1
      ? preferredIds[0] ?? null
      : resolvedIds.length === 1
        ? resolvedIds[0] ?? null
        : null;
    if (!canonical) {
      skipped += 1;
      continue;
    }
    const resolvedCanonical = await resolveCanonicalEntityId(client, canonical);
    if (resolvedCanonical === source.id) {
      skipped += 1;
      continue;
    }
    await client.query(`SAVEPOINT statbunker_${competition}_identity_link`);
    try {
      await recordIdentityLink(
        client,
        source.id,
        resolvedCanonical,
        sourceKey,
        `Coincidencia exacta y única de nombre StatBunker ${competition}; se omiten homónimos ambiguos`
      );
      addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, resolvedCanonical));
      await client.query(`RELEASE SAVEPOINT statbunker_${competition}_identity_link`);
      linked += 1;
    } catch (error) {
      await client.query(`ROLLBACK TO SAVEPOINT statbunker_${competition}_identity_link`);
      await client.query(`RELEASE SAVEPOINT statbunker_${competition}_identity_link`);
      if (error instanceof Error && /Conflicto de (ranking|premio|reto|estadística|identificadores externos)/u.test(error.message)) {
        conflicts += 1;
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return { linked, skipped, conflicts, moved };
}

export async function consolidateStatbunkerConferenceIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'conference');
}

export async function consolidateStatbunkerClubWorldCupIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'club_world_cup');
}

export async function consolidateStatbunkerCopaLibertadoresIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'copa_libertadores');
}

export async function consolidateStatbunkerEuroIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'euro');
}

export async function consolidateStatbunkerNationsLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'nations_league');
}

export async function consolidateStatbunkerCopaAmericaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'copa_america');
}

export async function consolidateStatbunkerEuropaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'europa');
}

export async function consolidateStatbunkerChampionsLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateStatbunkerCompetitionIdentities(client, 'champions_league');
}

export async function consolidateUefaClubIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  for (const mapping of curatedUefaClubCanonicalIds) {
    const source = await client.query<{ entity_type: 'club' }>(
      `SELECT e.entity_type
       FROM entities e
       WHERE e.id = $1 AND e.entity_type = 'club'`,
      [mapping.sourceEntityId]
    );
    const canonical = await client.query<{ entity_type: 'club' }>(
      `SELECT entity_type FROM entities WHERE id = $1 AND entity_type = 'club'`,
      [mapping.canonicalEntityId]
    );
    if (!source.rows[0] || !canonical.rows[0]) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [mapping.sourceEntityId]
    );
    if (existingLink.rows[0]?.canonical_entity_id === mapping.canonicalEntityId) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      mapping.sourceEntityId,
      mapping.canonicalEntityId,
      mapping.sourceKey,
      'Coincidencia revisada por identificador UEFA y catálogo canónico de clubes; nombre inequívoco'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, mapping.sourceEntityId, mapping.canonicalEntityId));
    linked += 1;
  }
  return { linked, skipped, moved };
}

/**
 * UEFA reuses the same stable team-logo identifier across its Champions,
 * Europa and Conference League feeds. The feed namespaces are different,
 * which can otherwise create two playable rows for one club. Only merge
 * records when the stable UEFA external ID is identical; names are retained
 * as a second audit signal and conflicting pre-existing links are skipped.
 */
export async function consolidateUefaSharedClubIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKeys = [
    'uefa-champions-league-official',
    'uefa-europa-league-official',
    'uefa-conference-league-official'
  ];
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const groups = await client.query<{ external_id: string }>(
    `SELECT x.external_id
     FROM entity_external_ids x
     JOIN entities e ON e.id = x.entity_id AND e.entity_type = 'club'
     WHERE x.source_key = ANY($1::text[])
     GROUP BY x.external_id
     HAVING COUNT(DISTINCT x.entity_id) > 1
     ORDER BY x.external_id`,
    [sourceKeys]
  );

  for (const group of groups.rows) {
    const members = await client.query<{ id: string; canonical_name: string; source_key: string }>(
      `SELECT e.id, e.canonical_name, x.source_key
       FROM entities e
       JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE e.entity_type = 'club' AND x.external_id = $1 AND x.source_key = ANY($2::text[])
       ORDER BY CASE
         WHEN e.id LIKE 'uefa:champions:club:%' THEN 1
         WHEN e.id LIKE 'uefa:europa:club:%' THEN 2
         WHEN e.id LIKE 'uefa:conference:club:%' THEN 3
         ELSE 4 END, e.id, x.source_key`,
      [group.external_id, sourceKeys]
    );
    const uniqueMembers = [...new Map(members.rows.map((member) => [member.id, member])).values()];
    const names = new Set(uniqueMembers.map((member) => member.canonical_name));
    if (names.size !== 1 || uniqueMembers.length < 2) {
      skipped += 1;
      continue;
    }

    const existingLinks = await client.query<{ source_entity_id: string; canonical_entity_id: string }>(
      'SELECT source_entity_id, canonical_entity_id FROM entity_identity_links WHERE source_entity_id = ANY($1::text[])',
      [uniqueMembers.map((member) => member.id)]
    );
    const linkedTargets = [...new Set(existingLinks.rows.map((link) => link.canonical_entity_id))];
    if (linkedTargets.length > 1) {
      skipped += uniqueMembers.length;
      continue;
    }
    const canonicalEntityId = linkedTargets[0] ?? uniqueMembers[0]!.id;
    for (const member of uniqueMembers) {
      if (member.id === canonicalEntityId) continue;
      const existingLink = existingLinks.rows.find((link) => link.source_entity_id === member.id);
      if (existingLink) {
        skipped += 1;
        continue;
      }
      await recordIdentityLink(
        client,
        member.id,
        canonicalEntityId,
        member.source_key,
        `Identificador UEFA estable compartido (${group.external_id}) y nombre de club idéntico entre competiciones`
      );
      addMoveCounts(moved, await moveEntityDataToCanonical(client, member.id, canonicalEntityId));
      linked += 1;
    }
  }
  return { linked, skipped, moved };
}

export async function consolidateFaCupIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  for (const mapping of curatedFaCupCanonicalIds) {
    const source = await client.query<{ entity_type: 'club' }>(
      `SELECT entity_type FROM entities WHERE id = $1 AND entity_type = 'club'`,
      [mapping.sourceEntityId]
    );
    const canonical = await client.query<{ entity_type: 'club' }>(
      `SELECT entity_type FROM entities WHERE id = $1 AND entity_type = 'club'`,
      [mapping.canonicalEntityId]
    );
    if (!source.rows[0] || !canonical.rows[0]) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [mapping.sourceEntityId]
    );
    if (existingLink.rows[0]?.canonical_entity_id === mapping.canonicalEntityId) {
      skipped += 1;
      continue;
    }
    if (existingLink.rows[0]) {
      throw new Error(`La identidad ${mapping.sourceEntityId} ya apunta a ${existingLink.rows[0].canonical_entity_id}`);
    }
    await recordIdentityLink(
      client,
      mapping.sourceEntityId,
      mapping.canonicalEntityId,
      mapping.sourceKey,
      'Coincidencia revisada por identificador FA Cup y catálogo canónico de clubes; nombre inequívoco'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, mapping.sourceEntityId, mapping.canonicalEntityId));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateRsssfIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'rsssf-international-records';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  for (const [externalId, canonicalEntityId] of Object.entries(curatedRsssfCanonicalByExternalId)) {
    const source = await client.query<{ entity_id: string }>(
      `SELECT entity_id FROM entity_external_ids
       WHERE source_key = $1 AND entity_type = 'player' AND external_id = $2`,
      [sourceKey, externalId]
    );
    const sourceEntityId = source.rows[0]?.entity_id;
    const entities = await client.query<{ id: string; entity_type: 'player' }>(
      "SELECT id, entity_type FROM entities WHERE id = ANY($1::text[]) AND entity_type = 'player'",
      [[sourceEntityId, canonicalEntityId].filter(Boolean)]
    );
    if (!sourceEntityId || entities.rows.length < 2 || sourceEntityId === canonicalEntityId) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [sourceEntityId]
    );
    if (existingLink.rows[0]?.canonical_entity_id === canonicalEntityId) {
      skipped += 1;
      continue;
    }
    if (await resolveCanonicalEntityId(client, canonicalEntityId) === sourceEntityId) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      sourceEntityId,
      canonicalEntityId,
      sourceKey,
      'Coincidencia revisada por identificador RSSSF y nombre/selección inequívocos'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, canonicalEntityId));
    linked += 1;
  }
  const worldCupSourceKey = 'rsssf-world-cup-records';
  for (const [sourceEntityId, requestedCanonicalEntityId] of Object.entries(curatedRsssfWorldCupCanonicalByEntityId)) {
    const source = await client.query<{ entity_type: 'player' }>(
      `SELECT e.entity_type
       FROM entities e JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE e.id = $1 AND e.entity_type = 'player' AND x.source_key = $2`,
      [sourceEntityId, worldCupSourceKey]
    );
    const canonicalEntityId = await resolveCanonicalEntityId(client, requestedCanonicalEntityId);
    const canonical = await client.query<{ entity_type: 'player' }>(
      'SELECT entity_type FROM entities WHERE id = $1 AND entity_type = \'player\'',
      [canonicalEntityId]
    );
    if (!source.rows[0] || !canonical.rows[0] || sourceEntityId === canonicalEntityId) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [sourceEntityId]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    if (await resolveCanonicalEntityId(client, canonicalEntityId) === sourceEntityId) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      sourceEntityId,
      canonicalEntityId,
      worldCupSourceKey,
      'Coincidencia revisada por identificador RSSSF Mundial, nombre y selección inequívocos'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, canonicalEntityId));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateStatbunkerWorldCupIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'statbunker-world-cup';
  const sourceKeys = [sourceKey, `${sourceKey}-clean-sheets`];
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const sourceEntities = await client.query<{ id: string; canonical_name: string }>(
    `SELECT DISTINCT e.id, e.canonical_name
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = ANY($1::text[]) AND e.entity_type = 'player'
       AND e.id LIKE 'statbunker:world-cup:player:%'
     ORDER BY e.canonical_name, e.id`,
    [sourceKeys]
  );
  for (const source of sourceEntities.rows) {
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    const canonical = await findUniqueCanonicalEntity(
      client,
      'player',
      'statbunker:world-cup:player:',
      source.canonical_name
    );
    if (!canonical || canonical === source.id) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      source.id,
      canonical,
      sourceKey,
      'Coincidencia única de nombre normalizado entre StatBunker Mundial y catálogo canónico; se omiten homónimos ambiguos'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateUefaEuroIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'uefa-euro-official';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  for (const [sourceEntityId, canonicalEntityId] of Object.entries(curatedUefaEuroCanonicalIds)) {
    const source = await client.query<{ entity_type: 'player' }>(
      `SELECT e.entity_type
       FROM entities e JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE e.id = $1 AND e.entity_type = 'player' AND x.source_key = $2`,
      [sourceEntityId, sourceKey]
    );
    const canonical = await client.query<{ entity_type: 'player' }>(
      "SELECT entity_type FROM entities WHERE id = $1 AND entity_type = 'player'",
      [canonicalEntityId]
    );
    if (!source.rows[0] || !canonical.rows[0]) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [sourceEntityId]
    );
    if (existingLink.rows[0]) {
      if (existingLink.rows[0].canonical_entity_id === canonicalEntityId) skipped += 1;
      else skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      sourceEntityId,
      canonicalEntityId,
      sourceKey,
      'Coincidencia revisada por identificador UEFA EURO y catálogo canónico; nombre inequívoco'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, canonicalEntityId));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateDfbBundesligaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'dfb-bundesliga-record-scorers';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const sourceEntities = await client.query<{ id: string; canonical_name: string }>(
    `SELECT DISTINCT e.id, e.canonical_name
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'player'
       AND e.id LIKE 'dfb:bundesliga:player:%'
     ORDER BY e.canonical_name, e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const canonical = curatedDfbBundesligaCanonicalIds[source.id] ?? await findUniqueCanonicalEntity(
        client,
        'player',
        'dfb:bundesliga:player:',
        source.canonical_name,
        null,
        'pl:player:'
      );
    if (!canonical || canonical === source.id) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      source.id,
      canonical,
      sourceKey,
      'Coincidencia exacta de nombre con entidad canónica; se omiten homónimos ambiguos'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateDfbPokalIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'dfb-pokal-official';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  // Only map clubs whose identity is already explicit in the canonical DFB
  // catalogue. Historical winners with no unambiguous target remain in the
  // source namespace instead of being guessed from a similar name.
  const curatedCanonicalIds: Record<string, string> = {
    'dfb:dfb-pokal:club:fc-bayern-munchen': 'dfb:bundesliga:club:bayern-munich',
    'dfb:dfb-pokal:club:borussia-dortmund': 'dfb:bundesliga:club:borussia-dortmund',
    'dfb:dfb-pokal:club:borussia-monchengladbach': 'dfb:bundesliga:club:borussia-monchengladbach',
    'dfb:dfb-pokal:club:werder-bremen': 'dfb:bundesliga:club:werder-bremen',
    'dfb:dfb-pokal:club:bayer-leverkusen': 'dfb:bundesliga:club:bayer-leverkusen',
    'dfb:dfb-pokal:club:vfb-stuttgart': 'dfb:bundesliga:club:vfb-stuttgart',
    'dfb:dfb-pokal:club:vfl-wolfsburg': 'dfb:bundesliga:club:wolfsburg',
    'dfb:dfb-pokal:club:hamburger-sv': 'dfb:bundesliga:club:hamburg'
  };
  const sourceEntities = await client.query<{ id: string }>(
    `SELECT DISTINCT e.id
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'dfb:dfb-pokal:club:%'
     ORDER BY e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const canonical = curatedCanonicalIds[source.id];
    if (!canonical || canonical === source.id) {
      skipped += 1;
      continue;
    }
    const target = await client.query<{ id: string }>(
      "SELECT id FROM entities WHERE id = $1 AND entity_type = 'club'",
      [canonical]
    );
    if (target.rowCount !== 1) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(client, source.id, canonical, sourceKey, 'Equivalencia histórica de club revisada con el catálogo oficial DFB Bundesliga');
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateSerieAClubTitlesIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'legaseriea-official-palmares';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const curatedCanonicalIds: Record<string, string> = {
    'legaseriea:club:inter': 'uefa:champions:club:30a4a5bca8f4056c1f696b91',
    'legaseriea:club:juventus': 'uefa:europa:club:805addd3b0bc63427185cfbe',
    'legaseriea:club:milan': 'uefa:champions:club:ec3ae6550b9446364138461d',
    'legaseriea:club:napoli': 'uefa:europa:club:8f51ddf7b345d5193ceea265',
    'legaseriea:club:roma': 'uefa:conference:club:7e325f21b5b5f02606012cea'
  };
  const sourceEntities = await client.query<{ id: string }>(
    `SELECT DISTINCT e.id
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'legaseriea:club:%'
     ORDER BY e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const canonical = curatedCanonicalIds[source.id];
    if (!canonical || canonical === source.id) {
      skipped += 1;
      continue;
    }
    const target = await client.query<{ id: string }>(
      "SELECT id FROM entities WHERE id = $1 AND entity_type = 'club'",
      [canonical]
    );
    if (target.rowCount !== 1) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(client, source.id, canonical, sourceKey, 'Equivalencia exacta de club validada por identificadores UEFA y nombre oficial');
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateSupercoppaItalianaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'legaseriea-supercoppa-official';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const curatedCanonicalIds: Record<string, string> = {
    'legaseriea:supercoppa:club:juventus': 'uefa:europa:club:805addd3b0bc63427185cfbe',
    'legaseriea:supercoppa:club:inter': 'uefa:champions:club:30a4a5bca8f4056c1f696b91',
    'legaseriea:supercoppa:club:milan': 'uefa:champions:club:ec3ae6550b9446364138461d',
    'legaseriea:supercoppa:club:lazio': 'legaseriea:club:lazio',
    'legaseriea:supercoppa:club:napoli': 'uefa:europa:club:8f51ddf7b345d5193ceea265',
    'legaseriea:supercoppa:club:roma': 'uefa:conference:club:7e325f21b5b5f02606012cea',
    'legaseriea:supercoppa:club:sampdoria': 'legaseriea:club:sampdoria',
    'legaseriea:supercoppa:club:parma': 'uefa:europa:club:fa68eb67b36bbbc5ffead947',
    'legaseriea:supercoppa:club:fiorentina': 'legaseriea:club:fiorentina'
  };
  const sourceEntities = await client.query<{ id: string }>(
    `SELECT DISTINCT e.id
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'legaseriea:supercoppa:club:%'
     ORDER BY e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const canonical = curatedCanonicalIds[source.id];
    if (!canonical || canonical === source.id) {
      skipped += 1;
      continue;
    }
    const target = await client.query<{ id: string }>(
      "SELECT id FROM entities WHERE id = $1 AND entity_type = 'club'",
      [canonical]
    );
    if (target.rowCount !== 1) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(client, source.id, canonical, sourceKey, 'Equivalencia exacta de club validada por el palmarés oficial de Lega Serie A');
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateDflSupercupIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'bundesliga-dfl-supercup-official';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const curatedCanonicalIds: Record<string, string> = {
    'bundesliga:dfl-supercup:club:bayern-munich': 'dfb:bundesliga:club:bayern-munich',
    'bundesliga:dfl-supercup:club:borussia-dortmund': 'dfb:bundesliga:club:borussia-dortmund',
    'bundesliga:dfl-supercup:club:werder-bremen': 'dfb:bundesliga:club:werder-bremen',
    'bundesliga:dfl-supercup:club:kaiserslautern': 'dfb:bundesliga:club:kaiserslautern',
    'bundesliga:dfl-supercup:club:vfb-stuttgart': 'dfb:bundesliga:club:vfb-stuttgart',
    'bundesliga:dfl-supercup:club:fc-schalke-04': 'dfb:dfb-pokal:club:fc-schalke-04',
    'bundesliga:dfl-supercup:club:wolfsburg': 'dfb:bundesliga:club:wolfsburg',
    'bundesliga:dfl-supercup:club:rb-leipzig': 'dfb:dfb-pokal:club:rb-leipzig',
    'bundesliga:dfl-supercup:club:bayer-leverkusen': 'dfb:bundesliga:club:bayer-leverkusen'
  };
  const sourceEntities = await client.query<{ id: string }>(
    `SELECT DISTINCT e.id
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'bundesliga:dfl-supercup:club:%'
     ORDER BY e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const canonical = curatedCanonicalIds[source.id];
    if (!canonical || canonical === source.id) {
      skipped += 1;
      continue;
    }
    const target = await client.query<{ id: string }>(
      "SELECT id FROM entities WHERE id = $1 AND entity_type = 'club'",
      [canonical]
    );
    if (target.rowCount !== 1) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(client, source.id, canonical, sourceKey, 'Equivalencia exacta de club validada por el historial oficial del DFL Supercup');
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateWikipediaSerieAIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'wikipedia-it-serie-a-records';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const sourceEntities = await client.query<{ id: string; canonical_name: string }>(
    `SELECT DISTINCT e.id, e.canonical_name
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'player'
       AND e.id LIKE 'wikipedia-it:serie-a:player:%'
     ORDER BY e.canonical_name, e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const candidates = await client.query<{ id: string }>(
      `SELECT e.id
       FROM entities e
       WHERE e.entity_type = 'player'
         AND e.id NOT LIKE 'wikipedia-it:serie-a:player:%'
         AND lower(e.canonical_name) = lower($1)
       ORDER BY e.id`,
      [source.canonical_name]
    );
    if (candidates.rows.length !== 1 || candidates.rows[0]?.id === source.id) {
      skipped += 1;
      continue;
    }
    const canonical = candidates.rows[0]?.id;
    if (!canonical) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      source.id,
      canonical,
      sourceKey,
      'Coincidencia exacta y única de nombre con el catálogo canónico; se omiten homónimos ambiguos'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateWikipediaCopaDelReyIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'wikipedia-es-copa-del-rey-palmares';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  // These clubs already have stable identities in the canonical football
  // catalogue. Historical Spanish clubs not present there remain under the
  // source namespace until an unambiguous identity is curated.
  const curatedCanonicalIds: Record<string, string> = {
    'Fútbol Club Barcelona': 'uefa:champions:club:062dda15f8838576019a50b0',
    'Real Madrid Club de Fútbol': 'uefa:champions:club:4bea3ac923fc47dcf0b15d66',
    'Club Atlético de Madrid': 'uefa:europa:club:61d6f57edf9f3d273eabba3b',
    'Valencia Club de Fútbol': 'uefa:europa:club:a66b6c078db27b114adbc579',
    'Sevilla Fútbol Club': 'uefa:europa:club:69d2280dea38ba7afcecc8b3'
  };
  const sourceEntities = await client.query<{ id: string; canonical_name: string }>(
    `SELECT DISTINCT e.id, e.canonical_name
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'wikipedia-es:copa-del-rey:club:%'
     ORDER BY e.canonical_name, e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const curated = curatedCanonicalIds[source.canonical_name];
    if (!curated) {
      skipped += 1;
      continue;
    }
    const target = await client.query<{ id: string }>(
      `SELECT id FROM entities WHERE id = $1 AND entity_type = 'club'`,
      [curated]
    );
    if (!target.rows[0]) {
      skipped += 1;
      continue;
    }
    const canonical = await resolveCanonicalEntityId(client, target.rows[0].id);
    if (canonical === source.id) {
      skipped += 1;
      continue;
    }
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0]) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      source.id,
      canonical,
      sourceKey,
      'Club español canónico revisado mediante identificador UEFA y equivalencia histórica del nombre'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateWikipediaCopaSudamericanaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'wikipedia-es-copa-sudamericana-records';
  const targetSourceKey = 'wikipedia-es-copa-libertadores-records';
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const sourceEntities = await client.query<{ id: string; canonical_name: string }>(
    `SELECT DISTINCT e.id, e.canonical_name
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'wikipedia-es:copa-sudamericana:club:%'
     ORDER BY e.canonical_name, e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const candidates = await client.query<{ id: string }>(
      `SELECT DISTINCT e.id
       FROM entities e
       JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE x.source_key = $1
         AND e.entity_type = 'club'
         AND lower(e.canonical_name) = lower($2)
         AND e.id <> $3
       ORDER BY e.id`,
      [targetSourceKey, source.canonical_name, source.id]
    );
    if (candidates.rows.length !== 1) {
      skipped += 1;
      continue;
    }
    const canonical = await resolveCanonicalEntityId(client, candidates.rows[0]!.id);
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0] || canonical === source.id) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      source.id,
      canonical,
      sourceKey,
      'Coincidencia exacta y única con el club del catálogo de Libertadores; se omiten nombres sin entidad equivalente inequívoca'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateWikipediaRecopaSudamericanaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKey = 'wikipedia-es-recopa-sudamericana-records';
  const targetSourceKeys = ['wikipedia-es-copa-libertadores-records', 'wikipedia-es-copa-sudamericana-records'];
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  const sourceEntities = await client.query<{ id: string; canonical_name: string }>(
    `SELECT DISTINCT e.id, e.canonical_name
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE x.source_key = $1 AND e.entity_type = 'club'
       AND e.id LIKE 'wikipedia-es:recopa-sudamericana:club:%'
     ORDER BY e.canonical_name, e.id`,
    [sourceKey]
  );
  for (const source of sourceEntities.rows) {
    const candidates = await client.query<{ id: string }>(
      `SELECT DISTINCT e.id
       FROM entities e
       JOIN entity_external_ids x ON x.entity_id = e.id
       WHERE x.source_key = ANY($1::text[])
         AND e.entity_type = 'club'
         AND lower(e.canonical_name) = lower($2)
         AND e.id <> $3
       ORDER BY e.id`,
      [targetSourceKeys, source.canonical_name, source.id]
    );
    if (candidates.rows.length !== 1) {
      skipped += 1;
      continue;
    }
    const canonical = await resolveCanonicalEntityId(client, candidates.rows[0]!.id);
    const existingLink = await client.query<{ canonical_entity_id: string }>(
      'SELECT canonical_entity_id FROM entity_identity_links WHERE source_entity_id = $1',
      [source.id]
    );
    if (existingLink.rows[0] || canonical === source.id) {
      skipped += 1;
      continue;
    }
    await recordIdentityLink(
      client,
      source.id,
      canonical,
      sourceKey,
      'Coincidencia exacta y única con el catálogo CONMEBOL ya consolidado; se omiten homónimos'
    );
    addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, canonical));
    linked += 1;
  }
  return { linked, skipped, moved };
}

export async function consolidateBdfutbolLaLigaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKeys = [
    'bdfutbol-la-liga-record-scorers',
    'bdfutbol-la-liga-records',
    'bdfutbol-premier-league-records',
    'bdfutbol-bundesliga-records',
    'bdfutbol-serie-a-records',
    'bdfutbol-ligue-1-records',
    'bdfutbol-primeira-liga-records'
  ];
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;
  const canonicalCandidates = await client.query<{ id: string; canonical_name: string; birth_date: string | null; aliases: string[] }>(
    `SELECT e.id, e.canonical_name,
            e.birth_date,
            COALESCE(array_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '{}') AS aliases
     FROM entities e
     LEFT JOIN entity_aliases a ON a.entity_id = e.id
     WHERE e.entity_type = 'player' AND e.id NOT LIKE 'bdfutbol:%'
     GROUP BY e.id, e.canonical_name, e.birth_date`
  );
  const firstLastIndex = new Map<string, Array<{ id: string; birthDate: string | null }>>();
  const normalizedNameIndex = new Map<string, Array<{ id: string; birthDate: string | null }>>();
  const firstLastKey = (name: string): string | null => {
    const tokens = normalizeIdentityName(name).split(' ').filter(Boolean);
    return tokens.length >= 2 ? `${tokens[0]} ${tokens.at(-1)}` : null;
  };
  for (const candidate of canonicalCandidates.rows) {
    const key = firstLastKey(candidate.canonical_name);
    if (key) {
      const ids = firstLastIndex.get(key) ?? [];
      ids.push({ id: candidate.id, birthDate: candidate.birth_date });
      firstLastIndex.set(key, ids);
    }
    for (const name of [candidate.canonical_name, ...(candidate.aliases ?? [])]) {
      const normalizedName = normalizeIdentityName(name);
      if (!normalizedName) continue;
      const nameMatches = normalizedNameIndex.get(normalizedName) ?? [];
      if (!nameMatches.some((match) => match.id === candidate.id)) nameMatches.push({ id: candidate.id, birthDate: candidate.birth_date });
      normalizedNameIndex.set(normalizedName, nameMatches);
    }
  }
  const existingLinks = await client.query<{ source_entity_id: string; canonical_entity_id: string }>(
    'SELECT source_entity_id, canonical_entity_id FROM entity_identity_links'
  );
  const linkedBySource = new Map(existingLinks.rows.map((link) => [link.source_entity_id, link.canonical_entity_id]));
  const resolveIndexedIdentity = (entityId: string): string => {
    let current = entityId;
    const visited = new Set<string>();
    while (linkedBySource.has(current) && !visited.has(current)) {
      visited.add(current);
      current = linkedBySource.get(current)!;
    }
    return current;
  };
  const sourceEntities = await client.query<{ id: string; canonical_name: string; birth_date: string | null; source_key: string }>(
    `SELECT DISTINCT ON (e.id) e.id, e.canonical_name,
            e.birth_date,
            x.source_key
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     LEFT JOIN ranking_entries re ON re.entity_id = e.id
     LEFT JOIN ranking_snapshots rs ON rs.id = re.snapshot_id
     LEFT JOIN category_definitions c ON c.id = rs.category_id
     WHERE x.source_key = ANY($1::text[]) AND e.entity_type = 'player'
       AND e.id LIKE 'bdfutbol:%:player:%'
       AND (c.slug ~ '^(la-liga|premier-league|bundesliga|serie-a|ligue-1|primeira-liga)-(goals|clean_sheets|yellow_cards|red_cards)$' OR c.slug IS NULL)
     ORDER BY e.id, rs.generated_at DESC NULLS LAST, x.source_key`,
    [sourceKeys]
  );
  for (const source of sourceEntities.rows) {
    const league = source.id.split(':')[1];
    const preferredEntityPrefix = league === 'la-liga'
      ? 'pl:player:'
      : league === 'premier-league'
        ? 'pl:player:'
        : league === 'bundesliga'
          ? 'dfb:bundesliga:player:'
          : league === 'serie-a'
            ? 'wikipedia-it:serie-a:player:'
            : 'uefa:player:';
    let canonical: string | null = null;
    // BDFutbol exposes a short display label (often only a surname) in
    // evidence.sourceName. It is not an identity key: using it merged
    // homonyms such as Dieter Müller and Thomas Müller. Resolve only from
    // the imported full name and, when available, the source birth date.
    const sourceNameTokenCount = normalizeIdentityName(source.canonical_name).split(' ').filter(Boolean).length;
    const hasSafeAutomaticIdentitySignal = sourceNameTokenCount >= 2 || Boolean(source.birth_date);
    if (curatedBdfutbolCanonicalIds[source.id]) {
      canonical = curatedBdfutbolCanonicalIds[source.id] ?? null;
    } else if (hasSafeAutomaticIdentitySignal) {
      const comparableBirthDate = source.birth_date ? new Date(source.birth_date).toISOString().slice(0, 10) : null;
      const matches = (normalizedNameIndex.get(normalizeIdentityName(source.canonical_name)) ?? []).filter((candidate) => {
        if (comparableBirthDate && candidate.birthDate) {
          const candidateBirthDate = new Date(candidate.birthDate).toISOString().slice(0, 10);
          return comparableBirthDate === candidateBirthDate;
        }
        return true;
      });
      const resolvedIds = [...new Set(matches.map((candidate) => resolveIndexedIdentity(candidate.id)))];
      const preferredMatches = [...new Set(matches
        .filter((candidate) => candidate.id.startsWith(preferredEntityPrefix))
        .map((candidate) => resolveIndexedIdentity(candidate.id)))];
      canonical = preferredMatches.length === 1
        ? preferredMatches[0] ?? null
        : resolvedIds.length === 1
          ? resolvedIds[0] ?? null
          : null;
    }
    if (!canonical) {
      const key = firstLastKey(source.canonical_name);
      const matches = key ? firstLastIndex.get(key) ?? [] : [];
      const birthDate = source.birth_date ? new Date(source.birth_date).toISOString().slice(0, 10) : null;
      const birthMatches = birthDate
        ? matches.filter((match) => match.birthDate && new Date(match.birthDate).toISOString().slice(0, 10) === birthDate)
        : matches;
      if (birthMatches.length === 1) canonical = birthMatches[0]?.id ?? null;
    }
    if (!canonical) {
      skipped += 1;
      continue;
    }
    const resolvedCanonical = await resolveCanonicalEntityId(client, canonical);
    if (resolvedCanonical === source.id) {
      skipped += 1;
      continue;
    }
    await client.query('SAVEPOINT bdfutbol_identity_link');
    try {
      await recordIdentityLink(
        client,
        source.id,
        resolvedCanonical,
        source.source_key,
        curatedBdfutbolCanonicalIds[source.id]
          ? 'Equivalencia explícita revisada por identificador de fuente: Sergio Ramos García = Sergio Ramos'
          : 'Coincidencia única de nombre BDFutbol con señal de identidad suficiente; se omiten etiquetas de una palabra sin fecha de nacimiento'
      );
      addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, resolvedCanonical));
      await client.query('RELEASE SAVEPOINT bdfutbol_identity_link');
      linkedBySource.set(source.id, resolvedCanonical);
      linked += 1;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT bdfutbol_identity_link');
      await client.query('RELEASE SAVEPOINT bdfutbol_identity_link');
      if (error instanceof Error && /Conflicto de (ranking|premio|reto|estadística|identificadores externos)/u.test(error.message)) {
        conflicts += 1;
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return { linked, skipped, conflicts, moved };
}

async function consolidateTransfermarktCompetitionIdentities(
  client: PoolClient,
  sourceKey: string,
  entityPrefix: string,
  preferredEntityPrefix: string | null | undefined = 'uefa:player:'
): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;
  const sourceEntities = await client.query<{ id: string; canonical_name: string; birth_date: string | null }>(
    `SELECT DISTINCT e.id, e.canonical_name, e.birth_date
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id AND x.source_key = $1
     WHERE e.entity_type = 'player' AND e.id LIKE $2
     ORDER BY e.id`,
    [sourceKey, `${entityPrefix}%`]
  );

  for (const source of sourceEntities.rows) {
    const canonical = await findUniqueCanonicalEntity(
      client,
      'player',
      entityPrefix,
      source.canonical_name,
      source.birth_date,
      preferredEntityPrefix ?? undefined
    );
    if (!canonical) {
      skipped += 1;
      continue;
    }
    const resolvedCanonical = await resolveCanonicalEntityId(client, canonical);
    if (resolvedCanonical === source.id) {
      skipped += 1;
      continue;
    }
    await client.query('SAVEPOINT transfermarkt_libertadores_identity_link');
    try {
      await recordIdentityLink(
        client,
        source.id,
        resolvedCanonical,
        sourceKey,
        'Coincidencia exacta y única de nombre Transfermarkt con el catálogo de jugadores; se omiten homónimos'
      );
      addMoveCounts(moved, await moveEntityDataToCanonical(client, source.id, resolvedCanonical));
      await client.query('RELEASE SAVEPOINT transfermarkt_libertadores_identity_link');
      linked += 1;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT transfermarkt_libertadores_identity_link');
      await client.query('RELEASE SAVEPOINT transfermarkt_libertadores_identity_link');
      if (error instanceof Error && /Conflicto de (ranking|premio|reto|estadística|identificadores externos)/u.test(error.message)) {
        conflicts += 1;
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return { linked, skipped, conflicts, moved };
}

export async function consolidateTransfermarktCopaLibertadoresIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-copa-libertadores-historical-goals',
    'transfermarkt:copa-libertadores:'
  );
}

export async function consolidateTransfermarktCopaSudamericanaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-copa-sudamericana-historical-goals',
    'transfermarkt:copa-sudamericana:'
  );
}

export async function consolidateTransfermarktUefaEuropaLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-uefa-cup-europa-league-historical-goals',
    'transfermarkt:uefa-cup-europa-league:'
  );
}

export async function consolidateTransfermarktEuropeanCupChampionsLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-european-cup-champions-league-historical-goals',
    'transfermarkt:european-cup-champions-league:'
  );
}

export async function consolidateTransfermarktClubWorldCupIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-fifa-club-world-cup-historical-goals',
    'transfermarkt:club-world-cup:'
  );
}

export async function consolidateTransfermarktCopaAmericaIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-copa-america-historical-goals',
    'transfermarkt:copa-america:'
  );
}

export async function consolidateTransfermarktNationsLeagueIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-nations-league-historical-goals',
    'transfermarkt:nations-league:'
  );
}

export async function consolidateTransfermarktWorldCupIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  // The World Cup catalogue has no single preferred destination provider.
  // Link only when exact normalized name + exact birth date resolve to one
  // canonical person across the rest of the player catalogue.
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-world-cup-historical-goals',
    'transfermarkt:world-cup:',
    null
  );
}

export async function consolidateTransfermarktLaLigaAssistsIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-la-liga-assists',
    'transfermarkt:la-liga:'
  );
}

export async function consolidateTransfermarktBundesligaAssistsIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-bundesliga-assists',
    'transfermarkt:bundesliga:'
  );
}

export async function consolidateTransfermarktSerieAAssistsIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-serie-a-assists',
    'transfermarkt:serie-a:'
  );
}

export async function consolidateTransfermarktLigue1AssistsIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-ligue-1-assists',
    'transfermarkt:ligue-1:'
  );
}

export async function consolidateTransfermarktPrimeiraLigaAssistsIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  return consolidateTransfermarktCompetitionIdentities(
    client,
    'transfermarkt-primeira-liga-assists',
    'transfermarkt:primeira-liga:'
  );
}

/**
 * A BDFutbol page identifier is shared when the same player is imported from
 * more than one league.  Merge only exact page IDs; names and surnames are
 * deliberately not used here.
 */
export async function consolidateBdfutbolSharedPlayerIdentities(client: PoolClient): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  moved: IdentityMoveCounts;
}> {
  const sourceKeys = [
    'bdfutbol-la-liga-record-scorers',
    'bdfutbol-la-liga-records',
    'bdfutbol-premier-league-records',
    'bdfutbol-bundesliga-records',
    'bdfutbol-serie-a-records',
    'bdfutbol-ligue-1-records',
    'bdfutbol-primeira-liga-records'
  ];
  const linkSourceKey = 'bdfutbol-shared-player-identifiers';
  await client.query(
    `INSERT INTO sources (key, name, source_type, base_url, usage_notes, rights_status)
     VALUES ($1, 'BDFutbol shared player identifiers', 'reference', 'https://www.bdfutbol.com/', $2, 'review_required')
     ON CONFLICT (key) DO NOTHING`,
    [linkSourceKey, 'Identity evidence only: exact BDFutbol page identifier shared across league imports; not a media licence.']
  );
  const rows = await client.query<{ id: string; source_key: string; external_id: string }>(
    `SELECT DISTINCT e.id, x.source_key, x.external_id
     FROM entities e
     JOIN entity_external_ids x ON x.entity_id = e.id
     WHERE e.entity_type = 'player' AND x.source_key = ANY($1::text[])
     ORDER BY e.id, x.source_key, x.external_id`,
    [sourceKeys]
  );
  const groups = new Map<string, Map<string, Set<string>>>();
  const sourcePriority = new Map(sourceKeys.map((sourceKey, index) => [sourceKey, index]));
  for (const row of rows.rows) {
    const match = row.external_id.match(/\/j\/(j\d+)\.html(?:$|[?#])/iu);
    if (!match) continue;
    const stableId = match[1];
    if (!stableId) continue;
    const byEntity = groups.get(stableId) ?? new Map<string, Set<string>>();
    const entitySources = byEntity.get(row.id) ?? new Set<string>();
    entitySources.add(row.source_key);
    byEntity.set(row.id, entitySources);
    groups.set(stableId, byEntity);
  }
  const moved = emptyMoveCounts();
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;
  for (const byEntity of groups.values()) {
    if (byEntity.size < 2) continue;
    const entityIds = [...byEntity.keys()];
    const resolvedIds = new Map<string, string>();
    for (const entityId of entityIds) resolvedIds.set(entityId, await resolveCanonicalEntityId(client, entityId));
    const outsideTargets = [...new Set(resolvedIds.values())].filter((id) => !byEntity.has(id));
    if (outsideTargets.length > 1) {
      skipped += byEntity.size;
      continue;
    }
    const target = outsideTargets[0] ?? [...entityIds].sort((left, right) => {
      const leftPriority = Math.min(...[...(byEntity.get(left) ?? [])].map((key) => sourcePriority.get(key) ?? 99));
      const rightPriority = Math.min(...[...(byEntity.get(right) ?? [])].map((key) => sourcePriority.get(key) ?? 99));
      return leftPriority - rightPriority || left.localeCompare(right);
    })[0];
    if (!target) {
      skipped += byEntity.size;
      continue;
    }
    for (const sourceEntityId of entityIds) {
      const resolvedSource = resolvedIds.get(sourceEntityId);
      if (!resolvedSource || resolvedSource === target || resolvedSource !== sourceEntityId) {
        skipped += 1;
        continue;
      }
      await client.query('SAVEPOINT bdfutbol_shared_player_identity');
      try {
        await recordIdentityLink(
          client,
          sourceEntityId,
          target,
          linkSourceKey,
          'Mismo identificador exacto de ficha BDFutbol compartido por importaciones de ligas distintas'
        );
        addMoveCounts(moved, await moveEntityDataToCanonical(client, sourceEntityId, target));
        await client.query('RELEASE SAVEPOINT bdfutbol_shared_player_identity');
        linked += 1;
      } catch {
        await client.query('ROLLBACK TO SAVEPOINT bdfutbol_shared_player_identity');
        await client.query('RELEASE SAVEPOINT bdfutbol_shared_player_identity');
        conflicts += 1;
        skipped += 1;
      }
    }
  }
  return { linked, skipped, conflicts, moved };
}
