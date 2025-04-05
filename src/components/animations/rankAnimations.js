import { audioSystem } from '../../script.js';
import { notificationSystem } from '../../script.js';

export function showRankUpAnimation(previousRank, newRank) {
    // Add 5 second delay before starting animation
    setTimeout(() => {
      // Remove any existing animation containers
      const existingContainer = document.querySelector('.sl-rank-animation-container');
      if (existingContainer) {
        document.body.removeChild(existingContainer);
      }
      
      // Get rank style data
      const rankStyles = {
        E: {
          shape: "polygon(50% 0%, 100% 86%, 0% 86%)", // Simple triangle
          color: "#88b0d0",
          glow: "rgba(136, 176, 208, 0.5)"
        },
        D: {
          shape: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", // Diamond/square
          color: "#66b8e0",
          glow: "rgba(102, 184, 224, 0.6)"
        },
        C: {
          shape: "polygon(50% 0%, 95% 35%, 80% 90%, 20% 90%, 5% 35%)", // Pentagon
          color: "#44c0f0",
          glow: "rgba(68, 192, 240, 0.7)"
        },
        B: {
          shape: "polygon(50% 0%, 85% 25%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 15% 25%)", // Hexagon
          color: "#22c8ff",
          glow: "rgba(34, 200, 255, 0.8)"
        },
        A: {
          shape: "polygon(50% 0%, 75% 15%, 100% 40%, 95% 75%, 70% 100%, 30% 100%, 5% 75%, 0% 40%, 25% 15%)", // Octagon
          color: "linear-gradient(135deg, #00c8ff, #0080ff)",
          glow: "rgba(0, 200, 255, 0.9)"
        },
        S: {
          shape: "polygon(50% 0%, 72% 10%, 90% 30%, 100% 55%, 90% 80%, 65% 100%, 35% 100%, 10% 80%, 0% 55%, 10% 30%, 28% 10%)", // Complex star shape
          color: "linear-gradient(135deg, #7700ff, #00d8ff)",
          glow: "rgba(128, 0, 255, 1.0)"
        }
      };
  
      // Create container for the animation
      const container = document.createElement('div');
      container.className = 'sl-rank-animation-container';
      document.body.appendChild(container);
  
      // Create particles with rank-specific colors
      const particleCount = newRank === 'S' ? 60 : newRank === 'A' ? 40 : 30;
      const particleColors = newRank === 'S' 
        ? ['#7700ff', '#00d8ff', '#ff00d0'] 
        : newRank === 'A' 
          ? ['#00c8ff', '#0080ff', '#00ffff'] 
          : [rankStyles[newRank].color];
  
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'sl-rank-particle';
        
        // Randomize particle properties
        const size = 3 + Math.random() * 8;
        const posX = Math.random() * 100; // percentage
        const posY = Math.random() * 100; // percentage
        const delay = Math.random() * 2;
        const duration = 1 + Math.random() * 3;
        const colorIndex = Math.floor(Math.random() * particleColors.length);
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        particle.style.backgroundColor = particleColors[colorIndex];
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;
        
        container.appendChild(particle);
      }
      
      // Create inner container with glow
      const innerContainer = document.createElement('div');
      innerContainer.className = 'sl-rank-animation-inner';
      container.appendChild(innerContainer);
      
      // Create rank display section
      const rankDisplay = document.createElement('div');
      rankDisplay.className = 'sl-rank-display';
      innerContainer.appendChild(rankDisplay);
      
      // Create text elements
      const rankText = document.createElement('div');
      rankText.className = 'sl-rank-text';
      rankText.textContent = 'HUNTER RANK';
      rankDisplay.appendChild(rankText);
      
      // Create rank badge container
      const rankBadgeContainer = document.createElement('div');
      rankBadgeContainer.className = 'sl-rank-badge-container';
      rankDisplay.appendChild(rankBadgeContainer);
      
      // Create the old rank badge
      const oldBadge = document.createElement('div');
      oldBadge.className = 'sl-rank-badge sl-old-rank';
      oldBadge.textContent = previousRank;
      oldBadge.style.clipPath = rankStyles[previousRank].shape;
      oldBadge.style.background = rankStyles[previousRank].color;
      oldBadge.style.boxShadow = `0 0 15px ${rankStyles[previousRank].glow}`;
      rankBadgeContainer.appendChild(oldBadge);
      
      // Create the new rank badge
      const newBadge = document.createElement('div');
      newBadge.className = 'sl-rank-badge sl-new-rank';
      newBadge.textContent = newRank;
      newBadge.style.clipPath = rankStyles[newRank].shape;
      newBadge.style.background = rankStyles[newRank].color;
      newBadge.style.boxShadow = `0 0 20px ${rankStyles[newRank].glow}`;
      rankBadgeContainer.appendChild(newBadge);
      
      // Add status text
      const statusText = document.createElement('div');
      statusText.className = 'sl-rank-status-text';
      statusText.textContent = 'RANK UP';
      rankDisplay.appendChild(statusText);
      
      // Try to play rank up sound
      try {
        audioSystem.playVoiceLine('RANK_UP');
      } catch (e) {
        console.log('Voice line not available, using default sound');
        notificationSystem.playSound("achievement");
      }
      
      // Animation sequence
      setTimeout(() => {
        container.classList.add('sl-active');
        statusText.classList.add('sl-status-active');
      }, 100);
      
      setTimeout(() => {
        oldBadge.classList.add('sl-badge-exit');
        newBadge.classList.add('sl-badge-enter');
        innerContainer.classList.add('sl-flash');
      }, 1500);
      
      // Special effects for higher ranks
      if (newRank === 'S' || newRank === 'A') {
        setTimeout(() => {
          innerContainer.classList.add('sl-special-effect');
          if (newRank === 'S') {
            const shockwave = document.createElement('div');
            shockwave.className = 'sl-shockwave';
            container.appendChild(shockwave);
          }
        }, 2000);
      }
      
      // Remove the animation container after complete
      setTimeout(() => {
        container.classList.add('sl-fade-out');
        setTimeout(() => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
        }, 1000);
      }, 5500);
    }, 5000); // 5 second delay
  }
  
  // Add CSS styles for the rank up animation
  export function addRankAnimationStyles() {
    if (document.getElementById('rankAnimationStyles')) return;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'rankAnimationStyles';
    styleSheet.textContent = `
      .sl-rank-animation-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.5s ease;
        pointer-events: none;
      }
      
      .sl-rank-animation-container.sl-active {
        opacity: 1;
      }
      
      .sl-rank-animation-container.sl-fade-out {
        opacity: 0;
      }
      
      .sl-rank-animation-inner {
        background: rgba(0, 24, 48, 0.9);
        border: 2px solid #0088ff;
        border-radius: 10px;
        padding: 40px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 30px rgba(0, 136, 255, 0.5);
        transform: scale(0.9);
        transition: transform 0.5s ease, box-shadow 0.5s ease;
      }
      
      .sl-rank-animation-inner.sl-flash {
        animation: rankFlash 1s forwards;
      }
      
      .sl-rank-animation-inner.sl-special-effect {
        animation: rankPulse 2s infinite;
      }
      
      .sl-rank-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }
      
      .sl-rank-text {
        font-size: 28px;
        font-weight: bold;
        color: #00ffff;
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        letter-spacing: 2px;
      }
      
      .sl-rank-badge-container {
        position: relative;
        width: 150px;
        height: 150px;
        margin: 20px 0;
      }
      
      .sl-rank-badge {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 72px;
        font-weight: bold;
        color: white;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        transition: transform 1s ease, opacity 1s ease;
      }
      
      .sl-old-rank {
        opacity: 1;
        transform: scale(1);
      }
      
      .sl-new-rank {
        opacity: 0;
        transform: scale(0.5);
      }
      
      .sl-badge-exit {
        opacity: 0;
        transform: scale(0.5) rotate(-30deg);
      }
      
      .sl-badge-enter {
        opacity: 1;
        transform: scale(1.2);
        animation: badgeEntrance 1.5s forwards;
      }
      
      .sl-rank-status-text {
        font-size: 36px;
        font-weight: bold;
        color: white;
        margin-top: 20px;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.5s ease;
      }
      
      .sl-rank-status-text.sl-status-active {
        opacity: 1;
        transform: translateY(0);
      }
      
      .sl-rank-particle {
        position: absolute;
        border-radius: 50%;
        opacity: 0;
        animation: particleRise 3s ease-out forwards;
      }
      
      .sl-shockwave {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.8);
        opacity: 0.8;
        animation: shockwave 1.5s ease-out forwards;
      }
      
      @keyframes rankFlash {
        0% { box-shadow: 0 0 30px rgba(0, 136, 255, 0.5); }
        50% { box-shadow: 0 0 50px rgba(255, 255, 255, 0.9); }
        100% { box-shadow: 0 0 40px rgba(0, 136, 255, 0.7); }
      }
      
      @keyframes rankPulse {
        0% { transform: scale(0.95); box-shadow: 0 0 30px rgba(0, 136, 255, 0.5); }
        50% { transform: scale(1); box-shadow: 0 0 50px rgba(0, 136, 255, 0.8); }
        100% { transform: scale(0.95); box-shadow: 0 0 30px rgba(0, 136, 255, 0.5); }
      }
      
      @keyframes badgeEntrance {
        0% { transform: scale(1.2); }
        10% { transform: scale(1.3); }
        20% { transform: scale(1.1); }
        30% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      
      @keyframes particleRise {
        0% { transform: translateY(0) scale(1); opacity: 0; }
        10% { opacity: 1; }
        100% { transform: translateY(-100px) scale(0); opacity: 0; }
      }
      
      @keyframes shockwave {
        0% { width: 20px; height: 20px; opacity: 0.8; }
        100% { width: 500px; height: 500px; opacity: 0; }
      }
    `;
    
    document.head.appendChild(styleSheet);
  }