import dayjs from "dayjs";
import logger from "../application/logger.js";
import { expiredXendit } from "../controllers/xenditController.js";
import { ResponseError } from "../error/responseError.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import { encryptData } from "../utils/encryption.js";
import { calculateTotal, escapeRegExp, generateOrderId, validateOrderProducts } from "../utils/helper.js";
import { handlePaymentLink } from "./paylabs.js";

export const getAllOrders = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { orderId: { $regex: searchTerm, $options: "i" } },
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
            path: "clientId",
            model: "Client",
            select: "name active notifyUrl",
            foreignField: "clientId",
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

export const getOrders = async ({ query, sort_by, sort, countOnly }) => {
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

    if (countOnly) {
        return { count: await Order.countDocuments(filter) };
    }

    const orders = await Order.find(filter)
        .sort({ [sortField]: sortValue })
        .populate({
            path: "clientId",
            model: "Client",
            select: "name active notifyUrl",
            foreignField: "clientId",
        })
        .exec();

    return {
        orders,
    };
};

export const createOrder = async ({ validatedOrder, partnerId }) => {
    try {
        // Validate products in the order
        const { validProducts, totalAmount } = await validateOrderProducts(
            validatedOrder.items,
            validatedOrder.paymentType || undefined,
            validatedOrder.totalAmount,
        );

        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        // Construct order data
        const orderData = {
            orderId: generateOrderId(partnerId.clientId),
            items: validProducts,
            totalAmount,
            phoneNumber: validatedOrder.phoneNumber,
            paymentStatus: "pending",
            payer: partnerId.name,
            paymentMethod: validatedOrder.paymentMethod,
            clientId: partnerId.clientId,
            ...(validatedOrder.paymentType && { paymentType: validatedOrder.paymentType }),
            ...(validatedOrder.storeId && { storeId: validatedOrder.storeId }),
        };

        // Handle payment link generation
        const paymentLink = await handlePaymentLink(orderData);

        // Save order details in the database
        const result = await Order.create({
            ...orderData,
            ...paymentLink,
            paymentType: "HTML5",
        });

        logger.info("Order created successfully");
        return {
            paymentLink,
            result,
        };
    } catch (error) {
        logger.error("Error in createOrder: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const createOrderLink = async ({ validatedOrder, partnerId }) => {
    try {
        // Validate products in the order
        const { validProducts, totalAmount } = await validateOrderProducts(
            validatedOrder.items,
            validatedOrder.paymentType || undefined,
            validatedOrder.totalAmount,
        );

        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        // Construct order data
        const orderData = {
            items: validProducts,
            totalAmount,
            phoneNumber: validatedOrder.phoneNumber,
            payer: partnerId.name,
            paymentMethod: validatedOrder.paymentMethod,
            clientId: partnerId.clientId,
            ...(validatedOrder.paymentType && { paymentType: validatedOrder.paymentType }),
            ...(validatedOrder.storeId && { storeId: validatedOrder.storeId }),
            expired: Math.floor(dayjs().add(30, "minute").valueOf() / 1000),
        };

        // Encrypt orderData if necessary
        const encryptedOrderData = encryptData(orderData);
        // console.log("🔐 Encrypted Order Data:", encryptedOrderData);

        // Generate a link to the frontend payment page with the encrypted data
        const paymentLink = `${process.env.FRONTEND_URL}/payment?q=${encodeURIComponent(encryptedOrderData)}`;

        logger.info("Order created successfully");
        return {
            paymentLink,
        };
    } catch (error) {
        logger.error("Error in createOrder: ", error);
        throw error; // Re-throw the error for further handling
    }
};

export const order = async ({ id }) => {
    const result = await Order.findOne({ _id: id }).populate({
        path: "clientId",
        model: "Client",
        select: "name active notifyUrl",
        foreignField: "clientId",
    });
    if (!result) throw new ResponseError(404, "Order does not exist!");

    return result;
};

export const editOrder = async ({ id, validatedOrder }) => {
    const result = await Order.findOne({ _id: id }).select("+paymentLink +paymentId");

    if (!result) throw new ResponseError(404, "Order does not exist!");

    // if (result.paymentStatus === "paid") throw new ResponseError(409, "Payment already processed!");

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
