import uuid4 from "uuid4";
import { expiredXendit } from "../controllers/xenditController.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import { calculateTotal, escapeRegExp, validateOrderProducts } from "../utils/helper.js";
import { handlePaymentLink } from "./paylabs.js";
import { ResponseError } from "../error/responseError.js";

export const getAllOrders = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { userId: { $regex: searchTerm, $options: "i" } },
            { status: { $regex: searchTerm, $options: "i" } },
        ];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await Order.countDocuments(filter) };
    }

    const orders = await Order.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "userId",
            select: "fullName",
        })
        .populate({
            path: "products.productId",
            select: "title",
        })
        .exec();

    const total = await Order.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        orders,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: orders.length,
        },
    };
};

export const createOrder = async ({ validatedOrder }) => {
    const existUser = await User.findById(validatedOrder.userId);
    if (!existUser) throw new ResponseError("User does not exist!");

    // Validate products in the order
    const { validProducts, totalAmount } = await validateOrderProducts(
        validatedOrder.products,
        validatedOrder.paymentType || undefined,
    );
    if (!validProducts.length) throw new ResponseError(404, "No valid products found to create the order");

    const orderData = {
        orderId: uuid4(),
        userId: validatedOrder.userId,
        products: validProducts,
        totalAmount,
        phoneNumber: validatedOrder.phoneNumber,
        paymentStatus: "pending",
        paymentMethod: validatedOrder.paymentMethod,
        ...(validatedOrder.paymentType && {
            paymentType: validatedOrder.paymentType,
        }),
        ...(validatedOrder.storeId && { storeId: validatedOrder.storeId }),
    };

    const paymentLink = await handlePaymentLink(orderData);

    const result = await Order.create({
        ...orderData,
        ...paymentLink,
        paymentType: "HTML5",
    });

    return {
        paymentLink,
        result,
    };
};

export const order = async ({ id }) => {
    const result = await Order.findOne({ _id: id })
        .populate({ path: "userId", select: "email" })
        .populate({ path: "products.productId", select: "title" });
    if (!result) throw new ResponseError(404, "Order does not exist!");

    return result;
};

export const editOrder = async ({ id, validatedOrder }) => {
    const result = await Order.findOne({ _id: id }).select("+paymentLink +paymentId");

    if (!result) throw new ResponseError(404, "Order does not exist!");

    if (result.paymentStatus === "paid") throw new ResponseError(200, "Payment already processed!");

    const validProducts = await validateOrderProducts(validatedOrder.products);
    if (!validProducts.length) throw new ResponseError(404, "No valid products found to update the order");

    const existUser = await User.findById(validatedOrder.userId);
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (result.paymentLink && result.paymentMethod === "xendit") {
        await expiredXendit(result.paymentId);
    }

    result.set({
        products: validProducts,
        totalAmount: calculateTotal(validProducts),
        phoneNumber: validatedOrder.phoneNumber,
        paymentMethod: validatedOrder.paymentMethod,
    });

    const paymentLink = await handlePaymentLink(result);
    result.set(paymentLink);
    await result.save();

    return result;
};
