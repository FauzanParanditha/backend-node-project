import logger from "../application/logger.js";
import { wss } from "../application/websocket_server.js";
import { getRabbitMQChannel } from "./connection.js";

const QUEUE_NAME = "ws_broadcast_queue";

export const listenForWebSocketMessages = async () => {
    try {
        const channel = await getRabbitMQChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const message = JSON.parse(msg.content.toString());
                logger.info(`📥 Menerima pesan untuk broadcast: ${JSON.stringify(message)}`);

                let clientCount = 0;

                // Kirim pesan ke semua WebSocket client
                wss.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify(message));
                        clientCount++;
                    }
                });

                logger.info(`📡 Broadcast dikirim ke ${clientCount} client`);
                channel.ack(msg);
            }
        });

        logger.info(`✅ WebSocket Server mendengarkan RabbitMQ di queue: ${QUEUE_NAME}`);
    } catch (error) {
        logger.error(`❌ Gagal mendengarkan WebSocket Queue: ${error.message}`);
    }
};
