const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // Simple static file server
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css'
    }[extname] || 'text/plain';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });
const peers = new Map();

wss.on('connection', (ws) => {
    const peerId = generatePeerId();
    peers.set(peerId, ws);

    // Send the peer their ID
    ws.send(JSON.stringify({
        type: 'init',
        peerId
    }));

    // Announce new peer to all other peers
    broadcast({
        type: 'peerConnected',
        peerId,
        address: ws._socket.remoteAddress
    }, ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(data, peerId, ws);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    ws.on('close', () => {
        peers.delete(peerId);
        broadcast({
            type: 'peerDisconnected',
            peerId
        });
    });
});

function handleMessage(message, senderId, senderWs) {
    switch (message.type) {
        case 'chunkAvailable':
            // Forward chunk availability to all peers except sender
            broadcast({
                type: 'fileAvailable',
                fileInfo: {
                    ...message.chunk,
                    peerId: senderId
                }
            }, senderWs);
            break;
        
        case 'requestChunk':
            // Forward chunk request to the specific peer
            const targetPeer = peers.get(message.targetPeerId);
            if (targetPeer) {
                targetPeer.send(JSON.stringify({
                    type: 'chunkRequested',
                    chunkId: message.chunkId,
                    requesterId: senderId
                }));
            }
            break;
    }
}

function broadcast(message, exclude = null) {
    const messageStr = JSON.stringify(message);
    peers.forEach((peer) => {
        if (peer !== exclude && peer.readyState === WebSocket.OPEN) {
            peer.send(messageStr);
        }
    });
}

function generatePeerId() {
    return Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 6881;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 