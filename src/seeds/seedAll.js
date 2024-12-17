import { exec } from "child_process";
import logger from "../application/logger.js";

exec("node src/seeds/seedAdmins.js", (err, stdout, stderr) => {
    if (err) {
        logger.error("Error seeding admins:", stderr);
        return;
    }
    logger.info(stdout);

    exec("node src/seeds/seedAvailablePayments.js", (err, stdout, stderr) => {
        if (err) {
            logger.error("Error seeding available payments:", stderr);
            return;
        }
        logger.info(stdout);
    });
    exec("node src/seeds/seedClient.js", (err, stdout, stderr) => {
        if (err) {
            logger.error("Error seeding client:", stderr);
            return;
        }
        logger.info(stdout);
    });
    exec("node src/seeds/seedIpWhitelist.js", (err, stdout, stderr) => {
        if (err) {
            logger.error("Error seeding ip whitelist:", stderr);
            return;
        }
        logger.info(stdout);
    });
});
