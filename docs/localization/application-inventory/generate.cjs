/* Offline, one-shot inventory evidence generator. Not an application check.
 * Run from the workspace root. Writes report evidence and an ignored raw appendix.
 * Never imports application code, starts a server, or accesses accounts/providers.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ts = require("typescript");
const vm = require("vm");
const esbuild = require("esbuild");
const out = "docs/localization/application-inventory";
fs.mkdirSync(out, { recursive: true });
const rawOut = "generated-artifacts/application-localization-inventory";
fs.mkdirSync(rawOut, { recursive: true });
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (["__tests__", "node_modules", "dist", ".generated", "legacy"].includes(e.name) ? [] : walk(`${dir}/${e.name}`)) :
  /\.(ts|tsx)$/.test(e.name) && !/\.(test|spec|d)\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
const files = walk("client/src").sort();
const sources = new Map(files.map(f => [f, fs.readFileSync(f, "utf8")]));
const asts = new Map([...sources].map(([f,s]) => [f, ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,f.endsWith("tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS)]));
const line = (ast,n) => ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
const literal = n => n && (ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;
function visit(n, fn) { fn(n); ts.forEachChild(n, c => visit(c, fn)); }
function resolve(from, p) {
  const base = p.startsWith("@/") ? `client/src/${p.slice(2)}` : p.startsWith("@shared/") ? `shared/${p.slice(8)}` : p.startsWith(".") ? path.posix.normalize(`${path.posix.dirname(from)}/${p}`) : null;
  return base && ["", ".tsx", ".ts", "/index.tsx", "/index.ts"].map(x=>base+x).find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
}
// Evaluate only the three pure resource modules in an allowlisted, isolated VM.
const resourceModules = new Set(["client/src/i18n/consumerJourney.ts", "client/src/i18n/approvedConsumerOnboarding.ts", "shared/consumerStartupCopy.ts"]);
const resourceCache = {};
function resource(f) {
  if (!resourceModules.has(f)) throw Error(`Refusing non-resource module: ${f}`);
  if (resourceCache[f]) return resourceCache[f];
  const module = {exports:{}};
  vm.runInNewContext(esbuild.transformSync(fs.readFileSync(f,"utf8"), {loader:"ts",format:"cjs"}).code,
    {module, exports:module.exports, require:p=>resource(resolve(f,p))}, {filename:f,timeout:2000});
  return resourceCache[f] = module.exports;
}
const {consumerEnglish, consumerSpanish} = resource("client/src/i18n/consumerJourney.ts");
const en = JSON.parse(fs.readFileSync("client/src/i18n/locales/en.json","utf8"));
const es = JSON.parse(fs.readFileSync("client/src/i18n/locales/es.json","utf8"));
const i18next = require("i18next").createInstance();
i18next.init({initImmediate:false,resources:{en:{...en,translation:en,consumerJourney:consumerEnglish},es:{...es,translation:es,consumerJourney:consumerSpanish}},lng:"es",fallbackLng:"en",interpolation:{escapeValue:false}});
function lookup(lang, ns, key, phrase = false) {
  const val = i18next.getResource(lang, ns, key, phrase ? {keySeparator:false}:undefined);
  return typeof val === "string" ? val : null;
}
const graph = new Map(), reverse = new Map(), symbols = new Map(), routes = [];
for (const [f,ast] of asts) {
  const deps = new Set(), imports = new Map(), declarations = new Map();
  for (const st of ast.statements) {
    if(ts.isImportDeclaration(st)&&literal(st.moduleSpecifier)){
      const target = resolve(f,st.moduleSpecifier.text);
      if(target) deps.add(target);
      if(target&&st.importClause){
        if(st.importClause.name) imports.set(st.importClause.name.text,target);
        const b=st.importClause.namedBindings;
        if(b&&ts.isNamedImports(b)) for(const el of b.elements) imports.set(el.name.text,target);
      }
    }
    if(ts.isVariableStatement(st)) for(const d of st.declarationList.declarations) if(ts.isIdentifier(d.name)&&d.initializer) declarations.set(d.name.text,d.initializer);
    if(ts.isFunctionDeclaration(st)&&st.name) declarations.set(st.name.text,st);
  }
  visit(ast,n=>{
    if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&literal(n.arguments[0])){
      const target = resolve(f,literal(n.arguments[0])); if(target)deps.add(target);
    }
  });
  graph.set(f,[...deps]);
  symbols.set(f,{imports,declarations});
  for(const d of deps){if(!reverse.has(d))reverse.set(d,[]);reverse.get(d).push(f);}
}
function expressionOwners(f,n,seen=new Set(),depth=0){
  if(!n||depth>14)return [];
  const {imports,declarations}=symbols.get(f);
  const result=new Set();
  function addName(name) {
    if(imports.has(name))result.add(imports.get(name));
    else if(declarations.has(name)&&!seen.has(name)){
      seen.add(name);
      for(const p of expressionOwners(f,declarations.get(name),seen,depth+1))result.add(p);
    }
  }
  if(ts.isIdentifier(n))addName(n.text);
  if(ts.isConditionalExpression(n)){
    for(const branch of [n.whenTrue,n.whenFalse])for(const p of expressionOwners(f,branch,seen,depth+1))result.add(p);
  }
  visit(n,c=>{
    if(ts.isJsxOpeningElement(c)||ts.isJsxSelfClosingElement(c))addName(c.tagName.getText());
    if(ts.isJsxAttribute(c)&&c.name.getText()==="component"&&c.initializer&&ts.isJsxExpression(c.initializer)&&c.initializer.expression){
      const e=c.initializer.expression;
      if(ts.isIdentifier(e))addName(e.text); else for(const p of expressionOwners(f,e,seen,depth+1)) result.add(p);
    }
    if(ts.isCallExpression(c)){
      if(c.expression.kind===ts.SyntaxKind.ImportKeyword&&literal(c.arguments[0])){
        const p=resolve(f,literal(c.arguments[0]));if(p)result.add(p);
      } else for(const a of c.arguments) if(ts.isIdentifier(a))addName(a.text);
    }
    if(ts.isConditionalExpression(c))for(const branch of [c.whenTrue,c.whenFalse]){
      if(ts.isIdentifier(branch))addName(branch.text);
    }
  });
  return [...result].sort();
}
function context(ast,n){
  const contexts=[];
  for(let p=n.parent;p&&contexts.length<5;p=p.parent){
    if(ts.isConditionalExpression(p)) contexts.push(`conditional: ${p.condition.getText(ast).slice(0,150)}`);
    else if(ts.isBinaryExpression(p)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind))contexts.push(`branch: ${p.left.getText(ast).slice(0,150)}`);
    else if(ts.isIfStatement(p))contexts.push(`if: ${p.expression.getText(ast).slice(0,150)}`);
    else if(ts.isFunctionDeclaration(p)&&p.name)contexts.push(`function: ${p.name.text}`);
    else if(ts.isVariableDeclaration(p)&&ts.isIdentifier(p.name))contexts.push(`owner: ${p.name.text}`);
    else if(ts.isJsxElement(p)) {const name=p.openingElement.tagName.getText(); if(/Dialog|Modal|Sheet|Tooltip|Menu|Toast|Alert|Suspense/i.test(name)) contexts.push(`surface: ${name}`);}
  }
  return contexts.join(" | ")||"render/source context; inspect surrounding branch";
}
for(const [f,ast] of asts)visit(ast,n=>{
  if(!(ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))||!/(^|\\.)Route$/.test(n.tagName.getText()))return;
  const pa=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText()==="path");
  const cp=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText()==="component");
  const value=pa?.initializer;
  const route=literal(value)||(value&&ts.isJsxExpression(value)?literal(value.expression):null);
  const container=ts.isJsxOpeningElement(n)?n.parent:n;
  const expr=cp?.initializer&&ts.isJsxExpression(cp.initializer)?cp.initializer.expression:container;
  routes.push({registration:`${f}:${line(ast,n)}`,route:route||"(pathless/dynamic)",component:expr?.getText(ast).slice(0,220)||"",owners:expressionOwners(f,expr),gateEvidence:context(ast,n),runtime:"Not exercised; source registration does not establish access or activation"});
});
const stop = new Set(["client/src/components/Router.tsx","client/src/components/AppRouter.tsx","client/src/App.tsx"]);
function reachable(roots){
  const seen=new Set(), stack=[...roots];
  while(stack.length){
    const p=stack.pop();if(seen.has(p)||stop.has(p))continue;seen.add(p);
    for(const d of graph.get(p)||[])stack.push(d);
  }
  return seen;
}
for(const r of routes)r.dependencies=reachable(r.owners);
const labels=["save","cancel","back","next","continue","done","close","submit","loading","error","tryAgain","confirm","delete","edit","add","remove","search","filter","apply","reset","yes","no","share"];
const sharedLabels = new Map(labels.map(k=>[en.common[k],`common.${k}`]));
const candidates=new Map(),keys=[],owners=[],signals=[];
function routeRefs(f){return routes.filter(r=>r.dependencies.has(f)).map(r=>r.route).filter((v,i,a)=>a.indexOf(v)===i);}
for(const [f,ast] of asts){
  if(f.includes("/i18n/"))continue;
  const s=sources.get(f), namespaces=[];
  const consumerAliases=new Set(["useConsumerCopy"]);
  for(const st of ast.statements)if(ts.isImportDeclaration(st)&&literal(st.moduleSpecifier)?.includes("useConsumerCopy")){
    const bindings=st.importClause?.namedBindings;
    if(bindings&&ts.isNamedImports(bindings))for(const el of bindings.elements)if((el.propertyName||el.name).text==="useConsumerCopy")consumerAliases.add(el.name.text);
  }
  visit(ast,n=>{if(ts.isCallExpression(n)&&(/^(useTranslation|useConsumerCopy)$/.test(n.expression.getText(ast))||consumerAliases.has(n.expression.getText(ast))))namespaces.push({consumer:consumerAliases.has(n.expression.getText(ast)),ns:literal(n.arguments[0])||"translation"});});
  const add=(n,text,kind,parentTag="")=>{
    text=text.replace(/\s+/g," ").trim();if(!/[A-Za-z]{2}/.test(text)||text.length>1800)return;
    const id=crypto.createHash("sha256").update(`${f}\0${kind}\0${text}`).digest("hex").slice(0,14);
    if(candidates.has(id)){candidates.get(id).lines.push(line(ast,n));return;}
    const standard = /^(Button|AlertDialogAction|AlertDialogCancel|ToastAction|ToastTitle|ToastDescription)$/.test(parentTag)&&sharedLabels.has(text);
    candidates.set(id,{id,owner:f,lines:[line(ast,n)],kind,text,parentTag,context:context(ast,n),classification:standard?"shared-label-connection; verify exact child shape":"scanner-candidate; visibility/meaning unverified",namespace:standard?"translation":null,key:standard?sharedLabels.get(text):null,en:standard?lookup("en","translation",sharedLabels.get(text)):null,es:standard?lookup("es","translation",sharedLabels.get(text)):null,sharedCallers:reverse.get(f)||[],routes:routeRefs(f)});
  };
  visit(ast,n=>{
    if(ts.isJsxText(n))add(n,n.getText(ast),"jsx-text",n.parent?.openingElement?.tagName.getText()||"");
    if(ts.isJsxAttribute(n)&&n.initializer){
      const name=n.name.getText();
      if(/^(title|placeholder|aria-label|alt|label|description|emptyMessage|loadingText|confirmText|cancelText|tooltip|message)$/.test(name)&&literal(n.initializer))add(n,n.initializer.text,`attribute:${name}`,n.parent?.parent?.tagName?.getText()||"");
    }
    if(ts.isJsxExpression(n)&&literal(n.expression))add(n,n.expression.text,"jsx-expression",n.parent?.openingElement?.tagName.getText()||"");
    if(ts.isPropertyAssignment(n)&&literal(n.initializer)&&/^(title|description|label|message|text|heading|body|placeholder|error|success|emptyMessage)$/.test(n.name.getText(ast).replace(/['"]/g,"")))add(n,n.initializer.text,`config-or-message:${n.name.getText(ast)}`);
    if(ts.isCallExpression(n)&&/^(t|i18n\.t|i18next\.t|copy\.t)$/.test(n.expression.getText(ast))){
      const k=literal(n.arguments[0]), opts=n.arguments[1];
      let explicit=null, hasCount=false, defaultValue=literal(opts);
      if(opts&&ts.isObjectLiteralExpression(opts))for(const p of opts.properties)if(ts.isPropertyAssignment(p)){
        if(p.name.getText()==="ns")explicit=literal(p.initializer);
        if(p.name.getText()==="count")hasCount=true;
        if(p.name.getText()==="defaultValue")defaultValue=literal(p.initializer);
      }
      const cons=namespaces.some(x=>x.consumer)&&k&&Object.hasOwn(consumerEnglish,k);
      const choices=[...new Set(namespaces.map(x=>x.ns))];
      let ns=explicit||(cons?"consumerJourney":choices.length===1?choices[0]:"translation");
      let key=k;
      if(k?.includes(":")&&!cons){[ns,key]=k.split(/:(.*)/s);}
      const enVal=k?lookup("en",ns,key,cons):null, esVal=k?lookup("es",ns,key,cons):null;
      const pluralForms=hasCount&&key?Object.fromEntries(["en","es"].map(l=>[l,Object.fromEntries(["one","other"].map(form=>[form,lookup(l,ns,`${key}_${form}`)]))])):null;
      const pluralsPresent=pluralForms&&Object.values(pluralForms).every(forms=>Object.values(forms).every(v=>v!==null));
      keys.push({owner:f,line:line(ast,n),expression:n.getText(ast).slice(0,300),namespace:ns,key:k,en:enVal,es:esVal,pluralForms,defaultValue,status:!k?"dynamic-key; unresolved":choices.length>1&&!explicit&&!cons?"namespace-needs-review":pluralsPresent?"EN/ES plural forms present":enVal===null||esVal===null?"missing-or-fallback-candidate":"EN/ES values present",context:context(ast,n),routes:routeRefs(f)});
    }
    if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&/Dialog|Modal|Sheet|Tooltip|Menu|Toast|Alert|Suspense/i.test(n.tagName.getText())){
      signals.push({owner:f,line:line(ast,n),surface:n.tagName.getText(),context:context(ast,n),routes:routeRefs(f)});
    }
  });
  const ownCandidates=[...candidates.values()].filter(c=>c.owner===f);
  const ownKeys=keys.filter(c=>c.owner===f);
  const variants=[...new Set((s.match(/\b(?:sm|md|lg|xl):(hidden|flex|block|grid)|\b(?:isDesktop|isMobile|useIsDesktop|useIsMobile|Capacitor|isNative)\b/g)||[]))];
  owners.push({owner:f,sha256:crypto.createHash("sha256").update(s).digest("hex"),directCallers:reverse.get(f)||[],routes:routeRefs(f),candidateRecords:ownCandidates.length,keyCalls:ownKeys.length,variantSignals:variants,stateSignals:[...new Set((s.match(/\b(?:loading|isLoading|pending|isPending|empty|error|success|failed|isOpen|showModal|disabled|denied)\b/g)||[]))],visibility:routeRefs(f).length?"Import-reachable only; branch and authorization unverified":"No route dependency proven; may be global/configuration/unused",namespaceSignals:namespaces});
}
const csv = (name,rows) => {
  const columns=[...new Set(rows.flatMap(Object.keys))];
  const q = v => `"${String(typeof v==="object"&&v!==null?JSON.stringify(v):v??"").replace(/"/g,'""')}"`;
  const directory=name==="text-candidates"?rawOut:out;
  fs.writeFileSync(`${directory}/${name}.csv`,[columns.map(q).join(","),...rows.map(r=>columns.map(k=>q(r[k])).join(","))].join("\n")+"\n");
};
const cleanRoutes=routes.map(({dependencies,...r})=>({...r,importReachableOwners:dependencies.size}));
csv("route-register",cleanRoutes);
csv("text-owner-register",owners);
// Normalize relationships instead of duplicating every route for every string.
csv("text-candidates",[...candidates.values()].map(({routes,sharedCallers,...c})=>({...c,relationshipJoin:"owner -> text-owner-register"})));
csv("translation-connections",keys.map(({routes,...c})=>({...c,relationshipJoin:"owner -> text-owner-register"})));
csv("transient-surfaces",signals.map(({routes,...c})=>({...c,relationshipJoin:"owner -> text-owner-register"})));
csv("route-state-matrix",routes.map(({dependencies,...r})=>{
  const direct=owners.filter(o=>r.owners.includes(o.owner));
  return {...r,rootOwnerStates:direct.map(o=>({owner:o.owner,stateSignals:o.stateSignals,variantSignals:o.variantSignals})),
    transientSourceOccurrences:signals.filter(s=>dependencies.has(s.owner)).map(s=>`${s.owner}:${s.line} ${s.surface}`),
    status:"Static owner/state discovery only; gated and dynamic branches not exercised",
    globalOwnersJoin:"Global shell and notification owners are separately described in inventory.md"};
}));
function flatten(obj,prefix=""){return Object.entries(obj).flatMap(([k,v])=>typeof v==="string"?[[prefix+k,v]]:v&&typeof v==="object"?flatten(v,`${prefix+k}.`):[]);}
const english=flatten(en), spanish=new Map(flatten(es));
const catalog={
 legacyEnglishKeys:english.length,
 legacyEnglishKeysWithSpanish:english.filter(([k])=>spanish.has(k)).length,
 legacyEnglishKeysMissingSpanish:english.filter(([k])=>!spanish.has(k)).map(([k])=>k),
 legacyIdenticalValues:english.filter(([k,v])=>spanish.get(k)===v).map(([key,value])=>({key,value})),
 consumerEnglishKeys:Object.keys(consumerEnglish).length,
 consumerSpanishKeys:Object.keys(consumerSpanish).length,
 consumerMissingSpanish:Object.keys(consumerEnglish).filter(k=>!Object.hasOwn(consumerSpanish,k)),
 consumerEmptySpanish:Object.keys(consumerEnglish).filter(k=>consumerSpanish[k]===""),
};
const approvedReference=JSON.parse(fs.readFileSync(".local/reports/spanish-onboarding-wording-comparison.json","utf8"));
const approvedComparison={
  denominator:approvedReference.rows.length,
  exactEnglishAndSpanishMatches:approvedReference.rows.filter(r=>consumerEnglish[r.english]===r.english&&consumerSpanish[r.english]===r.spanish).length,
  differences:approvedReference.rows.filter(r=>consumerEnglish[r.english]!==r.english||consumerSpanish[r.english]!==r.spanish).map(r=>({number:r.number,englishPresent:consumerEnglish[r.english]===r.english,spanishExact:consumerSpanish[r.english]===r.spanish})),
  limit:"Resource equality only; existing consent behavior evidence is reused, not rerun.",
};
const summary={method:"TypeScript AST import/route discovery and bounded UI syntax scan; not rendered coverage or enforcement",sourceFiles:files.length,routeRegistrations:routes.length,uniqueLiteralRoutePaths:new Set(routes.filter(r=>r.route!=="(pathless/dynamic)").map(r=>r.route)).size,unresolvedRouteOwners:routes.filter(r=>!r.owners.length).map(r=>r.registration),textCandidateRecords:candidates.size,translationCalls:keys.length,translationStatus:keys.reduce((a,k)=>(a[k.status]=(a[k.status]||0)+1,a),{}),transientSurfaceOccurrences:signals.length,catalog,approvedComparison,limits:["Import closure includes inactive conditional imports and type imports; not runtime reachability.","JSX, selected display attributes and named config/message properties only; arbitrary concatenation, custom translation aliases, rendered dynamic data, CSS pseudo-content and portals may escape discovery.","State and device signals are source hints, not enumerated accessible runtime states.","No network, database, server bootstrap, account creation or provider requests were made.","No application-wide translation percentage can be computed from these denominators."]};
fs.writeFileSync(`${out}/discovery-summary.json`,JSON.stringify(summary,null,2)+"\n");
fs.writeFileSync(`${out}/source-hashes.json`,JSON.stringify(Object.fromEntries([...sources].map(([f,s])=>[f,crypto.createHash("sha256").update(s).digest("hex")])),null,2)+"\n");
if(path.resolve(__filename)!==path.resolve(`${out}/generate.cjs`))fs.copyFileSync(__filename,`${out}/generate.cjs`);
console.log(JSON.stringify({...summary,catalog:{...catalog,legacyIdenticalValues:`${catalog.legacyIdenticalValues.length} identical entries (not automatically defects)`}},null,2));
