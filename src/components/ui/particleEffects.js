export function addSoloLevelingStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* Solo Leveling Window Design */
      .window {
        background: rgba(8, 19, 34, 0.7) !important;
        border: 1px solid rgba(0, 160, 255, 0.6) !important;
        box-shadow: 0 0 15px rgba(0, 190, 255, 0.4), inset 0 0 20px rgba(0, 130, 255, 0.1) !important;
        backdrop-filter: blur(8px) !important;
        color: #e0f2ff !important;
        border-radius: 8px !important;
        overflow: hidden !important;
      }
      
      .window::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(0, 120, 255, 0.05) 0%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0) 60%, rgba(0, 200, 255, 0.05) 100%);
        z-index: -1;
        pointer-events: none;
      }
      
      .window::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0, 174, 255, 0.8), transparent);
        z-index: 1;
        pointer-events: none;
      }
      
      .window-header {
        border-bottom: 1px solid rgba(0, 160, 255, 0.3) !important;
        padding: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        background: rgba(4, 34, 66, 0.7) !important;
      }
      
      .window-title {
        color: #00a8ff !important;
        font-weight: bold !important;
        text-shadow: 0 0 10px rgba(0, 168, 255, 0.7) !important;
        font-family: 'Rajdhani', sans-serif !important;
      }
      
      .window-content {
        max-height: calc(80vh - 40px) !important;
        overflow-y: auto !important;
        scrollbar-width: thin !important;
        scrollbar-color: rgba(0, 140, 255, 0.5) rgba(0, 60, 120, 0.1) !important;
      }
      
      .window-content::-webkit-scrollbar {
        width: 6px !important;
      }
      
      .window-content::-webkit-scrollbar-track {
        background: rgba(0, 60, 120, 0.1) !important;
      }
      
      .window-content::-webkit-scrollbar-thumb {
        background-color: rgba(0, 140, 255, 0.5) !important;
        border-radius: 3px !important;
      }
      
      /* Holographic Effects */
      @keyframes hologram-scan {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }
      
      #holographic-scan-lines {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          rgba(0, 200, 255, 0.03) 1px,
          transparent 2px
        );
        background-size: 100% 4px;
        pointer-events: none;
        z-index: 9999;
      }
      
  
      
      /* Window opening animation */
      @keyframes window-glitch {
        0% { clip-path: inset(0 0 0 0); }
        5% { clip-path: inset(33% 0 66% 0); }
        10% { clip-path: inset(50% 0 50% 0); }
        15% { clip-path: inset(25% 0 75% 0); }
        20% { clip-path: inset(80% 0 20% 0); }
        25% { clip-path: inset(0 0 0 0); }
        30% { clip-path: inset(0 0 100% 0); }
        35% { clip-path: inset(100% 0 0 0); }
        40% { clip-path: inset(43% 0 57% 0); }
        45% { clip-path: inset(0 0 0 0); }
        100% { clip-path: inset(0 0 0 0); }
      }
      
      .window-opening {
        animation: window-glitch 0.5s forwards;
      }
      
      /* Hologram flicker */
      @keyframes hologram-flicker {
        0% { opacity: 1; transform: scale(1); filter: brightness(1); }
        25% { opacity: 0.8; transform: scale(1.01) skewX(1deg); filter: brightness(1.2) hue-rotate(5deg); }
        50% { opacity: 0.9; transform: scale(0.99); filter: brightness(0.9); }
        75% { opacity: 1; transform: scale(1.01) skewX(-1deg); filter: brightness(1.1) hue-rotate(-5deg); }
        100% { opacity: 1; transform: scale(1); filter: brightness(1); }
      }
      
      .hologram-flicker {
        animation: hologram-flicker 5s linear;
      }
      
      /* Button styling */
      .window button {
        background: rgba(0, 90, 180, 0.4);
        border: 1px solid rgba(0, 174, 255, 0.5);
        color: #a0e0ff !important;
        padding: 5px 12px !important;
        border-radius: 4px !important;
        transition: all 0.2s ease !important;
      }
      
      .window button:hover {
        background: rgba(0, 120, 225, 0.6);
        box-shadow: 0 0 10px rgba(0, 160, 255, 0.5);
        text-shadow: 0 0 5px rgba(0, 200, 255, 0.7);
      }
      
      /* TaskBar styling */
      .taskbar {
        background: rgba(4, 20, 40, 0.85) !important;
        border-top: 1px solid rgba(0, 140, 255, 0.5) !important;
        box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.3) !important;
      }
      
      .taskbar-item {
        border: 1px solid rgba(0, 140, 255, 0.3) !important;
        background: rgba(8, 40, 70, 0.5) !important;
        margin: 5px !important;
        border-radius: 4px !important;
        transition: all 0.2s ease !important;
      }
      
      .taskbar-item:hover {
        background: rgba(10, 60, 100, 0.7) !important;
        box-shadow: 0 0 10px rgba(0, 140, 255, 0.4) !important;
      }
      
      .taskbar-item.active {
        background: rgba(0, 80, 160, 0.6) !important;
        border-color: rgba(0, 180, 255, 0.7) !important;
        box-shadow: 0 0 10px rgba(0, 180, 255, 0.5) !important;
      }
    `;
    
    document.head.appendChild(styleElement);
    
    // Add Google Fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  export function initializeParticleEffects() {
    // Create a canvas element for particles that will be placed behind all windows
    const canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '999'; // Behind windows but above other content
    document.body.appendChild(canvas);
    
    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Get canvas context
    const ctx = canvas.getContext('2d');
    
    // Create particles
    const particles = [];
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: Math.random() * 1 - 0.5,
        speedY: Math.random() * 1 - 0.5,
        color: `rgba(0, ${120 + Math.random() * 135}, ${215 + Math.random() * 40}, ${0.2 + Math.random() * 0.3})`
      });
    }
    
    // Animation function
    function animateParticles() {
      requestAnimationFrame(animateParticles);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Get all visible windows
      const visibleWindows = Array.from(document.querySelectorAll('.window')).filter(
        window => window.style.display !== 'none'
      );
      
      // Only draw particles if there are visible windows
      if (visibleWindows.length === 0) return;
      
      particles.forEach(particle => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Wrap around screen
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = 0;
        if (particle.y < 0) particle.y = canvas.height;
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        
        // Draw connecting lines to nearby particles
        particles.forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 200, 255, ${0.1 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });
      });
    }
    
    // Start animation
    animateParticles();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }
  
  // Create holographic scan line effect
  export function addHolographicEffects() {
    const scanLinesElement = document.createElement('div');
    scanLinesElement.id = 'holographic-scan-lines';
    document.body.appendChild(scanLinesElement);
    
    // Create flicker animation for windows
    setInterval(() => {
      const windows = document.querySelectorAll('.window');
      windows.forEach(window => {
        if (window.style.display !== 'none' && Math.random() > 0.95) {
          window.classList.add('hologram-flicker');
          setTimeout(() => {
            window.classList.remove('hologram-flicker');
          }, 150);
        }
      });
    }, 2000);
  }