document.addEventListener('DOMContentLoaded', () => {
    // Session timeout (30 minutes)
    const SESSION_TIMEOUT = 30 * 60 * 1000;
    let timeoutId;

    function resetSessionTimeout() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            sessionStorage.removeItem('userData');
            window.location.href = 'login.html';
        }, SESSION_TIMEOUT);
    }

    // Reset timeout on user activity
    document.addEventListener('mousemove', resetSessionTimeout);
    document.addEventListener('keypress', resetSessionTimeout);
    document.addEventListener('click', resetSessionTimeout);

    // Initial timeout setup
    resetSessionTimeout();

    // Get user data from sessionStorage
    const userData = JSON.parse(sessionStorage.getItem('userData'));
    
    if (!userData) {
        // Redirect to login if no user data found
        window.location.href = 'login.html';
        return;
    }
    
    // Create welcome message container
    const welcomeContainer = document.createElement('div');
    welcomeContainer.className = 'welcome-container';
    
    // Create welcome message
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'welcome-message';
    welcomeMessage.innerHTML = `
        <span class="welcome-text">Welcome,</span>
        <span class="user-name">${userData.name}</span>
    `;
    
    // Create logout button
    const logoutButton = document.createElement('button');
    logoutButton.className = 'logout-button';
    logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('userData');
        window.location.href = 'login.html';
    });
    
    // Add elements to container
    welcomeContainer.appendChild(welcomeMessage);
    welcomeContainer.appendChild(logoutButton);
    
    // Add container to header
    const header = document.querySelector('header');
    if (header) {
        header.appendChild(welcomeContainer);
    }

    // File Upload Functionality
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const filesList = document.getElementById('filesList');

    // Load existing files
    loadFiles();

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) return;
        
        const description = document.getElementById('fileDescription').value;
        const subject = document.getElementById('subject').value;
        const classValue = document.getElementById('class').value;
        
        try {
            const uploadBtn = uploadForm.querySelector('.upload-btn');
            uploadBtn.classList.add('loading');
            
            await FirebaseAuth.uploadFile(file, {
                uploadedBy: userData.email,
                uploadedByName: userData.name,
                description,
                subject,
                class: classValue
            });
            
            uploadBtn.classList.add('success');
            uploadForm.reset();
            
            // Reload files list
            loadFiles();
            
            setTimeout(() => {
                uploadBtn.classList.remove('success', 'loading');
            }, 2000);
        } catch (error) {
            alert(error.message);
            uploadBtn.classList.remove('loading');
        }
    });

    async function loadFiles() {
        try {
            const files = await FirebaseAuth.getFiles();
            displayFiles(files);
        } catch (error) {
            alert(error.message);
        }
    }

    function displayFiles(files) {
        filesList.innerHTML = '';
        
        files.forEach(file => {
            const fileCard = document.createElement('div');
            fileCard.className = 'file-card';
            
            fileCard.innerHTML = `
                <div class="file-header">
                    <span class="file-name">${file.name}</span>
                    <div class="file-actions">
                        <a href="${file.downloadURL}" class="download-btn" download>
                            <i class="fas fa-download"></i>
                            Download
                        </a>
                        <button class="delete-btn" data-file-id="${file.id}">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
                <div class="file-meta">
                    <p>Uploaded by: ${file.uploadedByName}</p>
                    <p>Subject: ${file.subject || 'N/A'}</p>
                    <p>Class: ${file.class || 'N/A'}</p>
                    <p>Description: ${file.description || 'No description'}</p>
                    <p>Uploaded: ${new Date(file.uploadedAt).toLocaleString()}</p>
                </div>
            `;
            
            // Add delete event listener
            const deleteBtn = fileCard.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this file?')) {
                    try {
                        await FirebaseAuth.deleteFile(file.id);
                        fileCard.remove();
                    } catch (error) {
                        alert(error.message);
                    }
                }
            });
            
            filesList.appendChild(fileCard);
        });
    }
});