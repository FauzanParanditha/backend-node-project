import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import authRouter from "./routers/authRouter.js";
import userRouter from "./routers/users/userRouter.js";

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

app.listen(process.env.PORT, () => {
  connectDB();
  console.log("app run on port:", process.env.PORT);
});
