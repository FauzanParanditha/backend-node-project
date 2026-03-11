import ExcelJS from "exceljs";
import type { NextFunction, Request, Response } from "express";
import type mongoose from "mongoose";
import logger from "../application/logger.js";
import Order from "../models/orderModel.js";
import { logActivity } from "../service/activityLogService.js";
import * as orderService from "../service/orderService.js";
import { getAuthActivityActor } from "../utils/activityActor.js";
import { orderLinkSchema } from "../validators/orderValidator.js";

const flattenObject = (
    obj: Record<string, any>,
    prefix = "",
    result: Record<string, any> = {},
): Record<string, any> => {
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

const pickFirstNonEmptyExpression = (candidates: string[]) => ({
    $let: {
        vars: {
            matches: {
                $filter: {
                    input: candidates,
                    as: "value",
                    cond: {
                        $and: [{ $ne: ["$$value", null] }, { $ne: ["$$value", ""] }],
                    },
                },
            },
        },
        in: { $arrayElemAt: ["$$matches", 0] },
    },
});

const toNumberOrZeroExpression = (valueExpression: any) => ({
    $convert: {
        input: valueExpression,
        to: "double",
        onError: 0,
        onNull: 0,
    },
});

const totalTransFeeExpression = () =>
    toNumberOrZeroExpression(
        pickFirstNonEmptyExpression([
            "$paymentPaylabs.totalTransFee",
            "$paymentPaylabsVaSnap.additionalInfo.totalTransFee",
            "$qris.totalTransFee",
            "$va.totalTransFee",
            "$cc.totalTransFee",
            "$eMoney.totalTransFee",
        ]),
    );

const vatFeeExpression = () =>
    toNumberOrZeroExpression(
        pickFirstNonEmptyExpression([
            "$paymentPaylabs.vatFee",
            "$paymentPaylabsVaSnap.additionalInfo.vatFee",
            "$qris.vatFee",
            "$va.vatFee",
            "$cc.vatFee",
            "$eMoney.vatFee",
        ]),
    );

const netAmountExpression = () => ({
    $subtract: [{ $subtract: ["$totalAmount", totalTransFeeExpression()] }, vatFeeExpression()],
});

const EXPORT_COLUMNS = [
    "orderId",
    "clientId",
    "client.name",
    "paymentStatus",
    "totalAmount",
    "totalTransFee",
    "vatFee",
    "netAmount",
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

const GROUPED_EXPORT_COLUMNS = [
    "clientId",
    "client.name",
    "orderCount",
    "paidCount",
    "totalAmount",
    "totalTransFee",
    "vatFee",
    "totalNetAmount",
];

const pickExportRow = (row: Record<string, any>): Record<string, any> => {
    const picked: Record<string, any> = {};
    EXPORT_COLUMNS.forEach((key) => {
        picked[key] = Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined;
    });
    return picked;
};

// Orders Listing with Pagination and Sorting
export const orders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
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
    } = req.query as Record<string, any>;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : undefined;

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
    } catch (error: unknown) {
        logger.error(`Error fetching order ${(error as Error).message}`);
        next(error);
    }
};

