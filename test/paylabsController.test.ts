import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { web } from "../src/application/web.js";
import Admin from "../src/models/adminModel.js";
import Client from "../src/models/clientModel.js";
import Order from "../src/models/orderModel.js";
import * as paylabs from "../src/service/paylabs.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

describe("POST /api/v1/order/webhook/paylabs", () => {
    const TEMP_MERCHANT_ID = "MERCHANT-12345";
    let originalMerchantId: string | undefined;

    beforeAll(async () => {
        await setupMongo();

        originalMerchantId = process.env.PAYLABS_MERCHANT_ID;
        process.env.PAYLABS_MERCHANT_ID = TEMP_MERCHANT_ID;

        // Seed an Admin first because Client requires adminId
        const admin = await Admin.create({
            email: "admin_webhook@test.com",
            fullName: "Test Admin Webhook",
            password: "hashedPassword123",
            role: "admin",
            verified: true,
        });

        // Seed a Client (Partner)
        const client = await Client.create({
            clientId: TEMP_MERCHANT_ID,
            name: "Test Partner Webhook",
            userIds: ["60b9b0b9e6b3f3b9b4f9b9a2"],
            adminId: admin._id,
            active: true,
        });

        // Seed a pending order to be paid
        await Order.create({
            orderId: "ORDER-123-ABC",
            paymentId: "PL-dummy-trade-no",
            clientId: client.clientId,
            paymentStatus: "pending",
            totalAmount: 50000,
            paymentMethod: "paylabs",
            paymentType: "QRIS",
            phoneNumber: "08123456789",
            payer: "Test Payer",
            items: [
                {
                    id: "item-1",
                    price: 25000,
                    quantity: 2,
                    name: "Test Hook Product",
                    type: "digital",
                },
            ],
            // Far sequence expired time so it won't trigger "expired" block
            paymentExpired: new Date(Date.now() + 1000 * 60 * 60 * 24),
        });

        // Mock signature verification to always pass during this test block
        vi.spyOn(paylabs, "verifySignature").mockReturnValue(true);
    });

    afterAll(async () => {
        await clearDatabase();
        await closeMongo();
        vi.restoreAllMocks();

        if (originalMerchantId !== undefined) {
            process.env.PAYLABS_MERCHANT_ID = originalMerchantId;
        } else {
            delete process.env.PAYLABS_MERCHANT_ID;
        }
    });

    it("should successfully process a PAID status notification and update database", async () => {
        const payload = {
            requestId: "REQ-999-999",
            errCode: "0",
            merchantId: TEMP_MERCHANT_ID,
            paymentType: "QRIS",
            amount: 100000,
            merchantTradeNo: "PL-dummy-trade-no",
            status: "02", // 02 means paid
        };

        const response = await request(web)
            .post("/api/v1/order/webhook/paylabs")
            .set("x-partner-id", TEMP_MERCHANT_ID)
            .set("x-signature", "dummy-signature")
            .set("x-timestamp", "2026-03-01T10:00:00Z")
            .set("x-request-id", "REQ-999-999")
            .send(payload);

        // Should return 200 OK according to API design
        expect(response.status).toBe(200);
        expect(response.body.errCode).toBe("0");
        expect(response.body.merchantId).toBe(TEMP_MERCHANT_ID);

        // Verify the database order state transitioned to paid
        const order = await Order.findOne({ paymentId: "PL-dummy-trade-no" });
        expect(order).not.toBeNull();
        expect(order?.paymentStatus).toBe("paid");
        // amount is updated to whatever the webhook claims
        expect(order?.totalAmount).toBe(100000);
        expect(order?.paymentType).toBe("QRIS");
    });

    it("should reject payload with invalid signature", async () => {
        // Temporarily override the mock to return false
        vi.mocked(paylabs.verifySignature).mockReturnValueOnce(false);

        const response = await request(web)
            .post("/api/v1/order/webhook/paylabs")
            .set("x-partner-id", TEMP_MERCHANT_ID)
            .set("x-signature", "wrong-signature")
            .send({}); // Body doesn't matter since signature fails

        expect(response.status).toBe(401);
        expect(response.text).toBe("Invalid signature");
    });
});
