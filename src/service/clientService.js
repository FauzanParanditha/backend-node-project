import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import Order from "../models/orderModel.js";
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

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const existUser = await User.findOne({ _id: value.userId });
    if (!existUser) throw new ResponseError(400, "User is not registerd!");

    const clientId = await generateUniqueClientId(value.name);

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

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

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

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const haveOrder = await Order.findOne({ clientId: existClient.clientId });
    if (haveOrder) throw new ResponseError(400, "This Client Have Order");

    // if (existClient.adminId.toString() != adminId) throw new ResponseError(401, "Unauthorized!");

    await Client.deleteOne({ _id: id });
    return true;
};

export async function generateUniqueClientId(name) {
    const maxRetries = 10;

    // Normalisasi nama: hapus karakter khusus, ubah ke huruf besar
    let sanitizedPrefix = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // Ambil 3 huruf pertama atau tambahkan huruf jika kurang
    let shortName = sanitizedPrefix.slice(0, 3);
    while (shortName.length < 3) {
        shortName += "X"; // Tambahkan 'X' jika kurang dari 3 huruf
    }

    for (let i = 0; i < maxRetries; i++) {
        // Cari jumlah klien yang sudah ada dengan prefix yang sama
        const existingClients = await Client.find({ clientId: new RegExp(`^${shortName}-\\d{3}$`) })
            .sort({ clientId: -1 }) // Ambil ID terbesar
            .limit(1)
            .select("+clientId");

        let nextNumber = "001"; // Default jika belum ada ID
        if (existingClients.length > 0) {
            // Ambil angka terakhir dan tambahkan 1
            const lastNumber = parseInt(existingClients[0].clientId.split("-")[1], 10);
            nextNumber = String(lastNumber + 1).padStart(3, "0");
        }

        const newClientId = `${shortName}-${nextNumber}`;

        // Pastikan ID belum ada (redundansi untuk keamanan)
        const exists = await Client.findOne({ clientId: newClientId });
        if (!exists) {
            return newClientId;
        }
    }

    throw new Error("Failed to generate a unique client ID after maximum retries.");
}
