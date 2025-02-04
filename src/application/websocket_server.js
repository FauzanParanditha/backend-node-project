import { WebSocket, WebSocketServer } from "ws";
import logger from "./logger.js";

const PORT = 5001;
const HEARTBEAT_INTERVAL = 30000;
const TIMEOUT = 35000; // Time after which a client is considered inactive

export const wss = new WebSocketServer({ port: PORT });

export const broadcastPaymentUpdate = (data) => {
    const message = JSON.stringify(data);
    logger.info(`Broadcasting payment update: ${message}`);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, (error) => {
                if (error) {
                    logger.error(`Error sending message: ${error.message}`);
                } else {
                    logger.info(`Message successfully sent to client`);
                }
            });
        }
    });
};

wss.on("connection", (ws) => {
    logger.info("New client connected");

    // Store last pong timestamp for heartbeat check
    ws.isAlive = true;

    // Heartbeat function to detect disconnected clients
    const heartbeat = () => {
        if (!ws.isAlive) {
            logger.warn("Client is unresponsive, terminating connection...");
            return ws.terminate();
        }
        ws.isAlive = false; // Mark as unresponsive until pong is received
        ws.ping(); // Send a ping to check if client is still active
    };

    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    ws.on("pong", () => {
        ws.isAlive = true;
        logger.info("Received pong from client");
    });

    ws.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            logger.info(`Received message from client: ${message}`);

            // Example: handle messages based on type
            if (parsedMessage.type === "ping") {
                ws.send(JSON.stringify({ type: "pong" }));
            } else {
                ws.send(`Server received: ${parsedMessage}`);
            }
        } catch (error) {
            logger.error(`Error processing message: ${error.message}`);
            ws.send(JSON.stringify({ error: "Invalid message format" }));
        }
    });

    ws.on("close", () => {
        logger.info("Client disconnected");
        clearInterval(interval); // Ensure heartbeat interval is cleared
    });

    ws.on("error", (error) => {
        logger.error(`WebSocket error: ${error.message}`);
    });
});

wss.on("error", (error) => {
    logger.error(`WebSocket server error: ${error.message}`);
});

logger.info(`WebSocket server is running on port ${PORT}`);
