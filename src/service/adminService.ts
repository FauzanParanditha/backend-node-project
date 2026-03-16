import { ResponseError } from "../error/responseError.js";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import Order from "../models/orderModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import type { ListQueryParams } from "../types/service.js";
import { doHash, escapeRegExp } from "../utils/helper.js";

const serializeAdminWithRole = (admin: any) => {
    const plainAdmin = typeof admin.toObject === "function" ? admin.toObject() : admin;
    const populatedRole = plainAdmin.roleId;
    const roleName = populatedRole && typeof populatedRole === "object" ? populatedRole.name ?? null : null;

    return {
        ...plainAdmin,
        roleId: populatedRole && typeof populatedRole === "object" ? populatedRole._id : plainAdmin.roleId,
        role: roleName,
        roleName,
    };
};

export const getAllAdmins = async ({ query, limit, page, sort_by, sort, countOnly }: ListQueryParams) => {
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
        return { count: await Admin.countDocuments(filter) };
    }

    const admins = await Admin.find(filter)
        .populate({ path: "roleId", select: "name" })
        .sort({ [sortField]: sortValue as 1 | -1 })
        .limit(limitNum)
        .skip(skip)
        .exec();

    const total = await Admin.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    return {
        admins: admins.map(serializeAdminWithRole),
        pagination: {
            totalRecords: total,
            totalPages,
            currentPage: Number(page),
            perPage: limitNum,
            recordsOnPage: admins.length,
        },
    };
};

export const registerAdmin = async ({
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

    const existAdmin = await Admin.findOne({ email: { $eq: sanitizedEmail } });
    if (existAdmin) throw new ResponseError(400, "Admin already exists!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Validate that the role exists
    const existRole = await Role.findById(roleId);
    if (!existRole) throw new ResponseError(400, "Role does not exist!");

    const hashPassword = await doHash(password, 12);
    const newAdmin = new Admin({ email, password: hashPassword, fullName, roleId });
    const savedAdmin = await newAdmin.save();
    (savedAdmin as unknown as Record<string, unknown>).password = undefined;
    return savedAdmin;
};

export const admin = async ({ id }: { id: string }) => {
    const result = await Admin.findOne({ _id: id }).populate({ path: "roleId", select: "name" });
    if (!result) throw new ResponseError(404, "Admin does not exist!");
    return serializeAdminWithRole(result);
};

export const updateAdmin = async ({
    id,
    value,
    adminId,
}: {
    id: string;
    value: Record<string, any>;
    adminId: string;
}) => {
    const existAdmin = await Admin.findOne({ _id: id });
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    // Update fullName if provided
    if (value.fullName) {
        const sanitizedadmin = value.fullName.trim();
        if (existAdmin.fullName != value.fullName) {
            const existingAdmin = await Admin.findOne({
                fullName: { $eq: sanitizedadmin },
            });
            if (existingAdmin) throw new ResponseError(400, `Admin ${value.fullName} already exist!`);
        }
        existAdmin.fullName = value.fullName;
    }

    // Update roleId if provided
    if (value.roleId) {
        const roleExists = await Role.findById(value.roleId);
        if (!roleExists) throw new ResponseError(400, "Role does not exist!");
        existAdmin.roleId = value.roleId;
    }

    const result = await existAdmin.save();
    return result;
};

export const deleteAdminById = async (id: string, adminId: string) => {
    const existAdmin = await Admin.findById(id);
    if (!existAdmin) throw new ResponseError(404, "Admin does not exist!");

    const verifiedAdmin = await Admin.findOne({ _id: adminId });
    if (!verifiedAdmin?.verified) {
        throw new ResponseError(400, `Admin is not verified`);
    }

    await Admin.deleteOne({ _id: id });
    return { success: true, message: "successfully deleted admin" };
};

export interface DashboardParams {
    period?: string; // last_week | last_month | last_3_months | custom
    startDate?: string; // ISO YYYY-MM-DD (for custom)
    endDate?: string; // ISO YYYY-MM-DD (for custom)
    clientId?: string;
    status?: string; // pending | paid | failed | expired | cancel
    // Chart params
    chartPeriod?: string; // day | month | year | monthly | yearly (for chart time-series)
    chartDate?: string;
    chartMonth?: string;
    chartYear?: string;
    groupBy?: string; // time | client
}

const buildDashboardDateFilter = (
    params: DashboardParams,
): { updatedAt?: Record<string, Date>; periodLabel: string } => {
    const now = new Date();
    const wibNow = toWibDateParts(now);

    if (params.period === "last_week") {
        const end = wibDateToUtc({ year: wibNow.year, month: wibNow.month, day: wibNow.day + 1 });
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 7);
        return { updatedAt: { $gte: start, $lt: end }, periodLabel: "last_week" };
    }

    if (params.period === "last_month") {
        const end = wibDateToUtc({ year: wibNow.year, month: wibNow.month, day: wibNow.day + 1 });
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 30);
        return { updatedAt: { $gte: start, $lt: end }, periodLabel: "last_month" };
    }

    if (params.period === "last_3_months") {
        const end = wibDateToUtc({ year: wibNow.year, month: wibNow.month, day: wibNow.day + 1 });
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 90);
        return { updatedAt: { $gte: start, $lt: end }, periodLabel: "last_3_months" };
    }

    if (params.period === "custom" && params.startDate && params.endDate) {
        if (!isValidIsoDate(params.startDate) || !isValidIsoDate(params.endDate)) {
            throw new ResponseError(400, "Invalid date format. Use YYYY-MM-DD");
        }
        const [sy, sm, sd] = params.startDate.split("-").map(Number);
        const [ey, em, ed] = params.endDate.split("-").map(Number);
        const start = wibDateToUtc({ year: sy, month: sm, day: sd });
        // Use setUTCDate to safely add 1 day — avoids overflow (e.g. Aug 31 + 1 ≠ Aug 32)
        const end = wibDateToUtc({ year: ey, month: em, day: ed });
        end.setUTCDate(end.getUTCDate() + 1);
        return { updatedAt: { $gte: start, $lt: end }, periodLabel: "custom" };
    }

    return { periodLabel: "all_time" };
};

