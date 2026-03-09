import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_ADDRESS,
        pass: process.env.MAIL_PASSWORD,
    },
});

export default transport;
