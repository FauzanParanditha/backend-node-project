import amqplib from "amqplib";
import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
import { callbackPaylabs } from "../service/paymentService.js";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost"; // Gunakan env variable
const QUEUE_NAME = "payment_events";
const MAX_RETRY = 5;

const consumeQueue = async () => {
    let connection;
    let channel;

    try {
        connection = await amqplib.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        logger.info(`✅ Worker siap mendengarkan event dari RabbitMQ di queue: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                let payload;
                try {
                    payload = JSON.parse(msg.content.toString());
                    logger.info("📥 Menerima event pembayaran:", payload);

                    if (!payload || !payload.merchantTradeNo) {
                        logger.error("❌ Payload tidak valid, pesan akan dihapus");
                        return channel.ack(msg);
                    }
                    await callbackPaylabs(payload);
                    logger.info(`✅ Berhasil memproses event ${payload.merchantTradeNo}`);

                    // // 🔄 Kirim pesan ke queue forward_events setelah callbackPaylabs sukses
                    // await publishToQueue("forward_events", payload);
                    // logger.info(`📡 Forward event dikirim untuk ${payload.merchantTradeNo}`);

                    channel.ack(msg); // Hapus pesan setelah sukses diproses
                } catch (error) {
                    let headers = msg.properties.headers || {};
                    let retryCount = headers["x-retry-count"] || 0;

                    if (retryCount >= MAX_RETRY) {
                        logger.error(
                            `❌ Event ${payload?.merchantTradeNo} gagal setelah ${MAX_RETRY} kali retry. Pesan dihapus.`,
                        );
                        return channel.ack(msg); // Hapus pesan setelah gagal beberapa kali
                    }

                    logger.warn(`⚠️ Gagal memproses event ${payload?.merchantTradeNo}, retry ke-${retryCount + 1}`);

                    channel.nack(msg, false, true); // Requeue pesan

                    // Tambahkan header retry count
                    headers["x-retry-count"] = retryCount + 1;
                }
            }
        });
    } catch (error) {
        logger.error("❌ Gagal terhubung ke RabbitMQ:", error);
        process.exit(1); // Keluar agar bisa restart ulang
    }

    // Tangani saat proses dihentikan
    process.on("SIGINT", async () => {
        logger.info("\n🛑 Menutup koneksi RabbitMQ...");
        await channel.close();
        await connection.close();
        process.exit(0);
    });
};

await connectDB();
// Jalankan worker
consumeQueue();
