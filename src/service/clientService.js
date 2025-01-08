import { ResponseError } from "../error/responseError.js";
import Client from "../models/clientModel.js";
import User from "../models/userModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllClients = async ({ query, limit, page, sort_by, sort, countOnly }) => {
    const filter = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { name: { $regex: searchTerm, $options: "i" } },
            { clientId: { $regex: searchTerm, $options: "i" } },
        ];
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await Client.countDocuments(filter) };
    }

    const clients = await Client.find(filter)
        .select("+clientId")
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "userId",
            select: "email",
        })
        .exec();

    const total = await Client.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        clients,
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: clients.length,
        },
    };
};

export const createClient = async ({ value }) => {
    const existClient = await Client.findOne({ name: { $eq: value.name } });
    if (existClient) throw new ResponseError(400, "Client already exists!");

    const clientId = await generateUniqueClientId();

    const existUser = await User.findOne({ _id: value.userId });
    if (!existUser) throw new ResponseError(400, "User is not registerd!");

    const newClient = new Client({
        name: value.name,
        clientId,
        notifyUrl: value.notifyUrl,
        active: value.active,
        userId: value.userId,
        adminId: value.adminId,
    });
    const savedClient = await newClient.save();
    return savedClient;
};

export const client = async ({ id }) => {
    const result = await Client.findOne({ _id: id }).populate({
        path: "userId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "Client does not exist!");
    return result;
};

export const updateClient = async ({ id, value }) => {
    const existClient = await Client.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    const existUser = await User.findOne({ _id: value.userId });
    if (!existUser) throw new ResponseError(400, "User is not registerd!");

    if (existClient.adminId.toString() != value.adminId) throw new ResponseError(401, "Unauthorized!");

    // Sanitize the input
    const sanitizedName = value.name.trim();

    if (existClient.name != value.name) {
        const existingClient = await Client.findOne({
            name: { $eq: sanitizedName },
        });
        if (existingClient) throw new ResponseError(400, `Client ${value.name} already exist!`);
    }

    existClient.name = value.name;
    existClient.notifyUrl = value.notifyUrl;
    existClient.userId = value.userId;
    existClient.active = value.active;
    const result = await existClient.save();
    return result;
};

export const deleteClient = async ({ id, adminId }) => {
    const existClient = await Client.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    // if (existClient.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    await Client.deleteOne({ _id: id });
    return true;
};

export async function generateUniqueClientId() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const maxRetries = 10;

    for (let i = 0; i < maxRetries; i++) {
        let alphabetPart = Array.from({ length: 5 }, () =>
            letters.charAt(Math.floor(Math.random() * letters.length)),
        ).join("");

        let numericPart = Array.from({ length: 6 }, () =>
            numbers.charAt(Math.floor(Math.random() * numbers.length)),
        ).join("");

        const clientId = alphabetPart + numericPart;

        const existingClient = await Client.findOne({ clientId });
        if (!existingClient) {
            return clientId;
        }
    }

    throw new Error("Failed to generate a unique client ID after maximum retries.");
}
