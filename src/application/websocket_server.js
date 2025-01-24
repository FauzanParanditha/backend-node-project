import { WebSocket, WebSocketServer } from "ws";
import logger from "./logger.js";
const PORT = 5001;

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
                    logger.info(`Message successfully sent: ${message}`);
                }
            });
        }
    });
};

wss.on("connection", (ws) => {
    logger.info("New client connected");

    ws.on("message", (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            logger.info(`Received: ${message}`);
            // Add logic based on parsedMessage.type
            ws.send(`Server received: ${parsedMessage}`);
        } catch (error) {
            logger.error(`Error processing message: ${error.message}`);
            ws.send(JSON.stringify({ error: "Invalid message format" }));
        }
    });

    ws.on("close", () => {
        logger.info("Client disconnected");
    });
});

wss.on("error", (error) => {
    logger.error(`WebSocket server error: ${error.message}`);
});

logger.info(`WebSocket server is running on ${PORT}`);
