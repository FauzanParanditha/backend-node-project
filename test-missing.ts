import mongoose from "mongoose";
import Order from "./src/models/orderModel";
import * as dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
    const ordersMiss = await Order.find({ paymentStatus: "paid", updatedAt: { $exists: false } }).select("orderId paymentStatus createdAt updatedAt");
    console.log("Missing updatedAt count:", ordersMiss.length);
    
    // Check if any have updatedAt dates weirdly out of bounds
    // Like null, or way in the past or future?
    
    // Get the minDate and maxDate 
    const agg = await Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, min: { $min: "$updatedAt" }, max: { $max: "$updatedAt" } } }
    ]);
    console.log("Agg min/max:", agg);

    process.exit(0);
});
