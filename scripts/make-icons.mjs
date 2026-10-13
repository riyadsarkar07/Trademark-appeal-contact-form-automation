import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'icons'), { recursive: true });

function png(size, bytes) {
  // Minimal valid PNG: 1x1 navy pixel scaled conceptually via IHDR size.
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  const ihdr = chunk('IHDR', ihdrData);
  const raw = Buffer.alloc((size * 3 + 1) * size, 0);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = 0x1e;
      raw[i + 1] = 0x3a;
      raw[i + 2] = 0x8a;
    }
  }
  const zlib = yieldZlib(raw);
  const idat = chunk('IDAT', zlib);
  const iend = chunk('IEND', Buffer.alloc(0));
  const out = Buffer.concat([signature, ihdr, idat, iend]);
  writeFileSync(resolve(root, 'icons', `icon${size}.png`), out);
  return bytes;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(buf) {
  let a = 1;
  let b = 0;
  for (const byte of buf) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function yieldZlib(raw) {
  const blocks = [];
  const max = 65535;
  for (let offset = 0; offset < raw.length; offset += max) {
    const slice = raw.subarray(offset, Math.min(offset + max, raw.length));
    const last = offset + max >= raw.length ? 1 : 0;
    const header = Buffer.from([last, slice.length & 0xff, (slice.length >> 8) & 0xff, ~slice.length & 0xff, (~slice.length >> 8) & 0xff]);
    blocks.push(header, slice);
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(adler32(raw), 0);
  return Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, adler]);
}

png(16);
png(48);
png(128);
