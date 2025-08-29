import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import { convertToDate } from "../service/paylabs.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "1000", 10);

// resume pointer lewat env (opsional): MIGRATE_FROM_ID=66d...
const START_AFTER_ID = process.env.MIGRATE_FROM_ID || null;

// DRY RUN tak menulis DB: DRY_RUN=true
const DRY_RUN = /^true$/i.test(process.env.DRY_RUN || "false");

// hanya proses dokumen yang belum punya paymentExpiredAt
const baseFilter = {
    paymentExpired: { $exists: true, $ne: null },
    $or: [{ paymentExpiredAt: { $exists: false } }, { paymentExpiredAt: null }],
};

// jika mau resume setelah _id tertentu
if (START_AFTER_ID) {
    baseFilter._id = { $gt: new mongoose.Types.ObjectId(START_AFTER_ID) };
}

async function main() {
    await mongoose.connect(MONGO_URI, { autoIndex: false }); // index biar tidak re-build

    console.log("[MIGRATE] start", {
        DRY_RUN,
        BATCH_SIZE,
        START_AFTER_ID,
    });

    let processed = 0,
        updated = 0,
        skipped = 0;
    let lastId = START_AFTER_ID ? new mongoose.Types.ObjectId(START_AFTER_ID) : null;

    while (true) {
        const filter = lastId ? { ...baseFilter, _id: { $gt: lastId } } : baseFilter;

        const docs = await Order.find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).lean();

        if (!docs.length) break;

        const bulk = [];
        for (const doc of docs) {
            processed++;
            lastId = doc._id;

            const dt = convertToDate(doc.paymentExpired);
            if (!dt) {
                skipped++;
                continue;
            }

            // hanya update jika value berbeda/absen
            if (!doc.paymentExpiredAt || new Date(doc.paymentExpiredAt).getTime() !== dt.getTime()) {
                if (!DRY_RUN) {
                    bulk.push({
                        updateOne: {
                            filter: { _id: doc._id },
                            update: { $set: { paymentExpiredAt: dt } },
                        },
                    });
                }
                updated++;
            }
        }

        if (bulk.length && !DRY_RUN) {
            await Order.bulkWrite(bulk, { ordered: false });
        }

        console.log(`[MIGRATE] processed=${processed} updated=${updated} skipped=${skipped} lastId=${lastId}`);
    }

    console.log("[MIGRATE] done.", { processed, updated, skipped, lastId });
    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error("[MIGRATE] error:", e);
    try {
        await mongoose.disconnect();
    } catch {}
    process.exit(1);
});
