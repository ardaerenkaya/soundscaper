import { SoundProvider } from './SoundProvider.js';

const API_KEY = 'vwH8153wxdeMUWKpUM3DPvL91NcF51v5Rhi2wmE7';
const API_BASE = 'https://freesound.org/apiv2';

function scoreRelevance(sound, queryTerms) {
  if (!queryTerms?.length) return 0;
  const name = (sound.name || '').toLowerCase();
  const tags = (sound.tags || []).map(t => String(t).toLowerCase());
  const tagsJoined = tags.join(' ');
  let score = 0;
  let matched = 0;
  const significantTerms = queryTerms.filter(t => t.length > 2);

  for (const term of significantTerms) {
    if (tags.includes(term)) { score += 25; matched++; }
    else if (tagsJoined.includes(term)) { score += 14; matched++; }
    else if (name.includes(term)) { score += 10; matched++; }
  }

  if (significantTerms.length > 0 && matched === significantTerms.length) {
    score += 30;
  }

  const primary = significantTerms[0];
  if (primary) {
    const foundAnywhere = tags.includes(primary) || tagsJoined.includes(primary) || name.includes(primary);
    if (!foundAnywhere) { score -= 35; }
  }

  if (sound.duration > 10) score += 3;
  if (sound.duration > 30) score += 2;

  return score;
}

function parseFreesoundResult(s, sourceProvider = 'Freesound') {
  return {
    id: s.id,
    title: s.name || 'Untitled',
    author: s.username || 'Unknown',
    duration: Math.round(s.duration || 0),
    // Retain actual license URL instead of hardcoding CC0
    license: s.license || 'Unknown',
    previewUrl: s.previews?.['preview-hq-mp3'] ||
                s.previews?.['preview-hq-ogg'] ||
                s.previews?.['preview-lq-mp3'] || null,
    tags: s.tags || [],
    url: s.url || `https://freesound.org/people/${s.username}/sounds/${s.id}/`,
    source: sourceProvider,
  };
}

export class FreesoundProvider extends SoundProvider {
  constructor() {
    super();
    this.cache = new Map();
  }
  
  async search(queryKeywords, options = {}) {
    const maxResults = options.maxResults || 6;
    if (!queryKeywords?.trim()) return [];

    const trimmed = queryKeywords.trim();
    const terms = trimmed.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    const cacheKey = `search_${trimmed}_${maxResults}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const params = new URLSearchParams({
      query: trimmed,
      token: API_KEY,
      filter: 'license:"Creative Commons 0" duration:[0.5 TO 300.0]',
      fields: 'id,name,previews,username,license,duration,tags,url',
      page_size: String(Math.max(maxResults * 3, 18)),
      sort: 'score',
    });

    const url = `${API_BASE}/search/text/?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      if (!data.results?.length) {
        if (terms.length > 2) return this.search(terms.slice(0, 2).join(' '), options);
        if (terms.length > 1) return this.search(terms[0], options);
        return [];
      }

      const results = data.results
        .map(s => {
          const parsed = parseFreesoundResult(s, 'Freesound');
          return { ...parsed, _score: scoreRelevance(s, terms) };
        })
        .filter(s => s.previewUrl)
        .sort((a, b) => b._score - a._score)
        .slice(0, maxResults)
        .map(({ _score, ...rest }) => rest);

      this.cache.set(cacheKey, results);
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      return results;

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') console.warn(`[Freesound] Timeout: "${queryKeywords}"`);
      else console.error(`[Freesound] Error: "${queryKeywords}"`, err);

      if (terms.length > 1) {
        try { return await this.search(terms[0], options); } catch { return []; }
      }
      return [];
    }
  }

  async getSimilar(soundId, options = {}) {
    const maxResults = options.maxResults || 6;
    
    // We enforce CC0 filter on similar searches as well to maintain compliance
    const params = new URLSearchParams({
      token: API_KEY,
      filter: 'license:"Creative Commons 0"',
      fields: 'id,name,previews,username,license,duration,tags,url',
      page_size: String(maxResults * 2), // fetch extra just in case some lack previews
    });

    const url = `${API_BASE}/sounds/${soundId}/similar/?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      
      if (!data.results?.length) return [];
      
      return data.results
        .map(s => parseFreesoundResult(s, 'Freesound (Similar)'))
        .filter(s => s.previewUrl)
        .slice(0, maxResults);
        
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[Freesound] Similar error for ID ${soundId}:`, err);
      return [];
    }
  }
}
