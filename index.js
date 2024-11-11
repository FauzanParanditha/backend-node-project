import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import authRouter from "./routers/authRouter.js";
import userRouter from "./routers/users/userRouter.js";
import adminRouter from "./routers/adminRouter.js";
import categoryRouter from "./routers/categoryRouter.js";
import productRouter from "./routers/productRouter.js";
import orderRouter from "./routers/orderRouter.js";
import paymentRouter from "./routers/paymentRouter.js";
import ipWhitelistRouter from "./routers/ipWhitelistRouter.js";
import Admin from "./models/adminModel.js";
import { jwtMiddlewareAdmin } from "./middlewares/admin_jwt.js";
import { ensureUploadsDirExists } from "./utils/helper.js";
import apiLogger from "./middlewares/apiLog.js";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import logger from "./utils/logger.js";

dotenv.config();

ensureUploadsDirExists();
const app = express();

let serverIsClosing = false;
app.use((req, res, next) => {
  if (serverIsClosing) {
    res.status(503).json({
      errors: true,
      message: "Server is shutting down, no new requests accepted.",
    });
  } else {
    next();
  }
});

app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLogger);

// Define the rate limit rule
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

//route
app.use("/adm/auth", authRouter);
app.use("/api/adm", adminRouter);
app.use("/api", ipWhitelistRouter);
app.use("/api", categoryRouter);
app.use("/api", productRouter);
app.use("/api", orderRouter);
app.use("/api", paymentRouter);
app.use("/auth", userRouter);

app.get("/", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    message: "Hello World!",
    database: dbStatus,
  });
});

app.get("/me", jwtMiddlewareAdmin, async (req, res) => {
  try {
    const { adminId, verified } = req.admin;
    if (!adminId) throw new Error("Admin ID not provided");

    const existAdmin = await Admin.findById(adminId);
    if (!existAdmin) throw new Error("Admin does not exist");

    res.status(200).json({
      success: true,
      message: "Admin data retrieved successfully",
      data: existAdmin,
    });
  } catch (error) {
    logger.error(error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(process.env.PORT, () => {
  connectDB();
  logger.info(`App running on port: ${process.env.PORT}`);
});

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
