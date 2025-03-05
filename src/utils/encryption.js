import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const AES_ALGORITHM = "aes-256-cbc";
const HMAC_ALGORITHM = "sha256";

const encryptionKey = process.env.ENCRYPTION_KEY || "";
const hmacKey = process.env.HMAC_KEY || "";

if (encryptionKey.length !== 64 || hmacKey.length !== 64) {
    throw new Error("ENCRYPTION_KEY dan HMAC_KEY harus 32-byte (64 hex karakter).");
}

const key = Buffer.from(encryptionKey, "hex");
const hmacKeyBuffer = Buffer.from(hmacKey, "hex");

export const encryptData = (data) => {
    const iv = randomBytes(16); // Generate IV untuk AES
    const cipher = createCipheriv(AES_ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
    encrypted += cipher.final("base64");

    const encryptedPayload = `${iv.toString("hex")}:${encrypted}`;

    // Buat HMAC untuk integritas data
    const hmac = createHmac(HMAC_ALGORITHM, hmacKeyBuffer);
    hmac.update(encryptedPayload);
    const hmacDigest = hmac.digest("hex");

    return `${encryptedPayload}:${hmacDigest}`;
};

export const decryptData = (data) => {
    try {
        const parts = data.split(":");
        if (parts.length !== 3) throw new Error("Format terenkripsi tidak valid.");

        const [ivHex, encryptedData, hmacDigest] = parts;

        const encryptedPayload = `${ivHex}:${encryptedData}`;

        // Validasi HMAC sebelum dekripsi
        const hmac = createHmac(HMAC_ALGORITHM, hmacKeyBuffer);
        hmac.update(encryptedPayload);
        const calculatedHmac = hmac.digest("hex");

        if (calculatedHmac !== hmacDigest) {
            throw new Error("HMAC tidak cocok, data mungkin telah dimodifikasi!");
        }

        // Dekripsi setelah validasi HMAC
        const iv = Buffer.from(ivHex, "hex");
        const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedData, "base64", "utf8");
        decrypted += decipher.final("utf8");

        return JSON.parse(decrypted);
    } catch (error) {
        console.error("Decryption error:", error);
        throw new Error("Failed to decrypt data.");
    }
};
