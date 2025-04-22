class FileDistributor {
    constructor(network) {
        this.network = network;
        this.chunkSize = 64 * 1024; // 64KB chunks
        this.files = new Map();
        this.chunks = new Map();
        this.downloads = new Map();
        this.peerStats = new Map();
        this.encryptionKey = null;
    }

    async initialize() {
        // Generate encryption key for file chunks
        this.encryptionKey = await crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async shareFile(file) {
        const fileId = this.generateFileId(file);
        const chunks = await this.chunkFile(file);
        
        this.files.set(fileId, {
            name: file.name,
            size: file.size,
            type: file.type,
            totalChunks: chunks.length,
            chunks: new Set(),
            priority: new Map() // Track chunk priorities
        });

        // Store encrypted chunks
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const encryptedChunk = await this.encryptChunk(chunk);
            const chunkId = `${fileId}-${i}`;
            this.chunks.set(chunkId, encryptedChunk);
            this.files.get(fileId).chunks.add(i);
            this.files.get(fileId).priority.set(i, 0); // Initialize priority
        }

        // Broadcast file availability
        this.broadcastFileAvailability(fileId);

        return fileId;
    }

    async encryptChunk(chunk) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.encryptionKey,
            chunk
        );

        return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encryptedData))
        };
    }

    async decryptChunk(encryptedChunk) {
        const iv = new Uint8Array(encryptedChunk.iv);
        const data = new Uint8Array(encryptedChunk.data);
        
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.encryptionKey,
            data
        );

        return decryptedData;
    }

    async chunkFile(file) {
        const chunks = [];
        let offset = 0;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + this.chunkSize);
            chunks.push(chunk);
            offset += this.chunkSize;
        }

        return chunks;
    }

    generateFileId(file) {
        return `${file.name}-${file.size}-${Date.now()}`;
    }

    broadcastFileAvailability(fileId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        const message = {
            type: 'file-available',
            fileId,
            name: fileInfo.name,
            size: fileInfo.size,
            type: fileInfo.type,
            totalChunks: fileInfo.totalChunks
        };

        this.network.broadcast(message);
    }

    updatePeerStats(peerId, success) {
        if (!this.peerStats.has(peerId)) {
            this.peerStats.set(peerId, {
                requests: 0,
                successes: 0,
                failures: 0,
                lastSeen: Date.now()
            });
        }

        const stats = this.peerStats.get(peerId);
        stats.requests++;
        if (success) {
            stats.successes++;
        } else {
            stats.failures++;
        }
        stats.lastSeen = Date.now();
    }

    getBestPeers(fileId, chunkIndex) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return [];

        const peers = Array.from(this.network.getPeers());
        return peers
            .filter(peer => {
                const stats = this.peerStats.get(`${peer.address}:${peer.port}`);
                return stats && stats.successes / stats.requests > 0.8;
            })
            .sort((a, b) => {
                const statsA = this.peerStats.get(`${a.address}:${a.port}`);
                const statsB = this.peerStats.get(`${b.address}:${b.port}`);
                return (statsB.successes / statsB.requests) - (statsA.successes / statsA.requests);
            });
    }

    async handleFileChunk(address, port, message) {
        const { fileId, chunkIndex, data } = message;
        
        if (!this.downloads.has(fileId)) {
            return;
        }

        try {
            const decryptedData = await this.decryptChunk(data);
            const download = this.downloads.get(fileId);
            download.receivedChunks.add(chunkIndex);
            download.chunks[chunkIndex] = decryptedData;

            // Update peer stats
            this.updatePeerStats(`${address}:${port}`, true);

            if (download.receivedChunks.size === download.totalChunks) {
                this.assembleFile(fileId);
            }
        } catch (error) {
            console.error('Error decrypting chunk:', error);
            this.updatePeerStats(`${address}:${port}`, false);
        }
    }

    async handleChunkRequest(address, port, message) {
        const { fileId, chunkIndex } = message;
        
        if (!this.chunks.has(`${fileId}-${chunkIndex}`)) {
            return;
        }

        const chunk = this.chunks.get(`${fileId}-${chunkIndex}`);
        const response = {
            type: 'file-chunk',
            fileId,
            chunkIndex,
            data: chunk
        };

        this.network.sendToPeer(address, port, response);
    }

    updateChunkPriority(fileId, chunkIndex, priority) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        fileInfo.priority.set(chunkIndex, priority);
    }

    getNextChunkToRequest(fileId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return null;

        const download = this.downloads.get(fileId);
        if (!download) return null;

        // Find missing chunks
        const missingChunks = [];
        for (let i = 0; i < fileInfo.totalChunks; i++) {
            if (!download.receivedChunks.has(i)) {
                missingChunks.push({
                    index: i,
                    priority: fileInfo.priority.get(i) || 0
                });
            }
        }

        // Sort by priority and return highest priority chunk
        return missingChunks.sort((a, b) => b.priority - a.priority)[0]?.index;
    }

    async downloadFile(fileId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) {
            throw new Error('File not found');
        }

        this.downloads.set(fileId, {
            totalChunks: fileInfo.totalChunks,
            receivedChunks: new Set(),
            chunks: []
        });

        // Initialize chunk priorities
        for (let i = 0; i < fileInfo.totalChunks; i++) {
            // Prioritize chunks based on position (start and end chunks first)
            const priority = Math.min(i, fileInfo.totalChunks - 1 - i);
            this.updateChunkPriority(fileId, i, priority);
        }

        // Start download process
        const downloadInterval = setInterval(async () => {
            const nextChunk = this.getNextChunkToRequest(fileId);
            if (nextChunk === null) {
                clearInterval(downloadInterval);
                return;
            }

            const message = {
                type: 'chunk-request',
                fileId,
                chunkIndex: nextChunk
            };

            const bestPeers = this.getBestPeers(fileId, nextChunk);
            if (bestPeers.length > 0) {
                // Send request to best peer
                const peer = bestPeers[0];
                this.network.sendToPeer(peer.address, peer.port, message);
            } else {
                // Fallback to broadcast if no good peers
                this.network.broadcast(message);
            }
        }, 100); // Request chunks every 100ms

        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const download = this.downloads.get(fileId);
                if (download.receivedChunks.size === download.totalChunks) {
                    clearInterval(downloadInterval);
                    clearInterval(checkInterval);
                    resolve(this.assembleFile(fileId));
                }
            }, 1000);

            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(downloadInterval);
                clearInterval(checkInterval);
                reject(new Error('Download timeout'));
            }, 5 * 60 * 1000);
        });
    }

    async assembleFile(fileId) {
        const download = this.downloads.get(fileId);
        const fileInfo = this.files.get(fileId);

        // Create blob from chunks
        const blob = new Blob(download.chunks, { type: fileInfo.type });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Cleanup
        this.downloads.delete(fileId);

        return blob;
    }

    cleanup() {
        this.files.clear();
        this.chunks.clear();
        this.downloads.clear();
        this.peerStats.clear();
    }
}

export default FileDistributor; 