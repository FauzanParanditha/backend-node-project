import EmailLog from "../models/emailLogModel.js";
import { escapeRegExp } from "../utils/helper.js";

interface GetAllEmailLogsParams {
    query?: string;
    limit?: number | string;
    page?: number | string;
    sort_by?: string;
    sort?: number | string;
    countOnly?: boolean;
}

export const getAllEmailLogs = async ({ query, limit, page, sort_by, sort, countOnly }: GetAllEmailLogsParams) => {
    const filter: Record<string, unknown> = {};

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
        .sort({ [sortField]: sortValue as 1 | -1 })
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
