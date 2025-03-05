import winston from "winston";

const logger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level.toUpperCase()}: ${message}`;
        }),
    ),
    transports: [
        // new winston.transports.Console(),
        new winston.transports.File({
            filename: "./src/logs/error.log",
            level: "error",
        }),
        new winston.transports.File({ filename: "./src/logs/combined.log" }),
    ],
});

// Only log to console in development mode
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    );
}

export default logger;

export async function flushLogsAndExit(exitCode) {
    logger.info(`Flushing logs and exiting with code ${exitCode}...`);
    logger.end(); // Ensure logger is closed.

    // Add delay to ensure the logs are flushed properly
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Ensure process exits after logs are flushed
    process.exit(exitCode);
}
