import assert from 'node:assert/strict';
import { parseTacaPortugalClubTitles } from '../providers/tacaPortugalTitlesClient.js';

const names = [
  'SCU Torreense', 'FC Porto', 'Sporting CP', 'SC Braga', 'CD Aves', 'SL Benfica',
  'Vitória SC', 'Académica', 'Vitória FC', 'Boavista FC', 'CF Estrela da Amadora',
  'CF Belenenses', 'SC Beira-Mar', 'Leixões SC', 'Carcavelinhos FC', 'CS Marítimo', 'SC Olhanense'
];
const rows = Array.from({ length: 103 }, (_, index) => `${2025 - index}/${2026 - index} ${names[index % names.length]}`).join('\n');
const parsed = parseTacaPortugalClubTitles(`### **Taça de Portugal**\n${rows}\n###### Os Nossos Parceiros`);

assert.equal(parsed.length, 103);
assert.equal(new Set(parsed.map((row) => row.season)).size, 103);
assert.deepEqual(new Set(parsed.map((row) => row.name)), new Set(names));
console.log('taca portugal titles tests passed');
