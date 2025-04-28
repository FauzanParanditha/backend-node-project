// generateUniversalKeypair.js
import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";

export function generateUniversalKeyPair() {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: "spki",
            format: "pem",
        },
        privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
        },
    });

    const outputDir = path.join(process.cwd(), "generated-keys");

    // Cek dan buat folder jika belum ada
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    // Simpan file ke folder
    fs.writeFileSync(path.join(outputDir, "private-key.pem"), privateKey);
    fs.writeFileSync(path.join(outputDir, "public-key.pem"), publicKey);

    console.log("✅ RSA 2048-bit Keypair Generated!");
    console.log(`🗝️ Private Key: ${path.join(outputDir, "private-key.pem")}`);
    console.log(`🔓 Public Key: ${path.join(outputDir, "public-key.pem")}`);
}

// Jalankan
generateUniversalKeyPair();
