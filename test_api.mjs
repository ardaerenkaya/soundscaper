const API_KEY = 'vwH8153wxdeMUWKpUM3DPvL91NcF51v5Rhi2wmE7';

async function test() {
  console.log("Testing search...");
  const searchUrl = `https://freesound.org/apiv2/search/text/?query=dog&token=${API_KEY}`;
  const searchRes = await (await fetch(searchUrl)).json();
  console.log("Search results count:", searchRes.count);
  if (!searchRes.results || searchRes.results.length === 0) return;
  
  const soundId = searchRes.results[0].id;
  console.log("Found sound ID:", soundId);
  
  console.log("Testing similar...");
  // Let's see if similar supports license filter
  const similarUrl = `https://freesound.org/apiv2/sounds/${soundId}/similar/?token=${API_KEY}&filter=license:"Creative Commons 0"&fields=id,name,previews,username,license,duration,tags,url`;
  const similarRes = await (await fetch(similarUrl)).json();
  console.log("Similar count:", similarRes.count);
  
  if (similarRes.results && similarRes.results.length > 0) {
    console.log("First similar sound:", similarRes.results[0].name, "| License:", similarRes.results[0].license);
  } else {
    console.log("No similar sounds found with CC0 filter. Trying without filter...");
    const simUrl2 = `https://freesound.org/apiv2/sounds/${soundId}/similar/?token=${API_KEY}&fields=id,name,previews,username,license,duration,tags,url`;
    const simRes2 = await (await fetch(simUrl2)).json();
    console.log("Similar without filter count:", simRes2.count);
    if (simRes2.results && simRes2.results.length > 0) {
      console.log("First similar sound:", simRes2.results[0].name, "| License:", simRes2.results[0].license);
    }
  }
}

test().catch(console.error);
