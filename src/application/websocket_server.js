import { WebSocket, WebSocketServer } from "ws";
import logger from "./logger.js";

const PORT = 5001;
const HEARTBEAT_INTERVAL = 30000;
const TIMEOUT = 35000; // Time after which a client is considered inactive
let wssInstance = null;

if (!process.env.WORKER_MODE) {
    wssInstance = new WebSocketServer({ port: PORT });

    wssInstance.on("connection", (ws) => {
        logger.info("New client connected");

        ws.isAlive = true;
        const heartbeat = () => {
            if (!ws.isAlive) {
                logger.warn("Client unresponsive, closing...");
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        };

        const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

        ws.on("pong", () => {
            ws.isAlive = true;
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
            clearInterval(interval);
            logger.info("Client disconnected");
        });

        ws.on("error", (error) => {
            logger.error(`WebSocket error: ${error.message}`);
        });
    });

    wssInstance.on("error", (error) => {
        logger.error(`WebSocket server error: ${error.message}`);
    });

    logger.info(`✅ WebSocket server running on port ${PORT}`);
}

export const wss = wssInstance;
export const getWebSocketServer = () => wssInstance;

export const broadcastPaymentUpdate = (data) => {
    const message = JSON.stringify(data);
    logger.info(`Broadcasting payment update: ${message}`);

    wssInstance.clients.forEach((client) => {
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
