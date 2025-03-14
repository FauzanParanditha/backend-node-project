import logger from "../application/logger.js";
import { getRabbitMQChannel } from "./connection.js";

const QUEUE_NAME = "ws_broadcast_queue";

export const sendWebSocketMessage = async (message) => {
    try {
        const channel = await getRabbitMQChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
            persistent: true,
        });

        logger.info(`📡 Worker mengirim pesan ke WebSocket melalui RabbitMQ: ${JSON.stringify(message)}`);
    } catch (error) {
        logger.error(`❌ Gagal mengirim pesan ke WebSocket Queue: ${error.message}`);
    }
};
