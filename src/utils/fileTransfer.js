const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const net = require('net');

// File transfer utilities
class FileTransfer {
    constructor(peerDiscovery) {
        this.peerDiscovery = peerDiscovery;
        this.activeTransfers = new Map();
        this.availableChunks = new Map();
        this.eventListeners = new Map();
        this.chunkSize = 256 * 1024; // 256KB chunks
        this.setupTCPServer();
    }

    setupTCPServer() {
        this.server = net.createServer((socket) => {
            let buffer = Buffer.alloc(0);

            socket.on('data', (data) => {
                buffer = Buffer.concat([buffer, data]);
                this.processIncomingData(socket, buffer);
            });

            socket.on('error', (err) => {
                console.error('TCP Socket error:', err);
            });
        });

        this.server.listen(0, () => {
            console.log('TCP Server listening on port', this.server.address().port);
        });
    }

    processIncomingData(socket, buffer) {
        while (buffer.length >= 4) {
            const messageLength = buffer.readUInt32BE(0);
            if (buffer.length < messageLength + 4) break;

            const message = JSON.parse(buffer.slice(4, 4 + messageLength));
            this.handleMessage(socket, message);
            buffer = buffer.slice(4 + messageLength);
        }
    }

    startTransfer(filePath) {
        const fileId = crypto.randomBytes(16).toString('hex');
        const fileInfo = {
            path: filePath,
            name: path.basename(filePath),
            size: fs.statSync(filePath).size,
            chunks: [],
            peers: new Set()
        };

        this.activeTransfers.set(fileId, fileInfo);
        this.splitFileIntoChunks(fileId, filePath);
        this.broadcastNewTransfer(fileId, fileInfo);
        return fileId;
    }

    splitFileIntoChunks(fileId, filePath) {
        const fileInfo = this.activeTransfers.get(fileId);
        const fileSize = fileInfo.size;
        const numChunks = Math.ceil(fileSize / this.chunkSize);

        for (let i = 0; i < numChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, fileSize);
            const chunkId = `${fileId}-${i}`;
            
            fileInfo.chunks.push({
                id: chunkId,
                index: i,
                start,
                end,
                hash: null
            });
        }

        // Calculate chunk hashes
        this.calculateChunkHashes(fileId, filePath);
    }

    async calculateChunkHashes(fileId, filePath) {
        const fileInfo = this.activeTransfers.get(fileId);
        const readStream = fs.createReadStream(filePath);

        for (const chunk of fileInfo.chunks) {
            const chunkData = await this.readChunk(readStream, chunk.start, chunk.end);
            chunk.hash = crypto.createHash('sha256').update(chunkData).digest('hex');
            this.availableChunks.set(chunk.id, {
                fileId,
                data: chunkData,
                peers: new Set()
            });
        }
    }

    readChunk(stream, start, end) {
        return new Promise((resolve, reject) => {
            const chunk = Buffer.alloc(end - start);
            stream.on('error', reject);
            stream.on('data', (data) => {
                if (data.length >= end - start) {
                    data.copy(chunk, 0, start, end);
                    resolve(chunk);
                }
            });
        });
    }

    broadcastNewTransfer(fileId, fileInfo) {
        const message = {
            type: 'NEW_TRANSFER',
            fileId,
            fileInfo: {
                name: fileInfo.name,
                size: fileInfo.size,
                numChunks: fileInfo.chunks.length
            }
        };

        this.peerDiscovery.broadcastMessage(message);
    }

    requestChunk(fileId, chunkIndex) {
        const fileInfo = this.activeTransfers.get(fileId);
        if (!fileInfo) return;

        const chunk = fileInfo.chunks[chunkIndex];
        if (!chunk) return;

        const message = {
            type: 'CHUNK_REQUEST',
            fileId,
            chunkId: chunk.id
        };

        // Find peers that have this chunk
        const availableChunk = this.availableChunks.get(chunk.id);
        if (availableChunk && availableChunk.peers.size > 0) {
            const peer = Array.from(availableChunk.peers)[0];
            this.sendMessage(peer, message);
        }
    }

    handleChunkRequest(socket, message) {
        const { fileId, chunkId } = message;
        const chunk = this.availableChunks.get(chunkId);
        
        if (chunk) {
            const response = {
                type: 'CHUNK_DATA',
                fileId,
                chunkId,
                data: chunk.data.toString('base64')
            };
            
            this.sendMessage(socket, response);
        }
    }

    receiveChunk(fileId, chunkId, data) {
        const chunk = this.availableChunks.get(chunkId);
        if (!chunk) return;

        // Verify chunk integrity
        const hash = crypto.createHash('sha256').update(Buffer.from(data, 'base64')).digest('hex');
        const fileInfo = this.activeTransfers.get(fileId);
        const chunkInfo = fileInfo.chunks.find(c => c.id === chunkId);
        
        if (hash === chunkInfo.hash) {
            chunk.data = Buffer.from(data, 'base64');
            chunk.peers.add(this.peerDiscovery.peerId);
            this.broadcastChunkAvailability(fileId, chunkId);
        }
    }

    broadcastChunkAvailability(fileId, chunkId) {
        const message = {
            type: 'CHUNK_AVAILABLE',
            fileId,
            chunkId
        };

        this.peerDiscovery.broadcastMessage(message);
    }

    sendMessage(socket, message) {
        const buffer = Buffer.from(JSON.stringify(message));
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32BE(buffer.length, 0);
        socket.write(Buffer.concat([lengthBuffer, buffer]));
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

    close() {
        if (this.server) {
            this.server.close();
        }
    }
}