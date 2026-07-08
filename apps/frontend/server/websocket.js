const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New client connected. Total:', clients.size);

  ws.on('message', (data) => {
    // Broadcast the received message to all other clients
    const message = data.toString();
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected. Total:', clients.size);
  });

  ws.on('error', console.error);
});

const PORT = process.env.WS_PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});