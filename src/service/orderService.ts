import dayjs from "dayjs";
import mongoose from "mongoose";
import logger from "../application/logger.js";
import { expiredXendit } from "../controllers/xenditController.js";
import { ResponseError } from "../error/responseError.js";
import Client from "../models/clientModel.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import type { PaymentPartner } from "../types/express.js";
import { encryptData } from "../utils/encryption.js";
import { calculateTotal, escapeRegExp, generateOrderId, validateOrderProducts } from "../utils/helper.js";
import type { OrderData } from "./paylabs.js";
import { handlePaymentLink } from "./paylabs.js";

const getClientIdsByUserId = async (userId: string): Promise<(string | undefined)[]> => {
    const normalizedUserId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const clients = await Client.find({ userIds: { $in: [normalizedUserId] } }).select("+clientId");
    return clients.map((item) => item.clientId);
};

const parseDate = (value: string): Date => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ResponseError(400, "Invalid date format");
    }
    return date;
};

interface GetAllOrdersParams {
    query?: string;
    limit?: string | number;
    page?: string | number;
    sort_by?: string;
    sort?: string | number;
    countOnly?: boolean;
    userId?: string;
    clientId?: string;
    domain?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    groupBy?: string;
}

export const getAllOrders = async ({
    query,
    limit,
    page,
    sort_by,
    sort,
    countOnly,
    userId,
    clientId,
    domain,
    paymentStatus,
    dateFrom,
    dateTo,
    groupBy,
}: GetAllOrdersParams) => {
    const filter: Record<string, any> = {};

    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { orderId: { $regex: searchTerm, $options: "i" } },
            { status: { $regex: searchTerm, $options: "i" } },
            { "items.domain": { $regex: searchTerm, $options: "i" } },
        ];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (clientId) {
        const clientTerm = escapeRegExp(String(clientId).trim());
        filter.clientId = { $regex: clientTerm, $options: "i" };
    }

    if (domain) {
        const domainTerm = escapeRegExp(String(domain).trim());
        filter["items.domain"] = { $regex: domainTerm, $options: "i" };
    }

    if (paymentStatus) {
        const values = String(paymentStatus)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        filter.paymentStatus = values.length > 1 ? { $in: values } : values[0];
    }

    if (dateFrom || dateTo) {
        filter.createdAt = {} as Record<string, Date>;
        if (dateFrom) filter.createdAt.$gte = parseDate(dateFrom);
        if (dateTo) filter.createdAt.$lte = parseDate(dateTo);
    }

    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        const scopedClientIds = clientIds.length ? clientIds : ["__none__"];

        if (filter.clientId) {
            const allowedRegex = new RegExp(scopedClientIds.map((id) => escapeRegExp(String(id))).join("|"), "i");
            filter.clientId = { $regex: allowedRegex };
        } else {
            filter.clientId = { $in: scopedClientIds };
        }
    }

    if (groupBy === "client") {
        const pipeline = [
            { $match: filter },
            {
                $group: {
                    _id: "$clientId",
                    orderCount: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    paidCount: {
                        $sum: {
                            $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "clients",
                    localField: "_id",
                    foreignField: "clientId",
                    as: "client",
                },
            },
            { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    clientId: "$_id",
                    orderCount: 1,
                    totalAmount: 1,
                    paidCount: 1,
                    client: {
                        name: "$client.name",
                        active: "$client.active",
                        notifyUrl: "$client.notifyUrl",
                    },
                },
            },
            { $sort: { totalAmount: -1 as const } },
        ];

        const grouped = await Order.aggregate(pipeline);
        return { grouped };
    }

    if (countOnly) {
        return { count: await Order.countDocuments(filter) };
    }
    const orders = await Order.find(filter)
        .sort({ [sortField]: sortValue as 1 | -1 })
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

interface GetOrdersParams {
    query?: string;
    sort_by?: string;
    sort?: string | number;
    countOnly?: boolean;
    userId?: string;
}

export const getOrders = async ({ query, sort_by, sort, countOnly, userId }: GetOrdersParams) => {
    const filter: Record<string, any> = {};

    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { userId: { $regex: searchTerm, $options: "i" } },
            { status: { $regex: searchTerm, $options: "i" } },
        ];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;

    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        filter.clientId = { $in: clientIds.length ? clientIds : ["__none__"] };
    }

    if (countOnly) {
        return { count: await Order.countDocuments(filter) };
    }

    const orders = await Order.find(filter)
        .sort({ [sortField]: sortValue as 1 | -1 })
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

interface ExportOrdersFilterParams {
    query?: string;
    userId?: string;
    clientId?: string;
    domain?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
}

export const exportOrdersFilter = async ({
    query,
    userId,
    clientId,
    domain,
    paymentStatus,
    dateFrom,
    dateTo,
}: ExportOrdersFilterParams): Promise<Record<string, any>> => {
    const filter: Record<string, any> = {};

    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { orderId: { $regex: searchTerm, $options: "i" } },
            { status: { $regex: searchTerm, $options: "i" } },
            { "items.domain": { $regex: searchTerm, $options: "i" } },
        ];
    }

    if (clientId) {
        const clientTerm = escapeRegExp(String(clientId).trim());
        filter.clientId = { $regex: clientTerm, $options: "i" };
    }

    if (domain) {
        const domainTerm = escapeRegExp(String(domain).trim());
        filter["items.domain"] = { $regex: domainTerm, $options: "i" };
    }

    if (paymentStatus) {
        const values = String(paymentStatus)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        filter.paymentStatus = values.length > 1 ? { $in: values } : values[0];
    }

    if (dateFrom || dateTo) {
        filter.createdAt = {} as Record<string, Date>;
        if (dateFrom) filter.createdAt.$gte = parseDate(dateFrom);
        if (dateTo) filter.createdAt.$lte = parseDate(dateTo);
    }

    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        const scopedClientIds = clientIds.length ? clientIds : ["__none__"];

        if (filter.clientId) {
            const allowedRegex = new RegExp(scopedClientIds.map((id) => escapeRegExp(String(id))).join("|"), "i");
            filter.clientId = { $regex: allowedRegex };
        } else {
            filter.clientId = { $in: scopedClientIds };
        }
    }

    return filter;
};

