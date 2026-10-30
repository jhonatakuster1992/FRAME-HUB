// Renderiza o vídeo quadro a quadro: node src/render.js <saida_frames> [fps] [t1,t2,... para prévias]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2];
  const fps = +(process.argv[3] || 30);
  const only = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('ERRO NA PÁGINA:', e.message); process.exit(1); });
  await page.goto('file://' + path.resolve(__dirname, 'motion.html'));
  await page.evaluate(() => document.fonts.ready);
  fs.writeFileSync(path.join(out, 'sfx.json'), JSON.stringify(await page.evaluate(() => window.SFX), null, 1));
  const times = only || Array.from({ length: Math.round(40 * fps) }, (_, i) => i / fps);
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(t => render(t), times[i]);
    const name = only ? `prev_${String(times[i]).replace('.', '_')}.jpg` : `f_${String(i).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 92 });
    if (!only && i % 150 === 0) console.log('frame', i);
  }
  await browser.close();
})();
