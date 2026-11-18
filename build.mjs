import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

// Preserve original V1 training planner and progressively enhance it.
const dir = 'source-parts';
const parts = fs.readdirSync(dir).filter(f => f.endsWith('.part')).sort();
if (parts.length !== 17) throw new Error('Expected 17 source fragments');
let html = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
if (!html.startsWith('<!doctype html>') || !html.trimEnd().endsWith('</html>')) throw new Error('Incomplete HTML');
html = html.replace('TOTAL=32, DAY=', 'TOTAL=44, DAY=');
const css = fs.readFileSync('enhancements.css', 'utf8');
let js = fs.readFileSync('enhancements.js', 'utf8');
const v2save = "localStorage.setItem('velo-activities-v2',JSON.stringify(actualRides))};";
if (!js.includes(v2save)) throw new Error('Could not locate V2 save hook');
js=js.replace(v2save, "localStorage.setItem('velo-activities-v2',JSON.stringify(actualRides));window.dispatchEvent(new Event('velo-data-changed'))};");
const v1save = 'function persist(){localStorage.setItem(STORAGE,JSON.stringify({workouts,ftp}))}';
if (!html.includes(v1save)) throw new Error('Could not locate V1 save hook');
html = html.replace(v1save, "function persist(){localStorage.setItem(STORAGE,JSON.stringify({workouts,ftp}));window.dispatchEvent(new Event('velo-data-changed'))}");
html = html.replace('</head>', '<style>' + css + '</style></head>');
html = html.replace('</body>', '<script>' + js.replaceAll('</script', '<\\/script') + '</script></body>');

const url = process.env.SUPABASE_URL || '';
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (url && publishableKey) {
  if (!url.startsWith('https://')) throw new Error('SUPABASE_URL must use HTTPS');
  if (!/^sb_publishable_|^eyJ/.test(publishableKey)) throw new Error('Expected a Supabase publishable/anon key, never service_role');
  const bridge = `
    window.veloCloudBridge = {
      snapshot: () => ({workouts,ftp,raceChoices,travelBlocks,actualRides}),
      apply: data => {
        if (!data || data.schema !== 1 || !data.workouts || typeof data.workouts !== 'object') throw Error('Invalid cloud plan');
        if (!Number.isFinite(Number(data.ftp))) throw Error('Invalid cloud FTP');
        workouts = data.workouts;
        ftp = Number(data.ftp);
        raceChoices = data.raceChoices || {};
        travelBlocks = data.travelBlocks || [];
        actualRides = data.actualRides || {};
        persist();
        storeV2();
        render();
        renderRaces();
        renderTravel();
        renderActual();
      }
    };`;
  const cfg = {url,publishableKey};
  html=html.replace('</body>',
    '<script>'+bridge+'</script><script>window.__VELO_CLOUD_CONFIG__='+JSON.stringify(cfg).replaceAll('<','\\u003c')+'</script><script type="module" src="/cloud-sync.js"></script></body>');
  html=html.replace('</head>', `<style>
  .velo-account-backdrop{position:fixed;inset:0;background:#17322ecc;z-index:1000;display:flex;justify-content:center;align-items:center;padding:16px}
  .velo-account-panel{background:var(--bg);width:min(480px,100%);padding:30px;border-radius:18px;max-height:90vh;overflow:auto;position:relative}
  .velo-account-panel .close{position:absolute;top:12px;right:15px}
  .velo-account-panel h2{font:800 25px Manrope;letter-spacing:-.8px}
  </style></head>`);
}
fs.mkdirSync('dist', {recursive:true});
fs.writeFileSync('dist/index.html', html);
fs.copyFileSync('races-2027.json', 'dist/races-2027.json');
await build({entryPoints:['cloud-sync.mjs'],outfile:'dist/cloud-sync.js',bundle:true,minify:true,platform:'browser',format:'esm',target:'es2020'});
console.log('Built VELO:', html.length, 'characters; cloud account UI enabled:', Boolean(url && publishableKey));
