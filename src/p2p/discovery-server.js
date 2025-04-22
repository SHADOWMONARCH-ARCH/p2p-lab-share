const WebSocket = require('ws');
const dgram = require('dgram');
const crypto = require('crypto');

class DiscoveryServer {
    constructor(port = 12345) {
        this.port = port;
        this.peers = new Map();
        this.sessions = new Map();
        
        // Initialize WebSocket server for peer communication
        this.wss = new WebSocket.Server({ port: this.port });
        
        // Initialize UDP server for local network discovery
        this.udpServer = dgram.createSocket('udp4');
        
        this.initialize();
    }

    initialize() {
        // Handle WebSocket connections
        this.wss.on('connection', (ws) => {
            const peerId = crypto.randomBytes(16).toString('hex');
            this.peers.set(peerId, ws);

            ws.on('message', (message) => {
                this.handleMessage(JSON.parse(message), peerId);
            });

            ws.on('close', () => {
                this.handlePeerDisconnect(peerId);
            });

            // Send peer ID to the client
            ws.send(JSON.stringify({
                type: 'PEER_ID',
                peerId: peerId
            }));
        });

        // Handle UDP discovery
        this.udpServer.on('message', (message, rinfo) => {
            this.handleUDPMessage(message, rinfo);
        });

        this.udpServer.bind(this.port + 1);
    }

    handleMessage(message, senderId) {
        const sender = this.peers.get(senderId);
        if (!sender) return;

        switch (message.type) {
            case 'TEACHER_BROADCAST':
                this.handleTeacherBroadcast(message, senderId);
                break;
            case 'ICE_CANDIDATE':
                this.relayIceCandidate(message, senderId);
                break;
            case 'OFFER':
                this.relayOffer(message, senderId);
                break;
            case 'ANSWER':
                this.relayAnswer(message, senderId);
                break;
        }
    }

    handleTeacherBroadcast(message, teacherId) {
        const sessionId = message.sessionId || crypto.randomBytes(16).toString('hex');
        
        // Store session information
        this.sessions.set(sessionId, {
            teacherId,
            students: new Set(),
            timestamp: Date.now()
        });

        // Broadcast to all peers except teacher
        this.peers.forEach((peer, peerId) => {
            if (peerId !== teacherId) {
                peer.send(JSON.stringify({
                    type: 'TEACHER_BROADCAST',
                    sessionId,
                    teacherId
                }));
            }
        });
    }

    relayIceCandidate(message, senderId) {
        const targetPeer = this.peers.get(message.peerId);
        if (targetPeer) {
            targetPeer.send(JSON.stringify({
                type: 'ICE_CANDIDATE',
                candidate: message.candidate,
                peerId: senderId
            }));
        }
    }

    relayOffer(message, senderId) {
        const targetPeer = this.peers.get(message.peerId);
        if (targetPeer) {
            targetPeer.send(JSON.stringify({
                type: 'OFFER',
                offer: message.offer,
                peerId: senderId
            }));
        }
    }

    relayAnswer(message, senderId) {
        const targetPeer = this.peers.get(message.peerId);
        if (targetPeer) {
            targetPeer.send(JSON.stringify({
                type: 'ANSWER',
                answer: message.answer,
                peerId: senderId
            }));
        }
    }

    handlePeerDisconnect(peerId) {
        this.peers.delete(peerId);
        
        // Remove from sessions if teacher
        this.sessions.forEach((session, sessionId) => {
            if (session.teacherId === peerId) {
                this.sessions.delete(sessionId);
            } else {
                session.students.delete(peerId);
            }
        });

        // Notify other peers
        this.peers.forEach(peer => {
            peer.send(JSON.stringify({
                type: 'PEER_DISCONNECTED',
                peerId: peerId
            }));
        });
    }

    handleUDPMessage(message, rinfo) {
        try {
            const data = JSON.parse(message);
            if (data.type === 'DISCOVERY') {
                // Respond with WebSocket server info
                const response = JSON.stringify({
                    type: 'DISCOVERY_RESPONSE',
                    wsPort: this.port
                });
                this.udpServer.send(response, rinfo.port, rinfo.address);
            }
        } catch (error) {
            console.error('Error handling UDP message:', error);
        }
    }

    cleanup() {
        // Clean up old sessions (older than 1 hour)
        const oneHourAgo = Date.now() - 3600000;
        this.sessions.forEach((session, sessionId) => {
            if (session.timestamp < oneHourAgo) {
                this.sessions.delete(sessionId);
            }
        });
    }
}

// Start the discovery server
const server = new DiscoveryServer();

// Clean up old sessions every hour
setInterval(() => server.cleanup(), 3600000);

module.exports = DiscoveryServer; 