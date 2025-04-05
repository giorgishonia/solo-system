// Use an IIFE to avoid polluting the global scope in module mode
(function() {
  // Ensure DOM is loaded before executing
  document.addEventListener('DOMContentLoaded', () => {
    // Make sure the window is registered in the windowSystem
    const setProfileWindow = document.getElementById("setProfileWindow");
    if (setProfileWindow && window.windowSystem && window.windowSystem.windows) {
      window.windowSystem.windows.setProfileWindow = setProfileWindow;
    }
  });

  // Set Profile Window (combines name, title, class, and bio)
  window.showSetProfilePrompt = function showSetProfilePrompt() {
    // Bypass authentication check since user is already authenticated
    // We'll add proper initialization of profile if needed
    if (!window.playerStats) {
      window.playerStats = window.playerStats || { profile: {} };
    }

    // Get available classes
    const validClasses = [
      "Hunter", 
      "Healer", 
      "Tank", 
      "Assassin", 
      "Mage", 
      "Warrior", 
      "Rogue", 
      "Paladin", 
      "Summoner", 
      "Berserker", 
      "Necromancer", 
      "Monk", 
      "Druid", 
      "Gunslinger", 
      "Samurai", 
      "Engineer", 
      "Elementalist", 
      "Bard", 
      "Shadow Knight", 
      "Sentinel"
    ];
        const classOptions = validClasses.map(cls => 
      `<option value="${cls}" ${window.playerStats?.profile?.class === cls ? 'selected' : ''}>${cls}</option>`
    ).join("");

    // Set content for the window
    const setProfileContent = document.getElementById("setProfileContent");
    if (!setProfileContent) {
      console.error("setProfileContent element not found");
      return;
    }
    
    setProfileContent.innerHTML = `
      <div class="window-section">
        <h3>Profile Settings</h3>
        <div>
          <div class="form-group">
            <label for="nameInput">Name:</label>
            <input type="text" id="nameInput" class="modal-input" placeholder="${window.playerStats?.profile?.name || 'Enter your name'}" maxlength="20" value="${window.playerStats?.profile?.name || ''}">
          </div>
          <div class="form-group">
            <label for="titleInput">Title:</label>
            <input type="text" id="titleInput" class="modal-input" placeholder="${window.playerStats?.profile?.title || 'Enter your title'}" maxlength="30" value="${window.playerStats?.profile?.title || ''}">
          </div>
          <div class="form-group">
            <label for="classInput">Class:</label>
            <select id="classInput" class="modal-input">${classOptions || ''}</select>
          </div>
          <div class="form-group">
            <label for="bioInput">Bio:</label>
            <textarea id="bioInput" class="modal-input" placeholder="${window.playerStats?.profile?.bio || 'Enter your bio'}" maxlength="200">${window.playerStats?.profile?.bio || ''}</textarea>
          </div>
        </div>
        <div class="window-actions">
          <button id="setProfileSubmit" class="window-button">Submit</button>
          <button id="setProfileCancel" class="window-button danger">Cancel</button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const submitButton = document.getElementById("setProfileSubmit");
    if (submitButton) {
      submitButton.addEventListener("click", async () => {
        const nameInput = document.getElementById("nameInput").value.trim();
        const titleInput = document.getElementById("titleInput").value.trim();
        const classInput = document.getElementById("classInput").value;
        const bioInput = document.getElementById("bioInput").value.trim();
        
        // Get original values to compare
        const originalName = window.playerStats?.profile?.name || '';
        const originalTitle = window.playerStats?.profile?.title || '';
        const originalClass = window.playerStats?.profile?.class || 'Hunter';
        const originalBio = window.playerStats?.profile?.bio || '';
        
        // Update only fields that were actually changed
        try {
          if (nameInput && nameInput !== originalName) await window.setPlayerName([nameInput]);
          if (titleInput && titleInput !== originalTitle) await window.setPlayerTitle([titleInput]);
          if (classInput && classInput !== originalClass) await window.setPlayerClass([classInput]);
          if (bioInput !== originalBio) await window.setPlayerBio([bioInput]); // Bio can be empty
          
          window.printToTerminal("Profile updated successfully!", "success");
          window.showNotification("Profile updated!");
          window.windowSystem.updateWindowContent("profileWindow");
          window.windowSystem.closeWindow("setProfileWindow");
        } catch (error) {
          window.printToTerminal("Error updating profile: " + error.message, "error");
        }
      });
    }

    const cancelButton = document.getElementById("setProfileCancel");
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        window.windowSystem.closeWindow("setProfileWindow");
      });
    }

    // Show the window
    window.windowSystem.showWindow("setProfileWindow");
  };
})(); 