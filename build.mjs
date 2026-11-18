import fs from 'node:fs';
import path from 'node:path';
// Preserve the original application and progressively enhance it.
const dir = 'source-parts';
const parts = fs.readdirSync(dir).filter(f => f.endsWith('.part')).sort();
if (parts.length !== 17) throw new Error('Expected 17 source fragments');
let html = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
if (!html.startsWith('<!doctype html>') || !html.trimEnd().endsWith('</html>')) throw new Error('Incomplete HTML');
// Extend the season to September 2027, covering the rest of the NCNCA calendar.
html = html.replace('TOTAL=32, DAY=', 'TOTAL=44, DAY=');
const css = fs.readFileSync('enhancements.css', 'utf8');
const js = fs.readFileSync('enhancements.js', 'utf8');
html = html.replace('</head>', '<style>' + css + '</style></head>');
html = html.replace('</body>', '<script>' + js.replaceAll('</script', '<\\/script') + '</script></body>');
fs.mkdirSync('dist', {recursive:true});
fs.writeFileSync('dist/index.html', html);
fs.copyFileSync('races-2027.json', 'dist/races-2027.json');
console.log('Built VELO v2:', html.length, 'characters; races included');
