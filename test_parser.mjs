import { parseSoundscapePrompt } from './src/services/promptParser.js';

const tests = [
  'room tone for hospital',
  'a laundromat at one in the morning, a machine stops and someone coughs',
  'heavy rain, walking on grass, man coughing',
  'cozy cafe, coffee machine, soft chatter, rain outside',
  'subway station, approaching train, footsteps on concrete, dripping water',
];

for (const t of tests) {
  console.log(`\n=== "${t}" ===`);
  const layers = parseSoundscapePrompt(t);
  for (const l of layers) {
    console.log(`  [${l.category}] ${l.title}  =>  search: "${l.searchKeywords}"`);
  }
}
