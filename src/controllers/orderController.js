import * as orderService from "../service/orderService.js";
import { orderLinkSchema } from "../validators/orderValidator.js";
import logger from "../application/logger.js";

// Orders Listing with Pagination and Sorting
export const orders = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const order = await orderService.getAllOrders({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: order.count });
        }

        res.status(200).json({
            success: true,
            message: "All orders",
            data: order.orders,
            pagination: order.pagination,
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
            orderId: result._id,
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
        const order = await orderService.order({ id });
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
            orderId: result._id,
            paymentLink: result.paymentLink,
        });
    } catch (error) {
        logger.error(`Error edit order ${error.message}`);
        next(error);
    }
};
