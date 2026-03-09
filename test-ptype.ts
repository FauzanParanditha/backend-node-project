import mongoose from "mongoose";
import Order from "./src/models/orderModel";
import * as dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
    const orders = await Order.aggregate([
        { $group: { _id: { method: "$paymentMethod", type: "$paymentType" }, count: { $sum: 1 } } }
    ]);
    console.log("Payment methods and types:");
    console.log(orders);
    process.exit(0);
});
