import { initializeWebSocket } from "../src/utils/websocket_initializer.js";

const testWebSocketConnection = async () => {
    try {
        const websocket = await initializeWebSocket();
        console.log("WebSocket is ready to use:", websocket);

        // Optionally, you can send a test message to the server
        websocket.send(JSON.stringify({ message: "Test connection" }));

        // Close the connection after testing
        websocket.close();
    } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
    }
};

testWebSocketConnection();
