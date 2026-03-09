import type { Request } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { ResponseError } from "../error/responseError.js";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import type { ListQueryParams } from "../types/service.js";
import { escapeRegExp } from "../utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getAllProducts = async ({ query, limit, page, sort_by, sort, countOnly }: ListQueryParams) => {
    const filter: Record<string, unknown> = {};

    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [{ title: { $regex: searchTerm, $options: "i" } }];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await Product.countDocuments(filter) };
    }

    const products = await Product.find(filter)
        .sort({ [sortField]: sortValue as 1 | -1 })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "category",
            select: "name",
        })
        .exec();

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        products,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: products.length,
        },
    };
};

export const createProduct = async ({ req, adminId }: { req: Request; adminId: string }) => {
    const title = req.body.title.trim();

    const existingProduct = await Product.findOne({ title: { $eq: title } });
    if (existingProduct) throw new ResponseError(400, "Product already exist!");

    const category = req.body.category.trim();

    const existCategory = await Category.findOne({ name: { $eq: category } });
    if (!existCategory) throw new ResponseError(404, "Category does not exist!");

    const newProduct = new Product({
        title: req.body.title,
        price: req.body.price,
        discount: req.body.discount,
        stock: req.body.stock,
        category: existCategory._id,
        colors: JSON.parse(req.body.colors),
        sizes: JSON.parse(req.body.sizes),
        image: req.file!.path,
        description: req.body.description,
        adminId: adminId,
    });

    const result = await newProduct.save();

    return result;
};

export const product = async ({ id }: { id: string }) => {
    const result = await Product.findOne({ _id: id }).populate({
        path: "category",
        select: "name",
    });
    if (!result) throw new ResponseError(404, "Product does not exist!");
    return result;
};

export const updateProduct = async ({
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
    const existingProduct = await Product.findById(id);
    if (!existingProduct) throw new ResponseError(404, "Product does not exist!");

    const category = value.category.trim();

    const existCategory = await Category.findOne({ name: { $eq: category } });
    if (!existCategory) throw new ResponseError(404, "Category does not exist!");

    if (existingProduct.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    const updateData: Record<string, any> = {
        title: value.title,
        price: value.price,
        discount: value.discount,
        stock: value.stock,
        category: existCategory._id,
        colors: value.colors || "[]",
        sizes: value.sizes || "[]",
        description: value.description,
    };

    if (req.file) {
        try {
            const oldImagePath = path.join(__dirname, "../..", existingProduct.image || "");
            await fs.promises.unlink(oldImagePath);

            updateData.image = req.file.path;
        } catch (error) {
            console.error("Failed to delete old image!, ", error);
            throw new ResponseError(400, "Failed to delete old image!");
        }
    }

    await Product.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    });

    return updateData;
};

export const deleteProduct = async ({ id, adminId }: { id: string; adminId: string }) => {
    const product = await Product.findById(id);
    if (!product) throw new ResponseError(404, "Product does not exist!");

    if (product.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    try {
        const imagePath = path.join(__dirname, "../..", product.image || "");
        await fs.promises.unlink(imagePath);
    } catch (error) {
        console.error("Failed to delete old image!, ", error);
        throw new ResponseError(400, "Failed to delete old image!");
    }

    await Product.findByIdAndDelete(id);
    return true;
};
