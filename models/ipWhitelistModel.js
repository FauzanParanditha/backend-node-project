import mongoose from "mongoose";

const ipWhitelistSchema = new mongoose.Schema(
  {
    ipAddress: {
      type: String,
      required: true,
      unique: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const IPWhitelist = mongoose.model("IPWhitelist", ipWhitelistSchema);
export default IPWhitelist;
