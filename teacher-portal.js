document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileProgress = document.getElementById('fileProgress');
    const logoutBtn = document.getElementById('logoutBtn');
    const startSessionBtn = document.getElementById('startSessionBtn');
    const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
    const sessionList = document.getElementById('sessionList');
    const networkStatus = document.getElementById('networkStatus');
    const teacherName = document.getElementById('teacherName');

    // Initialize teacher name from login
    const currentTeacher = localStorage.getItem('currentTeacher') || 'Teacher';
    teacherName.textContent = currentTeacher;

    // File Upload Handling
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '#f0f4ff';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.backgroundColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        // Check if there's an active session
        const currentSession = getCurrentSession();
        if (!currentSession) {
            alert('Please start a session before uploading files');
            return;
        }

        Array.from(files).forEach((file, index) => {
            // Create progress container for this file
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            progressContainer.id = `progress-${index}`;
            
            progressContainer.innerHTML = `
                <div class="file-info">
                    <span>${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: 0%"></div>
                </div>
                <span class="progress-text">0%</span>
            `;
            
            fileProgress.appendChild(progressContainer);

            // Add file to current session
            addFileToSession(file);

            // Simulate file upload
            simulateFileUpload(index, file);
        });
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function simulateFileUpload(index, file) {
        let progress = 0;
        const progressBar = document.querySelector(`#progress-${index} .progress`);
        const progressText = document.querySelector(`#progress-${index} .progress-text`);

        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                progressText.style.color = '#28a745';
                progressText.textContent = 'Complete';
                setTimeout(() => {
                    progressBar.parentElement.remove();
                }, 1000);
            }
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }, 200);
    }

    // Session Management
    function getCurrentSession() {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        return sessions.find(s => s.teacher === currentTeacher);
    }

    function addFileToSession(file) {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        const currentSession = sessions.find(s => s.teacher === currentTeacher);
        
        if (currentSession) {
            if (!currentSession.files) {
                currentSession.files = [];
            }
            currentSession.files.push({
                id: 'file-' + Date.now(),
                name: file.name,
                size: formatFileSize(file.size)
            });
            localStorage.setItem('activeSessions', JSON.stringify(sessions));
            updateSessions(); // Refresh the session display
        }
    }

    startSessionBtn.addEventListener('click', () => {
        // Check if teacher already has an active session
        const existingSession = getCurrentSession();
        if (existingSession) {
            alert('You already have an active session. Please end it before starting a new one.');
            return;
        }

        const sessionId = 'session-' + Date.now();
        const newSession = {
            id: sessionId,
            name: 'Lab Session - ' + new Date().toLocaleTimeString(),
            teacher: currentTeacher,
            students: [],
            files: []
        };

        // Save to localStorage
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        sessions.push(newSession);
        localStorage.setItem('activeSessions', JSON.stringify(sessions));

        updateSessions();
        updateNetworkStatus('Session started successfully', true);
    });

    refreshSessionsBtn.addEventListener('click', () => {
        updateSessions();
        updateNetworkStatus('Sessions refreshed', true);
    });

    function updateSessions() {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        const teacherSessions = sessions.filter(s => s.teacher === currentTeacher);
        
        sessionList.innerHTML = '';
        if (teacherSessions.length === 0) {
            sessionList.innerHTML = '<p>No active sessions. Click "Start New Session" to begin.</p>';
        } else {
            teacherSessions.forEach(session => {
                const sessionItem = createSessionElement(session);
                sessionList.appendChild(sessionItem);
            });
        }
    }

    function createSessionElement(session) {
        const div = document.createElement('div');
        div.className = 'session-item';
        div.innerHTML = `
            <div>
                <strong>Session: ${session.name}</strong>
                <p>${session.students.length} students connected</p>
                <div class="session-info">
                    <div class="student-list">
                        ${session.students.map(student => `
                            <div class="student-item">
                                <div class="status-indicator ${student.online ? '' : 'offline'}"></div>
                                <span>${student.name}</span>
                            </div>
                        `).join('') || '<p>No students connected</p>'}
                    </div>
                    ${session.files && session.files.length > 0 ? `
                        <div class="files-list">
                            <h4>Shared Files:</h4>
                            ${session.files.map(file => `
                                <div class="file-item">
                                    <span>${file.name}</span>
                                    <span class="file-size">${file.size}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            <button class="button" onclick="endSession('${session.id}')">
                End Session
            </button>
        `;
        return div;
    }

    // End session functionality
    window.endSession = function(sessionId) {
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem('activeSessions', JSON.stringify(updatedSessions));
        updateSessions();
        updateNetworkStatus('Session ended', true);
    };

    // Network Status
    function updateNetworkStatus(message, isConnected) {
        networkStatus.textContent = message;
        networkStatus.className = 'status-message ' + (isConnected ? 'connected' : 'error');
    }

    // Logout
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentTeacher');
        window.location.href = '/login.html';
    });

    // Initialize
    updateSessions();
    updateNetworkStatus('Connected to network', true);

    // Debug info
    console.log('Current teacher:', currentTeacher);
    console.log('Active sessions:', JSON.parse(localStorage.getItem('activeSessions') || '[]'));
}); 