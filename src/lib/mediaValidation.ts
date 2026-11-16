// Bounded container checks complement malware scanning; they are not a codec decoder.
export function validateMedia(data: Buffer, mime: string) {
  const dimensions = (width: number, height: number) => {
    if (!width || !height || width > 16384 || height > 16384 || width * height > 40000000) throw new Error("Image exceeds the 40 megapixel limit.");
  };
  if (mime === "image/png") {
    if (data.length < 45 || data.toString("ascii", 12, 16) !== "IHDR" || data.toString("ascii", data.length - 8, data.length - 4) !== "IEND") throw new Error("Incomplete PNG.");
    dimensions(data.readUInt32BE(16), data.readUInt32BE(20));
  } else if (mime === "image/jpeg") {
    if (data.length < 8 || data[data.length - 2] !== 255 || data[data.length - 1] !== 217) throw new Error("Incomplete JPEG.");
    let offset = 2, found = false;
    while (offset + 4 < data.length) {
      const marker = data[offset + 1];
      if (data[offset] !== 255) throw new Error("Invalid JPEG marker.");
      if (marker === 0xda) break;
      const length = data.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > data.length) throw new Error("Invalid JPEG segment.");
      if ([0xc0, 0xc1, 0xc2].includes(marker)) { if (length < 8) throw new Error("Invalid JPEG frame."); dimensions(data.readUInt16BE(offset + 7), data.readUInt16BE(offset + 5)); found = true; }
      offset += length + 2;
    }
    if (!found) throw new Error("Unsupported JPEG frame.");
  } else if (mime === "image/webp") {
    if (data.length < 25 || data.readUInt32LE(4) + 8 !== data.length) throw new Error("Invalid WebP container.");
    const type = data.toString("ascii", 12, 16);
    if (type === "VP8X" && data.length >= 30) dimensions(data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1);
    else if (type === "VP8 " && data.length >= 30) dimensions(data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff);
    else if (type === "VP8L" && data[20] === 0x2f) { const bits = data.readUInt32LE(21); dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1); }
    else throw new Error("Unsupported WebP frame.");
  } else if (mime === "application/pdf") {
    if (!/^%PDF-\d\.\d/.test(data.toString("ascii", 0, 8)) || !data.subarray(-1024).includes(Buffer.from("%%EOF"))) throw new Error("Incomplete PDF.");
    if (/\/Encrypt\b/.test(data.toString("latin1"))) throw new Error("Encrypted PDFs cannot be scanned reliably.");
  } else if (mime === "video/mp4") {
    let found = false;
    const atoms = (start: number, end: number, depth: number) => {
      if (depth > 2) return;
      let offset = start;
      while (offset + 8 <= end) {
        let size = data.readUInt32BE(offset), header = 8;
        const type = data.toString("ascii", offset + 4, offset + 8);
        if (size === 1) { if (offset + 16 > end) throw new Error("Invalid MP4 atom."); size = Number(data.readBigUInt64BE(offset + 8)); header = 16; }
        if (!size) size = end - offset;
        if (!Number.isSafeInteger(size) || size < header || offset + size > end) throw new Error("Invalid MP4 container.");
        if (type === "moov") atoms(offset + header, offset + size, depth + 1);
        if (type === "mvhd") {
          const p = offset + header, version = data[p]; let scale = 0, duration = 0;
          if (version === 0 && p + 20 <= offset + size) { scale = data.readUInt32BE(p + 12); duration = data.readUInt32BE(p + 16); }
          else if (version === 1 && p + 32 <= offset + size) { scale = data.readUInt32BE(p + 20); duration = Number(data.readBigUInt64BE(p + 24)); }
          if (!scale || duration / scale > 600) throw new Error("MP4 duration must be verifiable and at most 10 minutes.");
          found = true;
        }
        offset += size;
      }
    };
    atoms(0, data.length, 0);
    if (!found) throw new Error("Export a standard MP4 with duration metadata.");
  }
}
