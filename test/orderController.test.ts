import axios from "axios";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { web } from "../src/application/web.js";
import Admin from "../src/models/adminModel.js";
import Client from "../src/models/clientModel.js";
import Order from "../src/models/orderModel.js";
import Role from "../src/models/roleModel.js";
import { ALL_PERMISSIONS } from "../src/constants/permissions.js";
import * as paylabs from "../src/service/paylabs.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

// Mock axios globally
vi.mock("axios");

describe("POST /api/v1/order/create/link", () => {
    beforeAll(async () => {
        await setupMongo();

        // Seed a role
        const role = await Role.create({
            name: "admin",
            permissions: ALL_PERMISSIONS,
            isSystem: true,
        });

        // Seed an Admin first because Client requires adminId
        const admin = await Admin.create({
            email: "admin2@test.com",
            fullName: "Test Admin 2",
            password: "hashedPassword123",
            roleId: role._id,
            verified: true,
        });

        // Seed a Client (Partner) for the jwtMiddlewareVerify to find
        await Client.create({
            clientId: "PARTNER-TEST-123",
            name: "Test Partner",
            userIds: ["60b9b0b9e6b3f3b9b4f9b9a1"], // Dummy MongoDB ObjectId
            adminId: admin._id,
            active: true,
        });

        // Mock signature verification to always pass during this test suite
        vi.spyOn(paylabs, "verifySignatureMiddleware").mockResolvedValue(true);
        vi.spyOn(paylabs, "verifySignatureForward").mockReturnValue(true);
    });

    afterAll(async () => {
        await clearDatabase();
        await closeMongo();
        vi.restoreAllMocks();
    });

    it("should successfully create an order and return a payment link", async () => {
        // Mock the resolved value of axios.post to simulate a successful Paylabs response
        const mockPaylabsResponse = {
            data: {
                errCode: "0",
                paymentUrl: "https://paylabs-mock.com/checkout/12345",
                merchantTradeNo: "PL-dummy-trade-no",
            },
        };
        (axios.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockPaylabsResponse);

        const orderPayload = {
            items: [
                {
                    id: "item-1",
                    price: "50000",
                    quantity: 2,
                    name: "Test Product",
                    type: "digital",
                },
            ],
            totalAmount: "100000",
            phoneNumber: "08123456789",
            paymentMethod: "paylabs",
        };

        const response = await request(web)
            .post("/api/v1/order/create/link")
            .set("x-partner-id", "PARTNER-TEST-123")
            .set("x-signature", "dummy-signature")
            .set("x-timestamp", "2026-03-01T10:00:00Z")
            .set("x-signer", "backend") // Use backend signer
            .send(orderPayload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(typeof response.body.paymentLink).toBe("string");
        // It wraps the backend generate link with an encrypted payload: /payment?q=...
        expect(response.body.paymentLink).toContain("/payment?q=");
    });

    it("should successfully hit the Paylabs gateway and save Order via /order/create", async () => {
        // Mock the resolved value of axios.post to simulate a successful Paylabs response
        const mockPaylabsResponse = {
            data: {
                errCode: "0",
                url: "https://paylabs-mock.com/checkout/12345",
                merchantTradeNo: "PL-dummy-trade-no",
            },
        };
        (axios.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockPaylabsResponse);

        const orderPayload = {
            items: [
                {
                    id: "item-1",
                    price: "50000",
                    quantity: 2,
                    name: "Test QRIS Payment",
                    type: "digital",
                },
            ],
            totalAmount: "100000",
            phoneNumber: "08123456789",
            paymentMethod: "paylabs",
            paymentType: "QRIS",
        };

        const response = await request(web)
            .post("/api/v1/order/create")
            .set("x-partner-id", "PARTNER-TEST-123")
            .set("x-signature", "dummy-signature")
            .set("x-timestamp", "2026-03-01T10:00:00Z")
            .set("x-signer", "backend")
            .send(orderPayload);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.paymentLink).toBe("https://paylabs-mock.com/checkout/12345");

        // Verify the order was actually saved in the database
        const savedOrder = await Order.findOne({ clientId: "PARTNER-TEST-123", paymentMethod: "paylabs" });
        expect(savedOrder).not.toBeNull();
        expect(savedOrder?.paymentStatus).toBe("pending");
        expect(savedOrder?.totalAmount).toBe(100000);
        expect(savedOrder?.items[0].name).toBe("Test QRIS Payment");
        expect(savedOrder?.paymentId).toBe("PL-dummy-trade-no");
    });
});
