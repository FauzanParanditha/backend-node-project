import mongoose from "mongoose";
import { Balance as BalanceClient, Invoice as InvoiceClient } from "xendit-node";
import logger from "../application/logger.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";

const xenditInvoiceClient = new InvoiceClient({
    secretKey: process.env.XENDIT_SECRET_KEY,
});
export const createXenditPaymentLink = async (order, next) => {
    try {
        const buyerObjectId = new mongoose.Types.ObjectId(order.userId);
        const existUser = await User.findOne({ _id: buyerObjectId });
        if (!existUser) {
            throw new ResponseError(404, "User does not exist!");
        }

        const data = {
            externalId: order.orderId,
            amount: order.totalAmount,
            payerEmail: existUser.email,
            description: `Payment for order ${order.orderId}`,
            invoiceDuration: "172800",
            currency: "IDR",
            reminderTime: 1,
            customer: {
                id: order.userId,
                phoneNumber: order.phoneNumber,
                email: existUser.email,
            },
            items: order.products.map((product) => ({
                name: product.title,
                price: product.price,
                quantity: product.quantity,
            })),
            successRedirectUrl: "http://localhost:5000",
            failureRedirectUrl: "http://localhost:5000",
        };

        const response = await xenditInvoiceClient.createInvoice({
            data,
        });

        const result = {
            id: response.id,
            invoiceUrl: response.invoiceUrl,
        };
        return result;
    } catch (error) {
        logger.error(`Error creating Xendit payment link: ${error.message}`);
        next(error);
    }
};

export const xenditCallback = async (req, res, next) => {
    try {
        // Verify the webhook signature
        const signature = req.headers["x-callback-token"];
        const callbackToken = process.env.XENDIT_SECRET_CALLBACK;

        if (signature !== callbackToken) {
            return res.status(401).json({ success: false, message: "invalid signature" });
        }

        const event = req.body;

        // console.log("Webhook event received:", event);
        const sanitizedExternalId = event.external_id.trim();

        const order = await Order.findOne({
            orderId: { $eq: sanitizedExternalId },
        });

        if (!order) {
            console.error(`Order not found for external_id: ${event.external_id}`);
            return res.status(404).json({
                success: false,
                message: `Order not found for external_id: ${event.external_id}`,
            });
        }

        if (order.paymentStatus === "paid") {
            return res.status(200).json({
                success: true,
                message: "payment has been already processed",
            });
        }

        // Process the event based on its type
        switch (event.status) {
            case "PAID":
                order.paymentStatus = "paid";
                order.paymentLink = undefined;
                order.paymentXendit = {
                    paymentId: event.payment_id,
                    status: event.status,
                    created: event.created,
                    isHigh: event.is_high,
                    paidAt: event.paid_at,
                    currency: event.currency,
                    bankCode: event.bank_code,
                    description: event.description,
                    externalId: event.external_id,
                    paidAmount: event.paid_amount,
                    payerEmail: event.payer_email,
                    merchantName: event.merchant_name,
                    paymentChannel: event.payment_channel,
                    paymentDestination: event.payment_destination,
                    failureRedirectUrl: event.failure_redirect_url,
                    successRedirectUrl: event.success_redirect_url,
                };
                await order.save();
                break;
            case "EXPIRED":
                order.paymentStatus = "expired";
                await order.save();
                break;
            case "FAILED":
                order.paymentStatus = "failed";
                await order.save();
                break;
            default:
                logger.error(`Unhandled event status received: ${event.status}`, event);
                throw new ResponseError(400, "Unhandled notification status");
        }

        res.status(200).json({ success: true, message: "successfully" });
    } catch (error) {
        logger.error(`Error handling webhook xendit: ${error.message}`);
        next(error);
    }
};

export const expiredXendit = async (id, next) => {
    try {
        const response = await xenditInvoiceClient.expireInvoice({ invoiceId: id });
        return response;
    } catch (error) {
        logger.error(`Error expiring Xendit invoice with ID: ${id}`, error.message);
        next(error);
    }
};

export const balance = async (req, res) => {
    const xenditBalanceClient = new BalanceClient({
        secretKey: process.env.XENDIT_SECRET_KEY,
    });

    const response = await xenditBalanceClient.getBalance();
    return res.status(200).json({
        success: true,
        data: response,
    });
};
