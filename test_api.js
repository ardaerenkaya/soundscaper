const https = require('https');

const API_KEY = 'vwH8153wxdeMUWKpUM3DPvL91NcF51v5Rhi2wmE7';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function test() {
  console.log("Testing search...");
  const searchUrl = `https://freesound.org/apiv2/search/text/?query=dog&token=${API_KEY}`;
  const searchRes = await fetchUrl(searchUrl);
  console.log("Search results count:", searchRes.count);
  if (!searchRes.results || searchRes.results.length === 0) return;
  
  const soundId = searchRes.results[0].id;
  console.log("Found sound ID:", soundId);
  
  console.log("Testing similar...");
  // Let's add license filter to similar if possible, or just see what it returns
  // The similar endpoint: /apiv2/sounds/<id>/similar/
  const similarUrl = `https://freesound.org/apiv2/sounds/${soundId}/similar/?token=${API_KEY}`;
  const similarRes = await fetchUrl(similarUrl);
  console.log("Similar returned:", similarRes.detail || similarRes.count);
  
  if (similarRes.results) {
    console.log("First similar sound:", similarRes.results[0]);
  }
}

test();
