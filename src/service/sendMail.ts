import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import pkg from "handlebars";
import logger from "../application/logger.js";
import Email from "../models/emailModel.js";
const { compile } = pkg;

interface MailData {
    to: string;
    subject: string;
    body: string;
}

// Validate mail configuration
const validateMailConfig = (): void => {
    const requiredEnvVars = ["MAIL_TOKEN", "MAIL_FORM", "MAIL_ADDRESS", "MAIL_URL"];
    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            throw new Error(`Missing environment variable: ${varName}`);
        }
    }
};

// Generate the forgot password link
export const generateForgotPasswordLink = (email: string, code: string): string => {
    const baseUrl = process.env.FRONTEND_URL;
    return `${baseUrl}/auth/forgot-password?email=${email}&code=${code}`;
};

// Utility function to encode HTML to Base64
const encodeToBase64 = (html: string): string => Buffer.from(html).toString("base64");

// Send the forgot password email
export const sendForgotPasswordEmail = async (url: string, emailTo: string, name: string): Promise<void> => {
    try {
        const templateSource = fs.readFileSync("./src/application/mail/email.html", "utf8");
        const template = compile(templateSource);

        const body = `  
        <table class="message mt-2">  
        <tr class="text-left">  
            <td><strong>Hello, ${name}</strong></td>  
        </tr>  
        <tr class="text-center">  
            <td>  
                <p>This is a password reset email</p>  
                <p>If you did not request a password reset, <span class="text-red">IGNORE THIS EMAIL</span></p>  
                <a href="${url}" class="btn mt-2 mb-2">RESET PASSWORD</a>  
                <p class="mb-2">Or copy the link below</p>  
                <p class="text-blue">${url}</p>  
            </td>  
        </tr>  
        </table>`;

        const emailHtml = template({ Body: body });
        const mailData: MailData = {
            to: emailTo,
            subject: "Forgot Password",
            body: encodeToBase64(emailHtml),
        };

        await sendEmail(mailData);
    } catch (error) {
        logger.error("Error sending forgot password email:", error);
        throw new Error("Failed to send forgot password email.");
    }
};

// Send the verify email
export const sendVerifiedEmail = async (code: string, emailTo: string, name: string): Promise<void> => {
    try {
        const templateSource = fs.readFileSync("./src/application/mail/email.html", "utf8");
        const template = compile(templateSource);

        const body = `  
        <table class="message mt-2">  
            <tr class="text-left">  
                <td><strong>Hello, ${name}</strong></td>  
            </tr>  
            <tr class="text-center">  
                <td>  
                    <p>This is your verification code:</p>  
                    <p class="text-blue" style="font-size: 24px; font-weight: bold;">${code}</p>  
                    <p>Please enter this code to verify your account.</p>  
                    <p>If you did not request this, <span class="text-red">IGNORE THIS EMAIL</span></p>
                </td>  
            </tr>  
        </table>`;

        const emailHtml = template({ Body: body });
        const mailData: MailData = {
            to: emailTo,
            subject: "Verification",
            body: encodeToBase64(emailHtml),
        };

        await sendEmail(mailData);
    } catch (error) {
        logger.error("Error sending forgot password email:", error);
        throw new Error("Failed to send forgot password email.");
    }
};

// Send email using the configured mail service
export const sendEmail = async (mailData: MailData): Promise<Record<string, unknown>> => {
    validateMailConfig(); // Validate mail configuration

    const data = new FormData();
    data.append("token", process.env.MAIL_TOKEN);
    data.append("from", process.env.MAIL_FORM);
    data.append("mailer", process.env.MAIL_ADDRESS);
    data.append("to", mailData.to);
    data.append("subject", mailData.subject);
    data.append("body", mailData.body);

    const url = process.env.MAIL_URL;

    try {
        const response = await axios.post(`${url}/api/v1/mail`, data, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        logger.info("Email sent successfully:", response.data);

        const emailLog = new Email({
            email: mailData.to,
            messages: response.data,
            statusCode: response.data.code,
        });
        await emailLog.save();

        return response.data as Record<string, unknown>;
    } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { message?: string } } } & Error;
        logger.error("Error sending email:", err?.response || err);

        const statusCode = err?.response?.status || "Unknown";
        const emailLog = new Email({
            email: mailData.to,
            messages: { code: statusCode, message: err.response?.data?.message },
            statusCode,
        });

        try {
            await emailLog.save();
            logger.info("Email log created successfully.");
        } catch (logError) {
            logger.error("Error creating email log:", logError);
        }

        throw new Error("Failed to send email.");
    }
};
