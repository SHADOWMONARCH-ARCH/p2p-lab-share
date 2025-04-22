// Import Firebase Auth
const FirebaseAuth = require('./utils/firebase');

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const teacherBtn = document.getElementById('teacherBtn');
    const studentBtn = document.getElementById('studentBtn');
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginButton = document.getElementById('loginButton');
    const successMessage = document.getElementById('successMessage');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeModal = document.getElementById('closeModal');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const resetButton = document.getElementById('resetButton');
    const resetSuccessMessage = document.getElementById('resetSuccessMessage');
    const helpButton = document.getElementById('helpButton');
    const helpModal = document.getElementById('helpModal');
    const closeHelpModal = document.getElementById('closeHelpModal');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const faqQuestions = document.querySelectorAll('.faq-question');
    const supportForm = document.getElementById('supportForm');
    const supportSuccessMessage = document.getElementById('supportSuccessMessage');

    // Add error message container
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    loginForm.insertBefore(errorMessage, loginForm.firstChild);

    // Current role (default to teacher)
    let currentRole = 'teacher';

    // Event Listeners
    teacherBtn.addEventListener('click', () => {
        currentRole = 'teacher';
        teacherBtn.classList.add('active');
        studentBtn.classList.remove('active');
        errorMessage.textContent = '';
    });

    studentBtn.addEventListener('click', () => {
        currentRole = 'student';
        studentBtn.classList.add('active');
        teacherBtn.classList.remove('active');
        errorMessage.textContent = '';
    });

    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
    });

    helpButton.addEventListener('click', () => {
        helpModal.style.display = 'flex';
    });

    closeHelpModal.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });

    // Tab Switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show corresponding tab pane
            tabPanes.forEach(pane => {
                if (pane.id === `${tab}Pane`) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });

    // FAQ Accordion
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const isOpen = answer.style.display === 'block';
            
            // Close all answers
            document.querySelectorAll('.faq-answer').forEach(ans => {
                ans.style.display = 'none';
                ans.previousElementSibling.querySelector('i').classList.remove('fa-chevron-up');
                ans.previousElementSibling.querySelector('i').classList.add('fa-chevron-down');
            });
            
            // Toggle current answer
            answer.style.display = isOpen ? 'none' : 'block';
            const icon = question.querySelector('i');
            icon.classList.toggle('fa-chevron-up');
            icon.classList.toggle('fa-chevron-down');
        });
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        const password = passwordInput.value;
        
        try {
            // Show loading state
            loginButton.classList.add('loading');
            loginButton.disabled = true;
            emailInput.disabled = true;
            passwordInput.disabled = true;
            
            // Call Firebase authentication
            const user = await FirebaseAuth.login(email, password, currentRole);
            
            if (user) {
                // Store user data in sessionStorage
                sessionStorage.setItem('userData', JSON.stringify({
                    name: user.name,
                    email: user.email,
                    role: currentRole
                }));
                
                // Show success message
                loginButton.classList.add('success');
                successMessage.style.display = 'flex';
                
                // Redirect based on role
                setTimeout(() => {
                    if (currentRole === 'teacher') {
                        window.location.href = 'teacher-dashboard.html';
                    } else {
                        window.location.href = 'student-dashboard.html';
                    }
                }, 1500);
            }
        } catch (error) {
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = error.message;
            loginForm.insertBefore(errorMessage, loginForm.firstChild);
            
            // Remove error message after 3 seconds
            setTimeout(() => {
                errorMessage.remove();
            }, 3000);
        } finally {
            // Reset button state
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
            emailInput.disabled = false;
            passwordInput.disabled = false;
        }
    });

    // Handle password reset
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value;
        
        try {
            resetButton.classList.add('loading');
            
            await FirebaseAuth.resetPassword(email);
            
            resetButton.classList.add('success');
            resetSuccessMessage.style.display = 'flex';
            
            setTimeout(() => {
                forgotPasswordModal.style.display = 'none';
                resetButton.classList.remove('success', 'loading');
                resetSuccessMessage.style.display = 'none';
            }, 3000);
        } catch (error) {
            alert(error.message);
            resetButton.classList.remove('loading');
        }
    });

    // Handle support form submission
    supportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('supportName').value;
        const email = document.getElementById('supportEmail').value;
        const issueType = document.getElementById('issueType').value;
        const message = document.getElementById('supportMessage').value;
        
        try {
            const submitButton = document.getElementById('submitSupport');
            submitButton.classList.add('loading');
            
            // Here you would typically send the support request to your backend
            // For now, we'll just simulate a successful submission
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            submitButton.classList.add('success');
            supportSuccessMessage.style.display = 'flex';
            
            setTimeout(() => {
                supportForm.reset();
                submitButton.classList.remove('success', 'loading');
                supportSuccessMessage.style.display = 'none';
            }, 3000);
        } catch (error) {
            alert('Failed to submit support request. Please try again.');
        }
    });
}); 