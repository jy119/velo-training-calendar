import fs from 'node:fs';
import path from 'node:path';
// Reconstitutes the original deployed HTML, imported without changing behavior.
// All source-parts are UTF-8 text fragments ordered lexicographically.
const dir = 'source-parts';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.part')).sort();
if (files.length !== 17) throw new Error('Expected 17 source fragments, got ' + files.length);
const html = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
if (!html.startsWith('<!doctype html>') || !html.trimEnd().endsWith('</html>')) throw new Error('Incomplete HTML');
fs.mkdirSync('dist', {recursive:true});
fs.writeFileSync('dist/index.html', html);
console.log('Built VELO:', html.length, 'characters');
