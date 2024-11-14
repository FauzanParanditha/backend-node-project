import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "../routers/authRouter.js";
import userRouter from "../routers/users/userRouter.js";
import adminRouter from "../routers/adminRouter.js";
import categoryRouter from "../routers/categoryRouter.js";
import productRouter from "../routers/productRouter.js";
import orderRouter from "../routers/orderRouter.js";
import paymentRouter from "../routers/paymentRouter.js";
import ipWhitelistRouter from "../routers/ipWhitelistRouter.js";
import Admin from "../models/adminModel.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { ensureUploadsDirExists } from "../utils/helper.js";
import apiLogger from "../middlewares/apiLog.js";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { errorMiddleware } from "../middlewares/errorMiddleware.js";

dotenv.config();

ensureUploadsDirExists();
export const web = express();

let serverIsClosing = false;
web.use((req, res, next) => {
  if (serverIsClosing) {
    res.status(503).json({
      errors: true,
      message: "Server is shutting down, no new requests accepted.",
    });
  } else {
    next();
  }
});

web.use(cors());
web.use(helmet());
web.use(cookieParser());
web.use(express.json());
web.use(express.urlencoded({ extended: true }));
web.use(apiLogger);

// Define the rate limit rule
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
web.use(limiter);

//route
web.use("/adm/auth", authRouter);
web.use("/api/adm", adminRouter);
web.use("/api", ipWhitelistRouter);
web.use("/api", categoryRouter);
web.use("/api", productRouter);
web.use("/api", orderRouter);
web.use("/api", paymentRouter);
web.use("/auth", userRouter);

web.get("/", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    message: "Hello World!",
    database: dbStatus,
  });
});

web.get("/me", jwtMiddlewareAdmin, async (req, res, next) => {
  try {
    const { adminId, verified } = req.admin;
    if (!adminId) throw new ResponseError(400, "Admin ID not provided");

    const existAdmin = await Admin.findById(adminId);
    if (!existAdmin) throw new ResponseError(400, "Admin does not exist");

    res.status(200).json({
      success: true,
      message: "Admin data retrieved successfully",
      data: existAdmin,
    });
  } catch (error) {
    logger.error(error.message);
    next(error);
  }
});

web.use(errorMiddleware);
function handleShutdownGracefully(signal) {
  return () => {
    serverIsClosing = true;
    logger.info(
      `Received ${signal} signal. Starting graceful shutdown... New requests will be denied.`
    );

    // Stop accepting new connections and complete ongoing requests
    server.close(() => {
      logger.info("HTTP server closed gracefully.");

      // Close the database connection gracefully
      mongoose.connection.close(false, () => {
        logger.info("MongoDB connection closed.");
        process.exit(0); // Exit cleanly after everything is closed
      });
    });

    // Timeout as a backup to force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error("Forced shutdown due to timeout.");
      process.exit(1); // Exit with failure if cleanup takes too long
    }, 10000); // 10 seconds to allow ongoing connections to complete
  };
}

// Add graceful shutdown signals
process.on("SIGINT", handleShutdownGracefully("SIGINT"));
process.on("SIGTERM", handleShutdownGracefully("SIGTERM"));
process.on("SIGHUP", handleShutdownGracefully("SIGHUP"));
process.on("SIGQUIT", handleShutdownGracefully("SIGQUIT"));
