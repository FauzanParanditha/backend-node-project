import mongoose from "mongoose";
import { connectDB } from "./application/db.js";
import logger, { flushLogsAndExit } from "./application/logger.js";
import { web } from "./application/web.js";

export let serverIsClosing = false;
export let activeTask = 0;

web.use((req, res, next) => {
    if (serverIsClosing) {
        res.status(503).json({
            errors: true,
            message: "Server is shutting down, no new requests accepted.",
        });
    } else {
        next();
    }
});

const server = web.listen(process.env.PORT, async () => {
    connectDB();
    logger.info(`App running on port: ${process.env.PORT}`);
    logger.info(`Running in ${process.env.NODE_ENV} mode`);

    // Retry failed callbacks on startup
    // await retryFailedCallbacks();
});

export function incrementActiveTask() {
    activeTask++;
    logger.debug(`Active task increment. Current count: ${activeTask}`);
}

export function decrementActiveTask() {
    activeTask--;
    logger.debug(`Active task decremented. Current count: ${activeTask}`);
}

function handleShutdownGracefully(signal) {
    return async () => {
        serverIsClosing = true;
        logger.info(`Received ${signal} signal. Starting graceful shutdown... New requests will be denied.`);

        logger.debug("Entering shutdown process...");
        const shutdownInterval = setInterval(async () => {
            logger.debug(`Active tasks count: ${activeTask}`);

            if (activeTask === 0) {
                clearInterval(shutdownInterval); // Stop the interval once all tasks are done
                logger.info("All active tasks completed. Proceeding with shutdown...");

                try {
                    // Wait for the server to close
                    await new Promise((resolve, reject) =>
                        server.close((err) => {
                            if (err) {
                                logger.error("Error closing HTTP server:", err);
                                return reject(err);
                            }
                            resolve();
                        }),
                    );
                    logger.info("HTTP server closed successfully.");

                    // Close MongoDB connection
                    await mongoose.connection.close(false);
                    logger.info("MongoDB connection closed successfully.");

                    // Final log and exit
                    await flushLogsAndExit(0); // Exit with success
                } catch (err) {
                    logger.error("Error during shutdown:", err);
                    await flushLogsAndExit(1); // Exit with error code
                }
            } else {
                logger.info(`Waiting for ${activeTask} active tasks to complete...`);
            }
        }, 1000);

        // Force shutdown if not completed in 30 seconds
        setTimeout(async () => {
            if (activeTask > 0) {
                logger.error("Forced shutdown due to timeout.");
                clearInterval(shutdownInterval); // Clear the interval to stop waiting
                await flushLogsAndExit(1); // Force exit after timeout
            }
        }, 30000); // Timeout after 30 seconds
    };
}

// Add graceful shutdown signals
process.on("SIGINT", handleShutdownGracefully("SIGINT"));
process.on("SIGTERM", handleShutdownGracefully("SIGTERM"));
process.on("SIGHUP", handleShutdownGracefully("SIGHUP"));
process.on("SIGQUIT", handleShutdownGracefully("SIGQUIT"));
