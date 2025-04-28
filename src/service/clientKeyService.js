import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import { ClientKeyModel } from "../models/clientKeyModel.js";
import Client from "../models/clientModel.js";
import { escapeRegExp } from "../utils/helper.js";

export async function getClientPublicKey(clientId) {
    const clientKey = await ClientKeyModel.findOne({ clientId, active: true }).lean().select("+publicKey");
    if (!clientKey) {
        throw new Error("Client public key not found or inactive");
    }
    return clientKey.publicKey;
}

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
        return { count: await ClientKeyModel.countDocuments(filter) };
    }

    const clients = await ClientKeyModel.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "adminId",
            select: "email",
        })
        .exec();

    const total = await ClientKeyModel.countDocuments(filter);
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
    const existClientId = await Client.findOne({ clientId: { $eq: value.clientId } }).select("+clientId");
    if (!existClientId) throw new ResponseError(404, "Client does not exist!");

    const existClient = await ClientKeyModel.findOne({ clientId: { $eq: value.clientId } });
    if (existClient) throw new ResponseError(400, "Client already exists!");

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const newClient = new ClientKeyModel({
        clientId: existClientId.clientId,
        publicKey: value.publicKey,
        active: value.active,
        adminId: value.adminId,
    });
    const savedClient = await newClient.save();
    return savedClient;
};

export const client = async ({ id }) => {
    const result = await ClientKeyModel.findOne({ _id: id }).select("+publicKey").populate({
        path: "adminId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "Client does not exist!");
    return result;
};

export const updateClient = async ({ id, value }) => {
    const existClient = await ClientKeyModel.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    if (existClient.adminId.toString() != value.adminId) throw new ResponseError(401, "Unauthorized!");

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Sanitize the input
    const sanitizedName = value.clientId.trim();

    if (existClient.clientId != value.clientId) {
        const existingClient = await ClientKeyModel.findOne({
            clientId: { $eq: sanitizedName },
        });
        if (existingClient) throw new ResponseError(400, `Client ${value.name} already exist!`);
    }

    existClient.publicKey = value.publicKey;
    existClient.active = value.active;
    const result = await existClient.save();
    return result;
};

export const deleteClient = async ({ id, adminId }) => {
    const existClient = await ClientKeyModel.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    if (existClient.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    await ClientKeyModel.deleteOne({ _id: id });
    return true;
};
