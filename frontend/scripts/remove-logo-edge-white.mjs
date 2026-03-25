/**
 * One-off: make edge-connected near-white pixels transparent (keeps interior white, e.g. text).
 * Run: node scripts/remove-logo-edge-white.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = join(__dirname, "../public/neurohire-logo.png");

const WHITE_MIN = 232; // RGB channels: treat as background when connected to edges

function nearWhite(r, g, b) {
  return r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN;
}

const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const buf = new Uint8ClampedArray(data);
const ch = 4;
const visited = new Uint8Array(w * h);

const q = [];
const push = (x, y) => {
  const k = y * w + x;
  if (visited[k]) return;
  const i = k * ch;
  if (!nearWhite(buf[i], buf[i + 1], buf[i + 2])) return;
  visited[k] = 1;
  q.push([x, y]);
};

for (let x = 0; x < w; x++) {
  push(x, 0);
  push(x, h - 1);
}
for (let y = 0; y < h; y++) {
  push(0, y);
  push(w - 1, y);
}

let qi = 0;
while (qi < q.length) {
  const [x, y] = q[qi++];
  const i = (y * w + x) * ch;
  buf[i + 3] = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    const nk = ny * w + nx;
    if (visited[nk]) continue;
    const ni = nk * ch;
    if (nearWhite(buf[ni], buf[ni + 1], buf[ni + 2])) {
      visited[nk] = 1;
      q.push([nx, ny]);
    }
  }
}

const tmpPath = join(__dirname, "../public/neurohire-logo.tmp.png");
await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(tmpPath);

const fs = await import("fs");
fs.renameSync(tmpPath, inputPath);

console.log("Updated", inputPath, "- edge white removed (transparent).");
