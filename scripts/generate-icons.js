const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Zero-dependency PNG generator for Pulse ToDo app icons (192x192, 512x512, 180x180 Apple Touch, 1024x1024 Store Master)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Point-to-segment distance for drawing anti-aliased rounded checkmark & ring
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  }
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function generateIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cornerRadius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  // Checkmark coordinates normalized to [0, 1]
  const p1x = size * 0.33, p1y = size * 0.52;
  const p2x = size * 0.45, p2y = size * 0.64;
  const p3x = size * 0.69, p3y = size * 0.38;
  const strokeRadius = size * 0.052;
  const ringRadius = size * 0.31;
  const ringThickness = size * 0.038;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0; // filter type 0

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;

      // Rounded rect distance
      const qx = Math.abs(x - cx) - (cx - cornerRadius);
      const qy = Math.abs(y - cy) - (cy - cornerRadius);
      const distRect = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerRadius;

      if (distRect > 0.8) {
        // Transparent outside rounded icon bounds (for 1024x1024 store icon we fill full bleed)
        raw[px] = 99;
        raw[px + 1] = 102;
        raw[px + 2] = 241;
        raw[px + 3] = size === 1024 ? 255 : 0;
        continue;
      }

      // Linear gradient from #6366f1 (top-left) to #8b5cf6 (bottom-right)
      const gradT = (x + y) / (2 * size);
      let r = Math.round(99 * (1 - gradT) + 139 * gradT);
      let g = Math.round(102 * (1 - gradT) + 92 * gradT);
      let b = Math.round(241 * (1 - gradT) + 246 * gradT);

      // Subtle white ring
      const distCenter = Math.hypot(x - cx, y - cy);
      const distRing = Math.abs(distCenter - ringRadius) - ringThickness / 2;
      if (distRing < 1.0) {
        const ringAlpha = Math.max(0, Math.min(1, 0.25 * (1 - distRing)));
        r = Math.round(r * (1 - ringAlpha) + 255 * ringAlpha);
        g = Math.round(g * (1 - ringAlpha) + 255 * ringAlpha);
        b = Math.round(b * (1 - ringAlpha) + 255 * ringAlpha);
      }

      // Crisp white checkmark
      const d1 = distToSegment(x, y, p1x, p1y, p2x, p2y);
      const d2 = distToSegment(x, y, p2x, p2y, p3x, p3y);
      const dCheck = Math.min(d1, d2) - strokeRadius;
      if (dCheck < 1.0) {
        const checkAlpha = Math.max(0, Math.min(1, 1 - dCheck));
        r = Math.round(r * (1 - checkAlpha) + 255 * checkAlpha);
        g = Math.round(g * (1 - checkAlpha) + 255 * checkAlpha);
        b = Math.round(b * (1 - checkAlpha) + 255 * checkAlpha);
      }

      const edgeAlpha = size === 1024 ? 255 : Math.round(255 * Math.max(0, Math.min(1, 0.5 - distRect)));
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = edgeAlpha;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function generateFeatureGraphicPng(width, height) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  const badgeSize = 240;
  const badgeCx = width * 0.5;
  const badgeCy = height * 0.5;
  const cornerRadius = badgeSize * 0.22;
  const halfBadge = badgeSize / 2;

  const p1x = badgeCx - halfBadge + badgeSize * 0.33;
  const p1y = badgeCy - halfBadge + badgeSize * 0.52;
  const p2x = badgeCx - halfBadge + badgeSize * 0.45;
  const p2y = badgeCy - halfBadge + badgeSize * 0.64;
  const p3x = badgeCx - halfBadge + badgeSize * 0.69;
  const p3y = badgeCy - halfBadge + badgeSize * 0.38;
  const strokeRadius = badgeSize * 0.052;
  const ringRadius = badgeSize * 0.31;
  const ringThickness = badgeSize * 0.038;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;

      // Rich dark-indigo to violet banner background (#0f172a -> #312e81 -> #4f46e5)
      const tX = x / width;
      const tY = y / height;
      const radialGlow = Math.max(0, 1 - Math.hypot((x - badgeCx) / 420, (y - badgeCy) / 260));
      let r = Math.round(15 + 34 * tX + 55 * radialGlow);
      let g = Math.round(23 + 20 * tY + 45 * radialGlow);
      let b = Math.round(42 + 88 * tX + 140 * radialGlow);

      // Center app emblem card
      const qx = Math.abs(x - badgeCx) - (halfBadge - cornerRadius);
      const qy = Math.abs(y - badgeCy) - (halfBadge - cornerRadius);
      const distRect = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerRadius;

      if (distRect <= 0.8) {
        const localT = ((x - (badgeCx - halfBadge)) + (y - (badgeCy - halfBadge))) / (2 * badgeSize);
        let br = Math.round(99 * (1 - localT) + 139 * localT);
        let bg = Math.round(102 * (1 - localT) + 92 * localT);
        let bb = Math.round(241 * (1 - localT) + 246 * localT);

        const distCenter = Math.hypot(x - badgeCx, y - badgeCy);
        const distRing = Math.abs(distCenter - ringRadius) - ringThickness / 2;
        if (distRing < 1.0) {
          const ringAlpha = Math.max(0, Math.min(1, 0.25 * (1 - distRing)));
          br = Math.round(br * (1 - ringAlpha) + 255 * ringAlpha);
          bg = Math.round(bg * (1 - ringAlpha) + 255 * ringAlpha);
          bb = Math.round(bb * (1 - ringAlpha) + 255 * ringAlpha);
        }

        const d1 = distToSegment(x, y, p1x, p1y, p2x, p2y);
        const d2 = distToSegment(x, y, p2x, p2y, p3x, p3y);
        const dCheck = Math.min(d1, d2) - strokeRadius;
        if (dCheck < 1.0) {
          const checkAlpha = Math.max(0, Math.min(1, 1 - dCheck));
          br = Math.round(br * (1 - checkAlpha) + 255 * checkAlpha);
          bg = Math.round(bg * (1 - checkAlpha) + 255 * checkAlpha);
          bb = Math.round(bb * (1 - checkAlpha) + 255 * checkAlpha);
        }

        const cardAlpha = Math.max(0, Math.min(1, 0.5 - distRect));
        r = Math.round(r * (1 - cardAlpha) + br * cardAlpha);
        g = Math.round(g * (1 - cardAlpha) + bg * cardAlpha);
        b = Math.round(b * (1 - cardAlpha) + bb * cardAlpha);
      }

      raw[px] = Math.min(255, r);
      raw[px + 1] = Math.min(255, g);
      raw[px + 2] = Math.min(255, b);
      raw[px + 3] = 255;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-1024.png', size: 1024 }
];

for (const t of targets) {
  const outPath = path.join(iconsDir, t.file);
  fs.writeFileSync(outPath, generateIconPng(t.size));
  console.log(`Generated ${t.file} (${t.size}x${t.size})`);
}

const featureGraphicPath = path.join(iconsDir, 'feature-graphic-1024x500.png');
fs.writeFileSync(featureGraphicPath, generateFeatureGraphicPng(1024, 500));
console.log('Generated feature-graphic-1024x500.png (1024x500)');

