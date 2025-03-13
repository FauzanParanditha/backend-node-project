import amqplib from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost"; // Sesuaikan jika pakai Docker: amqp://guest:guest@localhost

const testConnection = async () => {
    try {
        const connection = await amqplib.connect(RABBITMQ_URL);
        console.log("✅ Terhubung ke RabbitMQ!");
        await connection.close();
    } catch (error) {
        console.error("❌ Gagal terhubung ke RabbitMQ:", error);
    }
};

testConnection();
