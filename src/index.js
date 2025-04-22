import P2PNetwork from './p2p/network.js';
import FileDistributor from './p2p/file-distributor.js';
import { createInterface } from 'readline';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

async function readFileAsBlob(filePath) {
    try {
        const absolutePath = resolve(process.cwd(), filePath);
        const buffer = await readFile(absolutePath);
        const fileName = filePath.split(/[\\/]/).pop(); // Works for both Windows and Unix paths
        return new File([buffer], fileName);
    } catch (error) {
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

async function main() {
    const isTeacher = process.argv.includes('--teacher');
    
    console.log('=== P2P Lab Share ===');
    console.log(`Starting as ${isTeacher ? 'teacher' : 'student'}...\n`);
    
    try {
        // Initialize network
        const network = new P2PNetwork();
        await network.initialize(isTeacher);
        
        // Initialize file distributor
        const fileDistributor = new FileDistributor(network);
        await fileDistributor.initialize();
        
        // Listen for peers
        network.on('peer-discovered', (peer) => {
            console.log(`\nDiscovered ${peer.role} at ${peer.address}:${peer.port}`);
        });
        
        if (isTeacher) {
            console.log('Teacher mode activated');
            console.log('Commands:');
            console.log('- share <filepath>: Share a file');
            console.log('- exit: Quit the application\n');
            
            while (true) {
                const input = await new Promise(resolve => rl.question('> ', resolve));
                const [command, ...args] = input.split(' ');
                
                switch (command) {
                    case 'share':
                        try {
                            const filePath = args[0];
                            if (!filePath) {
                                console.log('Please provide a file path');
                                continue;
                            }
                            
                            const file = await readFileAsBlob(filePath);
                            const fileId = await fileDistributor.shareFile(file);
                            console.log(`File shared with ID: ${fileId}`);
                        } catch (error) {
                            console.error('Error sharing file:', error);
                        }
                        break;
                        
                    case 'exit':
                        console.log('Exiting...');
                        process.exit(0);
                        break;
                        
                    default:
                        console.log('Unknown command');
                }
            }
        } else {
            console.log('Student mode activated');
            console.log('Waiting for files from teacher...\n');
            
            network.on('file-available', async (fileInfo) => {
                console.log(`\nNew file available: ${fileInfo.name} (${fileInfo.size} bytes)`);
                console.log('Downloading...');
                
                try {
                    await fileDistributor.downloadFile(fileInfo.fileId);
                    console.log('File downloaded successfully!');
                } catch (error) {
                    console.error('Download failed:', error);
                }
            });
            
            // Keep the process running
            await new Promise(() => {});
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main().catch(console.error); 