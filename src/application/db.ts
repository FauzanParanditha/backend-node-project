import mongoose from "mongoose";
import logger from "./logger.js";

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI as string);
        logger.info(`Mongo DB Connected: ${conn.connection.host}`);
    } catch (error) {
        const err = error as Error;
        logger.error(`Error ${err.message}`);
        process.exit(1); // process code 1 means exit with failure, 0 means success
    }
};
