// utils/encryption.js
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); // Ensure this is a 32-byte key

if (!key || key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte key.");
}

export const encryptData = (data) => {
    const iv = randomBytes(16); // Generate a new IV for each encryption
    const cipher = createCipheriv(algorithm, Buffer.from(key), iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");
    // Return IV and encrypted data together
    return `${iv.toString("hex")}:${encrypted}`;
};

export const decryptData = (data) => {
    const [ivHex, encryptedData] = data.split(":");
    const iv = Buffer.from(ivHex, "hex"); // Convert IV back to buffer
    const decipher = createDecipheriv(algorithm, Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
};
