class PeerConnection {
    constructor(isTeacher = false, teacherPublicKey = null) {
        this.isTeacher = isTeacher;
        this.peers = new Map(); // Store peer connections
        this.chunks = new Map(); // Store file chunks
        this.chunkSize = 16384; // 16KB chunks
        this.connections = new Map(); // Store RTCPeerConnection objects
        this.dataChannels = new Map(); // Store RTCDataChannel objects
        this.peerId = this.generatePeerId();
        this.knownPeers = new Set();
        
        // File storage settings
        this.storagePath = path.join(os.homedir(), 'p2p-lab-files');
        this.ensureStorageDirectory();
        
        // Generate or use provided key pair
        if (isTeacher) {
            this.keyPair = this.generateKeyPair();
            this.publicKey = this.keyPair.publicKey;
        } else {
            this.publicKey = teacherPublicKey;
        }
        
        // BitTorrent-style discovery
        this.discoveryInterval = null;
        this.broadcastPort = 6881;
        this.broadcastAddress = '255.255.255.255';
        
        this.initialize();
    }

    async initialize() {
        try {
            // Create UDP socket for broadcast discovery
            this.socket = new dgram.createSocket('udp4');
            
            this.socket.on('message', (msg, rinfo) => {
                const message = JSON.parse(msg.toString());
                this.handleDiscoveryMessage(message, rinfo);
            });

            this.socket.on('listening', () => {
                this.socket.setBroadcast(true);
                this.startBroadcasting();
            });

            this.socket.bind(this.broadcastPort);
            
            // Handle WebRTC connections
            this.setupWebRTC();
        } catch (error) {
            console.error('Failed to initialize peer connection:', error);
        }
    }

    generateKeyPair() {
        // Generate RSA key pair for teacher authentication
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        return { publicKey, privateKey };
    }

    signMessage(message) {
        if (!this.isTeacher) return message;
        
        const sign = crypto.createSign('SHA256');
        sign.update(JSON.stringify(message));
        const signature = sign.sign(this.keyPair.privateKey, 'base64');
        
        return {
            ...message,
            signature,
            publicKey: this.publicKey
        };
    }

    verifyMessage(message) {
        if (!message.signature || !message.publicKey) return false;
        
        const verify = crypto.createVerify('SHA256');
        const { signature, publicKey, ...messageContent } = message;
        verify.update(JSON.stringify(messageContent));
        
        return verify.verify(publicKey, signature, 'base64');
    }

    startBroadcasting() {
        this.discoveryInterval = setInterval(() => {
            const message = {
                type: 'PEER_DISCOVERY',
                peerId: this.peerId,
                isTeacher: this.isTeacher,
                timestamp: Date.now()
            };
            
            const signedMessage = this.signMessage(message);
            this.socket.send(
                JSON.stringify(signedMessage),
                this.broadcastPort,
                this.broadcastAddress
            );
        }, 5000);
    }

    handleDiscoveryMessage(message, rinfo) {
        if (message.peerId === this.peerId) return;
        
        // Verify teacher's message
        if (message.isTeacher && !this.verifyMessage(message)) {
            console.warn('Received unverified teacher broadcast');
            return;
        }
        
        if (message.type === 'PEER_DISCOVERY') {
            this.knownPeers.add(message.peerId);
            
            if (!this.isTeacher && message.isTeacher) {
                // Store teacher's public key for future verification
                this.publicKey = message.publicKey;
                this.connectToPeer(message.peerId, rinfo.address);
            }
            
            if (this.isTeacher) {
                this.connectToPeer(message.peerId, rinfo.address);
            }
        }
    }

