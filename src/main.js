const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const PeerDiscovery = require('./utils/peerDiscovery');
const FileTransfer = require('./utils/fileTransfer');

let mainWindow;
let loginWindow;
let peerDiscovery;
let fileTransfer;

function createFrontWindow() {
    const frontWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    frontWindow.loadFile(path.join(__dirname, 'frontpage/front.html'));
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    loginWindow.loadFile(path.join(__dirname, 'login.html'));
}

function createPortalWindow(userData) {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Initialize P2P components
    peerDiscovery = new PeerDiscovery();
    fileTransfer = new FileTransfer(peerDiscovery);

    if (userData.role === 'teacher') {
        peerDiscovery.startAsTeacher(userData.name);
        mainWindow.loadFile(path.join(__dirname, 'teacher-portal.html'));
    } else {
        peerDiscovery.startAsStudent();
        mainWindow.loadFile(path.join(__dirname, 'student-portal.html'));
    }

    // Send user info to renderer
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('user-info', userData);
    });
}

app.whenReady().then(() => {
    createFrontWindow();

    ipcMain.on('login', (event, data) => {
        const { role, name, id, password } = data;
        
        // Simple local authentication
        if (role === 'teacher' && password === 'teacher123') {
            loginWindow.close();
            createPortalWindow({ role, name, id });
        } else if (role === 'student' && password === 'student123') {
            loginWindow.close();
            createPortalWindow({ role, name, id });
        } else {
            event.reply('login-error', 'Invalid credentials');
        }
    });

    ipcMain.on('logout', () => {
        if (mainWindow) {
            mainWindow.close();
        }
        if (peerDiscovery) {
            peerDiscovery.stop();
        }
        createLoginWindow();
    });

    ipcMain.on('shareFile', (event, filePath) => {
        if (fileTransfer) {
            const fileId = fileTransfer.startTransfer(filePath);
            event.reply('file-shared', { fileId });
        }
    });

    ipcMain.on('joinSession', (event, sessionId) => {
        if (peerDiscovery) {
            peerDiscovery.joinSession(sessionId);
        }
    });

    ipcMain.on('endSession', (event, sessionId) => {
        if (peerDiscovery) {
            peerDiscovery.endSession(sessionId);
        }
    });

    ipcMain.on('downloadFile', (event, fileId) => {
        if (fileTransfer) {
            fileTransfer.downloadFile(fileId);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createFrontWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
}); 