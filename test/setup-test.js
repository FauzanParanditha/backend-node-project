import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { web } from "../src/application/web.js";
import { registerAdmin } from "../src/service/adminService.js";
import { createIpWhitelist } from "../src/service/ipWhitelistService.js";

let mongoServer;

export const setupMongo = async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
};

export const closeMongo = async () => {
    // Cleanup after tests
    try {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    } catch (err) {
        console.error("Error during Mongo cleanup:", err);
    }
};

export const login = async () => {
    let authToken;

    const result = await registerAdmin({
        email: "test@test.id",
        password: "Test@1234",
        fullName: "New Admin",
    });

    await createIpWhitelist({
        adminId: result._id,
        ipAddress: "::ffff:127.0.0.1",
    });

    const loginResponse = await request(web).post("/adm/auth/login").send({
        email: "test@test.id",
        password: "Test@1234",
    });
    authToken = loginResponse.body.token;

    const me = await request(web).get("/me").set("Authorization", `Bearer ${authToken}`);

    return { authToken, me: me.body.data };
};