    async connectToPeer(peerId, address) {
        if (this.peers.has(peerId)) return;

        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        });

        this.connections.set(peerId, peerConnection);

        // Create data channel with BitTorrent-like settings
        const dataChannel = peerConnection.createDataChannel('fileTransfer', {
            ordered: true,
            maxRetransmits: 3,
            maxPacketLifeTime: 1000
        });
        
        this.setupDataChannel(dataChannel, peerId);

        // Exchange ICE candidates directly
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Send ICE candidate directly to peer using UDP
                const message = {
                    type: 'ICE_CANDIDATE',
                    candidate: event.candidate,
                    peerId: this.peerId
                };
                
                this.socket.send(
                    JSON.stringify(message),
                    this.broadcastPort,
                    address
                );
            }
        };

        // Create and exchange offers/answers
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
        
        // Send offer directly to peer
        const offerMessage = {
                type: 'OFFER',
                offer: offer,
            peerId: this.peerId
        };
        
        this.socket.send(
            JSON.stringify(offerMessage),
            this.broadcastPort,
            address
        );
    }

    async handleOffer(offer, peerId, address) {
        const peerConnection = this.connections.get(peerId);
        if (!peerConnection) return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Send answer directly to peer
        const answerMessage = {
            type: 'ANSWER',
            answer: answer,
            peerId: this.peerId
        };
        
        this.socket.send(
            JSON.stringify(answerMessage),
            this.broadcastPort,
            address
        );
    }

    async handleAnswer(answer, peerId) {
        const peerConnection = this.connections.get(peerId);
        if (!peerConnection) return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    setupDataChannel(dataChannel, peerId) {
        this.dataChannels.set(peerId, dataChannel);

        dataChannel.onopen = () => {
            console.log(`Direct P2P connection established with peer ${peerId}`);
            this.peers.set(peerId, true);
            
            // Share available chunks with new peer
            this.shareAvailableChunks(peerId);
        };

        dataChannel.onclose = () => {
            console.log(`P2P connection closed with peer ${peerId}`);
            this.peers.delete(peerId);
            this.connections.delete(peerId);
            this.dataChannels.delete(peerId);
        };

        dataChannel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data, peerId);
        };
    }

    async shareAvailableChunks(peerId) {
        this.chunks.forEach((fileData, fileId) => {
            if (fileData.completed) {
                this.sendToPeer(peerId, {
                    type: 'FILE_METADATA',
                    metadata: {
                        fileId,
                        fileName: fileData.fileName,
                        fileSize: fileData.fileSize,
                        totalChunks: fileData.totalChunks
                    }
                });
            }
        });
    }

    generatePeerId() {
        return Math.random().toString(36).substr(2, 9);
    }

    sendToPeer(peerId, message) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify(message));
        }
    }

    async handleDataChannelMessage(data, peerId) {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'FILE_METADATA':
                await this.handleFileMetadata(message.metadata, peerId);
                break;
            case 'FILE_CHUNK':
                await this.handleFileChunk(message.chunk, message.chunkId, message.fileId);
                break;
            case 'REQUEST_CHUNK':
                await this.sendChunk(message.fileId, message.chunkId, peerId);
                break;
        }
    }

    async handleFileMetadata(metadata, peerId) {
        const { fileId, fileName, totalChunks, fileSize } = metadata;
        this.chunks.set(fileId, {
            fileName,
            fileSize,
            totalChunks,
            receivedChunks: new Map(),
            completed: false
        });

        // Request first chunk
        this.requestChunk(fileId, 0, peerId);
    }

    async handleFileChunk(chunk, chunkId, fileId) {
        const fileData = this.chunks.get(fileId);
        if (!fileData) return;

        fileData.receivedChunks.set(chunkId, chunk);

        // Check if file is complete
        if (fileData.receivedChunks.size === fileData.totalChunks) {
            await this.assembleFile(fileId);
        } else {
            // Request next chunk
            this.requestNextChunk(fileId);
        }

        // Share received chunk with other peers
        this.shareChunkWithPeers(chunk, chunkId, fileId);
    }

    async assembleFile(fileId) {
        const fileData = this.chunks.get(fileId);
        const chunks = Array.from(fileData.receivedChunks.values());
        const blob = new Blob(chunks, { type: 'application/octet-stream' });
        
        // Convert blob to buffer for saving
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Save file locally
        const filePath = await this.saveFileLocally(fileId, fileData.fileName, buffer);
        
        // Trigger file received event
        const event = new CustomEvent('fileReceived', {
            detail: {
                fileId,
                fileName: fileData.fileName,
                filePath,
                blob
            }
        });
        window.dispatchEvent(event);

        fileData.completed = true;
    }

    async saveFileLocally(fileId, fileName, fileData) {
        try {
            // Create a unique filename to avoid conflicts
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeFileName = `${timestamp}_${fileName}`;
            const filePath = path.join(this.storagePath, safeFileName);
            
            // Save the file
            await fs.promises.writeFile(filePath, fileData);
            console.log(`File saved locally: ${filePath}`);
            
            // Trigger file saved event
            const event = new CustomEvent('fileSaved', {
                detail: {
                    fileId,
                    fileName: safeFileName,
                    filePath
                }
            });
            window.dispatchEvent(event);
            
            return filePath;
        } catch (error) {
            console.error('Error saving file locally:', error);
            throw error;
        }
    }

    async shareFile(file) {
        if (!this.isTeacher) return;

        const fileId = `file-${Date.now()}`;
        const chunks = await this.splitFile(file);
        
        // Store chunks
        this.chunks.set(fileId, {
            fileName: file.name,
            fileSize: file.size,
            totalChunks: chunks.length,
            chunks: chunks,
            completed: true
        });

        // Save file locally first
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await this.saveFileLocally(fileId, file.name, buffer);

        // Broadcast file metadata to all peers
        this.broadcastToAll({
            type: 'FILE_METADATA',
            metadata: {
                fileId,
                fileName: file.name,
                fileSize: file.size,
                totalChunks: chunks.length
            }
        });
    }

    async splitFile(file) {
        const chunks = [];
        let offset = 0;
        
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + this.chunkSize);
            chunks.push(chunk);
            offset += this.chunkSize;
        }
        
        return chunks;
    }

    broadcastToAll(message) {
        this.peers.forEach((_, peerId) => {
            const dataChannel = this.dataChannels.get(peerId);
            if (dataChannel?.readyState === 'open') {
                dataChannel.send(JSON.stringify(message));
            }
        });
    }

    requestChunk(fileId, chunkId, peerId) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'REQUEST_CHUNK',
                fileId,
                chunkId
            }));
        }
    }

    async sendChunk(fileId, chunkId, peerId) {
        const fileData = this.chunks.get(fileId);
        if (!fileData || !fileData.chunks[chunkId]) return;

        const chunk = fileData.chunks[chunkId];
        const dataChannel = this.dataChannels.get(peerId);
        
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'FILE_CHUNK',
                fileId,
                chunkId,
                chunk: await this.chunkToBase64(chunk)
            }));
        }
    }

    async chunkToBase64(chunk) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(chunk);
        });
    }

    disconnect() {
        clearInterval(this.discoveryInterval);
        this.socket.close();
        this.connections.forEach(connection => connection.close());
        this.dataChannels.forEach(channel => channel.close());
        this.peers.clear();
        this.chunks.clear();
        this.knownPeers.clear();
    }

    ensureStorageDirectory() {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }
}

