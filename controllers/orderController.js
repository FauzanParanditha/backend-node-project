import uuid4 from "uuid4";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import {
  calculateTotal,
  escapeRegExp,
  validateOrderProducts,
} from "../utils/helper.js";
import { orderLinkSchema } from "../validators/orderValidator.js";
import { createPaymentLink } from "./paymentController.js";
import { createXenditPaymentLink, expiredXendit } from "./xenditController.js";

// Orders Listing with Pagination and Sorting
export const orders = async (req, res) => {
  const {
    query = "",
    limit = 10,
    page = 1,
    sort_by = "_id",
    sort = -1,
    countOnly = false,
  } = req.query;

  try {
    const filter = query.trim()
      ? {
          $or: [
            { userId: new RegExp(escapeRegExp(query), "i") },
            { status: new RegExp(escapeRegExp(query), "i") },
          ],
        }
      : {};

    if (countOnly) {
      const count = await Order.countDocuments(filter);
      return res.status(200).json({ count });
    }

    const orders = await Order.find(filter)
      .sort({ [sort_by]: sort })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const total = await Order.countDocuments(filter);
    res.status(200).json({
      success: true,
      message: "all orders",
      data: orders,
      pagination: {
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        perPage: limit,
        recordsOnPage: orders.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Order
export const createOrder = async (req, res) => {
  try {
    const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
      abortEarly: false,
    });

    const existUser = await User.findById(validatedOrder.userId);
    if (!existUser) throw new Error("User not registered");

    const products = await validateOrderProducts(validatedOrder.products);
    if (!products.length)
      throw new Error("No valid products found to create the order");

    const orderData = {
      orderId: uuid4(),
      userId: validatedOrder.userId,
      products,
      totalAmount: calculateTotal(products),
      phoneNumber: validatedOrder.phoneNumber,
      paymentStatus: "pending",
      paymentMethod: validatedOrder.paymentMethod,
      ...(validatedOrder.paymentType && {
        paymentType: validatedOrder.paymentType,
      }),
      ...(validatedOrder.storeId && { storeId: validatedOrder.storeId }),
    };

    const paymentLink = await handlePaymentLink(orderData);

    const savedOrder = await Order.create({
      ...orderData,
      ...paymentLink,
      paymentType: "HTML5",
    });
    res.status(200).json({
      success: true,
      paymentLink: paymentLink.paymentLink,
      paymentId: paymentLink.paymentId,
      storeId: paymentLink.storeId,
      orderId: savedOrder._id,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "order creation failed",
      error: err.message,
    });
  }
};

// Helper: Handle Payment Link Creation
const handlePaymentLink = async (orderData) => {
  let paymentLink;
  switch (orderData.paymentMethod) {
    case "xendit":
      paymentLink = await createXenditPaymentLink(orderData);
      break;
    case "paylabs":
      paymentLink = await createPaymentLink(orderData);
      break;
    default:
      throw new Error("Payment method not supported");
  }

  if (!paymentLink) throw new Error("Failed to create payment link");

  if (paymentLink.errCode != 0 && orderData.paymentMethod === "paylabs") {
    throw new Error("error, " + paymentLink.errCode);
  }
  return {
    paymentLink: paymentLink.url || paymentLink.invoiceUrl,
    paymentId: paymentLink.id || paymentLink.merchantTradeNo,
    storeId: paymentLink.storeId || "",
  };
};

// Fetch Single Order
export const order = async (req, res) => {
  try {
    const existOrder = await Order.findById(req.params.id).populate(
      "userId",
      "email"
    );
    if (!existOrder)
      return res
        .status(404)
        .json({ success: false, message: "order not found" });

    res
      .status(200)
      .json({ success: true, message: "order details", data: existOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Order
export const editOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
      abortEarly: false,
    });
    const existingOrder = await Order.findById(id).select(
      "+paymentLink +paymentId"
    );

    if (!existingOrder)
      return res
        .status(404)
        .json({ success: false, message: "order not found" });
    if (existingOrder.paymentStatus === "paid")
      return res
        .status(200)
        .json({ success: true, message: "payment already processed" });

    const validProducts = await validateOrderProducts(validatedOrder.products);
    if (!validProducts.length)
      throw new Error("No valid products found to update the order");

    const existUser = await User.findById(validatedOrder.userId);
    if (!existUser) throw new Error("User not registered");

    if (existingOrder.paymentLink && existingOrder.paymentMethod === "xendit") {
      await expiredXendit(existingOrder.paymentId);
    }

    existingOrder.set({
      products: validProducts,
      totalAmount: calculateTotal(validProducts),
      phoneNumber: validatedOrder.phoneNumber,
      paymentMethod: validatedOrder.paymentMethod,
    });

    const paymentLink = await handlePaymentLink(existingOrder);
    existingOrder.set(paymentLink);
    await existingOrder.save();

    res.status(200).json({
      success: true,
      message: "order updated successfully",
      orderId: existingOrder._id,
      paymentLink: paymentLink.url,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "order update failed",
      error: err.message,
    });
  }
};
