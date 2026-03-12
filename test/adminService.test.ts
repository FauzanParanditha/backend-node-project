import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Admin from "../src/models/adminModel.js";
import Client from "../src/models/clientModel.js";
import Order from "../src/models/orderModel.js";
import Role from "../src/models/roleModel.js";
import { ALL_PERMISSIONS } from "../src/constants/permissions.js";
import User from "../src/models/userModel.js";
import { dashboard } from "../src/service/adminService.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

describe("Admin Service - Dashboard Analytics", () => {
    beforeAll(async () => {
        await setupMongo();

        // Seed a role
        const role = await Role.create({
            name: "admin",
            permissions: ALL_PERMISSIONS,
            isSystem: true,
        });

        // 1. Seed Admin
        const admin = await Admin.create({
            email: "analytic_admin@test.com",
            fullName: "Analytic Admin",
            password: "hashedPassword123",
            roleId: role._id,
            verified: true,
        });

        // 2. Seed User
        const user = await User.create({
            email: "analytic_user@test.com",
            fullName: "Analytic User",
            password: "hashedPassword123",
            verified: true,
        });

        // 3. Seed 2 Clients
        const clientA = await Client.create({
            clientId: "CLIENT-A",
            name: "Partner A",
            userIds: [user._id],
            adminId: admin._id,
            active: true,
        });

        const clientB = await Client.create({
            clientId: "CLIENT-B",
            name: "Partner B",
            userIds: [user._id],
            adminId: admin._id,
            active: true,
        });

        // 4. Seed 10 Orders with different statuses and payment types
        const commonItems = [{ id: "item", name: "digital", price: 10000, quantity: 1, type: "digital" }];

        const orders = [
            // Client A: 3 paid (2 QRIS, 1 BCAVA), 1 pending (QRIS), 1 failed (QRIS)
            {
                orderId: "A1",
                paymentId: "PA1",
                clientId: "CLIENT-A",
                paymentStatus: "paid",
                totalAmount: 50000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "A2",
                paymentId: "PA2",
                clientId: "CLIENT-A",
                paymentStatus: "paid",
                totalAmount: 75000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "A3",
                paymentId: "PA3",
                clientId: "CLIENT-A",
                paymentStatus: "paid",
                totalAmount: 100000,
                paymentMethod: "paylabs",
                paymentType: "BCAVA",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "A4",
                paymentId: "PA4",
                clientId: "CLIENT-A",
                paymentStatus: "pending",
                totalAmount: 20000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "A5",
                paymentId: "PA5",
                clientId: "CLIENT-A",
                paymentStatus: "failed",
                totalAmount: 15000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },

            // Client B: 3 paid (QRIS), 1 expired (OVO), 1 paid (ShopeePay)
            {
                orderId: "B1",
                paymentId: "PB1",
                clientId: "CLIENT-B",
                paymentStatus: "paid",
                totalAmount: 30000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "B2",
                paymentId: "PB2",
                clientId: "CLIENT-B",
                paymentStatus: "paid",
                totalAmount: 30000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "B3",
                paymentId: "PB3",
                clientId: "CLIENT-B",
                paymentStatus: "paid",
                totalAmount: 30000,
                paymentMethod: "paylabs",
                paymentType: "QRIS",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "B4",
                paymentId: "PB4",
                clientId: "CLIENT-B",
                paymentStatus: "expired",
                totalAmount: 50000,
                paymentMethod: "paylabs",
                paymentType: "OVO",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
            {
                orderId: "B5",
                paymentId: "PB5",
                clientId: "CLIENT-B",
                paymentStatus: "paid",
                totalAmount: 25000,
                paymentMethod: "paylabs",
                paymentType: "ShopeePay",
                phoneNumber: "08",
                payer: "P",
                items: commonItems,
            },
        ];

        await Order.insertMany(orders);
    });

    afterAll(async () => {
        await clearDatabase();
        await closeMongo();
    });

    it("should correctly calculate all-time global dashboard aggregations", async () => {
        const result = await dashboard({ period: "all_time" });

        expect(result.success).toBe(true);
        expect(result.client).toBe(2);
        expect(result.user).toBe(1);
        expect(result.order).toBe(10); // total records

        // Total paid transactions: 3 from Client A + 4 from Client B = 7
        expect(result.totalTransactionSuccess).toBe(7);

        // Total amount (only paid):
        // Client A: 50000 + 75000 + 100000 = 225000
        // Client B: 30000 + 30000 + 30000 + 25000 = 115000
        // Total: 340000
        expect(result.totalAmountSuccess).toBe(340000);

        // Status Breakdown Check
        expect(result.byStatus["paid"].count).toBe(7);
        expect(result.byStatus["paid"].amount).toBe(340000);

        expect(result.byStatus["pending"].count).toBe(1);
        expect(result.byStatus["pending"].amount).toBe(20000);

        expect(result.byStatus["failed"].count).toBe(1);
        expect(result.byStatus["expired"].count).toBe(1);

        // Payment Method Breakdown Check (contains all status)
        // QRIS: 2 (A paid) + 1 (A pending) + 1 (A failed) + 3 (B paid) = 7
        const qrisBreakdown = result.byPaymentMethod.find((b: any) => b.method === "QRIS");
        expect(qrisBreakdown).toBeDefined();
        expect(qrisBreakdown!.count).toBe(7);
        // QRIS total amount (including unpaid): 50k+75k+20k+15k+30k+30k+30k = 250000
        expect(qrisBreakdown!.amount).toBe(250000);

        // Client Breakdown (Top clients by PAID amount)
        const clientA_Breakdown = result.byClient.find((c: any) => c.clientId === "CLIENT-A");
        expect(clientA_Breakdown!.amount).toBe(225000); // 50k+75k+100k

        const clientB_Breakdown = result.byClient.find((c: any) => c.clientId === "CLIENT-B");
        expect(clientB_Breakdown!.amount).toBe(115000); // 30k+30k+30k+25k
    });

    it("should correctly filter dashboard aggregations by specific clientId", async () => {
        const result = await dashboard({ period: "all_time", clientId: "CLIENT-A" });

        // Total orders specific to Client A is 5
        expect(result.order).toBe(5);
        expect(result.totalTransactionSuccess).toBe(3); // 3 paid orders
        expect(result.totalAmountSuccess).toBe(225000);

        expect(result.byStatus["paid"].count).toBe(3);
        expect(result.byStatus["pending"].count).toBe(1);
    });
});
