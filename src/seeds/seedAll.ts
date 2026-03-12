import { exec } from "child_process";
import logger from "../application/logger.js";

// Seed roles first — they are referenced by admins and other seeds
exec("node dist/seeds/seedRoles.js", (err, stdout, stderr) => {
    if (err) {
        logger.error("Error seeding roles:", stderr);
        return;
    }
    logger.info(stdout);

    // Then seed admins (depends on roles)
    exec("node dist/seeds/seedAdmins.js", (err, stdout, stderr) => {
        if (err) {
            logger.error("Error seeding admins:", stderr);
            return;
        }
        logger.info(stdout);

        exec("node dist/seeds/seedAvailablePayments.js", (err, stdout, stderr) => {
            if (err) {
                logger.error("Error seeding available payments:", stderr);
                return;
            }
            logger.info(stdout);
        });
        exec("node dist/seeds/seedClient.js", (err, stdout, stderr) => {
            if (err) {
                logger.error("Error seeding client:", stderr);
                return;
            }
            logger.info(stdout);
        });
        exec("node dist/seeds/seedIpWhitelist.js", (err, stdout, stderr) => {
            if (err) {
                logger.error("Error seeding ip whitelist:", stderr);
                return;
            }
            logger.info(stdout);
        });
    });
});
