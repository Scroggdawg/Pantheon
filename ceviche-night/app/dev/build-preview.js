// Wraps index.html (artifact page content) in the same skeleton the publisher adds,
// so the page can be opened locally: node ceviche-night/app/dev/build-preview.js
const fs = require('fs');
const path = require('path');
const appDir = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
// local preview lives in dev/, so sibling scripts are one level up
const body = src.replace(/(<script\s+src=")(?!https?:)([^"]+")/g, '$1../$2');
const reset = [
  ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}',
  'body{margin:0;font:14px system-ui,sans-serif}',
  'img{max-width:100%}',
  '[hidden]{display:none!important}'
].join('');
const html = '<!doctype html><html><head><meta charset=utf8>' +
  '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>' + reset + '</style></head><body>' + body + '</body></html>';
fs.writeFileSync(path.join(__dirname, 'preview.html'), html);
console.log('wrote dev/preview.html (' + html.length + ' bytes)');
