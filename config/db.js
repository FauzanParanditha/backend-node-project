import mongoose from "mongoose";
import logger from "../utils/logger";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`Mongo DB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error ${error.message}`);
    process.exit(1); // process code 1 means exit with failure, 0 means success
  }
};
