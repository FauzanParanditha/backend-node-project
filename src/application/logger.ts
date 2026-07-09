import fs from "fs";
import path from "path";
import winston from "winston";

// Log directory. In k8s this is pointed at an NFS-backed PVC (LOG_DIR=/app/logs)
// so logs survive pod restarts / rollouts to a new image tag. Defaults to the
// repo-local path for development.
const LOG_DIR = process.env.LOG_DIR || "./src/logs";

// Per-pod filename suffix. Multiple replicas mounting the SAME NFS directory
// must not write to the same file (interleaved/corrupt lines), so each pod gets
// its own file keyed by its hostname (k8s sets HOSTNAME = pod name).
const POD_ID = process.env.HOSTNAME || "local";

// Ensure the directory exists (winston's File transport does not create nested
// dirs reliably; the runner image only ships dist/, so ./src/logs may be
// absent). On an NFS mount this is a no-op since the mount point already exists.
try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
    // Non-fatal: fall through; the File transport will surface any real error.
}

const logger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level.toUpperCase()}: ${message}`;
        }),
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(LOG_DIR, `error-${POD_ID}.log`),
            level: "error",
        }),
        new winston.transports.File({ filename: path.join(LOG_DIR, `combined-${POD_ID}.log`) }),
    ],
});

// Log to stdout in every environment. DevOps captures the container's stdout
// and persists it to an NFS-backed file, so production MUST emit to stdout too
// (previously stdout was dev-only, which meant prod stdout was empty and any
// stdout-capture pipeline caught nothing). The File transports above remain as
// a direct-to-disk option when LOG_DIR is pointed at a mount.
logger.add(
    new winston.transports.Console({
        format: winston.format.simple(),
    }),
);

export default logger;

export async function flushLogsAndExit(exitCode: number): Promise<void> {
    logger.info(`Flushing logs and exiting with code ${exitCode}...`);
    logger.end(); // Ensure logger is closed.

    // Add delay to ensure the logs are flushed properly
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    // Ensure process exits after logs are flushed
    process.exit(exitCode);
}
