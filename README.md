# P2P Lab Share

A decentralized, peer-to-peer file sharing system for lab sessions. Allows teachers to distribute files to students over the same network or across different devices.

## Features

- Cross-device P2P file sharing
- Real-time file transfer
- Encrypted communication
- No central server dependency
- Simple and intuitive interface

## Deployment

### Option 1: Deploy to Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy the project:
```bash
vercel
```

4. Set environment variables in Vercel dashboard:
```
WS_URL=wss://your-vercel-url.vercel.app
```

### Option 2: Local Deployment

1. Install dependencies:
```bash
npm install
```

2. Generate SSL certificates (for HTTPS):
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

3. Start the server:
```bash
npm start
```

## Usage

1. Teacher:
   - Open the teacher portal
   - Create a new session
   - Share files with students

2. Student:
   - Open the student portal
   - Join the teacher's session
   - Receive and download files

## Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/p2p-lab-share.git
cd p2p-lab-share
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

## Security

- All communications are encrypted
- Files are transferred in encrypted chunks
- No central server storage
- Secure WebRTC connections

## License

MIT License - See LICENSE file for details
