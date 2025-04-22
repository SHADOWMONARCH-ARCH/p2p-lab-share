document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginContainer = document.getElementById('loginContainer');
    const teacherPortal = document.getElementById('teacherPortal');
    const studentPortal = document.getElementById('studentPortal');
    const teacherBtn = document.getElementById('teacherBtn');
    const studentBtn = document.getElementById('studentBtn');
    const togglePassword = document.getElementById('togglePassword');
    const password = document.getElementById('password');
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const successMessage = document.getElementById('successMessage');
    const teacherLogout = document.getElementById('teacherLogout');
    const studentLogout = document.getElementById('studentLogout');
    
    // Forgot Password Elements
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeModal = document.getElementById('closeModal');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const resetButton = document.getElementById('resetButton');
    const resetSuccessMessage = document.getElementById('resetSuccessMessage');
    
    // Help Feature Elements
    const helpButton = document.getElementById('helpButton');
    const helpModal = document.getElementById('helpModal');
    const closeHelpModal = document.getElementById('closeHelpModal');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const faqItems = document.querySelectorAll('.faq-item');
    const supportForm = document.getElementById('supportForm');
    const supportSuccessMessage = document.getElementById('supportSuccessMessage');
    
    let currentPortal = 'teacher'; // Default to teacher portal

    // Create error message div if it doesn't exist
    let errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.className = 'error-message';
        loginForm.insertBefore(errorDiv, loginForm.firstChild);
    }

    // Toggle between Teacher and Student
    teacherBtn.addEventListener('click', function() {
        setActivePortal('teacher');
    });

    studentBtn.addEventListener('click', function() {
        setActivePortal('student');
    });

    function setActivePortal(portal) {
        currentPortal = portal;
        if (portal === 'teacher') {
            teacherBtn.classList.add('active');
            studentBtn.classList.remove('active');
        } else {
            teacherBtn.classList.remove('active');
            studentBtn.classList.add('active');
        }
    }

    // Toggle Password Visibility
    togglePassword.addEventListener('click', function() {
        const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
        password.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });

    // Form Submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Form validation
        if (!username || !password) {
            showError('Please fill in all required fields');
            return;
        }
        
        try {
            // Show loading state
            loginButton.classList.add('loading');
            
            // For testing purposes, use hardcoded credentials
            const isValidCredentials = (
                (currentPortal === 'teacher' && password === 'teacher123') ||
                (currentPortal === 'student' && password === 'student123')
            );

            if (isValidCredentials) {
                // Save teacher name if logging in as teacher
                if (currentPortal === 'teacher') {
                    localStorage.setItem('currentTeacher', username);
                }

                // Show success animation
                loginButton.classList.remove('loading');
                loginButton.classList.add('success');
                successMessage.classList.add('show');

                // Redirect after showing success message
                setTimeout(() => {
                    const redirectUrl = currentPortal === 'teacher' 
                        ? '/src/teacher-portal/teacher-portal.html' 
                        : '/src/student-portal/student-portal.html';
                    window.location.href = redirectUrl;
                }, 1000);
            } else {
                throw new Error('Invalid credentials');
            }
        } catch (error) {
            loginButton.classList.remove('loading');
            showError('Invalid username or password');
        }
    });

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 3000);
    }

    // Forgot Password Modal
    forgotPasswordLink.addEventListener('click', function() {
        forgotPasswordModal.classList.add('show');
    });

    closeModal.addEventListener('click', function() {
        forgotPasswordModal.classList.remove('show');
        resetPasswordForm.reset();
        resetSuccessMessage.classList.remove('show');
    });

    resetPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const resetEmail = document.getElementById('resetEmail').value;

        if (!resetEmail) {
            showError('Please enter your email address');
            return;
        }

        if (!isValidEmail(resetEmail)) {
            showError('Please enter a valid email address');
            return;
        }

        try {
            resetButton.classList.add('loading');
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            resetButton.classList.remove('loading');
            resetButton.classList.add('success');
            resetSuccessMessage.classList.add('show');

            setTimeout(() => {
                forgotPasswordModal.classList.remove('show');
                resetPasswordForm.reset();
                resetSuccessMessage.classList.remove('show');
                resetButton.classList.remove('success');
            }, 3000);
        } catch (error) {
            resetButton.classList.remove('loading');
            showError('Password reset failed. Please try again.');
        }
    });

    // Logout functionality
    teacherLogout.addEventListener('click', handleLogout);
    studentLogout.addEventListener('click', handleLogout);

    function handleLogout() {
        const activePortal = document.querySelector('.portal-page.active');
        activePortal.classList.remove('active');
        
        setTimeout(() => {
            loginContainer.classList.remove('fade-out');
        }, 100);
    }

    // Initialize testimonial dots
    const dots = document.querySelectorAll('.dot');
    let currentDot = 0;

    // Auto-rotate testimonials (simulated)
    setInterval(() => {
        dots[currentDot].classList.remove('active');
        currentDot = (currentDot + 1) % dots.length;
        dots[currentDot].classList.add('active');
    }, 5000);

    // Add hover animation to dashboard cards
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Add click animation to nav links
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Tab Switching
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            setActiveTab(tabName);
        });
    });

    function setActiveTab(tabName) {
        // Update tab buttons
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab panes
        tabPanes.forEach(pane => {
            if (pane.id === tabName + 'Pane') {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    }

    // FAQ Accordion
    faqItems.forEach(item => {
        item.querySelector('.faq-question').addEventListener('click', function() {
            const isActive = item.classList.contains('active');
            
            // Close all FAQ items
            faqItems.forEach(faq => faq.classList.remove('active'));
            
            // Open clicked item if it wasn't active
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Support Form
    supportForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('supportName').value;
        const email = document.getElementById('supportEmail').value;
        const issueType = document.getElementById('issueType').value;
        const message = document.getElementById('supportMessage').value;

        if (!name || !email || !issueType || !message) {
            showError('Please fill in all required fields');
            return;
        }

        if (!isValidEmail(email)) {
            showError('Please enter a valid email address');
            return;
        }

        try {
            const submitButton = document.getElementById('submitSupport');
            submitButton.classList.add('loading');
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            submitButton.classList.remove('loading');
            submitButton.classList.add('success');
            supportSuccessMessage.classList.add('show');

            setTimeout(() => {
                submitButton.classList.remove('success');
                supportSuccessMessage.classList.remove('show');
                supportForm.reset();
            }, 3000);
        } catch (error) {
            const submitButton = document.getElementById('submitSupport');
            submitButton.classList.remove('loading');
            showError('Support request failed. Please try again.');
        }
    });
});