import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
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

export const registerAdmin = async ({ email, password, fullName, role, adminId }) => {
    const sanitizedEmail = email.trim();

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (existAdmin) throw new ResponseError(400, "Admin already exists!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    const hashPassword = await doHash(password, 12);
    const newAdmin = new Admin({ email, password: hashPassword, fullName, role });
    const savedAdmin = await newAdmin.save();
    savedAdmin.password = undefined;
    return savedAdmin;
};

export const admin = async ({ id }) => {
    const result = await Admin.findOne({ _id: id });
    if (!result) throw new ResponseError(404, "Admin does not exist!");
    return result;
};

export const updateAdmin = async ({ id, value, adminId }) => {
    const existAdmin = await Admin.findOne({ _id: id });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Sanitize the input
    const sanitizedadmin = value.fullName.trim();

    if (existAdmin.fullName != value.fullName) {
        const existingAdmin = await Admin.findOne({
            fullName: { $eq: sanitizedadmin },
        });
        if (existingAdmin) throw new ResponseError(400, `Admin ${value.fullName} already exist!`);
    }

    existAdmin.fullName = value.fullName;
    const result = await existAdmin.save();
    return result;
};

export const deleteAdminById = async (id, adminId) => {
    const existAdmin = await Admin.findById(id);
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    await Admin.deleteOne({ _id: id });
    return { success: true, message: "successfully deleted admin" };
};

export const dashboard = async () => {
    const [client, user, order, successStats] = await Promise.all([
        Client.countDocuments(),
        User.countDocuments(),
        Order.countDocuments(),
        Order.aggregate([
            { $match: { paymentStatus: "paid" } },
            {
                $group: {
                    _id: null,
                    totalAmountSuccess: { $sum: "$totalAmount" },
                    totalTransactionSuccess: { $sum: 1 },
                },
            },
        ]),
    ]);

    const summary = successStats[0] ?? { totalAmountSuccess: 0, totalTransactionSuccess: 0 };

    return {
        success: true,
        client,
        user,
        order,
        totalAmountSuccess: summary.totalAmountSuccess,
        totalTransactionSuccess: summary.totalTransactionSuccess,
    };
};

const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildChartConfig = ({ period, date, month, year }) => {
    const now = new Date();
    const labels = [];

    if (period === "day") {
        const selectedDate = date || now.toISOString().slice(0, 10);
        if (!isValidIsoDate(selectedDate)) {
            throw new ResponseError(400, "Invalid date format. Use YYYY-MM-DD");
        }

        const startDate = new Date(`${selectedDate}T00:00:00.000Z`);
        if (Number.isNaN(startDate.getTime())) {
            throw new ResponseError(400, "Invalid date value");
        }

        const endDateExclusive = new Date(startDate);
        endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);

        for (let i = 0; i < 24; i += 1) {
            labels.push(`${String(i).padStart(2, "0")}:00`);
        }

        return {
            period,
            labels,
            startDate,
            endDateExclusive,
            format: "%H:00",
            filters: { date: selectedDate },
        };
    }

    if (period === "month") {
        const currentMonth = now.getUTCMonth() + 1;
        const currentYear = now.getUTCFullYear();
        const monthNum = month ? Number(month) : currentMonth;
        const yearNum = year ? Number(year) : currentYear;

        if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
            throw new ResponseError(400, "Invalid month. Use 1-12");
        }
        if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 9999) {
            throw new ResponseError(400, "Invalid year");
        }

        const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
        const endDateExclusive = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0));
        const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();

        for (let day = 1; day <= daysInMonth; day += 1) {
            labels.push(`${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        }

        return {
            period,
            labels,
            startDate,
            endDateExclusive,
            format: "%Y-%m-%d",
            filters: { month: monthNum, year: yearNum },
        };
    }

    if (period === "year") {
        const yearNum = year ? Number(year) : now.getUTCFullYear();
        if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 9999) {
            throw new ResponseError(400, "Invalid year");
        }

        const startDate = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0, 0));
        const endDateExclusive = new Date(Date.UTC(yearNum + 1, 0, 1, 0, 0, 0, 0));

        for (let i = 1; i <= 12; i += 1) {
            labels.push(`${yearNum}-${String(i).padStart(2, "0")}`);
        }

        return {
            period,
            labels,
            startDate,
            endDateExclusive,
            format: "%Y-%m",
            filters: { year: yearNum },
        };
    }

    if (period === "yearly") {
        const startDate = new Date(now);
        startDate.setUTCDate(1);
        startDate.setUTCHours(0, 0, 0, 0);
        startDate.setUTCMonth(startDate.getUTCMonth() - 11);

        const cursor = new Date(startDate);
        for (let i = 0; i < 12; i += 1) {
            labels.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }

        return {
            period,
            labels,
            startDate,
            endDateExclusive: now,
            format: "%Y-%m",
            filters: {},
        };
    }

    const startDate = new Date(now);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 29);

    const cursor = new Date(startDate);
    for (let i = 0; i < 30; i += 1) {
        labels.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
        period: "monthly",
        labels,
        startDate,
        endDateExclusive: now,
        format: "%Y-%m-%d",
        filters: {},
    };
};

const buildChartSeries = async ({ period, date, month, year, extraMatch = {}, filterMeta = {} }) => {
    const config = buildChartConfig({ period, date, month, year });

    const aggregated = await Order.aggregate([
        {
            $match: {
                ...extraMatch,
                paymentStatus: "paid",
                updatedAt: { $gte: config.startDate, $lt: config.endDateExclusive },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: config.format,
                        date: "$updatedAt",
                        timezone: "UTC",
                    },
                },
                totalAmountSuccess: { $sum: "$totalAmount" },
                totalTransactionSuccess: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const aggregatedMap = new Map(
        aggregated.map((item) => [
            item._id,
            {
                totalAmountSuccess: item.totalAmountSuccess ?? 0,
                totalTransactionSuccess: item.totalTransactionSuccess ?? 0,
            },
        ]),
    );

    const amountData = config.labels.map((label) => aggregatedMap.get(label)?.totalAmountSuccess ?? 0);
    const transactionData = config.labels.map((label) => aggregatedMap.get(label)?.totalTransactionSuccess ?? 0);

    return {
        period: config.period,
        groupBy: "time",
        filters: { ...config.filters, ...filterMeta },
        labels: config.labels,
        series: [
            { name: "totalAmountSuccess", data: amountData },
            { name: "totalTransactionSuccess", data: transactionData },
        ],
    };
};

const buildChartSeriesByClient = async ({ period, date, month, year, extraMatch = {}, filterMeta = {} }) => {
    const config = buildChartConfig({ period, date, month, year });

    const aggregated = await Order.aggregate([
        {
            $match: {
                ...extraMatch,
                paymentStatus: "paid",
                updatedAt: { $gte: config.startDate, $lt: config.endDateExclusive },
            },
        },
        {
            $group: {
                _id: "$clientId",
                totalAmountSuccess: { $sum: "$totalAmount" },
                totalTransactionSuccess: { $sum: 1 },
            },
        },
        { $sort: { totalAmountSuccess: -1, _id: 1 } },
    ]);

    const data = aggregated.map((item) => ({
        clientId: item._id,
        totalAmountSuccess: item.totalAmountSuccess ?? 0,
        totalTransactionSuccess: item.totalTransactionSuccess ?? 0,
    }));

    return {
        period: config.period,
        groupBy: "client",
        filters: { ...config.filters, ...filterMeta },
        data,
    };
};

export const dashboardChart = async ({ period, date, month, year, clientId, groupBy = "time" }) => {
    const sanitizedClientId = typeof clientId === "string" ? clientId.trim() : "";
    const baseParams = {
        period,
        date,
        month,
        year,
        extraMatch: sanitizedClientId ? { clientId: sanitizedClientId } : {},
        filterMeta: sanitizedClientId ? { clientId: sanitizedClientId } : {},
    };

    if (groupBy === "client") {
        return buildChartSeriesByClient(baseParams);
    }

    return buildChartSeries(baseParams);
};

export const dashboardChartForUser = async ({ userId, period, date, month, year, clientId, groupBy = "time" }) => {
    const clients = await Client.find({ userId }).select("+clientId");
    const clientIds = clients.map((item) => item.clientId);
    const config = buildChartConfig({ period, date, month, year });
    const sanitizedClientId = typeof clientId === "string" ? clientId.trim() : "";

    if (sanitizedClientId && !clientIds.includes(sanitizedClientId)) {
        throw new ResponseError(403, "Access forbidden for requested clientId");
    }

    const selectedClientIds = sanitizedClientId ? [sanitizedClientId] : clientIds;

    if (!selectedClientIds.length) {
        if (groupBy === "client") {
            return {
                period: config.period,
                groupBy,
                filters: sanitizedClientId ? { ...config.filters, clientId: sanitizedClientId } : config.filters,
                data: [],
            };
        }

        const emptyLabels = config.labels;
        return {
            period: config.period,
            groupBy,
            filters: sanitizedClientId ? { ...config.filters, clientId: sanitizedClientId } : config.filters,
            labels: emptyLabels,
            series: [
                { name: "totalAmountSuccess", data: emptyLabels.map(() => 0) },
                { name: "totalTransactionSuccess", data: emptyLabels.map(() => 0) },
            ],
        };
    }

    const baseParams = {
        period,
        date,
        month,
        year,
        extraMatch: { clientId: { $in: selectedClientIds } },
        filterMeta: sanitizedClientId ? { clientId: sanitizedClientId } : {},
    };

    if (groupBy === "client") {
        return buildChartSeriesByClient(baseParams);
    }

    return buildChartSeries(baseParams);
};

export const dashboardForUser = async ({ userId }) => {
    const clients = await Client.find({ userId }).select("+clientId");
    const clientIds = clients.map((item) => item.clientId);

    const client = clients.length;
    const user = 1;
    const [order, successStats] = clientIds.length
        ? await Promise.all([
              Order.countDocuments({ clientId: { $in: clientIds } }),
              Order.aggregate([
                  { $match: { clientId: { $in: clientIds }, paymentStatus: "paid" } },
                  {
                      $group: {
                          _id: null,
                          totalAmountSuccess: { $sum: "$totalAmount" },
                          totalTransactionSuccess: { $sum: 1 },
                      },
                  },
              ]),
          ])
        : [0, []];

    const summary = successStats[0] ?? { totalAmountSuccess: 0, totalTransactionSuccess: 0 };

    return {
        success: true,
        client,
        user,
        order,
        totalAmountSuccess: summary.totalAmountSuccess,
        totalTransactionSuccess: summary.totalTransactionSuccess,
    };
};
