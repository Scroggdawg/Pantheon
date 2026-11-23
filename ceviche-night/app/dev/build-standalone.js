// Builds ONE self-contained file, ../ceviche-night.html, with the four scripts inlined.
// It is the same page the artifact serves, wrapped in the same skeleton, with no outside files.
//   node ceviche-night/app/dev/build-standalone.js
const fs = require('fs');
const path = require('path');
const appDir = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
let inlined = 0;
const body = src.replace(/<script\s+src="(?!https?:)([^"]+)"><\/script>/g, (m, file) => {
  const js = fs.readFileSync(path.join(appDir, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  inlined++;
  return '<script>\n' + js + '\n</script>';
});
if (inlined !== 4) throw new Error('expected 4 local scripts, inlined ' + inlined);
const reset = [
  ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}',
  'body{margin:0;font:14px system-ui,sans-serif}',
  'img{max-width:100%}',
  '[hidden]{display:none!important}'
].join('');
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><style>' + reset + '</style></head><body>' + body + '</body></html>\n';
const out = path.join(appDir, '..', 'ceviche-night.html');
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB, ' + inlined + ' scripts inlined)');
