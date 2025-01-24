import { WebSocket, WebSocketServer } from "ws";
import logger from "./logger.js";
const PORT = 5001;

// Create a new WebSocket server
const wss = new WebSocketServer({ port: PORT });

export const broadcastPaymentUpdate = (data) => {
    const message = JSON.stringify(data);
    logger.info(`Broadcasting payment update: ${message}`); // Log the message being sent

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, (error) => {
                if (error) {
                    logger.error(`Error sending message to client: ${error.message}`); // Log any errors
                } else {
                    logger.info(`Message sent to client: ${message}`); // Log successful message sending
                }
            });
        }
    });
};

// Handle connection events
wss.on("connection", (ws) => {
    logger.info("New client connected");

    // Handle messages from clients
    ws.on("message", (message) => {
        logger.info(`Received: ${message}`);
        // Echo the message back to the client
        ws.send(`Server received: ${message}`);
    });

    // Handle client disconnection
    ws.on("close", () => {
        logger.info("Client disconnected");
    });
});

logger.info(`WebSocket server is running on ws://localhost:${PORT}`);
