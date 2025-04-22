document.addEventListener('DOMContentLoaded', () => {
    // Session timeout (30 minutes)
    const SESSION_TIMEOUT = 30 * 60 * 1000;
    let timeoutId;

    // Get the repository name from the current URL
    const pathParts = window.location.pathname.split('/');
    const repoName = pathParts.length > 1 ? pathParts[1] : '';
    const baseUrl = repoName ? `/${repoName}` : '';

    function resetSessionTimeout() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            sessionStorage.removeItem('userData');
            window.location.href = `${baseUrl}/login.html`;
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
        window.location.href = `${baseUrl}/login.html`;
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
        window.location.href = `${baseUrl}/login.html`;
    });
    
    // Add elements to container
    welcomeContainer.appendChild(welcomeMessage);
    welcomeContainer.appendChild(logoutButton);
    
    // Add container to header
    const header = document.querySelector('header');
    if (header) {
        header.appendChild(welcomeContainer);
    }

    // File Display Functionality
    const filesList = document.getElementById('filesList');
    const subjectFilter = document.getElementById('subjectFilter');
    const classFilter = document.getElementById('classFilter');
    
    let allFiles = [];
    
    // Load files
    loadFiles();
    
    // Add filter event listeners
    subjectFilter.addEventListener('change', filterFiles);
    classFilter.addEventListener('change', filterFiles);
    
    async function loadFiles() {
        try {
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading files...';
            filesList.appendChild(loadingMessage);
            
            allFiles = await FirebaseAuth.getFiles();
            updateFilters();
            displayFiles(allFiles);
        } catch (error) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = error.message;
            filesList.appendChild(errorMessage);
        }
    }
    
    function updateFilters() {
        // Get unique subjects and classes
        const subjects = new Set(allFiles.map(file => file.subject).filter(Boolean));
        const classes = new Set(allFiles.map(file => file.class).filter(Boolean));
        
        // Update subject filter
        subjectFilter.innerHTML = '<option value="">All Subjects</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectFilter.appendChild(option);
        });
        
        // Update class filter
        classFilter.innerHTML = '<option value="">All Classes</option>';
        classes.forEach(classValue => {
            const option = document.createElement('option');
            option.value = classValue;
            option.textContent = classValue;
            classFilter.appendChild(option);
        });
    }
    
    function filterFiles() {
        const selectedSubject = subjectFilter.value;
        const selectedClass = classFilter.value;
        
        const filteredFiles = allFiles.filter(file => {
            const subjectMatch = !selectedSubject || file.subject === selectedSubject;
            const classMatch = !selectedClass || file.class === selectedClass;
            return subjectMatch && classMatch;
        });
        
        displayFiles(filteredFiles);
    }
    
    function displayFiles(files) {
        filesList.innerHTML = '';
        
        if (files.length === 0) {
            const noFilesMessage = document.createElement('p');
            noFilesMessage.className = 'no-files';
            noFilesMessage.textContent = 'No files found';
            filesList.appendChild(noFilesMessage);
            return;
        }
        
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
            
            filesList.appendChild(fileCard);
        });
    }
}); 