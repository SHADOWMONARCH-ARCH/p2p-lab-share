const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');

class PeerDiscovery {
    constructor(port = 6881) {
        this.port = port;
        this.peers = new Map();
        this.isTeacher = false;
        this.peerId = this.generatePeerId();
        this.eventListeners = new Map();
        this.socket = dgram.createSocket('udp4');
        this.networkStatus = {
            connected: false,
            interface: null,
            lastCheck: null,
            error: null,
            statusMessage: 'Checking network...'
        };
        this.setupSocket();
        this.startNetworkMonitoring();
    }

    startNetworkMonitoring() {
        // Check network status every 5 seconds
        setInterval(() => this.checkNetworkStatus(), 5000);
    }

    checkNetworkStatus() {
        try {
            const newInterface = this.getNetworkInterface();
            const networkChanged = this.networkStatus.interface && 
                (newInterface.address !== this.networkStatus.interface.address ||
                 newInterface.netmask !== this.networkStatus.interface.netmask);

            this.networkStatus = {
                connected: true,
                interface: newInterface,
                lastCheck: Date.now(),
                error: null,
                statusMessage: `Connected to network: ${newInterface.address} (${newInterface.name})`
            };

            if (networkChanged) {
                console.log('Network configuration changed. Reinitializing...');
                this.emit('networkChanged', this.networkStatus);
                this.reinitialize();
            }
        } catch (error) {
            this.networkStatus = {
                connected: false,
                interface: null,
                lastCheck: Date.now(),
                error: error.message,
                statusMessage: 'No network connection detected. Please check your network settings.'
            };
            console.error('Network error:', error.message);
            this.emit('networkError', error);
        }
    }

    reinitialize() {
        // Close existing socket
        if (this.socket) {
            this.socket.close();
        }

        // Create new socket
        this.socket = dgram.createSocket('udp4');
        this.setupSocket();

        // Re-broadcast presence if needed
        if (this.isTeacher) {
            this.broadcastSession();
        } else {
            this.broadcastDiscover();
        }
    }

    getNetworkInterface() {
        const interfaces = os.networkInterfaces();
        let suitableInterface = null;

        for (const [name, ifaces] of Object.entries(interfaces)) {
            for (const iface of ifaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    // Prefer interfaces that are up and not loopback
                    if (!suitableInterface || 
                        (iface.address !== '127.0.0.1' && suitableInterface.address === '127.0.0.1')) {
                        suitableInterface = {
                            name,
                            address: iface.address,
                            netmask: iface.netmask,
                            broadcast: this.getBroadcastAddress(iface.address, iface.netmask),
                            mac: iface.mac
                        };
                    }
                }
            }
        }

        if (!suitableInterface) {
            throw new Error('No active network interface found. Please check your network connection.');
        }

