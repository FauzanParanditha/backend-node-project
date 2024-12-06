import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "../routers/authRouter.js";
import authRouterUser from "../routers/authRouterUser.js";
import userRouter from "../routers/userRouter.js";
import adminRouter from "../routers/adminRouter.js";
import categoryRouter from "../routers/categoryRouter.js";
import productRouter from "../routers/productRouter.js";
import orderRouter from "../routers/orderRouter.js";
import paymentRouter from "../routers/paymentRouter.js";
import ipWhitelistRouter from "../routers/ipWhitelistRouter.js";
import availablePaymentRouter from "../routers/availablePaymentRoute.js";
import Admin from "../models/adminModel.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import { ensureUploadsDirExists } from "../utils/helper.js";
import apiLogger from "../middlewares/apiLog.js";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { errorMiddleware } from "../middlewares/errorMiddleware.js";
import { generateHeadersForward, generateRequestId, verifySignatureForward } from "../service/paylabs.js";

dotenv.config();

ensureUploadsDirExists();
export const web = express();

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
web.use("/api/auth", authRouterUser);
web.use("/api/adm", adminRouter);
web.use("/api", ipWhitelistRouter);
web.use("/api", availablePaymentRouter);
web.use("/api", categoryRouter);
web.use("/api", productRouter);
web.use("/api", orderRouter);
web.use("/api", paymentRouter);
web.use("/api", userRouter);

web.get("/", (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({
        message: "Hello World!",
        connection: dbStatus,
    });
});

// test purpose only
web.post("/callback", (req, res) => {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
    const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

    if (!verifySignatureForward(httpMethod, endpointUrl, payload, timestamp, signature)) {
        return res.status(401).send("Invalid signature");
    }

    // Retrieve notification data and order
    const notificationData = payload;

    const responsePayload = (errorCode, errCodeDes) => {
        return {
            requestId: generateRequestId(),
            errCode: errorCode ? errorCode : notificationData.errCode,
            ...(errCodeDes && { errCodeDes: errCodeDes }),
        };
    };

    const payloadResponse = responsePayload(0, "");

    const { headers: responseHeaders } = generateHeadersForward(
        "POST",
        "/callback",
        payloadResponse,
        generateRequestId(),
    );

    return res.set(responseHeaders).status(200).json(payloadResponse);
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
