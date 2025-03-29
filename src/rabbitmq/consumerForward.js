import { connectDB } from "../application/db.js";
import logger from "../application/logger.js";
import { forwardCallback, forwardCallbackSnap } from "../service/forwadCallback.js";
import { getRabbitMQChannel } from "./connection.js";

const QUEUE_NAME = "forward_events";
const MAX_RETRY = 5;

const consumeQueue = async () => {
    await connectDB();

    try {
        const channel = await getRabbitMQChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true, deadLetterExchange: "dlx" });

        logger.info(`✅ Worker siap mendengarkan event dari RabbitMQ di queue: ${QUEUE_NAME}`);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                let payload;
                try {
                    payload = JSON.parse(msg.content.toString());
                    logger.info("📥 Menerima event pembayaran:", payload);

                    if (!payload) {
                        logger.error("❌ Payload tidak valid, pesan akan dihapus");
                        return channel.ack(msg);
                    }

                    if (payload.trxId) {
                        await forwardCallbackSnap(payload);
                        logger.info(`✅ Berhasil memproses event ${QUEUE_NAME} dengan Va SNAP: ${payload.trxId}`);
                    } else {
                        await forwardCallback(payload);
                        logger.info(
                            `✅ Berhasil memproses event ${QUEUE_NAME} dengan merchantTradeNo: ${payload.merchantTradeNo}`,
                        );
                    }
                    channel.ack(msg);
                } catch (error) {
                    let headers = msg.properties.headers || {};
                    let retryCount = headers["x-retry-count"] || 0;

                    if (retryCount >= MAX_RETRY) {
                        logger.error(`❌ Event ${QUEUE_NAME} gagal setelah ${MAX_RETRY} kali retry. Pesan dihapus.`);
                        return channel.ack(msg); // Hapus pesan setelah gagal beberapa kali
                    }

                    logger.warn(`⚠️ Gagal memproses event ${QUEUE_NAME}, retry ke-${retryCount + 1}`);

                    // 🔴 **Tambah header sebelum requeue**
                    headers["x-retry-count"] = retryCount + 1;

                    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
                        persistent: true,
                        headers: headers, // 🔴 **Pastikan header tetap ada**
                    });

                    channel.ack(msg); // Hapus pesan lama
                }
            }
        });
    } catch (error) {
        logger.error("❌ Gagal terhubung ke RabbitMQ:", error);
        process.exit(1);
    }

    process.on("SIGINT", async () => {
        logger.info("\n🛑 Menutup koneksi RabbitMQ...");
        process.exit(0);
    });
};

consumeQueue();
