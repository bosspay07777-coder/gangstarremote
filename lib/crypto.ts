import crypto from "crypto";
const key = () => Buffer.from(process.env.ENCRYPTION_KEY || "0".repeat(64), "hex");
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("hex"), c.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}
export function decrypt(blob: string) {
  const [iv, tag, data] = blob.split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  d.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([d.update(Buffer.from(data, "hex")), d.final()]).toString("utf8");
}
export function mask(s: string) { return s.length <= 8 ? "••••" : s.slice(0, 4) + "••••" + s.slice(-4); }
