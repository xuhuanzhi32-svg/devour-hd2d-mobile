#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const outputDir = path.join(root, 'assets', 'embedded');
const source = fs.readFileSync(htmlPath, 'utf8');
const assetPattern = /"data:image\/png;base64,([A-Za-z0-9+/=]+)"/g;
const assets = [];
let match;

while ((match = assetPattern.exec(source)) !== null) assets.push(match[1]);
if (assets.length !== 7) {
  throw new Error(`Expected 7 embedded PNG assets, found ${assets.length}.`);
}

fs.mkdirSync(outputDir, { recursive: true });
const scriptTags = [];
const chunkSize = 700000;

for (let assetIndex = 0; assetIndex < assets.length; assetIndex += 1) {
  const base64 = assets[assetIndex];
  for (let offset = 0, part = 0; offset < base64.length; offset += chunkSize, part += 1) {
    const filename = `asset-${String(assetIndex).padStart(2, '0')}-${String(part).padStart(2, '0')}.js`;
    const payload = base64.slice(offset, offset + chunkSize);
    fs.writeFileSync(
      path.join(outputDir, filename),
      `window.__HD2D_DATA_CHUNKS[${assetIndex}].push("${payload}");\n`,
      'utf8',
    );
    scriptTags.push(`<script src="assets/embedded/${filename}"></script>`);
  }
}

let index = 0;
let transformed = source.replace(assetPattern, () => `window.__HD2D_DATA_URI(${index++})`);
const marker = '<script>window.__HD2D_BOOT.stage("装入动作素材")';
if (!transformed.includes(marker)) throw new Error('Animation asset marker not found.');

const bootstrap = [
  '<script>',
  `window.__HD2D_DATA_CHUNKS=Array.from({length:${assets.length}},()=>[]);`,
  '</script>',
  ...scriptTags,
  '<script>',
  'window.__HD2D_DATA_URI=function(index){return "data:image/png;base64,"+window.__HD2D_DATA_CHUNKS[index].join("");};',
  '</script>',
].join('');

transformed = transformed.replace(marker, bootstrap + marker);
fs.writeFileSync(htmlPath, transformed, 'utf8');

const manifest = {
  format: 'hd2d-base64-js-chunks-v1',
  assetCount: assets.length,
  chunkCount: scriptTags.length,
  chunkSize,
  originalHtmlBytes: Buffer.byteLength(source),
  transformedHtmlBytes: Buffer.byteLength(transformed),
  assets: assets.map((base64, assetIndex) => ({
    assetIndex,
    base64Length: base64.length,
    sha256: require('crypto').createHash('sha256').update(base64).digest('hex'),
  })),
};
fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(manifest, null, 2));
