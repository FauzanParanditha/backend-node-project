import { Xendit, Invoice as InvoiceClient } from "xendit-node";
import User from "../models/userModel.js";
import mongoose from "mongoose";
import Order from "../models/orderModel.js";

const xenditInvoiceClient = new InvoiceClient({
  secretKey: process.env.XENDIT_SECRET_KEY,
});
export const createXenditPaymentLink = async (order) => {
  try {
    const buyerObjectId = new mongoose.Types.ObjectId(order.buyerId);
    const existUser = await User.findOne({ _id: buyerObjectId });
    if (!existUser) {
      return res.status(404).json({
        success: false,

        message: "User not registered!",
      });
    }

    const data = {
      externalId: order.orderId,
      amount: order.totalAmount,
      payerEmail: existUser.email,
      description: `Payment for order ${order.orderId}`,
      invoiceDuration: "172800",
      currency: "IDR",
      reminderTime: 1,
      successRedirectUrl: "http://localhost:5000",
      failureRedirectUrl: "http://localhost:5000",
    };

    const response = await xenditInvoiceClient.createInvoice({
      data,
    });

    return response.invoiceUrl;
  } catch (error) {
    throw new Error(`Error creating Xendit payment link: ${error.message}`);
  }
};

export const xenditCallback = async (req, res) => {
  try {
    // // Verify the webhook signature
    // const signature = req.headers["x-signature"];
    // const isValid = xenditInvoiceClient.webhook.verify(req.body, signature);

    // if (!isValid) {
    //   return res
    //     .status(401)
    //     .json({ success: false, message: "Invalid signature" });
    // }

    const event = req.body;

    // console.log("Webhook event received:", event);

    const order = await Order.findOne({ orderId: event.external_id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found for orderID: ${event.external_id}`,
      });
    }

    if (order.status === "paid") {
      return res.status(200).json({
        success: true,
        message: "payment has been already processed",
      });
    }

    // Process the event based on its type
    switch (event.status) {
      case "PAID":
        order.paymentStatus = "paid";
        order.payment = {
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
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    res.status(200).json({ success: true, message: "successfully" });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res
      .status(500)
      .json({ success: false, message: "Webhook handling failed" });
  }
};
