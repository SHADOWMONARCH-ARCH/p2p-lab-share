// Function to create stars
function createStars() {
    const starsContainer = document.querySelector('.stars');
    const stars2Container = document.querySelector('.stars2');
    const stars3Container = document.querySelector('.stars3');
    
    // Create 200 stars for each container
    for (let i = 0; i < 200; i++) {
        createStar(starsContainer);
        createStar(stars2Container);
        createStar(stars3Container);
    }
}

function createStar(container) {
    const star = document.createElement('div');
    star.className = 'star';
    
    // Random position
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    
    // Random size
    const size = Math.random() * 2;
    
    // Random animation duration
    const duration = Math.random() * 3 + 1;
    
    star.style.left = `${x}%`;
    star.style.top = `${y}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDuration = `${duration}s`;
    
    container.appendChild(star);
}

// Function to create shooting stars
function createShootingStars() {
    const shootingStarsContainer = document.querySelector('.shooting-stars');
    
    setInterval(() => {
        const shootingStar = document.createElement('div');
        shootingStar.className = 'shooting-star';
        
        // Random starting position
        const startX = Math.random() * 100;
        const startY = Math.random() * 50;
        
        shootingStar.style.left = `${startX}%`;
        shootingStar.style.top = `${startY}%`;
        
        // Random size
        const size = Math.random() * 2 + 1;
        shootingStar.style.width = `${size}px`;
        shootingStar.style.height = `${size}px`;
        
        // Random animation duration
        const duration = Math.random() * 2 + 1;
        shootingStar.style.animationDuration = `${duration}s`;
        
        shootingStarsContainer.appendChild(shootingStar);
        
        // Remove the shooting star after animation completes
        setTimeout(() => {
            shootingStar.remove();
        }, duration * 1000);
    }, 2000); // Create a new shooting star every 2 seconds
}

// Initialize the star effects
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    createShootingStars();
}); 