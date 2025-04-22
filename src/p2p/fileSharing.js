class FileSharing {
    constructor(p2pCore) {
        this.p2pCore = p2pCore;
        this.files = new Map();
        this.chunkSize = 64 * 1024; // 64KB chunks
    }

    async shareFile(file) {
        const fileId = this.generateFileId(file);
        const chunks = await this.splitFileIntoChunks(file);
        
        this.files.set(fileId, {
            file,
            chunks,
            peers: new Map(),
            chunkStatus: new Array(chunks.length).fill(false)
        });

        // Start distributing chunks
        this.startChunkDistribution(fileId);
    }

    async splitFileIntoChunks(file) {
        const chunks = [];
        const totalChunks = Math.ceil(file.size / this.chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);
            chunks.push(chunk);
        }
        
        return chunks;
    }

    startChunkDistribution(fileId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        // Teacher starts distributing chunks
        if (this.p2pCore.isTeacher) {
            this.distributeInitialChunks(fileId);
        }

        // Start requesting missing chunks
        this.requestMissingChunks(fileId);
    }

    async distributeInitialChunks(fileId) {
        const fileInfo = this.files.get(fileId);
        const peers = Array.from(this.p2pCore.peers.keys());

        // Distribute chunks to initial peers
        for (let i = 0; i < fileInfo.chunks.length; i++) {
            const peerIndex = i % peers.length;
            const peerId = peers[peerIndex];
            
            await this.sendChunk(fileId, i, peerId);
        }
    }

    async requestMissingChunks(fileId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        // Find peers that have the chunks we need
        const missingChunks = fileInfo.chunkStatus
            .map((hasChunk, index) => !hasChunk ? index : null)
            .filter(index => index !== null);

        for (const chunkIndex of missingChunks) {
            // Find peers that have this chunk
            const peersWithChunk = Array.from(fileInfo.peers.entries())
                .filter(([_, chunks]) => chunks.includes(chunkIndex))
                .map(([peerId]) => peerId);

            if (peersWithChunk.length > 0) {
                // Request chunk from a random peer that has it
                const randomPeer = peersWithChunk[Math.floor(Math.random() * peersWithChunk.length)];
                this.requestChunk(fileId, chunkIndex, randomPeer);
            }
        }
    }

    async sendChunk(fileId, chunkIndex, peerId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        const chunk = fileInfo.chunks[chunkIndex];
        const chunkData = await this.readChunk(chunk);

        this.p2pCore.sendToPeer(peerId, {
            type: 'file-chunk',
            fileId,
            chunkIndex,
            data: chunkData
        });

        // Update peer's chunk status
        if (!fileInfo.peers.has(peerId)) {
            fileInfo.peers.set(peerId, []);
        }
        fileInfo.peers.get(peerId).push(chunkIndex);
    }

    requestChunk(fileId, chunkIndex, peerId) {
        this.p2pCore.sendToPeer(peerId, {
            type: 'chunk-request',
            fileId,
            chunkIndex
        });
    }

    async handleChunkRequest(data) {
        const { fileId, chunkIndex, peerId } = data;
        await this.sendChunk(fileId, chunkIndex, peerId);
    }

    async handleReceivedChunk(data) {
        const { fileId, chunkIndex, data: chunkData } = data;
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        // Store the chunk
        fileInfo.chunks[chunkIndex] = chunkData;
        fileInfo.chunkStatus[chunkIndex] = true;

        // If we have all chunks, reconstruct the file
        if (fileInfo.chunkStatus.every(Boolean)) {
            await this.reconstructFile(fileId);
        }
    }

    async reconstructFile(fileId) {
        const fileInfo = this.files.get(fileId);
        if (!fileInfo) return;

        const blob = new Blob(fileInfo.chunks, { type: fileInfo.file.type });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.file.name;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    generateFileId(file) {
        return `${file.name}-${file.size}-${Date.now()}`;
    }

    async readChunk(chunk) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(chunk);
        });
    }
}

export default FileSharing; 