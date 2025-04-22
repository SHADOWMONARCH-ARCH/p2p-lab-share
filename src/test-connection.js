import P2PNetwork from './p2p/network.js';
import FileDistributor from './p2p/file-distributor.js';

async function testConnection(isTeacher) {
    console.log(`Starting as ${isTeacher ? 'teacher' : 'student'}...`);
    
    // Initialize network
    const network = new P2PNetwork();
    await network.initialize(isTeacher);
    
    // Initialize file distributor
    const fileDistributor = new FileDistributor(network);
    await fileDistributor.initialize();
    
    // Listen for peers
    network.on('peer-discovered', (peer) => {
        console.log(`Discovered ${peer.role} at ${peer.address}:${peer.port}`);
    });
    
    // If teacher, share a test file
    if (isTeacher) {
        console.log('Teacher ready. Waiting for students...');
        
        // Create a test file
        const testFile = new File(
            ['Hello from teacher! This is a test file.'],
            'test.txt',
            { type: 'text/plain' }
        );
        
        // Share the file
        const fileId = await fileDistributor.shareFile(testFile);
        console.log(`Test file shared with ID: ${fileId}`);
    } else {
        console.log('Student ready. Waiting for teacher...');
        
        // Listen for available files
        network.on('file-available', (fileInfo) => {
            console.log(`File available: ${fileInfo.name} (${fileInfo.size} bytes)`);
            
            // Download the file
            fileDistributor.downloadFile(fileInfo.fileId)
                .then(() => console.log('File downloaded successfully!'))
                .catch(error => console.error('Download failed:', error));
        });
    }
}

// Check command line arguments
const isTeacher = process.argv.includes('--teacher');
testConnection(isTeacher).catch(console.error); 