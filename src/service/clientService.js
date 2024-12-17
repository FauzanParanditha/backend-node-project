import Client from "../models/clientModel.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllClients = async ({ query, limit, page, sort_by, sort, countOnly }) => {
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
        return { count: await Client.countDocuments(filter) };
    }

    const clients = await Client.find(filter)
        .sort({ [sortField]: sortValue })
        .limit(limitNum)
        .skip(skip)
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

export const createClient = async ({ name, notifyUrl }) => {
    const existClient = await Client.findOne({ name: { $eq: name } });
    if (existClient) throw new ResponseError(400, "Client already exists!");

    const clientId = await generateUniqueClientId();
    const newClient = new Client({ name, clientId, notifyUrl, adminId });
    const savedClient = await newClient.save();
    return savedClient;
};

export const client = async ({ id }) => {
    const result = await Client.findOne({ _id: id }).populate({
        path: "adminId",
        select: "email",
    });
    if (!result) throw new ResponseError(404, "IpAddress does not exist!");
    return result;
};

export const updateClient = async ({ id, adminId, name, notifyUrl }) => {
    const existClient = await Client.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");
    if (existClient.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    // Sanitize the input
    const sanitizedName = name.trim();

    const existingClient = await Client.findOne({
        name: { $eq: sanitizedName },
    });
    if (existingClient) throw new ResponseError(400, `Client ${name} already exist!`);

    existClient.name = name;
    existClient.notifyUrl = notifyUrl;
    const result = await existClient.save();
    return result;
};

export const deleteClient = async ({ id, adminId }) => {
    const existClient = await Client.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    if (existClient.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    await Client.deleteOne({ _id: id });
    return true;
};

export async function generateUniqueClientId() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";

    while (true) {
        // Generate 5 random alphabets
        let alphabetPart = "";
        for (let i = 0; i < 5; i++) {
            alphabetPart += letters.charAt(Math.floor(Math.random() * letters.length));
        }

        // Generate 6 random numeric digits
        let numericPart = "";
        for (let i = 0; i < 6; i++) {
            numericPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }

        const clientId = alphabetPart + numericPart;

        // Check uniqueness in the database
        const existingClient = await Client.findOne({ clientId });
        if (!existingClient) {
            return clientId; // Return unique client ID
        }
    }
}