class PeerConnection {
    constructor(isTeacher = false, teacherPublicKey = null) {
        this.isTeacher = isTeacher;
        this.peers = new Map(); // Store peer connections
        this.chunks = new Map(); // Store file chunks
        this.chunkSize = 16384; // 16KB chunks
        this.connections = new Map(); // Store RTCPeerConnection objects
        this.dataChannels = new Map(); // Store RTCDataChannel objects
        this.peerId = this.generatePeerId();
        this.knownPeers = new Set();
        
        // Generate or use provided key pair
        if (isTeacher) {
            this.keyPair = this.generateKeyPair();
            this.publicKey = this.keyPair.publicKey;
        } else {
            this.publicKey = teacherPublicKey;
        }
        
        // BitTorrent-style discovery
        this.discoveryInterval = null;
        this.broadcastPort = 6881;
        this.broadcastAddress = '255.255.255.255';
        
        this.initialize();
    }

    async initialize() {
        try {
            // Create UDP socket for broadcast discovery
            this.socket = new dgram.createSocket('udp4');
            
            this.socket.on('message', (msg, rinfo) => {
                const message = JSON.parse(msg.toString());
                this.handleDiscoveryMessage(message, rinfo);
            });

            this.socket.on('listening', () => {
                this.socket.setBroadcast(true);
                this.startBroadcasting();
            });

            this.socket.bind(this.broadcastPort);
            
            // Handle WebRTC connections
            this.setupWebRTC();
        } catch (error) {
            console.error('Failed to initialize peer connection:', error);
        }
    }

    generateKeyPair() {
        // Generate RSA key pair for teacher authentication
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        return { publicKey, privateKey };
    }

