import express from 'express';
import http from 'http';
import https from 'https';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
let server;

// Environment variables
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const WS_URL = process.env.WS_URL || `ws://localhost:${PORT}`;

// In development, use HTTP. In production (Vercel), also use HTTP
server = http.createServer(app);

const wss = new WebSocketServer({ server });

// Store active connections by IP
const connections = new Map();

// Serve static files from the root directory
app.use(express.static(__dirname));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', environment: NODE_ENV });
});

// Route handlers for HTML files
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.get('/connect', (req, res) => {
    res.sendFile(join(__dirname, 'connect.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(join(__dirname, 'login.html'));
});

app.get('/teacher-portal', (req, res) => {
    res.sendFile(join(__dirname, 'teacher-portal.html'));
});

app.get('/student-portal', (req, res) => {
    res.sendFile(join(__dirname, 'student-portal.html'));
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`New client connected from IP: ${clientIp}`);

    // Store the connection with its IP
    connections.set(clientIp, ws);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'connect-to-ip':
                // Handle direct IP connection request
                const targetWs = connections.get(data.targetIp);
                if (targetWs) {
                    // Send connection request to target
                    targetWs.send(JSON.stringify({
                        type: 'connection-request',
                        fromIp: clientIp
                    }));
                }
                break;

            case 'accept-connection':
                // Handle connection acceptance
                const requestorWs = connections.get(data.targetIp);
                if (requestorWs) {
                    requestorWs.send(JSON.stringify({
                        type: 'connection-accepted',
                        fromIp: clientIp
                    }));
                }
                break;

            case 'offer':
            case 'answer':
            case 'ice-candidate':
                // WebRTC signaling
                const target = connections.get(data.targetIp);
                if (target) {
                    target.send(JSON.stringify({
                        ...data,
                        fromIp: clientIp
                    }));
                }
                break;
        }
    });

    ws.on('close', () => {
        // Remove disconnected client
        connections.delete(clientIp);
        console.log(`Client disconnected: ${clientIp}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
    console.log(`WebSocket URL: ${WS_URL}`);
    console.log('Available routes:');
    console.log('- / (index.html)');
    console.log('- /connect (connect.html)');
    console.log('- /login (login.html)');
    console.log('- /teacher-portal (teacher-portal.html)');
    console.log('- /student-portal (student-portal.html)');
}); 