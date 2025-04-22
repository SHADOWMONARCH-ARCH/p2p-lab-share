class P2PCore {
    constructor() {
        this.peers = new Map();
        this.connections = new Map();
        this.isTeacher = false;
        this.teacherKey = null;
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
    }

    async initialize(isTeacher = false, teacherKey = null) {
        this.isTeacher = isTeacher;
        this.teacherKey = teacherKey;
        
        // Initialize WebRTC
        this.rtcConfig = new RTCPeerConnection(this.config);
        
        // Setup data channel for file transfers
        this.dataChannel = this.rtcConfig.createDataChannel('fileTransfer', {
            ordered: true,
            maxRetransmits: 0
        });

        // Setup event handlers
        this.setupEventHandlers();
        
        // Start peer discovery
        await this.startDiscovery();
    }

    setupEventHandlers() {
        // Handle incoming connections
        this.rtcConfig.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannel(channel);
        };

        // Handle ICE candidates
        this.rtcConfig.onicecandidate = (event) => {
            if (event.candidate) {
                this.broadcastToPeers({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        this.rtcConfig.onconnectionstatechange = () => {
            console.log('Connection state:', this.rtcConfig.connectionState);
        };
    }

    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('Data channel opened');
            this.handleDataChannel(channel);
        };

        channel.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    async startDiscovery() {
        if (this.isTeacher) {
            // Teacher broadcasts presence
            this.broadcastPresence();
        } else {
            // Student listens for teacher
            this.listenForTeacher();
        }
    }

    broadcastPresence() {
        // Implement mDNS broadcast
        const mdns = new MulticastDNS();
        mdns.broadcast({
            type: 'teacher-presence',
            key: this.teacherKey
        });
    }

    listenForTeacher() {
        // Implement mDNS listener
        const mdns = new MulticastDNS();
        mdns.on('teacher-found', (teacherInfo) => {
            this.connectToTeacher(teacherInfo);
        });
    }

    async connectToTeacher(teacherInfo) {
        try {
            const offer = await this.rtcConfig.createOffer();
            await this.rtcConfig.setLocalDescription(offer);

            // Send offer to teacher
            this.sendToTeacher({
                type: 'offer',
                offer: offer
            });
        } catch (error) {
            console.error('Error connecting to teacher:', error);
        }
    }

    async handleOffer(offer) {
        try {
            await this.rtcConfig.setRemoteDescription(offer);
            const answer = await this.rtcConfig.createAnswer();
            await this.rtcConfig.setLocalDescription(answer);

            // Send answer back
            this.sendToPeer(offer.peerId, {
                type: 'answer',
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    handleMessage(message) {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'file-chunk':
                this.handleFileChunk(data);
                break;
            case 'chunk-request':
                this.handleChunkRequest(data);
                break;
            case 'peer-list':
                this.handlePeerList(data);
                break;
        }
    }

    broadcastToPeers(message) {
        this.connections.forEach((connection) => {
            if (connection.readyState === 'open') {
                connection.send(JSON.stringify(message));
            }
        });
    }

    sendToPeer(peerId, message) {
        const connection = this.connections.get(peerId);
        if (connection && connection.readyState === 'open') {
            connection.send(JSON.stringify(message));
        }
    }
}

export default P2PCore; 