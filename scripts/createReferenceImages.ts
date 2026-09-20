import fs from 'fs';
import path from 'path';

// Generate a valid uncompressed PNG file in pure TypeScript
function createSolidPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR.writeUInt8(8, 8); // bit depth
  IHDR.writeUInt8(2, 9); // color type 2 (RGB)
  IHDR.writeUInt8(0, 10); // compression
  IHDR.writeUInt8(0, 11); // filter
  IHDR.writeUInt8(0, 12); // interlace

  // Raw scanlines: filter byte (0) + RGB samples
  const lineLength = 1 + width * 3;
  const rawData = Buffer.alloc(height * lineLength);
  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineLength;
    rawData.writeUInt8(0, lineOffset); // None filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 3;
      // Add subtle gradient pattern
      const grad = Math.sin((x / width) * Math.PI) * 0.2;
      rawData.writeUInt8(Math.min(255, Math.floor(r * (1 + grad))), pixelOffset);
      rawData.writeUInt8(Math.min(255, Math.floor(g * (1 + grad))), pixelOffset + 1);
      rawData.writeUInt8(Math.min(255, Math.floor(b * (1 + grad))), pixelOffset + 2);
    }
  }

  // Deflate in uncompressed blocks (RFC 1951)
  const zlibHeader = Buffer.from([0x78, 0x01]); // deflate, 32k window
  const blockSize = 65535;
  const blocks: Buffer[] = [];
  let remaining = rawData.length;
  let offset = 0;

  while (remaining > 0) {
    const currentSize = Math.min(remaining, blockSize);
    remaining -= currentSize;
    const isFinal = remaining === 0;
    const blockHeader = Buffer.alloc(5);
    blockHeader.writeUInt8(isFinal ? 1 : 0, 0);
    blockHeader.writeUInt16LE(currentSize, 1);
    blockHeader.writeUInt16LE(currentSize ^ 0xffff, 3);
    blocks.push(blockHeader);
    blocks.push(rawData.subarray(offset, offset + currentSize));
    offset += currentSize;
  }

  // Adler32 checksum
  let a = 1;
  let s = 0;
  for (let i = 0; i < rawData.length; i++) {
    a = (a + rawData[i]) % 65521;
    s = (s + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt16BE(s, 0);
  adler.writeUInt16BE(a, 2);

  const IDAT_data = Buffer.concat([zlibHeader, ...blocks, adler]);

  // PNG CRC32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c;
  }

  function crc32(buf: Buffer, offset: number, len: number): number {
    let c = 0xffffffff;
    for (let i = offset; i < offset + len; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const chunk = Buffer.alloc(8 + data.length + 4);
    chunk.writeUInt32BE(data.length, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crc = crc32(chunk, 4, 4 + data.length);
    chunk.writeUInt32BE(crc, 8 + data.length);
    return chunk;
  }

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', IHDR);
  const idatChunk = makeChunk('IDAT', IDAT_data);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

const saraPng = createSolidPng(640, 360, 160, 40, 100); // Sara: Cyber Magenta/Rose aesthetic
const lexiaPng = createSolidPng(640, 360, 30, 120, 180); // Lexia: Cyber Cyan/Azure aesthetic

fs.writeFileSync('references/characters/sara/identity.png', saraPng);
fs.writeFileSync('references/characters/lexia/identity.png', lexiaPng);

console.log('Successfully generated reference identity PNGs:');
console.log('- references/characters/sara/identity.png');
console.log('- references/characters/lexia/identity.png');