export const exportOrdersXlsx = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const {
        query = "",
        sort_by = "_id",
        sort = -1,
        clientId,
        domain,
        paymentStatus,
        dateFrom,
        dateTo,
        group_by,
    } = req.query as Record<string, any>;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : undefined;

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

        const isGroupedByClient = group_by === "client";
        const pipeline = isGroupedByClient
            ? [
                  { $match: filter },
                  {
                      $group: {
                          _id: "$clientId",
                          orderCount: { $sum: 1 },
                          totalAmount: { $sum: "$totalAmount" },
                          totalTransFee: { $sum: totalTransFeeExpression() },
                          vatFee: { $sum: vatFeeExpression() },
                          totalNetAmount: { $sum: netAmountExpression() },
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
                          totalTransFee: 1,
                          vatFee: 1,
                          totalNetAmount: 1,
                          paidCount: 1,
                          client: {
                              name: "$client.name",
                          },
                      },
                  },
                  { $sort: { [sortField]: sortValue } },
              ]
            : [
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
                  {
                      $addFields: {
                          totalTransFee: totalTransFeeExpression(),
                          vatFee: vatFeeExpression(),
                          netAmount: netAmountExpression(),
                      },
                  },
              ];

        let hasData = false;
        let exportedRows = 0;

        const filename = `orders-${Date.now()}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res as unknown as import("stream").Writable,
        });
        const sheet = workbook.addWorksheet("Orders");

        const columns = isGroupedByClient ? GROUPED_EXPORT_COLUMNS : EXPORT_COLUMNS;
        sheet.columns = columns.map((key) => ({ header: key, key }));

        const cursorForRows = Order.aggregate(pipeline as mongoose.PipelineStage[]).cursor({ batchSize: 500 });
        await cursorForRows.eachAsync((doc: any) => {
            hasData = true;
            exportedRows += 1;
            const flattened = flattenObject(doc);
            const row = isGroupedByClient
                ? GROUPED_EXPORT_COLUMNS.reduce((acc: Record<string, any>, key) => {
                      acc[key] = Object.prototype.hasOwnProperty.call(flattened, key) ? flattened[key] : undefined;
                      return acc;
                  }, {})
                : pickExportRow(flattened);

            sheet.addRow(row).commit();
        });

        if (!hasData) {
            sheet.addRow(["No data"]).commit();
        }

        await sheet.commit();
        await workbook.commit();

        const actor = getAuthActivityActor(req);
        if (actor) {
            logActivity({
                actorId: actor.actorId,
                role: actor.role,
                action: "EXPORT_ORDERS_XLSX",
                details: {
                    filename,
                    exportedRows,
                    groupBy: group_by || null,
                    query,
                    clientId,
                    domain,
                    paymentStatus,
                    dateFrom,
                    dateTo,
                    sortBy: sortField,
                    sort: sortValue,
                },
                ipAddress: req.ip,
            }).catch(console.error);
        }

        return res.end();
    } catch (error: unknown) {
        logger.error(`Error export orders: ${(error as Error).message}`);
        next(error);
    }
};

export const orderNoLimit = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { query = "", sort_by = "createdAt", sort = 1, countOnly = false } = req.query as Record<string, any>;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : undefined;

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
    } catch (error: unknown) {
        logger.error(`Error fetching order ${(error as Error).message}`);
        next(error);
    }
};

// Create Order
export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const partnerId = req.partnerId;
    try {
        const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { paymentLink, result } = await orderService.createOrder({
            validatedOrder,
            partnerId: partnerId!,
        });

        logActivity({
            actorId: String(partnerId!.adminId), // Client operations map backward to their Admin creator, or a specific user logic
            role: "client",
            action: "CREATE_ORDER",
            details: { orderId: result.orderId, amount: validatedOrder.totalAmount },
            ipAddress: req.ip,
        }).catch(console.error);

        const plLink = paymentLink as any;
        res.status(200).json({
            success: true,
            paymentLink: plLink.paymentLink,
            paymentId: plLink.paymentId,
            storeId: plLink.storeId,
            orderId: result.orderId,
            id: result._id,
        });
    } catch (error: unknown) {
        logger.error(`Error create order ${(error as Error).message}`);
        next(error);
    }
};

// Create Order Link
export const createOrderLink = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const partnerId = req.partnerId;
    try {
        const validatedOrder = await orderLinkSchema.validateAsync(req.body, {
            abortEarly: false,
        });

        const { paymentLink } = await orderService.createOrderLink({
            validatedOrder,
            partnerId: partnerId!,
        });

        res.status(200).json({
            success: true,
            paymentLink: paymentLink,
        });
    } catch (error: unknown) {
        logger.error(`Error create order ${(error as Error).message}`);
        next(error);
    }
};

// Fetch Single Order
export const order = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { id } = req.params;

    try {
        const { role, userId } = req.auth ?? {};
        const scopedUserId = role === "user" ? userId : undefined;

        const order = await orderService.order({ id, userId: scopedUserId });
        return res.status(200).json({ success: true, message: "Order", data: order });
    } catch (error: unknown) {
        logger.error(`Error fetching order ${(error as Error).message}`);
        next(error);
    }
};

// Edit Order
export const editOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
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
    } catch (error: unknown) {
        logger.error(`Error edit order ${(error as Error).message}`);
        next(error);
    }
};
