import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import AvailablePayment from "../models/availablePaymentModel.js";
import ClientAvailablePayment from "../models/clientAvailablePaymentModel.js";
import Client from "../models/clientModel.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import type { ListQueryParams } from "../types/service.js";
import { escapeRegExp } from "../utils/helper.js";

export const getAllClients = async ({ query, limit, page, sort_by, sort, countOnly }: ListQueryParams) => {
    const filter: Record<string, unknown> = {};

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
        .sort({ [sortField]: sortValue as 1 | -1 })
        .limit(limitNum)
        .skip(skip)
        .populate({
            path: "userIds",
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

export const createClient = async ({ value }: { value: Record<string, any> }) => {
    const existClient = await Client.findOne({ name: { $eq: value.name } });
    if (existClient) throw new ResponseError(400, "Client already exists!");

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const existingUsers = await User.find({ _id: { $in: value.userIds } });
    if (existingUsers.length !== value.userIds.length) {
        throw new ResponseError(400, "One or more users are not registered!");
    }

    const clientId = await generateUniqueClientId(value.name);

    const newClient = new Client({
        name: value.name,
        clientId,
        notifyUrl: value.notifyUrl,
        active: value.active,
        userIds: value.userIds,
        adminId: value.adminId,
    });
    const savedClient = await newClient.save();
    const clientIdValue = savedClient.clientId || clientId;

    if (value.availablePaymentIds && value.availablePaymentIds.length) {
        const availablePayments = await AvailablePayment.find({
            _id: { $in: value.availablePaymentIds },
        }).select("_id");

        const validIds = new Set(availablePayments.map((item) => String(item._id)));
        const payload = value.availablePaymentIds
            .filter((id: string) => validIds.has(id.toString()))
            .map((id: string) => ({
                clientId: String(clientIdValue),
                availablePaymentId: id,
                active: true,
                adminId: value.adminId,
            }));

        if (!payload.length) {
            throw new ResponseError(400, "Available payment is not valid");
        }

        await ClientAvailablePayment.insertMany(payload);
    }

    return savedClient;
};

export const client = async ({ id }: { id: string }) => {
    const result = await Client.findOne({ _id: id })
        .populate({
            path: "userIds",
            select: "email",
        })
        .select("+clientId");
    if (!result) throw new ResponseError(404, "Client does not exist!");

    const payments = await ClientAvailablePayment.find({ clientId: result.clientId })
        .populate({
            path: "availablePaymentId",
            model: "AvailablePayment",
            select: "name image category active",
        })
        .exec();

    return {
        ...result.toObject(),
        availablePayments: payments.map((item) => ({
            id: item._id,
            clientId: item.clientId,
            active: item.active,
            availablePayment: item.availablePaymentId,
        })),
    };
};

export const updateClient = async ({ id, value }: { id: string; value: Record<string, any> }) => {
    const existClient = await Client.findOne({ _id: id }).select("+clientId");
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    const existingUsers = await User.find({ _id: { $in: value.userIds } });
    if (existingUsers.length !== value.userIds.length) {
        throw new ResponseError(400, "One or more users are not registered!");
    }

    if (existClient.adminId.toString() != value.adminId) throw new ResponseError(401, "Unauthorized!");

    const verifiedAdmin = await Admin.findOne({ _id: value.adminId });
    if (!verifiedAdmin?.verified) {
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
    existClient.userIds = value.userIds;
    existClient.active = value.active;
    const result = await existClient.save();

    if (value.availablePaymentIds && value.availablePaymentIds.length) {
        const availablePayments = await AvailablePayment.find({
            _id: { $in: value.availablePaymentIds },
        }).select("_id");

        const validIds = new Set(availablePayments.map((item) => String(item._id)));
        const payload = value.availablePaymentIds
            .filter((id: string) => validIds.has(id.toString()))
            .map((id: string) => ({
                clientId: existClient.clientId,
                availablePaymentId: id,
                active: true,
                adminId: value.adminId,
            }));

        if (!payload.length) {
            throw new ResponseError(400, "Available payment is not valid");
        }

        await ClientAvailablePayment.deleteMany({ clientId: existClient.clientId });
        await ClientAvailablePayment.insertMany(payload);
    }

    return result;
};

export const deleteClient = async ({ id, adminId }: { id: string; adminId: string }) => {
    const existClient = await Client.findOne({ _id: id });
    if (!existClient) throw new ResponseError(404, "Client does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const haveOrder = await Order.findOne({ clientId: existClient.clientId });
    if (haveOrder) throw new ResponseError(400, "This Client Have Order");

    await Client.deleteOne({ _id: id });
    return true;
};

export async function generateUniqueClientId(name: string): Promise<string> {
    const maxRetries = 10;

    // Normalisasi nama: hapus karakter khusus, ubah ke huruf besar
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // Ambil 3 huruf pertama atau tambahkan 'X' jika kurang
    let shortName = sanitizedName.slice(0, 3);
    while (shortName.length < 3) {
        shortName += "X"; // Tambahkan 'X' jika kurang dari 3 huruf
    }

    // Cek apakah prefix 3 huruf ini sudah digunakan
    const existingClients = await Client.find({ clientId: new RegExp(`^${shortName}-\\d{3}$`) });

    let finalPrefix: string;
    if (existingClients.length === 0) {
        // Jika belum ada yang menggunakan prefix ini, gunakan langsung
        finalPrefix = shortName;
    } else {
        // Jika sudah ada, gunakan huruf pertama, tengah, dan terakhir
        const firstChar = sanitizedName[0] || "X";
        const middleChar = sanitizedName[Math.floor(sanitizedName.length / 2)] || "Y";
        const lastChar = sanitizedName[sanitizedName.length - 1] || "Z";

        finalPrefix = `${firstChar}${middleChar}${lastChar}`;
    }

    for (let i = 0; i < maxRetries; i++) {
        // Cari jumlah klien yang sudah ada dengan prefix ini
        const existingClientsWithPrefix = await Client.find({
            clientId: new RegExp(`^${finalPrefix}-\\d{3}$`),
        })
            .sort({ clientId: -1 })
            .limit(1);

        let nextNumber = "001"; // Default jika belum ada ID
        if (existingClientsWithPrefix.length > 0) {
            // Ambil angka terakhir dan tambahkan 1
            const lastNumber = parseInt(existingClientsWithPrefix[0].clientId!.split("-")[1], 10);
            nextNumber = String(lastNumber + 1).padStart(3, "0");
        }

        const newClientId = `${finalPrefix}-${nextNumber}`;

        // Pastikan ID belum ada (redundansi untuk keamanan)
        const exists = await Client.findOne({ clientId: newClientId });
        if (!exists) {
            return newClientId;
        }
    }

    throw new Error("Failed to generate a unique client ID after maximum retries.");
}
