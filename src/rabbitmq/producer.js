import logger from "../application/logger.js";
import { getRabbitMQChannel } from "./connection.js";

export const publishToQueue = async (queue, message, retries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const channel = await getRabbitMQChannel();
            await channel.assertQueue(queue, { durable: true, deadLetterExchange: "dlx" });

            channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
                persistent: true, // Pesan tidak hilang jika RabbitMQ restart
            });

            logger.info(`📨 Pesan terkirim ke queue: ${queue}, attempt ${attempt}`);
            return;
        } catch (error) {
            logger.error(`❌ Gagal mengirim pesan ke RabbitMQ (attempt ${attempt}): ${error.message}`);

            if (attempt < retries) {
                logger.warn(`🔄 Retrying dalam ${delay}ms...`);
                await new Promise((res) => setTimeout(res, delay));
                delay *= 2; // Exponential backoff
            } else {
                logger.error("🚨 Semua percobaan gagal, mengirim pesan ke DLQ.");
                await sendToDLQ(queue, message); // Kirim ke DLQ jika semua retry gagal
            }
        }
    }
};

// Fungsi untuk mengirim pesan yang gagal ke DLQ
const sendToDLQ = async (queue, message) => {
    try {
        const dlqQueue = `${queue}-dlq`;
        const channel = await getRabbitMQChannel();
        await channel.assertQueue(dlqQueue, { durable: true });

        channel.sendToQueue(dlqQueue, Buffer.from(JSON.stringify(message)), { persistent: true });
        logger.warn(`⚠️ Pesan gagal dikirim masuk ke DLQ: ${dlqQueue}`);
    } catch (error) {
        logger.error(`❌ Gagal mengirim pesan ke DLQ: ${error.message}`);
    }
};
