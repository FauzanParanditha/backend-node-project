import EmailLog from "../models/emailLogModel";
import { escapeRegExp } from "../utils/helper";

export const getAllEmailLogs = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [{ email: { $regex: searchTerm, $options: "i" } }];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await EmailLog.countDocuments(filter) };
    }

    const emailLogs = await EmailLog.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .exec();

    const total = await EmailLog.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        emailLogs,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: emailLogs.length,
        },
    };
};
