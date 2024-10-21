import pkg from "bcryptjs";
import { createHmac } from "crypto";
const { hash, compare } = pkg;

export const doHash = (value, saltValue) => {
  const result = hash(value, saltValue);
  return result;
};

export const compareDoHash = (value, hashedValue) => {
  const result = compare(value, hashedValue);
  return result;
};

export const hmacProcess = (value, key) => {
  const result = createHmac("sha256", key).update(value).digest("hex");
  return result;
};

export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
