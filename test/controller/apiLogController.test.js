import request from "supertest";
import { closeMongo, login, setupMongo } from "../setup-test.js";
import { web } from "../../src/application/web.js";
import ApiLog from "../../src/models/apiLogModel.js";

describe("GET /api/adm/apilogs", () => {
    let authToken, me;
    beforeAll(async () => {
        await setupMongo();
        const loginResult = await login();
        authToken = loginResult.authToken;
        me = loginResult.me._id;
    });
    afterAll(async () => {
        await closeMongo();
    });

    it("should can get apilogs", async () => {
        const res = await request(web).get("/api/adm/apilogs").set("Authorization", `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("data");
        expect(res.body).toHaveProperty("pagination");
    });

    it("should can get apilogs count", async () => {
        const res = await request(web)
            .get("/api/adm/apilogs?countOnly=true")
            .set("Authorization", `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("count");
    });

    it("should can get apilogs by id", async () => {
        const apilogs = await ApiLog.create({
            method: "POST",
            endpoint: "/api/adm/apilogs",
            headers: {
                Authorization: "Bearer ",
            },
            ipAddress: "::ffff:127.0.0.1",
        });

        const res = await request(web)
            .get(`/api/adm/apilogs?${apilogs._id}`)
            .set("Authorization", `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("data");
    });

    it("should handle pagination parameters", async () => {
        await ApiLog.insertMany(
            Array.from({ length: 50 }, (_, i) => ({
                method: "POST",
                endpoint: "/api/adm/apilogs",
                headers: {
                    Authorization: "Bearer ",
                },
                ipAddress: "::ffff:127.0.0.1",
            })),
        );

        const res = await request(web)
            .get("/api/adm/apilogs?page=2&limit=10")
            .set("Authorization", `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body.data.length).toBe(10);
        expect(res.body.pagination).toHaveProperty("currentPage", 2);
        expect(res.body.pagination).toHaveProperty("perPage", 10);
        expect(res.body.pagination).toHaveProperty("recordsOnPage", 10);
        expect(res.body.pagination).toHaveProperty("totalPages", 6);
        expect(res.body.pagination).toHaveProperty("totalRecords", 56);
    });
});