const VALID_STATUSES = ["pending", "paid", "failed", "expired", "cancel"];

export const dashboard = async (params: DashboardParams = {}) => {
    const dateFilter = buildDashboardDateFilter(params);
    const orderFilter: Record<string, unknown> = {};
    if (dateFilter.updatedAt) orderFilter.updatedAt = dateFilter.updatedAt;
    if (params.clientId) orderFilter.clientId = params.clientId;
    if (params.status && VALID_STATUSES.includes(params.status)) orderFilter.paymentStatus = params.status;

    const successFilter = { ...orderFilter, ...(params.status ? {} : { paymentStatus: "paid" }) };

    const [client, user, order, successStats, statusBreakdown, paymentMethodBreakdown, clientBreakdown] =
        await Promise.all([
            Client.countDocuments(),
            User.countDocuments(),
            Order.countDocuments(orderFilter),
            Order.aggregate([
                { $match: successFilter },
                {
                    $group: {
                        _id: null,
                        totalAmountSuccess: { $sum: "$totalAmount" },
                        totalRealAmountSuccess: { $sum: realAmountExpression() },
                        totalTransactionSuccess: { $sum: 1 },
                        minDate: { $min: "$updatedAt" },
                        maxDate: { $max: "$updatedAt" },
                    },
                },
            ]),
            // Status breakdown
            Order.aggregate([
                { $match: { ...orderFilter, paymentStatus: { $exists: true } } },
                {
                    $group: {
                        _id: "$paymentStatus",
                        count: { $sum: 1 },
                        amount: { $sum: "$totalAmount" },
                    },
                },
            ]),
            // Payment method breakdown
            Order.aggregate([
                { $match: orderFilter },
                {
                    $group: {
                        _id: "$paymentType",
                        count: { $sum: 1 },
                        amount: { $sum: "$totalAmount" },
                    },
                },
                { $sort: { amount: -1 } },
            ]),
            // Client breakdown (top clients)
            Order.aggregate([
                { $match: { ...orderFilter, paymentStatus: "paid" } },
                {
                    $group: {
                        _id: "$clientId",
                        count: { $sum: 1 },
                        amount: { $sum: "$totalAmount" },
                    },
                },
                { $sort: { amount: -1 } },
                { $limit: 10 },
            ]),
        ]);

    const summary = successStats[0] ?? { totalAmountSuccess: 0, totalRealAmountSuccess: 0, totalTransactionSuccess: 0 };

    // Build status map
    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const s of VALID_STATUSES) {
        byStatus[s] = { count: 0, amount: 0 };
    }
    for (const item of statusBreakdown) {
        if (item._id && byStatus[item._id]) {
            byStatus[item._id] = { count: item.count, amount: item.amount };
        }
    }

    // Build chart data using the same clientId filter
    const isAllTime = dateFilter.periodLabel === "all_time";
    const chartParams: BuildChartParams = {
        period: params.chartPeriod || "monthly",
        date: params.chartDate,
        month: params.chartMonth,
        year: params.chartYear,
        status: params.status,
        overrideStart:
            isAllTime && summary.minDate ? summary.minDate : (dateFilter.updatedAt?.$gte as Date | undefined),
        overrideEnd:
            isAllTime && summary.maxDate
                ? new Date(summary.maxDate.getTime() + 86400000) // add 1 day because overrideEnd is exclusive
                : (dateFilter.updatedAt?.$lt as Date | undefined),
        extraMatch: params.clientId ? { clientId: params.clientId } : {},
        filterMeta: params.clientId ? { clientId: params.clientId } : {},
    };

    const chart =
        params.groupBy === "client" ? await buildChartSeriesByClient(chartParams) : await buildChartSeries(chartParams);

    return {
        success: true,
        period: dateFilter.periodLabel,
        filters: {
            ...(params.clientId ? { clientId: params.clientId } : {}),
            ...(params.status ? { status: params.status } : {}),
            ...(params.startDate ? { startDate: params.startDate } : {}),
            ...(params.endDate ? { endDate: params.endDate } : {}),
        },
        client,
        user,
        order,
        totalAmountSuccess: summary.totalAmountSuccess,
        totalRealAmountSuccess: summary.totalRealAmountSuccess,
        totalTransactionSuccess: summary.totalTransactionSuccess,
        byStatus,
        byPaymentMethod: paymentMethodBreakdown.map((item: Record<string, unknown>) => ({
            method: item._id ?? "unknown",
            count: item.count,
            amount: item.amount,
        })),
        byClient: clientBreakdown.map((item: Record<string, unknown>) => ({
            clientId: item._id ?? "unknown",
            count: item.count,
            amount: item.amount,
        })),
        chart,
    };
};

const isValidIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const WIB_TIMEZONE = "Asia/Jakarta";

const pad2 = (value: number): string => String(value).padStart(2, "0");

const pickFirstNonEmpty = (candidates: string[]) => ({
    $let: {
        vars: {
            matches: {
                $filter: {
                    input: candidates,
                    as: "value",
                    cond: {
                        $and: [{ $ne: ["$$value", null] }, { $ne: ["$$value", ""] }],
                    },
                },
            },
        },
        in: { $arrayElemAt: ["$$matches", 0] },
    },
});

const toNumberOrZero = (valueExpression: unknown) => ({
    $cond: {
        if: {
            $or: [{ $eq: [valueExpression, null] }, { $eq: [valueExpression, ""] }],
        },
        then: 0,
        else: { $toDouble: valueExpression },
    },
});

const totalTransFeeExpression = () =>
    toNumberOrZero(
        pickFirstNonEmpty([
            "$paymentPaylabs.totalTransFee",
            "$paymentPaylabsVaSnap.additionalInfo.totalTransFee",
            "$qris.totalTransFee",
            "$va.totalTransFee",
            "$cc.totalTransFee",
            "$eMoney.totalTransFee",
        ]),
    );

const vatFeeExpression = () =>
    toNumberOrZero(
        pickFirstNonEmpty([
            "$paymentPaylabs.vatFee",
            "$paymentPaylabsVaSnap.additionalInfo.vatFee",
            "$qris.vatFee",
            "$va.vatFee",
            "$cc.vatFee",
            "$eMoney.vatFee",
        ]),
    );

const realAmountExpression = () => ({
    $subtract: [{ $subtract: ["$totalAmount", totalTransFeeExpression()] }, vatFeeExpression()],
});

interface WibDateParts {
    year: number;
    month: number;
    day: number;
}

const toWibDateParts = (date: Date): WibDateParts => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: WIB_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    return {
        year: Number(parts.find((part) => part.type === "year")?.value),
        month: Number(parts.find((part) => part.type === "month")?.value),
        day: Number(parts.find((part) => part.type === "day")?.value),
    };
};

