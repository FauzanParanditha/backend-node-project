import logger from "./application/logger.js";
import { web } from "./application/web.js";
import { connectDB } from "./application/db.js";
import mongoose from "mongoose";
import { retryFailedCallbacks } from "./service/forwadCallback.js";

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
}

export function decrementActiveTask() {
    activeTask--;
}

function handleShutdownGracefully(signal) {
    return () => {
        serverIsClosing = true;
        logger.info(`Received ${signal} signal. Starting graceful shutdown... New requests will be denied.`);

        const shutdownInterval = setInterval(() => {
            if (activeTask === 0) {
                clearInterval(shutdownInterval);
                logger.info("All active tasks completed. Shutting down gracefully.");

                // Stop accepting new connections and complete ongoing requests
                server.close(async () => {
                    logger.info("HTTP server closed gracefully.");

                    try {
                        // Close the database connection gracefully
                        await mongoose.connection.close(false);
                        logger.info("MongoDB connection closed.");
                        process.exit(0); // Exit cleanly after everything is closed
                    } catch (err) {
                        logger.error("Error closing MongoDB connection", err);
                        process.exit(1); // Exit with failure if an error occurs
                    }
                });
            } else {
                logger.info(`Waiting for ${activeTask} active tasks to complete...`);
            }
        }, 1000);

        // Timeout as a backup to force exit if graceful shutdown takes too long
        setTimeout(() => {
            logger.error("Forced shutdown due to timeout.");
            process.exit(1); // Exit with failure if cleanup takes too long
        }, 10000); // 10 seconds to allow ongoing connections to complete
    };
}

// Add graceful shutdown signals
process.on("SIGINT", handleShutdownGracefully("SIGINT"));
process.on("SIGTERM", handleShutdownGracefully("SIGTERM"));
process.on("SIGHUP", handleShutdownGracefully("SIGHUP"));
process.on("SIGQUIT", handleShutdownGracefully("SIGQUIT"));
