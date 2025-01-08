import ApiLog from "../models/apiLogModel.js";
import EmailLog from "../models/emailLogModel.js";
import FailedCallback from "../models/failedForwardModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllApiLogs = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [{ endpoint: { $regex: searchTerm, $options: "i" } }];
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

export const getAllCallbackLogs = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    try {
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum = Math.max(1, Number(page) || 1);
        const skip = (pageNum - 1) * limitNum;

        const matchStage = {};
        if (query && query.trim()) {
            const searchTerm = escapeRegExp(query.trim());
            matchStage["$or"] = [
                { email: { $regex: searchTerm, $options: "i" } },
                { "client.name": { $regex: searchTerm, $options: "i" } }, // Adjust field names
            ];
        }

        const aggregationPipeline = [
            {
                $lookup: {
                    from: "clients", // Replace with the actual name of the collection for `clientId`
                    localField: "clientId",
                    foreignField: "_id",
                    as: "client",
                },
            },
            { $unwind: "$client" }, // Flatten the array from `$lookup`
            { $match: matchStage },
        ];

        if (countOnly) {
            const countPipeline = [...aggregationPipeline, { $count: "count" }];
            const countResult = await FailedCallback.aggregate(countPipeline);
            return { count: countResult[0]?.count || 0 };
        }

        aggregationPipeline.push(
            { $sort: { [sort_by || "_id"]: Number(sort) || -1 } },
            { $skip: skip },
            { $limit: limitNum },
        );

        const logs = await FailedCallback.aggregate(aggregationPipeline);
        const total = await FailedCallback.aggregate([
            ...aggregationPipeline.slice(0, -3), // Remove pagination stages
            { $count: "total" },
        ]);
        const totalRecords = total[0]?.total || 0;

        return {
            failedCallbackLogs: logs,
            pagination: {
                totalRecords,
                totalPages: Math.ceil(totalRecords / limitNum),
                currentPage: pageNum,
                perPage: limitNum,
                recordsOnPage: logs.length,
            },
        };
    } catch (error) {
        console.error("Error fetching callback logs with client search:", error);
        throw new Error("Failed to fetch callback logs.");
    }
};
