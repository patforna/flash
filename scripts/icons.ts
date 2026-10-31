// Renders public/icon.svg to the PNGs the manifest names: `bun scripts/icons.ts`. The maskable icon fills its square
// (Android masks it to a circle or a squircle) and scales the card down to keep it inside the mask's safe zone.
import { chromium } from "playwright";

const svg = await Bun.file("public/icon.svg").text();
const maskable = svg
  .replace('rx="112"', 'rx="0"')
  .replace('<g id="card">', '<g id="card" transform="translate(256 256) scale(0.875) translate(-256 -256)">');

const browser = await chromium.launch();
async function render(markup: string, size: number, path: string) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
  );
  await page.screenshot({ path, omitBackground: true });
  await page.close();
  console.log(`${path}: ${size} × ${size}`);
}
await render(svg, 192, "public/icon-192.png");
await render(svg, 512, "public/icon-512.png");
await render(maskable, 512, "public/icon-maskable-512.png");
await browser.close();
