import dayjs from "dayjs";
import cron from "node-cron";
import logger from "../application/logger.js";
import Order from "../models/orderModel.js";
import { sendDailySummaryReport } from "../service/discordService.js";

// Task to run every day at 07:00 AM
export const initDailyCronReport = () => {
    cron.schedule("0 7 * * *", async () => {
        try {
            logger.info("Starting Daily Cron Revenue Report...");

            // Get yesterday's date range
            const yesterdayStart = dayjs().subtract(1, "day").startOf("day").toDate();
            const yesterdayEnd = dayjs().subtract(1, "day").endOf("day").toDate();
            const formattedDate = dayjs().subtract(1, "day").format("DD MMMM YYYY");

            // Aggregation pipeline to get Success Volume and Counts
            const results = await Order.aggregate([
                {
                    $match: {
                        createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
                    },
                },
                {
                    $group: {
                        _id: "$paymentStatus",
                        count: { $sum: 1 },
                        totalVolume: { $sum: "$totalAmount" },
                    },
                },
            ]);

            // Calculate metrics
            let successCount = 0;
            let successVolume = 0;
            let expiredCount = 0;

            results.forEach((group) => {
                const status = group._id?.toLowerCase();
                if (status === "paid" || status === "settled") {
                    successCount += group.count;
                    successVolume += group.totalVolume;
                } else if (status === "expired" || status === "failed" || status === "cancelled") {
                    expiredCount += group.count;
                }
            });

            // Fire Discord Webhook
            await sendDailySummaryReport(formattedDate, successCount, successVolume, expiredCount);

            logger.info(`Daily Cron Report sent successfully for ${formattedDate}`);
        } catch (error) {
            logger.error(`Error executing daily cron report: ${(error as Error).message}`);
        }
    });
};
