export function showLevelDownAnimation(previousLevel, newLevel) {
    // Remove any existing animation containers
    const existingContainer = document.querySelector('.sl-level-animation-container');
    if (existingContainer) {
      document.body.removeChild(existingContainer);
    }
    
    // Create container for the animation
    const container = document.createElement('div');
    container.className = 'sl-level-animation-container sl-level-down';
    document.body.appendChild(container);
    
    // Create inner container with glow
    const innerContainer = document.createElement('div');
    innerContainer.className = 'sl-level-animation-inner';
    container.appendChild(innerContainer);
    
    // Create level display
    const levelDisplay = document.createElement('div');
    levelDisplay.className = 'sl-level-display';
    innerContainer.appendChild(levelDisplay);
    
    // Create text elements
    const levelText = document.createElement('div');
    levelText.className = 'sl-level-text';
    levelText.textContent = 'LEVEL';
    levelDisplay.appendChild(levelText);
    
    const levelNumberContainer = document.createElement('div');
    levelNumberContainer.className = 'sl-level-number-container';
    levelDisplay.appendChild(levelNumberContainer);
    
    const oldNumber = document.createElement('div');
    oldNumber.className = 'sl-level-number sl-old-level';
    oldNumber.textContent = previousLevel;
    levelNumberContainer.appendChild(oldNumber);
    
    const newNumber = document.createElement('div');
    newNumber.className = 'sl-level-number sl-new-level';
    newNumber.textContent = newLevel;
    levelNumberContainer.appendChild(newNumber);
    
    const statusText = document.createElement('div');
    statusText.className = 'sl-status-text';
    statusText.textContent = 'LEVEL DOWN';
    levelDisplay.appendChild(statusText);
    
    // Try to play penalty sound
    try {
      audioSystem.playVoiceLine('PENALTY');
    } catch (e) {
      console.log('Voice line not available:', e);
    }
    
    // Animation sequence
    setTimeout(() => {
      container.classList.add('sl-active');
      statusText.classList.add('sl-status-active');
    }, 100);
    
    setTimeout(() => {
      oldNumber.classList.add('sl-number-exit');
      newNumber.classList.add('sl-number-enter');
      innerContainer.classList.add('sl-flash-red');
    }, 1500);
    
    // Remove the animation container after complete
    setTimeout(() => {
      container.classList.add('sl-fade-out');
      setTimeout(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }, 800);
    }, 4000);
  }
  
  // New Solo Leveling style level-up animation
  export function showLevelUpAnimation(previousLevel, newLevel) {
    // Remove any existing animation containers
    const existingContainer = document.querySelector('.sl-level-animation-container');
    if (existingContainer) {
      document.body.removeChild(existingContainer);
    }
    
    // Create container for the animation
    const container = document.createElement('div');
    container.className = 'sl-level-animation-container sl-level-up';
    document.body.appendChild(container);
    
    // Create particles for celebratory effect
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'sl-particle';
      
      // Randomize particle properties
      const size = 3 + Math.random() * 7;
      const posX = 30 + Math.random() * 40; // percentage from center
      const delay = Math.random() * 1.5;
      const duration = 1 + Math.random() * 2;
      
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${posX}%`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;
      
      container.appendChild(particle);
    }
    
    // Create inner container with glow
    const innerContainer = document.createElement('div');
    innerContainer.className = 'sl-level-animation-inner';
    container.appendChild(innerContainer);
    
    // Create level display
    const levelDisplay = document.createElement('div');
    levelDisplay.className = 'sl-level-display';
    innerContainer.appendChild(levelDisplay);
    
    // Create text elements
    const levelText = document.createElement('div');
    levelText.className = 'sl-level-text';
    levelText.textContent = 'LEVEL';
    levelDisplay.appendChild(levelText);
    
    const levelNumberContainer = document.createElement('div');
    levelNumberContainer.className = 'sl-level-number-container';
    levelDisplay.appendChild(levelNumberContainer);
    
    const oldNumber = document.createElement('div');
    oldNumber.className = 'sl-level-number sl-old-level';
    oldNumber.textContent = previousLevel;
    levelNumberContainer.appendChild(oldNumber);
    
    const newNumber = document.createElement('div');
    newNumber.className = 'sl-level-number sl-new-level';
    newNumber.textContent = newLevel;
    levelNumberContainer.appendChild(newNumber);
    
    const statusText = document.createElement('div');
    statusText.className = 'sl-status-text';
    statusText.textContent = 'LEVEL UP';
    levelDisplay.appendChild(statusText);
    
    // Try to play level up sound
    try {
      audioSystem.playVoiceLine('LEVEL_UP');
    } catch (e) {
      console.log('Voice line not available:', e);
    }
    
    // Animation sequence
    setTimeout(() => {
      container.classList.add('sl-active');
      statusText.classList.add('sl-status-active');
    }, 100);
    
    setTimeout(() => {
      oldNumber.classList.add('sl-number-exit');
      newNumber.classList.add('sl-number-enter');
      innerContainer.classList.add('sl-flash-blue');
    }, 1500);
    
    // Remove the animation container after complete
    setTimeout(() => {
      container.classList.add('sl-fade-out');
      setTimeout(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }, 800);
    }, 4500);
  }
  
  // Update both animations' styles
  export function addLevelAnimationStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .sl-level-animation-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        background-color: rgba(0, 0, 0, 0.85);
        opacity: 0;
        transition: opacity 0.5s ease;
      }
      
      .sl-active {
        opacity: 1;
      }
      
      /* Level Down Styles */
      .sl-level-down .sl-level-animation-inner {
        width: 400px;
        height: 300px;
        border: none;
        background-color: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5), inset 0 0 20px rgba(255, 0, 0, 0.3);
        position: relative;
        transition: all 0.3s ease;
        animation: sl-float 1.5s ease-in-out infinite alternate;
      }
      
      .sl-level-down .sl-old-level {
        color: #f8d210;
        text-shadow: 0 0 15px rgba(248, 210, 16, 0.7);
      }
      
      .sl-level-down .sl-new-level {
        color: #ff4747;
        text-shadow: 0 0 15px rgba(255, 71, 71, 0.7);
      }
      
      .sl-level-down .sl-status-text {
        color: #ff4747;
      }
      
      .sl-flash-red {
        animation: sl-red-flash 0.5s ease;
      }
      
      /* Level Up Styles */
      .sl-level-up .sl-level-animation-inner {
        width: 400px;
        height: 300px;
        border: none;
        background-color: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 0 20px rgba(0, 200, 255, 0.5), inset 0 0 20px rgba(0, 200, 255, 0.3);
        position: relative;
        transition: all 0.3s ease;
        animation: sl-float 1.5s ease-in-out infinite alternate;
      }
      
      .sl-level-up .sl-old-level {
        color: #3366ff;
        text-shadow: 0 0 15px rgba(51, 102, 255, 0.7);
      }
      
      .sl-level-up .sl-new-level {
        color: #00ff99;
        text-shadow: 0 0 15px rgba(0, 255, 153, 0.7);
      }
      
      .sl-level-up .sl-status-text {
        color: #00ff99;
      }
      
      .sl-flash-blue {
        animation: sl-blue-flash 0.5s ease;
      }
      
      /* Particle effect for level up */
      .sl-particle {
        position: absolute;
        background-color: #00ffcc;
        border-radius: 50%;
        top: 50%;
        opacity: 0;
        animation: sl-particle-float 3s ease-out forwards;
      }
      
      /* Shared Styles */
      .sl-level-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 20px;
      }
      
      .sl-level-text {
        font-size: 28px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 20px;
        letter-spacing: 5px;
        font-weight: bold;
      }
      
      .sl-level-number-container {
        position: relative;
        height: 120px;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 20px;
        overflow: hidden;
      }
      
      .sl-level-number {
        font-size: 120px;
        font-weight: bold;
        position: absolute;
        transition: all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      .sl-new-level {
        transform: translateY(100px);
        opacity: 0;
      }
      
      .sl-number-exit {
        transform: translateY(-100px);
        opacity: 0;
      }
      
      .sl-number-enter {
        transform: translateY(0);
        opacity: 1;
      }
      
      .sl-status-text {
        font-size: 24px;
        letter-spacing: 3px;
        font-weight: bold;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.5s ease;
      }
      
      .sl-status-active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .sl-fade-out {
        opacity: 0;
        transition: opacity 0.8s ease;
      }
      
      @keyframes sl-float {
        0% { transform: translateY(0); }
        100% { transform: translateY(-10px); }
      }
      
      @keyframes sl-red-flash {
        0% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.5), inset 0 0 20px rgba(255, 0, 0, 0.3); }
        50% { box-shadow: 0 0 40px rgba(255, 0, 0, 0.8), inset 0 0 40px rgba(255, 0, 0, 0.6); }
        100% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.5), inset 0 0 20px rgba(255, 0, 0, 0.3); }
      }
      
      @keyframes sl-blue-flash {
        0% { box-shadow: 0 0 20px rgba(0, 200, 255, 0.5), inset 0 0 20px rgba(0, 200, 255, 0.3); }
        50% { box-shadow: 0 0 40px rgba(0, 200, 255, 0.8), inset 0 0 40px rgba(0, 200, 255, 0.6); }
        100% { box-shadow: 0 0 20px rgba(0, 200, 255, 0.5), inset 0 0 20px rgba(0, 200, 255, 0.3); }
      }
      
      @keyframes sl-particle-float {
        0% { 
          transform: translate(-50%, -50%);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        100% { 
          transform: translate(-50%, -300%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // Replace addLevelDownAnimationStyles with this more comprehensive function
  export function addLevelDownAnimationStyles() {
    addLevelAnimationStyles();
  }
  