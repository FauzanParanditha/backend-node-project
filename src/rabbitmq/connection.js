import amqplib from "amqplib";
import logger from "../application/logger.js";

const RABBITMQ_URL = "amqp://localhost";
let connection;
let channel;
let reconnectTimeout = 5000;

const connectRabbitMQ = async () => {
    try {
        logger.info("🔗 Mencoba terhubung ke RabbitMQ...");
        connection = await amqplib.connect(RABBITMQ_URL);

        connection.on("error", async (err) => {
            logger.error(`❌ Koneksi RabbitMQ error: ${err.message}`);
            await reconnectRabbitMQ();
        });

        connection.on("close", async () => {
            logger.warn("⚠️ Koneksi RabbitMQ tertutup. Mencoba reconnect...");
            await reconnectRabbitMQ();
        });

        channel = await connection.createChannel();
        await channel.assertQueue("callback-retry-queue", { durable: true });

        logger.info("✅ Berhasil terhubung ke RabbitMQ");
    } catch (error) {
        logger.error(`❌ Gagal terhubung ke RabbitMQ: ${error.message}`);
        setTimeout(connectRabbitMQ, reconnectTimeout);
        reconnectTimeout *= 2; // Exponential backoff
    }
};

const reconnectRabbitMQ = async () => {
    if (connection) {
        try {
            await connection.close();
        } catch (err) {
            logger.warn(`⚠️ Gagal menutup koneksi RabbitMQ: ${err.message}`);
        }
    }
    channel = null;
    connection = null;
    setTimeout(connectRabbitMQ, reconnectTimeout);
};

export const getRabbitMQChannel = async () => {
    if (!channel) await connectRabbitMQ();
    return channel;
};

// Menutup koneksi dengan benar saat aplikasi berhenti
process.on("SIGINT", async () => {
    logger.info("🛑 Menutup koneksi RabbitMQ...");
    if (channel) await channel.close();
    if (connection) await connection.close();
    process.exit(0);
});

export default connectRabbitMQ;
