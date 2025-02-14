import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import path, { dirname } from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import { jwtMiddlewareAdmin } from "../middlewares/admin_jwt.js";
import apiLogger from "../middlewares/apiLog.js";
import { errorMiddleware } from "../middlewares/errorMiddleware.js";
import Admin from "../models/adminModel.js";
import adminRouter from "../routers/adminRouter.js";
import authRouter from "../routers/authRouter.js";
import authRouterUser from "../routers/authRouterUser.js";
import availablePaymentRouter from "../routers/availablePaymentRoute.js";
import categoryRouter from "../routers/categoryRouter.js";
import clientRouter from "../routers/clientRouter.js";
import ipWhitelistRouter from "../routers/ipWhitelistRouter.js";
import orderRouter from "../routers/orderRouter.js";
import paymentRouter from "../routers/paymentRouter.js";
import productRouter from "../routers/productRouter.js";
import userRouter from "../routers/userRouter.js";
import { generateHeadersForward, generateRequestId, verifySignatureForward } from "../service/paylabs.js";
import swaggerSpec from "../swagger.js";
import { ensureUploadsDirExists } from "../utils/helper.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ensureUploadsDirExists();
export const web = express();

web.set("trust proxy", ["loopback", "10.10.200.1"]);

web.use(
    cors({
        origin: (origin, callback) => {
            const allowedOrigins = [process.env.FRONTEND_URL, process.env.FRONTEND_URL_APPS_2];
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    }),
);
web.use("/api/v1/order/webhook/paylabs", express.raw({ type: "application/json" }));
web.use(helmet());
web.use(cookieParser());
web.use(express.json());
web.use(express.urlencoded({ extended: true }));
web.use(apiLogger);
web.use(
    "/public",
    express.static(path.join(__dirname, "../public"), {
        setHeaders: (res) => {
            res.set("Cross-Origin-Resource-Policy", "cross-origin"); // Add CORP header
        },
    }),
);
web.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["https:", "wss://wss.api.pg.pandi.id"],
        },
    }),
);

// Define the rate limit rule
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
});
web.use(limiter);

// Swagger UI
web.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
web.get("/swagger.json", (req, res) => {
    res.json(swaggerSpec);
});

// ReDoc
web.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "script-src 'self' https://cdn.redoc.ly; worker-src 'self' blob:");
    next();
});

web.get("/redoc", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>API Documentation</title>
            <link rel="icon" type="image/x-icon" href="../public/images/favicon.ico">
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        </head>
        <body>
            <redoc spec-url='/swagger.json'></redoc>
            <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        </body>
        </html>
    `);
});

//route
web.use("/adm/auth", authRouter);
web.use("/api/v1/auth", authRouterUser);
web.use("/api/v1/adm", adminRouter);
web.use("/api/v1", ipWhitelistRouter);
web.use("/api/v1", availablePaymentRouter);
web.use("/api/v1", categoryRouter);
web.use("/api/v1", productRouter);
web.use("/api/v1", clientRouter);
web.use("/api/v1", orderRouter);
web.use("/api/v1", paymentRouter);
web.use("/api/v1", userRouter);

web.get("/", (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({
        message: "Hello World!",
        connection: dbStatus,
    });
});

// test purpose only
web.post("/callback", express.raw({ type: "application/json" }), (req, res) => {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp } = req.headers;
    const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

    if (!verifySignatureForward(httpMethod, endpointUrl, payload, timestamp, signature)) {
        return res.status(401).send("Invalid signature");
    }

    // Retrieve notification data and order
    const notificationData = payload;

    const responsePayload = (errorCode, errCodeDes) => {
        const errCodeFromNotification =
            notificationData?.errCode ??
            (notificationData?.responseCode === "2003100" ? "0" : notificationData?.responseCode);

        return {
            clientId: "CLNT-12345",
            requestId: generateRequestId(),
            errCode: errorCode ?? errCodeFromNotification ?? "0",
            ...(errCodeDes && { errCodeDes: errCodeDes }),
        };
    };

    const payloadResponse = responsePayload();

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
        const { adminId } = req.admin;
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
