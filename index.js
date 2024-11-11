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

dotenv.config();

ensureUploadsDirExists();
const app = express();

app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLogger);

// Define the rate limit rule
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
  res.json({
    message: "Hello World!",
  });
});

app.get("/me", jwtMiddlewareAdmin, async (req, res) => {
  const { adminId, verified } = req.admin;
  if (!adminId) {
    return res.status(400).json({
      success: false,
      message: "admin id is not provide",
    });
  }
  const existAdmin = await Admin.findOne({ _id: adminId });
  if (!existAdmin) {
    return res.status(401).json({
      success: false,

      message: "admin is not exist!",
    });
  }
  res.status(200).json({
    success: true,

    message: "me",
    data: existAdmin,
  });
});

app.listen(process.env.PORT, () => {
  connectDB();
  console.log("app run on port:", process.env.PORT);
});