        return suitableInterface;
    }

    isSameNetwork(address) {
        if (!this.networkStatus.connected || !this.networkStatus.interface) {
            this.networkStatus.statusMessage = 'Network not connected. Please check your connection.';
            this.emit('networkStatusUpdate', this.networkStatus);
            return false;
        }
        
        try {
            const [a1, a2, a3, a4] = address.split('.').map(Number);
            const [n1, n2, n3, n4] = this.networkStatus.interface.netmask.split('.').map(Number);
            const [i1, i2, i3, i4] = this.networkStatus.interface.address.split('.').map(Number);

            const sameNetwork = ((a1 & n1) === (i1 & n1)) &&
                              ((a2 & n2) === (i2 & n2)) &&
                              ((a3 & n3) === (i3 & n3)) &&
                              ((a4 & n4) === (i4 & n4));

            if (!sameNetwork) {
                this.networkStatus.statusMessage = `Device ${address} is not in the same network. Local network: ${this.networkStatus.interface.address}`;
                this.emit('networkStatusUpdate', this.networkStatus);
            }

            return sameNetwork;
        } catch (error) {
            this.networkStatus.statusMessage = 'Error checking network configuration.';
            this.emit('networkStatusUpdate', this.networkStatus);
            console.error('Error checking network:', error);
            return false;
        }
    }

    generatePeerId() {
        return crypto.randomBytes(20).toString('hex');
    }

    setupSocket() {
        this.socket.on('error', (err) => {
            this.networkStatus.statusMessage = `Network error: ${err.message}`;
            this.emit('networkStatusUpdate', this.networkStatus);
            console.error(`UDP Socket error: ${err}`);
            this.emit('socketError', err);
            this.socket.close();
        });

        this.socket.on('message', (msg, rinfo) => {
            try {
                if (!this.networkStatus.connected) {
                    this.networkStatus.statusMessage = 'Network not connected. Cannot receive messages.';
                    this.emit('networkStatusUpdate', this.networkStatus);
                    console.log('Ignoring message: Network not connected');
                    return;
                }

                if (!this.isSameNetwork(rinfo.address)) {
                    console.log(`Ignoring message from different network: ${rinfo.address}`);
                    return;
                }

                const message = JSON.parse(msg.toString());
                this.handleMessage(message, rinfo);
            } catch (err) {
                this.networkStatus.statusMessage = 'Error processing network message.';
                this.emit('networkStatusUpdate', this.networkStatus);
                console.error('Error handling message:', err);
                this.emit('messageError', err);
            }
        });

        this.socket.on('listening', () => {
            this.socket.setBroadcast(true);
            const address = this.socket.address();
            this.networkStatus.statusMessage = `Listening on network: ${this.networkStatus.interface?.address}`;
            this.emit('networkStatusUpdate', this.networkStatus);
            
            console.log('Network Status:', {
                interface: this.networkStatus.interface?.name,
                localAddress: this.networkStatus.interface?.address,
                broadcastAddress: this.networkStatus.interface?.broadcast,
                socketPort: address.port,
                statusMessage: this.networkStatus.statusMessage
            });
        });

        this.socket.bind(this.port);
    }

    handleMessage(message, rinfo) {
        // Validate sender is in same network
        if (!this.isSameNetwork(rinfo.address)) {
            console.log(`Ignoring message from different network: ${rinfo.address}`);
            return;
        }

        switch (message.type) {
            case 'DISCOVER':
                this.handleDiscover(message, rinfo);
                break;
            case 'SESSION_START':
                this.handleSessionStart(message, rinfo);
                break;
            case 'SESSION_JOIN':
                this.handleSessionJoin(message, rinfo);
                break;
            case 'CHUNK_AVAILABLE':
                this.handleChunkAvailable(message, rinfo);
                break;
            case 'CHUNK_REQUEST':
                this.handleChunkRequest(message, rinfo);
                break;
        }
    }

    startAsTeacher(name) {
        this.isTeacher = true;
        this.teacherName = name;
        this.broadcastSession();
    }

    startAsStudent() {
        this.isTeacher = false;
        this.broadcastDiscover();
    }

    broadcastDiscover() {
        const message = {
            type: 'DISCOVER',
            peerId: this.peerId
        };
        this.broadcastMessage(message);
    }

    broadcastSession() {
        const message = {
            type: 'SESSION_START',
            peerId: this.peerId,
            teacherName: this.teacherName,
            timestamp: Date.now()
        };
        this.broadcastMessage(message);
    }

    broadcastMessage(message) {
        if (!this.networkStatus.connected) {
            this.networkStatus.statusMessage = 'Cannot broadcast: Network not connected';
            this.emit('networkStatusUpdate', this.networkStatus);
            console.error('Cannot broadcast: Network not connected');
            this.emit('broadcastError', new Error('Network not connected'));
            return;
        }

        try {
            const buffer = Buffer.from(JSON.stringify(message));
            this.socket.send(
                buffer, 
                0, 
                buffer.length, 
                this.port, 
                this.networkStatus.interface.broadcast,
                (err) => {
                    if (err) {
                        this.networkStatus.statusMessage = `Broadcast error: ${err.message}`;
                        this.emit('networkStatusUpdate', this.networkStatus);
                        console.error('Broadcast error:', err);
                        this.emit('broadcastError', err);
                    }
                }
            );
        } catch (error) {
            this.networkStatus.statusMessage = `Error in broadcast: ${error.message}`;
            this.emit('networkStatusUpdate', this.networkStatus);
            console.error('Error in broadcast:', error);
            this.emit('broadcastError', error);
        }
    }

    handleDiscover(message, rinfo) {
        if (this.isTeacher) {
            this.sendAnnouncement(rinfo);
        }
    }

    handleSessionStart(message, rinfo) {
        if (!this.isTeacher && message.isTeacher) {
            this.addPeer(message.peerId, rinfo.address, message.name);
            this.emit('teacherFound', {
                id: message.peerId,
                address: rinfo.address,
                name: message.name
            });
        }
    }

    handleSessionJoin(message, rinfo) {
        // Implementation needed
    }

    handleChunkAvailable(message, rinfo) {
        // Implementation needed
    }

    handleChunkRequest(message, rinfo) {
        // Implementation needed
    }

    sendAnnouncement(rinfo) {
        const interfaces = os.networkInterfaces();
        const announcement = {
            type: 'ANNOUNCE',
            peerId: this.peerId,
            isTeacher: true,
            name: this.teacherName,
            timestamp: Date.now()
        };

        Object.values(interfaces).flat().forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                const broadcastAddr = this.getBroadcastAddress(iface.address, iface.netmask);
                this.socket.send(
                    JSON.stringify(announcement),
                    this.port,
                    broadcastAddr
                );
            }
        });
    }

    getBroadcastAddress(ip, netmask) {
        const ipBytes = ip.split('.').map(Number);
        const maskBytes = netmask.split('.').map(Number);
        const broadcastBytes = ipBytes.map((byte, i) => (byte | (~maskBytes[i] & 255)));
        return broadcastBytes.join('.');
    }

    addPeer(peerId, address, name) {
        if (!this.peers.has(peerId)) {
            this.peers.set(peerId, {
                id: peerId,
                address,
                name,
                lastSeen: Date.now()
            });
        }
    }

    handlePeerUpdate(message, rinfo) {
        if (this.peers.has(message.peerId)) {
            const peer = this.peers.get(message.peerId);
            peer.lastSeen = Date.now();
            peer.chunks = message.chunks || [];
            this.emit('peerUpdated', peer);
        }
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => callback(data));
        }
    }

    getPeers() {
        // Clean up stale peers (not seen in last 15 seconds)
        const now = Date.now();
        for (const [peerId, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > 15000) {
                this.peers.delete(peerId);
                this.emit('peerLeft', peer);
            }
        }
        return Array.from(this.peers.values());
    }

    close() {
        if (this.socket) {
            this.socket.close();
        }
    }
} 