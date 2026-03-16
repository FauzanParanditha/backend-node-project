import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

/**
 * Setup a completely new in-memory MongoDB instance.
 * Call this inside `beforeAll` of your test suites.
 */
export const setupMongo = async (): Promise<void> => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Disconnect if already connected
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    await mongoose.connect(uri);
};

/**
 * Close the connection and stop the in-memory server.
 * Call this inside `afterAll` of your test suites.
 */
export const closeMongo = async (): Promise<void> => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
};

/**
 * Drop database, clear all collections.
 * Call this inside `afterEach` if you want a fresh DB per test,
 * OR keep it manual if test cases rely on earlier seeded states.
 */
export const clearDatabase = async (): Promise<void> => {
    if (mongoose.connection.readyState === 0) return;

    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};
