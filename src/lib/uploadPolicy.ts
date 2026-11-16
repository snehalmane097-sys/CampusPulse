import { ApiError } from "./api";
import { FILE_LIMITS } from "./mediaLimits";
export { MAX_FILES, MAX_TOTAL_BYTES, FILE_LIMITS } from "./mediaLimits";
export function validateUpload(mime: unknown, size: unknown, checksum: unknown) {
  if (typeof mime !== "string" || !FILE_LIMITS[mime]) throw new ApiError(415, "Use JPEG, PNG, WebP, PDF or MP4 files.");
  if (!Number.isSafeInteger(size) || Number(size) < 1 || Number(size) > FILE_LIMITS[mime] * 1024 * 1024) throw new ApiError(413, `This file exceeds the ${FILE_LIMITS[mime]} MB limit.`);
  if (typeof checksum !== "string" || !/^[a-f\d]{64}$/i.test(checksum)) throw new ApiError(400, "A SHA-256 checksum is required.");
}
export function detectedMime(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.toString("ascii", 4, 8) === "ftyp" && /isom|iso2|mp4[12]|avc1|M4V /.test(bytes.toString("ascii", 8, Math.min(64, bytes.length)))) return "video/mp4";
  return null;
}
