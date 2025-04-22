# P2P Lab Share

A decentralized, serverless, peer-to-peer file sharing system for lab sessions. Allows teachers to distribute files to students over the same local network without requiring a central server or internet connection.

## Features

- Fully decentralized P2P architecture
- Automatic peer discovery
- Encrypted file transfer
- Cross-platform support (Windows, macOS, Linux)
- No internet dependency
- Simple command-line interface

## Prerequisites

- Node.js 18+ installed
- Both teacher and student devices must be on the same local network
- UDP multicast must be enabled on the network

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/p2p-lab-share.git
cd p2p-lab-share
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Teacher Mode

1. Start the application in teacher mode:
```bash
npm run start:teacher
```

2. Share a file:
```
> share path/to/your/file
```

File path examples:
- Windows: `share C:\Users\Teacher\Documents\file.txt`
- macOS/Linux: `share /home/teacher/Documents/file.txt`
- Relative path: `share ./files/file.txt`

### Student Mode

1. Start the application in student mode:
```bash
npm run start:student
```

2. The application will automatically:
   - Discover the teacher
   - Receive available files
   - Download and save them

## Network Requirements

- Both teacher and student devices must be on the same local network
- UDP multicast must be enabled (port 1900)
- No firewall blocking UDP communication

### Enabling UDP Multicast

#### Windows:
1. Open Windows Defender Firewall
2. Go to Advanced Settings
3. Add an inbound rule for UDP port 1900
4. Add an outbound rule for UDP port 1900

#### macOS:
```bash
sudo pfctl -e
sudo pfctl -f /etc/pf.conf
```

#### Linux:
```bash
sudo iptables -A INPUT -p udp --dport 1900 -j ACCEPT
sudo iptables -A OUTPUT -p udp --dport 1900 -j ACCEPT
```

## Troubleshooting

1. **Cannot discover peers**:
   - Verify both devices are on the same network
   - Check firewall settings
   - Ensure UDP multicast is enabled
   - Try running with administrator/root privileges

2. **File transfer fails**:
   - Check network connectivity
   - Verify file permissions
   - Ensure enough disk space
   - Check if antivirus is blocking the transfer

3. **Connection issues**:
   - Try restarting the application
   - Check network settings
   - Verify no antivirus is blocking the connection
   - Ensure both devices are using the same version of the application

## Security

- All communications are encrypted
- Files are transferred in encrypted chunks
- Teacher authentication is required
- No central server or third-party services

## Development

To contribute to the project:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details