interface ExportOrdersParams extends ExportOrdersFilterParams {
    sort_by?: string;
    sort?: string | number;
}

export const exportOrders = async ({
    query,
    sort_by,
    sort,
    userId,
    clientId,
    domain,
    paymentStatus,
    dateFrom,
    dateTo,
}: ExportOrdersParams) => {
    const filter = await exportOrdersFilter({
        query,
        userId,
        clientId,
        domain,
        paymentStatus,
        dateFrom,
        dateTo,
    });

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;

    const orders = await Order.find(filter)
        .sort({ [sortField]: sortValue as 1 | -1 })
        .lean();
    return orders;
};

export const createOrder = async ({
    validatedOrder,
    partnerId,
}: {
    validatedOrder: Record<string, any>;
    partnerId: PaymentPartner;
}) => {
    try {
        const { validProducts, itemsForDb, totalAmount } = await validateOrderProducts(
            validatedOrder.items,
            validatedOrder.paymentType || undefined,
            validatedOrder.totalAmount,
        );

        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        const orderData = {
            orderId: await generateOrderId(partnerId.clientId),
            items: itemsForDb,
            totalAmount,
            phoneNumber: validatedOrder.phoneNumber,
            paymentStatus: "pending",
            payer: partnerId.name,
            paymentMethod: validatedOrder.paymentMethod,
            clientId: partnerId.clientId,
            ...(validatedOrder.paymentType && { paymentType: validatedOrder.paymentType }),
            ...(validatedOrder.storeId && { storeId: validatedOrder.storeId }),
        };

        const paymentLink = await handlePaymentLink(orderData);

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
        throw error;
    }
};

export const createOrderLink = async ({
    validatedOrder,
    partnerId,
}: {
    validatedOrder: Record<string, any>;
    partnerId: PaymentPartner;
}) => {
    try {
        const { validProducts, itemsForDb, totalAmount } = await validateOrderProducts(
            validatedOrder.items,
            validatedOrder.paymentType || undefined,
            validatedOrder.totalAmount,
        );

        if (!validProducts.length) {
            logger.error("No valid products found to create the order");
            throw new ResponseError(404, "No valid products found to create the order");
        }

        const orderData = {
            items: itemsForDb,
            totalAmount,
            phoneNumber: validatedOrder.phoneNumber,
            payer: partnerId.name,
            paymentMethod: validatedOrder.paymentMethod,
            clientId: partnerId.clientId,
            ...(validatedOrder.paymentType && { paymentType: validatedOrder.paymentType }),
            ...(validatedOrder.storeId && { storeId: validatedOrder.storeId }),
            expired: Math.floor(dayjs().add(30, "minute").valueOf() / 1000),
        };

        const encryptedOrderData = encryptData(orderData);
        const paymentLink = `${process.env.FRONTEND_URL}/payment?q=${encodeURIComponent(encryptedOrderData)}`;

        logger.info("Order created successfully");
        return {
            paymentLink,
        };
    } catch (error) {
        logger.error("Error in createOrder: ", error);
        throw error;
    }
};

export const order = async ({ id, userId }: { id: string; userId?: string }) => {
    const result = await Order.findOne({ _id: id }).populate({
        path: "clientId",
        model: "Client",
        select: "name active notifyUrl",
        foreignField: "clientId",
    });
    if (!result) throw new ResponseError(404, "Order does not exist!");

    if (userId) {
        const clientData = result.clientId as unknown as Record<string, any>;
        const client = await Client.findOne({ clientId: clientData.clientId });
        if (!client) throw new ResponseError(403, "Access forbidden");
    }

    return result;
};

export const editOrder = async ({ id, validatedOrder }: { id: string; validatedOrder: Record<string, any> }) => {
    const result = await Order.findOne({ _id: id }).select("+paymentLink +paymentId");

    if (!result) throw new ResponseError(404, "Order does not exist!");

    // Legacy call: validateOrderProducts expects 3 args, but editOrder only passes products
    const validProducts = (await (validateOrderProducts as (...args: unknown[]) => Promise<unknown>)(
        validatedOrder.products,
    )) as Record<string, unknown>[];
    if (!validProducts.length) throw new ResponseError(404, "No valid products found to update the order");

    const existUser = await User.findById(validatedOrder.userId);
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    if (result.paymentLink && result.paymentMethod === "xendit") {
        // Legacy call: expiredXendit expects 2 args (id, next), passing only id
        await (expiredXendit as (...args: unknown[]) => Promise<unknown>)(result.paymentId as string);
    }

    result.set({
        products: validProducts,
        totalAmount: (calculateTotal as (...args: unknown[]) => unknown)(validProducts),
        phoneNumber: validatedOrder.phoneNumber,
        paymentMethod: validatedOrder.paymentMethod,
    });

    const paymentLink = await handlePaymentLink(result.toObject() as unknown as OrderData);
    result.set(paymentLink);
    await result.save();

    return result;
};
