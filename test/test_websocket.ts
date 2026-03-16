import { WebSocket } from "ws";

const testWebSocketConnection = (): void => {
    const ws = new WebSocket("wss://wss.api.pg.pandi.id/");

    ws.on("open", () => {
        console.log("✅ Connected to WebSocket server");

        ws.send(JSON.stringify({ type: "ping" }));

        setTimeout(() => {
            ws.close();
        }, 1000);
    });

    ws.on("message", (data: WebSocket.Data) => {
        console.log("📩 Received from server:", data.toString());
    });

    ws.on("close", () => {
        console.log("🔌 Connection closed");
    });

    ws.on("error", (error: Error) => {
        console.error("❌ WebSocket error:", error);
    });
};

testWebSocketConnection();
