import { createHash, createHmac, randomUUID } from "crypto";
import { mkdir, open, writeFile, unlink } from "fs/promises";
import path from "path";

export function storageMode() {
  const mode = process.env.STORAGE_DRIVER || "local";
  if (!["local", "s3"].includes(mode)) throw new Error("Invalid STORAGE_DRIVER.");
  if (mode === "local" && process.env.NODE_ENV === "production") throw new Error("Production requires S3 storage.");
  return mode;
}
export function privateRoot() {
  const root = path.resolve(process.env.PRIVATE_DATA_DIR || ".private-data");
  const relative = path.relative(path.resolve("public"), root);
  if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("Private storage cannot be inside public assets.");
  return root;
}
export function newKey(prefix: "quarantine" | "clean") { return `${prefix}/${randomUUID()}`; }
function localPath(key: string) {
  if (!/^(quarantine|clean)\/[a-f\d-]{36}$/.test(key)) throw new Error("Invalid storage key.");
  return path.join(privateRoot(), "evidence", ...key.split("/"));
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hmac = (key: string | Buffer, value: string) => createHmac("sha256", key).update(value).digest();
export function s3UploadPolicy(key: string, mime: string, size: number, checksum: string, now = new Date()) {
  const region = process.env.AWS_REGION || "us-east-1", bucket = process.env.S3_BUCKET, access = process.env.AWS_ACCESS_KEY_ID, secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !access || !secret) throw new Error("S3 credentials and bucket are required.");
  const endpoint = process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`;
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, ""), day = date.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const fields: Record<string,string> = { key, "Content-Type": mime, "x-amz-algorithm": "AWS4-HMAC-SHA256", "x-amz-credential": `${access}/${scope}`, "x-amz-date": date, "x-amz-checksum-algorithm": "SHA256", "x-amz-checksum-sha256": Buffer.from(checksum, "hex").toString("base64"), "x-amz-server-side-encryption": "AES256", success_action_status: "204" };
  if (process.env.AWS_SESSION_TOKEN) fields["x-amz-security-token"] = process.env.AWS_SESSION_TOKEN;
  const policy = Buffer.from(JSON.stringify({ expiration: new Date(now.getTime() + 300000).toISOString(), conditions: [{ bucket }, ...Object.entries(fields).map(([k,v]) => ({ [k]: v })), ["content-length-range", size, size]] })).toString("base64");
  const signing = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), "s3"), "aws4_request");
  fields.policy = policy; fields["x-amz-signature"] = createHmac("sha256", signing).update(policy).digest("hex");
  const url = `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}`;
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) throw new Error("S3 requires HTTPS.");
  return { url, fields };
}
// AWS Signature Version 4, using Node crypto. No credentials are sent to clients.
export function signedS3Url(method: string, key: string, expires = 120, now = new Date()) {
  const region = process.env.AWS_REGION || "us-east-1";
  const bucket = process.env.S3_BUCKET;
  const access = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !access || !secret) throw new Error("S3 credentials and bucket are required.");
  const endpoint = process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`;
  const url = new URL(`${endpoint.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("S3 requires HTTPS.");
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = date.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const values: Record<string, string> = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${access}/${scope}`, "X-Amz-Date": date, "X-Amz-Expires": String(expires), "X-Amz-SignedHeaders": "host" };
  if (process.env.AWS_SESSION_TOKEN) values["X-Amz-Security-Token"] = process.env.AWS_SESSION_TOKEN;
  const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const query = Object.keys(values).sort().map(k => `${encode(k)}=${encode(values[k])}`).join("&");
  const canonical = `${method}\n${url.pathname}\n${query}\nhost:${url.host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const signing = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signing).update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).digest("hex");
  return `${url.origin}${url.pathname}?${query}&X-Amz-Signature=${signature}`;
}
export async function putObject(key: string, data: Buffer, mime: string, allowIdentical = false) {
  if (storageMode() === "local") {
    const file = localPath(key); await mkdir(path.dirname(file), { recursive: true });
    try { await writeFile(file, data, { flag: "wx", mode: 0o600 }); }
    catch (error: any) { if (!allowIdentical || error.code !== "EEXIST" || !(await getObject(key, data.length)).equals(data)) throw error; }
    return;
  }
  const res = await fetch(signedS3Url("PUT", key), { method: "PUT", body: new Uint8Array(data), headers: { "Content-Type": mime, "If-None-Match": "*" }, signal: AbortSignal.timeout(120000) });
  if (!res.ok && !(allowIdentical && res.status === 412 && (await getObject(key, data.length)).equals(data))) throw new Error("Object upload failed.");
}
export async function getObject(key: string, maxBytes: number) {
  if (storageMode() === "local") {
    const file = await open(localPath(key), "r");
    try {
      const info = await file.stat(); if (!info.isFile() || info.size > maxBytes) throw new Error("Object too large or not a regular file.");
      const chunks: Buffer[] = []; let count = 0;
      for await (const chunk of file.createReadStream({ autoClose: false })) { count += chunk.length; if (count > maxBytes) throw new Error("Object too large."); chunks.push(chunk); }
      return Buffer.concat(chunks);
    } finally { await file.close(); }
  }
  const res = await fetch(signedS3Url("GET", key), { signal: AbortSignal.timeout(120000), cache: "no-store" });
  if (!res.ok || Number(res.headers.get("content-length")) > maxBytes) throw new Error("Object unavailable or too large.");
  const reader = res.body!.getReader(); const chunks: Buffer[] = []; let count = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; count += part.value.length; if (count > maxBytes) { await reader.cancel(); throw new Error("Object too large."); } chunks.push(Buffer.from(part.value)); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function deleteObject(key: string) {
  if (storageMode() === "local") { await unlink(localPath(key)).catch((e) => { if (e.code !== "ENOENT") throw e; }); return; }
  const res = await fetch(signedS3Url("DELETE", key), { method: "DELETE", signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("Object deletion failed.");
}
