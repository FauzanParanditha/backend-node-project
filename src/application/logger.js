import winston from "winston";

const logger = winston.createLogger({
    level: "info",
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
