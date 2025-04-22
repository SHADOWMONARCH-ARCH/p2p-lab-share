class MulticastDNS {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.serviceType = '_labshare._tcp.local';
    }

    async initialize() {
        try {
            // Create UDP socket for mDNS
            this.socket = new UDPSocket({
                localAddress: '0.0.0.0',
                localPort: 5353
            });

            // Join multicast group
            await this.socket.joinMulticastGroup('224.0.0.251');

            // Start listening for messages
            this.startListening();
        } catch (error) {
            console.error('Error initializing mDNS:', error);
        }
    }

    startListening() {
        this.socket.onmessage = (event) => {
            const message = this.parseMDNSMessage(event.data);
            this.handleMessage(message);
        };
    }

    broadcast(data) {
        const message = this.createMDNSMessage(data);
        this.socket.send(message, {
            address: '224.0.0.251',
            port: 5353
        });
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

    createMDNSMessage(data) {
        // Create mDNS query/response message
        const message = {
            type: 'PTR',
            name: this.serviceType,
            ttl: 120,
            data: JSON.stringify(data)
        };
        return this.encodeMDNSMessage(message);
    }

    parseMDNSMessage(data) {
        // Parse mDNS message
        try {
            return JSON.parse(data);
        } catch (error) {
            console.error('Error parsing mDNS message:', error);
            return null;
        }
    }

    handleMessage(message) {
        if (!message) return;

        switch (message.type) {
            case 'teacher-presence':
                this.emit('teacher-found', message.data);
                break;
            case 'peer-announce':
                this.emit('peer-found', message.data);
                break;
        }
    }

    encodeMDNSMessage(message) {
        // Simple encoding for demo purposes
        // In a real implementation, this would use proper DNS message format
        return JSON.stringify(message);
    }
}

export default MulticastDNS; 