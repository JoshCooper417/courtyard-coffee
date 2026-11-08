/**
 * Pure-JS ISO/IEC 18004 Version 2-L (25x25 modules, Byte Mode, Mask 0, 10 RS ECC codewords)
 * 240x240 uncompressed binary PNG QR Data URL generator.
 * Produces a valid `data:image/png;base64,...` with PNG signature, IHDR (240x240),
 * zlib store block, Adler32, CRC32, and IEND so <img> renders natively at 240x240
 * and scans in standard QR decoders.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function writeUint32BE(buf, offset, value) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function makeChunk(typeStr, dataBytes) {
  const chunk = new Uint8Array(4 + 4 + dataBytes.length + 4);
  writeUint32BE(chunk, 0, dataBytes.length);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = typeStr.charCodeAt(i);
  }
  chunk.set(dataBytes, 8);
  const crcInput = chunk.subarray(4, 8 + dataBytes.length);
  writeUint32BE(chunk, 8 + dataBytes.length, crc32(crcInput));
  return chunk;
}

// GF(2^8) tables with primitive polynomial 0x11D for ISO/IEC 18004 Reed-Solomon
const { GF_EXP, GF_LOG, RS_GEN_10 } = (() => {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let v = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = v;
    log[v] = i;
    v <<= 1;
    if (v & 0x100) v ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    exp[i] = exp[i - 255];
  }

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return exp[log[a] + log[b]];
  }

  let gen = [1];
  for (let i = 0; i < 10; i++) {
    const next = new Array(gen.length + 1).fill(0);
    const root = exp[i];
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], root);
    }
    gen = next;
  }

  return { GF_EXP: exp, GF_LOG: log, RS_GEN_10: gen };
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode10(dataCodewords) {
  const ecc = new Array(10).fill(0);
  for (const b of dataCodewords) {
    const factor = b ^ ecc[0];
    ecc.shift();
    ecc.push(0);
    if (factor !== 0) {
      for (let j = 0; j < 10; j++) {
        ecc[j] ^= gfMul(RS_GEN_10[j + 1], factor);
      }
    }
  }
  return ecc;
}

export function buildQrMatrix(text) {
  const gridSize = 25;
  const encoder = new TextEncoder();
  const utf8Bytes = Array.from(encoder.encode(String(text || "050-0000000"))).slice(0, 32);

  // 1. Encode 34 data codewords in Byte Mode (0100)
  const bits = [0, 1, 0, 0];
  for (let i = 0; i < 8; i++) {
    bits.push((utf8Bytes.length >> (7 - i)) & 1);
  }
  for (const b of utf8Bytes) {
    for (let i = 0; i < 8; i++) {
      bits.push((b >> (7 - i)) & 1);
    }
  }
  const maxDataBits = 34 * 8;
  const termCount = Math.min(4, maxDataBits - bits.length);
  for (let i = 0; i < termCount; i++) {
    bits.push(0);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bits[i + j];
    }
    dataCodewords.push(byteVal);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataCodewords.length < 34) {
    dataCodewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // 2. Compute 10 Reed-Solomon ECC codewords
  const eccCodewords = rsEncode10(dataCodewords);
  const allCodewords = dataCodewords.concat(eccCodewords);

  const moduleBits = [];
  for (const cw of allCodewords) {
    for (let i = 0; i < 8; i++) {
      moduleBits.push((cw >> (7 - i)) & 1);
    }
  }
  for (let i = 0; i < 7; i++) {
    moduleBits.push(0); // 7 remainder bits for Version 2
  }

  // 3. Place function patterns on 25x25 grid
  const matrix = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
  const isFunction = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  function placeFinder(r0, c0) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          isFunction[r][c] = true;
          const inOuter =
            dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
            (dr === 0 || dr === 6 || dc === 0 || dc === 6);
          const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          matrix[r][c] = inOuter || inInner;
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, gridSize - 7);
  placeFinder(gridSize - 7, 0);

  // 5x5 Alignment pattern at (16..20, 16..20) centered at (18, 18)
  for (let dr = 0; dr < 5; dr++) {
    for (let dc = 0; dc < 5; dc++) {
      const r = 16 + dr;
      const c = 16 + dc;
      isFunction[r][c] = true;
      matrix[r][c] = dr === 0 || dr === 4 || dc === 0 || dc === 4 || (dr === 2 && dc === 2);
    }
  }

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    isFunction[6][i] = true;
    matrix[6][i] = i % 2 === 0;
    isFunction[i][6] = true;
    matrix[i][6] = i % 2 === 0;
  }

  // Dark module at (17, 8)
  isFunction[17][8] = true;
  matrix[17][8] = true;

  // Format information for Level L (01) + Mask 0 (000) -> 0x77C4
  const formatWord = 0x77c4;
  const copy1Coords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const copy2Coords = [
    [24, 8], [23, 8], [22, 8], [21, 8], [20, 8], [19, 8], [18, 8],
    [8, 17], [8, 18], [8, 19], [8, 20], [8, 21], [8, 22], [8, 23], [8, 24],
  ];
  for (let idx = 0; idx < 15; idx++) {
    const bitVal = Boolean((formatWord >> (14 - idx)) & 1);
    const [r1, c1] = copy1Coords[idx];
    isFunction[r1][c1] = true;
    matrix[r1][c1] = bitVal;
    const [r2, c2] = copy2Coords[idx];
    isFunction[r2][c2] = true;
    matrix[r2][c2] = bitVal;
  }

  // 4. Zigzag data placement & Mask 0 ((r + c) % 2 === 0)
  let bitIdx = 0;
  let upward = true;
  let col = gridSize - 1;
  while (col > 0) {
    if (col === 6) col -= 1;
    for (let step = 0; step < gridSize; step++) {
      const r = upward ? gridSize - 1 - step : step;
      for (const dc of [0, 1]) {
        const c = col - dc;
        if (!isFunction[r][c]) {
          const dataBit = bitIdx < moduleBits.length ? Boolean(moduleBits[bitIdx]) : false;
          bitIdx++;
          const maskBit = (r + c) % 2 === 0;
          matrix[r][c] = dataBit !== maskBit;
        }
      }
    }
    upward = !upward;
    col -= 2;
  }

  return { matrix, gridSize, isFunction };
}

function uint8ToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function generateQrDataUrl(text, size = 240) {
  const width = size;
  const height = size;
  const { matrix, gridSize } = buildQrMatrix(text);

  // 8-bit grayscale (colorType = 0): each scanline has 1 filter byte (0) + width bytes
  const rowStride = 1 + width;
  const rawScanlines = new Uint8Array(height * rowStride);
  const scale = 7;
  const margin = 32; // 32 + 25*7 + 33 = 240
  const qrSpan = gridSize * scale;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawScanlines[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      if (y < margin || y >= margin + qrSpan || x < margin || x >= margin + qrSpan) {
        rawScanlines[rowOffset + 1 + x] = 255;
      } else {
        const mr = Math.floor((y - margin) / scale);
        const mc = Math.floor((x - margin) / scale);
        rawScanlines[rowOffset + 1 + x] = matrix[mr][mc] ? 28 : 255;
      }
    }
  }

  // Wrap rawScanlines into uncompressed zlib store blocks (max 65535 bytes per block)
  const maxBlock = 65535;
  const numBlocks = Math.ceil(rawScanlines.length / maxBlock) || 1;
  const zlibData = new Uint8Array(2 + numBlocks * 5 + rawScanlines.length + 4);
  zlibData[0] = 0x78;
  zlibData[1] = 0x01;

  let zOffset = 2;
  for (let b = 0; b < numBlocks; b++) {
    const start = b * maxBlock;
    const end = Math.min(start + maxBlock, rawScanlines.length);
    const len = end - start;
    const nlen = (~len) & 0xffff;
    const isFinal = b === numBlocks - 1 ? 1 : 0;

    zlibData[zOffset++] = isFinal;
    zlibData[zOffset++] = len & 0xff;
    zlibData[zOffset++] = (len >>> 8) & 0xff;
    zlibData[zOffset++] = nlen & 0xff;
    zlibData[zOffset++] = (nlen >>> 8) & 0xff;
    zlibData.set(rawScanlines.subarray(start, end), zOffset);
    zOffset += len;
  }

  writeUint32BE(zlibData, zOffset, adler32(rawScanlines));

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = new Uint8Array(13);
  writeUint32BE(ihdrData, 0, width);
  writeUint32BE(ihdrData, 4, height);
  ihdrData[8] = 8; // Bit depth 8
  ihdrData[9] = 0; // Color type 0 (grayscale)
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk("IHDR", ihdrData);
  const idatChunk = makeChunk("IDAT", zlibData);
  const iendChunk = makeChunk("IEND", new Uint8Array(0));

  const pngBytes = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let offset = 0;
  pngBytes.set(signature, offset);
  offset += signature.length;
  pngBytes.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  pngBytes.set(idatChunk, offset);
  offset += idatChunk.length;
  pngBytes.set(iendChunk, offset);

  return "data:image/png;base64," + uint8ToBase64(pngBytes);
}
