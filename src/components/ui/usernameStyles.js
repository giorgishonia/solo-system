import { updateTerminalPrompt } from '../../script.js';

export function updateUsernameDisplays() {
    if (!currentUser || !playerStats) return;
    
    const streakCount = playerStats.streak || 0;
    const username = playerStats.profile?.name || 'Hunter';
    const title = playerStats.profile?.title || null;
    
    // Only proceed if streak is 3 or higher
    if (streakCount >= 3) {
      const streakHTML = getStreakUserNameHTML(username, streakCount, title);
      
      // Update terminal prompt (correct selector)
      const terminalPrompt = document.querySelector('.terminal-prompt-user');
      if (terminalPrompt) {
        terminalPrompt.innerHTML = streakHTML;
        
        // Apply title color if it exists
        if (playerStats.profile?.titleColor) {
          terminalPrompt.style.color = playerStats.profile.titleColor;
        }
      }
      
      // Status bar username
      const statusBarUsername = document.getElementById('status-username');
      if (statusBarUsername) {
        statusBarUsername.innerHTML = streakHTML;
      }
      
      // Profile name
      const profileName = document.getElementById('profile-name');
      if (profileName) {
        profileName.innerHTML = streakHTML;
      }
    } else {
      // If streak < 3, restore normal username display
      updateTerminalPrompt(); // Use original function for terminal
    }
  }
  export function getStreakUserNameHTML(username, streakCount, title = null) {
    let displayName = username;
    
    // Add title if provided
    if (title) {
      displayName = `[${title}] ${displayName}`;
    }
    
    // Only add fire icon if streak count is 3 or higher
    if (!streakCount || streakCount < 3) {
      return displayName;
    }
    
    return `
      <span class="streak-username-container">
        <span class="streak-username">${displayName}</span>
        <i class="fa-solid fa-fire streak-flame-icon"></i>
        <span class="streak-counter">${streakCount}</span>
      </span>
    `;
  }
  
  // Simplified styling for Font Awesome icon
  export function addStreakUsernameStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .streak-username-container {
        position: relative;
        display: inline-block;
        padding-right: 20px;
      }
      
      .streak-username {
        position: relative;
        z-index: 2;
      }
      
      .streak-flame-icon {
        color: #ff6a00;
        position: absolute;
        top: -5px;
        right: 3px;
        font-size: 18px;
        z-index: 1;
        filter: drop-shadow(0 0 2px rgba(255, 0, 0, 0.4));
      }
      
      .streak-counter {
        position: absolute;
        top: -2px;
        right: 4px;
        font-size: 9px;
        padding: 0;
        color: white;
        background-color: #ff6a00;
        border-radius: 50%;
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        font-weight: bold;
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // This would be in your initialize or window system setup code
  export function setupProfileWindow() {
    const profileWindow = document.getElementById("profile-window");
    if (!profileWindow) return;
    
    // Find the edit-profile section or create it
    let editSection = profileWindow.querySelector(".edit-profile-section");
    if (!editSection) {
      editSection = document.createElement("div");
      editSection.className = "edit-profile-section";
      profileWindow.appendChild(editSection);
    }
    
    // Add title selection dropdown
    const titleSelectHTML = `
      <div class="profile-edit-item">
        <label for="profileTitleSelect">Title:</label>
        <select id="profileTitleSelect" class="profile-select">
          <option value="Novice">Novice</option>
        </select>
      </div>
    `;
    
    // Add other edit fields as needed
    editSection.innerHTML = titleSelectHTML + `
      <div class="profile-edit-item">
        <button id="editProfileBtn" class="sl-button">Edit Profile</button>
      </div>
    `;
    
    // Add event listener for edit button
    const editBtn = document.getElementById("editProfileBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        showSetNamePrompt();
      });
    }
  }