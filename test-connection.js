const WebSocket = require('ws');

// Test WebSocket connection
async function testWebSocket() {
    console.log('Testing WebSocket connection...');
    const ws = new WebSocket('ws://localhost:3000');

    ws.on('open', () => {
        console.log('WebSocket connection established');
        ws.send(JSON.stringify({
            type: 'create-session',
            userType: 'teacher'
        }));
    });

    ws.on('message', (data) => {
        const message = JSON.parse(data);
        console.log('Received message:', message);
        
        if (message.type === 'session-created') {
            console.log('Session created successfully');
            console.log('Session ID:', message.sessionId);
            process.exit(0);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        process.exit(1);
    });
}

// Run tests
console.log('Starting connection tests...');
testWebSocket(); 