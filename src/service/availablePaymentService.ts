import type { Request } from "express";
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import AvailablePayment from "../models/availablePaymentModel.js";
import ClientAvailablePayment from "../models/clientAvailablePaymentModel.js";
import Client from "../models/clientModel.js";
import type { ListQueryParams } from "../types/service.js";
import { escapeRegExp } from "../utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getClientIdsByUserId = async (userId: string): Promise<string[]> => {
    const clients = await Client.find({ userIds: { $in: [userId] } }).select("+clientId");
    return clients.map((item) => item.clientId).filter((id): id is string => !!id);
};

const getAvailablePaymentIdsForClients = async (clientIds: string[], onlyActive = false): Promise<string[]> => {
    if (!clientIds.length) return [];
    const mappingFilter: Record<string, unknown> = {
        clientId: { $in: clientIds },
        ...(onlyActive && { active: true }),
    };
    const mappings = await ClientAvailablePayment.find(mappingFilter).select("availablePaymentId");
    return [...new Set(mappings.map((item) => item.availablePaymentId.toString()))];
};

interface GetAllAvailablePaymentParams extends ListQueryParams {
    userId?: string;
    clientId?: string;
}

export const getAllAvailablePayment = async ({
    query,
    limit,
    page,
    sort_by,
    sort,
    countOnly,
    userId,
    clientId,
}: GetAllAvailablePaymentParams) => {
    const filter: Record<string, unknown> = {};

    // Parse and handle search term
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [{ name: { $regex: searchTerm, $options: "i" } }];
    }

    if (userId) {
        const clientIds = clientId ? [clientId] : await getClientIdsByUserId(userId);
        const allowedIds = await getAvailablePaymentIdsForClients(clientIds, true);
        filter._id = { $in: allowedIds.length ? allowedIds : ["__none__"] };
        filter.active = true;
    } else if (clientId) {
        const allowedIds = await getAvailablePaymentIdsForClients([clientId], true);
        filter._id = { $in: allowedIds.length ? allowedIds : ["__none__"] };
        filter.active = true;
    }

    // Sort and pagination settings
    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await AvailablePayment.countDocuments(filter) };
    }

    // Fetch admins with pagination and sorting
    const availablePayment = await AvailablePayment.find(filter)
        .sort({ [sortField]: sortValue as 1 | -1 })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "adminId",
            select: "email",
        })
        .exec();

    // Calculate pagination details
    const total = await AvailablePayment.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        availablePayment,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: availablePayment.length,
        },
    };
};

export const createAvailablePayment = async ({ req, adminId }: { req: Request; adminId: string }) => {
    // Sanitize the input
    const name = req.body.name.trim();

    const existingAvailablePayment = await AvailablePayment.findOne({ name: { $eq: name } });
    if (existingAvailablePayment) throw new ResponseError(400, "Available Payment already exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Check if an image was uploaded
    if (!req.file) throw new ResponseError(400, "Upload File Required");

    // Adjust path to remove 'src/'
    const filePath = req.file.path.replace(/^src[[/\\][/\\]]/, "");

    const newAvailablePayment = new AvailablePayment({
        name: name,
        active: req.body.active,
        image: filePath,
        category: req.body.category,
        adminId: adminId,
    });

    const result = await newAvailablePayment.save();

    return result;
};

export const availablePayment = async ({ id, userId }: { id: string; userId?: string }) => {
    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        const allowedIds = await getAvailablePaymentIdsForClients(clientIds);
        if (!allowedIds.includes(id)) {
            throw new ResponseError(403, "Access forbidden");
        }
    }

    const result = await AvailablePayment.findOne({ _id: id }).populate({
        path: "adminId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "Available payment does not exist!");
    return result;
};

export const updateAvailablePayment = async ({
    id,
    adminId,
    value,
    req,
}: {
    id: string;
    adminId: string;
    value: Record<string, any>;
    req: Request;
}) => {
    const existingAvailablePayment = await AvailablePayment.findById(id);
    if (!existingAvailablePayment) throw new ResponseError(404, "AvailablePayment does not exist!");

    if (existingAvailablePayment.adminId.toString() !== adminId) {
        throw new ResponseError(401, "Unauthorized!");
    }

    const verifiedAdmin = await Admin.findById(adminId);
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, "Admin is not verified");
    }

    // Allow only specific fields for update
    const allowedFields = ["name", "active", "category"];
    const updateData: Record<string, unknown> = {};

    Object.keys(value).forEach((key) => {
        if (allowedFields.includes(key)) {
            updateData[key] = value[key];
        }
    });

    // Check if trying to deactivate the last active payment method
    if (updateData.active === false && existingAvailablePayment.active === true) {
        const activeCount = await AvailablePayment.countDocuments({ adminId, active: true });
        if (activeCount <= 1) {
            throw new ResponseError(
                400,
                "Cannot deactivate the only active payment method remaining. At least one payment method must remain active.",
            );
        }
    }

    // Handle image upload
    if (req.file) {
        try {
            // Delete old image if it exists
            if (existingAvailablePayment.image) {
                const oldImagePath = path.join(__dirname, "../../src", existingAvailablePayment.image);
                await fs.unlink(oldImagePath);
            }

            // Assign new image path
            const filePath = req.file.path.replace(/^src[[/\\][/\\]]/, "");
            updateData.image = filePath;
        } catch (error) {
            console.error("Failed to delete old image:", error);
            throw new ResponseError(400, "Failed to delete old image!");
        }
    }

    // Update the document safely
    const updatedAvailablePayment = await AvailablePayment.findByIdAndUpdate(
        id,
        { $set: updateData },
        {
            new: true,
            runValidators: true,
        },
    );

    if (!updatedAvailablePayment) throw new ResponseError(500, "Failed to update AvailablePayment!");

    return updatedAvailablePayment;
};

export const deleteAvailablepayment = async ({ id, adminId }: { id: string; adminId: string }) => {
    // Find the available payment by ID
    const availablePayment = await AvailablePayment.findById(id);
    if (!availablePayment) throw new ResponseError(404, "Available payment does not exist!");

    if (availablePayment.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Prevent deletion of the last active payment method
    if (availablePayment.active) {
        const activeCount = await AvailablePayment.countDocuments({ adminId, active: true });
        if (activeCount <= 1) {
            throw new ResponseError(
                400,
                "Cannot delete the only active payment method remaining. At least one payment method must remain active.",
            );
        }
    }

    // Delete the associated image file
    try {
        // Delete the old image file if it exists
        const imagePath = path.join(__dirname, "../../src", availablePayment.image);
        await fs.unlink(imagePath);
    } catch (error) {
        console.error("Failed to delete old image!, ", error);
        throw new ResponseError(400, "Failed to delete old image!");
    }

    // Delete the available payment from the database
    await AvailablePayment.findByIdAndDelete(id);
    return true;
};
