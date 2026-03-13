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
import apiLogger from "../middlewares/apiLog.js";
import { errorMiddleware } from "../middlewares/errorMiddleware.js";
import { jwtUnifiedMiddleware } from "../middlewares/jwtUnified.js";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import User from "../models/userModel.js";
import adminRouter from "../routers/adminRouter.js";
import authRouter from "../routers/authRouter.js";
import authRouterUser from "../routers/authRouterUser.js";
import availablePaymentRouter from "../routers/availablePaymentRoute.js";
import categoryRouter from "../routers/categoryRouter.js";
import clientAvailablePaymentRouter from "../routers/clientAvailablePaymentRouter.js";
import clientKeyRouter from "../routers/clientKeyRouter.js";
import clientRouter from "../routers/clientRouter.js";
import ipWhitelistRouter from "../routers/ipWhitelistRouter.js";
import orderRouter from "../routers/orderRouter.js";
import paymentRouter from "../routers/paymentRouter.js";
import productRouter from "../routers/productRouter.js";
import roleRouter from "../routers/roleRouter.js";
import userRouter from "../routers/userRouter.js";
import { generateHeadersForward, generateRequestId, verifySignatureMiddleware } from "../service/paylabs.js";
import swaggerSpec from "../swagger.js";
import { isAdminRole } from "../utils/authRole.js";
import { ensureUploadsDirExists } from "../utils/helper.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ensureUploadsDirExists();
export const web = express();

// K8s: trust 1 hop proxy (Ingress) - paling umum & aman
web.set("trust proxy", 1);

// logger.info(`TRUSTED_PROXY_IP=${process.env.TRUSTED_PROXY_IP}`);

// const trustedProxySet = new Set(
//     ["127.0.0.1", "::1"]
//         .concat(process.env.TRUSTED_PROXY_IP || [])
//         .map(normalizeIP)
//         .filter(Boolean),
// );

// web.set("trust proxy", (ip) => {
//     if (!ip) return false;
//     return trustedProxySet.has(normalizeIP(ip));
// });

web.use(
    cors({
        origin: (origin, callback) => {
            const allowedOrigins = [
                process.env.FRONTEND_URL,
                process.env.FRONTEND_URL_APPS_2,
                process.env.FRONTEND_URL_APPS_3,
            ];
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
// web.use(cookieParser());
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
web.get("/swagger.json", (_req, res) => {
    res.json(swaggerSpec);
});

// ReDoc
web.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy", "script-src 'self' https://cdn.redoc.ly; worker-src 'self' blob:");
    next();
});

web.get("/redoc", (_req, res) => {
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
web.use("/api/v1/auth", authRouterUser);
web.use("/adm/auth", authRouter);
web.use("/api/v1/adm", adminRouter);
web.use("/api/v1/adm", roleRouter);
web.use("/api/v1", ipWhitelistRouter);
web.use("/api/v1", availablePaymentRouter);
web.use("/api/v1", categoryRouter);
web.use("/api/v1", productRouter);
web.use("/api/v1", clientRouter);
web.use("/api/v1", clientKeyRouter);
web.use("/api/v1", clientAvailablePaymentRouter);
web.use("/api/v1", orderRouter);
web.use("/api/v1", paymentRouter);
web.use("/api/v1", userRouter);

web.get("/", (_req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({
        message: "Hello World!",
        connection: dbStatus,
    });
});

// test purpose only
web.post("/callback", express.raw({ type: "application/json" }), ((req: any, res: any) => {
    // Extract and verify signature
    const { "x-signature": signature, "x-timestamp": timestamp, "x-client-id": clientId } = req.headers;
    const { body: payload, method: httpMethod, originalUrl: endpointUrl } = req;

    if (
        !verifySignatureMiddleware(
            httpMethod,
            endpointUrl,
            payload,
            timestamp as string,
            signature as string,
            clientId as string,
        )
    ) {
        return res.status(401).send("Invalid signature");
    }

    // Retrieve notification data and order
    const notificationData = payload;

    const responsePayload = (errorCode?: string, errCodeDes?: string) => {
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
        0,
        "CLNT-12345",
    ) as any;

    return res.set(responseHeaders).status(200).json(payloadResponse);
}) as any);

web.get("/me", jwtUnifiedMiddleware, (async (req: any, res: any, next: any) => {
    try {
        const { role, adminId, userId } = req.auth ?? {};

        if (isAdminRole(role)) {
            if (!adminId) throw new ResponseError(400, "Admin ID not provided");

            const existAdmin = await Admin.findById(adminId).populate({
                path: "roleId",
                select: "name permissions",
            });
            if (!existAdmin) throw new ResponseError(400, "Admin does not exist");

            const adminObject = existAdmin.toObject();
            const roleData = adminObject.roleId as { _id?: mongoose.Types.ObjectId; name?: string; permissions?: string[] } | null;

            return res.status(200).json({
                success: true,
                message: "Admin data retrieved successfully",
                role,
                data: {
                    ...adminObject,
                    roleId: roleData?._id ?? adminObject.roleId,
                    roleName: roleData?.name ?? role,
                    permissions: roleData?.permissions ?? [],
                },
            });
        }

        if (role === "user") {
            if (!userId) throw new ResponseError(400, "User ID not provided");

            const existUser = await User.findById(userId).populate({
                path: "roleId",
                select: "name permissions",
            });
            if (!existUser) throw new ResponseError(400, "User does not exist");

            const clients = await Client.find({ userIds: { $in: [userId] } }).select("+clientId name");
            const userObject = existUser.toObject();
            const roleData = userObject.roleId as { _id?: mongoose.Types.ObjectId; name?: string; permissions?: string[] } | null;

            return res.status(200).json({
                success: true,
                message: "User data retrieved successfully",
                role: "user",
                data: {
                    ...userObject,
                    roleId: roleData?._id ?? userObject.roleId,
                    roleName: roleData?.name ?? "user",
                    permissions: roleData?.permissions ?? [],
                    clients: clients.map((client) => ({
                        id: client._id,
                        clientId: client.clientId,
                        name: client.name,
                    })),
                },
            });
        }

        throw new ResponseError(400, "Role not provided");
    } catch (error) {
        logger.error((error as Error).message);
        next(error);
    }
}) as any);

web.use(errorMiddleware);
