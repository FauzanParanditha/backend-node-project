import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";

export function generateUniversalKeyPair(): void {
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

    const outputDir = path.join(process.cwd(), "hackathon");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    fs.writeFileSync(path.join(outputDir, "private-key.pem"), privateKey);
    fs.writeFileSync(path.join(outputDir, "public-key.pem"), publicKey);

    console.log("✅ RSA 2048-bit Keypair Generated!");
    console.log(`🗝️ Private Key: ${path.join(outputDir, "private-key.pem")}`);
    console.log(`🔓 Public Key: ${path.join(outputDir, "public-key.pem")}`);
}

generateUniversalKeyPair();
