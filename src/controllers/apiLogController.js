import logger from "../application/logger.js";
import * as apiLogService from "../service/apiLogService.js";

export const getAllApiLog = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const result = await apiLogService.getAllApiLogs({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: result.count });
        }

        return res.status(200).json({
            success: true,
            message: "All api logs",
            data: result.apiLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching api logs: ${error.message}`);
        next(error);
    }
};

export const getAllEmailLog = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const result = await apiLogService.getAllEmailLogs({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: result.count });
        }

        return res.status(200).json({
            success: true,
            message: "All email logs",
            data: result.emailLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching email logs: ${error.message}`);
        next(error);
    }
};

export const getAllCallbackLog = async (req, res, next) => {
    const { query = "", limit = 10, page = 1, sort_by = "_id", sort = -1, countOnly = false } = req.query;

    try {
        const result = await apiLogService.getAllCallbackLogs({
            query,
            limit,
            page,
            sort_by,
            sort,
            countOnly,
        });

        if (countOnly) {
            return res.status(200).json({ count: result.count });
        }

        return res.status(200).json({
            success: true,
            message: "All callback logs",
            data: result.failedCallbackLogs,
            pagination: result.pagination,
        });
    } catch (error) {
        logger.error(`Error fetching email logs: ${error.message}`);
        next(error);
    }
};
