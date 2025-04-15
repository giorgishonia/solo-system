import { createQuest, printToTerminal } from '../../script.js';
import { soloAISystem } from '../ai/soloAISystem.js';
export function initializeQuestSuggestionSystem() {
    console.log('Initializing quest suggestion system');
    
    // Remove any existing elements first
    const existingButton = document.getElementById('suggestQuestButton');
    if (existingButton) existingButton.remove();
    
    const existingWindow = document.getElementById('suggestQuestWindow');
    if (existingWindow) existingWindow.remove();
    
    // Create floating suggest button with Solo Leveling styling
    const suggestButton = document.createElement('div');
    suggestButton.id = 'suggestQuestButton';
    suggestButton.innerHTML = '<i class="fas fa-lightbulb"></i><span class="sl-button-label">SUGGEST QUEST</span>';
    suggestButton.classList.add('floating-suggest-button', 'sl-action-button');
    
    document.body.appendChild(suggestButton);
    
    // Create suggestion window with Solo Leveling styling
    const suggestWindow = document.createElement('div');
    suggestWindow.id = 'suggestQuestWindow';
    suggestWindow.className = 'window';
    
    // Using fixed pixel values initially - will be properly positioned on first show
    suggestWindow.style.position = 'absolute';
    suggestWindow.style.width = '500px';
    suggestWindow.style.height = '450px';
    suggestWindow.style.display = 'none';
    suggestWindow.innerHTML = `
      <div class="window-header">
        <span class="window-title">QUEST SUGGESTIONS</span>
        <div class="window-controls">
          <button class="window-minimize">_</button>
          <button class="window-close">×</button>
        </div>
      </div>
      <div class="window-body">
        <div class="sl-system-header">
          <div class="sl-system-line"></div>
          <div class="sl-title">SOLO AI QUEST GENERATOR</div>
          <div class="sl-system-line"></div>
        </div>
        <div id="suggestionInputContainer">
          <p>Tell SOLO about your goals and interests:</p>
          <textarea id="suggestionGoalsText" placeholder="Describe your goals, what you want to improve, your interests..."></textarea>
          
          <div class="suggestion-type-selector">
            <label>
              <input type="radio" name="questType" value="normal" checked>
              <span>Normal Quest</span>
            </label>
            <label>
              <input type="radio" name="questType" value="daily">
              <span>Daily Quest</span>
            </label>
          </div>
          
          <button id="generateSuggestionBtn" class="sl-action-button">
            <span class="sl-button-label">GENERATE SUGGESTIONS</span>
          </button>
        </div>
        
        <div id="suggestionResults"></div>
        
        <div class="sl-system-footer">
          <div class="sl-footer-line"></div>
          <div class="sl-footer-text">SYSTEM READY</div>
          <div class="sl-footer-line"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(suggestWindow);
    
    // Define a flag to track if the window has been positioned yet
    let isWindowPositioned = false;
    
    // Initialize window position properly
    const initWindowPosition = () => {
      if (isWindowPositioned) return;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const windowWidth = 500; // Fixed width
      const windowHeight = 450; // Fixed height
      
      // Set absolute position in the center of the screen
      suggestWindow.style.left = `${(viewportWidth - windowWidth) / 2}px`;
      suggestWindow.style.top = `${(viewportHeight - windowHeight) / 2}px`;
      
      isWindowPositioned = true;
    };
    
    // IMPORTANT: Register the window with windowSystem
    if (typeof windowSystem !== 'undefined') {
      if (!windowSystem.windows) {
        windowSystem.windows = {};
      }
      
      // Add our window to the windowSystem
      windowSystem.windows.suggestQuestWindow = suggestWindow;
      
      // Make the window draggable
      windowSystem.makeDraggable(suggestWindow);
    } else {
      console.error("windowSystem is not defined");
      
      // Fallback draggable implementation with fix for teleporting
      let isDragging = false;
      let startX, startY;
      
      const header = suggestWindow.querySelector('.window-header');
      if (header) {
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', (e) => {
          // Make sure window is positioned before first drag
          if (!isWindowPositioned) {
            initWindowPosition();
          }
          
          isDragging = true;
          
          // Get current window position
          const rect = suggestWindow.getBoundingClientRect();
          
          // Calculate offset from mouse to window corner
          startX = e.clientX - rect.left;
          startY = e.clientY - rect.top;
          
          header.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          
          // Calculate new position
          const newLeft = e.clientX - startX;
          const newTop = e.clientY - startY;
          
          // Apply new position
          suggestWindow.style.left = `${newLeft}px`;
          suggestWindow.style.top = `${newTop}px`;
        });
        
        document.addEventListener('mouseup', () => {
          isDragging = false;
          header.style.userSelect = '';
        });
      }
    }
    
    // Helper function to show the window
    function showSuggestionWindow() {
      // Position the window before showing it (if not already positioned)
      if (!isWindowPositioned) {
        initWindowPosition();
      }
      
      if (typeof windowSystem !== 'undefined' && windowSystem.showWindow) {
        try {
          // Make sure the window is visible
          suggestWindow.style.display = 'block';
          windowSystem.showWindow('suggestQuestWindow');
        } catch (e) {
          console.error('Error using windowSystem.showWindow:', e);
          suggestWindow.style.display = 'block';
          suggestWindow.classList.add('show');
        }
      } else {
        suggestWindow.style.display = 'block';
        suggestWindow.classList.add('show');
      }
      
      // Focus the textarea
      setTimeout(() => {
        const textarea = document.getElementById('suggestionGoalsText');
        if (textarea) textarea.focus();
      }, 100);
    }
    
    // Button click handler
    suggestButton.addEventListener('click', () => {
      console.log('Suggestion button clicked');
      showSuggestionWindow();
    });
    
    // Rest of the function remains the same...
    
    // Add generate button click handler
    const generateBtn = document.getElementById('generateSuggestionBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', generateQuestSuggestion);
    }
    
    // Add window controls functionality
    const closeBtn = suggestWindow.querySelector('.window-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('Close button clicked');
        if (typeof windowSystem !== 'undefined' && windowSystem.closeWindow) {
          windowSystem.closeWindow('suggestQuestWindow');
        } else {
          suggestWindow.style.display = 'none';
          suggestWindow.classList.remove('show');
        }
      });
    }
    
    const minimizeBtn = suggestWindow.querySelector('.window-minimize');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        console.log('Minimize button clicked');
        if (typeof windowSystem !== 'undefined' && windowSystem.closeWindow) {
          windowSystem.closeWindow('suggestQuestWindow');
        } else {
          suggestWindow.style.display = 'none';
          suggestWindow.classList.remove('show');
        }
      });
    }
    
    // Add styles
    addQuestSuggestionStyles();
    
    console.log('Quest suggestion system initialized');
    
    return {
      window: suggestWindow,
      showWindow: showSuggestionWindow
    };
  }
 export async function loadSavedSuggestionText() {
    if (!currentUser) return;
    
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const preferencesDoc = await playerRef.collection("preferences").doc("suggestions").get();
      
      if (preferencesDoc.exists && preferencesDoc.data().goalsText) {
        document.getElementById('suggestionGoalsText').value = preferencesDoc.data().goalsText;
      }
    } catch (error) {
      console.error("Error loading saved suggestion text:", error);
    }
  }
  
 export async function saveSuggestionText(text) {
    if (!currentUser || !text) return;
    
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      await playerRef.collection("preferences").doc("suggestions").set({
        goalsText: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving suggestion text:", error);
    }
  }
export async function generateQuestSuggestion() {
    const goalsText = document.getElementById('suggestionGoalsText').value.trim();
    const questType = document.querySelector('input[name="questType"]:checked').value;
    const resultsContainer = document.getElementById('suggestionResults');
    
    if (!goalsText) {
      resultsContainer.innerHTML = '<div class="error-message">Please describe your goals first.</div>';
      return;
    }
    
    await saveSuggestionText(goalsText);
    
    resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Generating suggestions...</p></div>';
    
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      const playerData = playerDoc.data();
      
      // Enhanced prompt that asks for specific, actionable quests
      const prompt = `
  Create a specific, actionable quest for someone with this goal: "${goalsText}"
  
  The quest should be CONCRETE and DETAILED, breaking down a specific action they can take to achieve their goal.
  For example:
  - If they want to be a web developer: Create a quest about writing HTML/CSS for 30 minutes or building a specific component
  - If they want to get fit: Create a quest for specific exercises like "Complete 3 sets of pushups and squats"
  - If they want to learn a language: Create a quest like "Practice Spanish verbs for 20 minutes"
  
  IMPORTANT: Respond ONLY with a JSON object using this exact format:
  
  {
    "title": "Brief, specific title (3-5 words)",
    "description": "Detailed instructions with specific actions to take",
    "targetCount": 5,
    "metric": "specific unit of measurement",
    "type": "${questType}"
  }
  
  Make sure:
  1. Title is brief but specific to the action
  2. Description has DETAILED instructions on exactly what to do
  3. TargetCount is a number from 1-30
  4. Metric is specific (reps, minutes, pages, sessions, etc.)
  `;
  
      const aiResponse = await soloAISystem.callDeepSeekAPI(prompt);
      console.log("AI Response:", aiResponse);
      
      let quest = null;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0].trim();
          quest = JSON.parse(jsonStr);
          console.log("JSON parsing successful:", quest);
        }
      } catch (error) {
        console.error("JSON parse error:", error);
      }
      
      // If parsing failed, create a specific default quest based on the goal
      if (!quest) {
        let defaultTitle = "";
        let defaultDescription = "";
        let defaultMetric = "sessions";
        let defaultCount = 5;
        
        // Generate more specific defaults based on keywords in the goal
        const goal = goalsText.toLowerCase();
        
        if (goal.includes("stronger") || goal.includes("fit") || goal.includes("muscle") || 
            goal.includes("lean") || goal.includes("weight") || goal.includes("exercise")) {
          defaultTitle = "Strength Training Circuit";
          defaultDescription = "Complete a full-body workout: 3 sets of 10 pushups, 15 squats, 10 lunges per leg, and 30-second plank. Rest 60 seconds between exercises.";
          defaultMetric = "workouts";
          defaultCount = 3;
        } else if (goal.includes("code") || goal.includes("programming") || goal.includes("developer") || goal.includes("web")) {
          defaultTitle = "Coding Practice Session";
          defaultDescription = "Spend time writing code for your project. Focus on implementing one specific feature or fixing one bug completely.";
          defaultMetric = "sessions";
          defaultCount = 4;
        } else if (goal.includes("read") || goal.includes("book") || goal.includes("study")) {
          defaultTitle = "Focused Study Session";
          defaultDescription = "Complete a focused study session with no distractions. Take notes on key concepts and review them afterward.";
          defaultMetric = "pages";
          defaultCount = 15;
        } else if (goal.includes("language") || goal.includes("speak") || goal.includes("vocabulary")) {
          defaultTitle = "Language Practice";
          defaultDescription = "Practice your target language by learning 10 new vocabulary words and using each in a complete sentence.";
          defaultMetric = "minutes";
          defaultCount = 20;
        } else {
          defaultTitle = "Goal Progress Session";
          defaultDescription = "Work on your goal of " + goalsText + ". Break it down into small steps and complete one step fully.";
          defaultMetric = "sessions";
          defaultCount = 3;
        }
        
        quest = {
          title: defaultTitle,
          description: defaultDescription,
          targetCount: defaultCount,
          metric: defaultMetric,
          type: questType
        };
        console.log("Using specialized default quest:", quest);
      }
      
      // Validate the quest data
      quest.title = quest.title || "Goal Progress";
      quest.description = quest.description || `Work on specific actions to achieve: ${goalsText}`;
      quest.targetCount = parseInt(quest.targetCount) || 5;
      quest.metric = quest.metric || "times";
      quest.type = questType;
      
      // Display the suggestion
      resultsContainer.innerHTML = `
        <div class="suggestion-card">
          <h3>${quest.title}</h3>
          <p>${quest.description}</p>
          <div class="quest-details">
            <span>Target: ${quest.targetCount} ${quest.metric}</span>
            <span>Type: ${quest.type}</span>
          </div>
          <div class="suggestion-actions">
            <button id="acceptSuggestion" class="sl-action-button">
              <span class="sl-button-label">ACCEPT QUEST</span>
            </button>
            <button id="rejectSuggestion" class="sl-action-button sl-delete-button">
              <span class="sl-button-label">GENERATE ANOTHER</span>
            </button>
          </div>
        </div>
      `;
      
      window.currentSuggestion = quest;
      
      document.getElementById('acceptSuggestion').addEventListener('click', () => {
        acceptQuestSuggestion(quest);
      });
      
      document.getElementById('rejectSuggestion').addEventListener('click', () => {
        generateQuestSuggestion();
      });
      
    } catch (error) {
      console.error("Error generating suggestion:", error);
      resultsContainer.innerHTML = `
        <div class="error-message">
          Error generating suggestion. Please try again.
          <button id="retryGenerateBtn" class="sl-action-button" style="margin-top:10px;width:100%">
            <span class="sl-button-label">RETRY</span>
          </button>
        </div>
      `;
      
      const retryBtn = document.getElementById('retryGenerateBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', generateQuestSuggestion);
      }
    }
  }
export async function acceptQuestSuggestion(quest) {
    try {
      // Create the quest
      await createQuest(quest);
      
      // Show confirmation
      printToTerminal(`Quest "${quest.title}" has been added to your ${quest.type} quests!`, "success");
      
      // Record in history
      const playerRef = db.collection("players").doc(currentUser.uid);
      await playerRef.collection("suggestionHistory").add({
        quest: quest,
        action: "accepted",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Close the window
      windowSystem.closeWindow('suggestQuestWindow');
      
      // Update the quests window to show the new quest
      if (quest.type === 'daily') {
        await windowSystem.updateDailyQuestsWindow();
      } else {
        await windowSystem.updateQuestsWindow();
      }
    } catch (error) {
      console.error("Error accepting suggestion:", error);
      printToTerminal("Failed to add quest. Please try again.", "error");
    }
  }
  
 export function addQuestSuggestionStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .floating-suggest-button {
        position: fixed;
        bottom: 120px;
        right: 20px;
        background: rgba(0, 80, 160, 0.7) !important;
        color: #00c8ff !important;
        padding: 10px 15px;
        border-radius: 50px;
        box-shadow: 0 0 15px rgba(0, 190, 255, 0.4);
        cursor: pointer;
        z-index: 1000;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        border: 1px solid rgba(0, 160, 255, 0.5) !important;
        letter-spacing: 1px;
        padding: 6px 12px;
      background: rgba(0, 80, 160, 0.4);
      color: #00c8ff;
      border-radius: 3px;
      font-family: 'Rajdhani', sans-serif;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      letter-spacing: 0.5px;
      font-size: 12px;
      border: 1px solid rgba(0, 160, 255, 0.3);
      }
      
      .floating-suggest-button:hover {
        background: rgba(0, 100, 200, 0.8) !important;
        box-shadow: 0 0 20px rgba(0, 210, 255, 0.6);
        transform: translateY(-2px);
      }
      
      .floating-suggest-button i {
        color: #00d8ff;
        margin-right: 5px;
      }
      
      #suggestQuestWindow {
        background: rgba(8, 19, 34, 0.85) !important;
        border: 1px solid rgba(0, 160, 255, 0.6) !important;
        box-shadow: 0 0 15px rgba(0, 190, 255, 0.4), inset 0 0 20px rgba(0, 130, 255, 0.1) !important;
        width: 500px;
        height: fit-content;
      }
      
      #suggestQuestWindow::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: 
          repeating-linear-gradient(
            transparent,
            transparent 2px,
            rgba(0, 128, 255, 0.03) 3px,
            transparent 4px
          );
        pointer-events: none;
        z-index: 0;
      }
      
      #suggestionGoalsText {
        width: 100%;
        height: 120px;
        padding: 12px;
        margin: 10px 0 15px;
        background: rgba(0, 40, 80, 0.4);
        color: #e0f7ff;
        border: 1px solid rgba(0, 160, 255, 0.3);
        border-radius: 4px;
        resize: none;
        font-family: 'Rajdhani', sans-serif !important;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      }
      
      #suggestionGoalsText:focus {
        border-color: rgba(0, 180, 255, 0.5);
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3), 0 0 8px rgba(0, 200, 255, 0.4);
        outline: none;
      }
      
      #suggestionGoalsText::placeholder {
        color: rgba(150, 200, 255, 0.5);
      }
      
      .suggestion-type-selector {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        padding: 10px;
        background: rgba(0, 30, 60, 0.3);
        border-radius: 5px;
        border: 1px solid rgba(0, 160, 255, 0.2);
      }
      
      .suggestion-type-selector label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #a0e0ff;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .suggestion-type-selector label:hover {
        color: #00d8ff;
      }
      
      .suggestion-type-selector input {
        margin: 0;
        accent-color: #00a8ff;
      }
      
      #generateSuggestionBtn {
        width: 100%;
        padding: 10px;
        margin-top: 5px;
        background: rgba(0, 80, 160, 0.4);
        color: #00c8ff;
        border: 1px solid rgba(0, 160, 255, 0.4);
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        letter-spacing: 1px;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      #generateSuggestionBtn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.2), transparent);
        transition: all 0.5s ease;
      }
      
      #generateSuggestionBtn:hover {
        background: rgba(0, 100, 200, 0.5);
        box-shadow: 0 0 10px rgba(0, 180, 255, 0.3);
        transform: translateY(-2px);
      }
      
      #generateSuggestionBtn:hover::before {
        left: 100%;
      }
      
      .suggestion-card {
        margin-top: 20px;
        padding: 15px;
        background: rgba(0, 30, 60, 0.3);
        border-left: 3px solid rgba(0, 160, 255, 0.5);
        border-radius: 0 3px 3px 0;
        transition: all 0.3s ease;
      }
      
      .suggestion-card:hover {
        background: rgba(0, 40, 80, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .suggestion-card h3 {
        margin-top: 0;
        color: #00c8ff;
        font-size: 16px;
        font-weight: 600;
        text-shadow: 0 0 5px rgba(0, 200, 255, 0.3);
      }
      
      .quest-details {
        margin: 15px 0;
        display: flex;
        justify-content: space-between;
        font-size: 0.9em;
        color: #88ccff;
        background: rgba(0, 40, 80, 0.3);
        padding: 5px 8px;
        border-radius: 3px;
      }
      
      .suggestion-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      
      .suggestion-actions button {
        flex: 1;
        padding: 8px 0;
        cursor: pointer;
        border: none;
        border-radius: 3px;
        font-weight: 600;
        letter-spacing: 0.5px;
        transition: all 0.2s ease;
      }
      
      #acceptSuggestion {
        background: rgba(0, 80, 160, 0.4);
        color: #00c8ff;
        border: 1px solid rgba(0, 160, 255, 0.4);
      }
      
      #acceptSuggestion:hover {
        background: rgba(0, 100, 200, 0.5);
        transform: translateY(-1px);
      }
      
      #rejectSuggestion {
        background: rgba(40, 40, 40, 0.4);
        color: #a0a0a0;
        border: 1px solid rgba(100, 100, 100, 0.4);
      }
      
      #rejectSuggestion:hover {
        background: rgba(60, 60, 60, 0.5);
        transform: translateY(-1px);
      }
      
      .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 30px;
        color: #00a8ff;
      }
      
      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(0, 160, 255, 0.2);
        border-radius: 50%;
        border-left-color: #00c8ff;
        animation: spin 1s linear infinite;
        box-shadow: 0 0 10px rgba(0, 180, 255, 0.3);
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .error-message {
        color: #ff8080;
        text-align: center;
        margin-top: 20px;
        background: rgba(80, 20, 20, 0.3);
        padding: 10px;
        border-radius: 3px;
        border: 1px solid rgba(255, 100, 100, 0.3);
      }
      
      #suggestionInputContainer {
        padding: 0 15px;
      }
      
      #suggestionInputContainer p {
        color: #00a8ff;
        font-weight: 500;
        margin-top: 5px;
      }
      
      #suggestionResults {
        padding: 0 15px;
        margin-bottom: 15px;
        max-height: 200px;
        overflow-y: auto;
      }
      
      #suggestionResults::-webkit-scrollbar {
        width: 6px;
      }
      
      #suggestionResults::-webkit-scrollbar-track {
        background: rgba(0, 20, 40, 0.3);
        border-radius: 3px;
      }
      
      #suggestionResults::-webkit-scrollbar-thumb {
        background: rgba(0, 140, 255, 0.5);
        border-radius: 3px;
      }
    `;
    
    document.head.appendChild(style);
  }
  