    signMessage(message) {
        if (!this.isTeacher) return message;
        
        const sign = crypto.createSign('SHA256');
        sign.update(JSON.stringify(message));
        const signature = sign.sign(this.keyPair.privateKey, 'base64');
        
        return {
            ...message,
            signature,
            publicKey: this.publicKey
        };
    }

    verifyMessage(message) {
        if (!message.signature || !message.publicKey) return false;
        
        const verify = crypto.createVerify('SHA256');
        const { signature, publicKey, ...messageContent } = message;
        verify.update(JSON.stringify(messageContent));
        
        return verify.verify(publicKey, signature, 'base64');
    }

    startBroadcasting() {
        this.discoveryInterval = setInterval(() => {
            const message = {
                type: 'PEER_DISCOVERY',
                peerId: this.peerId,
                isTeacher: this.isTeacher,
                timestamp: Date.now()
            };
            
            const signedMessage = this.signMessage(message);
            this.socket.send(
                JSON.stringify(signedMessage),
                this.broadcastPort,
                this.broadcastAddress
            );
        }, 5000);
    }

    handleDiscoveryMessage(message, rinfo) {
        if (message.peerId === this.peerId) return;
        
        // Verify teacher's message
        if (message.isTeacher && !this.verifyMessage(message)) {
            console.warn('Received unverified teacher broadcast');
            return;
        }
        
        if (message.type === 'PEER_DISCOVERY') {
            this.knownPeers.add(message.peerId);
            
            if (!this.isTeacher && message.isTeacher) {
                // Store teacher's public key for future verification
                this.publicKey = message.publicKey;
                this.connectToPeer(message.peerId, rinfo.address);
            }
            
            if (this.isTeacher) {
                this.connectToPeer(message.peerId, rinfo.address);
            }
        }
    }

