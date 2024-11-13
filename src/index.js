import logger from "./application/logger.js";
import { web } from "./application/web.js";
import { connectDB } from "./application/db.js";

web.listen(process.env.PORT, () => {
  connectDB();
  logger.info(`App running on port: ${process.env.PORT}`);
});
