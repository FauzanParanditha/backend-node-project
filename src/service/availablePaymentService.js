import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import AvailablePayment from "../models/availablePaymentModel.js";
import { escapeRegExp } from "../utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getAllAvailablePayment = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Parse and handle search term
    if (query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [{ title: { $regex: searchTerm, $options: "i" } }];
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
        .sort({ [sortField]: sortValue })
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

export const createAvailablePayment = async ({ req, adminId }) => {
    // Sanitize the input
    const name = req.body.name.trim();

    const existingAvailablePayment = await AvailablePayment.findOne({ name: { $eq: name } });
    if (existingAvailablePayment) throw new ResponseError(400, "Available Payment already exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Check if an image was uploaded
    if (!req.file) throw new ResponseError(400, "Image is required!");

    const newAvailablePayment = new AvailablePayment({
        name: name,
        active: req.body.active,
        image: req.file.path,
        category: req.body.category,
        adminId: adminId,
    });

    const result = await newAvailablePayment.save();

    return result;
};

export const availablePayment = async ({ id }) => {
    const result = await AvailablePayment.findOne({ _id: id }).populate({
        path: "adminId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "Available payment does not exist!");
    return result;
};

export const updateAvailablePayment = async ({ id, adminId, value, req }) => {
    const existingAvailablePayment = await AvailablePayment.findById(id);
    if (!existingAvailablePayment) throw new ResponseError(404, "AvailablePayment does not exist!");

    if (existingAvailablePayment.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Prepare the update data
    const updateData = {
        name: value.name,
        active: value.active,
        category: value.category,
    };

    // Handle image upload
    if (req.file) {
        try {
            // Delete the old image file if it exists
            const oldImagePath = path.join(__dirname, "../..", existingAvailablePayment.image);
            await fs.promises.unlink(oldImagePath);

            // Update the image path
            updateData.image = req.file.path;
        } catch (error) {
            console.error("Failed to delete old image!, ", error);
            throw new ResponseError(400, "Failed to delete old image!");
        }
    }

    // Update the available payment
    await AvailablePayment.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });

    return updateData;
};

export const deleteAvailablepayment = async ({ id, adminId }) => {
    // Find the available payment by ID
    const availablePayment = await AvailablePayment.findById(id);
    if (!availablePayment) throw new ResponseError(404, "Available payment does not exist!");

    if (availablePayment.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Delete the associated image file
    try {
        // Delete the old image file if it exists
        const imagePath = path.join(__dirname, "../..", availablePayment.image);
        await fs.promises.unlink(imagePath);
    } catch (error) {
        console.error("Failed to delete old image!, ", error);
        throw new ResponseError(400, "Failed to delete old image!");
    }

    // Delete the available payment from the database
    await AvailablePayment.findByIdAndDelete(id);
    return true;
};
