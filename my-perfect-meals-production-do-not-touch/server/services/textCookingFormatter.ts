export function injectQuantitiesIntoSteps({ steps, ingredients }:{ steps:string[]; ingredients:{item:string; amount:string}[] }){
  if (!Array.isArray(steps) || !Array.isArray(ingredients)) return steps || [];
  const dict = new Map(ingredients.map(i => [normalize(i.item), i.amount]));
  return steps.map(s => {
    let out = s;
    for (const [name, amt] of dict.entries()){
      if (!name || typeof name !== 'string') continue;
      try {
        const escapedName = escapeRegex(name);
        const rx = new RegExp("\\b" + escapedName + "\\b(?!\\s*\\()", "gi");
        if (rx.test(out)){
          out = out.replace(rx, (m) => `${m} (${amt})`);
        }
      } catch (regexError) {
        console.warn(`Skipping ingredient "${name}" due to regex error:`, regexError);
        continue;
      }
    }
    return out;
  });
}

function normalize(s:string){ 
  if (typeof s !== 'string') return '';
  return s.trim().toLowerCase(); 
}

function escapeRegex(s:string){ 
  if (typeof s !== 'string') return '';
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); 
}