/**
 * Prompt Parser — Intelligent Acoustic Scene Decomposition
 *
 * Designed like https://fmffmf.studio/machines:
 * - Natural language scene → array of concrete sound layers
 * - Preserves modifiers and context (e.g. "room tone for hospital" → "hospital room tone")
 * - Detects surface combos (e.g. "walking on grass" → "footsteps grass")
 * - Smart event detection for sporadic sounds (cough, drip, thunder)
 */

// Filler words to strip (articles, prepositions, pronouns, temporal noise)
const FILLER = /\b(a|an|the|in the middle of|in the|at the|on the|at|for|with|some|someone|something|somewhere|one in the morning|early morning|late at night|at night|in a|for a|during|while|like|from|of|its|it's|there is|there are|you can hear|you hear|sounds of)\b/gi;

// Event-type sounds that are sporadic (not continuous ambience)
const EVENT_WORDS = new Set([
  'cough', 'coughing', 'sneeze', 'sneezing', 'drip', 'dripping',
  'thunder', 'thunderclap', 'lightning', 'slam', 'door slam',
  'shatter', 'bell', 'chime', 'ticking', 'alarm',
  'honk', 'horn', 'car horn', 'siren', 'whistle', 'whistling',
  'bark', 'barking', 'meow', 'chirp', 'chirping',
  'gasp', 'sigh', 'yawn', 'scream', 'shout',
  'explosion', 'boom', 'blast', 'gunshot',
  'beep', 'ringtone', 'notification',
  'laugh', 'laughing', 'giggle', 'applause', 'clap',
  'splash', 'thud', 'crash', 'bump', 'knock', 'knocking',
  'snap', 'crack', 'pop', 'stop', 'stops', 'start', 'starts',
  'phone ring', 'doorbell',
]);

// Action/movement sounds
const ACTION_WORDS = new Set([
  'walk', 'walking', 'footsteps', 'steps', 'run', 'running', 'jogging',
  'typing', 'keyboard', 'clicking', 'mouse click',
  'rustling', 'scraping', 'scratching',
  'chewing', 'eating', 'munching', 'drinking', 'sipping',
  'swimming', 'splashing', 'paddling',
  'page turning', 'flipping pages',
  'writing', 'pencil writing',
  'stirring', 'mixing', 'sweeping', 'mopping', 'cleaning',
  'chopping', 'cutting', 'slicing',
  'driving', 'cycling',
]);

let _idSeq = 0;
function generateId() {
  return `layer_${Date.now()}_${(++_idSeq).toString(36)}`;
}

function cleanPhrase(text) {
  return text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
}

function toTitle(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const w of EVENT_WORDS) {
    if (lower.includes(w)) return 'event';
  }
  for (const w of ACTION_WORDS) {
    if (lower.includes(w)) return 'action';
  }
  return 'field';
}

/**
 * Build optimal Freesound search keywords from a clause.
 * Keeps the core meaning intact instead of appending generic suffixes.
 */
function buildSearchQuery(text, category) {
  let q = text.toLowerCase().trim();

  // Don't append anything if the query already contains descriptive qualifiers
  if (q.includes('ambience') || q.includes('ambient') ||
      q.includes('sound') || q.includes('noise') ||
      q.includes('room tone') || q.includes('sfx') ||
      q.includes('effect') || q.includes('field recording')) {
    return q;
  }

  // For events, don't append "ambience"
  if (category === 'event') return q;

  // For actions, keep as-is (e.g. "footsteps gravel" is already great)
  if (category === 'action') return q;

  // For field/ambience, only append "ambience" if the query is very short (1-2 words)
  const wordCount = q.split(/\s+/).length;
  if (wordCount <= 2) {
    return `${q} ambience`;
  }
  return q;
}

/**
 * Decomposes a natural language scene description into sound layers.
 * @param {string} prompt
 * @returns {Array<Object>} layers
 */
export function parseSoundscapePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return [];

  const raw = prompt.trim();

  // Split on commas, semicolons, periods, newlines, and certain conjunctions
  const rawClauses = raw
    .split(/[,;\.\n]+|\b(?:and then|then|and)\b/gi)
    .map(c => c.trim())
    .filter(c => c.length > 1 && !/^(and|then|as|where)$/i.test(c));

  // If no splitting happened, treat the whole thing as one clause
  if (rawClauses.length === 0) {
    rawClauses.push(raw);
  }

  const layers = [];
  const seenQueries = new Set();

  for (let clause of rawClauses) {
    if (!clause || clause.length < 2) continue;

    // Handle "X for Y" → "Y X" (e.g. "room tone for hospital" → "hospital room tone")
    const forMatch = clause.match(/^(.+?)\s+for\s+(.+)$/i);
    if (forMatch) {
      clause = `${forMatch[2].trim()} ${forMatch[1].trim()}`;
    }

    // Handle "X in Y" → "Y X" (e.g. "footsteps in snow" → "footsteps snow")
    const inMatch = clause.match(/^(.+?)\s+(?:in|on|at|inside)\s+(?:the\s+|a\s+)?(.+)$/i);
    if (inMatch) {
      const part1 = inMatch[1].trim();
      const part2 = inMatch[2].trim();
      // Only rearrange if part1 is a known action/event word
      const p1Lower = part1.toLowerCase();
      if (ACTION_WORDS.has(p1Lower) || EVENT_WORDS.has(p1Lower)) {
        clause = `${part1} ${part2}`;
      }
    }

    const cleaned = cleanPhrase(clause);
    if (!cleaned || cleaned.length < 2) continue;

    const lower = cleaned.toLowerCase();
    if (seenQueries.has(lower)) continue;
    seenQueries.add(lower);

    const category = detectCategory(lower);
    const isEvent = category === 'event';
    const searchKeywords = buildSearchQuery(lower, category);

    layers.push({
      id: generateId(),
      category,
      title: toTitle(cleaned),
      query: lower,
      searchKeywords,
      vol: isEvent ? -3 : -6,
      pan: 0,
      filterFreq: 20000,
      pitch: 1.0,
      transform: 0,
      isEvent,
      mute: false,
      solo: false,
    });
  }

  // Fallback: use entire prompt as a single layer
  if (layers.length === 0) {
    const fallback = cleanPhrase(raw) || raw;
    layers.push({
      id: generateId(),
      category: 'field',
      title: toTitle(fallback),
      query: fallback.toLowerCase(),
      searchKeywords: buildSearchQuery(fallback, 'field'),
      vol: -6, pan: 0, filterFreq: 20000, pitch: 1.0, transform: 0,
      isEvent: false, mute: false, solo: false,
    });
  }

  return layers;
}
