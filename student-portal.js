document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const logoutBtn = document.getElementById('logoutBtn');
    const sessionList = document.getElementById('sessionList');
    const networkStatus = document.getElementById('networkStatus');
    const sessionStatus = document.getElementById('sessionStatus');
    const connectionStatus = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const fileList = document.getElementById('fileList');
    const studentName = document.getElementById('studentName');

    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-button">&times;</span>
            <div class="file-preview"></div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close modal when clicking the close button or outside the modal
    const closeBtn = modal.querySelector('.close-button');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Initialize student name
    const currentStudent = localStorage.getItem('currentStudent') || 'Student';
    studentName.textContent = currentStudent;

    // Debug info
    console.log('Current student:', currentStudent);
    console.log('Active sessions:', JSON.parse(localStorage.getItem('activeSessions') || '[]'));

    // Initialize received files from localStorage
    function initializeReceivedFiles() {
        const receivedFiles = JSON.parse(localStorage.getItem('receivedFiles-' + currentStudent) || '[]');
        updateReceivedFilesList(receivedFiles);
    }

    function updateReceivedFilesList(files) {
        if (files.length === 0) {
            fileList.innerHTML = '<p>No files received yet.</p>';
            return;
        }

        fileList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <div>
                        <strong>${file.name}</strong>
                        <p class="text-muted">From: ${file.session}</p>
                        <p class="text-muted">Downloaded: ${file.downloadDate}</p>
                    </div>
                    <span class="file-size">${file.size}</span>
                </div>
                <div class="file-actions">
                    <button class="button" onclick="openFile('${file.id}')">Open</button>
                    <button class="button secondary" onclick="deleteFile('${file.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Session Management
    function updateSessions() {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        console.log('Checking for sessions:', sessions);

        sessionList.innerHTML = '';
        if (sessions.length === 0) {
            sessionList.innerHTML = '<p>No active sessions available. Please wait for a teacher to start a session.</p>';
        } else {
            sessions.forEach(session => {
                const sessionItem = createSessionElement(session);
                sessionList.appendChild(sessionItem);
            });
        }

        updateNetworkStatus('Connected to network', true);
    }

    function createSessionElement(session) {
        const div = document.createElement('div');
        div.className = 'session-item';
        div.innerHTML = `
            <div>
                <strong>${session.name}</strong>
                <p>Teacher: ${session.teacher || 'Unknown'}</p>
                <p>${session.students ? session.students.length : 0} students connected</p>
            </div>
            <button class="button" onclick="joinSession('${session.id}')">
                Join Session
            </button>
        `;
        return div;
    }

    // Join session functionality
    window.joinSession = function(sessionId) {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        const session = sessions.find(s => s.id === sessionId);
        
        if (!session) {
            alert('Session not found');
            return;
        }

        const buttons = document.querySelectorAll('.session-item button');
        buttons.forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.5';
        });

        sessionStatus.style.display = 'block';
        connectionStatus.className = 'status-indicator';
        statusText.textContent = 'Connecting to session...';

        // Add student to session
        if (!session.students) {
            session.students = [];
        }
        if (!session.students.find(s => s.name === currentStudent)) {
            session.students.push({
                name: currentStudent,
                online: true
            });
            localStorage.setItem('activeSessions', JSON.stringify(sessions));
        }

        // Simulate connection delay
        setTimeout(() => {
            connectionStatus.className = 'status-indicator connected';
            statusText.textContent = 'Connected to session';
            updateNetworkStatus('Connected to session', true);

            // Show connected state for a moment before showing file list
            setTimeout(() => {
                sessionStatus.style.display = 'none';
                showFileList(sessionId);
            }, 1000);
        }, 1500);
    };

    function showFileList(sessionId) {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        const session = sessions.find(s => s.id === sessionId);
        const files = session?.files || [];

        sessionList.innerHTML = `
            <div class="file-transfer">
                <h3>Available Files in ${session.name}</h3>
                <div class="file-list">
                    ${files.length === 0 ? 
                        '<p>No files available in this session yet.</p>' :
                        files.map(file => `
                            <div class="file-item">
                                <div class="file-info">
                                    <span>${file.name}</span>
                                    <span class="file-size">${file.size}</span>
                                </div>
                                <button class="button" onclick="downloadFile('${file.id}', '${session.name}', '${file.name}', '${file.size}')">
                                    Download
                                </button>
                            </div>
                        `).join('')
                    }
                </div>
                <button class="button secondary" onclick="leaveSession('${sessionId}')">Leave Session</button>
            </div>
        `;
    }

    // Download file functionality
    window.downloadFile = function(fileId, sessionName, fileName, fileSize, event) {
        event.preventDefault();
        
        const fileItem = event.target.parentNode;
        const progressDiv = document.createElement('div');
        progressDiv.className = 'progress-container';
        progressDiv.innerHTML = `
            <div class="progress-bar">
                <div class="progress" style="width: 0%"></div>
            </div>
            <span class="progress-text">0%</span>
        `;
        fileItem.appendChild(progressDiv);

        let progress = 0;
        const progressBar = progressDiv.querySelector('.progress');
        const progressText = progressDiv.querySelector('.progress-text');

        // Create some sample data for testing
        const sampleData = new Uint8Array([80, 68, 70]); // Sample PDF header bytes
        
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                progressText.style.color = '#28a745';
                progressText.textContent = 'Complete';
                
                // Create a Blob and trigger download
                const blob = new Blob([sampleData], { type: getMimeType(fileName) });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                // Add to received files
                const receivedFiles = JSON.parse(localStorage.getItem('receivedFiles-' + currentStudent) || '[]');
                const file = {
                    id: fileId,
                    name: fileName,
                    size: fileSize,
                    session: sessionName,
                    downloadDate: new Date().toLocaleString(),
                    data: Array.from(sampleData) // Store the data for later use
                };
                receivedFiles.push(file);
                localStorage.setItem('receivedFiles-' + currentStudent, JSON.stringify(receivedFiles));
                updateReceivedFilesList(receivedFiles);

                setTimeout(() => {
                    progressDiv.remove();
                }, 1000);
            }
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }, 200);
    };

    // File management
    window.openFile = function(fileId) {
        const receivedFiles = JSON.parse(localStorage.getItem('receivedFiles-' + currentStudent) || '[]');
        const file = receivedFiles.find(f => f.id === fileId);
        if (file) {
            const filePreview = modal.querySelector('.file-preview');
            const fileExtension = file.name.split('.').pop().toLowerCase();
            
            // Clear previous content
            filePreview.innerHTML = '';
            
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension)) {
                // Handle image files
                const img = document.createElement('img');
                img.src = file.url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
                img.alt = file.name;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.backgroundColor = '#f0f0f0';
                img.style.padding = '20px';
                filePreview.appendChild(img);
                
                // Add file name below image
                const fileName = document.createElement('p');
                fileName.textContent = file.name;
                fileName.style.textAlign = 'center';
                fileName.style.marginTop = '10px';
                filePreview.appendChild(fileName);
            } else {
                // Handle other file types with direct download
                filePreview.innerHTML = `
                    <div class="unsupported-file">
                        <i class="file-icon">📄</i>
                        <p>Preview not available for ${file.name}</p>
                        <p class="text-muted">File type: ${fileExtension}</p>
                        <button class="button" onclick="handleDownload('${fileId}')">
                            Download File
                        </button>
                    </div>
                `;
            }
            
            // Show modal
            modal.style.display = 'block';
        }
    };

    // Handle file download
    window.handleDownload = function(fileId) {
        const receivedFiles = JSON.parse(localStorage.getItem('receivedFiles-' + currentStudent) || '[]');
        const file = receivedFiles.find(f => f.id === fileId);
        
        if (file) {
            // Create a blob and trigger download
            const blob = new Blob([new Uint8Array(file.data || [])], { type: getMimeType(file.name) });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            alert('File not found');
        }
    };

    // Helper function to get MIME type
    function getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'txt': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    window.deleteFile = function(fileId) {
        const receivedFiles = JSON.parse(localStorage.getItem('receivedFiles-' + currentStudent) || '[]');
        const updatedFiles = receivedFiles.filter(f => f.id !== fileId);
        localStorage.setItem('receivedFiles-' + currentStudent, JSON.stringify(updatedFiles));
        updateReceivedFilesList(updatedFiles);
    };

    // Leave session functionality
    window.leaveSession = function(sessionId) {
        if (sessionId) {
            const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
            const sessionIndex = sessions.findIndex(s => s.id === sessionId);
            
            if (sessionIndex !== -1) {
                // Remove student from session
                const studentIndex = sessions[sessionIndex].students.findIndex(s => s.name === currentStudent);
                if (studentIndex !== -1) {
                    sessions[sessionIndex].students.splice(studentIndex, 1);
                    localStorage.setItem('activeSessions', JSON.stringify(sessions));
                }
            }
        }

        updateSessions();
        updateNetworkStatus('Disconnected from session', false);
        setTimeout(() => {
            updateNetworkStatus('Connected to network', true);
        }, 1000);
    };

    // Network Status
    function updateNetworkStatus(message, isConnected) {
        networkStatus.textContent = message;
        networkStatus.className = 'status-message ' + (isConnected ? 'connected' : 'error');
    }

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentStudent');
        window.location.href = '/login.html';
    });

    // Initialize
    updateSessions();
    initializeReceivedFiles();

    // Check for new sessions every 5 seconds
    setInterval(updateSessions, 5000);
});

// Add this CSS to your stylesheet
const style = document.createElement('style');
style.textContent = `
    .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
    }

    .modal-content {
        position: relative;
        background-color: #fefefe;
        margin: 5% auto;
        padding: 20px;
        border-radius: 8px;
        width: 80%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
    }

    .close-button {
        position: absolute;
        right: 20px;
        top: 10px;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        color: #666;
    }

    .close-button:hover {
        color: #000;
    }

    .file-preview {
        margin-top: 20px;
    }

    .text-preview {
        background-color: #f5f5f5;
        padding: 15px;
        border-radius: 4px;
        white-space: pre-wrap;
        font-family: monospace;
    }

    .unsupported-file {
        text-align: center;
        padding: 40px 20px;
    }

    .file-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 20px;
    }

    .text-muted {
        color: #666;
    }
`;
document.head.appendChild(style); 