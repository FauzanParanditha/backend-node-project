import crypto from "crypto";
import fs from "fs";
import { generateTimestamp, minifyJson } from "../src/service/paylabs.js";

const privateKeyPem: string = fs.readFileSync("./generated-keys/private-key.pem", "utf8");

const httpMethod: string = "GET";
const endpointUrl: string = "/api/v1/order/create/link";
const body: Record<string, any> = {
    items: [
        {
            id: "671f3ac",
            price: "900000000",
            quantity: 1,
            name: "sample sample",
            type: "sample sample",
        },
    ],
    totalAmount: "900000000",
    phoneNumber: "1234567890",
    paymentMethod: "paylabs",
};

const timestamp: string = generateTimestamp();

const minifiedBody: string = minifyJson(body);
console.log(`verify minifiedBody (length): ${minifiedBody.length}`);
console.log(`minifiedBody: ${minifiedBody}`);
const hashedBody: string = crypto.createHash("sha256").update(minifiedBody, "utf8").digest("hex").toLowerCase();
console.log("Raw Data for signing:", hashedBody);

const stringContent: string = `${httpMethod}:${endpointUrl}:${hashedBody}:${timestamp}`;
console.info(`String content for signature create: ${stringContent}`);

const signer: crypto.Sign = crypto.createSign("RSA-SHA256");
signer.update(stringContent);
signer.end();

const signature: string = signer.sign(privateKeyPem, "base64");

console.log("Signature:", signature);
console.log("Timestamp:", timestamp);
