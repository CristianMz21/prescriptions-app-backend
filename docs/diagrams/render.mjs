import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = [
  '01-arquitectura.mmd',
  '02-er.mmd',
  '03-flujo-auth.mmd',
  '04-flujo-prescription.mmd',
  '05-folder-structure.mmd',
  '06-rbac-matrix.mmd'
];

const browser = await puppeteer.launch({
  executablePath: '/home/mackroph/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const fontSizes = {
  '01-arquitectura.mmd': '18px',
  '02-er.mmd': '16px',
  '03-flujo-auth.mmd': '18px',
  '04-flujo-prescription.mmd': '18px',
  '05-folder-structure.mmd': '16px',
  '06-rbac-matrix.mmd': '16px'
};

for (const file of files) {
  const src = readFileSync(join(__dirname, file), 'utf-8');
  const id = 'd' + file.replace('.mmd', '').replace(/-/g, '_');
  const fontSize = fontSizes[file] || '16px';

  const html = `<!DOCTYPE html>
<html><head><style>body{background:#ffffff;margin:0;padding:40px}</style></head>
<body>
<pre id="src" style="display:none">${src.replace(/`/g, '\\`').replace(/\$/g, '\\$')}</pre>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: {
  background: '#ffffff', fontSize: '${fontSize}', textColor: '#1e1e1e',
  primaryColor: '#6bcb77', lineColor: '#ffd93d'
}});
setTimeout(async () => {
  try {
    const { svg } = await mermaid.render('${id}', document.getElementById('src').textContent);
    document.body.innerHTML = svg;
    console.log('SVG rendered');
  } catch(e) {
    console.error('ERROR:', e.message);
    document.body.innerHTML = '<pre>' + e.message + '</pre>';
  }
}, 500);
</script></body></html>`;

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const svgHandle = await page.$('svg');
  if (svgHandle) {
    const buffer = await svgHandle.screenshot({ type: 'png', omitBackground: false });
    writeFileSync(join(__dirname, id + '.png'), buffer);
    console.log(`✓ ${file} -> ${id}.png (${buffer.length} bytes)`);
  } else {
    const bodyContent = await page.evaluate(() => document.body.innerHTML);
    console.log(`✗ ${file} - no SVG. Body: ${bodyContent.substring(0, 200)}`);
  }
  await page.close();
}

await browser.close();
console.log('\nAll done!');