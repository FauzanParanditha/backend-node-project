import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import { ClientKeyModel } from "../models/clientKeyModel.js";
import Client from "../models/clientModel.js";
import type { ListQueryParams } from "../types/service.js";
import { escapeRegExp } from "../utils/helper.js";

const getClientIdsByUserId = async (userId: string): Promise<string[]> => {
    const clients = await Client.find({ userIds: { $in: [userId] } }).select("+clientId");
    return clients.map((item) => item.clientId).filter(Boolean) as string[];
};

export async function getClientPublicKey(clientId: string): Promise<string> {
    const clientKey = await ClientKeyModel.findOne({ clientId, active: true }).lean().select("+publicKey");
    if (!clientKey) {
        throw new Error("Client public key not found or inactive");
    }
    return clientKey.publicKey as string;
}

export const getAllClients = async ({
    query,
    limit,
    page,
    sort_by,
    sort,
    countOnly,
    userId,
}: ListQueryParams & { userId?: string }) => {
    const filter: Record<string, unknown> = {};

    // Apply search term if provided
    if (query && query.trim()) {
        const searchTerm = escapeRegExp(query.trim());
        filter["$or"] = [
            { clientId: { $regex: searchTerm, $options: "i" } },
        ];
    }

    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        filter.clientId = { $in: clientIds.length ? clientIds : ["__none__"] };
    }

    const sortField = sort_by || "_id";
    const sortValue = Number(sort) || -1;
    const limitNum = Number(limit);
    const skip = (Number(page) - 1) * limitNum;

    if (countOnly) {
        return { count: await ClientKeyModel.countDocuments(filter) };
    }

    const clients = await ClientKeyModel.find(filter)
        .sort({ [sortField]: sortValue as 1 | -1 })
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

export const createClient = async ({ value }: { value: Record<string, any> }) => {
    const existClientId = await Client.findOne({ clientId: { $eq: value.clientId } }).select("+clientId");
    if (!existClientId) throw new ResponseError(404, "Client does not exist!");

    const existClient = await ClientKeyModel.findOne({ clientId: { $eq: value.clientId } });
    if (existClient) throw new ResponseError(400, "Client already exists!");

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin?.verified) {
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

export const client = async ({ id, userId }: { id: string; userId?: string }) => {
    const filter: Record<string, unknown> = { _id: id };

    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        filter.clientId = { $in: clientIds.length ? clientIds : ["__none__"] };
    }

    const result = await ClientKeyModel.findOne(filter).select("+publicKey").populate({
        path: "adminId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "Client does not exist!");
    return result;
};

export const updateClient = async ({ id, value, userId }: { id: string; value: Record<string, any>; userId?: string }) => {
    const filter: Record<string, unknown> = { _id: id };

    if (userId) {
        const clientIds = await getClientIdsByUserId(userId);
        filter.clientId = { $in: clientIds.length ? clientIds : ["__none__"] };
    }

    const existClient = await ClientKeyModel.findOne(filter);
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    if (!userId) {
        if (existClient.adminId.toString() != value.adminId) throw new ResponseError(401, "Unauthorized!");

        const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
        if (!verifiedAdmin?.verified) {
            throw new ResponseError(400, `Admin is not verified`);
        }

        const sanitizedName = value.clientId.trim();

        if (existClient.clientId != value.clientId) {
            const existingClient = await ClientKeyModel.findOne({
                clientId: { $eq: sanitizedName },
            });
            if (existingClient) throw new ResponseError(400, `Client ${value.name} already exist!`);
        }
    }

    existClient.publicKey = value.publicKey;
    existClient.active = value.active;
    const result = await existClient.save();
    return result;
};

export const deleteClient = async ({ id, adminId }: { id: string; adminId: string }) => {
    const existClient = await ClientKeyModel.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    if (existClient.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    await ClientKeyModel.deleteOne({ _id: id });
    return {
        id: String(existClient._id),
        clientId: existClient.clientId,
    };
};
