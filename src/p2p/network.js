class P2PNetwork {
    constructor() {
        this.socket = null;
        this.peers = new Map();
        this.isTeacher = false;
        this.listeners = new Map();
        this.localAddress = null;
        this.localPort = null;
        this.sessionKey = null;
        this.teacherPublicKey = null;
        this.privateKey = null;
        this.publicKey = null;
        this.bandwidthLimit = 1024 * 1024; // 1MB/s default
        this.currentBandwidth = 0;
        this.bandwidthWindow = [];
        this.lastBandwidthCheck = Date.now();
    }

    async initialize(isTeacher = false, teacherPublicKey = null) {
        this.isTeacher = isTeacher;
        this.teacherPublicKey = teacherPublicKey;
        
        // Generate key pair
        const keyPair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            true,
            ["sign", "verify"]
        );
        
        this.privateKey = keyPair.privateKey;
        this.publicKey = keyPair.publicKey;

        // If teacher, generate session key
        if (isTeacher) {
            this.sessionKey = await crypto.subtle.generateKey(
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
        }
        
        try {
            // Create raw UDP socket
            this.socket = new UDPSocket({
                localAddress: '0.0.0.0',
                localPort: 0 // Let OS choose port
            });

            // Store local address and port
            this.localAddress = await this.getLocalAddress();
            this.localPort = this.socket.localPort;

            // Join multicast group for LAN
            await this.socket.joinMulticastGroup('239.255.255.250');
            
            // Start listening
            this.startListening();

            // Start discovery
            this.startDiscovery();

            console.log(`P2P Network initialized as ${isTeacher ? 'teacher' : 'student'}`);
            console.log(`Listening on ${this.localAddress}:${this.localPort}`);
        } catch (error) {
            console.error('Failed to initialize P2P network:', error);
            throw error;
        }
    }

    async getLocalAddress() {
        // Get local IP address
        const response = await fetch('http://localhost:8080/ip');
        const data = await response.json();
        return data.ip;
    }

    startListening() {
        this.socket.onmessage = (event) => {
            const { address, port, data } = event;
            try {
                this.handleMessage(address, port, data);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };

        this.socket.onerror = (error) => {
            console.error('Socket error:', error);
        };
    }

    async handleMessage(address, port, rawMessage) {
        try {
            const encryptedMessage = JSON.parse(rawMessage);
            const signedMessage = await this.decryptMessage(encryptedMessage);
            
            if (!await this.verifyMessage(signedMessage)) {
                console.warn('Invalid message signature from', address);
                return;
            }

            const message = signedMessage.message;
            
            switch (message.type) {
                case 'discovery':
                    await this.handleDiscovery(address, port, message);
                    break;
                case 'file-chunk':
                    await this.handleFileChunk(address, port, message);
                    break;
                case 'chunk-request':
                    await this.handleChunkRequest(address, port, message);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    startDiscovery() {
        // Broadcast presence periodically
        setInterval(() => {
            this.broadcastPresence();
        }, 5000);

        // Initial broadcast
        this.broadcastPresence();
    }

    broadcastPresence() {
        const message = {
            type: 'discovery',
            role: this.isTeacher ? 'teacher' : 'student',
            address: this.localAddress,
            port: this.localPort,
            timestamp: Date.now()
        };

        this.broadcast(message);
    }

    async handleDiscovery(address, port, message) {
        const peerId = `${address}:${port}`;
        
        // Don't add self as peer
        if (peerId === `${this.localAddress}:${this.localPort}`) {
            return;
        }

        // Update or add peer
        this.peers.set(peerId, {
            address,
            port,
            role: message.role,
            lastSeen: message.timestamp
        });

        // Emit peer discovered event
        this.emit('peer-discovered', {
            address,
            port,
            role: message.role
        });
    }

    async broadcast(message) {
        // Check bandwidth usage
        await this.checkBandwidth();

        const signedMessage = await this.signMessage(message);
        const encryptedMessage = await this.encryptMessage(signedMessage);
        
        const data = JSON.stringify(encryptedMessage);
        this.socket.send(data, {
            address: '239.255.255.250',
            port: 1900
        });

        // Update bandwidth usage
        this.updateBandwidthUsage(data.length);
    }

    async sendToPeer(address, port, message) {
        // Check bandwidth usage
        await this.checkBandwidth();

        const signedMessage = await this.signMessage(message);
        const encryptedMessage = await this.encryptMessage(signedMessage);
        
        const data = JSON.stringify(encryptedMessage);
        this.socket.send(data, { address, port });

        // Update bandwidth usage
        this.updateBandwidthUsage(data.length);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }

    getPeers() {
        return Array.from(this.peers.values());
    }

    cleanup() {
        if (this.socket) {
            this.socket.close();
        }
    }

    async encryptMessage(message) {
        if (!this.sessionKey) return message;
        
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(message));
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.sessionKey,
            data
        );

        return {
            type: 'encrypted',
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encryptedData))
        };
    }

    async decryptMessage(encryptedMessage) {
        if (!this.sessionKey) return encryptedMessage;
        
        const iv = new Uint8Array(encryptedMessage.iv);
        const data = new Uint8Array(encryptedMessage.data);
        
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.sessionKey,
            data
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedData));
    }

    async signMessage(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(message));
        
        const signature = await crypto.subtle.sign(
            {
                name: "ECDSA",
                hash: { name: "SHA-256" }
            },
            this.privateKey,
            data
        );

        return {
            message: message,
            signature: Array.from(new Uint8Array(signature)),
            publicKey: await crypto.subtle.exportKey('raw', this.publicKey)
        };
    }

    async verifyMessage(signedMessage) {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(signedMessage.message));
        
        const publicKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(signedMessage.publicKey),
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            true,
            ["verify"]
        );

        return await crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: { name: "SHA-256" }
            },
            publicKey,
            new Uint8Array(signedMessage.signature),
            data
        );
    }

    updateBandwidthUsage(bytes) {
        const now = Date.now();
        this.bandwidthWindow.push({ bytes, timestamp: now });

        // Remove entries older than 1 second
        while (this.bandwidthWindow.length > 0 && 
               now - this.bandwidthWindow[0].timestamp > 1000) {
            this.bandwidthWindow.shift();
        }

        // Calculate current bandwidth usage
        this.currentBandwidth = this.bandwidthWindow.reduce(
            (total, entry) => total + entry.bytes, 0
        );
    }

    async checkBandwidth() {
        const now = Date.now();
        if (now - this.lastBandwidthCheck < 100) return; // Check every 100ms

        this.lastBandwidthCheck = now;

        if (this.currentBandwidth > this.bandwidthLimit) {
            // Wait until bandwidth usage decreases
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.currentBandwidth <= this.bandwidthLimit) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }
    }

    setBandwidthLimit(limit) {
        this.bandwidthLimit = limit;
    }
}

export default P2PNetwork; 