const wibDateToUtc = ({
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
}: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
}): Date => new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+07:00`);

const toWibDateLabel = (date: Date): string => {
    const { year, month, day } = toWibDateParts(date);
    return `${year}-${pad2(month)}-${pad2(day)}`;
};

const toWibMonthLabel = (date: Date): string => {
    const { year, month } = toWibDateParts(date);
    return `${year}-${pad2(month)}`;
};

interface ChartConfig {
    period: string;
    labels: string[];
    startDate: Date;
    endDateExclusive: Date;
    format: string;
    filters: Record<string, unknown>;
}

interface ChartQueryParams {
    period?: string;
    date?: string;
    month?: string | number;
    year?: string | number;
}

const buildChartConfig = ({ period, date, month, year }: ChartQueryParams): ChartConfig => {
    const now = new Date();
    const labels: string[] = [];

    if (period === "day") {
        const nowWib = toWibDateParts(now);
        const selectedDate = date || `${nowWib.year}-${pad2(nowWib.month)}-${pad2(nowWib.day)}`;
        if (!isValidIsoDate(selectedDate)) {
            throw new ResponseError(400, "Invalid date format. Use YYYY-MM-DD");
        }

        const [selectedYear, selectedMonth, selectedDay] = selectedDate.split("-").map(Number);
        const startDate = wibDateToUtc({ year: selectedYear, month: selectedMonth, day: selectedDay });
        if (Number.isNaN(startDate.getTime())) {
            throw new ResponseError(400, "Invalid date value");
        }

        const endDateExclusive = new Date(startDate);
        endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);

        for (let i = 0; i < 24; i += 1) {
            labels.push(`${pad2(i)}:00`);
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
        const currentWib = toWibDateParts(now);
        const monthNum = month ? Number(month) : currentWib.month;
        const yearNum = year ? Number(year) : currentWib.year;

        if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
            throw new ResponseError(400, "Invalid month. Use 1-12");
        }
        if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 9999) {
            throw new ResponseError(400, "Invalid year");
        }

        const startDate = wibDateToUtc({ year: yearNum, month: monthNum, day: 1 });
        const endDateExclusive =
            monthNum === 12
                ? wibDateToUtc({ year: yearNum + 1, month: 1, day: 1 })
                : wibDateToUtc({ year: yearNum, month: monthNum + 1, day: 1 });
        const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();

        for (let day = 1; day <= daysInMonth; day += 1) {
            labels.push(`${yearNum}-${pad2(monthNum)}-${pad2(day)}`);
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
        const currentWib = toWibDateParts(now);
        const yearNum = year ? Number(year) : currentWib.year;
        if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 9999) {
            throw new ResponseError(400, "Invalid year");
        }

        const startDate = wibDateToUtc({ year: yearNum, month: 1, day: 1 });
        const endDateExclusive = wibDateToUtc({ year: yearNum + 1, month: 1, day: 1 });

        for (let i = 1; i <= 12; i += 1) {
            labels.push(`${yearNum}-${pad2(i)}`);
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
        const currentWib = toWibDateParts(now);
        const currentMonthStart = wibDateToUtc({ year: currentWib.year, month: currentWib.month, day: 1 });
        const startDate = new Date(currentMonthStart);
        startDate.setUTCMonth(startDate.getUTCMonth() - 11);

        const cursor = new Date(startDate);
        for (let i = 0; i < 12; i += 1) {
            labels.push(toWibMonthLabel(cursor));
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

    const currentWib = toWibDateParts(now);
    const startDate = wibDateToUtc({ year: currentWib.year, month: currentWib.month, day: currentWib.day });
    startDate.setUTCDate(startDate.getUTCDate() - 29);

    const cursor = new Date(startDate);
    for (let i = 0; i < 30; i += 1) {
        labels.push(toWibDateLabel(cursor));
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

interface BuildChartParams extends ChartQueryParams {
    extraMatch?: Record<string, unknown>;
    filterMeta?: Record<string, unknown>;
    status?: string;
    // Override date range directly (bypasses buildChartConfig)
    overrideStart?: Date;
    overrideEnd?: Date;
}

/**
 * Build chart config (labels + date range) from a concrete start/end date pair.
 * Used when global dashboard period drives the chart range.
 */
const buildChartConfigFromRange = (start: Date, end: Date): ChartConfig => {
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const labels: string[] = [];
    const cursor = new Date(start);

    if (diffDays <= 31) {
        // Daily labels
        for (let i = 0; i < diffDays; i++) {
            labels.push(toWibDateLabel(cursor));
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        return {
            period: "custom_day",
            labels,
            startDate: start,
            endDateExclusive: end,
            format: "%Y-%m-%d",
            filters: {},
        };
    } else if (diffDays <= 366) {
        // Monthly labels
        while (cursor < end) {
            labels.push(toWibMonthLabel(cursor));
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        return {
            period: "custom_month",
            labels,
            startDate: start,
            endDateExclusive: end,
            format: "%Y-%m",
            filters: {},
        };
    } else {
        // Yearly labels
        while (cursor < end) {
            labels.push(String(toWibDateParts(cursor).year));
            cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
        }
        return { period: "custom_year", labels, startDate: start, endDateExclusive: end, format: "%Y", filters: {} };
    }
};

const buildChartSeries = async ({
    period,
    date,
    month,
    year,
    extraMatch = {},
    filterMeta = {},
    status,
    overrideStart,
    overrideEnd,
}: BuildChartParams) => {
    const config =
        overrideStart && overrideEnd
            ? buildChartConfigFromRange(overrideStart, overrideEnd)
            : buildChartConfig({ period, date, month, year });

    const statusFilter = status && VALID_STATUSES.includes(status) ? status : "paid";

    const aggregated = await Order.aggregate([
        {
            $match: {
                ...extraMatch,
                paymentStatus: statusFilter,
                updatedAt: { $gte: config.startDate, $lt: config.endDateExclusive },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: config.format,
                        date: "$updatedAt",
                        timezone: WIB_TIMEZONE,
                    },
                },
                totalAmountSuccess: { $sum: "$totalAmount" },
                totalRealAmountSuccess: { $sum: realAmountExpression() },
                totalTransactionSuccess: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const aggregatedMap = new Map(
        aggregated.map((item: Record<string, any>) => [
            item._id,
            {
                totalAmountSuccess: item.totalAmountSuccess ?? 0,
                totalRealAmountSuccess: item.totalRealAmountSuccess ?? 0,
                totalTransactionSuccess: item.totalTransactionSuccess ?? 0,
            },
        ]),
    );

    const amountData = config.labels.map((label) => aggregatedMap.get(label)?.totalAmountSuccess ?? 0);
    const realAmountData = config.labels.map((label) => aggregatedMap.get(label)?.totalRealAmountSuccess ?? 0);
    const transactionData = config.labels.map((label) => aggregatedMap.get(label)?.totalTransactionSuccess ?? 0);

    return {
        period: config.period,
        groupBy: "time",
        filters: { ...config.filters, ...filterMeta },
        labels: config.labels,
        series: [
            { name: "totalAmountSuccess", data: amountData },
            { name: "totalRealAmountSuccess", data: realAmountData },
            { name: "totalTransactionSuccess", data: transactionData },
        ],
    };
};

const buildChartSeriesByClient = async ({
    period,
    date,
    month,
    year,
    extraMatch = {},
    filterMeta = {},
    status,
    overrideStart,
    overrideEnd,
}: BuildChartParams) => {
    const config =
        overrideStart && overrideEnd
            ? buildChartConfigFromRange(overrideStart, overrideEnd)
            : buildChartConfig({ period, date, month, year });

    const statusFilter = status && VALID_STATUSES.includes(status) ? status : "paid";

    const aggregated = await Order.aggregate([
        {
            $match: {
                ...extraMatch,
                paymentStatus: statusFilter,
                updatedAt: { $gte: config.startDate, $lt: config.endDateExclusive },
            },
        },
        {
            $group: {
                _id: "$clientId",
                totalAmountSuccess: { $sum: "$totalAmount" },
                totalRealAmountSuccess: { $sum: realAmountExpression() },
                totalTransactionSuccess: { $sum: 1 },
            },
        },
        { $sort: { totalAmountSuccess: -1, _id: 1 } },
    ]);

    const data = aggregated.map((item: Record<string, any>) => ({
        clientId: item._id,
        totalAmountSuccess: item.totalAmountSuccess ?? 0,
        totalRealAmountSuccess: item.totalRealAmountSuccess ?? 0,
        totalTransactionSuccess: item.totalTransactionSuccess ?? 0,
    }));

    return {
        period: config.period,
        groupBy: "client",
        filters: { ...config.filters, ...filterMeta },
        data,
    };
};

interface ChartResult {
    period: string;
    groupBy: string;
    filters: Record<string, unknown>;
    labels?: string[];
    series?: Array<{ name: string; data: number[] }>;
    data?: Array<Record<string, unknown>>;
}

const removeRealAmountFromUserChart = (chart: ChartResult): ChartResult => {
    if (chart?.groupBy === "time" && Array.isArray(chart.series)) {
        return {
            ...chart,
            series: chart.series.filter((item) => item?.name !== "totalRealAmountSuccess"),
        };
    }

    if (chart?.groupBy === "client" && Array.isArray(chart.data)) {
        return {
            ...chart,
            data: chart.data.map(({ totalRealAmountSuccess, ...rest }) => rest),
        };
    }

    return chart;
};

interface DashboardChartParams extends ChartQueryParams {
    clientId?: string;
    groupBy?: string;
    status?: string;
}

export const dashboardChart = async ({
    period,
    date,
    month,
    year,
    clientId,
    groupBy = "time",
    status,
}: DashboardChartParams) => {
    const sanitizedClientId = typeof clientId === "string" ? clientId.trim() : "";
    const baseParams: BuildChartParams = {
        period,
        date,
        month,
        year,
        status,
        extraMatch: sanitizedClientId ? { clientId: sanitizedClientId } : {},
        filterMeta: sanitizedClientId ? { clientId: sanitizedClientId } : {},
    };

    if (groupBy === "client") {
        return buildChartSeriesByClient(baseParams);
    }

    return buildChartSeries(baseParams);
};

interface DashboardChartForUserParams extends DashboardChartParams {
    userId: string;
}

export const dashboardChartForUser = async ({
    userId,
    period,
    date,
    month,
    year,
    clientId,
    groupBy = "time",
    status,
}: DashboardChartForUserParams) => {
    const clients = await Client.find({ userIds: { $in: [userId] } }).select("+clientId");
    const clientIds = clients.map((item) => item.clientId).filter((id): id is string => !!id);
    const config = buildChartConfig({ period, date, month, year });
    const sanitizedClientId = typeof clientId === "string" ? clientId.trim() : "";

    if (sanitizedClientId && !clientIds.includes(sanitizedClientId)) {
        throw new ResponseError(403, "Access forbidden for requested clientId");
    }

    const selectedClientIds = sanitizedClientId ? [sanitizedClientId] : clientIds;

    if (!selectedClientIds.length) {
        if (groupBy === "client") {
            return removeRealAmountFromUserChart({
                period: config.period,
                groupBy,
                filters: sanitizedClientId ? { ...config.filters, clientId: sanitizedClientId } : config.filters,
                data: [],
            });
        }

        const emptyLabels = config.labels;
        return removeRealAmountFromUserChart({
            period: config.period,
            groupBy,
            filters: sanitizedClientId ? { ...config.filters, clientId: sanitizedClientId } : config.filters,
            labels: emptyLabels,
            series: [
                { name: "totalAmountSuccess", data: emptyLabels.map(() => 0) },
                { name: "totalRealAmountSuccess", data: emptyLabels.map(() => 0) },
                { name: "totalTransactionSuccess", data: emptyLabels.map(() => 0) },
            ],
        });
    }

    const baseParams: BuildChartParams = {
        period,
        date,
        month,
        year,
        status,
        extraMatch: { clientId: { $in: selectedClientIds } },
        filterMeta: sanitizedClientId ? { clientId: sanitizedClientId } : {},
    };

    if (groupBy === "client") {
        return removeRealAmountFromUserChart(await buildChartSeriesByClient(baseParams));
    }

    return removeRealAmountFromUserChart(await buildChartSeries(baseParams));
};

export const dashboardForUser = async ({ userId, ...params }: { userId: string } & DashboardParams) => {
    const clients = await Client.find({ userIds: { $in: [userId] } }).select("+clientId");
    const clientIds = clients.map((item) => item.clientId).filter((id): id is string => !!id);

    // Validate clientId belongs to this user
    if (params.clientId && !clientIds.includes(params.clientId)) {
        throw new ResponseError(403, "Access forbidden for requested clientId");
    }

    const selectedClientIds = params.clientId ? [params.clientId] : clientIds;

    if (!selectedClientIds.length) {
        // Build empty chart for users with no clients
        const emptyChartConfig = buildChartConfig({
            period: params.chartPeriod || "monthly",
            date: params.chartDate,
            month: params.chartMonth,
            year: params.chartYear,
        });
        const emptyChart = removeRealAmountFromUserChart({
            period: emptyChartConfig.period,
            groupBy: params.groupBy || "time",
            filters: {},
            labels: emptyChartConfig.labels,
            series: [
                { name: "totalAmountSuccess", data: emptyChartConfig.labels.map(() => 0) },
                { name: "totalRealAmountSuccess", data: emptyChartConfig.labels.map(() => 0) },
                { name: "totalTransactionSuccess", data: emptyChartConfig.labels.map(() => 0) },
            ],
        });

        return {
            success: true,
            period: "all_time",
            filters: {},
            client: 0,
            user: 1,
            order: 0,
            totalAmountSuccess: 0,
            totalTransactionSuccess: 0,
            byStatus: Object.fromEntries(VALID_STATUSES.map((s) => [s, { count: 0, amount: 0 }])),
            byPaymentMethod: [],
            chart: emptyChart,
        };
    }

    const dateFilter = buildDashboardDateFilter(params);
    const orderFilter: Record<string, unknown> = { clientId: { $in: selectedClientIds } };
    if (dateFilter.updatedAt) orderFilter.updatedAt = dateFilter.updatedAt;
    if (params.status && VALID_STATUSES.includes(params.status)) orderFilter.paymentStatus = params.status;

    const successFilter = { ...orderFilter, ...(params.status ? {} : { paymentStatus: "paid" }) };

    const [order, successStats, statusBreakdown, paymentMethodBreakdown] = await Promise.all([
        Order.countDocuments(orderFilter),
        Order.aggregate([
            { $match: successFilter },
            {
                $group: {
                    _id: null,
                    totalAmountSuccess: { $sum: "$totalAmount" },
                    totalTransactionSuccess: { $sum: 1 },
                    minDate: { $min: "$updatedAt" },
                    maxDate: { $max: "$updatedAt" },
                },
            },
        ]),
        Order.aggregate([
            { $match: { ...orderFilter, paymentStatus: { $exists: true } } },
            { $group: { _id: "$paymentStatus", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
        ]),
        Order.aggregate([
            { $match: orderFilter },
            { $group: { _id: "$paymentType", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
            { $sort: { amount: -1 } },
        ]),
    ]);

    const summary = successStats[0] ?? { totalAmountSuccess: 0, totalTransactionSuccess: 0 };

    const byStatus: Record<string, { count: number; amount: number }> = {};
    for (const s of VALID_STATUSES) byStatus[s] = { count: 0, amount: 0 };
    for (const item of statusBreakdown) {
        if (item._id && byStatus[item._id]) byStatus[item._id] = { count: item.count, amount: item.amount };
    }

    // Build chart for user (scoped by their clients, hide realAmount)
    const isAllTime = dateFilter.periodLabel === "all_time";
    const chartParams: BuildChartParams = {
        period: params.chartPeriod || "monthly",
        date: params.chartDate,
        month: params.chartMonth,
        year: params.chartYear,
        status: params.status,
        overrideStart:
            isAllTime && summary.minDate ? summary.minDate : (dateFilter.updatedAt?.$gte as Date | undefined),
        overrideEnd:
            isAllTime && summary.maxDate
                ? new Date(summary.maxDate.getTime() + 86400000) // add 1 day because overrideEnd is exclusive
                : (dateFilter.updatedAt?.$lt as Date | undefined),
        extraMatch: { clientId: { $in: selectedClientIds } },
        filterMeta: params.clientId ? { clientId: params.clientId } : {},
    };

    const rawChart =
        params.groupBy === "client" ? await buildChartSeriesByClient(chartParams) : await buildChartSeries(chartParams);

    const chart = removeRealAmountFromUserChart(rawChart);

    return {
        success: true,
        period: dateFilter.periodLabel,
        filters: {
            ...(params.clientId ? { clientId: params.clientId } : {}),
            ...(params.status ? { status: params.status } : {}),
        },
        client: clients.length,
        user: 1,
        order,
        totalAmountSuccess: summary.totalAmountSuccess,
        totalTransactionSuccess: summary.totalTransactionSuccess,
        byStatus,
        byPaymentMethod: paymentMethodBreakdown.map((item: Record<string, unknown>) => ({
            method: item._id ?? "unknown",
            count: item.count,
            amount: item.amount,
        })),
        chart,
    };
};
