import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import { doHash, escapeRegExp } from "../utils/helper.js";

export const getAllAdmins = async ({ query, limit, page, sort_by, sort, countOnly }) => {
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
        return { count: await Admin.countDocuments(filter) };
    }

    const admins = await Admin.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .exec();

    const total = await Admin.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        admins,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: admins.length,
        },
    };
};

export const registerAdmin = async ({ email, password, fullName }) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (existAdmin) throw new ResponseError(400, "Admin already exists!");

    const hashPassword = await doHash(password, 12);
    const newAdmin = new Admin({ email, password: hashPassword, fullName });
    const savedAdmin = await newAdmin.save();
    savedAdmin.password = undefined;
    return savedAdmin;
};

export const admin = async ({ id }) => {
    const result = await Admin.findOne({ _id: id });
    if (!result) throw new ResponseError(404, "Admin does not exist!");
    return result;
};

export const updateAdmin = async ({ id, fullName }) => {
    const existAdmin = await Admin.findOne({ _id: id });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    // Sanitize the input
    const sanitizedadmin = fullName.trim();

    const existingAdmin = await Admin.findOne({
        fullName: { $eq: sanitizedadmin },
    });
    if (existingAdmin) throw new ResponseError(400, `Admin ${fullName} already exist!`);

    existAdmin.fullName = fullName;
    const result = await existAdmin.save();
    return result;
};

export const deleteAdminById = async (id) => {
    const existAdmin = await Admin.findById(id);
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");
    await Admin.deleteOne({ _id: id });
    return { success: true, message: "successfully deleted admin" };
};

export const dashboard = async () => {
    const client = await Client.countDocuments();
    const user = await User.countDocuments();
    const order = await Order.countDocuments();
    return { success: true, client, user, order };
};
