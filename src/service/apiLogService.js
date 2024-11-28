import ApiLog from "../models/apiLogModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllApiLogs = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { email: { $regex: searchTerm, $options: "i" } },
            { fullName: { $regex: searchTerm, $options: "i" } },
        ];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await ApiLog.countDocuments(filter) };
    }

    const apiLogs = await ApiLog.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .exec();

    const total = await ApiLog.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        apiLogs,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: apiLogs.length,
        },
    };
};
