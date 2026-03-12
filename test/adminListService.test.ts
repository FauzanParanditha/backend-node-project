import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Admin from "../src/models/adminModel.js";
import Role from "../src/models/roleModel.js";
import { getAllAdmins } from "../src/service/adminService.js";
import { ALL_PERMISSIONS } from "../src/constants/permissions.js";
import { clearDatabase, closeMongo, setupMongo } from "./setup-test.js";

describe("Admin Service - Admin List", () => {
    beforeAll(async () => {
        await setupMongo();
    });

    afterAll(async () => {
        await clearDatabase();
        await closeMongo();
    });

    it("includes role name when fetching admins", async () => {
        const role = await Role.create({
            name: "finance",
            permissions: ALL_PERMISSIONS,
            isSystem: true,
        });

        const admin = await Admin.create({
            email: "finance_admin@test.com",
            fullName: "Finance Admin",
            password: "hashedPassword123",
            roleId: role._id,
            verified: true,
        });

        const result = await getAllAdmins({
            query: "",
            limit: 10,
            page: 1,
            sort_by: "_id",
            sort: -1,
            countOnly: false,
        });

        expect(result.admins).toHaveLength(1);
        expect(result.admins[0]._id.toString()).toBe(admin._id.toString());
        expect(result.admins[0].role).toBe("finance");
        expect(result.admins[0].roleName).toBe("finance");
        expect(result.admins[0].roleId.toString()).toBe(role._id.toString());
    });
});
