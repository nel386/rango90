import { createHash } from 'node:crypto';

/**
 * Transcription of the table published by IFFHS.  The source page is a
 * historical, closed table (1987-2022), so it is intentionally represented
 * as a versioned dataset rather than fetched as mutable current statistics.
 * The source rank and points are both retained because the published table
 * contains tied ranks and one visible ordering anomaly (Preud'homme's points
 * are higher than the preceding displayed row).
 */
export const iffhsGoalkeeperSourceUrl =
  'https://iffhs.com/en/news/iffhs-mens-all-time-world-best-goalkeeper-ranking-1987-2022-2597';

export type IffhsGoalkeeperEntry = {
  sourceRank: number;
  displayedRank: number;
  name: string;
  country: string;
  points: number;
  externalId: string;
};

const rawRows: Array<[number, string, string, number]> = [
  [1, 'Gianluigi Buffon', 'Italy', 357],
  [2, 'Iker Casillas', 'Spain', 260],
  [3, 'Manuel Neuer', 'Germany', 219],
  [4, 'Petr Cech', 'Czech Republic', 218],
  [5, 'Edwin van der Sar', 'Netherlands', 201],
  [6, 'Peter Schmeichel', 'Denmark', 179],
  [7, 'Oliver Kahn', 'Germany', 162],
  [8, 'Thibaut Courtois', 'Belgium', 150],
  [9, 'Jose Luis Felix Chilavert', 'Paraguay', 146],
  [10, 'Walter Zenga', 'Italy', 132],
  [11, 'Andoni Zubizarreta', 'Spain', 132],
  [12, 'Claudio Taffarel', 'Brazil', 130],
  [13, 'Hugo Lloris', 'France', 112],
  [14, 'Michel Preud’homme', 'Belgium', 124],
  [15, 'Fabien Barthez', 'France', 115],
  [15, 'Jan Oblak', 'Slovenia', 115],
  [17, 'David Seaman', 'England', 114],
  [18, 'Victor Valdes', 'Spain', 113],
  [19, 'Nelson de Jesus e Silva Dida', 'Brazil', 109],
  [20, 'Vitor Manuel Martins Baia', 'Portugal', 94],
  [21, 'Keylor Navas', 'Costa Rica', 93],
  [22, 'Gianluca Pagliuca', 'Italy', 90],
  [23, 'Francesco Toldo', 'Italy', 82],
  [24, 'Jens Lehmann', 'Germany', 81],
  [25, 'Andre ter Stegen', 'Germany', 78],
  [25, 'Alisson Becker', 'Brazil', 78],
  [27, 'Julio Cesar Soares', 'Brazil', 76],
  [28, 'David de Gea', 'Spain', 75],
  [29, 'Bodo Illgner', 'Germany', 71],
  [29, 'Johannes van Breukelen', 'Netherlands', 71],
  [31, 'Roberto Carlos Abbondanzieri', 'Argentina', 68],
  [32, 'Sergio Goycochea', 'Argentina', 66],
  [33, 'Andreas Köpke', 'Germany', 64],
  [34, 'Jorge Campos', 'Mexico', 62],
  [34, 'Peter Shilton', 'England', 62],
  [36, 'Thomas Ravelli', 'Sweden', 61],
  [37, 'Rinat Dasaev', 'Russia', 57],
  [38, 'Angelo Peruzzi', 'Italy', 56],
  [38, 'Neville Southall', 'Wales', 56],
  [40, 'Jose Manuel Reina', 'Spain', 54],
  [41, 'Rogerio Ceni', 'Brazil', 53],
  [42, 'Jose Santiago Canizares', 'Spain', 51],
  [42, 'Claudio Bravo', 'Chile', 51],
  [44, 'Jean Marie Pfaff', 'Belgium', 49],
  [44, 'Samir Handanovic', 'Slovenia', 49],
  [46, 'Jerzy Dudek', 'Poland', 48],
  [47, 'Igor Akinfeev', 'Russia', 47],
  [48, 'Oscar Eduardo Cordoba', 'Colombia', 38],
  [48, 'Bernard Lama', 'France', 38],
  [48, 'Francisco Guillermo Ochoa', 'Mexico', 38]
];

const rows: IffhsGoalkeeperEntry[] = rawRows.map(([displayedRank, name, country, points], index) => ({
  sourceRank: index + 1,
  displayedRank,
  name,
  country,
  points,
  externalId: `iffhs-goalkeeper:${createHash('sha256').update(name.toLocaleLowerCase('en-US')).digest('hex').slice(0, 24)}`
}));

export function fetchIffhsGoalkeeperRanking(): {
  sourceUrl: string;
  sourcePublishedAt: string;
  retrievedAt: string;
  entries: IffhsGoalkeeperEntry[];
} {
  return {
    sourceUrl: iffhsGoalkeeperSourceUrl,
    sourcePublishedAt: '2023-03-05',
    retrievedAt: new Date().toISOString(),
    entries: rows.map((row) => ({ ...row }))
  };
}
