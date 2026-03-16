import mongoose from "mongoose";
import Order from "./src/models/orderModel";
import * as dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
    // 1. Cari berdasarkan tgl string di screenshot tanggal 28-08-2025
    const orders = await Order.find({
        orderId: { $regex: "2025" }
    }).select("orderId clientId totalAmount paymentStatus createdAt updatedAt").limit(10);
    
    console.log("Samples by orderId regex 2025:");
    console.log(orders.map(o => ({
        id: o.orderId,
        cAt: o.createdAt,
        uAt: o.updatedAt,
        status: o.paymentStatus
    })));

    process.exit(0);
});
