const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 calculation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPNG(width, height, getPixel) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter byte 0
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  let ptr = 0;
  for (let y = 0; y < height; y++) {
    rawScanlines[ptr++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      rawScanlines[ptr++] = r;
      rawScanlines[ptr++] = g;
      rawScanlines[ptr++] = b;
      rawScanlines[ptr++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawScanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw invoice app icon
function drawAppIcon(isMaskable) {
  return function(x, y, w, h) {
    const u = x / w;
    const v = y / h;

    // Background: Emerald gradient (#059669 -> #047857)
    let bgR = Math.round(5 + (4 - 5) * v);
    let bgG = Math.round(150 + (120 - 150) * v);
    let bgB = Math.round(105 + (87 - 105) * v);
    let bgA = 255;

    // Corner radius if not maskable
    if (!isMaskable) {
      const cornerR = w * 0.22;
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      if (dx < cornerR && dy < cornerR) {
        const dist = Math.sqrt((cornerR - dx) ** 2 + (cornerR - dy) ** 2);
        if (dist > cornerR) {
          return [0, 0, 0, 0]; // Transparent outside squircle
        }
      }
    }

    // Sheet area
    const scale = isMaskable ? 0.72 : 0.85;
    const cx = w / 2;
    const cy = h / 2;
    const sheetW = w * 0.58 * scale;
    const sheetH = h * 0.70 * scale;
    const sheetX = cx - sheetW / 2;
    const sheetY = cy - sheetH / 2;
    const sheetR = sheetW * 0.1;

    // Inside sheet?
    if (x >= sheetX && x <= sheetX + sheetW && y >= sheetY && y <= sheetY + sheetH) {
      const dx = Math.min(x - sheetX, sheetX + sheetW - x);
      const dy = Math.min(y - sheetY, sheetY + sheetH - y);
      let inCorner = false;
      if (dx < sheetR && dy < sheetR) {
        const dist = Math.sqrt((sheetR - dx) ** 2 + (sheetR - dy) ** 2);
        if (dist > sheetR) inCorner = true;
      }

      if (!inCorner) {
        // Sheet elements:
        // Top header strip
        const topY1 = sheetY + sheetH * 0.08;
        const topY2 = sheetY + sheetH * 0.16;
        if (y >= topY1 && y <= topY2) {
          if (x >= sheetX + sheetW * 0.1 && x <= sheetX + sheetW * 0.5) {
            return [5, 150, 105, 255]; // emerald bar
          }
          if (x >= sheetX + sheetW * 0.65 && x <= sheetX + sheetW * 0.9) {
            return [203, 213, 225, 255]; // gray bar
          }
        }

        // Dashed line
        const dashY = sheetY + sheetH * 0.24;
        if (Math.abs(y - dashY) <= 1.5 && x >= sheetX + sheetW * 0.1 && x <= sheetX + sheetW * 0.9) {
          if (Math.floor(x / 8) % 2 === 0) {
            return [203, 213, 225, 255];
          }
        }

        // Lines of items
        const lineRanges = [
          { y: sheetY + sheetH * 0.32, h: sheetH * 0.04 },
          { y: sheetY + sheetH * 0.40, h: sheetH * 0.04 },
          { y: sheetY + sheetH * 0.48, h: sheetH * 0.04 }
        ];
        for (const lr of lineRanges) {
          if (y >= lr.y && y <= lr.y + lr.h) {
            if (x >= sheetX + sheetW * 0.1 && x <= sheetX + sheetW * 0.6) {
              return [100, 116, 139, 255];
            }
            if (x >= sheetX + sheetW * 0.7 && x <= sheetX + sheetW * 0.9) {
              return [148, 163, 184, 255];
            }
          }
        }

        // Total highlight box
        const totalY = sheetY + sheetH * 0.58;
        const totalH = sheetH * 0.12;
        if (y >= totalY && y <= totalY + totalH && x >= sheetX + sheetW * 0.1 && x <= sheetX + sheetW * 0.9) {
          return [236, 253, 245, 255]; // light emerald
        }

        // Barcode lines at bottom
        const barY = sheetY + sheetH * 0.76;
        const barH = sheetH * 0.14;
        if (y >= barY && y <= barY + barH && x >= sheetX + sheetW * 0.12 && x <= sheetX + sheetW * 0.88) {
          const barIdx = Math.floor((x - (sheetX + sheetW * 0.12)) / 5);
          if ([0, 1, 3, 5, 6, 8, 10, 11, 13, 14, 16, 18, 19, 21, 23].includes(barIdx % 25)) {
            return [51, 65, 85, 255];
          }
        }

        return [255, 255, 255, 255]; // Paper white
      }
    }

    return [bgR, bgG, bgB, bgA];
  };
}

const pubDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

// 1. pwa-192x192.png
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createPNG(192, 192, drawAppIcon(false)));
console.log('Created pwa-192x192.png');

// 2. pwa-512x512.png
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createPNG(512, 512, drawAppIcon(false)));
console.log('Created pwa-512x512.png');

// 3. pwa-maskable-512x512.png
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, drawAppIcon(true)));
console.log('Created pwa-maskable-512x512.png');

// 4. apple-touch-icon.png
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createPNG(180, 180, drawAppIcon(false)));
console.log('Created apple-touch-icon.png');

// 5. favicon.ico / favicon.png
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), createPNG(32, 32, drawAppIcon(false)));
console.log('Created favicon.ico');