    async connectToPeer(peerId, address) {
        if (this.peers.has(peerId)) return;

        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        });

        this.connections.set(peerId, peerConnection);

        // Create data channel with BitTorrent-like settings
        const dataChannel = peerConnection.createDataChannel('fileTransfer', {
            ordered: true,
            maxRetransmits: 3,
            maxPacketLifeTime: 1000
        });
        
        this.setupDataChannel(dataChannel, peerId);

        // Exchange ICE candidates directly
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Send ICE candidate directly to peer using UDP
                const message = {
                    type: 'ICE_CANDIDATE',
                    candidate: event.candidate,
                    peerId: this.peerId
                };
                
                this.socket.send(
                    JSON.stringify(message),
                    this.broadcastPort,
                    address
                );
            }
        };

        // Create and exchange offers/answers
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer directly to peer
        const offerMessage = {
            type: 'OFFER',
            offer: offer,
            peerId: this.peerId
        };
        
        this.socket.send(
            JSON.stringify(offerMessage),
            this.broadcastPort,
            address
        );
    }

    async handleOffer(offer, peerId, address) {
        const peerConnection = this.connections.get(peerId);
        if (!peerConnection) return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Send answer directly to peer
        const answerMessage = {
            type: 'ANSWER',
            answer: answer,
            peerId: this.peerId
        };
        
        this.socket.send(
            JSON.stringify(answerMessage),
            this.broadcastPort,
            address
        );
    }

    async handleAnswer(answer, peerId) {
        const peerConnection = this.connections.get(peerId);
        if (!peerConnection) return;

        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    setupDataChannel(dataChannel, peerId) {
        this.dataChannels.set(peerId, dataChannel);

        dataChannel.onopen = () => {
            console.log(`Direct P2P connection established with peer ${peerId}`);
            this.peers.set(peerId, true);
            
            // Share available chunks with new peer
            this.shareAvailableChunks(peerId);
        };

        dataChannel.onclose = () => {
            console.log(`P2P connection closed with peer ${peerId}`);
            this.peers.delete(peerId);
            this.connections.delete(peerId);
            this.dataChannels.delete(peerId);
        };

        dataChannel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data, peerId);
        };
    }

    async shareAvailableChunks(peerId) {
        this.chunks.forEach((fileData, fileId) => {
            if (fileData.completed) {
                this.sendToPeer(peerId, {
                    type: 'FILE_METADATA',
                    metadata: {
                        fileId,
                        fileName: fileData.fileName,
                        fileSize: fileData.fileSize,
                        totalChunks: fileData.totalChunks
                    }
                });
            }
        });
    }

    generatePeerId() {
        return Math.random().toString(36).substr(2, 9);
    }

    sendToPeer(peerId, message) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify(message));
        }
    }

    async handleDataChannelMessage(data, peerId) {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'FILE_METADATA':
                await this.handleFileMetadata(message.metadata, peerId);
                break;
            case 'FILE_CHUNK':
                await this.handleFileChunk(message.chunk, message.chunkId, message.fileId);
                break;
            case 'REQUEST_CHUNK':
                await this.sendChunk(message.fileId, message.chunkId, peerId);
                break;
        }
    }

    async handleFileMetadata(metadata, peerId) {
        const { fileId, fileName, totalChunks, fileSize } = metadata;
        this.chunks.set(fileId, {
            fileName,
            fileSize,
            totalChunks,
            receivedChunks: new Map(),
            completed: false
        });

        // Request first chunk
        this.requestChunk(fileId, 0, peerId);
    }

    async handleFileChunk(chunk, chunkId, fileId) {
        const fileData = this.chunks.get(fileId);
        if (!fileData) return;

        fileData.receivedChunks.set(chunkId, chunk);

        // Check if file is complete
        if (fileData.receivedChunks.size === fileData.totalChunks) {
            await this.assembleFile(fileId);
        } else {
            // Request next chunk
            this.requestNextChunk(fileId);
        }

        // Share received chunk with other peers
        this.shareChunkWithPeers(chunk, chunkId, fileId);
    }

    async assembleFile(fileId) {
        const fileData = this.chunks.get(fileId);
        const chunks = Array.from(fileData.receivedChunks.values());
        const blob = new Blob(chunks, { type: 'application/octet-stream' });
        
        // Trigger file received event
        const event = new CustomEvent('fileReceived', {
            detail: {
                fileId,
                fileName: fileData.fileName,
                blob
            }
        });
        window.dispatchEvent(event);

        fileData.completed = true;
    }

    async shareFile(file) {
        if (!this.isTeacher) return;

        const fileId = `file-${Date.now()}`;
        const chunks = await this.splitFile(file);
        
        // Store chunks
        this.chunks.set(fileId, {
            fileName: file.name,
            fileSize: file.size,
            totalChunks: chunks.length,
            chunks: chunks,
            completed: true
        });

        // Broadcast file metadata to all peers
        this.broadcastToAll({
            type: 'FILE_METADATA',
            metadata: {
                fileId,
                fileName: file.name,
                fileSize: file.size,
                totalChunks: chunks.length
            }
        });
    }

    async splitFile(file) {
        const chunks = [];
        let offset = 0;
        
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + this.chunkSize);
            chunks.push(chunk);
            offset += this.chunkSize;
        }
        
        return chunks;
    }

    broadcastToAll(message) {
        this.peers.forEach((_, peerId) => {
            const dataChannel = this.dataChannels.get(peerId);
            if (dataChannel?.readyState === 'open') {
                dataChannel.send(JSON.stringify(message));
            }
        });
    }

    requestChunk(fileId, chunkId, peerId) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'REQUEST_CHUNK',
                fileId,
                chunkId
            }));
        }
    }

    async sendChunk(fileId, chunkId, peerId) {
        const fileData = this.chunks.get(fileId);
        if (!fileData || !fileData.chunks[chunkId]) return;

        const chunk = fileData.chunks[chunkId];
        const dataChannel = this.dataChannels.get(peerId);
        
        if (dataChannel?.readyState === 'open') {
            dataChannel.send(JSON.stringify({
                type: 'FILE_CHUNK',
                fileId,
                chunkId,
                chunk: await this.chunkToBase64(chunk)
            }));
        }
    }

    async chunkToBase64(chunk) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(chunk);
        });
    }

    disconnect() {
        clearInterval(this.discoveryInterval);
        this.socket.close();
        this.connections.forEach(connection => connection.close());
        this.dataChannels.forEach(channel => channel.close());
        this.peers.clear();
        this.chunks.clear();
        this.knownPeers.clear();
    }
}

export default PeerConnection; 