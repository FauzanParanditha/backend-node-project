import ExcelJS from "exceljs";
import logger from "../application/logger.js";
import Order from "../models/orderModel.js";
import * as orderService from "../service/orderService.js";
import { orderLinkSchema } from "../validators/orderValidator.js";

const flattenObject = (obj, prefix = "", result = {}) => {
    Object.keys(obj || {}).forEach((key) => {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value instanceof Date) {
            result[fullKey] = value.toISOString();
        } else if (Array.isArray(value)) {
            result[fullKey] = JSON.stringify(value);
        } else if (value && typeof value === "object") {
            flattenObject(value, fullKey, result);
        } else {
            result[fullKey] = value;
        }
    });

    return result;
};

const EXPORT_COLUMNS = [
    "orderId",
    "clientId",
    "client.name",
    "paymentStatus",
    "totalAmount",
    "paymentMethod",
    "paymentId",
    "createdAt",
    "updatedAt",
    "paymentType",
    "storeId",
    "payer",
    "phoneNumber",
    "paymentExpiredAt",
    "paymentPaylabs.requestId",
    "paymentPaylabs.merchantTradeNo",
    "paymentPaylabs.platformTradeNo",
    "paymentPaylabs.status",
    "items",
];

const pickExportRow = (row) => {
    const picked = {};
    EXPORT_COLUMNS.forEach((key) => {
        picked[key] = Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined;
    });
    return picked;
};

// Orders Listing with Pagination and Sorting
export const orders = async (req, res, next) => {
    const {
        query = "",
        limit = 10,
        page = 1,
        sort_by = "_id",
        sort = -1,
        countOnly = false,
        clientId,
        domain,
        paymentStatus,
        dateFrom,
        dateTo,
        group_by,
    } = req.query;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : null;

        const order = await orderService.getAllOrders({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
            userId: scopedUserId,
            clientId,
            domain,
            paymentStatus,
            dateFrom,
            dateTo,
            groupBy: group_by,
        });

        if (countOnly) {
            return res.status(200).json({ count: order.count });
        }

        res.status(200).json({
            success: true,
            message: "All orders",
            data: order.orders ?? order.grouped,
            ...(order.pagination && { pagination: order.pagination }),
        });
    } catch (error) {
        logger.error(`Error fetching order ${error.message}`);
        next(error);
    }
};

export const exportOrdersXlsx = async (req, res, next) => {
    const {
        query = "",
        sort_by = "_id",
        sort = -1,
        clientId,
        domain,
        paymentStatus,
        dateFrom,
        dateTo,
    } = req.query;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : null;

        const filter = await orderService.exportOrdersFilter({
            query,
            userId: scopedUserId,
            clientId,
            domain,
            paymentStatus,
            dateFrom,
            dateTo,
        });

        const sortField = sort_by || "_id";
        const sortValue = Number(sort) || -1;

        const pipeline = [
            { $match: filter },
            { $sort: { [sortField]: sortValue } },
            {
                $lookup: {
                    from: "clients",
                    localField: "clientId",
                    foreignField: "clientId",
                    as: "client",
                },
            },
            { $addFields: { client: { $arrayElemAt: ["$client", 0] } } },
        ];

        let hasData = false;

        const filename = `orders-${Date.now()}.xlsx`;
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const sheet = workbook.addWorksheet("Orders");

        sheet.columns = EXPORT_COLUMNS.map((key) => ({ header: key, key }));

        const cursorForRows = Order.aggregate(pipeline).cursor({ batchSize: 500 });
        await cursorForRows.eachAsync((doc) => {
            hasData = true;
            sheet.addRow(pickExportRow(flattenObject(doc))).commit();
        });

        if (!hasData) {
            sheet.addRow(["No data"]).commit();
        }

        await sheet.commit();
        await workbook.commit();

        return res.end();
    } catch (error) {
        logger.error(`Error export orders: ${error.message}`);
        next(error);
    }
};

export const orderNoLimit = async (req, res, next) => {
    const { query = "", sort_by = "createdAt", sort = 1, countOnly = false } = req.query;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : null;

        const order = await orderService.getOrders({
            query,
            sort_by,
            sort,
            countOnly,
            userId: scopedUserId,
        });

        if (countOnly) {
            return res.status(200).json({ count: order.count });
        }

        res.status(200).json({
            success: true,
            message: "All orders",
            data: order.orders,
        });
    } catch (error) {
        logger.error(`Error fetching order ${error.message}`);
        next(error);
    }
};

// Create Order
export const createOrder = async (req, res, next) => {
    const partnerId = req.partnerId;
    try {
        const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { paymentLink, result } = await orderService.createOrder({
            validatedOrder,
            partnerId,
        });

        res.status(200).json({
            success: true,
            paymentLink: paymentLink.paymentLink,
            paymentId: paymentLink.paymentId,
            storeId: paymentLink.storeId,
            orderId: result.orderId,
            id: result._id,
        });
    } catch (error) {
        logger.error(`Error create order ${error.message}`);
        next(error);
    }
};

// Create Order Link
export const createOrderLink = async (req, res, next) => {
    const partnerId = req.partnerId;
    try {
        const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { paymentLink } = await orderService.createOrderLink({
            validatedOrder,
            partnerId,
        });

        res.status(200).json({
            success: true,
            paymentLink: paymentLink,
        });
    } catch (error) {
        logger.error(`Error create order ${error.message}`);
        next(error);
    }
};

// Fetch Single Order
export const order = async (req, res, next) => {
    const { id } = req.params;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : null;

        const order = await orderService.order({ id, userId: scopedUserId });
        return res.status(200).json({ success: true, message: "Order", data: order });
    } catch (error) {
        logger.error(`Error fetching order ${error.message}`);
        next(error);
    }
};

// Edit Order
export const editOrder = async (req, res, next) => {
    const { id } = req.params;
    try {
        const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const result = await orderService.editOrder({ id, validatedOrder });

        return res.status(200).json({
            success: true,
            message: "order updated successfully",
            orderId: result.orderId,
            id: result._id,
            paymentLink: result.paymentLink,
        });
    } catch (error) {
        logger.error(`Error edit order ${error.message}`);
        next(error);
    }
};
