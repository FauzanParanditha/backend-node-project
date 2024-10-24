import mongoose from "mongoose";

const apiLogSchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    endpoint: { type: String, required: true },
    headers: { type: Object, required: true },
    body: { type: Object },
    ipAddress: { type: String, required: true },
  },
  { timestamps: true }
);

const ApiLog = mongoose.model("ApiLog", apiLogSchema);

export default ApiLog;
