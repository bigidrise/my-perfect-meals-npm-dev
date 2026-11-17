/**
 * Isolated browser fixture, not mounted in the application. No backend proxy.
 * Uses the actual sheet, voice control, product details and application CSS.
 * Before-state source is extracted read-only; the working tree is never reset.
 */
import { createServer, build } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "generated-artifacts/grocery-coach-layout");
mkdirSync(output, { recursive: true });
const before = execFileSync("git", ["show", "f9e580f4f341eecb6428f053fb7408b97b84b896:client/src/components/shopping/GroceryStoreCoachSheet.tsx"], { encoding: "utf8" })
  .replaceAll('from "./', 'from "@/components/shopping/');
writeFileSync(path.join(output, "Before.tsx"), before);
writeFileSync(path.join(output, "index.html"), `<!doctype html><html class="dark font-size-standard"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>`);
writeFileSync(path.join(output, "entry.tsx"), `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from '@/i18n/locales/en.json';
import '@/index.css';
import Before from './Before';
import After from '@/components/shopping/GroceryStoreCoachSheet';
import {queryClient} from '@/lib/queryClient';
window.fixtureCalls = [];
window.fixtureBlocked = [];
window.fetch = async (...args) => { window.fixtureBlocked.push(String(args[0])); throw new Error('Network disabled in layout fixture'); };
navigator.sendBeacon = () => false;
await i18n.use(initReactI18next).init({lng:'en', fallbackLng:'en', resources:{en:{translation:en, shopping:en.shopping}}, interpolation:{escapeValue:false}});
const Sheet = new URLSearchParams(location.search).get('version') === 'before' ? Before : After;
function App() {
 const [open,setOpen] = useState(true);
 return <QueryClientProvider client={queryClient}><main style={{minHeight:2200,padding:24,background:'#181818',color:'white'}}>
 <h1>Isolated Grocery Coach layout fixture</h1><p>Synthetic data only. All API modules are replaced; fetch is disabled.</p>
 <button onClick={()=>setOpen(true)}>Open Grocery Coach</button><Sheet open={open} onOpenChange={setOpen}/>
 </main></QueryClientProvider>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
const stubs = {
  "@/contexts/AuthContext": `export const useAuth=()=>({user:{id:'layout-fixture'}});`,
  "@/hooks/use-toast": `export const useToast=()=>({toast:()=>{}});`,
  "@/lib/api": `
    import {meal,analysis} from '/@fs/${root}/scripts/grocery-coach-layout/fixtures.ts';
    export const get=async(url)=>{window.fixtureCalls.push(['get',url]);return {items:[]}};
    export const post=async(url,body)=>{
      window.fixtureCalls.push(['post',url,body]);
      if(url==='/api/grocery-coach/recommend') return meal;
      if(url==='/api/biometrics/ingredient-scan-by-name') return {ok:true,result:analysis};
      if(url==='/api/grocery-coach/finalize-card') return {status:'failed'};
      if(url==='/api/grocery-coach/product-advisor') return {advice:[]};
      throw new Error('Unexpected fixture mutation: '+url);
    };`,
  "@/lib/queryClient": `import {QueryClient} from '@tanstack/react-query'; export const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});export const apiRequest=async(url)=>{if(url==='/api/saved-groceries')return {items:[]};throw new Error('Unexpected fixture API: '+url)};`,
  "@/stores/shoppingListStore": `export const useShoppingListStore=(select)=>select({addItems:()=>{throw new Error('List writes disabled')},addItem:()=>{throw new Error('List writes disabled')}});`,
  "@/components/MealRefinementSheet": `export default function Stub(){return null};`,
};
const config = {
  configFile: false,
  root: output,
  cacheDir: path.join(output, ".vite"),
  plugins: [{
    name: "isolated-coach-boundaries", enforce: "pre",
    resolveId(id) { if (stubs[id]) return "\0fixture:" + id; },
    load(id) { if (id.startsWith("\0fixture:")) return stubs[id.slice(9)]; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/")) { res.statusCode=451; res.end("No backend in this fixture"); return; }
        next();
      });
    },
  }, react()],
  resolve: { dedupe: ["react","react-dom"], alias: [
    ...Object.keys(stubs).map(id=>({find:id,replacement:id})),
    {find:"@",replacement:path.join(root,"client/src")},
    {find:"@shared",replacement:path.join(root,"shared")},
  ] },
  css: { postcss: root },
  // Existing workspace mapping: local 5090 -> external 3002. No main-app port changes.
  server: {host:"0.0.0.0", port:5090, strictPort:true, allowedHosts:true, fs:{allow:[root]}, hmr:false},
};
if (process.argv.includes("--build")) {
  await build({...config, build:{target:"esnext",outDir:path.join(output,"compiled"),emptyOutDir:true}});
} else {
  const server = await createServer(config);
  await server.listen();
  server.printUrls();
}
