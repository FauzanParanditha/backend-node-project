import amqplib from "amqplib";
import dotenv from "dotenv";
import logger from "../application/logger.js";

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
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
        await channel.assertExchange("dlx", "direct", { durable: true });
        await channel.assertQueue("callback-retry-queue", {
            durable: true,
            deadLetterExchange: "dlx",
        });
        await channel.assertQueue("callback-retry-queue-dlq", { durable: true });
        await channel.bindQueue("callback-retry-queue-dlq", "dlx", "callback-retry-queue");

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
