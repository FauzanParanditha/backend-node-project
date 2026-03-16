import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import type { ListQueryParams } from "../types/service.js";
import { doHash, escapeRegExp } from "../utils/helper.js";

const serializeUserWithRole = (user: any) => {
    const plainUser = typeof user.toObject === "function" ? user.toObject() : user;
    const populatedRole = plainUser.roleId;
    const roleName = populatedRole && typeof populatedRole === "object" ? populatedRole.name ?? null : null;
    const permissions = populatedRole && typeof populatedRole === "object" ? populatedRole.permissions ?? [] : [];

    return {
        ...plainUser,
        roleId: populatedRole && typeof populatedRole === "object" ? populatedRole._id : plainUser.roleId,
        role: roleName,
        roleName,
        permissions,
    };
};

export const getAllUsers = async ({ query, limit, page, sort_by, sort, countOnly }: ListQueryParams) => {
    const filter: Record<string, unknown> = {};

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
        return { count: await User.countDocuments(filter) };
    }

    const users = await User.find(filter)
        .populate({ path: "roleId", select: "name permissions" })
        .sort({ [sortField]: sortValue as 1 | -1 })
        .limit(limitNum)
        .skip(skip)
        .exec();

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        users: users.map(serializeUserWithRole),
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: users.length,
        },
    };
};

export const registerUser = async ({
    email,
    password,
    fullName,
    roleId,
    adminId,
}: {
    email: string;
    password: string;
    fullName: string;
    roleId: string;
    adminId: string;
}) => {
    const sanitizedEmail = email.trim();

    const existUser = await User.findOne({ email: { $eq: sanitizedEmail } });
    if (existUser) throw new ResponseError(400, "User already exists!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const existRole = await Role.findById(roleId);
    if (!existRole) throw new ResponseError(400, "Role does not exist!");

    const hashPassword = await doHash(password, 12);
    const newUser = new User({ email: sanitizedEmail, password: hashPassword, fullName, roleId });
    const savedUser = await newUser.save();
    (savedUser as unknown as Record<string, unknown>).password = undefined;
    return savedUser;
};

export const user = async ({ id }: { id: string }) => {
    const result = await User.findOne({ _id: id }).populate({ path: "roleId", select: "name permissions" });
    if (!result) throw new ResponseError(404, "User does not exist!");
    return serializeUserWithRole(result);
};

export const updateUser = async ({
    id,
    value,
    adminId,
}: {
    id: string;
    value: Record<string, any>;
    adminId: string;
}) => {
    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const existUser = await User.findOne({ _id: id });
    if (!existUser) throw new ResponseError(404, "User does not exist!");

    const sanitizedFullName = value.fullName.trim();
    const sanitizedEmail = value.email.trim().toLowerCase();

    if (existUser.fullName != value.fullName) {
        const existingUser = await User.findOne({
            fullName: { $eq: sanitizedFullName },
        });
        if (existingUser) throw new ResponseError(400, `User ${value.fullName} already exist!`);
    }

    if (existUser.email !== sanitizedEmail) {
        const existingEmail = await User.findOne({
            email: { $eq: sanitizedEmail },
        });
        if (existingEmail) throw new ResponseError(400, `User with email ${value.email} already exist!`);
    }

    const roleExists = await Role.findById(value.roleId);
    if (!roleExists) throw new ResponseError(400, "Role does not exist!");

    existUser.fullName = value.fullName;
    existUser.email = sanitizedEmail;
    existUser.roleId = value.roleId;
    existUser.verified = value.verified;
    const result = await existUser.save();
    return result;
};

export const deleteUserById = async (id: string, adminId: string) => {
    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }
    const existUser = await User.findById(id);
    if (!existUser) throw new ResponseError(404, "User does not exist!");
    await User.deleteOne({ _id: id });
    return { success: true, message: "successfully deleted user" };
};
