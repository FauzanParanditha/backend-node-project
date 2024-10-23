import uuid4 from "uuid4";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import { calculateTotal, escapeRegExp } from "../utils/helper.js";
import { orderSchema } from "../validators/orderValidator.js";
import { createPaymentLink } from "./paymentController.js";
import User from "../models/userModel.js";
import { createXenditPaymentLink } from "./xenditController.js";
import mongoose from "mongoose";

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
    const filter = {};

    // Parse and handle search term
    if (query.trim()) {
      const searchTerm = escapeRegExp(query.trim());
      filter["$or"] = [
        { userId: { $regex: searchTerm, $options: "i" } },
        { status: { $regex: searchTerm, $options: "i" } },
      ];
    }

    // Sort and pagination settings
    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum; // Calculate skip based on page number

    // Connect to DB
    // const m = await connectDB();

    if (countOnly) {
      const totalCount = await Order.countDocuments(filter);
      return res.status(200).json({ count: totalCount });
    }

    // Fetch orders with pagination and sorting
    const orders = await Order.find(filter)
      .sort({ [sortField]: sortValue })
      .limit(limitNum)
      .skip(skip)
      .exec();

    // Calculate pagination details
    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      success: true,

      message: "all orders",
      data: orders,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: Number(page),
        perPage: limitNum,
        recordsOnPage: orders.length,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

export const createOrder = async (req, res) => {
  try {
    // Validate the request body using Joi
    const validatedOrder = await orderSchema.validateAsync(req.body, {
      abortEarly: false,
    });
    if (!validatedOrder) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data",
        error: error.details.map((err) => err.message).join(", "),
      });
    }

    const validProducts = [];

    // Check each product for validity
    for (const product of validatedOrder.products) {
      const foundProduct = await Product.findById(product.productId);
      if (foundProduct) {
        const { quantity, colors, sizes } = product;

        validProducts.push({
          productId: foundProduct._id,
          title: product.title,
          price: product.price,
          discount: product.discount,
          quantity: product.quantity,
          // If quantity is 1, wrap the color and size in objects
          colors:
            quantity === 1 && colors.length > 0
              ? [{ color: colors[0] }]
              : colors.map((c) => ({ color: c })),
          sizes:
            quantity === 1 && sizes.length > 0
              ? [{ size: sizes[0] }]
              : sizes.map((s) => ({ size: s })),
        });
      } else {
        console.log(`Product not found: ${product.productId}`);
        return res.status(400).json({
          success: false,
          message: `Product not found: ${product.productId}`,
        });
      }
    }

    if (validProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found to create the order.",
      });
    }

    const requestId = uuid4();

    const buyerObjectId = new mongoose.Types.ObjectId(validatedOrder.userId);
    const existUser = await User.findOne({ _id: buyerObjectId });
    if (!existUser) {
      return res.status(404).json({
        success: false,

        message: "user not registerd!",
      });
    }

    // Save the order to the database
    const temporaryOrder = {
      orderId: requestId,
      buyerId: validatedOrder.userId,
      products: validProducts,
      totalAmount: calculateTotal(validProducts),
      phoneNumber: validatedOrder.phoneNumber,
      paymentStatus: "pending",
      paymentMethod: validatedOrder.paymentMethod,
    };

    let paymentLink;

    if (temporaryOrder.paymentMethod === "xendit") {
      paymentLink = await createXenditPaymentLink(temporaryOrder);
    } else if (temporaryOrder.paymentMethod === "paylabs") {
      // Pass the order details to paymentController to initiate payment
      paymentLink = await createPaymentLink(temporaryOrder);
    } else {
      return res.status(400).json({
        success: false,
        message: "paymentMethod is not support",
      });
    }

    if (!paymentLink) {
      return res.status(400).json({
        success: false,
        message: "Failed to create payment link.",
      });
    }

    // Now that we have a payment link, save the order
    const savedOrder = await Order.create({
      ...temporaryOrder,
      paymentLink,
    });

    // Return the payment link to the frontend
    return res.status(200).json({
      success: true,
      paymentLink,
      orderId: savedOrder._id,
      // paymentLink,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Order creation failed",
      error: err.message,
    });
  }
};
