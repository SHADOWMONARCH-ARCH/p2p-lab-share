class WebRTCManager {
    constructor() {
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        
        // Use ws:// for development and wss:// for production
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`;
        this.socket = new WebSocket(wsUrl);
        
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connection-request':
                    this.handleConnectionRequest(data);
                    break;
                case 'connection-accepted':
                    this.handleConnectionAccepted(data);
                    break;
                case 'offer':
                    this.handleOffer(data);
                    break;
                case 'answer':
                    this.handleAnswer(data);
                    break;
                case 'ice-candidate':
                    this.handleIceCandidate(data);
                    break;
            }
        };
    }

    async connectToIP(targetIp) {
        this.socket.send(JSON.stringify({
            type: 'connect-to-ip',
            targetIp
        }));
    }

    async handleConnectionRequest(data) {
        const fromIp = data.fromIp;
        // Show connection request to user (implement UI for this)
        if (confirm(`Accept connection from ${fromIp}?`)) {
            this.socket.send(JSON.stringify({
                type: 'accept-connection',
                targetIp: fromIp
            }));
            await this.createPeerConnection(fromIp);
        }
    }

    async handleConnectionAccepted(data) {
        const fromIp = data.fromIp;
        await this.createPeerConnection(fromIp);
        // Create and send offer
        const offer = await this.peerConnections.get(fromIp).createOffer();
        await this.peerConnections.get(fromIp).setLocalDescription(offer);
        this.socket.send(JSON.stringify({
            type: 'offer',
            targetIp: fromIp,
            offer
        }));
    }

    async createPeerConnection(targetIp) {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // Create data channel for file transfer
        const dataChannel = pc.createDataChannel('fileTransfer');
        this.setupDataChannel(dataChannel, targetIp);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    targetIp,
                    candidate: event.candidate
                }));
            }
        };

        this.peerConnections.set(targetIp, pc);
        this.dataChannels.set(targetIp, dataChannel);

        return pc;
    }

    setupDataChannel(channel, targetIp) {
        channel.onopen = () => {
            console.log(`Data channel opened with ${targetIp}`);
            // Update UI to show connected status (implement this)
            this.onConnectionEstablished(targetIp);
        };

        channel.onmessage = (event) => {
            this.handleFileChunk(event.data, targetIp);
        };

        channel.onclose = () => {
            console.log(`Data channel closed with ${targetIp}`);
            // Update UI to show disconnected status (implement this)
            this.onConnectionClosed(targetIp);
        };
    }

    async handleOffer(data) {
        const fromIp = data.fromIp;
        const pc = await this.createPeerConnection(fromIp);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.send(JSON.stringify({
            type: 'answer',
            targetIp: fromIp,
            answer
        }));
    }

    async handleAnswer(data) {
        const fromIp = data.fromIp;
        const pc = this.peerConnections.get(fromIp);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }

    async handleIceCandidate(data) {
        const fromIp = data.fromIp;
        const pc = this.peerConnections.get(fromIp);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    async sendFile(file, targetIp) {
        const channel = this.dataChannels.get(targetIp);
        if (!channel || channel.readyState !== 'open') {
            console.error('Data channel not ready');
            return;
        }

        const chunkSize = 16384; // 16KB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);
        let currentChunk = 0;

        const reader = new FileReader();
        reader.onload = (e) => {
            const chunk = e.target.result;
            channel.send(JSON.stringify({
                type: 'file-chunk',
                fileName: file.name,
                fileSize: file.size,
                chunkIndex: currentChunk,
                totalChunks: totalChunks,
                data: chunk
            }));

            currentChunk++;
            if (currentChunk < totalChunks) {
                const start = currentChunk * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                reader.readAsArrayBuffer(file.slice(start, end));
            }
        };

        reader.readAsArrayBuffer(file.slice(0, chunkSize));
    }

    handleFileChunk(data, fromIp) {
        const chunk = JSON.parse(data);
        if (chunk.type === 'file-chunk') {
            // Implement file reconstruction logic here
            this.onFileChunkReceived(chunk, fromIp);
        }
    }

    // Callback methods to be implemented by the application
    onConnectionEstablished(targetIp) {
        // Implement in the application
    }

    onConnectionClosed(targetIp) {
        // Implement in the application
    }

    onFileChunkReceived(chunk, fromIp) {
        // Implement in the application
    }
} 