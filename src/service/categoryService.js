import { ResponseError } from "../error/responseError.js";
import Category from "../models/categoryModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllCategorys = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [{ name: { $regex: searchTerm, $options: "i" } }];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await Category.countDocuments(filter) };
    }

    const categorys = await Category.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "adminId",
            select: "email",
        })
        .exec();

    const total = await Category.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        categorys,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: categorys.length,
        },
    };
};

export const createCategory = async ({ value }) => {
    const sanitizedName = value.name.trim();

    const existCategory = await Category.findOne({
        name: { $eq: sanitizedName },
    });
    if (existCategory) throw new ResponseError(400, `Category ${value.name} already exists!`);

    const newCategory = new Category({
        name: value.name,
        adminId: value.adminId,
    });
    const result = await newCategory.save();

    return result;
};

export const category = async ({ id }) => {
    const result = await Category.findOne({ _id: id }).populate({
        path: "adminId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "Category does not exist!");
    return result;
};

export const updateCategory = async ({ id, value }) => {
    const existCategory = await Category.findOne({ _id: id });
    if (!existCategory) throw new ResponseError(404, "Category does not exist!");
    if (existCategory.adminId.toString() != value.adminId) throw new ResponseError(401, "Unauthorized!");

    const sanitizedName = value.name.trim();

    const existingCategory = await Category.findOne({
        name: { $eq: sanitizedName },
    });
    if (existingCategory) throw new ResponseError(400, `Category ${value.name} already exists!`);

    existCategory.name = value.name;
    const result = await existCategory.save();
    return result;
};

export const deleteCategory = async ({ id, adminId }) => {
    const existCategory = await Category.findOne({ _id: id });
    if (!existCategory) throw new ResponseError(404, "Category does not exist!");

    if (existCategory.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    await Category.deleteOne({ _id: id });
    return true;
};
