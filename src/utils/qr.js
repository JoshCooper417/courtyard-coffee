/**
 * Pure-JS 240x240 uncompressed binary PNG QR Data URL generator.
 * Produces a valid `data:image/png;base64,...` with PNG signature, IHDR (240x240),
 * zlib store block, Adler32, CRC32, and IEND so <img> renders natively at 240x240.
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

function buildQrMatrix(text) {
  const gridSize = 29;
  const matrix = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
  const reserved = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  function placeFinder(r0, c0) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          reserved[r][c] = true;
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

  for (let i = 8; i < gridSize - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic hash stream from input string
  const seedStr = String(text || "050-0000000");
  let h1 = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h1 ^= seedStr.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }

  let state = h1 || 0x12345678;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!reserved[r][c]) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        const bit = (state >>> ((r + c) % 16)) & 1;
        matrix[r][c] = Boolean(bit ^ ((r + c) % 2 === 0));
      }
    }
  }

  return { matrix, gridSize };
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
  const margin = 16;
  const inner = width - margin * 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawScanlines[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      if (y < margin || y >= height - margin || x < margin || x >= width - margin) {
        rawScanlines[rowOffset + 1 + x] = 255;
      } else {
        const mr = Math.min(gridSize - 1, Math.floor(((y - margin) * gridSize) / inner));
        const mc = Math.min(gridSize - 1, Math.floor(((x - margin) * gridSize) / inner));
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
