import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import authRouter from "./routers/authRouter.js";
import userRouter from "./routers/users/userRouter.js";
import Admin from "./models/adminModel.js";
import { jwtMiddlewareAdmin } from "./middlewares/admin_jwt.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//route
app.use("/adm/auth", authRouter);
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
      code: 400,
      message: "admin id is not provide",
    });
  }
  const existAdmin = await Admin.findOne({ _id: adminId });
  if (!existAdmin) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: "admin is not exist!",
    });
  }
  res.status(200).json({
    success: true,
    code: 200,
    message: "me",
    data: existAdmin,
  });
});

app.listen(process.env.PORT, () => {
  connectDB();
  console.log("app run on port:", process.env.PORT);
});
