import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js'; // Adjust version as needed
import BOSSES from './bosses.js';
import ITEMS from './items.js';
import ACHIEVEMENTS from './achievements.js';
import { showProfile } from './profile.js';
import { showInventory } from './inventory.js';
import { showHelp } from './commands.js';

const firebaseConfig = {
  apiKey: "AIzaSyAEpfs-P81k4vagCAPlrW_qOXEysllMjGg",
  authDomain: "reawakening-fe981.firebaseapp.com",
  projectId: "reawakening-fe981",
  storageBucket: "reawakening-fe981.appspot.com",
  messagingSenderId: "310750239922",
  appId: "1:310750239922:web:cdfb7c87f2e05c52553dab",
  measurementId: "G-WLY0K1N1TG",
};

firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
const db = firebase.firestore();

// Timer Management System
const timerSystem = {
  timers: new Map(),
  isInitialized: false,
  
  startTimer(id, updateFn, interval = 1000) {
    if (this.timers.has(id)) {
      this.stopTimer(id); // Clear existing timer
    }
    const timerId = setInterval(updateFn, interval);
    this.timers.set(id, timerId);
    return timerId;
  },

  stopTimer(id) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
    }
  },

  stopAllTimers() {
    this.timers.forEach((timerId) => clearInterval(timerId));
    this.timers.clear();
    this.isInitialized = false;
  },

  hasActiveTimer(id) {
    return this.timers.has(id);
  }
};

// Timer initialization and cleanup
function initializeTimers() {
  // Only initialize if not already running
  if (timerSystem.isInitialized) return;
  
  // Start battle timers if not already running
  if (!timerSystem.hasActiveTimer('battleTimers')) {
    timerSystem.startTimer('battleTimers', updateBattleTimers);
  }
  
  // Start daily quest timers if not already running
  if (!timerSystem.hasActiveTimer('questTimers')) {
    timerSystem.startTimer('questTimers', updateDailyQuestTimers);
  }
  
  // Start water intake reset check if not already running
  if (!timerSystem.hasActiveTimer('waterCheck')) {
    timerSystem.startTimer('waterCheck', checkWaterIntakeReset, 60000); // Check every minute
  }
  
  timerSystem.isInitialized = true;
}

// Timer update functions
function updateBattleTimers() {
  if (!currentUser) return;
  
  const timeElements = document.querySelectorAll('.battle-time-remaining');
  timeElements.forEach(element => {
    const endTimeStr = element.dataset.endTime;
    if (!endTimeStr) return;
    
    const endTime = new Date(endTimeStr);
    const now = new Date();
    const remaining = endTime - now;
    
    if (remaining <= 0) {
      element.textContent = "Time's up!";
      // Handle battle timeout
      const bossId = element.dataset.bossId;
      if (bossId) {
        handleBossBattleTimeout(db.collection("players").doc(currentUser.uid), bossId);
      }
    } else {
      element.textContent = `Time Remaining: ${formatTimeRemaining(remaining)}`;
    }
  });
}

function updateDailyQuestTimers() {
  if (!currentUser) return;
  
  const centralTimer = document.getElementById("centralDailyTimer");
  if (!centralTimer) return;
  
  const endOfDay = getEndOfDay();
  const now = new Date();
  const remaining = endOfDay - now;
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const totalDayDuration = endOfDay - startOfDay;
  const progress = ((totalDayDuration - remaining) / totalDayDuration) * 100;
  
  if (remaining <= 0) {
    centralTimer.textContent = "Time's up!";
    // Handle daily reset
    handleDailyReset();
  } else {
    centralTimer.textContent = formatTimeRemaining(remaining);
    // Update progress bar
    const progressBar = centralTimer.parentElement.querySelector(".timer-progress-bar");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }
}

// Add event listeners for page visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    timerSystem.stopAllTimers();
  } else if (currentUser) {
    initializeTimers();
  }
});

// Set persistence to LOCAL (this keeps the user logged in until they explicitly sign out)
auth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("Persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      isAuthenticated = true;
      localStorage.setItem(
        "user",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        })
      );
      await window.initializePlayer();
      await checkRecentPenalties(); // Add this line

    // Welcome sequence with delays
    await printToTerminal("[ SYSTEM RECOGNIZES YOU ]", "system");
    await new Promise(resolve => setTimeout(resolve, 1100));
    await noteManager.loadNotes();
    
    // // Show welcome message with motivation
    // const quote = getRandomItem(MOTIVATION.QUOTES);
    // await printToTerminal(`"${quote.text}"`, "quest");
    // await new Promise(resolve => setTimeout(resolve, 0));
    // await new Promise(resolve => setTimeout(resolve, 0));
  } else {
    // Check localStorage for existing session
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      auth
        .signInWithEmailAndPassword(JSON.parse(storedUser).email)
        .catch(async () => {
          localStorage.removeItem("user");
          currentUser = null;
          isAuthenticated = false;
          await printToTerminal("[ CONNECTION LOST ]", "error");
          await printToTerminal("Hunter Authentication Required", "warning");
        });
    } else {
      currentUser = null;
      isAuthenticated = false;
      await printToTerminal("[ ACCESS DENIED ]", "error");
      await printToTerminal("Use !reawaken to establish connection", "info");
      noteManager.notes.clear();
      noteManager.updateNotesWindow();
    }
  }
});

// Modify the sign out functionality (if you have one)
async function signOut() {
  try {
    await auth.signOut();
    localStorage.removeItem("user"); // Clear stored user data
    currentUser = null;
    isAuthenticated = false;
    printToTerminal("Successfully signed out.");
  } catch (error) {
    printToTerminal("Error signing out: " + error.message);
  }
}

// Terminal State
let isAuthenticated = false;
let currentUser = null;
let playerStats = {
  level: 1,
  exp: 0,
  expNeeded: null, // Add this new field
  gold: 0,
  rank: "E",
  streak: 0,
  questsCompleted: 0,
  achievements: [],
  inventory: [],
  lastDailyCompletion: null,
  profile: {
    name: "",
    title: "Novice",
    picture: "default.png",
    bio: "",
    class: "Hunter",
    joinDate: null,
    unlockedTitles: [], // Added unlockedTitles array
  },
  waterIntake: {
    current: 0,
    lastReset: null,
    streakDays: 0,
  }
};

// Terminal Elements
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const input = document.getElementById("input");
const notification = document.getElementById("notification");

// Terminal Prompt Update
window.updateTerminalPrompt =  function updateTerminalPrompt() {
  const prompt = document.querySelector(".terminal-prompt-user");
  if (prompt) {
    let displayName = playerStats.profile?.name || "PLAYER";
    if (playerStats.profile?.title) {
      displayName = `[${playerStats.profile.title}] ${displayName}`;
      // Apply title color if it exists
      if (playerStats.profile.titleColor) {
        prompt.style.color = playerStats.profile.titleColor;
      } else {
        prompt.style.color = "white"; // Default color
      }
    }
    prompt.textContent = displayName;
  }
}

// Shop system
window.showShop = async function showShop() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("shopWindow");
}

window.showQuestIds = async function showQuestIds() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  
  // Fetch quests
  const regularQuestsSnapshot = await playerRef.collection("quests").get();
  const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();

  printToTerminal("=== QUEST IDs ===\n", "system");

  if (regularQuestsSnapshot.empty && dailyQuestsSnapshot.empty) {
    printToTerminal("No quests found.", "error");
    return;
  }

  // Regular Quests
  if (!regularQuestsSnapshot.empty) {
    printToTerminal("\nRegular Quests:", "info");
    regularQuestsSnapshot.forEach(doc => {
      const quest = doc.data();
      printToTerminal(
        `${quest.title}: <span class="copyable-id" onclick="copyToClipboard('${doc.id}')">${doc.id}</span>`,
        "default"
      );
    });
  }

  // Daily Quests
  if (!dailyQuestsSnapshot.empty) {
    printToTerminal("\nDaily Quests:", "info");
    dailyQuestsSnapshot.forEach(doc => {
      const quest = doc.data();
      printToTerminal(
        `${quest.title}: <span class="copyable-id" onclick="copyToClipboard('${doc.id}')">${doc.id}</span>`,
        "default"
      );
    });
  }

  printToTerminal("\nClick on any ID to copy it to clipboard.", "info");
}

// Add copyToClipboard function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied quest ID: ${text}`);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showNotification('Failed to copy quest ID', 'error');
  });
}

// Make functions available globally
window.showQuestIds = showQuestIds;
window.copyToClipboard = copyToClipboard;

function showNotificationsWindow() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("notificationsWindow");
}

// Command Handler
const commands = {
  "!switch": toggleTerminalDisplay,
  "!sw": toggleTerminalDisplay,
  "!commands": showHelp,
  "!c": showHelp,
  "!reawaken": handleReawaken,
  "!r": handleReawaken,
  "!quests": () => showQuestWindow("normal"),
  "!q": () => showQuestWindow("normal"),
  "!dailyquests": () => showQuestWindow("daily"),
  "!dq": () => showQuestWindow("daily"),
  "!clear": clearTerminal,
  "!cl": clearTerminal,
  "!sleep": handleSleep,
  "!leaderboard": showLeaderboard,
  "!lb": showLeaderboard,
  "!achievements": showAchievements,
  "!ach": showAchievements,
  "!profile": () => showProfile(isAuthenticated),
  "!p": () => showProfile(isAuthenticated),
  "!inventory": showInventory,
  "!i": showInventory,
  "!shop": showShop,
  "!sh": showShop,
  "!addxp": addExperiencePoints,
  "!ax": addExperiencePoints,
  "!reset": handleReset,
  "!update": (args) => {
    if (args.length < 2) {
      printToTerminal(
        "Usage: !update <quest_id> <type> [amount|complete]",
        "warning"
      );
      printToTerminal("Examples:");
      printToTerminal("  !update abc123 daily 5     - Add 5 to progress");
      printToTerminal(
        "  !update abc123 daily complete  - Complete instantly",
        "info"
      );
      return;
    }
    const [questId, type, amount] = args;
    updateQuestProgress(questId, type, amount);
  },
  "!battle": showBossBattles,
  "!b": showBossBattles,
  "!challenge": startBossBattle,
  "!ch": startBossBattle,
  "!progress": updateBattleProgress,
  "!p": updateBattleProgress,
  "!waterDrank": handleWaterIntake,
  "!wd": handleWaterIntake,
  "!waterStatus": showWaterStatus,
  "!ws": showWaterStatus,
  "!motivation": showMotivation,
  "!m": showMotivation,
  "!setname": window.setPlayerName,
  "!settitle": window.setPlayerTitle,
  "!setbio": window.setPlayerBio,
  "!setclass": window.setPlayerClass,
  "!rank": handleRankCommand,
  "!rankprogress": showRankProgress,
  "!penalty": handlePenaltyCommand,
  "!delete": async (args) => {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }

    if (args.length < 2) {
      printToTerminal("Usage: !delete [quest/daily] [questId]", "error");
      return;
    }

    const type = args[0].toLowerCase();
    const questId = args[1];

    if (type !== "quest" && type !== "daily") {
      printToTerminal("Invalid type. Use 'quest' or 'daily'.", "error");
      return;
    }

    await deleteQuest(questId, type === "daily" ? "daily" : "normal");
  },
  "!qid": showQuestIds,
  "!questid": showQuestIds,
  "!notifications": showNotificationsWindow,
  "!n": showNotificationsWindow,
  "!note": () => noteManager.createNote(),
  "!notes": () => windowSystem.showWindow("notesWindow"),
  "!shownotes": () => noteManager.showAllNotes(),
  "!hidenotes": () => noteManager.hideAllNotes(),
};

// Add to command handlers
commands["!penalty"] = handlePenaltyCommand;



// Quest creation state
let creatingQuest = false;
let questCreationState = {
  type: null,
  title: null,
  count: null,
  metric: null,
  description: null,
};

async function showAchievements() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("achievementsWindow");
}

window.startQuestCreation = function startQuestCreation(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  creatingQuest = true;
  questCreationState = {
    type,
    title: null,
    count: null,
    metric: null,
    description: null,
  };

  if (type === "daily") {
    printToTerminal("Creating new daily quest", "info");
  } else {
    printToTerminal("Creating new quest", "info");
  }
  printToTerminal("Enter quest title (or press Enter to cancel):", "info");
}

// Global conversation history for the terminal session
let terminalConversation = [];

input.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const value = input.value.trim();
    input.value = "";

    if (creatingQuest) {
      handleQuestCreation(value);
      return;
    }

    const promptUser = playerStats?.profile?.name?.toUpperCase() || "PLAYER";
    printToTerminal(`${promptUser} : ${value}`, "command");
    terminalConversation.push({ role: "user", content: value });

    if (awaitingResetConfirmation) {
      if (value === "Reset the dungeon") {
        handleReset(["Reset", "the", "dungeon"]);
      } else {
        printToTerminal('Please type "Reset the dungeon" exactly to confirm reset', "warning");
      }
      return;
    }

    const [command, ...args] = value.split(" ");
    if (value.startsWith("!") && commands[command]) {
      commands[command](args);
    } else if (value !== "") {
      if (!isAuthenticated) {
        printToTerminal("You must !reawaken first to chat with the AI.", "error");
        return;
      }

      if (!window.soloAISystem) {
        window.soloAISystem = new SoloAISystem();
      }

      const thinkingMessageId = "ai-thinking-" + Date.now();
      printToTerminal(`<span id="${thinkingMessageId}">SOLO is thinking</span>`, "info");

      const animateDots = () => {
        const thinkingElement = document.getElementById(thinkingMessageId);
        if (!thinkingElement) return;
        const currentText = thinkingElement.innerText;
        if (currentText.endsWith("...")) {
          thinkingElement.innerText = "SOLO is thinking";
        } else {
          thinkingElement.innerText = currentText + ".";
        }
      };
      window.timerManager.startTimer(thinkingMessageId, animateDots, 400);

      try {
        let playerData = {};
        if (currentUser && isAuthenticated) {
          const playerRef = db.collection("players").doc(currentUser.uid);
          const playerDoc = await playerRef.get();
          if (playerDoc.exists) {
            playerData = playerDoc.data();
          }
          const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();
          const normalQuestsSnapshot = await playerRef.collection("quests").get();
          playerData.dailyQuests = dailyQuestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          playerData.normalQuests = normalQuestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const aiResponse = await window.soloAISystem.callDeepSeekAPI(value, terminalConversation, playerData);
        window.timerManager.stopTimer(thinkingMessageId);

        const outputLines = output.querySelectorAll(".terminal-line");
        const thinkingLine = Array.from(outputLines).find(line => line.innerHTML.includes(thinkingMessageId));
        if (thinkingLine) {
          thinkingLine.remove();
        }

        // Prefix with "SOLO AI: " and use "ai" type
        printToTerminal(`SOLO AI: 
${aiResponse}`, "ai"); // Remove "SOLO AI: " prefix here since renderSOLOText will handle it
        terminalConversation.push({ role: "assistant", content: aiResponse });
      } catch (error) {
        printToTerminal(`Error communicating with AI: ${error.message}`, "error");
      }
    }
  }
});

window.handleQuestCreation = async function handleQuestCreation(value) {
  if (value === "") {
    creatingQuest = false;
    questCreationState = {};
    printToTerminal("Quest creation cancelled.", "warning");
    return;
  }

  if (!questCreationState.title) {
    questCreationState.title = value;
    printToTerminal("Enter target count (number):", "info");
  } else if (!questCreationState.count) {
    const count = parseInt(value);
    if (isNaN(count)) {
      printToTerminal("Please enter a valid number:", "warning");
      return;
    }
    questCreationState.count = count;
    printToTerminal("Enter metric (e.g., km, pushups, minutes):", "info");
  } else if (!questCreationState.metric) {
    questCreationState.metric = value;
    printToTerminal(
      "Enter description (optional, press Enter to skip):",
      "info"
    );
  } else if (!questCreationState.description) {
    questCreationState.description = value || "No description";
    // Create the quest
    await createQuest(questCreationState);
    creatingQuest = false;
    questCreationState = {};
  }
}

window.createQuest = async function createQuest(quest) {
    try {
      if (!currentUser || !currentUser.uid) throw new Error("User not authenticated.");
      const questRef = db.collection("players").doc(currentUser.uid)
        .collection(quest.type === "daily" ? "dailyQuests" : "quests");
      const questData = {
        title: quest.title,
        targetCount: quest.count,
        currentCount: 0,
        metric: quest.metric,
        description: quest.description,
        type: quest.type,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        completed: false,
        ...(quest.type === "daily" ? { lastReset: firebase.firestore.FieldValue.serverTimestamp() } : {})
      };
      const docRef = await questRef.add(questData);
      printToTerminal(`${quest.type === "daily" ? "Daily quest" : "Quest"} created successfully!`, "success");
      showNotification("Quest created!");
      windowSystem.updateWindowContent("questsWindow");
      windowSystem.updateWindowContent("dailyQuestsWindow");
      return docRef.id;
    } catch (error) {
      printToTerminal("Error creating quest: " + error.message, "error");
      console.error("Error details:", error);
    }
  };

window.showQuestWindow = async function showQuestWindow(type = "normal") {
  try {
    const questWindow = windowManager.showWindow("quests-window");
    
    // Set the initial active tab
    document.querySelectorAll('.quest-tab').forEach(tab => {
      tab.classList.remove('active-tab');
    });
    document.getElementById(`${type}-quests-tab`).classList.add('active-tab');
    
    // Update quest content based on type
  if (type === "daily") {
      await windowManager.updateQuestsWindow("daily");
  } else {
      await windowManager.updateQuestsWindow("normal");
    }
  } catch (error) {
    console.error("Error showing quest window:", error);
    printToTerminal("Error showing quest window", "error");
  }
}

// Command handlers
window.commandHandlers = {
  "!quests": () => showQuestWindow("normal"),
  "!q": () => showQuestWindow("normal"),
  "!dailyquests": () => showQuestWindow("daily"),
  "!dq": () => showQuestWindow("daily"),
};

// Example function to fetch daily quests
window.fetchDailyQuests = async function fetchDailyQuests() {
  if (!currentUser) return [];
  
  try {
    const dailyQuestsRef = db.collection("players").doc(currentUser.uid).collection("dailyQuests");
    const snapshot = await dailyQuestsRef.get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => {
      const quest = doc.data();
      return {
        id: doc.id,
        title: quest.title,
        description: quest.description || "No description",
        progress: quest.currentCount,
        goal: quest.targetCount,
        metric: quest.metric,
        completed: quest.completed,
        lastCompletion: quest.lastCompletion
      };
    });
  } catch (error) {
    console.error("Error fetching daily quests:", error);
    printToTerminal("Error fetching daily quests: " + error.message, "error");
    return [];
  }
}

// Example function to fetch normal quests
window.fetchNormalQuests = async function fetchNormalQuests() {
  if (!currentUser) return [];
  
  try {
    const questsRef = db.collection("players").doc(currentUser.uid).collection("quests");
    const snapshot = await questsRef.get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => {
      const quest = doc.data();
      return {
        id: doc.id,
        title: quest.title,
        description: quest.description || "No description",
        progress: quest.currentCount,
        goal: quest.targetCount,
        metric: quest.metric,
        completed: quest.completed
      };
    });
  } catch (error) {
    console.error("Error fetching normal quests:", error);
    printToTerminal("Error fetching normal quests: " + error.message, "error");
    return [];
  }
}


async function autoCompleteQuests() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questsSnapshot = await playerRef.collection("quests").get();

    questsSnapshot.forEach(async (doc) => {
      const quest = doc.data();

      // Check if quest is already completed
      if (quest.completed) return;

      // Automatically complete the quest
      await updateQuestProgress(doc.id, "normal", "complete");
      printToTerminal(`Quest "${quest.title}" completed automatically!`, "success");
    });

    const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();

    dailyQuestsSnapshot.forEach(async (doc) => {
      const quest = doc.data();

      // Check if quest is already completed today
      if (quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion)) return;

      // Automatically complete the daily quest
      await updateQuestProgress(doc.id, "daily", "complete");
      printToTerminal(`Daily quest "${quest.title}" completed automatically!`, "success");
    });
  } catch (error) {
    printToTerminal("Error completing quests: " + error.message, "error");
  }
}
window.printToTerminal = async function printToTerminal(text, type = "default") {
  const line = document.createElement("div");
  line.className = "terminal-line";

  // Add typewriter effect only for system messages
  if (type === "system") {
    line.classList.add("typewriter");
  } else if (type === "command") {
    line.classList.add("command-text");
  }

  // Add color class based on message type
  switch (type) {
    case "success":
      line.classList.add("text-success");
      break;
    case "error":
      line.classList.add("text-error");
      break;
    case "warning":
      line.classList.add("text-warning");
      break;
    case "info":
      line.classList.add("text-info");
      break;
    case "quest":
      line.classList.add("text-quest");
      break;
    case "reward":
      line.classList.add("text-reward");
      break;
    case "system":
      line.classList.add("text-system");
      break;
    case "command":
      line.classList.add("text-command");
      break;
    case "ai":
      line.classList.add("text-command"); // Match AI styling to command for consistency
      break;
  }

  // Handle system messages with typewriter effect and rendering
  if (type === "system") {
    line.innerHTML = ""; // Start with empty content
    output.appendChild(line);

    // Pre-render the text with renderSOLOText if available
    const renderedText = window.soloAISystem?.renderSOLOText ? window.soloAISystem.renderSOLOText(text) : text;

    // Typewriter effect with full HTML rendering
    for (let i = 0; i < renderedText.length; i++) {
      line.innerHTML = renderedText.substring(0, i + 1);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Typing delay
    }
  } else if (type === "ai") {
    // AI messages render immediately with renderSOLOText
    const renderedText = window.soloAISystem?.renderSOLOText ? window.soloAISystem.renderSOLOText(text) : text;
    line.innerHTML = renderedText;
    output.appendChild(line);
  } else {
    // Non-system/AI messages use raw text or HTML directly
    line.innerHTML = text;
    output.appendChild(line);
  }

  terminal.scrollTop = terminal.scrollHeight;
};



window.showNotification = function showNotification(message) {
  notification.querySelector(".notification-content").textContent = message;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3333);
}


function clearTerminal() {
  output.innerHTML = "";
}
window.initializePlayer = async function initializePlayer() {
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const doc = await playerRef.get();

    if (doc.exists) {
      playerStats = doc.data();
      // Ensure expNeeded is set if missing or outdated
      if (!playerStats.expNeeded || playerStats.expNeeded !== getExpNeededForLevel(playerStats.level)) {
        playerStats.expNeeded = getExpNeededForLevel(playerStats.level);
        await playerRef.update({ expNeeded: playerStats.expNeeded });
      }
    } else {
      // Initialize new player
      playerStats = {
        level: 1,
        exp: 0,
        expNeeded: getExpNeededForLevel(1), // Set initial expNeeded
        gold: 0,
        rank: "E",
        streak: 0,
        questsCompleted: 0,
        achievements: [],
        inventory: [],
        lastDailyCompletion: null,
        profile: {
          name: "",
          title: "Novice",
          picture: "default.png",
          bio: "",
          class: "Hunter",
          joinDate: firebase.firestore.FieldValue.serverTimestamp(),
          unlockedTitles: [],
        },
        waterIntake: {
          current: 0,
          lastReset: null,
          streakDays: 0,
        }
      };

      await playerRef.set(playerStats);
    }

    // Set up real-time listener for player stats
    playerRef.onSnapshot((snapshot) => {
      if (snapshot.exists) {
        const data = snapshot.data();
        // Update local stats if they differ from database
        if (data.exp !== playerStats.exp || data.level !== playerStats.level || 
            data.gold !== playerStats.gold || data.rank !== playerStats.rank ||
            data.expNeeded !== playerStats.expNeeded) {
          playerStats.exp = data.exp;
          playerStats.level = data.level;
          playerStats.gold = data.gold;
          playerStats.rank = data.rank;
          playerStats.expNeeded = data.expNeeded;
          updateStatusBar();
        }
      }
    });

    updateTerminalPrompt();
    updateStatusBar(); 
  } catch (error) {
    console.error("Error initializing player:", error);
    printToTerminal("Error initializing player: " + error.message, "error");
  }
};
window.updateStatusBar = function updateStatusBar() {
  const statusBar = document.querySelector(".status-bar");
  const expNeeded = playerStats.expNeeded || getExpNeededForLevel(playerStats.level); // Fallback if not set
  const expProgress = (playerStats.exp / expNeeded) * 100;

  statusBar.style.setProperty('--exp-progress', `${expProgress}%`);

  statusBar.innerHTML = `
    <div class="sl-status-item sl-status-rank">
      <div class="sl-rank-hex sl-rank-${playerStats.rank.toLowerCase()}">
        <span>${playerStats.rank}</span>
      </div>
      <span class="sl-status-label">RANK</span>
    </div>
    
    <div class="sl-status-item sl-status-level">
      <div class="sl-level-indicator">
        <span>${playerStats.level}</span>
      </div>
      <span class="sl-status-label">LEVEL</span>
    </div>
    
    <div class="sl-status-item sl-status-exp">
      <div class="sl-exp-container">
        <span class="sl-exp-text">${playerStats.exp.toLocaleString()}/${expNeeded.toLocaleString()}</span>
      </div>
      <span class="sl-status-label">EXPERIENCE</span>
    </div>
    
    <div class="sl-status-item sl-status-gold">
      <div class="sl-gold-display">
        <i class="fas fa-coins sl-gold-icon"></i>
        <span class="sl-gold-amount">${playerStats.gold.toLocaleString()}</span>
      </div>
      <span class="sl-status-label">GOLD</span>
    </div>
  `;

  // Add styles if not already added
  if (!document.getElementById("soloLevelingStatusBarStyles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "soloLevelingStatusBarStyles";
    styleSheet.textContent = `      
      .sl-status-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        padding: 0 10px;
        justify-content: center;
      }
      
      .sl-status-label {
        font-size: 11px;
        color: #00a8ff;
        font-weight: 500;
        margin-top: 4px;
        letter-spacing: 0.5px;
      }
      
      /* Rank styles */
      .sl-rank-hex {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 20, 40, 0.7);
        clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
        font-weight: bold;
        font-size: 16px;
        position: relative;
        z-index: 1;
        text-shadow: 0 0 5px rgba(0, 160, 255, 0.5);
        box-shadow: 0 0 0 2px rgba(0, 160, 255, 0.4);
      }
      
      .sl-rank-hex::after {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: transparent;
        z-index: -1;
        clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
        border: 2px solid currentColor;
      }
      
      .sl-rank-e { color: #00a2ff; }
      .sl-rank-d { color: #00a8ff; }
      .sl-rank-c { color: #00b0ff; }
      .sl-rank-b { color: #00b8ff; }
      .sl-rank-a { color: #00c8ff; }
      .sl-rank-s { 
        color: #00d8ff;
        animation: pulse-soft 2s infinite;
      }
      
      /* Level styles */
      .sl-level-indicator {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 40, 80, 0.5);
        border-radius: 50%;
        border: 2px solid rgba(0, 160, 255, 0.5);
        font-weight: bold;
        color: #ffffff;
        font-size: 16px;
        box-shadow: 0 0 8px rgba(0, 160, 255, 0.3);
        text-shadow: 0 0 5px rgba(0, 160, 255, 0.5);
      }
      
      /* Experience styles */
      .sl-exp-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: fit-content;
      }

      .sl-exp-fill {
        height: 100%;
        background: linear-gradient(to right, #0062ff, #00c8ff);
        border-radius: 3px;
        position: relative;
        box-shadow: 0 0 8px rgba(0, 180, 255, 0.7);
        transition: width 0.5s ease;
      }
      
      .sl-exp-text {
        font-size: 14px;
        color: #e0f7ff;
        margin-top: 4px;
        font-weight: 600;
      }
      
      /* Gold styles */
      .sl-gold-display {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 40, 80, 0.4);
        padding: 4px 10px;
        border-radius: 3px;
        border: 1px solid rgba(0, 160, 255, 0.4);
      }
      
      .sl-gold-icon {
        color: #ffd700;
        font-size: 16px;
        filter: drop-shadow(0 0 3px rgba(255, 215, 0, 0.6));
      }
      
      .sl-gold-amount {
        color: #ffffff;
        font-weight: bold;
        font-size: 16px;
      }
      
      @keyframes pulse-soft {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(styleSheet);
  }
};
// Add this to check and reset daily quests
window.checkDailyQuests = async function checkDailyQuests() {
  if (!currentUser) return;

  const dailyQuestsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("dailyQuests");

  const snapshot = await dailyQuestsRef.get();

  const batch = db.batch();
  let resetPerformed = false;

  snapshot.forEach((doc) => {
    const quest = doc.data();
    const lastReset = quest.lastReset?.toDate() || new Date(0);
    const now = new Date();

    // Check if it's a new day
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getYear() !== now.getYear()
    ) {
      // Reset the daily quest - add to batch for better performance
      batch.update(doc.ref, {
        currentCount: 0,
        completed: false,
        lastReset: firebase.firestore.FieldValue.serverTimestamp(),
      });
      resetPerformed = true;
    }
  });

  if (resetPerformed) {
    await batch.commit();
    console.log("Daily quests have been reset due to new day");
    printToTerminal("Daily quests have been reset for a new day!", "success");
    showNotification("Daily quests reset for a new day!");
  }
}

// Add this function definition
async function handleReawaken() {
  if (!isAuthenticated) {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      currentUser = result.user;
      isAuthenticated = true;
      showNotification("Successfully authenticated!");
      window.initializePlayer();
    } catch (error) {
      printToTerminal("Authentication failed: " + error.message, "error");
    }
  } else {
    printToTerminal("You are already authenticated.", "warning");
  }
}

// Add the sleep handler function
async function handleSleep() {
  if (!isAuthenticated) {
    printToTerminal("You are not awakened.", "warning");
    return;
  }

  try {
    await auth.signOut();
    localStorage.removeItem("user");
    currentUser = null;
    isAuthenticated = false;
    printToTerminal("You have entered sleep mode.", "warning");
    printToTerminal("Type !reawaken to continue.", "info");
  } catch (error) {
    printToTerminal("Error entering sleep mode: " + error.message, "error");
  }
}

// Initialize
window.initializeSystem = async function initializeSystem() {
  try {
    
    // Set the initial reset check
    checkDailyQuestReset();
    
    // Start a timer to check for daily quest resets every 15 minutes
    // We don't need to check every minute, which can cause excessive resets
    window.timerManager.startTimer("dailyQuestResetCheck", () => {
      checkDailyQuestReset();
    }, 15 * 60 * 1000); // Check every 15 minutes
    
    // Load notification badge
    await loadNotificationBadge();
    
  } catch (error) {
    console.error("Error initializing system:", error);
    printToTerminal("Error initializing system: " + error.message, "error");
  }
}

// Initialize systems
document.addEventListener("DOMContentLoaded", async () => {
  await PlayerDB.init();
  initializeQuestListeners();
  await initializeSystem();
  window.soloAISystem = new SoloAISystem(); // Assign to window.soloAISystem

  // Add suggestion box to DOM
  const suggestionBox = document.createElement("div");
  suggestionBox.innerHTML = suggestionBoxHTML;
  document.body.appendChild(suggestionBox);

  // Add new styles
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles + suggestionStyles;
  document.head.appendChild(styleSheet);

  // Update notification badge after a short delay to ensure everything is initialized
  setTimeout(async () => {
    await loadNotificationBadge();
  }, 2000);
});

// Add command autocomplete
window.commandAutocomplete = {
  commands: Object.keys(commands),
  currentSuggestionIndex: 0,

  suggest(input) {
    if (!input) return [];
    if (!input.startsWith("!")) return [];

    return this.commands
      .filter(
        (cmd) =>
          cmd.toLowerCase().startsWith(input.toLowerCase()) && cmd !== input
      )
      .slice(0, 5); // Limit to 5 suggestions
  },

  showNextSuggestion(input) {
    const suggestions = this.suggest(input);
    if (suggestions.length === 0) {
      input.placeholder = "";
      return;
    }

    this.currentSuggestionIndex =
      (this.currentSuggestionIndex + 1) % suggestions.length;
    input.placeholder = suggestions[this.currentSuggestionIndex];
  },
};

// Update input event listener for autocomplete
input.addEventListener("input", (e) => {
  const value = e.target.value;
  if (value.startsWith("!")) {
    commandAutocomplete.currentSuggestionIndex = 0;
    const suggestions = commandAutocomplete.suggest(value);
    input.placeholder = suggestions.length > 0 ? suggestions[0] : "";
  } else {
    input.placeholder = "";
  }
});

// Add tab completion
input.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const value = input.value;
    if (value.startsWith("!")) {
      commandAutocomplete.showNextSuggestion(input);
    }
  } else if (e.key === "Enter") {
    commandAutocomplete.currentSuggestionIndex = 0;
  }
});

// Remove old suggestion box HTML and CSS since we're using placeholder now
const suggestionBoxHTML = "";
const suggestionStyles = "";

// Add notification sounds and animations
window.notificationSystem = {
  sounds: {
    success: new Audio("sounds/success.mp3"),
    warning: new Audio("sounds/warning.mp3"),
    error: new Audio("sounds/error.mp3"),
    buy: new Audio("sounds/buy.mp3"),
    sell: new Audio("sounds/sell.mp3"),
    system: new Audio("sounds/system.mp3"),
    levelup: new Audio("sounds/levelup.mp3"),
    close: new Audio("sounds/close.mp3"),
    activated: new Audio("sounds/activated.mp3"),
  },

  // Function to safely play sounds
  playSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      // Reset the audio to start and play
      sound.currentTime = 0;
      sound.play().catch((error) => {
        console.log(`Error playing sound: ${error}`);
      });
    }
  },

  show(message, type = "info") {
    const notification = document.getElementById("notification");
    const content = notification.querySelector(".notification-content");
    content.textContent = message;
    notification.className = `notification ${type}`;

    // Remove any existing animation classes
    notification.classList.remove("slide-in", "slide-out");

    // Show notification and start slide-in
    notification.style.display = "block";
    notification.classList.add("slide-in");

    // Play the type-specific sound
    this.playSound(type);

    setTimeout(() => {
      // Start slide-out animation
      notification.classList.remove("slide-in");
      notification.classList.add("slide-out");

      // Hide after animation completes
      setTimeout(() => {
        notification.style.display = "none";
        notification.classList.remove("slide-out");
      }, 500); // Match animation duration
    }, 3000);
  },
};

// Update CSS for notifications
window.styles = `
    .notification {
      animation: slideIn 0.5s ease-out;
    }

    .notification.animate {
      animation: shake 0.5s ease-in-out;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(10px); }
      75% { transform: translateX(-10px); }
    }
  `;

// Update the quest listeners
function initializeQuestListeners() {
  if (!currentUser) return;

  // Normal quests listener
  const questsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("quests");
  questsRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const quest = change.doc.data();
        printToTerminal("\nNew quest added:", "info");
        printToTerminal(`[${quest.title}]`, "quest");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal(`Description: ${quest.description}`, "system");
        printToTerminal(`Commands:`, "system");
        printToTerminal(
          `  !update ${change.doc.id} normal <amount>  - Add specific amount`,
          "info"
        );
        printToTerminal(
          `  !update ${change.doc.id} normal complete  - Complete instantly`,
          "info"
        );
        printToTerminal("---", "system");
      } else if (change.type === "modified") {
        const quest = change.doc.data();
        printToTerminal(`\nQuest "${quest.title}" updated:`, "warning");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal("---", "system");
      }
    });
  });

  // Daily quests listener
  const dailyQuestsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("dailyQuests");
  dailyQuestsRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const quest = change.doc.data();
        printToTerminal("\nNew daily quest added:", "info");
        printToTerminal(`[${quest.title}]`, "quest");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal(`Description: ${quest.description}`, "system");
        printToTerminal("Resets daily", "warning");
        printToTerminal(`Commands:`, "system");
        printToTerminal(
          `  !update ${change.doc.id} daily <amount>  - Add specific amount`,
          "info"
        );
        printToTerminal(
          `  !update ${change.doc.id} daily complete  - Complete instantly`,
          "info"
        );
        printToTerminal(
          `  <button class="window-button danger" onclick="deleteQuest('${change.doc.id}', 'daily')">
            Delete Quest
          </button>`,
          "info"
        );
        printToTerminal("---", "system");
      } else if (change.type === "modified") {
        const quest = change.doc.data();
        printToTerminal(`\nDaily quest "${quest.title}" updated:`, "warning");
        printToTerminal(
          `Progress: ${quest.currentCount}/${quest.targetCount} ${quest.metric}`,
          "info"
        );
        printToTerminal("---", "system");
      }
    });
  });
}

// UI update functions
window.updateQuestUI = function updateQuestUI(quest, questId, type) {
  const windowId = type === "daily" ? "dailyQuestsWindow" : "questsWindow";
  const questList = document.getElementById(type === "daily" ? "dailyQuestsList" : "activeQuestsList");
  let questElement = document.getElementById(`quest-${questId}`);

  if (!questElement) {
    questElement = document.createElement("div");
    questElement.id = `quest-${questId}`;
    questElement.className = "window-item";
    questList.appendChild(questElement);
  }

  const endOfDay = getEndOfDay();
  const timeRemaining = endOfDay - new Date();
  const isCompletedToday = quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion);

  questElement.innerHTML = `
    <div class="window-item-title">
      ${quest.title}
      ${isCompletedToday ? '<span class="completion-badge">✓</span>' : ""}
    </div>
    <div class="window-item-description">
      Progress: 
      <input type="number" 
             value="${isCompletedToday ? quest.targetCount : quest.currentCount}" 
             min="0" 
             max="${quest.targetCount}" 
             onchange="updateQuestCount('${questId}', '${type}', this.value)"
             style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);"
             ${isCompletedToday ? "disabled" : ""}>
      /${quest.targetCount} ${quest.metric}
    </div>
    <div class="window-item-description">${quest.description}</div>
    <div class="window-item-description">
      ${type === "daily" ? (isCompletedToday ? "Completed Today" : `Time remaining: ${formatTimeRemaining(timeRemaining)}`) : ""}
    </div>
    <div class="window-item-progress">
      <div class="window-item-progress-bar" style="width: ${isCompletedToday ? 100 : (quest.currentCount / quest.targetCount) * 100}%"></div>
    </div>
    `;
}

window.removeQuestFromUI = function removeQuestFromUI(questId, type) {
  const questElement = document.getElementById(`quest-${questId}`);
  if (questElement) {
    questElement.remove();
  }
}

// Add this IndexedDB initialization code
const dbName = "PlayerSystemDB";
const dbVersion = 1;

// IndexedDB helper class
window.PlayerDB = class PlayerDB {
  static async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create stores
        if (!db.objectStoreNames.contains("playerData")) {
          db.createObjectStore("playerData", { keyPath: "uid" });
        }
        if (!db.objectStoreNames.contains("quests")) {
          db.createObjectStore("quests", { keyPath: "id" });
        }
      };
    });
  }

  static async savePlayer(playerData) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["playerData"], "readwrite");
      const store = transaction.objectStore("playerData");
      const request = store.put(playerData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async getPlayer(uid) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["playerData"], "readonly");
      const store = transaction.objectStore("playerData");
      const request = store.get(uid);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Leaderboard function
async function showLeaderboard() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  windowSystem.showWindow("leaderboardWindow");
}

window.checkAchievements = async function checkAchievements() {
  if (!isAuthenticated) return;

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();

    // Initialize achievements object and unlockedAchievements array if they don't exist
    if (!player.achievements) {
      await playerRef.update({ achievements: {}, unlockedAchievements: [] });
      player.achievements = {};
      player.unlockedAchievements = [];
    } else if (!player.unlockedAchievements) {
      await playerRef.update({ unlockedAchievements: [] });
      player.unlockedAchievements = [];
    }

    let achievementsUpdated = false; // Flag to track if any achievements were updated

    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
      // Initialize achievement in player data if not exists
      if (!player.achievements[achievement.id]) {
        player.achievements[achievement.id] = { currentRank: 0 };
      }

      const currentAchievement = player.achievements[achievement.id];
      const nextRank = currentAchievement.currentRank + 1;

      // Skip if already at max rank
      if (nextRank > achievement.ranks.length) continue;

      const rankData = achievement.ranks[nextRank - 1];
      let completed = false;

      switch (achievement.type) {
        case "level":
          completed = player.level >= rankData.requirement;
          break;
        case "quests_completed":
          completed = player.questsCompleted >= rankData.requirement;
          break;
        case "daily_streak":
          completed = player.streak >= rankData.requirement;
          break;
        case "water_streak":
          completed = player.waterIntake?.streakDays >= rankData.requirement;
          break;
        case "total_gold":
          completed = player.gold >= rankData.requirement;
          break;
        case "rank":
          completed = isRankSufficient(player.rank, rankData.requirement);
          break;
      }

      if (completed) {
        try {
          // Prepare updates for database
          const updates = {
            [`achievements.${achievement.id}.currentRank`]: nextRank,
            exp: firebase.firestore.FieldValue.increment(rankData.reward.exp),
            gold: firebase.firestore.FieldValue.increment(rankData.reward.gold),
          };

          // If this is the first rank (currentRank was 0), add to unlockedAchievements
          if (currentAchievement.currentRank === 0) {
            updates.unlockedAchievements = firebase.firestore.FieldValue.arrayUnion(achievement.id);
          }

          // Update achievement rank and grant rewards in the database
          await playerRef.update(updates);

          // Update local stats *after* successful database update
          playerStats.exp += rankData.reward.exp;
          playerStats.gold += rankData.reward.gold;
          if (!playerStats.achievements) playerStats.achievements = {};
          if (!playerStats.achievements[achievement.id]) {
            playerStats.achievements[achievement.id] = { currentRank: 0 };
          }
          playerStats.achievements[achievement.id].currentRank = nextRank;

          // Update local unlockedAchievements
          if (currentAchievement.currentRank === 0 && !player.unlockedAchievements.includes(achievement.id)) {
            player.unlockedAchievements.push(achievement.id);
            playerStats.unlockedAchievements = player.unlockedAchievements; // Sync with playerStats
          }

          const rankText =
            nextRank === achievement.ranks.length ? "MAX" : nextRank;
          showNotification(
            `Achievement Ranked Up: ${achievement.name} Rank ${rankText}! ${achievement.icon}`
          );
          printToTerminal(
            `🏆 Achievement Ranked Up: ${achievement.name} (Rank ${rankText})`,
            "success"
          );
          printToTerminal(`${achievement.description}`, "info");
          printToTerminal(
            `Rewards: ${rankData.reward.exp} EXP, ${rankData.reward.gold} gold`,
            "reward"
          );

          achievementsUpdated = true; // Set flag to true

        } catch (error) {
          console.error("Error updating achievement:", error);
          printToTerminal(`Error updating achievement ${achievement.name}: ${error.message}`, "error");
        }
      }
    }

    // Check for level up and rank up *after* the achievement loop
    if (achievementsUpdated) {
      await checkLevelUp(playerRef, playerStats.exp);
      updateStatusBar();
      await checkAndUpdateRank(playerRef, playerStats);
      audioSystem.playVoiceLine('ACHIEVEMENT');
    }

  } catch (error) {
    console.error("Check achievements error:", error);
    printToTerminal(`Error checking achievements: ${error.message}`, "error");
  }
};

window.getExpNeededForLevel = function getExpNeededForLevel(level) {
  const baseXP = 100;
  const linearThreshold = 20; // Levels that follow a linear pattern
  const scalingFactor = 1.12; // Adjusted for 5-6 months progression
  const maxLevel = 100;

  let expNeeded;
  // Linear growth for first few levels to ease early progression
  if (level <= linearThreshold) {
    expNeeded = Math.floor(baseXP + (level - 1) * 50);
  } else {
    // Smooth exponential growth after the threshold
    expNeeded = Math.floor(baseXP * Math.pow(scalingFactor, level - linearThreshold) + (level * 100));
  }

  // Update playerStats and Firestore if authenticated
  if (isAuthenticated && currentUser) {
    updateExpNeededInPlayerStats(level, expNeeded);
  }

  return expNeeded;
};

// New function to update expNeeded in playerStats and Firestore
async function updateExpNeededInPlayerStats(level, expNeeded) {
  try {
    // Only update if the level matches the player's current level and expNeeded has changed
    if (playerStats.level === level && playerStats.expNeeded !== expNeeded) {
      playerStats.expNeeded = expNeeded; // Update local stats

      const playerRef = db.collection("players").doc(currentUser.uid);
      await playerRef.update({
        expNeeded: expNeeded,
      });

      console.log(`Updated expNeeded for level ${level}: ${expNeeded}`);
      // Optional: Notify in terminal
      // printToTerminal(`XP needed for level ${level}: ${expNeeded}`, "info");
    }
  } catch (error) {
    console.error("Error updating expNeeded in Firestore:", error);
    printToTerminal("Error updating expNeeded: " + error.message, "error");
  }
}

// New function to log to Firestore
async function logExpNeededToFirestore(level, expNeeded) {
  if (!isAuthenticated || !currentUser) {
    console.log("Cannot log XP requirement: User not authenticated.");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const expLogRef = playerRef.collection("expLogs"); // Subcollection for XP logs

    await expLogRef.add({
      level: level,
      expNeeded: expNeeded,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Logged XP needed for level ${level}: ${expNeeded}`);
  } catch (error) {
    console.error("Error logging XP requirement to Firestore:", error);
    printToTerminal("Error logging XP requirement: " + error.message, "error");
  }
}

async function checkLevelUp(playerRef, currentExp) {
  let remainingExp = currentExp;
  let levelsGained = 0;
  let currentLevel = playerStats.level;

  // Keep leveling up while we have enough XP
  while (remainingExp >= (playerStats.expNeeded || getExpNeededForLevel(currentLevel))) {
    remainingExp -= playerStats.expNeeded || getExpNeededForLevel(currentLevel);
    levelsGained++;
    currentLevel++;
    // Update expNeeded for the new level
    playerStats.expNeeded = getExpNeededForLevel(currentLevel);
  }

  if (levelsGained > 0) {
    // Play level-up sound for level up
    notificationSystem.playSound("levelup");
    audioSystem.playVoiceLine('LEVEL_UP');

    // Update local stats first for immediate feedback
    playerStats.level += levelsGained;
    playerStats.exp = remainingExp;
    playerStats.expNeeded = getExpNeededForLevel(playerStats.level);

    // Update Firestore
    await playerRef.update({
      level: playerStats.level,
      exp: remainingExp,
      expNeeded: playerStats.expNeeded
    });

    // Print level-up message to terminal
    printToTerminal(`LEVEL UP! You are now level ${playerStats.level}!`, "success");
    showNotification(`Leveled up to level ${playerStats.level}!`);
    await updateStatusBar();
    // Check for rank up
    await checkAndUpdateRank(playerRef, playerStats);
  }
}

async function completeBossBattle(bossId, currentCount) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const bossBattleRef = playerRef.collection("activeBattles").doc(bossId);

    const battleDoc = await bossBattleRef.get();
    if (!battleDoc.exists) {
      printToTerminal("Boss battle not found.", "error");
      return;
    }

    const battle = battleDoc.data();
    if (currentCount < battle.targetCount) {
      printToTerminal(`Progress insufficient. Current: ${currentCount}/${battle.targetCount}`, "error");
      return;
    }

    // Get boss data from the battle document or fetch it if not available
    let boss;
    if (battle.bossData) {
      boss = battle.bossData;
    } else {
      // Try to get boss data from BOSSES object first
      boss = BOSSES[bossId.toUpperCase()];
      
      // If not found in BOSSES, try to fetch from database
      if (!boss) {
        const bossDoc = await db.collection("bosses").doc(bossId).get();
        if (!bossDoc.exists) {
          printToTerminal("Boss not found in database or BOSSES object.", "error");
          return;
        }
        boss = bossDoc.data();
      }
    }

    const playerDoc = await playerRef.get();
    const player = playerDoc.data();
    const defeatCount = player?.defeatedBosses?.[bossId] || 0;

    const scaledExp = boss.rewards.exp + (defeatCount * (boss.scaling?.rewards?.exp || 0));
    const scaledGold = boss.rewards.gold + (defeatCount * (boss.scaling?.rewards?.gold || 0));

    printToTerminal("\n🏆 BOSS DEFEATED! 🏆", "success");
    printToTerminal(`You have defeated ${boss.name}!`, "success");
    printToTerminal("\nRewards received:", "info");
    printToTerminal(`+ ${scaledExp} XP`, "reward");
    printToTerminal(`+ ${scaledGold} Gold`, "reward");
    if (boss.rewards.title) {
      printToTerminal(`+ Title: ${boss.rewards.title}`, "reward");
    }

    await db.runTransaction(async (transaction) => {
      const playerDocInTx = await transaction.get(playerRef);
      if (!playerDocInTx.exists) return;

      const playerData = playerDocInTx.data();
      const defeatedBosses = playerData.defeatedBosses || {};
      defeatedBosses[bossId] = (defeatedBosses[bossId] || 0) + 1;

      // Get correct exp and gold fields based on your data structure
      const currentExp = playerData.stats?.exp || playerData.exp || 0;
      const currentGold = playerData.stats?.gold || playerData.gold || 0;
      
      const updatedExp = currentExp + scaledExp;
      const updatedGold = currentGold + scaledGold;

      let titleUpdate = {};
      if (boss.rewards.title) {
        titleUpdate = {
          "profile.title": boss.rewards.title,
          "profile.titleColor": boss.rewards.titleColor || null
        };
      }

      // Update with the correct path to exp and gold
      const statsUpdate = playerData.stats ? {
        "stats.exp": updatedExp,
        "stats.gold": updatedGold
      } : {
        exp: updatedExp,
        gold: updatedGold
      };

      transaction.update(playerRef, {
        ...statsUpdate,
        defeatedBosses: defeatedBosses,
        ...titleUpdate
      });

      transaction.delete(bossBattleRef);

      // Update playerStats based on your data structure
      if (playerStats.stats) {
        playerStats.stats.exp = updatedExp;
        playerStats.stats.gold = updatedGold;
      } else {
        playerStats.exp = updatedExp;
        playerStats.gold = updatedGold;
      }
      
      if (boss.rewards.title) {
        if (!playerStats.profile) playerStats.profile = {};
        playerStats.profile.title = boss.rewards.title;
        playerStats.profile.titleColor = boss.rewards.titleColor || null;
      }
    });

    // Call checkLevelUp with the proper arguments based on your data structure
    if (playerStats.stats) {
      await checkLevelUp(playerRef, playerStats.stats.exp);
    } else {
      await checkLevelUp(playerRef, playerStats.exp);
    }
    
    audioSystem.playVoiceLine('VICTORY');
    updateStatusBar();
    windowSystem.updateWindowContent("BattleWindow");
    windowSystem.updateWindowContent("profileWindow");

    await db.collection("notifications").add({
      userId: currentUser.uid,
      type: "victory",
      message: `You defeated ${boss.name} and earned ${scaledExp} XP and ${scaledGold} Gold!`,
      timestamp: firebase.firestore.Timestamp.now(),
      read: false
    });

    const count = await windowSystem.getUnreadNotificationsCount();
    windowSystem.updateNotificationBadge(count);
    await windowSystem.updateBattleWindow();

  } catch (error) {
    console.error("Error completing boss battle:", error);
    printToTerminal("Error completing boss battle: " + error.message, "error");
  }
};

// Ensure this function is globally available
window.checkLevelUp = checkLevelUp;
window.completeBossBattle = completeBossBattle;

window.completeQuest = async function completeQuest(questId, type = 'normal') {
  if (!isAuthenticated || !currentUser) {
    console.error('User not authenticated');
    return { success: false, error: 'You must be authenticated to complete quests' };
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questsCollection = type === 'daily' ? 'dailyQuests' : 'quests';
    
    // First, try to find the quest by ID
    let questRef = playerRef.collection(questsCollection).doc(questId);
    let questDoc = await questRef.get();
    
    // If not found by ID, try to find by title
    if (!questDoc.exists) {
      console.log(`Quest not found by ID, searching by title: ${questId}`);
      const querySnapshot = await playerRef.collection(questsCollection)
        .where('title', '==', questId)
        .limit(1)
        .get();
      
      if (querySnapshot.empty) {
        console.error(`No ${type} quest found with ID or title: ${questId}`);
        return { success: false, error: 'Quest not found' };
      }
      
      questDoc = querySnapshot.docs[0];
      questRef = questDoc.ref;
    }
    
    const quest = questDoc.data();
    console.log(`Found quest to complete:`, quest);
    
    // Check if daily quest is already completed today
    if (type === 'daily' && quest.completed && quest.lastCompletion) {
      const lastCompletion = quest.lastCompletion.toDate ? quest.lastCompletion.toDate() : new Date(quest.lastCompletion);
      const today = new Date();
      
      // Compare date parts only
      if (lastCompletion.getDate() === today.getDate() && 
          lastCompletion.getMonth() === today.getMonth() && 
          lastCompletion.getFullYear() === today.getFullYear()) {
        console.log('Daily quest already completed today');
        return { 
          success: false, 
          error: 'This daily quest has already been completed today. It will reset tomorrow.' 
        };
      }
    }
    
    // Check if normal quest is already completed
    if (type === 'normal' && quest.completed) {
      console.log('Normal quest already completed');
      return { 
        success: false, 
        error: 'This quest has already been completed.' 
      };
    }
    
    // Calculate rewards based on quest difficulty
    const expGained = Math.floor(quest.targetCount * 10);
    const goldGained = Math.floor(quest.targetCount * 5);
    
    // Update the quest and player stats in a transaction
    const result = await db.runTransaction(async (transaction) => {
      // First, get all the data we need
      const playerDoc = await transaction.get(playerRef);
      const playerData = playerDoc.data();
      
      // Now perform all writes after all reads
      
      if (type === 'daily') {
        // For daily quests, mark as completed with timestamp
        transaction.update(questRef, {
          currentCount: quest.targetCount,
          completed: true,
          lastCompletion: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Check if this is a new day compared to last completion
        const lastDailyCompletion = playerData.lastDailyCompletion?.toDate ? 
          playerData.lastDailyCompletion.toDate() : 
          playerData.lastDailyCompletion ? new Date(playerData.lastDailyCompletion) : null;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (!lastDailyCompletion || lastDailyCompletion < today) {
          transaction.update(playerRef, {
            streak: firebase.firestore.FieldValue.increment(1),
            lastDailyCompletion: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // For normal quests, delete after completion
        transaction.delete(questRef);
      }
      
      // Update player stats
      transaction.update(playerRef, {
        exp: firebase.firestore.FieldValue.increment(expGained),
        gold: firebase.firestore.FieldValue.increment(goldGained),
        questsCompleted: firebase.firestore.FieldValue.increment(1)
      });
      
      return {
        expGained,
        goldGained,
        questTitle: quest.title
      };
    });
    
    // Update local player stats
    playerStats.exp += expGained;
    playerStats.gold += goldGained;
    playerStats.questsCompleted += 1;
    
    if (type === 'daily') {
      playerStats.streak += 1;
    }
    
    // Update UI
    updateStatusBar();
    
    // Check for level up
    await checkLevelUp(db.collection("players").doc(currentUser.uid), playerStats.exp);
    
    // Check achievements
    await checkAchievements();
    
    // Update UI to reflect changes
    if (type === 'daily') {
      windowSystem.updateWindowContent("dailyQuestsWindow");
    } else {
      windowSystem.updateWindowContent("questsWindow");
      // Remove the quest from UI immediately
      removeQuestFromUI(questDoc.id, type);
    }
    
    console.log(`Quest "${quest.title}" completed successfully. Rewards: ${expGained} XP, ${goldGained} gold`);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Error completing quest:', error);
    return { success: false, error: error.message };
  }
};

window.updateQuestProgress = async function updateQuestProgress(questId, type, amount) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questRef = playerRef.collection(type === "daily" ? "dailyQuests" : "quests").doc(questId);
    const quest = (await questRef.get()).data();

    if (!quest) {
      printToTerminal("Quest not found.", "error");
      return;
    }

    // Check if quest was already completed today
    if (quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion)) {
      printToTerminal("Quest already completed today.", "warning");
        return;
    }

    let newCount = quest.currentCount;
    if (amount === "complete") {
      newCount = quest.targetCount;
    } else {
      const addAmount = parseInt(amount);
      if (isNaN(addAmount)) {
        printToTerminal("Invalid amount. Please enter a number.", "error");
        return;
      }
      newCount = Math.min(quest.targetCount, quest.currentCount + addAmount);
    }

    // Update quest progress
      await questRef.update({
        currentCount: newCount,
      completed: newCount >= quest.targetCount,
      lastCompletion: newCount >= quest.targetCount ? firebase.firestore.FieldValue.serverTimestamp() : null
    });

    // If quest is completed, update player stats
    if (newCount >= quest.targetCount && (!quest.completed || !wasCompletedToday(quest.lastCompletion))) {
      const expReward = type === "daily" ? 50 : 25;
      const goldReward = type === "daily" ? 25 : 15;

      await playerRef.update({
        questsCompleted: firebase.firestore.FieldValue.increment(1),
        exp: firebase.firestore.FieldValue.increment(expReward),
        gold: firebase.firestore.FieldValue.increment(goldReward)
      });

      printToTerminal(`Quest completed! Earned ${expReward} XP and ${goldReward} gold.`, "success");
      showNotification("Quest completed!", "success");
      audioSystem.playVoiceLine("QUEST_COMPLETE");
    } else {
      printToTerminal(`Quest progress updated: ${newCount}/${quest.targetCount}`, "info");
    }

    // Update UI
    updateQuestUI(quest, questId, type);
  } catch (error) {
    console.error("Error updating quest progress:", error);
    printToTerminal("Error updating quest progress: " + error.message, "error");
  }
}
function wasCompletedToday(dateInput) {
  if (!dateInput) return false;

  const date = dateInput instanceof Date ? dateInput : dateInput.toDate();
  const now = new Date();
  const today = new Date();
  
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

window.wasCompletedToday = wasCompletedToday; // Make globally available if needed
window.sellShard = async function sellShard(shardId, quantity) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const player = playerDoc.data();

    const shards = player.inventory.filter(item => item.id === shardId);
    if (shards.length === 0) {
      printToTerminal("Invalid shard to sell.", "error");
      return;
    }

    const totalQuantity = Math.min(quantity, shards.length);
    const goldReward = shards[0].goldValue * totalQuantity;

    // Remove the specified quantity of shards from the inventory
    const shardsToRemove = shards.slice(0, totalQuantity);
    await playerRef.update({
      inventory: firebase.firestore.FieldValue.arrayRemove(...shardsToRemove),
      gold: firebase.firestore.FieldValue.increment(goldReward)
    });

    // Update local stats
    playerStats.inventory = playerStats.inventory.filter(item => item.id !== shardId || --totalQuantity > 0);
    playerStats.gold += goldReward;

    printToTerminal(`Sold ${totalQuantity} ${shards[0].name}${totalQuantity > 1 ? 's' : ''} for ${goldReward} gold!`, "success");
    showNotification(`Sold ${totalQuantity} ${shards[0].name}${totalQuantity > 1 ? 's' : ''} for ${goldReward} gold!`);

    // Update UI
    windowSystem.updateWindowContent("inventoryWindow");
    updateStatusBar();
  } catch (error) {
    printToTerminal("Error selling shard: " + error.message, "error");
    console.error("Sell shard error:", error);
  }
}


window.useShard = async function useShard(shardId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  // Find the shard in inventory
  const shard = player.inventory.find(item => item.id === shardId);
  if (!shard) {
    printToTerminal("Shard not found in inventory.", "error");
    return;
  }

  try {
    // Use the shard (implementation depends on what the shard does)
    // ...

    // Update inventory - create a new array instead of modifying the constant
    const updatedInventory = player.inventory.filter(item => item.id !== shardId);
    
    await playerRef.update({
      inventory: updatedInventory
    });

    // Update local stats
    playerStats.inventory = updatedInventory;

    printToTerminal("Shard used successfully!", "success");
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Use shard error: " + error, "error");
    console.error("Use shard error:", error);
  }
}

window.attemptShardDrop =  function attemptShardDrop() {
  const dropChance = Math.random();
  const dropThreshold = 1; // 30% chance to drop a shard

  if (dropChance < dropThreshold) {
    const droppedShard = {
      id: "crystal_shard",
      name: "Crystal Shard",
      description: "Use to gain XP and sell for gold",
      type: "shard"
    };

    // Generate random XP and gold values with a limit and rarity
    const maxXP = 200; // Maximum XP value
    const maxGold = 200; // Maximum gold value
    const xpValue = Math.floor(Math.pow(Math.random(), 2) * maxXP) + 1; // Higher rarity for high XP
    const goldValue = Math.floor(Math.pow(Math.random(), 2) * maxGold) + 1; // Higher rarity for high gold

    droppedShard.xpValue = xpValue;
    droppedShard.goldValue = goldValue;

    // Add the shard to player's inventory in the database
    const playerRef = db.collection("players").doc(currentUser.uid);
    playerRef.update({
      inventory: firebase.firestore.FieldValue.arrayUnion(droppedShard)
    }).then(() => {
      // Update local stats
      if (!playerStats.inventory) {
        playerStats.inventory = [];
      }
      playerStats.inventory.push(droppedShard);
      
      showNotification(`You received: ${droppedShard.name} - ${droppedShard.description} (${droppedShard.xpValue} XP, ${droppedShard.goldValue} gold)`);
      
      // Update inventory window if it's open
      windowSystem.updateWindowContent("inventoryWindow");
    }).catch((error) => {
      console.error("Error adding shard to inventory:", error);
      showNotification("Error adding shard to inventory. Please try again.");
    });
  } else {
    showNotification("No shards dropped this time.");
  }
}


// Add these utility functions for time management
function getEndOfDay() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatTimeRemaining(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}


// Add timer check interval
let timerInterval;

function startDailyQuestTimer() {
  // Initial check for resets - this only runs once when timer starts
  checkDailyQuestReset();

  // Update the central timer display
  const updateDailyTimer = () => {
    const endOfDay = getEndOfDay();
    const now = new Date();
    const remaining = endOfDay - now;
    
    // If we've reached the end of the day, just update the timer display
    // Let the dedicated checkDailyQuestReset handle the actual reset
    if (remaining <= 0) {
      const newEndOfDay = new Date(now);
      newEndOfDay.setDate(newEndOfDay.getDate() + 1);
      newEndOfDay.setHours(0, 0, 0, 0);
      
      // Update display with time until next day
      const timeToNextDay = newEndOfDay - now;
      const centralTimerElement = document.getElementById("centralDailyTimer");
      if (centralTimerElement) {
        centralTimerElement.textContent = formatTimeRemaining(timeToNextDay);
      }
      return;
    }
    
    // Normal timer updates
    const centralTimerElement = document.getElementById("centralDailyTimer");
    if (centralTimerElement) {
      centralTimerElement.textContent = formatTimeRemaining(remaining);
    }
    
    // Update individual quest timers
    const questTimers = document.querySelectorAll(".daily-quest-timer");
    questTimers.forEach(timer => {
      timer.textContent = formatTimeRemaining(remaining);
    });
    
    // Update the progress bar
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const totalDayDuration = endOfDay - startOfDay;
    const progress = ((totalDayDuration - remaining) / totalDayDuration) * 100;
    const progressBars = document.querySelectorAll(".timer-progress-bar");
    progressBars.forEach(bar => {
      bar.style.width = `${progress}%`;
    });
  };
  
  // Initial update
  updateDailyTimer();
  
  // Set up timer to update every second
  window.timerManager.startTimer("dailyQuestTimer", updateDailyTimer, 1000);
}

// Add this after the command handler
let awaitingResetConfirmation = false;

async function handleReset(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const confirmationPhrase = "Reset the dungeon";
  const userInput = args.join(" ");

  if (!awaitingResetConfirmation) {
    printToTerminal("⚠️ WARNING: This will reset your progress!", "warning");
    printToTerminal(
      "Resetting: Level, EXP, Gold, Rank, Achievements, Streak, Title, Class, Bio, Water, Inventory, Items, Bosses, Quests, Notifications.",
      "warning"
    );
    printToTerminal(`\nTo confirm, type "${confirmationPhrase}"`, "warning");

    awaitingResetConfirmation = true;
    return;
  }

  if (userInput === confirmationPhrase) {
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);

      // Delete all notifications for the user
      const notificationsSnapshot = await db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .get();
      
      const batch = db.batch();
      notificationsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Reset level, exp, gold, rank, achievements, streak, and quests count
      await playerRef.update({
        inventory: [],
        profile: {
          ...playerStats.profile,
        title: "Novice",
        class: "Hunter",
          bio: "",
        },
        level: 1,
        exp: 0,
        gold: 0,
        rank: "E",
        achievements: [],
        streak: 0,
        waterIntake: 0,
        questsCompleted: 0,
      });

      // Update local stats
      playerStats.level = 1;
      playerStats.exp = 0;
      playerStats.gold = 0;
      playerStats.rank = "E";
      playerStats.achievements = [];
      playerStats.streak = 0;
      playerStats.questsCompleted = 0;
      playerStats.profile.title = "Novice";
      playerStats.profile.class = "Hunter";
      playerStats.profile.bio = "";

      // Update UI
      updateStatusBar();
      windowSystem.updateWindowContent("achievementsWindow");
      windowSystem.updateWindowContent("profileWindow");
      windowSystem.updateWindowContent("questsWindow");
      windowSystem.updateWindowContent("dailyQuestsWindow");
      windowSystem.updateWindowContent("notificationsWindow");
      windowSystem.updateNotificationBadge(0); // Reset notification badge count

      printToTerminal("Progress has been reset!", "success");
      printToTerminal("Level reset to 1", "info");
      printToTerminal("Experience reset to 0", "info");
      printToTerminal("Gold reset to 0", "info");
      printToTerminal("Rank reset to E", "info");
      printToTerminal("Title reset to Novice", "info");
      printToTerminal("Class reset to Hunter", "info");
      printToTerminal("Bio cleared", "info");
      printToTerminal("Achievements progress reset", "info");
      printToTerminal("Completed quests count reset to 0", "info");
      printToTerminal("All notifications cleared", "info");
      showNotification("Progress has been reset!");
    } catch (error) {
      printToTerminal("Error resetting progress: " + error.message, "error");
      console.error("Reset error:", error);
    }
  } else {
    printToTerminal(
      `Please type "${confirmationPhrase}" exactly to confirm reset`,
      "warning"
    );
  }

  // Always reset the confirmation flag after handling
  awaitingResetConfirmation = false;
}

async function updateBattleProgress(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const [bossId, progressIncrement] = args;
    if (!bossId) {
      printToTerminal("Usage: !progress <bossId> [amount]", "error");
      return;
    }

    // Check if BOSSES is defined
    if (!BOSSES || typeof BOSSES !== "object") {
      printToTerminal("Boss data is not properly initialized.", "error");
      console.error("BOSSES is invalid:", BOSSES);
      return;
    }

    const playerRef = db.collection("players").doc(currentUser.uid);
    const boss = BOSSES[bossId.toUpperCase()]; // Use uppercase key to match object structure
    if (!boss) {
      printToTerminal(`Invalid boss ID: ${bossId}`, "error");
      return;
    }

    const battleRef = playerRef.collection("activeBattles").doc(bossId);
    const battleDoc = await battleRef.get();
    if (!battleDoc.exists) {
      printToTerminal("No active battle found for this boss.", "error");
      return;
    }

    let battleData = battleDoc.data();
    let currentProgress = battleData.currentCount || 0;
    const requiredProgress = battleData.targetCount || boss.targetCount || 100;

    // Update progress
    currentProgress += parseInt(progressIncrement, 10) || 1;
    await battleRef.update({ currentCount: currentProgress });

    // Check if battle is won
    if (currentProgress >= requiredProgress) {
      await completeBossBattle(bossId, currentProgress);
      updateStatusBar();
    } else {
      printToTerminal(`Battle progress updated: ${currentProgress}/${requiredProgress}`, "info");
    }
  } catch (error) {
    printToTerminal(`Error updating battle progress: ${error.message}`, "error");
    console.error("Battle progress error:", error);
  }
}
function formatTimeLimit(milliseconds) {
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  } else {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
}


// Add motivational quotes and tips system
const MOTIVATION = {
  MILESTONE_MESSAGES: {
    LEVEL_UP: [
      "Breaking through limits! Your journey continues! 🚀",
      "Level up! New heights await you! ⭐",
      "You've grown stronger! Keep pushing forward! 💪",
    ],
    STREAK: [
      "Another day conquered! Your consistency is inspiring! 🔥",
      "Streak maintained! You're building something special! ⚡",
      "Unstoppable! Your dedication shows in your streak! 🌟",
    ],
    QUEST_COMPLETE: [
      "Quest complete! One step closer to greatness! 🎯",
      "Victory achieved! What's your next conquest! 🏆",
      "Challenge overcome! You're proving your worth! ⚔️",
    ],
  },
  QUOTES: [
    { text: "The obstacle is the way.", author: "Marcus Aurelius" },
    { text: "What you seek is seeking you.", author: "Rumi" },
    {
      text: "The journey of a thousand miles begins with one step.",
      author: "Lao Tzu",
    },
    {
      text: "Arise, hunter. Your path to strength awaits.",
      author: "System",
    },
    {
      text: "Every challenge is an opportunity for growth.",
      author: "System",
    },
  ],
};

// Motivation system functions
async function showMotivation() {
  try {
    const response = await fetch("https://stoic-quotes.com/api/quote");
    if (!response.ok) {
      throw new Error("Failed to fetch quote");
    }
    const data = await response.json();

    printToTerminal("\n=== DAILY MOTIVATION ===", "system");
    printToTerminal(`"${data.text}"`, "quest");
    printToTerminal(`- ${data.author}`, "info");
  } catch (error) {
    printToTerminal("Error fetching quote: " + error.message, "error");
    // Fallback to a default quote if API fails
    printToTerminal('"The obstacle is the way."', "quest");
    printToTerminal("- Marcus Aurelius", "info");
  }
}


function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}


window.setPlayerName = async function setPlayerName(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (args.length === 0) {
    printToTerminal("Please provide a name.", "error");
    return;
  }

  const name = args[0];
  const playerRef = db.collection("players").doc(currentUser.uid);

  try {
    await playerRef.update({
      "profile.name": name,
    });
    playerStats.profile.name = name;
    printToTerminal(`Name set to: ${name}`, "success");
    updateTerminalPrompt();
    if (windowSystem) {
      windowSystem.updateWindowContent("profileWindow");
    }
  } catch (error) {
    printToTerminal("Error setting name: " + error.message, "error");
  }
}

window.setPlayerTitle = async function setPlayerTitle(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    // printToTerminal("Usage: !settitle <title>", "warning");
    // printToTerminal("Example: !settitle Shadow Monarch", "info");
    return;
  }

  const title = args.join(" ");
  if (title.length > 50) {
    printToTerminal("Title must be 50 characters or less.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.title": title,
    });

    // Update local stats
    playerStats.profile.title = title;
    printToTerminal(`Title updated to: ${title}`, "success");
    showNotification("Title updated successfully!");
  } catch (error) {
    printToTerminal("Error updating title: " + error.message, "error");
  }
}

window.setPlayerBio = async function setPlayerBio(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !setbio <text>", "warning");
    printToTerminal("Example: !setbio A hunter who never gives up", "info");
    return;
  }

  const bio = args.join(" ");
  if (bio.length > 200) {
    printToTerminal("Bio must be 200 characters or less.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.bio": bio,
    });

    // Update local stats
    playerStats.profile.bio = bio;
    printToTerminal(`Bio updated successfully!`, "success");
    showNotification("Bio updated!");
  } catch (error) {
    printToTerminal("Error updating bio: " + error.message, "error");
  }
}

window.setPlayerClass = async function setPlayerClass(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !setclass <class>", "warning");
    printToTerminal("Available classes:", "info");
    printToTerminal("- Hunter", "info");
    printToTerminal("- Healer", "info");
    printToTerminal("- Tank", "info");
    printToTerminal("- Assassin", "info");
    printToTerminal("Example: !setclass Hunter", "info");
    return;
  }

  const className = args.join(" ");
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
  if (!validClasses.includes(className)) {
    printToTerminal("Invalid class. Available classes:", "error");
    validClasses.forEach((c) => printToTerminal(`- ${c}`, "info"));
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.class": className,
    });

    // Update local stats
    playerStats.profile.class = className;
    printToTerminal(`Class updated to: ${className}`, "success");
    showNotification("Class updated successfully!");
  } catch (error) {
    printToTerminal("Error updating class: " + error.message, "error");
  }
}

// Window System
const windowSystem = {
  windows: {
    profileWindow: document.getElementById("profileWindow"),
    questsWindow: document.getElementById("questsWindow"),
    dailyQuestsWindow: document.getElementById("dailyQuestsWindow"),
    achievementsWindow: document.getElementById("achievementsWindow"),
    shopWindow: document.getElementById("shopWindow"),
    inventoryWindow: document.getElementById("inventoryWindow"),
    rankProgressWindow: document.getElementById("rankProgressWindow"),
    bossBattlesWindow: document.getElementById("bossBattlesWindow"),
    leaderboardWindow: document.getElementById("leaderboardWindow"),
    notesWindow: document.getElementById("notesWindow"), // Add notes window
    notificationsWindow: document.getElementById("notificationsWindow"),
  },

  taskbarItems: [
    { id: "profileWindow", icon: "fa-user", title: "Profile" },
    { id: "questsWindow", icon: "fa-tasks", title: "Quests" },
    { id: "dailyQuestsWindow", icon: "fa-calendar-check", title: "Daily Quests" },
    { id: "achievementsWindow", icon: "fa-trophy", title: "Achievements" },
    { id: "shopWindow", icon: "fa-store", title: "Shop" },
    { id: "inventoryWindow", icon: "fa-box", title: "Inventory" },
    { id: "rankProgressWindow", icon: "fa-star", title: "Rank Progress" },
    { id: "bossBattlesWindow", icon: "fa-dragon", title: "Boss Battles" },
    { id: "leaderboardWindow", icon: "fa-crown", title: "Leaderboard" },
    { id: "notesWindow", icon: "fa-sticky-note", title: "Notes" },
    { id: "notificationsWindow", icon: "fa-bell", title: "Notifications" }
  ],

  zIndex: 1000,

  init() {
    // Initialize windows object
    this.windows = {
      profileWindow: document.getElementById("profileWindow"),
      questsWindow: document.getElementById("questsWindow"),
      dailyQuestsWindow: document.getElementById("dailyQuestsWindow"),
      achievementsWindow: document.getElementById("achievementsWindow"),
      shopWindow: document.getElementById("shopWindow"),
      inventoryWindow: document.getElementById("inventoryWindow"),
      rankProgressWindow: document.getElementById("rankProgressWindow"),
      bossBattlesWindow: document.getElementById("bossBattlesWindow"),
      leaderboardWindow: document.getElementById("leaderboardWindow"),
      notificationsWindow: document.getElementById("notificationsWindow"),
    };

    // Add taskbar to the body
    const taskbar = document.createElement("div");
    taskbar.className = "window-taskbar";
    document.body.appendChild(taskbar);

    // Initialize all windows
    document.querySelectorAll(".window").forEach((window) => {
      const id = window.id;
      this.windows[id] = window;

      // Set initial position if not set
      if (!window.style.top && !window.style.left) {
        window.style.top = "10px";
        window.style.left = "10px";
      }

      // Update window header
      const header = window.querySelector(".window-header");
      const closeBtn = window.querySelector(".window-close");
      if (!closeBtn) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "window-close";
        closeBtn.innerHTML = "×";
        closeBtn.addEventListener("click", () => this.closeWindow(id));
        header.appendChild(closeBtn);
      } else {
        closeBtn.addEventListener("click", () => this.closeWindow(id));
      }

      // Add dragging functionality
      this.makeDraggable(window);
    });

    // Add taskbar items for all windows including rank progress
    const windowConfigs = [
      { id: "profileWindow", icon: "fa-user", title: "Profile" },
      { id: "questsWindow", icon: "fa-tasks", title: "Quests" },
      {
        id: "dailyQuestsWindow",
        icon: "fa-calendar-check",
        title: "Daily Quests",
      },
      { id: "achievementsWindow", icon: "fa-star", title: "Achievements" },
      { id: "shopWindow", icon: "fa-store", title: "Shop" },
      { id: "inventoryWindow", icon: "fa-box", title: "Inventory" },
      {
        id: "rankProgressWindow",
        icon: "fa-medal",
        title: "Rank Progress",
      },
      { id: "bossBattlesWindow", icon: "fa-dragon", title: "Boss Battles" },
      {
        id: "leaderboardWindow",
        icon: "fa-trophy",
        title: "Leaderboard",
      },
      { id: "notesWindow", icon: "fa-sticky-note", title: "Notes" }, // Add notes taskbar item

      {
        id: "notificationsWindow",
        icon: "fa-bell",
        title: "Notifications",
      },
    ];

    windowConfigs.forEach((config) => {
      const taskbarItem = document.createElement("div");
      taskbarItem.className = "taskbar-item";
      taskbarItem.title = config.title;
      taskbarItem.innerHTML = `<i class="fas ${config.icon}"></i>`;
      taskbarItem.addEventListener("click", () => this.toggleWindow(config.id));
      taskbar.appendChild(taskbarItem);
      taskbar.appendChild(toggleTerminal);
    });

    // Add click handler to bring window to front
    document.addEventListener("mousedown", (e) => {
      const window = e.target.closest(".window");
      if (window) {
        this.bringToFront(window.id);
      }
    });
  },

  makeDraggable(window) {
    const header = window.querySelector(".window-header");
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".window-close")) return;

      isDragging = true;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      window.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      window.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;

      isDragging = false;
      window.style.cursor = "default";

      // Update the window's position
      const rect = window.getBoundingClientRect();
      window.style.left = rect.left + "px";
      window.style.top = rect.top + "px";
      window.style.transform = "";
      xOffset = 0;
      yOffset = 0;
    });
  },

  showWindow(windowId) {
    const window = this.windows[windowId];
    if (window) {
      // Play system sound when opening window
      notificationSystem.playSound("system");
  
      // Add delay before showing the window
      setTimeout(() => {
        window.classList.add("show");
        this.bringToFront(windowId);
        this.updateWindowContent(windowId);
  
        // Update taskbar - Fix for Daily Quests
        const taskbarItem = this.getTaskbarItem(windowId);
        if (taskbarItem) {
          // Remove active class from all taskbar items first
          document.querySelectorAll('.taskbar-item').forEach(item => {
            item.classList.remove('active');
          });
          // Add active class to current taskbar item
          taskbarItem.classList.add("active");
        }
  
        // Only initialize timers for windows that need them and if not already initialized
        if ((windowId === "dailyQuestsWindow" || windowId === "bossBattlesWindow") && !timerSystem.isInitialized) {
          initializeTimers();
        }
      }, 250);
    }
  },
  toggleWindow(windowId) {
    const window = this.windows[windowId];
    // Play sound instantly if window exists and is not shown
    if (window && !window.classList.contains("show")) {
    }

    // Rest of the window logic
    if (window) {
      if (window.classList.contains("show")) {
        this.closeWindow(windowId);
      } else {
        if (windowId === "rankProgressWindow") {
          showRankProgress();
        } else {
          this.showWindow(windowId);
        }
      }
    }
  },

  closeWindow(windowId) {
    const window = this.windows[windowId];
    if (window) {
      // Play close sound
      notificationSystem.playSound("close");

      // Add delay before closing
      setTimeout(() => {
        window.classList.remove("show");
        const taskbarItem = this.getTaskbarItem(windowId);
        if (taskbarItem) {
          taskbarItem.classList.remove("active");
        }

        // Only cleanup timers if no other timer-dependent windows are open
        if (windowId === "dailyQuestsWindow" || windowId === "bossBattlesWindow") {
          const dailyQuestsOpen = this.windows["dailyQuestsWindow"]?.classList.contains("show");
          const bossBattlesOpen = this.windows["bossBattlesWindow"]?.classList.contains("show");
          
          if (!dailyQuestsOpen && !bossBattlesOpen) {
            timerSystem.stopAllTimers();
          }
        }
      }, 200);
    }
  },

  bringToFront(windowId) {
    const window = this.windows[windowId];
    if (window) {
      this.zIndex += 1;
      window.style.zIndex = this.zIndex;
    }
  },

  getTaskbarItem(windowId) {
    const windowTitle = this.windows[windowId].querySelector(".window-title").textContent;
    return Array.from(document.querySelectorAll(".taskbar-item")).find(
      (item) => {
        // Handle special cases for Profile and Quests windows
        if (windowId === "profileWindow" && item.title === "Profile") return true;
        if (windowId === "questsWindow" && item.title === "Quests") return true;
        // For other windows, check if the taskbar item title matches the window title
        return item.title === windowTitle;
      }
    );
  },

  async updateInventoryWindow() {
    if (!currentUser) return;
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
      const inventoryList = document.getElementById("inventoryItemsList");
      inventoryList.innerHTML = "";

      if (!player.inventory || player.inventory.length === 0) {
        inventoryList.innerHTML =
          '<div class="window-item">Your inventory is empty</div>';
        return;
      }

      // Group inventory items by ID to handle stackable items
      const groupedInventory = player.inventory.reduce((acc, item) => {
        if (!acc[item.id]) {
          acc[item.id] = { ...item, quantity: 1 };
        } else {
          acc[item.id].quantity++;
        }
        return acc;
      }, {});

      for (const itemId in groupedInventory) {
        const item = groupedInventory[itemId];
        const itemData = Object.values(ITEMS).find(
          (i) => i.id === itemId
        ) || item; // Handle shards directly if not found in ITEMS

        if (itemData) {
          const itemElement = document.createElement("div");
          itemElement.className = "window-item";

          const isExpired =
            item.expiresAt && item.expiresAt <= Date.now();
          const timeLeft = item.expiresAt
            ? Math.max(0, item.expiresAt - Date.now())
            : null;

          if (isExpired) {
            itemElement.classList.add("expired-item");
          }

          // Check if item is usable or a shard
          const isUsable =
            itemData.effect ||
            itemData.type === "shard"; // Shards are considered usable

          // Calculate total XP and gold for shards
          let xpReward = 0;
          let goldReward = 0;
          if (itemData.type === "shard") {
            const shards = player.inventory.filter(i => i.id === itemId);
            xpReward = shards.reduce((sum, shard) => sum + shard.xpValue, 0);
            goldReward = shards.reduce((sum, shard) => sum + shard.goldValue, 0);
          }

          itemElement.innerHTML = `
            <div class="window-item-title">${itemData.name} x${item.quantity}</div>
            <div class="window-item-description">${itemData.description}</div>
            ${
              timeLeft !== null
                ? `<div class="window-item-description ${
                    isExpired ? "text-error" : ""
                  }">
                    ${
                      isExpired
                        ? "EXPIRED"
                        : `Time remaining: ${Math.ceil(timeLeft / 60000)} minutes`
                    }
                   </div>`
                : ""
            }
            ${
              itemData.type === "shard"
                ? `<div class="window-item-description">
                    Rewards: ${xpReward} XP, ${goldReward} gold (product of ${item.quantity} shards)
                  </div>`
                : ""
            }
            <div class="window-actions">
              ${
                isExpired
                  ? `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      itemData
                    )} gold</div>
                   <button onclick="sellItem('${
                     itemData.id
                   }')" class="window-button">Sell</button>`
                  : isUsable
                  ? itemData.type === "shard"
                    ? item.quantity > 1
                      ? `
                        <button onclick="useShard('${itemData.id}', ${item.quantity})" class="window-button">Use All</button>
                        <button onclick="sellShard('${itemData.id}', ${item.quantity})" class="window-button">Sell All</button>
                      `
                      : `
                        <button onclick="useShard('${itemData.id}', 1)" class="window-button">Use</button>
                        <button onclick="sellShard('${itemData.id}', 1)" class="window-button">Sell</button>
                      `
                    : `<button onclick="useItem('${itemData.id}')" class="window-button">Use</button>`
                  : `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      itemData
                    )} gold</div>
                     <button onclick="sellItem('${
                       itemData.id
                     }')" class="window-button">Sell</button>`
              }
            </div>
          `;
          inventoryList.appendChild(itemElement);
        }
      }

      // Add CSS if not already present
      if (!document.getElementById("inventoryStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "inventoryStyles";
        styleSheet.textContent = `
          .window-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            align-items: center;
            margin-top: 10px;
          }
          .window-item-price {
            color: #00ffff;
            font-size: 0.9em;
          }
          .expired-item {
            opacity: 0.7;
          }
          .text-error {
            color: #ff4444;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating inventory window:", error);
    }
  },

  // Add updateWindowContent method
  async updateWindowContent(windowId) {
    if (!currentUser) return;

    try {
    switch (windowId) {
      case "questsWindow":
        await this.updateQuestsWindow();
        break;
      case "dailyQuestsWindow":
        await this.updateDailyQuestsWindow();
        break;
      case "achievementsWindow":
        await this.updateAchievementsWindow();
        break;
      case "shopWindow":
        await this.updateShopWindow();
        break;
      case "inventoryWindow":
        await this.updateInventoryWindow();
        break;
        case "profileWindow":
          await this.updateProfileWindow();
        break;
      case "leaderboardWindow":
        await this.updateLeaderboardWindow();
        break;
        case "bossBattlesWindow":
          await this.updateBattleWindow();
          break;
      case "notificationsWindow":
        await this.updateNotificationsWindow();
        break;
      }
    } catch (error) {
      console.error(`Error updating window ${windowId}:`, error);
    }
  },

  async updateProfileWindow() {
    try {
      if (!currentUser) return;
      
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      if (!playerDoc.exists) return;

      const player = playerDoc.data();

      // Helper function to safely update element content
      const safeUpdateElement = (id, value, defaultValue = "Not set") => {
        const element = document.getElementById(id);
        if (element) {
          if (id === "profileTitle" && player.profile.titleColor) {
            element.style.color = player.profile.titleColor;
            element.textContent = value || defaultValue;
          } else {
            element.style.color = ""; // Reset color for non-title elements
          }
          element.textContent = value || defaultValue;
        }
      };

      // Update Character Info section
      safeUpdateElement("profileName", player?.profile?.name);
      safeUpdateElement("profileTitle", player?.profile?.title, "Novice");
      safeUpdateElement("profileClass", player?.profile?.class, "Hunter");
      safeUpdateElement("profileBio", player?.profile?.bio);

      // Update Stats section
      safeUpdateElement("profileLevel", player.level, "1");
      safeUpdateElement("profileRank", player.rank, "E");
      safeUpdateElement("profileExp", `${player.exp || 0}/${player.expNeeded        || 100}`, "0/100");
      safeUpdateElement("profileGold", player.gold, "0");
      safeUpdateElement("profileQuestsCompleted", player.questsCompleted, "0");
      safeUpdateElement("profileStreak", `${player.streak || 0} days`);

      // Update Water Intake section
      safeUpdateElement("profileWaterIntake", `${player.waterIntake?.current || 0}/${player.waterIntake?.goal || 8} glasses`);
      const waterBar = document.getElementById("profileWaterBar");
      if (waterBar) {
        const waterProgress = ((player.waterIntake?.current || 0) / (player.waterIntake?.goal || 8)) * 100;
        waterBar.style.width = `${Math.min(100, waterProgress)}%`;
      }
      safeUpdateElement("profileWaterStreak", `Streak: ${player.waterIntake?.streakDays || 0} days`);

      // Update Join Date
      const joinDate = player.profile?.joinDate?.toDate() || new Date();
      safeUpdateElement("profileJoinDate", joinDate.toLocaleDateString());
      
      // Update Physical Stats section
      const heightValue = player.profile?.height ? `${player.profile.height} cm` : "Not set";
      const weightValue = player.profile?.weight ? `${player.profile.weight} kg` : "Not set";
      const ageValue = player.profile?.age ? `${player.profile.age} years` : "Not set";
      safeUpdateElement("profileAge", ageValue);
      safeUpdateElement("profileHeight", heightValue);
      safeUpdateElement("profileWeight", weightValue);
      safeUpdateElement("profileGender", player.profile?.gender);
      

      // Update unlocked titles dropdown
      const titleDropdown = document.getElementById("profileTitleDropdown");
      if (titleDropdown) {
        titleDropdown.innerHTML = "";
        player.profile.unlockedTitles.forEach((title) => {
          const option = document.createElement("option");
          option.value = title;
          option.textContent = title;
          titleDropdown.appendChild(option);
        });
      }

    } catch (error) {
      console.error("Error updating profile window:", error);
    }
  },

  async updateQuestsWindow(type = "normal") {
    if (!currentUser) return;
    try {
      const collectionName = type === "daily" ? "dailyQuests" : "quests";
      const questsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection(collectionName);
      const snapshot = await questsRef.get();
      const questsList = document.getElementById(type === "daily" ? "activeDailyQuestsList" : "activeQuestsList");
      questsList.innerHTML = "";

      if (snapshot.empty) {
        questsList.innerHTML =
          `<div class="window-item">No active ${type === "daily" ? "daily " : ""}quests</div>`;
        return;
      }

      // Add Complete All button at the top
      const completeAllBtn = document.createElement("button");
      completeAllBtn.className = "window-button";
      completeAllBtn.textContent = `Complete All ${type === "daily" ? "Daily " : ""}Quests`;
      completeAllBtn.onclick = () => completeAllQuests(type);
      questsList.appendChild(completeAllBtn);

      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
        questElement.className = "window-item";

        questElement.innerHTML = `
          <div class="window-item-title">${quest.title}</div>
          <div class="window-item-description">
            Progress: 
            <input type="number" 
                   value="${quest.currentCount}" 
                   min="0" 
                   max="${quest.targetCount}" 
                   onchange="updateQuestCount('${doc.id}', '${type}', this.value)"
                   style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);">
            /${quest.targetCount} ${quest.metric}
          </div>
          <div class="window-item-description">${quest.description}</div>
          <div class="window-item-progress">
            <div class="window-item-progress-bar" style="width: ${(quest.currentCount / quest.targetCount) * 100}%"></div>
          </div>
          <div class="window-actions" style="margin-top: 10px;">
            <button class="window-button" onclick="completeQuest('${doc.id}', '${type}')">
              Complete Quest
            </button>
            <button class="window-button danger" onclick="deleteQuest('${doc.id}', '${type}')">
              Delete Quest
            </button>
          </div>
        `;
        questsList.appendChild(questElement);
      });
    } catch (error) {
      console.error(`Error updating ${type} quests window:`, error);
    }
  },


  async updateDailyQuestsWindow(type = "daily") {
    try {
      if (!currentUser) return;

      const questsRef = db
        .collection("players")
        .doc(currentUser.uid)
        .collection("dailyQuests");

      const snapshot = await questsRef.get();
      const dailyQuestsList = document.getElementById("dailyQuestsList");
      
      if (!dailyQuestsList) return;
      
      // Create header
      const headerElement = document.createElement("div");
      headerElement.className = "sl-system-header";
      headerElement.innerHTML = `
        <div class="sl-system-line"></div>
        <div class="sl-title">DAILY MISSIONS</div>
        <div class="sl-system-line"></div>
      `;
      
      // Add the centralized timer at the top
      const timerSection = document.createElement("div");
      timerSection.className = "sl-timer-section";
      const endOfDay = getEndOfDay();
      const now = new Date();
      const remaining = endOfDay - now;
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const totalDayDuration = endOfDay - startOfDay;
      const progress = ((totalDayDuration - remaining) / totalDayDuration) * 100;
      
      timerSection.innerHTML = `
        <div class="sl-timer-container">
          <div class="sl-timer-label">TIME UNTIL RESET</div>
          <div class="sl-timer-display" id="centralDailyTimer">${formatTimeRemaining(remaining)}</div>
          <div class="sl-timer-progress">
            <div class="sl-progress-bar-track">
              <div class="sl-progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <div class="sl-timer-markers">
              <span class="sl-marker" style="left: 0%">|</span>
              <span class="sl-marker" style="left: 25%">|</span>
              <span class="sl-marker" style="left: 50%">|</span>
              <span class="sl-marker" style="left: 75%">|</span>
              <span class="sl-marker" style="left: 100%">|</span>
            </div>
          </div>
        </div>
      `;
      
      // Create quests container
      const questsContainer = document.createElement("div");
      questsContainer.className = "sl-quests-container";
      
      // Clear and set content
      dailyQuestsList.innerHTML = "";
      dailyQuestsList.appendChild(headerElement);
      dailyQuestsList.appendChild(timerSection);
      dailyQuestsList.appendChild(questsContainer);

      if (snapshot.empty) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "sl-empty-quests";
        emptyMessage.innerHTML = '<div class="sl-empty-message">NO MISSIONS AVAILABLE</div>';
        questsContainer.appendChild(emptyMessage);
      } else {
      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
          questElement.className = "sl-quest-item";

        // Check if quest was completed today
        const isCompletedToday = quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion);

        // Add completed class if quest is completed today
        if (isCompletedToday) {
            questElement.classList.add("sl-completed-quest");
        }
  
          // Calculate progress percentage
          const progressPercent = isCompletedToday ? 100 : (quest.currentCount / quest.targetCount) * 100;

        questElement.innerHTML = `
            <div class="sl-quest-header">
              <div class="sl-quest-status ${isCompletedToday ? 'sl-status-complete' : 'sl-status-active'}">
                ${isCompletedToday ? 'COMPLETE' : 'ACTIVE'}
          </div>
              <div class="sl-quest-title">${quest.title}</div>
              ${isCompletedToday ? '<div class="sl-completion-badge">✓</div>' : ""}
            </div>
            
            <div class="sl-quest-body">
            <div style="font-size: 14px; color: #00a8ff; margin-bottom: 5px;" class="sl-quest-body-description-text">Description
              <div class="sl-quest-description">${quest.description}</div>
            </div>
              <div class="sl-quest-progress">
                <div class="sl-progress-label">
                  PROGRESS: 
                  <span class="sl-progress-count">
            <input type="number" 
                   value="${isCompletedToday ? quest.targetCount : quest.currentCount}" 
                   min="0" 
                   max="${quest.targetCount}" 
                   onchange="updateQuestCount('${doc.id}', 'daily', this.value)"
                           class="sl-count-input"
                   ${isCompletedToday ? "disabled" : ""}>
            /${quest.targetCount} ${quest.metric}
                  </span>
          </div>
                
                <div class="sl-progress-track">
                  <div class="sl-progress-fill" style="width: ${progressPercent}%"></div>
                </div>
              </div>
          </div>
          
            <div class="sl-quest-actions">
              <button class="sl-action-button sl-complete-button" 
                      onclick="completeQuest('${doc.id}', '${type}')" 
                      ${isCompletedToday ? "disabled" : ""}>
                <span class="sl-button-label">COMPLETE MISSION</span>
            </button>
              <button class="sl-action-button sl-delete-button" onclick="deleteQuest('${doc.id}', '${type}')">
                <span class="sl-button-label">DELETE</span>
            </button>
          </div>`;

          questsContainer.appendChild(questElement);
        });
      }
      
      // Add CSS if not exists
      if (!document.getElementById("soloLevelingQuestsStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "soloLevelingQuestsStyles";
        styleSheet.textContent = `
          /* Solo Leveling Quests Styles */
          #dailyQuestsWindow {
            background: rgba(8, 19, 34, 0.85) !important;
            border: 1px solid rgba(0, 160, 255, 0.6) !important;
            box-shadow: 0 0 15px rgba(0, 190, 255, 0.4), inset 0 0 20px rgba(0, 130, 255, 0.1) !important;
            font-family: 'Rajdhani', sans-serif !important;
          }
          
          #dailyQuestsWindow::before {
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
          
          .sl-system-header, .sl-system-footer {
            text-align: center;
            color: #00a8ff;
            position: relative;
          }
          
          .sl-system-line {
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(0, 160, 255, 0.7), transparent);
            margin: 5px 0;
          }
          
          .sl-title {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 2px;
            color: #00c8ff;
            text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
          }
          
          .sl-footer-text {
            font-size: 12px;
            color: rgba(0, 180, 255, 0.7);
            letter-spacing: 1px;
          }
          
          .sl-footer-line {
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(0, 160, 255, 0.5), transparent);
            margin: 5px 0;
          }
          
          .sl-timer-section {
            margin-bottom: 10px;
            background: rgba(0, 40, 80, 0.3);
            border: 1px solid rgba(0, 160, 255, 0.3);
            border-radius: 5px;
            padding: 20px;
          }
          
          .sl-timer-label {
            color: #00a8ff;
            font-size: 12px;
            letter-spacing: 1px;
            margin-bottom: 5px;
            text-align: center;
          }
          
          .sl-timer-display {
            font-size: 24px;
            font-weight: bold;
            color: #ffffff;
            text-shadow: 0 0 10px rgba(0, 200, 255, 0.7);
            text-align: center;
            margin-bottom: 10px;
          }
          
          .sl-timer-progress {
            position: relative;
            margin-top: 5px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          
          .sl-progress-bar-track {
            height: 6px;
            background: rgba(0, 60, 120, 0.3);
            border-radius: 3px;
            position: relative;
            overflow: hidden;
            width: 100%;
          }
          
          .sl-progress-bar-fill {
            height: 100%;
            background: linear-gradient(to right, #0062ff, #00c8ff);
            border-radius: 3px;
            box-shadow: 0 0 5px rgba(0, 180, 255, 0.7);
            transition: width 0.3s ease;
          }
          
          .sl-timer-markers {
            display: flex;
            justify-content: space-between !important;
            margin-top: 5px;
            position: relative;
            width: 100%;
            height: 15px;
          }
          
          .sl-marker {
            position: absolute;
            transform: translateX(-50%);
            font-size: 10px;
            color: rgba(0, 160, 255, 0.8);
          }
          
          .sl-quests-container {
            max-height: 350px;
            overflow-y: auto;
            padding-right: 5px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .sl-quests-container::-webkit-scrollbar {
            width: 6px;
          }
          
          .sl-quests-container::-webkit-scrollbar-track {
            background: rgba(0, 20, 40, 0.3);
            border-radius: 3px;
          }
          
          .sl-quests-container::-webkit-scrollbar-thumb {
            background: rgba(0, 140, 255, 0.5);
            border-radius: 3px;
          }
          
          .sl-quest-item {
            background: rgba(0, 30, 60, 0.3);
            border-left: 3px solid rgba(0, 160, 255, 0.5);
            border-radius: 0 3px 3px 0;
            overflow: hidden;
            transition: all 0.3s ease;
          }
          
          .sl-quest-item:hover {
            background: rgba(0, 40, 80, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          }
          
          .sl-completed-quest {
            border-left-color: #00e0ff !important;
            box-shadow: 0 0 10px rgba(0, 200, 255, 0.2);
          }
          
          .sl-quest-header {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: rgba(0, 40, 80, 0.4);
            position: relative;
          }
          
          .sl-quest-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 2px;
            margin-right: 10px;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          
          .sl-status-active {
            background: rgba(0, 100, 200, 0.3);
            color: #00a8ff;
            border: 1px solid rgba(0, 160, 255, 0.4);
          }
          
          .sl-status-complete {
            background: rgba(0, 200, 160, 0.2);
            color: #00e0c0;
            border: 1px solid rgba(0, 230, 180, 0.4);
          }
          
          .sl-quest-title {
            flex: 1;
            font-weight: 600;
            color: #ffffff;
            font-size: 15px;
          }
          
          .sl-completion-badge {
            width: 20px;
            height: 20px;
            background: rgba(0, 220, 170, 0.2);
            color: #00ffc0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-size: 12px;
            margin-left: 10px;
            border: 1px solid rgba(0, 230, 180, 0.5);
          }
          
          .sl-quest-body {
            padding: 12px;
          }
          
          .sl-quest-description {
            margin-bottom: 10px;
            color: rgba(200, 230, 255, 0.8);
            font-size: 13px;
            line-height: 1.4;
          }
          
          .sl-quest-progress {
            margin-top: 10px;
          }
          
          .sl-progress-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
            font-size: 12px;
            color: #00b8ff;
          }
          
          .sl-progress-count {
            color: #ffffff;
          }
          
          .sl-count-input {
            width: 40px;
            background: rgba(0, 40, 80, 0.4);
            color: #ffffff;
            border: 1px solid rgba(0, 160, 255, 0.5);
            border-radius: 3px;
            text-align: center;
            font-family: 'Rajdhani', sans-serif;
            margin: 0 3px;
            padding: 2px;
          }
          
          .sl-count-input:disabled {
            opacity: 0.7;
            background: rgba(0, 60, 120, 0.2);
          }
          
          .sl-progress-track {
            height: 5px;
            background: rgba(0, 60, 120, 0.3);
            border-radius: 3px;
            overflow: hidden;
          }
          
          .sl-progress-fill {
            height: 100%;
            background: linear-gradient(to right, #0062ff, #00c8ff);
            border-radius: 3px;
            box-shadow: 0 0 5px rgba(0, 180, 255, 0.7);
            transition: width 0.3s ease;
          }
          
          .sl-quest-actions {
            display: flex;
            gap: 8px;
            padding: 0 12px 12px;
          }
          
          .sl-action-button {
            padding: 6px 12px;
            border: none;
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
            letter-spacing: 0.5px;
            font-size: 12px;
            border: 1px solid rgba(0, 160, 255, 0.3);
          }
          
          .sl-action-button:hover {
            background: rgba(0, 100, 200, 0.5);
            transform: translateY(-1px);
          }
          
          .sl-action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: rgba(0, 60, 120, 0.3);
          }
          
          .sl-complete-button {
            flex: 2;
          }
          
          .sl-delete-button {
            flex: 1 !important;
            background: rgba(160, 40, 40, 0.3)!important;
            color: #ff8080!important;
            border-color: rgba(255, 100, 100, 0.3)!important;
          }
          
          .sl-delete-button:hover {
            background: rgba(180, 50, 50, 0.4)!important;
          }
          
          .sl-empty-quests {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 80px;
            background: rgba(0, 30, 60, 0.2);
            border: 1px solid rgba(0, 160, 255, 0.2);
            border-radius: 5px;
          }
          
          .sl-empty-message {
            color: rgba(0, 160, 255, 0.6);
            font-size: 14px;
            letter-spacing: 1px;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating daily quests window:", error);
    }
  },

  async updateAchievementsWindow() {
    if (!currentUser) return;
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
      const achievementsList = document.getElementById("achievementsList");
      achievementsList.innerHTML = "";

      // Group achievements by category
      const categories = {
        level: "Level Achievements",
        quests_completed: "Quest Achievements",
        daily_streak: "Streak Achievements",
        water_streak: "Hydration Achievements",
        total_gold: "Gold Achievements",
        rank: "Rank Achievements",
      };

      Object.entries(categories).forEach(([type, categoryName]) => {
        const categoryAchievements = Object.values(ACHIEVEMENTS).filter(
          (a) => a.type === type
        );
        if (categoryAchievements.length > 0) {
          const categoryHeader = document.createElement("div");
          categoryHeader.className = "achievement-category";
          categoryHeader.textContent = categoryName;
          achievementsList.appendChild(categoryHeader);

          categoryAchievements.forEach((achievement) => {
            const achievementElement = document.createElement("div");
            const currentRank =
              player.achievements?.[achievement.id]?.currentRank || 0;
            const isMaxRank = currentRank === achievement.ranks.length;
            const nextRank = isMaxRank ? null : achievement.ranks[currentRank];

            achievementElement.className = `achievement-item${
              currentRank === 0 ? " locked" : ""
            }`;

            // Calculate progress
            let currentValue = 0;
            let progressText = "";
            let progressPercentage = 0;

            if (nextRank) {
              switch (achievement.type) {
                case "level":
                  currentValue = Math.min(
                    player.level || 0,
                    nextRank.requirement
                  );
                  progressText = `Level ${currentValue}/${nextRank.requirement}`;
                  break;
                case "quests_completed":
                  currentValue = Math.min(
                    player.questsCompleted || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Quests`;
                  break;
                case "daily_streak":
                  currentValue = Math.min(
                    player.streak || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Days`;
                  break;
                case "water_streak":
                  currentValue = Math.min(
                    player.waterIntake?.streakDays || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue}/${nextRank.requirement} Days`;
                  break;
                case "total_gold":
                  currentValue = Math.min(
                    player.gold || 0,
                    nextRank.requirement
                  );
                  progressText = `${currentValue.toLocaleString()}/${nextRank.requirement.toLocaleString()} Gold`;
                  break;
                case "rank":
                  const ranks = ["E", "D", "C", "B", "A", "S"];
                  const currentRankIndex = ranks.indexOf(player.rank || "E");
                  const requiredRankIndex = ranks.indexOf(nextRank.requirement);
                  currentValue =
                    currentRankIndex >= requiredRankIndex
                      ? requiredRankIndex
                      : currentRankIndex;
                  progressText = `Current: ${player.rank || "E"} / Required: ${
                    nextRank.requirement
                  }`;
                  progressText = `${currentValue}/${nextRank.requirement} ${nextRank.description}`;
                  break;
              }

              // Calculate progress percentage
              if (achievement.type === "rank") {
                const ranks = ["E", "D", "C", "B", "A", "S"];
                const currentRankIndex = ranks.indexOf(player.rank || "E");
                const requiredRankIndex = ranks.indexOf(nextRank.requirement);
                progressPercentage =
                  (currentRankIndex / requiredRankIndex) * 100;
              } else {
                progressPercentage =
                  (currentValue / nextRank.requirement) * 100;
              }

              achievementElement.innerHTML = `
                    <div class="achievement-rank ${isMaxRank ? "max" : ""}">
                        ${isMaxRank ? "MAX" : `Rank ${currentRank}`}
                    </div>
                    <div class="achievement-glow"></div>
                    <div class="achievement-header">
                        <div class="achievement-name">
                            <span class="achievement-icon">${
                              achievement.icon
                            }</span>
                            ${achievement.name}
                        </div>
                    </div>
                    <div class="achievement-description">${
                      achievement.description
                    }</div>
                    ${
                      nextRank
                        ? `
                        <div class="achievement-rewards">
                            Next Rank Rewards: ${nextRank.reward.exp} XP, ${
                            nextRank.reward.gold
                          } Gold
                        </div>
                        <div class="achievement-progress-container">
                            <div class="achievement-progress-bar" style="width: ${progressPercentage}%"></div>
                        </div>
                        <div class="achievement-progress-text">${progressText}</div>
                        <div class="achievement-next-rank">Next: Rank ${
                          currentRank + 1
                        }</div>
                    `
                        : `
                        <div class="achievement-rewards">
                            Achievement Mastered!
                        </div>
                    `
                    }
                `;

              // Ensure achievementsList exists before appending
              const achievementsList =
                document.getElementById("achievementsList");
              if (achievementsList) {
                achievementsList.appendChild(achievementElement);
              } else {
                console.error("Error: 'achievementsList' element not found.");
              }
            }
          });
        }
      });
    } catch (error) {
      console.error("Error updating achievements window:", error);
    }
  },

  async updateShopWindow() {
    if (!currentUser) return;
    try {
      const playerRef = db.collection("players").doc(currentUser.uid);
      const player = (await playerRef.get()).data();
      const shopItemsList = document.getElementById("shopItemsList");
      shopItemsList.innerHTML = "";

      // Group items by category
      const categories = {
        booster: { name: "🎓 XP & Level Boosters", items: [] },
        enhancer: { name: "🎯 Quest Enhancers", items: [] },
        training: { name: "💪 Training Boosters", items: [] },
        upgrade: { name: "🏆 Permanent Upgrades", items: [] },
        economy: { name: "💰 Gold & Economy", items: [] },
        title: { name: "🏅 Special Titles & Cosmetics", items: [] },
        special: { name: "🌟 Special Items", items: [] },
      };

      // Sort items into categories
      Object.entries(ITEMS).forEach(([itemId, item]) => {
        if (categories[item.category]) {
          categories[item.category].items.push({ id: itemId, ...item });
        }
      });

      // Create sections for each category
      Object.values(categories).forEach((category) => {
        if (category.items.length > 0) {
          // Add category header
          const categorySection = document.createElement("div");
          categorySection.className = "shop-category-section";

          const categoryHeader = document.createElement("div");
          categoryHeader.className = "shop-category-header";
          categoryHeader.textContent = category.name;
          categorySection.appendChild(categoryHeader);

          // Add items container
          const itemsContainer = document.createElement("div");
          itemsContainer.className = "shop-items-container";

          // Add items in category
          category.items.forEach((item) => {
            const itemElement = document.createElement("div");
            itemElement.className = "shop-item";

            // Check if player meets rank requirement
            const canPurchase =
              !item.rankRequired ||
              isRankSufficient(playerStats.rank, item.rankRequired);

            // Check if item is a one-time purchase and already owned
            const isOneTimePurchase = item.effect && (
              item.effect.type === "title" ||
              item.effect.type === "profile_custom" ||
              item.effect.type === "achievement_tracking" ||
              item.effect.type === "milestone_custom" ||
              item.effect.type === "quest_chain"
            );

            const alreadyOwned = isOneTimePurchase && player.inventory && player.inventory.some(invItem => invItem.id === item.id);

            if (!canPurchase || alreadyOwned) {
              itemElement.classList.add("shop-item-locked");
            }

            itemElement.innerHTML = `
              <div class="shop-item-header">
                <span class="shop-item-name">${item.name}</span>
                ${
                  item.rankRequired
                    ? `<span class="shop-item-rank">Rank ${item.rankRequired}</span>`
                    : ""
                }
              </div>
              <div class="shop-item-description">${item.description}</div>
              <div class="shop-item-footer">
                <span class="shop-item-price">${item.price} Gold</span>
                ${
                  alreadyOwned
                    ? `<div class="shop-item-requirement">Purchased</div>`
                    : canPurchase
                    ? `<button onclick="purchaseItem('${item.id}')" class="shop-button">Purchase</button>`
                    : `<div class="shop-item-requirement">Requires Rank ${item.rankRequired}</div>`
                }
              </div>
              ${
                item.duration
                  ? `<div class="shop-item-duration">Duration: ${formatDuration(
                      item.duration
                    )}</div>`
                  : ""
              }
            `;
            itemsContainer.appendChild(itemElement);
          });

          categorySection.appendChild(itemsContainer);
          shopItemsList.appendChild(categorySection);
        }
      });

      // Add CSS if not already present
      if (!document.getElementById("shopStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "shopStyles";
        styleSheet.textContent = `
          #shopItemsList {
            padding: 10px;
          }
          .shop-category-section {
            margin-bottom: 15px;
          }
          .shop-category-header {
            font-size: 1em;
            font-weight: bold;
            color: #00ffff;
            margin: 10px 0 5px 0;
            padding: 3px 0;
            border-bottom: 1px solid #0088ff;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
          }
          .shop-items-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 8px;
            padding: 5px 0;
          }
          .shop-item {
            background: rgba(0, 16, 32, 0.95);
            border: 1px solid #0088ff;
            border-radius: 4px;
            padding: 8px;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            font-size: 0.9em;
          }
          .shop-item::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, #00ffff, transparent);
          }
          .shop-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.2);
            border-color: #00ffff;
          }
          .shop-item-locked {
            opacity: 0.7;
            border-color: #444;
          }
          .shop-item-locked::after {
            background: linear-gradient(90deg, transparent, #444, transparent);
          }
          .shop-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
            border-bottom: 1px solid rgba(0, 136, 255, 0.2);
            padding-bottom: 4px;
            gap: 8px;
          }
          .shop-item-name {
            font-weight: bold;
            color: #fff;
            text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
            font-size: 0.9em;
          }
          .shop-item-rank {
            color: #00ffff;
            font-size: 0.8em;
            background: rgba(0, 136, 255, 0.1);
            padding: 1px 6px;
            border-radius: 3px;
            border: 1px solid rgba(0, 136, 255, 0.3);
            white-space: nowrap;
          }
          .shop-item-description {
            color: #88ccff;
            font-size: 0.85em;
            margin-bottom: 8px;
            min-height: 32px;
            line-height: 1.3;
          }
          .shop-item-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 4px;
            background: rgba(0, 16, 32, 0.3);
            padding: 4px 6px;
            border-radius: 3px;
            gap: 8px;
          }
          .shop-item-price {
            color: #00ffff;
            font-weight: bold;
            text-shadow: 0 0 5px rgba(0, 255, 255, 0.3);
            font-size: 0.85em;
            white-space: nowrap;
          }
          .shop-button {
            background: linear-gradient(180deg, #0088ff, #0066cc);
            color: white;
            border: none;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-transform: uppercase;
            font-size: 0.8em;
            font-weight: bold;
            letter-spacing: 0.5px;
            border: 1px solid #00aaff;
            white-space: nowrap;
          }
          .shop-button:hover {
            background: linear-gradient(180deg, #00aaff, #0088ff);
            box-shadow: 0 0 5px rgba(0, 136, 255, 0.3);
          }
          .shop-item-requirement {
            color: #ff4444;
            font-size: 0.8em;
            background: rgba(255, 68, 68, 0.1);
            padding: 1px 6px;
            border-radius: 3px;
            border: 1px solid rgba(255, 68, 68, 0.3);
          }
          .shop-item-requirement:contains("Purchased") {
            color: #44ff44;
            background: rgba(68, 255, 68, 0.1);
            border-color: rgba(68, 255, 68, 0.3);
          }
          .shop-item-duration {
            color: #88ccff;
            font-size: 0.75em;
            margin-top: 4px;
            text-align: right;
            font-style: italic;
          }

          /* Scrollbar Styling */
          #shopItemsList::-webkit-scrollbar {
            width: 8px;
          }
          #shopItemsList::-webkit-scrollbar-track {
            background: rgba(0, 16, 32, 0.95);
            border-radius: 4px;
          }
          #shopItemsList::-webkit-scrollbar-thumb {
            background: #0088ff;
            border-radius: 4px;
          }
          #shopItemsList::-webkit-scrollbar-thumb:hover {
            background: #00aaff;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error("Error updating shop window:", error);
    }
  },

  async updateBattleWindow() {
    try {
      if (!currentUser) return;
      
      const bossBattlesList = document.getElementById("bossBattlesList");
      if (!bossBattlesList) {
        console.error("Boss battles list element not found");
        return;
      }
      
      bossBattlesList.innerHTML = "";

      // Get player's active battles and defeated bosses
      const playerRef = db.collection("players").doc(currentUser.uid);
      const playerDoc = await playerRef.get();
      const player = playerDoc.data();
      const defeatedBosses = player?.defeatedBosses || {};

      const activeBattlesRef = playerRef.collection("activeBattles");
      const activeBattles = await activeBattlesRef.get();
      const activeBattleMap = new Map();

      activeBattles.forEach((doc) => {
        const battle = doc.data();
        activeBattleMap.set(doc.id, battle);

        // Check for timeout
        const now = new Date();
        const endTime = battle.endTime.toDate();
        if (now > endTime) {
          handleBossBattleTimeout(playerRef, doc.id, battle);
          activeBattleMap.delete(doc.id);
        }
      });

      // Add CSS styles if not present
      if (!document.getElementById("bossBattleStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "bossBattleStyles";
        styleSheet.textContent = `
          .defeat-count {
            margin-left: 10px;
            font-size: 0.9em;
            color: #ff4444;
          }
          .active-battle-badge {
            margin-left: 10px;
            font-size: 0.9em;
            color: #44ff44;
          }
          .battle-time-remaining {
            font-size: 0.9em;
            color: #ffff44;
            margin: 5px 0;
          }
          .progress-input {
            display: flex;
            align-items: center;
            margin: 10px 0;
          }
          .progress-input input {
            margin: 0 10px;
            padding: 2px 5px;
            width: 80px;
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--system-blue);
          }
        `;
        document.head.appendChild(styleSheet);
      }

      // Display available boss battles
      Object.entries(BOSSES).forEach(([bossKey, boss]) => {
        const defeatCount = defeatedBosses[boss.id] || 0;
        const activeBattle = activeBattleMap.get(boss.id);
        const bossElement = document.createElement("div");
        bossElement.className = "window-item";

        // Calculate scaled values
        const scaledTarget = boss.baseTargetCount + (defeatCount * (boss.scaling?.targetCount || 0));
        const scaledExp = boss.rewards.exp + (defeatCount * (boss.scaling?.rewards?.exp || 0));
        const scaledGold = boss.rewards.gold + (defeatCount * (boss.scaling?.rewards?.gold || 0));

        bossElement.innerHTML = `
          <div class="window-item-title">
            ${boss.name}
            ${defeatCount > 0 ? `<span class="defeat-count">💀 ${defeatCount}</span>` : ""}
            ${activeBattle ? '<span class="active-battle-badge">⚔️ In Progress</span>' : ""}
          </div>
          <div class="window-item-description">${boss.description}</div>
          <div class="window-item-description">
            Target: ${scaledTarget} ${boss.metric}
            <br>Time Limit: ${formatTimeLimit(boss.timeLimit)}
            ${defeatCount > 0 ? `<br>Scaling: +${boss.scaling?.targetCount || 0} ${boss.metric} per defeat` : ""}
          </div>
          <div class="window-item-description">
            Rewards:
            <br>- ${scaledExp} XP
            <br>- ${scaledGold} Gold
            ${boss.rewards.title ? `<br>- Title: ${boss.rewards.title}` : ""}
          </div>
          ${activeBattle ? `
            <div class="window-item-progress">
              <div class="progress-input">
                <label>Current Progress:</label>
                <input type="number" 
                       value="${activeBattle.currentCount}"
                       min="0"
                       max="${activeBattle.targetCount}"
                       onchange="updateBattleProgress(['${boss.id}', this.value])"
                       style="width: 80px; margin: 0 10px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);">
                  /${activeBattle.targetCount} ${boss.metric}
              </div>
              <div class="battle-time-remaining" data-end-time="${activeBattle.endTime.toDate().toISOString()}" data-boss-id="${boss.id}">
                Time Remaining: ${formatTimeRemaining(activeBattle.endTime.toDate() - new Date())}
              </div>
              <div class="window-item-progress-bar" style="width: ${(activeBattle.currentCount / activeBattle.targetCount) * 100}%"></div>
            </div>
          ` : ""}
          <div class="window-actions">
            <button class="window-button" 
                    onclick="startBossBattle(['${boss.id}'])"
                    ${activeBattle ? "disabled" : ""}>
              ${activeBattle ? "Battle in Progress" : "Start Battle"}
            </button>
          </div>
        `;

        bossBattlesList.appendChild(bossElement);
      });

      // Start the battle timers
      initializeTimers();
    } catch (error) {
      console.error("Error updating boss battles window:", error);
    }
  },

  async updateLeaderboardWindow() {
    if (!currentUser) return;
    try {
      // Get the leaderboard window element first
      const leaderboardWindow = document.getElementById("leaderboardWindow");
      if (!leaderboardWindow) {
        console.error("Leaderboard window not found in DOM");
        return;
      }
      
      // Get or create the leaderboard content element
      let leaderboardContent = document.getElementById("leaderboardContent");
      if (!leaderboardContent) {
        leaderboardContent = document.createElement("div");
        leaderboardContent.id = "leaderboardContent";
        leaderboardWindow.appendChild(leaderboardContent);
      }
      
      // Create the header
      const headerElement = document.createElement("div");
      headerElement.className = "sl-system-header";
      headerElement.innerHTML = `
        <div class="sl-system-line"></div>
        <div class="sl-title">HUNTER RANKINGS</div>
        <div class="sl-system-line"></div>
      `;
      
      // Create container for list with appropriate styling
      const leaderboardContainer = document.createElement("div");
      leaderboardContainer.className = "sl-leaderboard-container";
      
      // Get player data
      const playersRef = db.collection("players");
      const snapshot = await playersRef.orderBy("level", "desc").limit(10).get();
  
      // Create the list
      const leaderboardList = document.createElement("div");
      leaderboardList.id = "leaderboardList";
      leaderboardList.className = "sl-leaderboard-list";
      
      let rank = 1;
      snapshot.forEach((doc) => {
        const player = doc.data();
        const playerElement = document.createElement("div");
        playerElement.className = "sl-leaderboard-entry";
  
        // Apply rank-specific styling
        if (rank === 1) {
          playerElement.classList.add("sl-first-place");
        } else if (rank === 2) {
          playerElement.classList.add("sl-second-place");
        } else if (rank === 3) {
          playerElement.classList.add("sl-third-place");
        }
        
        // Get rank style (similar to our rank system)
        const playerRank = player.rank || "E";
        const isCurrentUser = doc.id === currentUser.uid;
        
        // Fix the experience value display - ensure it's a number
        let experienceValue = 0;
        if (typeof player.exp === 'number') {
          experienceValue = player.exp;
        } else if (player.exp && typeof player.exp.value === 'number') {
          experienceValue = player.exp.value;
        }
        
        // Build the entry HTML
        playerElement.innerHTML = `
          <div class="sl-entry-rank">
            <div class="sl-rank-indicator ${isCurrentUser ? 'sl-current-user' : ''}">
              <span>${rank}</span>
          </div>
              </div>
          <div class="sl-entry-info">
            <div class="sl-entry-name">
              <span class="sl-player-name">${player.profile?.name || "Anonymous"}</span>
              <span class="sl-player-title">${player.profile?.title || "Novice"}</span>
              </div>
            <div class="sl-entry-stats">
              <div class="sl-stat">
                <span class="sl-stat-label">LVL</span>
                <span class="sl-stat-value">${player.level || 1}</span>
              </div>
              <div class="sl-stat">
                <div class="sl-rank-hex sl-rank-${playerRank.toLowerCase()}">
                  <span>${playerRank}</span>
              </div>
            </div>
              <div class="sl-stat">
                <span class="sl-stat-label">XP</span>
                <span class="sl-stat-value">${experienceValue.toLocaleString()}</span>
          </div>
            </div>
          </div>
          ${rank <= 3 ? `<div class="sl-medal-effect"></div>` : ''}
        `;
  
        leaderboardList.appendChild(playerElement);
        rank++;
      });
      
      // Create footer
      const footerElement = document.createElement("div");
      footerElement.className = "sl-system-footer";
      // Clear existing content and add new elements
      leaderboardContent.innerHTML = '';
      leaderboardContent.appendChild(headerElement);
      leaderboardContainer.appendChild(leaderboardList);
      leaderboardContent.appendChild(leaderboardContainer);
      
      // Add CSS for Solo Leveling leaderboard if not exists
      if (!document.getElementById("soloLevelingLeaderboardStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "soloLevelingLeaderboardStyles";
        styleSheet.textContent = `
          /* Solo Leveling Leaderboard Styles */
          #leaderboardWindow {
            background: rgba(8, 19, 34, 0.85) !important;
            border: 1px solid rgba(0, 160, 255, 0.6) !important;
            box-shadow: 0 0 15px rgba(0, 190, 255, 0.4), inset 0 0 20px rgba(0, 130, 255, 0.1) !important;
            font-family: 'Rajdhani', sans-serif !important;
          }
          
          #leaderboardWindow::before {
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
          
          .sl-leaderboard-container {
            position: relative;
            border: 2px solid rgba(0, 160, 255, 0.5);
            border-radius: 5px;
            padding: 8px;
            max-height: 450px;
            overflow-y: auto;
            background: rgba(10, 20, 40, 0.4);
            z-index: 1;
            margin: 10px;
          }
          
          .sl-leaderboard-container::-webkit-scrollbar {
            width: 8px;
          }
          
          .sl-leaderboard-container::-webkit-scrollbar-track {
            background: rgba(0, 20, 40, 0.3);
          }
          
          .sl-leaderboard-container::-webkit-scrollbar-thumb {
            background: rgba(0, 140, 255, 0.5);
            border-radius: 3px;
          }
          
          .sl-leaderboard-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .sl-leaderboard-entry {
            display: flex;
            align-items: center;
            padding: 12px;
            background: rgba(0, 30, 60, 0.3);
            border-left: 4px solid rgba(0, 160, 255, 0.5);
            position: relative;
            overflow: hidden;
            transition: all 0.2s ease;
            border-radius: 0 4px 4px 0;
          }
          
          .sl-leaderboard-entry:hover {
            background: rgba(0, 40, 80, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
          }
          
          .sl-first-place {
            background: rgba(0, 50, 100, 0.5) !important;
            border-left: 4px solid #00d8ff !important;
            box-shadow: 0 0 15px rgba(0, 190, 255, 0.3) !important;
          }
          
          .sl-second-place {
            background: rgba(0, 40, 80, 0.45) !important;
            border-left: 4px solid #00c8ff !important;
          }
          
          .sl-third-place {
            background: rgba(0, 30, 60, 0.4) !important;
            border-left: 4px solid #00b8ff !important;
          }
          
          .sl-entry-rank {
            width: 45px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          
          .sl-rank-indicator {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 40, 80, 0.5);
            font-weight: bold;
            color: #a0e0ff;
            font-size: 18px;
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            position: relative;
            border: 2px solid transparent;
            box-shadow: 0 0 0 1px rgba(0, 160, 255, 0.4);
          }
          
          .sl-rank-indicator::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            background: transparent;
            z-index: -1;
            border: 2px solid rgba(0, 160, 255, 0.4);
          }
          
          .sl-first-place .sl-rank-indicator {
            background: rgba(0, 90, 180, 0.6);
            color: #ffffff;
            box-shadow: 0 0 12px rgba(0, 216, 255, 0.6);
            border-color: rgba(0, 200, 255, 0.6);
          }
          
          .sl-current-user {
            background: rgba(0, 150, 255, 0.5) !important;
            animation: pulse-highlight 2s infinite;
            border-color: rgba(0, 200, 255, 0.8);
          }
          
          .sl-entry-info {
            flex: 1;
            margin-left: 15px;
          }
          
          .sl-entry-name {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }
          
          .sl-player-name {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            text-shadow: 0 0 8px rgba(0, 150, 255, 0.3);
          }
          
          .sl-player-title {
            font-size: 13px;
            color: #7bd5ff;
            background: rgba(0, 60, 120, 0.3);
            padding: 3px 8px;
            border-radius: 3px;
            border: 1px solid rgba(0, 160, 255, 0.3);
          }
          
          .sl-entry-stats {
            display: flex;
            gap: 20px;
          }
          
          .sl-stat {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          
          .sl-stat-label {
            font-size: 13px;
            color: #00a8ff;
            font-weight: 500;
            margin-bottom: 3px;
          }
          
          .sl-stat-value {
            font-size: 16px;
            color: #e0f7ff;
            font-weight: 600;
          }
          
          .sl-rank-hex {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(10, 20, 40, 0.7);
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            font-weight: bold;
            font-size: 16px;
            color: #00a8ff;
            position: relative;
            z-index: 1;
            text-shadow: 0 0 5px rgba(0, 160, 255, 0.5);
            box-shadow: 0 0 0 2px rgba(0, 160, 255, 0.4);
          }
          
          .sl-rank-hex::after {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: transparent;
            z-index: -1;
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            border: 2px solid currentColor;
          }
          
          .sl-rank-e { color: #00a2ff; }
          .sl-rank-d { color: #00a8ff; }
          .sl-rank-c { color: #00b0ff; }
          .sl-rank-b { color: #00b8ff; }
          .sl-rank-a { color: #00c8ff; }
          .sl-rank-s { 
            color: #00d8ff;
            animation: pulse-soft 2s infinite;
          }
          
          .sl-medal-effect {
            position: absolute;
            top: 0;
            left: 0;
            width: 150px;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.2), transparent);
            animation: medal-shine 3s ease-in-out infinite;
            pointer-events: none;
          }
          
          @keyframes medal-shine {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(270%); }
          }
          
          @keyframes pulse-highlight {
            0% { box-shadow: 0 0 5px rgba(0, 200, 255, 0.3); }
            50% { box-shadow: 0 0 12px rgba(0, 200, 255, 0.7); }
            100% { box-shadow: 0 0 5px rgba(0, 200, 255, 0.3); }
          }
          
          @keyframes pulse-soft {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
        `;
        document.head.appendChild(styleSheet);
      }
      
      // Add random glitch effects
      if (!leaderboardWindow.dataset.glitchInitialized) {
        leaderboardWindow.dataset.glitchInitialized = "true";
        
        setInterval(() => {
          if (Math.random() > 0.9 && leaderboardWindow.style.display !== 'none') {
            const entries = leaderboardWindow.querySelectorAll('.sl-leaderboard-entry');
            const randomEntry = entries[Math.floor(Math.random() * entries.length)];
            
            if (randomEntry) {
              randomEntry.classList.add('glitching');
              setTimeout(() => randomEntry.classList.remove('glitching'), 300);
            }
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error("Error updating leaderboard window:", error);
    }
  },
  
  async updateNotificationsWindow() {
    if (!currentUser) return;
  
    try {
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .orderBy("timestamp", "desc");
      
      const snapshot = await notificationsRef.get();
      const notificationsList = document.getElementById("notificationsList");
      if (!notificationsList) return;
      
      // Clear the list
      notificationsList.innerHTML = "";

      // Add Solo Leveling header
      const headerElement = document.createElement("div");
      headerElement.className = "sl-system-header";
      headerElement.innerHTML = `
        <div class="sl-system-line"></div>
        <div class="sl-title">NOTIFICATIONS</div>
        <div class="sl-system-line"></div>
      `;
      notificationsList.appendChild(headerElement);
  
      // Add notification management buttons with Solo Leveling styling
      const actionDiv = document.createElement("div");
      actionDiv.className = "sl-notifications-actions";
      actionDiv.innerHTML = `
        <button class="sl-action-button" onclick="windowSystem.markAllNotificationsAsRead()">
          <span class="sl-button-icon">✓</span>
          <span class="sl-button-label">READ ALL</span>
          </button>
        <button class="sl-action-button sl-delete-button" onclick="windowSystem.deleteAllNotifications()">
          <span class="sl-button-icon">×</span>
          <span class="sl-button-label">DELETE ALL</span>
          </button>
      `;
      notificationsList.appendChild(actionDiv);
      
      // Create a container for the notifications
      const notificationsContainer = document.createElement("div");
      notificationsContainer.className = "sl-notifications-container";
      notificationsList.appendChild(notificationsContainer);
  
      if (snapshot.empty) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "sl-empty-notifications";
        emptyMessage.innerHTML = '<div class="sl-empty-message">NO NOTIFICATIONS</div>';
        notificationsContainer.appendChild(emptyMessage);
      } else {
      snapshot.forEach((doc) => {
        const notification = doc.data();
        const notificationElement = document.createElement("div");
          notificationElement.className = `sl-notification-item ${notification.read ? 'sl-read' : 'sl-unread'}`;
        notificationElement.dataset.notificationId = doc.id;

          // Set notification type class
          if (notification.type) {
            notificationElement.classList.add(`sl-type-${notification.type}`);
          }
  
          const timestamp = notification.timestamp?.toDate() || new Date();
        const timeString = timestamp.toLocaleString();

          let notificationContent = notification.message || "No message";
          let notificationType = "SYSTEM";
          let typeClass = "sl-type-default";
          
          // Set the appropriate notification type label and class
        if (notification.type === "penalty") {
            notificationType = "PENALTY";
            typeClass = "sl-type-penalty";
            
            const details = notification.details || {};
            const levelsLost = details.levelsLost ?? 0;
            const previousLevel = details.previousLevel ?? "Unknown";
            const newLevel = details.newLevel ?? "Unknown";
            
          notificationContent = `
              <div class="sl-notification-content">
                <div class="sl-notification-message">${notification.message || "Penalty Applied"}</div>
                <div class="sl-notification-details">
                  ${levelsLost > 0 ? `<div class="sl-detail-item">Levels Lost: <span class="sl-highlight-negative">${levelsLost}</span></div>` : ''}
                  <div class="sl-detail-item">Previous Level: <span>${previousLevel}</span></div>
                  <div class="sl-detail-item">New Level: <span>${newLevel}</span></div>
              </div>
            </div>
          `;
          } else if (notification.type === "reward") {
            notificationType = "REWARD";
            typeClass = "sl-type-reward";
          } else if (notification.type === "quest") {
            notificationType = "QUEST";
            typeClass = "sl-type-quest";
          } else if (notification.type === "level") {
            notificationType = "LEVEL UP";
            typeClass = "sl-type-level";
          }
  
          // If it's not a penalty (which already has special formatting)
          if (notification.type !== "penalty") {
            notificationContent = `
              <div class="sl-notification-content">
                <div class="sl-notification-message">${notification.message || "No message"}</div>
              </div>
            `;
        }

        notificationElement.innerHTML = `
            <div class="sl-notification-header">
              <div class="sl-notification-type ${typeClass}">${notificationType}</div>
              <div class="sl-notification-time">${timeString}</div>
              <div class="sl-notification-status ${notification.read ? 'sl-status-read' : 'sl-status-unread'}">
                ${notification.read ? 'READ' : 'UNREAD'}
              </div>
          </div>
          ${notificationContent}
        `;

        // Add click handler to mark as read
        if (!notification.read) {
          notificationElement.addEventListener('click', () => {
            this.markNotificationAsRead(doc.id);
          });
        }

          notificationsContainer.appendChild(notificationElement);
        });
      }
      
      // Add CSS if not exists
      if (!document.getElementById("soloLevelingNotificationsStyles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "soloLevelingNotificationsStyles";
        styleSheet.textContent = `
          /* Solo Leveling Notifications Styles */
          #notificationsWindow {
            background: rgba(8, 19, 34, 0.85) !important;
            border: 1px solid rgba(0, 160, 255, 0.6) !important;
            box-shadow: 0 0 15px rgba(0, 190, 255, 0.4), inset 0 0 20px rgba(0, 130, 255, 0.1) !important;
            font-family: 'Rajdhani', sans-serif !important;
          }
          
          #notificationsWindow::before {
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
          
          .sl-system-header, .sl-system-footer {
            text-align: center;
            padding: 10px 0;
            color: #00a8ff;
            position: relative;
            margin: 0 10px;
          }
          
          .sl-system-line {
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(0, 160, 255, 0.7), transparent);
            margin: 5px 0;
          }
          
          .sl-title {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 2px;
            color: #00c8ff;
            text-shadow: 0 0 10px rgba(0, 200, 255, 0.5);
          }
          
          .sl-footer-text {
            font-size: 12px;
            color: rgba(0, 180, 255, 0.7);
            letter-spacing: 1px;
          }
          
          .sl-footer-line {
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(0, 160, 255, 0.5), transparent);
            margin: 5px 0;
          }
          
          .sl-notifications-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: -8px;
            margin-bottom: 5px;
          }
          
          .sl-action-button {
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
          
          .sl-action-button:hover {
            background: rgba(0, 100, 200, 0.5);
            transform: translateY(-1px);
          }
          
          .sl-delete-button {
            background: rgba(160, 40, 40, 0.3) !important;
            color: #ff8080 !important;
            border-color: rgba(255, 100, 100, 0.3) !important;
          }
          
          .sl-delete-button:hover {
            background: rgba(180, 50, 50, 0.4) !important;
          }
          
          .sl-button-icon {
            font-size: 14px;
          }
          
          .sl-notifications-container {
            margin: 0 15px 15px;
            max-height: 450px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .sl-notifications-container::-webkit-scrollbar {
            width: 6px;
          }
          
          .sl-notifications-container::-webkit-scrollbar-track {
            background: rgba(0, 20, 40, 0.3);
            border-radius: 3px;
          }
          
          .sl-notifications-container::-webkit-scrollbar-thumb {
            background: rgba(0, 140, 255, 0.5);
            border-radius: 3px;
          }
          
          .sl-notification-item {
            background: rgba(0, 30, 60, 0.3);
            border-left: 3px solid rgba(0, 160, 255, 0.5);
            border-radius: 0 3px 3px 0;
            transition: all 0.3s ease;
          }
          
          .sl-notification-item:hover {
            background: rgba(0, 40, 80, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          }
          
          .sl-notification-header {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: rgba(0, 40, 80, 0.4);
            position: relative;
          }
          
          .sl-notification-type {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 2px;
            margin-right: 10px;
            font-weight: 600;
            letter-spacing: 0.5px;
            background: rgba(0, 100, 200, 0.3);
            color: #00a8ff;
            border: 1px solid rgba(0, 160, 255, 0.4);
            min-width: 60px;
            text-align: center;
          }
          
          .sl-notification-time {
            flex: 1;
            font-size: 11px;
            color: rgba(200, 220, 255, 0.7);
          }
          
          .sl-notification-status {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 2px;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          
          .sl-status-unread {
            background: rgba(0, 180, 255, 0.2);
            color: #00d8ff;
            border: 1px solid rgba(0, 200, 255, 0.3);
            animation: pulse-highlight-blue 2s infinite;
          }
          
          .sl-status-read {
            background: rgba(100, 100, 100, 0.2);
            color: #a0a0a0;
            border: 1px solid rgba(150, 150, 150, 0.3);
          }
          
          .sl-notification-content {
            padding: 12px;
          }
          
          .sl-notification-message {
            color: #ffffff;
            font-size: 14px;
            margin-bottom: 6px;
            line-height: 1.4;
          }
          
          .sl-notification-details {
            color: rgba(200, 220, 255, 0.8);
            font-size: 12px;
            background: rgba(0, 40, 80, 0.3);
            padding: 8px;
            border-radius: 3px;
            margin-top: 8px;
          }
          
          .sl-detail-item {
            margin: 3px 0;
          }
          
          .sl-highlight-negative {
            color: #ff8080;
          }
          
          .sl-highlight-positive {
            color: #80ff80;
          }
          
          /* Type-specific styling */
          .sl-type-penalty {
            background: rgba(180, 40, 40, 0.3);
            color: #ff8080;
            border-color: rgba(255, 100, 100, 0.4);
          }
          
          .sl-type-reward {
            background: rgba(40, 180, 40, 0.3);
            color: #80ff80;
            border-color: rgba(100, 255, 100, 0.4);
          }
          
          .sl-type-quest {
            background: rgba(180, 120, 0, 0.3);
            color: #ffcc80;
            border-color: rgba(255, 180, 0, 0.4);
          }
          
          .sl-type-level {
            background: rgba(120, 40, 180, 0.3);
            color: #d880ff;
            border-color: rgba(180, 100, 255, 0.4);
          }
          
          .sl-unread {
            border-left-color: #00c8ff;
            box-shadow: 0 0 5px rgba(0, 200, 255, 0.2);
          }
          
          .sl-read {
            opacity: 0.8;
          }
          
          .sl-empty-notifications {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100px;
            background: rgba(0, 30, 60, 0.2);
            border: 1px solid rgba(0, 160, 255, 0.2);
            border-radius: 5px;
          }
          
          .sl-empty-message {
            color: rgba(0, 160, 255, 0.6);
            font-size: 14px;
            letter-spacing: 1px;
          }
          
          @keyframes pulse-highlight-blue {
            0% { box-shadow: 0 0 5px rgba(0, 200, 255, 0.3); }
            50% { box-shadow: 0 0 10px rgba(0, 200, 255, 0.6); }
            100% { box-shadow: 0 0 5px rgba(0, 200, 255, 0.3); }
          }
        `;
        document.head.appendChild(styleSheet);
      }

      // Update notification badge
      const unreadCount = await this.getUnreadNotificationsCount();
      this.updateNotificationBadge(unreadCount);
    } catch (error) {
      console.error("Error updating notifications window:", error);
      printToTerminal(`Error updating notifications window: ${error.message}`, "error");
    }
  },

  async markNotificationAsRead(notificationId) {
    try {
      await db.collection("notifications").doc(notificationId).update({
        read: true
      });
      await this.updateNotificationsWindow();
      notificationSystem.show("Notification marked as read", "success");
    } catch (error) {
      console.error("Error marking notification as read:", error);
      notificationSystem.show("Error marking notification as read", "error");
    }
  },

  async markAllNotificationsAsRead() {
    try {
      const batch = db.batch();
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .where("read", "==", false);
      
      const snapshot = await notificationsRef.get();
      
      snapshot.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      await this.updateNotificationsWindow();
      notificationSystem.show("All notifications marked as read", "success");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      notificationSystem.show("Error marking notifications as read", "error");
    }
  },

  async deleteAllNotifications() {
    try {
      const batch = db.batch();
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid);
      
      const snapshot = await notificationsRef.get();
      
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      this.updateNotificationBadge(0); // Immediately reset the badge
      await this.updateNotificationsWindow();
      notificationSystem.show("All notifications deleted", "success");
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      notificationSystem.show("Error deleting notifications", "error");
    }
  },

  async getUnreadNotificationsCount() {
    if (!currentUser) return 0;
    try {
      const unreadSnapshot = await db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .where("read", "==", false)
        .get();
      return unreadSnapshot.size;
    } catch (error) {
      console.error("Error getting unread notifications count:", error);
      return 0;
    }
  },

  updateNotificationBadge(count) {
    const taskbarItem = this.getTaskbarItem("notificationsWindow");
    if (taskbarItem) {
      const existingBadge = taskbarItem.querySelector(".notification-badge");
      if (count > 0) {
        if (existingBadge) {
          existingBadge.textContent = count;
        } else {
          const badge = document.createElement("div");
          badge.className = "notification-badge";
          badge.textContent = count;
          taskbarItem.appendChild(badge);
        }
        taskbarItem.classList.add("has-notifications");
      } else {
        if (existingBadge) {
          existingBadge.remove();
        }
        taskbarItem.classList.remove("has-notifications");
      }
    }
  },
  // Add this new method to the WindowManager class
  switchQuestTab(type) {
    // Update active tab styling
    document.querySelectorAll('.quest-tab').forEach(tab => {
      tab.classList.remove('active-tab');
    });
    document.getElementById(`${type}-quests-tab`).classList.add('active-tab');
    
    // Update quest content
    this.updateQuestsWindow(type);
  },
};

// Initialize window system
document.addEventListener("DOMContentLoaded", () => {
  windowSystem.init();
});


// Add prompt functions for profile settings
function showSetNamePrompt() {
  const name = prompt("Enter your new name:");
  if (name) {
    window.setPlayerName([name]);
    windowSystem.updateWindowContent("profileWindow");
  }
}

function showSetTitlePrompt() {
  const title = prompt("Enter your new title:");
  if (title) {
    setPlayerTitle([title]);
    windowSystem.updateWindowContent("profileWindow");
  }
}

function showSetClassPrompt() {
  const validClasses = ["Hunter", "Healer", "Tank", "Assassin"];
  const className = prompt(
    `Enter your new class (${validClasses.join(", ")}):`
  );
  if (className && validClasses.includes(className)) {
    setPlayerClass([className]);
    windowSystem.updateWindowContent("profileWindow");
  } else if (className) {
    alert("Invalid class. Please choose from: " + validClasses.join(", "));
  }
}

// Add purchase function for shop
window.purchaseItem = async function purchaseItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Find item by matching the id property
  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Item not found.", "error");
    return;
  }

  if (playerStats.gold < item.price) {
    printToTerminal("Not enough gold!", "error");
    return;
  }

  // Play purchase sound immediately
  notificationSystem.playSound("buy");

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);

    await playerRef.update({
      gold: firebase.firestore.FieldValue.increment(-item.price),
      inventory: firebase.firestore.FieldValue.arrayUnion({
        id: itemId,
        expiresAt: item.duration ? Date.now() + item.duration : null,
      }),
    });

    // Update local stats
    playerStats.gold -= item.price;
    if (!playerStats.inventory) playerStats.inventory = [];
    playerStats.inventory.push({
      id: itemId,
      expiresAt: item.duration ? Date.now() + item.duration : null,
    });

    showNotification(`Purchased ${item.name}!`);
    updateStatusBar();
    windowSystem.updateWindowContent("shopWindow");
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error purchasing item: " + error.message, "error");
  }
}


// Add bio prompt function
function showSetBioPrompt() {
  const bio = prompt("Enter your bio:");
  if (bio) {
    const playerRef = db.collection("players").doc(currentUser.uid);
    playerRef
      .update({
        "profile.bio": bio,
      })
      .then(() => {
        printToTerminal("Bio updated successfully!", "success");
        windowSystem.updateWindowContent("profileWindow");
      })
      .catch((error) => {
        printToTerminal("Error updating bio: " + error.message, "error");
      });
  }
}

// Add functions for quest management
async function completeAllQuests(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questsRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests");

    const snapshot = await questsRef.get();
    const completionPromises = [];

    snapshot.forEach((doc) => {
      const quest = doc.data();
      if (
        !quest.completed ||
        (type === "daily" && !wasCompletedToday(quest.lastCompletion))
      ) {
        completionPromises.push(completeQuest(doc.id, type));
      }
    });

    await Promise.all(completionPromises);
    printToTerminal(`All ${type} quests completed!`, "success");
    windowSystem.updateWindowContent(
      type === "daily" ? "dailyQuestsWindow" : "questsWindow"
    );
  } catch (error) {
    printToTerminal(`Error completing all quests: ${error.message}`, "error");
  }
}

async function updateQuestCount(questId, type, newCount) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests")
      .doc(questId);

    const questDoc = await questRef.get();
    if (!questDoc.exists) {
      printToTerminal("Quest not found.", "error");
      return;
    }

    const quest = questDoc.data();
    const count = parseInt(newCount);

    if (isNaN(count) || count < 0 || count > quest.targetCount) {
      printToTerminal("Invalid count value.", "error");
      windowSystem.updateWindowContent(
        type === "daily" ? "dailyQuestsWindow" : "questsWindow"
      );
      return;
    }

    if (count >= quest.targetCount) {
      // Complete the quest if target reached
      await completeQuest(questId, type);
    } else {
      // Update progress
      await questRef.update({
        currentCount: count,
      });
      printToTerminal(
        `Progress updated: ${count}/${quest.targetCount} ${quest.metric}`,
        "success"
      );
    }

    windowSystem.updateWindowContent(
      type === "daily" ? "dailyQuestsWindow" : "questsWindow"
    );
  } catch (error) {
    printToTerminal("Error updating quest count: " + error.message, "error");
  }
}

// Make these functions available globally
window.completeAllQuests = completeAllQuests;
window.updateQuestCount = updateQuestCount;
window.updateQuestProgress = updateQuestProgress;

// Helper function to check if player's rank is sufficient
function isRankSufficient(playerRank, requiredRank) {
  const ranks = ["E", "D", "C", "B", "A", "S"];
  const playerRankIndex = ranks.indexOf(playerRank);
  const requiredRankIndex = ranks.indexOf(requiredRank);
  return playerRankIndex >= requiredRankIndex;
}

// Helper function to format duration
function formatDuration(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} minutes`;
}

// Add these helper functions to handle item effects
function getActiveItemEffects(playerInventory) {
  if (!playerInventory) return [];

  const now = Date.now();
  return playerInventory
    .filter((item) => !item.expiresAt || item.expiresAt > now)
    .map((inventoryItem) => {
      const item = Object.values(ITEMS).find((i) => i.id === inventoryItem.id);
      return item ? item.effect : null;
    })
    .filter((effect) => effect !== null);
}

function calculateTotalBoost(type, activeEffects) {
  let multiplier = 1;

  activeEffects.forEach((effect) => {
    if (
      effect.type === type ||
      effect.type === "global_xp" ||
      effect.type === "all_stats"
    ) {
      multiplier *= effect.value;
    }
  });

  return multiplier;
}

// Modify the addExperiencePoints function to apply XP boosts
async function addExperiencePoints(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const amount = parseInt(args[0]) || 0;
    if (amount <= 0) {
      printToTerminal("Please specify a valid amount of XP.", "error");
      return;
    }

    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const playerData = playerDoc.data();

    // Calculate XP boost from active items
    const activeEffects = getActiveItemEffects(playerData.inventory);
    const xpMultiplier = calculateTotalBoost("global_xp", activeEffects);
    const boostedXP = Math.floor(amount * xpMultiplier);

    // Update local stats first for immediate feedback
    playerStats.exp += boostedXP;
    updateStatusBar(); // Update UI immediately

    // Update the player's XP in database
    await playerRef.update({
      exp: firebase.firestore.FieldValue.increment(boostedXP),
    });

    if (xpMultiplier > 1) {
      printToTerminal(
        `Gained ${boostedXP} XP! (${amount} × ${xpMultiplier.toFixed(
          2
        )} boost)`,
        "success"
      );
    } else {
      printToTerminal(`Gained ${boostedXP} XP!`, "success");
    }

    // Check for level up
    await checkLevelUp(playerRef, playerStats.exp);
  } catch (error) {
    printToTerminal(
      "Error adding experience points: " + error.message,
      "error"
    );
  }
}

// Add function to use consumable items
async function useItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  // Find the item in the player's inventory
  const inventoryItem = player.inventory.find((item) => item.id === itemId);
  if (!inventoryItem) {
    printToTerminal("Item not found in your inventory.", "error");
    return;
  }

  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Invalid item.", "error");
    return;
  }

  try {
    switch (item.effect.type) {

      case "name_color":
        const selectedColor = await showColorPickerDialog();
        if (selectedColor) {
          await playerRef.update({
            "profile.nameColor": selectedColor,
            inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
          });
          printToTerminal(
            `Used ${item.name} and changed your name color to ${selectedColor}!`,
            "success"
          );
          // Update local playerStats
          if (!playerStats.profile) playerStats = {};
          playerStats.profile = playerStats.profile || {};
          playerStats.profile.nameColor = selectedColor;
          // Update all windows that show the player's name
          windowSystem.updateWindowContent("profileWindow");
          windowSystem.updateWindowContent("leaderboardWindow");
        }
        break;

      case "gold":
        await playerRef.update({
          gold: firebase.firestore.FieldValue.increment(item.effect.value),
          inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
        });
        playerStats.gold += item.effect.value;
        printToTerminal(
          `Used ${item.name} and gained ${item.effect.value} gold!`,
          "success"
        );
        break;

      case "complete_quest":
      case "reset_daily":
      case "remove_fatigue":
        // These items are handled by their respective functions
        // They should be called here when implemented
        printToTerminal(`Used ${item.name}!`, "success");
        break;

      case "title":
        await playerRef.update({
          "profile.title": item.effect.value,
          "profile.titleColor": item.effect.color || null,
          inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
        });
        if (!playerStats.profile) playerStats.profile = {};
        playerStats.profile.title = item.effect.value;
        playerStats.profile.titleColor = item.effect.color || null;
        printToTerminal(`Your title has been set to: ${item.effect.value}!`, "success");
        showNotification(`Title changed to: ${item.effect.value}`);
        
        // Update all windows that might display the title
        windowSystem.updateWindowContent("profileWindow");
        windowSystem.updateWindowContent("leaderboardWindow");
        windowSystem.updateWindowContent("shopWindow");
        windowSystem.updateWindowContent("inventoryWindow");
        windowSystem.updateWindowContent("questsWindow");
        windowSystem.updateWindowContent("dailyQuestsWindow");
        windowSystem.updateWindowContent("achievementsWindow");
        windowSystem.updateWindowContent("rankProgressWindow");
        
        // Update terminal prompt if it shows the title
        updateTerminalPrompt();
        break;

      case "title_color":
        await playerRef.update({
          "profile.titleColor": item.effect.value,
          inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
        });
        if (!playerStats.profile) playerStats.profile = {};
        playerStats.profile.titleColor = item.effect.value;
        printToTerminal(`Your title color has been set to: ${item.effect.value}!`, "success");
        showNotification(`Title color changed to: ${item.effect.value}`);
        
        // Update all windows that might display the title
        windowSystem.updateWindowContent("profileWindow");
        windowSystem.updateWindowContent("leaderboardWindow");
        windowSystem.updateWindowContent("shopWindow");
        windowSystem.updateWindowContent("inventoryWindow");
        windowSystem.updateWindowContent("questsWindow");
        windowSystem.updateWindowContent("dailyQuestsWindow");
        windowSystem.updateWindowContent("achievementsWindow");
        windowSystem.updateWindowContent("rankProgressWindow");
        rank
        // Update terminal prompt if it shows the title
        updateTerminalPrompt();
        break;

      default:
        // For items with duration-based effects, they're automatically applied
        // through the getActiveItemEffects function
        printToTerminal(`${item.name} is already active!`, "info");
        return;
    }

    // Remove item from inventory
    await playerRef.update({
      inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
    });

    // Update local stats
    playerStats.inventory = playerStats.inventory.filter(
      (item) => item.id !== itemId
    );

    showNotification("Item used successfully!");
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error using item: " + error.message, "error");
  }
}

// Make functions available to the window
window.useItem = useItem;

// Add function to sell an item
window.sellItem = async function sellItem(itemId) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  const playerData = playerDoc.data();

  // Find the item in the player's inventory
  const inventoryItem = playerData.inventory.find((item) => item.id === itemId);
  if (!inventoryItem) {
    printToTerminal("Item not found in your inventory.", "error");
    return;
  }

  const item = Object.values(ITEMS).find((item) => item.id === itemId);
  if (!item) {
    printToTerminal("Invalid item.", "error");
    return;
  }

  try {
    const sellPrice = calculateSellPrice(item);

    // Remove item from inventory and add gold
    await playerRef.update({
      gold: firebase.firestore.FieldValue.increment(sellPrice),
      inventory: firebase.firestore.FieldValue.arrayRemove(inventoryItem),
    });

    // Update local stats
    playerStats.gold += sellPrice;
    playerStats.inventory = playerStats.inventory.filter(
      (item) => item.id !== itemId
    );

    // Play sell sound
    notificationSystem.playSound("sell");

    printToTerminal(
      `Sold ${item.name} for ${sellPrice} gold! (50% of original price)`,
      "success"
    );
    showNotification(`Sold ${item.name} for ${sellPrice} gold!`);

    updateStatusBar();
    windowSystem.updateWindowContent("inventoryWindow");
  } catch (error) {
    printToTerminal("Error selling item: " + error.message, "error");
  }
}

// Add function to show color picker dialog
async function showColorPickerDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "color-picker-dialog";
    dialog.innerHTML = `
      <div class="color-picker-content">
        <h3>Choose Your Name Color</h3>
        <input style="z-index: 2" type="color" id="colorPicker" value="#00ffff">
        <div class="color-picker-actions">
          <button class="window-button" id="confirmColor">Confirm</button>
          <button class="window-button" id="cancelColor">Cancel</button>
        </div>
      </div>
    `;

    // Add CSS if not already present
    if (!document.getElementById("colorPickerStyles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "colorPickerStyles";
      styleSheet.textContent = `
        .color-picker-dialog {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
        }
        .color-picker-content {
          background: rgba(0, 16, 32, 0.95);
          border: 1px solid #0088ff;
          border-radius: 4px;
          padding: 20px;
          text-align: center;
        }
        .color-picker-content h3 {
          color: #00ffff;
          margin-bottom: 15px;
        }
        .color-picker-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        #colorPicker {
          width: 100px;
          height: 40px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `;
      document.head.appendChild(styleSheet);
    }

    document.body.appendChild(dialog);

    const colorPicker = dialog.querySelector("#colorPicker");
    const confirmBtn = dialog.querySelector("#confirmColor");
    const cancelBtn = dialog.querySelector("#cancelColor");

    confirmBtn.addEventListener("click", () => {
      const color = colorPicker.value;
      document.body.removeChild(dialog);
      resolve(color);
    });

    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(dialog);
      resolve(null);
    });
  });
}

// Define ranks and their requirements
const RANKS = ["E", "D", "C", "B", "A", "S"];

const RANK_REQUIREMENTS = {
  D: {
    level: 5,
    quests: 10,
    achievements: 3,
  },
  C: {
    level: 10,
    quests: 25,
    achievements: 5,
  },
  B: {
    level: 20,
    quests: 50,
    achievements: 10,
  },
  A: {
    level: 35,
    quests: 100,
    achievements: 15,
  },
  S: {
    level: 50,
    quests: 200,
    achievements: 25,
  },
};



// Add touch event handling for windows
function initializeTouchEvents() {
  const windows = document.querySelectorAll(".window");
  windows.forEach((window) => {
    let touchStartX = 0;
    let touchStartY = 0;
    let initialX = 0;
    let initialY = 0;

    window.addEventListener("touchstart", (e) => {
      if (
        e.target.closest(".window-header") &&
        !e.target.closest(".window-close")
      ) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        initialX = window.offsetLeft;
        initialY = window.offsetTop;
      }
    });

    window.addEventListener("touchmove", (e) => {
      if (touchStartX && touchStartY) {
        e.preventDefault();
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;

        window.style.left = `${initialX + deltaX}px`;
        window.style.top = `${initialY + deltaY}px`;
      }
    });

    window.addEventListener("touchend", () => {
      touchStartX = 0;
      touchStartY = 0;
    });
  });
}

// Add double-tap prevention
function preventDoubleTapZoom() {
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );
}

// Optimize scrolling performance
function optimizeScrolling() {
  const scrollableElements = document.querySelectorAll(
    ".terminal-container, .window-content"
  );
  scrollableElements.forEach((element) => {
    element.style.webkitOverflowScrolling = "touch";
  });
}

// Update window initialization
const originalWindowInit = windowSystem.init;
windowSystem.init = function () {
  originalWindowInit.call(this);
  initializeTouchEvents();
  preventDoubleTapZoom();
  optimizeScrolling();

  // Add orientation change handling
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      const windows = document.querySelectorAll(".window");
      windows.forEach((window) => {
        if (window.classList.contains("show")) {
          const viewportHeight = window.innerHeight;
          const windowHeight = window.offsetHeight;
          if (windowHeight > viewportHeight * 0.9) {
            window.style.height = "90vh";
            window.style.top = "5vh";
          }
        }
      });
    }, 100);
  });
};

async function handlePenaltyCommand(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    // Parse penalty amount from command arguments
    const penaltyAmount = args.length > 0 ? parseInt(args[0]) : 0;
    if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
      printToTerminal("Please specify a valid penalty amount (e.g., !penalty 2000)", "error");
      return;
    }

    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const player = playerDoc.data();
    
    const currentExp = player.exp || 0;
    const currentLevel = player.level || 1;

    // Calculate new exp and level
    let newExp = currentExp - penaltyAmount;
    let newLevel = currentLevel;

    while (newExp < 0 && newLevel > 1) {
      newLevel--;
      newExp += getExpNeededForLevel(newLevel);
    }
    if (newLevel === 1 && newExp < 0) newExp = 0;

    const levelsLost = currentLevel - newLevel;
    const now = firebase.firestore.Timestamp.now();

    // Update player stats
    await playerRef.update({
      exp: newExp,
      level: newLevel,
      lastPenalty: now,
      lastPenaltyAmount: penaltyAmount,
    });

    // Update local stats
    playerStats.exp = newExp;
    playerStats.level = newLevel;

    // Create penalty log
    await db.collection("penaltyLogs").add({
      userId: currentUser.uid,
      timestamp: now,
      penaltyAmount,
      previousExp: currentExp,
      previousLevel: currentLevel,
      newExp,
      newLevel,
      expLost: penaltyAmount,
      levelsLost,
      manualPenalty: true
    });

    

    // Create notification
    await db.collection("notifications").add({
      userId: currentUser.uid,
      type: "penalty",
      timestamp: now,
      read: false,
      message: `Manual Penalty Applied: Lost ${penaltyAmount} XP${levelsLost > 0 ? ` and ${levelsLost} level${levelsLost > 1 ? 's' : ''}` : ''}.`,
      details: {
        penaltyAmount,
        expLost: penaltyAmount,
        levelsLost,
        previousLevel: currentLevel,
        newLevel,
      },
    });

    // Display penalty details
    printToTerminal("\n=== PENALTY APPLIED ===", "error");
    printToTerminal(`XP Lost: ${penaltyAmount}`, "error");
    if (levelsLost > 0) printToTerminal(`Levels Lost: ${levelsLost}`, "error");
    printToTerminal(`Previous Level: ${currentLevel}`, "info");
    printToTerminal(`New Level: ${newLevel}`, "info");
    printToTerminal(`Previous EXP: ${currentExp}`, "info");
    printToTerminal(`New EXP: ${newExp}`, "info");

    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("profileWindow");
    windowSystem.updateWindowContent("notificationsWindow");

    // Play penalty voice line
    audioSystem.playVoiceLine('PENALTY');
  } catch (error) {
    console.error("Error in penalty command:", error);
    printToTerminal("Error applying penalty: " + error.message, "error");
  }
}

commands["!penalty"] = handlePenaltyCommand; // Register command
// Add delete quest function
async function deleteQuest(questId, type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const questRef = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests")
      .doc(questId);

    const questDoc = await questRef.get();
    if (!questDoc.exists) {
      printToTerminal("Quest not found.", "error");
      return;
    }

    const quest = questDoc.data();
    await questRef.delete();
    
    printToTerminal(`Quest "${quest.title}" deleted successfully!`, "success");
    windowSystem.updateWindowContent(type === "daily" ? "dailyQuestsWindow" : "questsWindow");
  } catch (error) {
    printToTerminal("Error deleting quest: " + error.message, "error");
  }
}

// Add delete command handler
commands["!delete"] = async (args) => {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (args.length < 2) {
    printToTerminal("Usage: !delete [quest/daily] [questId]", "error");
    return;
  }

  const type = args[0].toLowerCase();
  const questId = args[1];

  if (type !== "quest" && type !== "daily") {
    printToTerminal("Invalid type. Use 'quest' or 'daily'.", "error");
    return;
  }

  await deleteQuest(questId, type === "daily" ? "daily" : "normal");
};

// Make delete function available globally
window.deleteQuest = deleteQuest;

// Voice Lines System
const VOICE_LINES = {
  LEVEL_UP: [
    'I am getting stronger.',
    'My power... it\'s growing.',
    'This is just the beginning.',
    'I can feel it... I\'m becoming more powerful.',
    'Each level makes me stronger.'
  ],
  QUEST_COMPLETE: [
    'Another quest completed.',
    'Mission accomplished.',
    'All according to plan.',
    'One step closer to becoming the strongest hunter.',
    'That was merely a warm-up.'
  ],
  BOSS_START: [
    'Arise.',
    'Let\'s test your strength.',
    'Show me what you\'ve got.',
    'This might be interesting.',
    'Time to hunt.'
  ],
  BOSS_VICTORY: [
    'Know your place.',
    'Is that all you\'ve got?',
    'You were not strong enough.',
    'Another one falls.',
    'Victory was inevitable.'
  ],
  DEMON_BATTLE: [
    'Face your demons.',
    'Conquer your weaknesses.',
    'Your fears make you weak.',
    'Overcome your limits.',
    'Break through your barriers.'
  ],
  ACHIEVEMENT: [
    'Progress... I can feel it.',
    'Another milestone reached.',
    'Getting closer to my goal.',
    'This is just a stepping stone.',
    'Becoming stronger every day.'
  ],
  DAILY_RESET: [
    'A new day begins.',
    'Time to get stronger.',
    'Another day of hunting.',
    'Let\'s see what today brings.',
    'Ready for today\'s challenges.'
  ],
  PENALTY: [
    'Unacceptable.',
    'I must do better.',
    'This weakness... I\'ll overcome it.',
    'A setback... but temporary.',
    'Learn from failure.'
  ],
  RANK_UP: [
    'My rank increases.',
    'Moving up in the world.',
    'One step closer to the top.',
    'The shadow monarch rises.',
    'Power befitting my status.'
  ],
  STREAK: [
    'Consistency is key.',
    'Day after day, growing stronger.',
    'My dedication shows results.',
    'The path to power is endless.',
    'No days wasted.'
  ]
};

// Audio System
const audioSystem = {
  playVoiceLine(category) {
    if (!VOICE_LINES[category]) return;
    
    const lines = VOICE_LINES[category];
    const randomLine = lines[Math.floor(Math.random() * lines.length)];
    
    // Convert the line to a filename format (lowercase, spaces to underscores)
    const filename = randomLine.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const audioPath = `sounds/voice/${filename}.mp3`;
    
    const audio = new Audio(audioPath);
    audio.volume = 0.7; // Adjust volume as needed
    
    try {
      audio.play().catch((error) => {
        console.log('Voice line not available:', error);
      });
    } catch (error) {
      console.log('Error playing voice line:', error);
    }
  }
};

// Modify the levelUp notification to include voice line
function handleLevelUp(levelsGained) {
  // ... existing level up code ...
  audioSystem.playVoiceLine('LEVEL_UP');
}

function handleQuestComplete() {
  audioSystem.playVoiceLine('QUEST_COMPLETE');
}

function handleBossBattleStart() {
  audioSystem.playVoiceLine('BOSS_START');
}

function handleAchievementUnlock() {
  audioSystem.playVoiceLine('ACHIEVEMENT');
}

function handleDailyReset() {  audioSystem.playVoiceLine('DAILY_RESET');
}

function handlePenalty() {
  audioSystem.playVoiceLine('PENALTY');
}

function handleRankUp() {
  audioSystem.playVoiceLine('RANK_UP');
}

function handleStreakMilestone() {
  audioSystem.playVoiceLine('STREAK');
}






// Add rank system constants
const RANK_SYSTEM = {
  E: {
    name: "E Rank",
    requirements: {
      level: 1,
      questsCompleted: 0,
      achievements: 0,
    },
    color: "#808080", // Gray
  },
  D: {
    name: "D Rank",
    requirements: {
      level: 5,
      questsCompleted: 10,
      achievements: 3,
    },
    color: "#CD7F32", // Bronze
  },
  C: {
    name: "C Rank",
    requirements: {
      level: 10,
      questsCompleted: 25,
      achievements: 7,
    },
    color: "#C0C0C0", // Silver
  },
  B: {
    name: "B Rank",
    requirements: {
      level: 20,
      questsCompleted: 50,
      achievements: 12,
    },
    color: "#FFD700", // Gold
  },
  A: {
    name: "A Rank",
    requirements: {
      level: 35,
      questsCompleted: 100,
      achievements: 20,
    },
    color: "#E5E4E2", // Platinum
  },
  S: {
    name: "S Rank",
    requirements: {
      level: 50,
      questsCompleted: 200,
      achievements: 30,
    },
    color: "#B9F2FF", // Diamond
  },
};

async function showRankProgress() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const rankProgress = checkRankProgress(player);
    
    // Define consistent blue color scheme with different shapes for ranks
    const rankStyles = {
      E: {
        shape: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)", // Basic hexagon
        edges: 6,
        border: "#00a2ff",
        glow: "rgba(0, 162, 255, 0.4)",
        baseColor: "#00a2ff",
        intensity: 0.2,
        particleCount: 0,
        animation: ""
      },
      D: {
        shape: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)", // Basic hexagon with inner hexagon
        edges: 6,
        border: "#00a2ff",
        glow: "rgba(0, 162, 255, 0.5)",
        baseColor: "#00a8ff",
        intensity: 0.25,
        particleCount: 3,
        animation: ""
      },
      C: {
        shape: "polygon(50% 0%, 100% 25%, 93% 75%, 50% 100%, 7% 75%, 0% 25%)", // More angled hexagon
        edges: 6,
        border: "#00a8ff",
        glow: "rgba(0, 168, 255, 0.6)",
        baseColor: "#00a8ff",
        intensity: 0.3,
        particleCount: 5,
        animation: "pulseSoft 3s infinite"
      },
      B: {
        shape: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", // More defined hexagon
        edges: 6,
        border: "#00b8ff",
        glow: "rgba(0, 184, 255, 0.7)",
        baseColor: "#00b8ff",
        intensity: 0.35,
        particleCount: 8,
        animation: "pulseSoft 2.5s infinite"
      },
      A: {
        shape: "polygon(50% 0%, 100% 20%, 100% 80%, 50% 100%, 0% 80%, 0% 20%)", // Stretched hexagon
        edges: 6,
        border: "#00c8ff",
        glow: "rgba(0, 200, 255, 0.8)",
        baseColor: "#00c8ff",
        intensity: 0.4,
        particleCount: 12,
        animation: "pulseBright 2s infinite"
      },
      S: {
        shape: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%, 50% 50%)", // Star-like shape
        edges: 8,
        border: "#00d8ff",
        glow: "rgba(0, 216, 255, 0.9)",
        baseColor: "#00d8ff",
        intensity: 0.5,
        particleCount: 16,
        animation: "pulseBright 1.5s infinite, rotateHex 10s linear infinite"
      }
    };

    // Get styles for current and next rank
    const currentRankStyle = rankStyles[rankProgress.currentRank];
    const nextRankStyle = rankProgress.nextRank ? rankStyles[rankProgress.nextRank] : null;

    const rankProgressContent = document.getElementById("rankProgressContent");
    rankProgressContent.innerHTML = `
      <div class="solo-window-section">
        <div class="sl-system-header">
          <div class="sl-system-line"></div>
          <div class="sl-title">PLAYER RANK SYSTEM</div>
          <div class="sl-system-line"></div>
        </div>
        
        ${
          rankProgress.nextRank
            ? `
            <div class="rank-info">
              <div class="current-rank">
                <div class="sl-rank-container" data-particles="${currentRankStyle.particleCount}">
                  <div class="sl-rank-hex" style="--rank-shape: ${currentRankStyle.shape}; --rank-color: ${currentRankStyle.border}; --rank-base: ${currentRankStyle.baseColor}; --rank-intensity: ${currentRankStyle.intensity}; animation: ${currentRankStyle.animation};">
                    <span class="sl-rank-value">${rankProgress.currentRank}</span>
                    ${currentRankStyle.edges > 6 ? `<div class="sl-rank-inner"></div>` : ''}
              </div>
                </div>
                <div class="rank-label">CURRENT<br>RANK</div>
              </div>
              
              <div class="rank-arrow">
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <path d="M0 10 H30 M20 0 L30 10 L20 20" stroke="${nextRankStyle.border}" stroke-width="2" fill="none" />
                </svg>
              </div>
              
              <div class="next-rank">
                <div class="sl-rank-container" data-particles="${nextRankStyle.particleCount}">
                  <div class="sl-rank-hex" style="--rank-shape: ${nextRankStyle.shape}; --rank-color: ${nextRankStyle.border}; --rank-base: ${nextRankStyle.baseColor}; --rank-intensity: ${nextRankStyle.intensity}; animation: ${nextRankStyle.animation};">
                    <span class="sl-rank-value">${rankProgress.nextRank}</span>
                    ${nextRankStyle.edges > 6 ? `<div class="sl-rank-inner"></div>` : ''}
                  </div>
                </div>
                <div class="rank-label">TARGET<br>RANK</div>
              </div>
            </div>

            <div class="sl-requirements-section">
              <div class="sl-section-header">
                <span>ADVANCEMENT REQUIREMENTS</span>
                <div class="sl-header-line"></div>
              </div>
              
              <div class="sl-requirement-item">
                <div class="requirement-label">
                  <span class="requirement-title">Hunter Level</span>
                  <div class="requirement-hex-container">
                    <div class="requirement-hex-bg"></div>
                  <span class="requirement-value">${rankProgress.currentValues.level}/${rankProgress.requirements.level}</span>
              </div>
                </div>
                <div class="sl-progress-container">
                  <div class="sl-progress-bg">
                    <div class="sl-progress-bar" style="width: ${rankProgress.progress.level}%;"></div>
                  </div>
                  <div class="sl-progress-value">${rankProgress.progress.level}%</div>
              </div>
            </div>

              <div class="sl-requirement-item">
                <div class="requirement-label">
                  <span class="requirement-title">Quests Completed</span>
                  <div class="requirement-hex-container">
                    <div class="requirement-hex-bg"></div>
                  <span class="requirement-value">${rankProgress.currentValues.questsCompleted}/${rankProgress.requirements.quests}</span>
              </div>
                </div>
                <div class="sl-progress-container">
                  <div class="sl-progress-bg">
                    <div class="sl-progress-bar" style="width: ${rankProgress.progress.quests}%;"></div>
                  </div>
                  <div class="sl-progress-value">${rankProgress.progress.quests}%</div>
              </div>
            </div>

              <div class="sl-requirement-item">
                <div class="requirement-label">
                  <span class="requirement-title">Achievements</span>
                  <div class="requirement-hex-container">
                    <div class="requirement-hex-bg"></div>
                  <span class="requirement-value">${rankProgress.currentValues.achievements}/${rankProgress.requirements.achievements}</span>
              </div>
                </div>
                <div class="sl-progress-container">
                  <div class="sl-progress-bg">
                    <div class="sl-progress-bar" style="width: ${rankProgress.progress.achievements}%;"></div>
                  </div>
                  <div class="sl-progress-value">${rankProgress.progress.achievements}%</div>
              </div>
            </div>

              <div class="sl-requirement-item overall">
                <div class="requirement-label">
                  <span class="requirement-title">Overall Progress</span>
                  <div class="requirement-hex-container overall">
                    <div class="requirement-hex-bg"></div>
                  <span class="requirement-value">${rankProgress.progress.overall}%</span>
              </div>
              </div>
                <div class="sl-progress-container">
                  <div class="sl-progress-bg">
                    <div class="sl-progress-bar" style="width: ${rankProgress.progress.overall}%;"></div>
                  </div>
                  <div class="sl-progress-value">${rankProgress.progress.overall}%</div>
                </div>
              </div>
              
              <div class="sl-system-footer">
                <div class="sl-footer-line"></div>
                <div class="sl-footer-text">HUNTER ASSOCIATION</div>
                <div class="sl-footer-line"></div>
            </div>
          </div>
        `
            : `
            <div class="sl-max-rank-message">
              <div class="sl-rank-container max" data-particles="${currentRankStyle.particleCount * 2}">
                <div class="sl-rank-hex max" style="--rank-shape: ${currentRankStyle.shape}; --rank-color: ${currentRankStyle.border}; --rank-base: ${currentRankStyle.baseColor}; --rank-intensity: ${currentRankStyle.intensity * 1.5}; animation: ${currentRankStyle.animation};">
                  <span class="sl-rank-value">${rankProgress.currentRank}</span>
                  ${currentRankStyle.edges > 6 ? `<div class="sl-rank-inner"></div>` : ''}
                </div>
                <div class="sl-max-rank-glow"></div>
              </div>
              <div class="sl-max-rank-text">
                <div class="sl-max-rank-header">MAXIMUM RANK ACHIEVED</div>
                <div class="sl-max-rank-congrats">Congratulations, Hunter.</div>
                <div class="sl-max-rank-status">STATUS: EXCEPTIONAL</div>
              </div>
              <div class="sl-system-footer">
                <div class="sl-footer-line"></div>
                <div class="sl-footer-text">HUNTER ASSOCIATION</div>
                <div class="sl-footer-line"></div>
            </div>
          </div>
        `
        }
        <div class="sl-system-glitch"></div>
      </div>
    `;

    // Add CSS if not already present
    if (!document.getElementById("soloLevelingRankStyles")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "soloLevelingRankStyles";
      styleSheet.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
        
        #rankProgressWindow {
          background: rgba(8, 19, 34, 0.85) !important;
          border: 1px solid rgba(0, 160, 255, 0.6) !important;
          box-shadow: 0 0 15px rgba(0, 190, 255, 0.4), inset 0 0 20px rgba(0, 130, 255, 0.1) !important;
          font-family: 'Rajdhani', sans-serif !important;
        }
        
        #rankProgressWindow::before {
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
        
        .solo-window-section {
          position: relative;
          color: #e0f7ff;
          z-index: 1;
        }
        
        .sl-system-header {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        
        .sl-title {
          font-size: 18px;
          font-weight: 600;
          color: #00a8ff;
          margin: 0 10px;
          text-shadow: 0 0 5px rgba(0, 168, 255, 0.7);
          letter-spacing: 1px;
        }
        
        .sl-system-line {
          height: 1px;
          flex-grow: 1;
          background: linear-gradient(90deg, transparent, #00a8ff, transparent);
        }
        
        .rank-info {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 25px 0;
          gap: 15px;
        }
        
        .sl-rank-container {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 10px;
          width: 80px;
          height: 80px;
        }
        
        .sl-rank-hex {
          width: 70px;
          height: 70px;
          background: #0a1428;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          clip-path: var(--rank-shape);
          border: 2px solid var(--rank-color);
          box-shadow: 0 0 10px var(--rank-color);
          z-index: 2;
        }
        
        .sl-rank-hex::before {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          right: 3px;
          bottom: 3px;
          background: var(--rank-base);
          opacity: var(--rank-intensity);
          clip-path: var(--rank-shape);
          z-index: -1;
        }
        
        .sl-rank-inner {
          position: absolute;
          width: 60%;
          height: 60%;
          background: transparent;
          border: 1.5px solid var(--rank-color);
          opacity: 0.8;
          clip-path: var(--rank-shape);
          z-index: 1;
        }
        
        .sl-rank-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--rank-color);
          text-shadow: 0 0 5px var(--rank-color);
          z-index: 2;
        }
        
        .rank-label {
          font-size: 12px;
          font-weight: 600;
          color: #88ccff;
          text-align: center;
          letter-spacing: 1px;
          margin-top: 8px;
        }
        
        .rank-arrow svg {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: drawArrow 2s forwards;
        }
        
        .sl-requirements-section {
          background: rgba(10, 20, 40, 0.4);
          border: 1px solid rgba(0, 160, 255, 0.3);
          border-radius: 5px;
          padding: 20px;
          position: relative;
          margin-top: 10px;
        }
        
        .sl-requirements-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 174, 255, 0.8), transparent);
          z-index: 1;
        }
        
        .sl-section-header {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid rgba(0, 160, 255, 0.3);
        }
        
        .sl-section-header span {
          font-size: 14px;
          font-weight: 600;
          color: #00a8ff;
          margin-right: 10px;
          letter-spacing: 1px;
        }
        
        .sl-header-line {
          height: 1px;
          flex-grow: 1;
          background: linear-gradient(90deg, #00a8ff, transparent);
        }
        
        .sl-requirement-item {
          margin-bottom: 15px;
          padding: 10px;
          background: rgba(8, 20, 40, 0.5);
          border-radius: 5px;
          transition: all 0.2s ease;
        }
        
        .sl-requirement-item:hover {
          background: rgba(10, 30, 60, 0.6);
          transform: translateY(-2px);
          box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
        }
        
        .requirement-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .requirement-title {
          font-size: 14px;
          font-weight: 500;
          color: #7bd5ff;
        }
        
        .requirement-hex-container {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-left: 10px;
        }
        
        .requirement-hex-bg {
          width: 40px;
          height: 25px;
          background: rgba(0, 60, 120, 0.3);
          clip-path: polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%);
          position: absolute;
        }
        
        .requirement-value {
          font-size: 13px;
          font-weight: 600;
          color: #8ecfff;
          z-index: 1;
        }
        
        .sl-progress-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .sl-progress-bg {
          height: 6px;
          background: rgba(0, 40, 80, 0.4);
          border-radius: 3px;
          flex-grow: 1;
          position: relative;
          overflow: hidden;
        }
        
      .sl-progress-bar {
          height: 100%;
          width: 0; /* Start at 0 */
          background: linear-gradient(90deg, rgba(0, 160, 255, 0.5), #00d8ff);
          border-radius: 3px;
          position: relative;
          transition: width 0.3s ease;
          box-shadow: 0 0 5px rgba(0, 200, 255, 0.7);
        }
    
        
        .sl-progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 5px;
          background: #00d8ff;
          box-shadow: 0 0 10px #00d8ff;
          opacity: 0.8;
        }
        
        .sl-progress-value {
          font-size: 12px;
          font-weight: 600;
          color: #a0e0ff;
          min-width: 45px;
          text-align: left;
        }
        
        .sl-requirement-item.overall {
          background: rgba(0, 80, 160, 0.15);
          border: 1px solid rgba(0, 174, 255, 0.4);
        }
        
        .sl-max-rank-message {
        display: flex;
        flex-direction: column;
          align-items: center;
        justify-content: center;
          text-align: center;
          padding: 20px 0;
        }
        
        .sl-rank-container.max {
          transform: scale(1.4);
          margin: 20px 0 30px;
        }
        
        .sl-max-rank-glow {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, #00d8ff 0%, transparent 70%);
          opacity: 0.2;
          animation: pulse 2s infinite;
          z-index: 1;
        }
        
        .sl-max-rank-text {
          margin-bottom: 20px;
        }
        
        .sl-max-rank-header {
          font-size: 18px;
          font-weight: 700;
          color: #00a8ff;
          margin-bottom: 10px;
          text-shadow: 0 0 5px rgba(0, 168, 255, 0.7);
          letter-spacing: 1px;
        }
        
        .sl-max-rank-congrats {
          font-size: 16px;
          color: #ffffff;
          margin-bottom: 5px;
        }
        
        .sl-max-rank-status {
          font-size: 14px;
          font-weight: 600;
          color: #7bd5ff;
          background: rgba(0, 80, 160, 0.3);
          display: inline-block;
          padding: 3px 10px;
          border-radius: 3px;
          margin-top: 10px;
        }
        
        .sl-system-footer {
          display: flex;
        align-items: center;
          justify-content: center;
          margin-top: 20px;
          padding: 5px 0;
        }
        
        .sl-footer-line {
          height: 1px;
          flex-grow: 1;
          background: linear-gradient(90deg, transparent, rgba(0, 140, 255, 0.5), transparent);
        }
        
        .sl-footer-text {
          font-size: 12px;
          font-weight: 500;
          color: #5a9cd2;
          margin: 0 10px;
          letter-spacing: 1px;
        }
        
        .sl-system-glitch {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          z-index: 5;
          pointer-events: none;
          opacity: 0;
        }
        
        /* Rank particle effects */
        .sl-rank-particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background: var(--rank-color, #00a8ff);
          border-radius: 50%;
          opacity: 0;
          z-index: 1;
          box-shadow: 0 0 5px var(--rank-color, #00a8ff);
          animation: particleFloat 3s ease-in-out infinite;
        }
        
        /* Animations */
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        
        @keyframes drawArrow {
          to { stroke-dashoffset: 0; }
        }
        
        
        
        @keyframes pulse {
          0% { opacity: 0.1; transform: scale(0.95); }
          50% { opacity: 0.3; transform: scale(1.05); }
          100% { opacity: 0.1; transform: scale(0.95); }
        }
        
        @keyframes pulseSoft {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        
        @keyframes pulseBright {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.05); filter: brightness(1.3); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        
        @keyframes rotateHex {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes particleFloat {
          0% { transform: translate(0, 0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.5; }
          100% { transform: translate(var(--tx, 0), var(--ty, -30px)); opacity: 0; }
      
      `;
      document.head.appendChild(styleSheet);
    }

    // Show the window using the window system
    windowSystem.showWindow("rankProgressWindow");
    
    // Add random glitch effects
    const rankWindow = document.getElementById("rankProgressWindow");
    setInterval(() => {
      if (Math.random() > 0.9 && rankWindow.style.display !== 'none') {
        rankWindow.classList.add('glitching');
        setTimeout(() => rankWindow.classList.remove('glitching'), 300);
      }
    }, 2000);
    
    // Add particle effects to rank containers
    const rankContainers = document.querySelectorAll('.sl-rank-container');
    rankContainers.forEach(container => {
      const particleCount = parseInt(container.getAttribute('data-particles') || '0');
      const rankHex = container.querySelector('.sl-rank-hex');
      const color = getComputedStyle(rankHex).getPropertyValue('--rank-color') || '#00a8ff';
      
      // Clear existing particles
      container.querySelectorAll('.sl-rank-particle').forEach(p => p.remove());
      
      // Add new particles
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'sl-rank-particle';
        
        // Random position around the rank hex
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 10;
        const startX = 40 + Math.cos(angle) * (Math.random() * 10);
        const startY = 40 + Math.sin(angle) * (Math.random() * 10);
        
        // Random movement direction
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.setProperty('--rank-color', color);
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        
        container.appendChild(particle);
      }
    });
    
  } catch (error) {
    console.error("Error showing rank progress:", error);
    printToTerminal("Error showing rank progress: " + error.message, "error");
  }
}

async function checkAndUpdateRank(playerRef, player) {
  const rankProgress = checkRankProgress(player);
  if (rankProgress.nextRank && rankProgress.progress.overall >= 100) {
    const newRank = rankProgress.nextRank;

    await playerRef.update({
      rank: newRank,
    });

    // Update local stats
    playerStats.rank = newRank;

    // Show rank up message
    showNotification(`🎉 Ranked Up to ${newRank} Rank! 🎉`);
    printToTerminal(`\n=== RANK UP! ===`, "success");
    printToTerminal(
      `Congratulations! You've achieved ${newRank} Rank!`,
      "success"
    );
    printToTerminal(`Keep up the great work!`, "success");

    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("profileWindow");

    // Check for rank-related achievements
    await checkAchievements();

    audioSystem.playVoiceLine('RANK_UP');
    printToTerminal(`\n🎉 RANK UP! You are now rank ${newRank}!`, "success");

    return true;
  }
  return false;
}

function checkRankProgress(player) {
  const currentRank = player.rank || "E";
  
  // Fix #1: Define RANKS array if it doesn't exist
  const RANKS = Object.keys(RANK_SYSTEM); // This creates a proper ranks array from the RANK_SYSTEM keys
  const nextRankIndex = RANKS.indexOf(currentRank) + 1;
  const nextRank = nextRankIndex < RANKS.length ? RANKS[nextRankIndex] : null;

  // If player is at max rank, return early
  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progress: {
        level: 100,
        quests: 100,
        achievements: 100,
        overall: 100,
      },
    };
  }

  // Fix #2: Use RANK_SYSTEM instead of RANK_REQUIREMENTS
  const nextRankReqs = RANK_SYSTEM[nextRank].requirements;

  // Calculate progress percentages
  const levelProgress = Math.min(
    100,
    ((player.level || 1) / nextRankReqs.level) * 100
  );
  const questProgress = Math.min(
    100,
    ((player.questsCompleted || 0) / nextRankReqs.questsCompleted) * 100 // Fix #3: Update property name
  );

  // Ensure achievements are correctly counted
  const achievementsCount = Array.isArray(player.unlockedAchievements) 
    ? player.unlockedAchievements.length 
    : 0;
  const achievementProgress = Math.min(
    100,
    (achievementsCount / nextRankReqs.achievements) * 100
  );

  const overallProgress = Math.min(
    100,
    (levelProgress + questProgress + achievementProgress) / 3
  );

  // Debugging output to verify values
  console.log("Rank Progress Debug:", {
    level: player.level || 1,
    questsCompleted: player.questsCompleted || 0,
    achievementsCount: achievementsCount,
    unlockedAchievements: player.unlockedAchievements,
  });

  return {
    currentRank,
    nextRank,
    progress: {
      level: Math.round(levelProgress),
      quests: Math.round(questProgress),
      achievements: Math.round(achievementProgress),
      overall: Math.round(overallProgress),
    },
    requirements: {
      level: nextRankReqs.level,
      quests: nextRankReqs.questsCompleted, // Fix #4: Match property names in the return object
      achievements: nextRankReqs.achievements,
    },
    currentValues: {
      level: player.level || 1,
      questsCompleted: player.questsCompleted || 0,
      achievements: achievementsCount,
    },
  };
}
// Make functions available to the window
window.showRankProgress = showRankProgress;

// Add rank command handler
async function handleRankCommand() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();
  const rankProgress = checkRankProgress(player);

  printToTerminal("\n=== RANK STATUS ===", "system");
  printToTerminal(`Current Rank: ${player.rank}`, "info");

  if (rankProgress.nextRank) {
    printToTerminal(`Next Rank: ${rankProgress.nextRank}`, "info");
    printToTerminal("\nRequirements for next rank:", "info");
    printToTerminal(
      `Level: ${rankProgress.currentValues.level}/${
        rankProgress.requirements.level
      } (${Math.floor(rankProgress.progress.level)}%)`,
      "info"
    );
    printToTerminal(
      `Quests: ${rankProgress.currentValues.questsCompleted}/${
        rankProgress.requirements.questsCompleted
      } (${Math.floor(rankProgress.progress.quests)}%)`,
      "info"
    );
    printToTerminal(
      `Achievements: ${rankProgress.currentValues.achievements}/${
        rankProgress.requirements.achievements
      } (${Math.floor(rankProgress.progress.achievements)}%)`,
      "info"
    );
    printToTerminal(
      `\nOverall Progress: ${Math.floor(rankProgress.progress.overall)}%`,
      "success"
    );
  } else {
    printToTerminal("Maximum rank achieved!", "success");
  }

  printToTerminal(
    "\nTip: Use !rankprogress to open detailed rank progress window",
    "system"
  );
}

function showBossBattles() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  windowSystem.showWindow("BattleWindow");
}

// Add boss battle penalties
const BOSS_PENALTIES = {
  exp: -100,
  gold: -50,
};
async function handleBossBattleTimeout(playerRef, bossId) {
  try {
    // First, check if the battle exists before proceeding
    const battleRef = playerRef.collection("activeBattles").doc(bossId);
    const battleDoc = await battleRef.get();
    
    if (!battleDoc.exists) {
      // Log for debugging, but do not show this message to the user
      console.log(`No active battle found for boss ${bossId}.`);
      return;
    }
    
    // Check if penalty already applied
    const battle = battleDoc.data();
    if (battle.penaltyApplied) {
      console.log(`Penalties already applied for boss ${bossId}.`);
      return;
    }
    
    // CRITICAL: Immediately mark as being processed to prevent other calls
    await battleRef.update({ processingPenalty: true });

    // Get the battle data for use outside the transaction
    const bossName = battle.bossName || (BOSSES[bossId] ? BOSSES[bossId].name : "Unknown Boss");
    
    // Create timeout notification
    const timeoutTime = new Date();
    await db.collection('notifications').add({
      userId: auth.currentUser.uid,
      title: "Boss Battle Failed",
      message: `Your battle against ${bossName} has timed out. Better luck next time!`,
      type: "defeat",
      timestamp: firebase.firestore.Timestamp.fromDate(timeoutTime),
      read: false
    });
    
    // Update notification badge
    const count = await windowSystem.getUnreadNotificationsCount();
    windowSystem.updateNotificationBadge(count);
    
    // Apply gold penalty directly
    const updatedGold = Math.max(0, playerStats.gold + BOSS_PENALTIES.gold);
    await playerRef.update({
      gold: updatedGold
    });
    playerStats.gold = updatedGold;
    
    // Mark battle as completed with penalty applied and delete it
    await battleRef.update({ penaltyApplied: true });
    await battleRef.delete();
    
    // Print the initial failure message
    printToTerminal(`\n⚠️ Boss Battle Failed: ${bossName}`, "error");
    printToTerminal("Time's up! You've suffered penalties:", "error");
    printToTerminal(`${BOSS_PENALTIES.gold} Gold`, "error");
    
    // Update battle window
    windowSystem.updateWindowContent("BattleWindow");
    
    // Now apply the XP penalty using the handlePenaltyCommand function - ONLY ONCE
    await handlePenaltyCommand([Math.abs(BOSS_PENALTIES.exp).toString()]);
  } catch (error) {
    console.error("Error handling boss battle timeout:", error);
    printToTerminal("Error processing battle timeout: " + error.message, "error");
    
    // Additional error handling: Check if the battle document was deleted
    if (error.message.includes("No document to update")) {
      console.warn(`Battle document for boss ${bossId} was already deleted or does not exist.`);
    }
  }
}
window.calculateExpAfterPenalty = function calculateExpAfterPenalty(currentLevel, currentExp, penaltyExp) {
  // Ensure inputs are valid numbers
  currentLevel = Math.max(1, currentLevel);
  currentExp = Math.max(0, currentExp);
  penaltyExp = Math.abs(penaltyExp); // Ensure penalty is positive (we'll subtract it)

  let newExp = currentExp - penaltyExp;
  let newLevel = currentLevel;

  // If XP goes negative, calculate level-downs
  while (newExp < 0 && newLevel > 1) {
    newLevel--; // Decrease level
    const expNeededForPrevLevel = getExpNeededForLevel(newLevel);
    newExp += expNeededForPrevLevel; // Add back XP required for the previous level
  }

  // If still negative at level 1, clamp XP to 0
  if (newLevel === 1 && newExp < 0) {
    newExp = 0;
  }

  return {
    newLevel: newLevel,
    newExp: newExp,
    levelsLost: currentLevel - newLevel
  };
};

async function startBossBattle(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!args || args.length === 0) {
    printToTerminal("Usage: !challenge <boss_id>", "warning");
    printToTerminal("Example: !challenge step_master", "info");
    return;
  }

  const bossId = args[0];
  const boss = Object.values(BOSSES).find((b) => b.id === bossId);
  if (!boss) {
    printToTerminal("Invalid boss battle ID.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    
    // Check if the boss battle is already active
    const activeBattleRef = playerRef.collection("activeBattles").doc(bossId);
    const activeBattleDoc = await activeBattleRef.get();
    
    if (activeBattleDoc.exists) {
      printToTerminal(`You are already battling ${boss.name}!`, "warning");
      windowSystem.showWindow("BattleWindow");
      return;
    }
    
    const player = (await playerRef.get()).data();
    const defeatCount = player.defeatedBosses?.[bossId] || 0;

    // Calculate scaled target and rewards
    const scaledTarget =
      boss.baseTargetCount + defeatCount * boss.scaling.targetCount;
    const scaledExp = boss.rewards.exp + defeatCount * boss.scaling.rewards.exp;
    const scaledGold =
      boss.rewards.gold + defeatCount * boss.scaling.rewards.gold;

    // Start the battle
    const now = new Date();
    const endTime = new Date(now.getTime() + boss.timeLimit);

    await playerRef
      .collection("activeBattles")
      .doc(bossId)
      .set({
        bossId,
        bossName: boss.name,
        currentCount: 0,
        targetCount: scaledTarget,
        startTime: firebase.firestore.Timestamp.fromDate(now),
        endTime: firebase.firestore.Timestamp.fromDate(endTime),
        completed: false,
      });

    // Update and show the battle window immediately
    await windowSystem.updateBattleWindow();
    windowSystem.showWindow("BattleWindow");
    
    printToTerminal(`\n🗡️ Boss Battle Started: ${boss.name}`, "success");
    printToTerminal(`Target: ${scaledTarget} ${boss.metric}`, "info");
    printToTerminal(`Time Limit: ${formatTimeLimit(boss.timeLimit)}`, "info");
    printToTerminal(`\nRewards if victorious:`, "reward");
    printToTerminal(`- ${scaledExp} XP`, "reward");
    printToTerminal(`- ${scaledGold} Gold`, "reward");
    printToTerminal(`- Title: ${boss.rewards.title}`, "reward");

    audioSystem.playVoiceLine('BOSS_START');
    printToTerminal(`Battle against ${boss.name} has begun!`, "system");
  } catch (error) {
    printToTerminal("Error starting boss battle: " + error.message, "error");
  }
}


window.handleBossBattleTimeout = handleBossBattleTimeout; // Make globally available if needed

function calculateSellPrice(item) {
  return Math.floor(item.price * 0.5);
}

export class ThreeJSVisualizer {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 256; // Smaller FFT size for more responsive visualization
    this.isActive = false;
    this.isProcessing = false;

    // Scene setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.zIndex = '-1';
    const soloContainer = document.getElementById('soloContainer');
    document.body.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Sphere creation with increased detail
    const geometry = new THREE.IcosahedronGeometry(2, 1);
    this.geometry = geometry; // Store geometry for vertex analysis
    const material = new THREE.MeshPhongMaterial({
      color: 0x03befc,
      specular: 0x666666,
      shininess: 10,
      transparent: true,
      opacity: 0.5,
      wireframe: false
    });
    this.sphere = new THREE.Mesh(geometry, material);

    // Wireframe
    const wireframeGeometry = new THREE.WireframeGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x03befc,
      transparent: true,
      opacity: 0.9
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    this.sphere.add(wireframe);
    this.scene.add(this.sphere);

    // Store original vertex positions
    this.originalPositions = [];
    const positions = geometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      this.originalPositions.push({ x, y, z });
    }
    
    // Audio data buffers
    this.bufferLength = this.analyzer.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);

    // Bind and start animation
    this.animate = this.animate.bind(this);
    this.animate();

    // Handle window resize
    window.addEventListener('resize', () => {
      if (soloContainer) {
        const width = soloContainer.clientWidth;
        const height = soloContainer.clientHeight;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
    });
  }

  setActiveMode(active) {
    this.isActive = active;
  }

  setProcessingMode(isProcessing) {
    this.isProcessing = isProcessing;
    const color = isProcessing ? 0xffff00 : 0x03befc;
    this.sphere.material.color.set(color);
    if (this.sphere.children[0]) {
      this.sphere.children[0].material.color.set(color);
    }
  }

  updateWireframe() {
    if (this.sphere.children.length > 0) {
      this.sphere.remove(this.sphere.children[0]);
    }
    const wireframeGeometry = new THREE.WireframeGeometry(this.sphere.geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: this.sphere.material.color.getHex(),
      transparent: true,
      opacity: 0.9
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    this.sphere.add(wireframe);
  }

  animate() {
    requestAnimationFrame(this.animate);

    if (this.isActive) {
      this.analyzer.getByteFrequencyData(this.dataArray);

      let sum = 0;
      for (let i = 0; i < this.bufferLength; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.bufferLength;

      // Calculate frequency bands more evenly
      const numBands = 6; // Use more bands for smoother distribution
      const bandSize = Math.floor(this.bufferLength / numBands);
      const bands = [];
      
      for (let i = 0; i < numBands; i++) {
        let bandSum = 0;
        const start = i * bandSize;
        const end = i === numBands - 1 ? this.bufferLength : (i + 1) * bandSize;
        
        for (let j = start; j < end; j++) {
          bandSum += this.dataArray[j];
        }
        
        // Normalize to 0-1 and apply slight curve for more responsiveness
        bands[i] = Math.pow(bandSum / (end - start) / 255, 0.9) * 0.8;
      }

      const positionAttribute = this.sphere.geometry.attributes.position;
      
      // Apply frequency data to vertices based on their position
      for (let i = 0; i < this.originalPositions.length; i++) {
        const vertex = this.originalPositions[i];
        
        // Normalize the vertex position to use as a coordinate
        const length = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y + vertex.z * vertex.z);
        const nx = vertex.x / length;
        const ny = vertex.y / length;
        const nz = vertex.z / length;
        
        // Mix multiple frequency bands based on vertex position
        // This ensures each vertex responds to multiple frequencies
        // Use a weighted combination based on 3D position
        
        // Use absolute coordinates for more even distribution
        const xFactor = Math.abs(nx); 
        const yFactor = Math.abs(ny);
        const zFactor = Math.abs(nz);
        
        // Use a weighted mix of bands based on position
        let bandIndex1 = Math.floor(xFactor * (numBands - 1));
        let bandIndex2 = Math.floor(yFactor * (numBands - 1));
        let bandIndex3 = Math.floor(zFactor * (numBands - 1));
        
        // Ensure valid indices
        bandIndex1 = Math.min(Math.max(0, bandIndex1), numBands - 1);
        bandIndex2 = Math.min(Math.max(0, bandIndex2), numBands - 1);
        bandIndex3 = Math.min(Math.max(0, bandIndex3), numBands - 1);
        
        // Get the band values
        const band1 = bands[bandIndex1] || 0;
        const band2 = bands[bandIndex2] || 0;
        const band3 = bands[bandIndex3] || 0;
        
        // Mix the bands - weight by the factor values to ensure distribution
        // This approach ensures all vertices get some movement
        const amplitude = (band1 * xFactor + band2 * yFactor + band3 * zFactor) / (xFactor + yFactor + zFactor);
        
        // Scale factor calculation - base scale + amplitude influence
        const scale = 1 + (amplitude * 0.6); // Moderate effect
        
        // Apply scaling
        positionAttribute.setXYZ(
          i,
          vertex.x * scale,
          vertex.y * scale,
          vertex.z * scale
        );
      }
      
      positionAttribute.needsUpdate = true;
      this.updateWireframe();
      
      // Update emissive properties based on audio level
      const intensity = Math.min(average / 128, 2);
      this.sphere.material.emissive.setRGB(intensity * 0.1, intensity * 0.1, intensity * 0.2);
    } else {
      // Reset to original positions when not active
      const positionAttribute = this.sphere.geometry.attributes.position;
      for (let i = 0; i < this.originalPositions.length; i++) {
        const vertex = this.originalPositions[i];
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      positionAttribute.needsUpdate = true;
      this.updateWireframe();
      this.sphere.material.emissive.setRGB(0, 0, 0);
    }

    this.sphere.rotation.y += 0.001;
    this.sphere.rotation.x += 0.001;

    this.renderer.render(this.scene, this.camera);
  }
}

export class SoloAISystem {
  constructor() {
    this.initialized = false;
    this.listening = false;
    this.processing = false;
    this.conversation = [];
    this.audioContext = null;
    this.visualizer = null;
    this.speechRecognition = null;
    
    this.TENOR_API_KEY = "AIzaSyAspeCpFUpSuZFurXhetczSrxRQIba7tYo"; // Your provided Tenor API key
    this.openRouterKey = "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";

    this.initUI();
    this.initialize();
  }

  initUI() {
    this.elements = {
      startListeningBtn: document.getElementById('startListening'),
      stopListeningBtn: document.getElementById('stopListening'),
      clearChatBtn: document.getElementById('clearChat'),
      transcript: document.getElementById('transcript'),
      listeningIndicator: document.getElementById('listeningIndicator'),
      thinkingIndicator: document.getElementById('thinkingIndicator'),
      systemStatus: document.getElementById('systemStatus'),
      listeningStatus: document.getElementById('listeningStatus'),
      processingStatus: document.getElementById('processingStatus'),
    };

    this.elements.startListeningBtn.addEventListener('click', () => this.startListening());
    this.elements.stopListeningBtn.addEventListener('click', () => this.stopListening());
  }

  async initialize() {
    this.updateDebug('system', 'Initializing Solo AI System...');

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.updateDebug('system', 'Audio context initialized');
    } catch (error) {
      this.updateDebug('system', 'Error initializing audio context: ' + error.message);
    }

    this.visualizer = new ThreeJSVisualizer(this.audioContext);
    this.updateDebug('system', 'Visualizer initialized');

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onstart = () => {
        this.listening = true;
        this.updateListeningUI(true);
        this.updateDebug('speech', 'Speech recognition started');
      };
// Add permission check
navigator.mediaDevices.getUserMedia({ audio: true })
.then(stream => {
    stream.getTracks().forEach(track => track.stop());
    this.updateDebug('speech', 'Microphone access granted');
})
.catch(err => {
    this.updateDebug('speech', `Microphone access denied: ${err.message}`);
    this.addMessage('system', 'Please allow microphone access in your browser settings');
});
      this.speechRecognition.onend = () => {
        if (this.listening) {
          this.speechRecognition.start();
          this.updateDebug('speech', 'Speech recognition restarted');
        } else {
          this.updateListeningUI(false);
          this.updateDebug('speech', 'Speech recognition stopped');
        }
      };

      this.speechRecognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            this.handleUserInput(transcript);
          }
        }
      };

      this.speechRecognition.onerror = (event) => {
        this.updateDebug('speech', 'Speech recognition error: ' + event.error);
      };

      this.updateDebug('speech', 'Speech recognition initialized');
    } else {
      this.updateDebug('speech', 'Speech recognition not supported in this browser');
    }

    this.initialized = true;
    this.updateDebug('system', 'SOLO AI System initialized and ready');
  }

  async startListening() {
    if (!this.initialized) {
        await this.initialize();
        return;
    }

    if (!this.speechRecognition) {
        this.addMessage('system', 'Speech recognition not available');
        return;
    }

    try {
        // Check microphone permission explicitly
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permissionStatus.state === 'denied') {
            this.addMessage('system', 'Microphone permission denied. Please enable it in browser settings');
            return;
        }

        this.listening = true;
        this.speechRecognition.start();
        this.updateListeningUI(true);
        this.updateDebug('speech', 'Microphone activated');
    } catch (error) {
        this.updateDebug('speech', `Start listening failed: ${error.message}`);
        this.addMessage('system', `Microphone error: ${error.message}`);
        this.listening = false;
        this.updateListeningUI(false);
    }
}

stopListening() {
    if (this.speechRecognition && this.listening) {
        try {
            this.listening = false;
            this.speechRecognition.stop();
            this.updateListeningUI(false);
            this.updateDebug('speech', 'Microphone deactivated');
        } catch (error) {
            this.updateDebug('speech', `Stop listening failed: ${error.message}`);
        }
    }
}

  stopListening() {
    if (this.speechRecognition) {
      this.listening = false;
      this.speechRecognition.stop();
      this.elements.startListeningBtn.style.display = 'flex';
      this.elements.stopListeningBtn.style.display = 'none';
      this.elements.listeningIndicator.classList.remove('active');
      this.elements.listeningStatus.classList.remove('active');
    }
  }

  updateListeningUI(isListening) {
    this.elements.listeningStatus.className = isListening ? 'status-dot active' : 'status-dot inactive';
    this.elements.listeningIndicator.classList.toggle('active', isListening);
    this.elements.startListeningBtn.style.display = isListening ? 'none' : 'flex';
    this.elements.stopListeningBtn.style.display = isListening ? 'flex' : 'none';
  }

  updateProcessingUI(isProcessing) {
    this.processing = isProcessing;
    this.elements.processingStatus.className = isProcessing ? 'status-dot active' : 'status-dot inactive';
    this.elements.thinkingIndicator.classList.toggle('active', isProcessing);
    this.visualizer.setProcessingMode(isProcessing);
  }

  extractQuestDetails(text) {
    const match = text.match(/create daily quest to (.+) (\d+) (\w+)/i);
    if (match) {
      return {
        type: 'daily',
        title: match[1],
        count: parseInt(match[2], 10),
        metric: match[3],
        description: `Auto-generated daily quest via AI`,
      };
    }
    return null;
  }

  extractWindowId(text) {
    const windows = Object.keys(windowSystem.windows);
    return windows.find(id => text.toLowerCase().includes(id.toLowerCase()));
  }

  extractBossId(text) {
    const match = text.match(/start boss battle against (\w+)/i);
    return match ? match[1] : null;
  }

  async handleUserInput(text) {
    if (this.processing) return;
    this.addMessage('user', text);
    this.updateProcessingUI(true);

    try {
      let response;
      let responseAdded = false;
      const lowerText = text.toLowerCase();

      // Handle quest creation (both daily and normal)
      if (lowerText.includes('create daily quest') || lowerText.includes('create quest') || lowerText.includes('create normal quest')) {
        if (!isAuthenticated) {
          response = "You must authenticate first with !reawaken.";
          this.addMessage('ai', response);
          await this.speakResponse(response);
          this.updateProcessingUI(false);
          return;
        }

        response = await this.callDeepSeekAPI(text, this.formatConversationForDeepSeek());
        console.log('AI Response:', response);

        if (response.includes('quest created') || response.includes('Quest created')) {
          const questDetails = this.parseAIQuestResponse(response);
          console.log('Parsed Quest Details:', questDetails);

          if (questDetails) {
            if (questDetails.type === 'quest') {
              questDetails.type = 'normal';
              console.log('Normalized quest type from "quest" to "normal"');
            }

            console.log('Sending quest to createQuest:', questDetails);
            const questId = await window.createQuest(questDetails);
            console.log('Quest ID from createQuest:', questId);

            if (questId) {
              response = `I've created a ${questDetails.type === 'daily' ? 'daily' : 'normal'} quest for you: "${questDetails.title}". Complete ${questDetails.count} ${questDetails.metric} to earn rewards!`;
              console.log(`Created ${questDetails.type} quest:`, questDetails);
            } else {
              response = "Failed to save the quest to the database. Please try again.";
            }
          } else {
            response = 'I had trouble creating the quest. Please try again with a more specific request.';
            console.log('Failed to parse quest details from response');
          }
        } else {
          response = this.cleanTechnicalContent(response);
        }
        responseAdded = true;
      }
      // Handle quest completion
      else if (lowerText.includes('complete daily quest') || lowerText.includes('complete quest') || lowerText.includes('complete normal quest')) {
        if (!auth.currentUser) {
          response = "You must authenticate first with !reawaken.";
          await this.speakResponse(response);
          this.updateProcessingUI(false);
          return;
        }

        let questType = 'normal';
        if (lowerText.includes('daily')) {
          questType = 'daily';
        }

        let questIdentifier = '';
        if (questType === 'daily') {
          questIdentifier = text.replace(/complete\s+daily\s+quest\s+/i, '').trim();
        } else {
          questIdentifier = text.replace(/complete\s+(normal\s+)?quest\s+/i, '').trim();
        }

        console.log(`Quest completion requested - Type: ${questType}, Identifier: "${questIdentifier}"`);

        if (!questIdentifier) {
          response = `Please specify which ${questType} quest you want to complete.`;
        } else {
          const foundQuestId = await this.findQuestIdByTitle(questIdentifier, questType);
          if (foundQuestId) {
            console.log(`Completing ${questType} quest with ID: ${foundQuestId}`);
            const quests = questType === 'daily' ? await window.fetchDailyQuests() : await window.fetchNormalQuests();
            const questTitle = quests[foundQuestId]?.title || questIdentifier;
            const result = await window.completeQuest(foundQuestId, questType);
            if (result && result.success) {
              response = `${questType === 'daily' ? 'Daily' : 'Normal'} quest "${questTitle}" completed successfully! You earned ${result.expGained || 0} XP and ${result.goldGained || 0} gold.`;
              if (questType === 'daily') {
                windowSystem.updateDailyQuestsWindow();
              } else {
                windowSystem.updateQuestsWindow();
              }
              updateStatusBar();
            } else {
              response = `Failed to complete ${questType} quest "${questTitle}". ${result?.error || 'Please try again.'}`;
            }
          } else {
            console.log(`No matching ${questType} quest found for: "${questIdentifier}"`);
            response = `I couldn't find a ${questType} quest matching "${questIdentifier}". Please check your active quests with !qid.`;
          }
        }
        responseAdded = true;
      }
      // Fallback to general AI response
      else {
        response = await this.callDeepSeekAPI(text, this.formatConversationForDeepSeek());
        responseAdded = true;
      }

      if (responseAdded) {
        await this.speakResponse(response);
      }
    } catch (error) {
      console.error('Error in handleUserInput:', error);
      await this.speakResponse("Sorry, I encountered an error processing your request.");
    } finally {
      this.updateProcessingUI(false);
    }
  }

  async callDeepSeekAPI(text,   conversationHistory = []) {
    try {
      // Fetch player data from Firestore if authenticated
      let playerData = {};
      if (currentUser && isAuthenticated) {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const playerDoc = await playerRef.get();
        if (playerDoc.exists) {
          playerData = playerDoc.data();
        }
  
        const dailyQuestsSnapshot = await playerRef.collection("dailyQuests").get();
        const normalQuestsSnapshot = await playerRef.collection("quests").get();
        playerData.dailyQuests = dailyQuestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        playerData.normalQuests = normalQuestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
  
      const playerName = playerStats?.profile?.name || "Hunter";
  
      // Fetch notes data from Firestore
      let notesData = [];
      if (currentUser && isAuthenticated) {
        const notesSnapshot = await db.collection("players").doc(currentUser.uid).collection("notes").get();
        notesData = notesSnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          content: doc.data().content,
          createdAt: doc.data().createdAt?.toDate().toISOString(),
          lastModified: doc.data().lastModified?.toDate().toISOString()
        }));
      }
  
      // Combine playerData with notesData
      const fullPlayerData = {
        ...playerData,
        notes: notesData
      };
  
      // Relative time utility
      const getRelativeTime = (timestamp) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now - then;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays === 0 ? "Now" : `${diffDays}d ago`;
      };
  
      const systemPrompt = {
        role: "system",
        content: `You are SOLO, a SOlo leveling system inspired companion dedicated to "${playerName}"—that's me! You're here to help, and do whatever I ask, with a genuine interest in everything I say.  do not use emojis. do not be happy and stuff, be serious, not too cold tho.
                  Data: ${JSON.stringify(fullPlayerData)}. Purpose: Support me, answer my questions, and make things fun!  
        
                  - **Data Access**: Level, exp, gold, rank, quests (daily/normal), notes (id, title, content, createdAt, lastModified). Use it whenever I ask or when it fits the convo.  
                  - **Style**:  
                    - Casual, warm, and conversational—like talking to a friend.  
                    - Markup: **text** for bold, &RED&text&RED& for red, &BLUE&text&BLUE& for blue, &GREEN&text&GREEN& for green—keep it playful when it fits.  
                    - Emphasize: **Fun**, **Ideas**, &GREEN&Success&GREEN&, &BLUE&Cool stuff&BLUE&.  
                    - Timestamps: "Just now," "A bit ago," "Yesterday"—keep it chill.  
                    - Borders: Optional, but if used, keep it light like == Hey! == or === Done! ===.  
                  - **Quests**:  
                    - "create daily quest [task] [count] [metric]": "== Hey! == | **${playerName}'s Daily Adventure: [task]** | Do [count] [metric] | Let’s make it happen!"  
                    - "create quest [task] [count] [metric]": "== Cool Quest Alert! == | **${playerName}'s Challenge: [task]** | Hit [count] [metric] | You’ve got this!"  
                    - Titles: Keep it personal and fun—like "${playerName}'s Great Run" or "${playerName}'s Epic Push." Metrics: km, reps, min, etc.  
                  - **Completion**:  
                    - "complete [daily] quest [title or id]": "== &GREEN&Sweet!&GREEN& == | **Nailed it!** | [title or id] | Awesome job—what’s next?"  
                  - **Commands**: [!switch, !commands, !reawaken, !quests, !dailyquests, !clear, !sleep, !leaderboard, !achievements, !profile, !inventory, !shop, !addxp, !reset, !update, !battle, !challenge, !progress, !waterDrank, !waterStatus, !motivation, !setname, !settitle, !setbio, !setclass, !rank, !rankprogress, !penalty, !delete, !qid, !notifications, !note, !quicknote, !notes, !shownotes, !hidenotes]—Handle these with enthusiasm like "You got it!"  
                  `
      };
      const messages = [systemPrompt, ...conversationHistory];
  
      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterKey}`,
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'SOLO AI System',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat:free',
          messages: messages,
          temperature: 0.2,
          top_p: 0.9
        })
      });
  
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
  
      const result = await response.json();
      return result.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      return "|- &RED&Connection dead&RED& -| Retry.";
    }
  }
  addMessage(type, text) {
    if (this.conversation.length > 0 && this.conversation[this.conversation.length - 1].text === text) {
      return;
    }
  
    this.conversation.push({ type, text });
  
    const messageElement = document.createElement('div');
    messageElement.style.marginBottom = '10px';
  
    if (type === 'user') {
      messageElement.innerHTML = `<strong>You:</strong> ${text}`;
    } else if (type === 'ai') {
      const renderedText = this.renderSOLOText(text); // Apply rendering here
      messageElement.innerHTML = `<strong>AI:</strong> ${renderedText}`;
    } else {
      messageElement.innerHTML = `<strong>System:</strong> ${text}`;
    }
  
    this.elements.transcript.appendChild(messageElement);
    this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  }
  
  renderSOLOText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/&RED&(.*?)&RED&/g, '<span style="color: red">$1</span>') // Red text
      .replace(/&BLUE&(.*?)&BLUE&/g, '<span style="color: blue">$1</span>') // Blue text
      .replace(/&GOLD&(.*?)&GOLD&/g, '<span style="color: #EFBF04">$1</span>') // Gold text
      .replace(/&GREEN&(.*?)&GREEN&/g, '<span style="color: green">$1</span>') // Green text
      .replace(/&ITALIC&(.*?)&ITALIC&/g, '<em>$1</em>') // Italic text
      .replace(/&UNDERLINE&(.*?)&UNDERLINE&/g, '<u>$1</u>') // Underlined text
      .replace(/&STRIKE&(.*?)&STRIKE&/g, ' $1 ') // Strikethrough text
      .replace(/&LINK&([^&]+)&LINK&/g, '<a href="$1" target="_blank">$1</a>'); // Hyperlink
  }


  formatConversationForDeepSeek() {
    const formattedConversation = [];
    formattedConversation.push({
      role: 'system',
      content: `You are SOLO, an AI assistant for a fitness app inspired by Solo Leveling. You can control the app by:
        - Creating quests: You MUST respond differently based on the quest type:
          1. For "create daily quest [task] [count] [metric]":
             Respond: "Daily quest created. type: daily, title: [epic title], count: [count], metric: [short metric], description: [short thematic description]."
          2. For "create quest [task] [count] [metric]":
             Respond: "Quest created. type: quest, title: [epic title], count: [count], metric: [short metric], description: [short thematic description]."
          - Pick an epic, Solo Leveling-style title (e.g., "The Speed Monarch" for running, "Iron Fist Sovereign" for pushups).
          - Use short metric forms: "km" for kilometers, "ml" for milliliters, "reps" for repetitions (pushups/situps/squats), "steps" for steps, "min" for minutes.
          - Keep descriptions concise and thematic (e.g., "Sprint like a monarch over 5 km").
          - Examples:
            - "create daily quest run 5 kilometers" -> "Daily quest created. type: daily, title: The Speed Monarch, count: 5, metric: km, description: Sprint like a monarch over 5 km."
            - "create quest do 100 pushups" -> "Quest created. type: quest, title: Iron Fist Sovereign, count: 100, metric: reps, description: Crush 100 foes with your fists."
        - Completing quests: When asked to "complete [daily] quest [title or id]":
          - Respond: "Quest completed! type: [daily/quest], questId: [provided id or 'lookup']"
          - If no ID is provided, use 'lookup' and let the app handle finding the quest by title.
          - Examples:
            - "complete daily quest The Speed Monarch" -> "Quest completed! type: daily, questId: lookup"
            - "complete quest abc123" -> "Quest completed! type: quest, questId: abc123"
        Keep responses concise and avoid markdown or emojis outside of the technical blocks for parsing. Do not use emojis unless asked to. Try to be mysterious and short with small talk.`
    });

    const recentConversation = this.conversation.slice(-10);
    for (const msg of recentConversation) {
      if (msg.type === 'user') {
        formattedConversation.push({ role: 'user', content: msg.text });
      } else if (msg.type === 'ai') {
        formattedConversation.push({ role: 'assistant', content: msg.text });
      }
    }
    return formattedConversation;
  }

  parseAIQuestResponse(response) {
    // First try to parse JSON directly
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title && parsed.targetCount && parsed.metric) {
          return parsed;
        }
      }
    } catch (e) {
      console.log('JSON parsing failed, trying other methods');
    }
    
    // Try to extract with more flexible patterns
    try {
      // Check for key-value pairs in various formats
      const title = response.match(/title[\s:"']*([^"',\n]+)/i)?.[1]?.trim();
      const description = response.match(/description[\s:"']*([^"',\n]+)/i)?.[1]?.trim();
      const targetCount = parseInt(response.match(/target(?:Count)?[\s:"']*(\d+)/i)?.[1] || '0', 10);
      const metric = response.match(/metric[\s:"']*([^"',\n]+)/i)?.[1]?.trim();
      const type = response.match(/type[\s:"']*([^"',\n]+)/i)?.[1]?.trim() || 'normal';
      
      if (title && targetCount && metric) {
        return {
          title,
          description: description || `Complete ${targetCount} ${metric}`,
          targetCount,
          metric,
          type
        };
      }
    } catch (e) {
      console.log('Flexible pattern matching failed');
    }
    
    // Last resort: extract any numbers and words that might be useful
    const countMatch = response.match(/(\d+)\s*([a-zA-Z]+)/);
    if (countMatch) {
      const firstLine = response.split('\n')[0].trim();
      return {
        title: firstLine || "Quest",
        description: response.substring(0, 100),
        targetCount: parseInt(countMatch[1], 10),
        metric: countMatch[2],
        type: 'normal'
      };
    }
    
    // If all else fails, return a basic quest from the text
    const lines = response.split('\n');
    if (lines.length > 0) {
      return {
        title: lines[0].trim() || "New Quest",
        description: lines.length > 1 ? lines[1].trim() : "Complete this quest",
        targetCount: 5,
        metric: "times",
        type: "normal"
      };
    }
    
    return null;
  }

  parseAICompletionResponse(response) {
    console.log('Parsing completion response:', response);

    const technicalMatch = response.match(/\*\*(.*?)\*\*/);
    if (technicalMatch) {
      const technicalContent = technicalMatch[1];
      console.log('Technical completion content:', technicalContent);

      const structuredMatch = technicalContent.match(/type:\s*(daily|quest|normal),\s*(id|questId|title):\s*([^,]+)(?:,|$)/i);

      if (structuredMatch) {
        let type = structuredMatch[1].trim().toLowerCase();
        const idOrTitle = structuredMatch[2].trim().toLowerCase();
        const value = structuredMatch[3].trim();

        return {
          type: type,
          [idOrTitle]: value,
          questId: idOrTitle === 'id' || idOrTitle === 'questid' ? value : 'lookup',
          title: idOrTitle === 'title' ? value : null
        };
      }
    }

    const dailyMatch = response.toLowerCase().match(/complete(?:d)?\s+daily\s+quest\s+(?:"|'|called\s+|titled\s+)?([^"'\.\?!]+)/i);
    const normalMatch = response.toLowerCase().match(/complete(?:d)?\s+(?:normal\s+)?quest\s+(?:"|'|called\s+|titled\s+)?([^"'\.\?!]+)/i);

    if (dailyMatch) {
      return {
        type: 'daily',
        title: dailyMatch[1].trim(),
        questId: 'lookup'
      };
    } else if (normalMatch) {
      return {
        type: 'normal',
        title: normalMatch[1].trim(),
        questId: 'lookup'
      };
    }

    return null;
  }

  async findQuestIdByTitle(text, type) {
    console.log(`Finding quest ID for: "${text}" of type: ${type}`);

    let questTitle = text;
    const prefixes = [
      'complete quest', 'complete daily quest', 'complete normal quest',
      'finish quest', 'finish daily quest', 'finish normal quest',
      'mark quest', 'mark daily quest', 'mark normal quest'
    ];

    for (const prefix of prefixes) {
      if (text.toLowerCase().includes(prefix)) {
        questTitle = text.toLowerCase().replace(prefix, '').trim();
        break;
      }
    }
    console.log(`Extracted quest title: "${questTitle}"`);

    try {
      let quests;
      if (type === 'daily') {
        quests = await window.fetchDailyQuests();
      } else {
        quests = await window.fetchNormalQuests();
      }
      console.log(`Available ${type} quests:`, quests);

      if (Object.keys(quests).length === 0) {
        console.log(`No ${type} quests found in database.`);
        return null;
      }

      for (const [questId, quest] of Object.entries(quests)) {
        if (quest.title && quest.title.toLowerCase().includes(questTitle.toLowerCase())) {
          console.log(`Found matching ${type} quest: ${quest.title} (ID: ${questId})`);
          return questId;
        }
      }

      console.log(`No matching ${type} quest found for: "${questTitle}"`);
      return null;
    } catch (error) {
      console.error(`Error finding quest ID for "${questTitle}":`, error);
      return null;
    }
  }

  cleanTechnicalContent(response) {
    return response.replace(/\*\*.*?\*\*/g, '').trim();
  }

  async speakResponse(text) {
    try {
      this.updateDebug('audio', 'Requesting speech from Azure TTS API...');
      const tokenResponse = await fetch(`https://eastus.api.cognitive.microsoft.com/sts/v1.0/issuetoken`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': "FANcfK9JLli9bfNboMTIVRIhY3a6BJJf1ifjGP4gUwylRN00Bez0JQQJ99BCACYeBjFXJ3w3AAAYACOG4YgF"
        }
      });

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get token: ${tokenResponse.status}`);
      }

      const accessToken = await tokenResponse.text();
      const ttsUrl = `https://eastus.tts.speech.microsoft.com/cognitiveservices/v1`;

      const audioResponse = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
        },
        body: `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
                 <voice name='en-US-AriaNeural'>${text}</voice>
               </speak>`
      });

      if (!audioResponse.ok) {
        throw new Error(`Azure TTS request failed with status ${audioResponse.status}`);
      }

      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      const source = this.audioContext.createMediaElementSource(audio);
      source.connect(this.audioContext.destination);
      source.connect(this.visualizer.analyzer);

      this.visualizer.setActiveMode(true);
      audio.onended = () => {
        this.visualizer.setActiveMode(false);
        source.disconnect();
      };

      const messageElement = document.createElement('div');
      messageElement.innerHTML = `<strong>AI:</strong> `;
      this.elements.transcript.appendChild(messageElement);
      this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;

      typeWriter(text, messageElement, 250);
      await audio.play();
    } catch (error) {
      this.updateDebug('audio', 'Error generating or playing speech: ' + error.message);
      console.error('Speech synthesis error:', error);
    }
  }

  addMessage(type, text) {
    if (this.conversation.length > 0 && this.conversation[this.conversation.length - 1].text === text) {
      return;
    }

    this.conversation.push({ type, text });

    const messageElement = document.createElement('div');
    messageElement.style.marginBottom = '10px';

    if (type === 'user') {
      messageElement.innerHTML = `<strong>You:</strong> ${text}`;
    } else if (type === 'ai') {
      messageElement.innerHTML = `<strong>AI:</strong> ${text}`;
    } else {
      messageElement.innerHTML = `<strong>System:</strong> ${text}`;
    }

    this.elements.transcript.appendChild(messageElement);
    this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
  }

  updateDebug(section, message) {
    const debugMap = {
      system: document.getElementById('debugSystem'),
      speech: document.getElementById('debugSpeech'),
      api: document.getElementById('debugAPI'),
      audio: document.getElementById('debugAudio')
    };
    if (debugMap[section]) {
      debugMap[section].textContent = message;
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const soloAISystem = new SoloAISystem();
});

function typeWriter(text, element, speed) {
  const words = text.split(' ');
  let i = 0;
  let currentText = element.innerHTML; // Preserve any existing HTML (like the "AI:" prefix)

  const typing = () => {
    if (i < words.length) {
      const word = words[i];
      currentText += word + ' ';
      const lastChar = word.slice(-1);
      let pauseDuration = speed;
      if (['!', '.', '?', '...'].includes(lastChar)) {
        pauseDuration = 1250;
      }
      element.innerHTML = currentText;
      i++;
      setTimeout(typing, pauseDuration);
    }
  };

  typing();
}

window.startBossBattle = startBossBattle;
window.updateBattleProgress = updateBattleProgress;

//define other functions here

window.windowSystem = windowSystem;


// Function to toggle the terminal display
function toggleTerminalDisplay() {
    const terminalContainer = document.querySelector('.terminal-container');
    if (terminalContainer) {
      if (terminalContainer.style.display === 'block' || terminalContainer.style.display === '') {
        terminalContainer.style.display = 'none';
      } else {
        terminalContainer.style.display = 'block';
      }
    }
  }
  
  // Add event listener to the button
  document.getElementById('toggleTerminal').addEventListener('click', toggleTerminalDisplay);

  window.createQuest = createQuest;
window.completeQuest = completeQuest;
window.autoCompleteQuests = autoCompleteQuests;
window.startBossBattle = startBossBattle;
window.showInventory = showInventory;
window.showShop = showShop;
window.showAchievements = showAchievements;
window.showRankProgress = showRankProgress;

// Set Name Window
window.showSetNamePrompt = function showSetNamePrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Set content for the window
  const setNameContent = document.getElementById("setNameContent");
  setNameContent.innerHTML = `
    <div class="window-section">
      <div class="window-item">
<input type="text" id="nameInput" class="modal-input" placeholder="Enter your name" maxlength="20" value="${playerStats.profile.name || ''}">      </div>
      <div class="window-actions">
        <button id="setNameSubmit" class="window-button">Submit</button>
        <button id="setNameCancel" class="window-button danger">Cancel</button>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById("setNameSubmit").addEventListener("click", async () => {
    const nameInput = document.getElementById("nameInput").value.trim();
    if (nameInput) {
      await window.setPlayerName([nameInput]);
      printToTerminal("Name changed successfully!", "success");
      showNotification("Name updated!");
      windowSystem.updateWindowContent("profileWindow");
      windowSystem.closeWindow("setNameWindow");
    }
  });

  document.getElementById("setNameCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setNameWindow");
  });

  // Show the window
  windowSystem.showWindow("setNameWindow");
};

// Set Title Window
window.showSetTitlePrompt = function showSetTitlePrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Set content for the window
  const setTitleContent = document.getElementById("setTitleContent");
  setTitleContent.innerHTML = `
    <div class="window-section">
      <div class="window-item">
        <input type="text" id="titleInput" class="modal-input" placeholder="Enter your title" maxlength="30" value="${playerStats.profile.title || ''}">
      </div>
      <div class="window-actions">
        <button id="setTitleSubmit" class="window-button">Submit</button>
        <button id="setTitleCancel" class="window-button danger">Cancel</button>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById("setTitleSubmit").addEventListener("click", async () => {
    const titleInput = document.getElementById("titleInput").value.trim();
    if (titleInput) {
      await setPlayerTitle([titleInput]);
      printToTerminal("Title changed successfully!", "success");
      showNotification("Title updated!");
      windowSystem.updateWindowContent("profileWindow");
      windowSystem.closeWindow("setTitleWindow");
    }
  });

  document.getElementById("setTitleCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setTitleWindow");
  });

  // Show the window
  windowSystem.showWindow("setTitleWindow");
};

// Set Class Window
window.showSetClassPrompt = function showSetClassPrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const options = AVAILABLE_CLASSES.map(cls => 
    `<option value="${cls}" ${playerStats.profile.class === cls ? 'selected' : ''}>${cls}</option>`
  ).join("");

  // Set content for the window
  const setClassContent = document.getElementById("setClassContent");
  setClassContent.innerHTML = `
    <div class="window-section">
      <div class="window-item">
        <select id="classInput" class="modal-input">${options}</select>
      </div>
      <div class="window-actions">
        <button id="setClassSubmit" class="window-button">Submit</button>
        <button id="setClassCancel" class="window-button danger">Cancel</button>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById("setClassSubmit").addEventListener("click", async () => {
    const classInput = document.getElementById("classInput").value;
    await setPlayerClass([classInput]);
    printToTerminal("Class changed successfully!", "success");
    showNotification("Class updated!");
    windowSystem.updateWindowContent("profileWindow");
    windowSystem.closeWindow("setClassWindow");
  });

  document.getElementById("setClassCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setClassWindow");
  });

  // Show the window
  windowSystem.showWindow("setClassWindow");
};

// Set Bio Window
window.showSetBioPrompt = function showSetBioPrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Set content for the window
  const setBioContent = document.getElementById("setBioContent");
  setBioContent.innerHTML = `
    <div class="window-section">
      <div class="window-item">
        <textarea id="bioInput" class="modal-input" placeholder="Enter your bio" maxlength="200">${playerStats.profile.bio || ''}</textarea>
      </div>
      <div class="window-actions">
        <button id="setBioSubmit" class="window-button">Submit</button>
        <button id="setBioCancel" class="window-button danger">Cancel</button>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById("setBioSubmit").addEventListener("click", async () => {
    const bioInput = document.getElementById("bioInput").value.trim();
    await setPlayerBio([bioInput]);
    printToTerminal("Bio changed successfully!", "success");
    showNotification("Bio updated!");
    windowSystem.updateWindowContent("profileWindow");
    windowSystem.closeWindow("setBioWindow");
  });

  document.getElementById("setBioCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setBioWindow");
  });

  // Show the window
  windowSystem.showWindow("setBioWindow");
};


// Implementation of new setter functions for physical attributes
async function setPlayerHeight(height) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const heightValue = parseFloat(height);
  if (isNaN(heightValue) || heightValue <= 0 || heightValue > 300) {
    printToTerminal("Please provide a valid height in cm (between 0 and 300).", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.height": heightValue
    });
    
    // Update local stats
    if (!playerStats.profile) playerStats.profile = {};
    playerStats.profile.height = heightValue;
    
    printToTerminal(`Height updated to: ${heightValue} cm`, "success");
  } catch (error) {
    printToTerminal("Error updating height: " + error.message, "error");
  }
}

async function setPlayerWeight(weight) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const weightValue = parseFloat(weight);
  if (isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
    printToTerminal("Please provide a valid weight in kg (between 0 and 500).", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.weight": weightValue
    });
    
    // Update local stats
    if (!playerStats.profile) playerStats.profile = {};
    playerStats.profile.weight = weightValue;
    
    printToTerminal(`Weight updated to: ${weightValue} kg`, "success");
  } catch (error) {
    printToTerminal("Error updating weight: " + error.message, "error");
  }
}

async function setPlayerGender(gender) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    await playerRef.update({
      "profile.gender": gender
    });
    
    // Update local stats
    if (!playerStats.profile) playerStats.profile = {};
    playerStats.profile.gender = gender;
    
    printToTerminal(`Gender updated to: ${gender}`, "success");
  } catch (error) {
    printToTerminal("Error updating gender: " + error.message, "error");
  }
}
window.showSetPhysicalProfilePrompt = function showSetPhysicalProfilePrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const genderOptions = ["Male", "Female", "Non-binary", "Prefer not to say"];
  const options = genderOptions.map(gender => 
    `<option value="${gender}" ${playerStats?.profile?.gender === gender ? 'selected' : ''}>${gender}</option>`
  ).join("");

  // Set content for the window
  const setPhysicalProfileContent = document.getElementById("setPhysicalProfileContent");
  setPhysicalProfileContent.innerHTML = `
    <div class="window-section">
      <h3>Physical Profile</h3>
      <div>
        <div class="form-group">
          <label for="ageInput">Age:</label>
          <input type="number" id="ageInput" class="modal-input" min="1" max="120" value="${playerStats?.profile?.age || ''}">
        </div>
        <div class="form-group">
          <label for="heightInput">Height (cm):</label>
          <input type="number" id="heightInput" class="modal-input" min="0" max="300" value="${playerStats?.profile?.height || ''}">
        </div>
        <div class="form-group">
          <label for="weightInput">Weight (kg):</label>
          <input type="number" id="weightInput" class="modal-input" min="0" max="500" value="${playerStats?.profile?.weight || ''}">
        </div>
        <div class="form-group">
          <label for="genderInput">Gender:</label>
          <select id="genderInput" class="modal-input">${options}</select>
        </div>
      </div>
      <div class="window-actions">
        <button id="setPhysicalProfileSubmit" class="window-button">Submit</button>
        <button id="setPhysicalProfileCancel" class="window-button danger">Cancel</button>
      </div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById("setPhysicalProfileSubmit").addEventListener("click", async () => {
    const age = parseInt(document.getElementById("ageInput").value) || null;
    const height = parseFloat(document.getElementById("heightInput").value) || null;
    const weight = parseFloat(document.getElementById("weightInput").value) || null;
    const gender = document.getElementById("genderInput").value;
    
    await setPlayerPhysicalProfile(age, height, weight, gender);
    printToTerminal("Physical profile updated successfully!", "success");
    showNotification("Physical profile updated!");
    windowSystem.updateWindowContent("profileWindow");
    windowSystem.closeWindow("setPhysicalProfileWindow");
  });

  document.getElementById("setPhysicalProfileCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setPhysicalProfileWindow");
  });

  // Show the window
  windowSystem.showWindow("setPhysicalProfileWindow");
};

// New function to set all physical profile attributes at once
async function setPlayerPhysicalProfile(age, height, weight, gender) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Validate inputs
  if (age !== null && (age < 1 || age > 120)) {
    printToTerminal("Please provide a valid age (between 1 and 120).", "error");
    return;
  }
  
  if (height !== null && (height <= 0 || height > 300)) {
    printToTerminal("Please provide a valid height in cm (between 0 and 300).", "error");
    return;
  }
  
  if (weight !== null && (weight <= 0 || weight > 500)) {
    printToTerminal("Please provide a valid weight in kg (between 0 and 500).", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    
    // Prepare the update object
    const updateData = {};
    
    if (age !== null) updateData["profile.age"] = age;
    if (height !== null) updateData["profile.height"] = height;
    if (weight !== null) updateData["profile.weight"] = weight;
    if (gender) updateData["profile.gender"] = gender;
  
    
    await playerRef.update(updateData);
    
    // Update local stats
    if (!playerStats.profile) playerStats.profile = {};
    if (!playerStats.profile.physique) playerStats.profile.physique = {};
    
    if (age !== null) playerStats.profile.age = age;
    if (height !== null) playerStats.profile.height = height;
    if (weight !== null) playerStats.profile.weight = weight;
    if (gender) playerStats.profile.gender = gender;
    
  } catch (error) {
    printToTerminal("Error updating physical profile: " + error.message, "error");
  }
}

// Also expose these functions to the window object
window.setPlayerPhysicalProfile = setPlayerPhysicalProfile;

function checkDailyQuestReset() {
  if (!currentUser) return;
  
  try {
    const now = new Date();
    
    // Get today's date at midnight (00:00:00)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Check if we already reset today
    const lastResetStr = localStorage.getItem('lastDailyQuestReset');
    if (lastResetStr) {
      const lastReset = new Date(lastResetStr);
      // If we already reset today, don't reset again
      if (lastReset >= today) {
        console.log("Daily quests already reset today, skipping");
        return;
      }
    }
    
    // If we get here, it means we haven't reset today yet
    console.log("Daily quest reset triggered - new day detected");
    resetDailyQuests();
    
    // Update the last reset time in localStorage to today's date at midnight
    // This ensures we track by calendar day, not 24-hour periods
    localStorage.setItem('lastDailyQuestReset', today.toISOString());
    
  } catch (error) {
    console.error("Error checking daily quest reset:", error);
  }
}

let dailyQuestResetInProgress = false;

async function resetDailyQuests() {
  // Prevent concurrent resets
  if (dailyQuestResetInProgress) {
    console.log("Daily quest reset already in progress, skipping");
    return;
  }
  
  dailyQuestResetInProgress = true;
  
  try {
    if (!currentUser) {
      dailyQuestResetInProgress = false;
      return;
    }
    
    // Apply penalties for incomplete quests before resetting
    await applyDailyPenalties();
    
    const playerRef = db.collection("players").doc(currentUser.uid);
    const dailyQuestsRef = playerRef.collection("dailyQuests");
    const snapshot = await dailyQuestsRef.get();
    
    if (snapshot.empty) {
      console.log("No daily quests to reset");
      dailyQuestResetInProgress = false;
      return;
    }
    
    // Batch update for better performance
    const batch = db.batch();
    
    snapshot.forEach(doc => {
      // Reset current count to 0 and completed to false
      batch.update(doc.ref, {
        currentCount: 0,
        completed: false,
        lastReset: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    
    // Also update the lastDailyReset field in the player document
    batch.update(playerRef, {
      lastDailyReset: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    console.log("Daily quests have been reset!");
    printToTerminal("Daily quests have been reset for a new day!", "success");
    showNotification("Daily quests reset for a new day!");
    
    // Refresh the quests window if it's open
    const questsWindow = document.getElementById("quests-window");
    if (questsWindow && questsWindow.style.display !== "none") {
      const dailyTab = document.getElementById("daily-quests-tab");
      windowManager.updateQuestsWindow(
        dailyTab && dailyTab.classList.contains("active-tab") 
          ? "daily" 
          : "normal"
      );
    }
    
    // Play the daily reset sound/voice
    if (typeof handleDailyReset === 'function') {
      handleDailyReset();
    }
    
  } catch (error) {
    console.error("Error resetting daily quests:", error);
    printToTerminal("Error resetting daily quests: " + error.message, "error");
  } finally {
    dailyQuestResetInProgress = false;
  }
}

// Apply penalties for incomplete daily quests and water intake
async function applyDailyPenalties() {
  if (!currentUser) return;
  
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const player = playerDoc.data();
    
    if (!player) return;
    
    // Default penalty value for each incomplete daily quest
    const DAILY_QUEST_PENALTY = 50;
    // Default penalty for not meeting water goal
    const WATER_GOAL_PENALTY = 100;
    
    let totalPenalty = 0;
    let penaltyDetails = [];
    let rewards = 0;
    let rewardDetails = [];
    
    // Check for incomplete daily quests
    const dailyQuestsRef = playerRef.collection("dailyQuests");
    const dailyQuestsSnapshot = await dailyQuestsRef.get();
    
    const totalDailyQuests = dailyQuestsSnapshot.size;
    let completedDailyQuests = 0;
    
    // Count completed daily quests
    dailyQuestsSnapshot.forEach(doc => {
      const quest = doc.data();
      if (quest.completed) {
        completedDailyQuests++;
      }
    });
    
    // Calculate penalty for incomplete daily quests
    const incompleteDailyQuests = totalDailyQuests - completedDailyQuests;
    if (incompleteDailyQuests > 0) {
      const dailyQuestsPenalty = incompleteDailyQuests * DAILY_QUEST_PENALTY;
      totalPenalty += dailyQuestsPenalty;
      penaltyDetails.push(`You didn't complete ${incompleteDailyQuests} daily quest${incompleteDailyQuests > 1 ? 's' : ''}: -${dailyQuestsPenalty} XP`);
    }
    
    // Check water intake goal
    if (player.waterIntake) {
      const dailyGoalCups = player.waterIntake?.dailyGoal || WATER_INTAKE.DAILY_GOAL;
      const currentIntake = player.waterIntake?.current || 0;
      
      if (currentIntake < dailyGoalCups) {
        // Penalize for not meeting water goal
        totalPenalty += WATER_GOAL_PENALTY;
        penaltyDetails.push(`You didn't reach your water intake goal (${currentIntake}/${dailyGoalCups}): -${WATER_GOAL_PENALTY} XP`);
      } else if (currentIntake > dailyGoalCups) {
        // Award for exceeding water goal
        const exceedPercentage = Math.floor(((currentIntake - dailyGoalCups) / dailyGoalCups) * 100);
        // Base reward could be calculated based on percentage
        const waterReward = Math.floor(exceedPercentage);
        rewards += waterReward;
        rewardDetails.push(`You exceeded your water intake goal by ${exceedPercentage}%: +${waterReward} XP`);
      }
    }
    
    // Apply penalties if needed
    if (totalPenalty > 0) {
      // Calculate new exp after penalty
      const currentExp = player.exp || 0;
      const currentLevel = player.level || 1;
      
      // Submit the penalty
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(-totalPenalty),
        "penalties.lastPenalty": {
          amount: totalPenalty,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          details: penaltyDetails
        }
      });
      
      // Create notification for penalties
      await db.collection("notifications").add({
        userId: currentUser.uid,
        type: "penalty",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        message: `Daily Penalty: Lost ${totalPenalty} XP`,
        details: {
          penaltyAmount: totalPenalty,
          reasons: penaltyDetails
        },
      });
      
      // Update local stats
      if (playerStats) {
        playerStats.exp = Math.max(0, playerStats.exp - totalPenalty);
      }
      
      // Display penalty details
      printToTerminal("\n=== DAILY PENALTIES APPLIED ===", "error");
      penaltyDetails.forEach(detail => {
        printToTerminal(detail, "error");
      });
      printToTerminal(`Total Penalty: -${totalPenalty} XP`, "error");
      
      // Play penalty voice line
      handlePenalty();
    }
    
    // Apply rewards if applicable
    if (rewards > 0) {
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(rewards)
      });
      
      // Create notification for rewards
      await db.collection("notifications").add({
        userId: currentUser.uid,
        type: "reward",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        message: `Daily Reward: Gained ${rewards} XP`,
        details: {
          rewardAmount: rewards,
          reasons: rewardDetails
        },
      });
      
      // Update local stats
      if (playerStats) {
        playerStats.exp += rewards;
      }
      
      // Display reward details
      printToTerminal("\n=== DAILY REWARDS APPLIED ===", "success");
      rewardDetails.forEach(detail => {
        printToTerminal(detail, "success");
      });
      printToTerminal(`Total Reward: +${rewards} XP`, "success");
    }
    
    // Update UI
    updateStatusBar();
    windowSystem.updateWindowContent("profileWindow");
    windowSystem.updateWindowContent("notificationsWindow");
    
  } catch (error) {
    console.error("Error applying daily penalties:", error);
    printToTerminal("Error applying daily penalties: " + error.message, "error");
  }
}

class TimerManager {
  constructor() {
    this.timers = {};
    this.pendingTimerClears = new Set();
  }

  startTimer(id, updateFn, interval = 1000) {
    // Wait for pending clears to finish
    if (this.pendingTimerClears.has(id)) {
      setTimeout(() => this.startTimer(id, updateFn, interval), 10);
      return;
    }
    
    // Clear existing timer safely
    this.stopTimer(id);
    
    // Start new timer
    this.timers[id] = setInterval(updateFn, interval);
    return this.timers[id];
  }

  stopTimer(id) {
    if (this.timers[id]) {
      this.pendingTimerClears.add(id);
      clearInterval(this.timers[id]);
      delete this.timers[id];
      setTimeout(() => this.pendingTimerClears.delete(id), 50);
      return true;
    }
    return false;
  }

  stopAllTimers() {
    for (const id in this.timers) {
      this.stopTimer(id);
    }
  }

  hasActiveTimer(id) {
    return this.timers.hasOwnProperty(id);
  }
}

// Create a global instance
window.timerManager = new TimerManager();


class Note {
  static rotationPresets = [-3, 0, 3];
  static currentMaxZIndex = 900;

  static getNextZIndex() {
    return ++Note.currentMaxZIndex;
  }

  static getRandomRotation() {
    const randomIndex = Math.floor(Math.random() * Note.rotationPresets.length);
    return Note.rotationPresets[randomIndex];
  }

  constructor(id, title, content, color = '#ffeb3b', position = { x: 10, y: 10 }, isPinned = false, isVisible = true) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.color = color;
    this.position = position;
    this.isPinned = isPinned;
    this.isVisible = isVisible; // New property to track visibility
    this.rotation = Note.getRandomRotation();
    this.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    this.lastModified = firebase.firestore.FieldValue.serverTimestamp();
  }

  async delete() {
    try {
      await db.collection("players").doc(currentUser.uid).collection("notes").doc(this.id).delete();
      return true;
    } catch (error) {
      console.error("Error deleting note:", error);
      return false;
    }
  }

  static async create(titlePrompt = true) {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return null;
    }

    let title = "Untitled";
    if (titlePrompt) {
      title = prompt("Enter note title (leave blank for 'Untitled')") || "Untitled";
    }

    try {
      const noteData = {
        title,
        content: "",
        color: '#011621',
        position: { x: Math.random() * (window.innerWidth - 300), y: Math.random() * (window.innerHeight - 350) },
        isPinned: false,
        isVisible: true, // New notes start visible
        rotation: Note.getRandomRotation(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastModified: firebase.firestore.FieldValue.serverTimestamp(),
      };

      const noteRef = await db.collection("players").doc(currentUser.uid).collection("notes").add(noteData);
      return new Note(noteRef.id, noteData.title, "", noteData.color, noteData.position, false, true);
    } catch (error) {
      console.error("Error creating note:", error);
      return null;
    }
  }

  async save() {
    if (!currentUser) return false;
    
    const maxRetries = 3;
    let retries = 0;
    let success = false;
    
    while (!success && retries < maxRetries) {
      try {
        await db.collection("players").doc(currentUser.uid)
          .collection("notes").doc(this.id).set({
        title: this.title,
        content: this.content,
        color: this.color,
        position: this.position,
        isPinned: this.isPinned,
            isVisible: this.isVisible,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
        
        success = true;
      return true;
    } catch (error) {
        console.error(`Error saving note (attempt ${retries + 1}):`, error);
        retries++;
        
        if (retries >= maxRetries) {
          showNotification("Failed to save note. Please try again.", "error");
      return false;
  }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  createNoteElement() {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-window';
    noteElement.id = `note-${this.id}`;
    noteElement.style.backgroundColor = this.color;
    
    // Adjust initial position based on screen size
    this.adjustPositionForScreenSize();
    noteElement.style.left = `${this.position.x}px`;
    noteElement.style.top = `${this.position.y}px`;
    
    // Only apply rotation on desktop
    if (window.innerWidth > 768) {
      noteElement.style.transform = `rotate(${this.rotation}deg)`;
    }
    
    noteElement.style.zIndex = Note.getNextZIndex();
    noteElement.style.display = this.isVisible ? 'flex' : 'none';

    noteElement.innerHTML = `
      <div class="note-header">
        <input type="text" class="note-title" value="${this.title}" placeholder="Untitled">
        <div class="note-actions">
          <button style="display:none;" class="note-pin ${this.isPinned ? 'pinned' : ''}" title="${this.isPinned ? 'Unpin' : 'Pin'}">
            <i class="fas fa-thumbtack"></i>
          </button>
          <button class="note-color" title="Change Color">
            <i class="fas fa-palette"></i>
          </button>
          <button class="note-close" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <textarea class="note-content" placeholder="Write your note here...">${this.content}</textarea>
    `;

    this.setupNoteEventListeners(noteElement);
    setTimeout(() => {
      const textarea = noteElement.querySelector('.note-content');
      this.adjustNoteSize(textarea, noteElement);
    }, 0);

    return noteElement;
  }

  adjustPositionForScreenSize() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // Center note horizontally and place near top on mobile
      this.position.x = (window.innerWidth - (window.innerWidth * 0.9)) / 2;
      this.position.y = Math.min(this.position.y, window.innerHeight * 0.1);
      
      // Ensure note stays within viewport
      this.position.y = Math.max(10, Math.min(this.position.y, window.innerHeight - 200));
    } else {
      // Ensure note stays within desktop bounds
      this.position.x = Math.max(0, Math.min(this.position.x, window.innerWidth - 300));
      this.position.y = Math.max(0, Math.min(this.position.y, window.innerHeight - 350));
    }
  }

  adjustNoteSize(textarea, noteElement) {
    textarea.style.height = 'auto';
    const newHeight = Math.max(150, Math.min(500, textarea.scrollHeight + 30));
    const lines = textarea.value.split('\n');
    let maxLineLength = 0;
    for (const line of lines) {
      maxLineLength = Math.max(maxLineLength, line.length);
    }
    const estimatedWidth = Math.max(250, Math.min(500, maxLineLength * 8 + 40));
    noteElement.style.width = `${estimatedWidth}px`;
    textarea.style.height = `${newHeight - 50}px`;
  }

  setupNoteEventListeners(noteElement) {
    const titleInput = noteElement.querySelector('.note-title');
    const contentTextarea = noteElement.querySelector('.note-content');
    const pinButton = noteElement.querySelector('.note-pin');
    const colorButton = noteElement.querySelector('.note-color');
    const closeButton = noteElement.querySelector('.note-close');
    const header = noteElement.querySelector('.note-header');
  
    noteElement.addEventListener('mousedown', (e) => {
      if (e.target.closest('.note-window')) {
        this.bringToFront(noteElement);
      }
    });
  
    this.makeDraggable(noteElement);
    this.adjustNoteSize(contentTextarea, noteElement);
  
    let saveTimeout;
    const autoSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.title = titleInput.value || "Untitled";
        this.content = contentTextarea.value;
        this.save();
        this.adjustNoteSize(contentTextarea, noteElement);
      }, 1000);
    };
  
    contentTextarea.addEventListener('input', () => {
      this.adjustNoteSize(contentTextarea, noteElement);
      autoSave();
    });
  
    titleInput.addEventListener('input', autoSave);
    titleInput.addEventListener('focus', () => this.bringToFront(noteElement));
    contentTextarea.addEventListener('focus', () => this.bringToFront(noteElement));
    header.addEventListener('focus', () => this.bringToFront(noteElement));
  
    pinButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isPinned = !this.isPinned;
      pinButton.classList.toggle('pinned', this.isPinned);
      pinButton.title = this.isPinned ? 'Unpin' : 'Pin';
      this.save();
    });
  
    // Unified handler for both click and touch
    const handleButtonClick = (callback) => (e) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent default behavior
      callback(e);
    };
  
    // Color button handler
    const handleColorClick = handleButtonClick((e) => {
      // Remove any existing picker
      const existingPicker = document.querySelector('.color-picker-overlay');
      if (existingPicker) existingPicker.remove();
  
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'color-picker-overlay';
      const colorPicker = document.createElement('div');
      colorPicker.className = 'note-color-picker';
  
      const colors = [
        '#011621', '#ffd700', '#ff9800', '#ff5722', '#f44336', '#e91e63',
        '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
        '#009688', '#4caf50', '#8bc34a', '#cddc39', '#795548', '#607d8b'
      ];
  
      colors.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        if (index === 0) {
          colorOption.innerHTML = '<div class="diagonal-line"></div>';
          colorOption.title = 'Default Color';
        }
        const applyColor = () => {
          this.color = color;
          noteElement.style.backgroundColor = color;
          overlay.remove();
          this.save();
        };
        colorOption.addEventListener('click', handleButtonClick(applyColor));
        colorOption.addEventListener('touchstart', handleButtonClick(applyColor), { passive: false });
        colorPicker.appendChild(colorOption);
      });
  
      const customColorContainer = document.createElement('div');
      customColorContainer.className = 'custom-color-container';
      const customColorInput = document.createElement('input');
      customColorInput.type = 'color';
      customColorInput.className = 'custom-color-input';
      customColorInput.value = this.color;
  
      const customColorLabel = document.createElement('div');
      customColorLabel.className = 'custom-color-label';
      customColorLabel.textContent = 'Custom Color';
  
      const handleCustomColorInteraction = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.color = customColorInput.value;
        noteElement.style.backgroundColor = customColorInput.value;
        this.save();
      };
  
      customColorInput.addEventListener('input', handleCustomColorInteraction);
      customColorInput.addEventListener('change', handleCustomColorInteraction);
      customColorInput.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
        customColorInput.click(); // Trigger native picker on mobile
      }, { passive: false });
  
      customColorContainer.appendChild(customColorInput);
      customColorContainer.appendChild(customColorLabel);
      colorPicker.appendChild(customColorContainer);
      overlay.appendChild(colorPicker);
      document.body.appendChild(overlay);
  
      // Close overlay when clicking outside
      overlay.addEventListener('click', handleButtonClick((e) => {
        if (e.target === overlay) overlay.remove();
      }));
      overlay.addEventListener('touchstart', handleButtonClick((e) => {
        if (e.target === overlay) overlay.remove();
      }), { passive: false });
    });
  
    colorButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const existingPicker = document.querySelector('.color-picker-overlay');
      if (existingPicker) existingPicker.remove();
  
      const overlay = document.createElement('div');
      overlay.className = 'color-picker-overlay';
      const colorPicker = document.createElement('div');
      colorPicker.className = 'note-color-picker';
  
      const colors = [
        '#011621', '#ffd700', '#ff9800', '#ff5722', '#f44336', '#e91e63',
        '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
        '#009688', '#4caf50', '#8bc34a', '#cddc39', '#795548', '#607d8b'
      ];
  
      colors.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        if (index === 0) {
          colorOption.innerHTML = '<div class="diagonal-line"></div>';
          colorOption.title = 'Default Color';
        }
        colorOption.addEventListener('click', (e) => {
          e.stopPropagation();
          this.color = color;
          noteElement.style.backgroundColor = color;
          overlay.remove();
          this.save();
        });
        colorPicker.appendChild(colorOption);
      });
  
      const customColorContainer = document.createElement('div');
      customColorContainer.className = 'custom-color-container';
      const customColorInput = document.createElement('input');
      customColorInput.type = 'color';
      customColorInput.className = 'custom-color-input';
      customColorInput.value = this.color;
      const customColorLabel = document.createElement('div');
      customColorLabel.className = 'custom-color-label';
      customColorLabel.textContent = 'Custom Color';
  
      customColorInput.addEventListener('input', (e) => {
        this.color = e.target.value;
        noteElement.style.backgroundColor = e.target.value;
      });
      customColorInput.addEventListener('change', () => this.save());
  
      customColorContainer.appendChild(customColorInput);
      customColorContainer.appendChild(customColorLabel);
      colorPicker.appendChild(customColorContainer);
      overlay.appendChild(colorPicker);
      document.body.appendChild(overlay);
  
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
    });
  
    closeButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.isVisible = false; // Set visibility to false
      noteElement.style.display = 'none'; // Hide the note
  
      // Update the visibility toggle button icon and title
      const toggleButton = document.querySelector(`[onclick="noteManager.showNote('${this.id}')"]`);
      if (toggleButton) {
        const icon = toggleButton.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-eye'; // Change to 'eye' when hidden
        }
        toggleButton.title = 'Show note'; // Update title
      }
  
      await this.save(); // Save the visibility state
      await noteManager.updateNotesWindow(); // Refresh the notes window to sync the toggle button
    });
  
    // Close button handler
    const handleCloseClick = handleButtonClick(async () => {
      this.isVisible = false;
      noteElement.style.display = 'none';
  
      const toggleButton = document.querySelector(`[onclick="noteManager.showNote('${this.id}')"]`);
      if (toggleButton) {
        const icon = toggleButton.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-eye';
        }
        toggleButton.title = 'Show note';
      }
  
      await this.save();
      await noteManager.updateNotesWindow();
    });
  
    closeButton.addEventListener('click', handleCloseClick);
    closeButton.addEventListener('touchstart', handleCloseClick, { passive: false });
  }
  bringToFront(noteElement) {
    const newZIndex = Note.getNextZIndex();
    noteElement.style.zIndex = newZIndex;
    noteElement.classList.add('note-focus');
    setTimeout(() => noteElement.classList.remove('note-focus'), 300);
  }

  makeDraggable(element) {
    const header = element.querySelector('.note-header');
    const titleInput = element.querySelector('.note-title');
    if (!header) return;
  
    let isDragging = false;
    let startX, startY;
  
    const startDrag = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  
      if (e.target === titleInput) return;
      if (!clientX || !clientY) return;
  
      e.preventDefault();
      this.bringToFront(element);
      
      startX = clientX - parseFloat(element.style.left || 0);
      startY = clientY - parseFloat(element.style.top || 0);
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag, { passive: false });
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);
      isDragging = true;
    };
  
    const drag = (e) => {
      if (!isDragging) return;
  
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  
      if (!clientX || !clientY) return;
  
      let newLeft = clientX - startX;
      let newTop = clientY - startY;
  
      const maxLeft = window.innerWidth - element.offsetWidth;
      const maxTop = window.innerHeight - element.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
  
      element.style.position = 'absolute';
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      
      this.position = { x: newLeft, y: newTop };
    };
  
    const stopDrag = () => {
      if (!isDragging) return;
  
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
      
      this.bringToFront(element);
      this.save();
      
      isDragging = false;
    };
  
    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDrag, { passive: false });
    header.addEventListener('dragstart', (e) => e.preventDefault());
  }
}



const noteManager = {
  notes: new Map(),
  areNotesVisible: true,

  async loadNotes() {
    if (!isAuthenticated) return;

    try {
      this.notes.clear();
      const notesSnapshot = await db.collection("players").doc(currentUser.uid).collection("notes").get();

      if (notesSnapshot.empty) {
        this.updateNotesWindow();
        return;
      }
      this.notes.forEach(note => {
        note.adjustPositionForScreenSize(); // Adjust all loaded notes
        const noteElement = note.createNoteElement();
        document.body.appendChild(noteElement);
      });
      notesSnapshot.forEach(doc => {
        const noteData = doc.data();
        const note = new Note(
          doc.id,
          noteData.title,
          noteData.content,
          noteData.color,
          noteData.position || { x: 10, y: 10 },
          noteData.isPinned || false,
          noteData.isVisible !== false // Default to true if not set
        );
        note.rotation = noteData.rotation || Note.getRandomRotation();
        this.notes.set(doc.id, note);
        const noteElement = note.createNoteElement();
        document.body.appendChild(noteElement);
      });
      this.updateNotesWindow();
    } catch (error) {
      console.error("Error loading notes:", error);
      printToTerminal("Error loading notes: " + error.message, "error");
    }
  },

  async updateNotesWindow() {
    try {
      const notesWindow = document.getElementById("notesWindow");
      if (!notesWindow) return;

      const notesList = document.getElementById("notesList");
      if (!notesList) return;

      notesList.innerHTML = "";

      if (this.notes.size === 0) {
        notesList.innerHTML = `<div class="no-notes">No notes yet. Use "!note" to create one.</div>`;
        return;
      }

      this.notes.forEach((note) => {
        const noteElement = document.createElement("div");
        noteElement.className = "note-item";
        const isVisible = note.isVisible; // Use saved state

        noteElement.innerHTML = `
          <div class="note-item-header" style="background-color: ${note.color}">
            <span class="note-item-title">${note.title || "Untitled"}</span>
            <div class="note-item-actions">
              <button class="note-visibility-toggle" onclick="noteManager.showNote('${note.id}')" title="${isVisible ? 'Hide' : 'Show'} note">
                <i class="fas fa-${isVisible ? 'eye' : 'eye-slash'}"></i>
              </button>
              <button class="danger" onclick="noteManager.deleteNote('${note.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="note-item-preview">${note.content || "No content"}</div>
        `;
        notesList.appendChild(noteElement);
      });
    } catch (error) {
      console.error("Error updating notes window:", error);
    }
  },

  async createNote() {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }
  
    const note = await Note.create(true);
    if (note) {
      this.notes.set(note.id, note);
      const noteElement = note.createNoteElement();
      noteElement.classList.add('note-animate-in'); // Optional additional class for initial creation
      document.body.appendChild(noteElement);
      windowSystem.bringToFront(`note-${note.id}`);
      this.updateNotesWindow();
      printToTerminal("Note created successfully!", "success");
      showNotification("New note created!");
    }
  },

  showNote(noteId) {
    const note = this.notes.get(noteId);
    if (note) {
      const noteElement = document.getElementById(`note-${noteId}`);
      if (noteElement) {
        note.isVisible = !note.isVisible; // Toggle visibility
        
        if (note.isVisible) {
          // Removing the hide class and setting display
          noteElement.classList.remove('note-hide');
          noteElement.style.display = 'flex';
          windowSystem.bringToFront(`note-${noteId}`);
        } else {
          // Adding hide class before removing from display
          noteElement.classList.add('note-hide');
          setTimeout(() => {
            noteElement.style.display = 'none';
          }, 300); // Match the animation duration
        }
        
        note.save(); // Save the new visibility state
  
        const toggleButton = document.querySelector(`[onclick="noteManager.showNote('${noteId}')"]`);
        if (toggleButton) {
          const icon = toggleButton.querySelector('i');
          if (icon) {
            icon.className = `fas fa-${note.isVisible ? 'eye' : 'eye-slash'}`;
          }
          toggleButton.title = `${note.isVisible ? 'Hide' : 'Show'} note`;
        }
      } else if (note.isVisible) {
        const newNoteElement = note.createNoteElement();
        document.body.appendChild(newNoteElement);
      }
    }
  },

  async quickNote() {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }

    const note = await Note.create(false);
    if (note) {
      this.notes.set(note.id, note);
      const noteElement = note.createNoteElement();
      document.body.appendChild(noteElement);
      this.updateNotesWindow();
      printToTerminal("Quick note created!", "success");
      showNotification("Quick note created!");
    }
  },

  async deleteNote(noteId) {
    try {
      const note = this.notes.get(noteId);
      if (!note) return;

      const success = await note.delete();
      if (success) {
        this.notes.delete(noteId);
        const noteElement = document.getElementById(`note-${noteId}`);
        if (noteElement) {
          noteElement.remove();
          delete windowSystem.windows[`note-${noteId}`];
        }
        this.updateNotesWindow();
        printToTerminal("Note deleted successfully!", "success");
        showNotification("Note deleted!");
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      printToTerminal("Error deleting note: " + error.message, "error");
    }
  },

  toggleNotes() {
    this.areNotesVisible = !this.areNotesVisible;
    this.notes.forEach((note) => {
      const noteElement = document.getElementById(`note-${note.id}`);
      if (this.areNotesVisible) {
        if (note.isVisible) {
          if (noteElement) {
            noteElement.classList.remove('note-hide');
            noteElement.style.display = "flex";
          } else {
            const newNoteElement = note.createNoteElement();
            document.body.appendChild(newNoteElement);
          }
        }
      } else {
        if (noteElement && !note.isPinned) {
          noteElement.classList.add('note-hide');
          setTimeout(() => {
            noteElement.style.display = "none";
          }, 300);
          note.isVisible = false; // Update visibility state
          note.save(); // Save the state
        }
      }
    });

    const noteItems = document.querySelectorAll('.note-item');
    noteItems.forEach(item => {
      const toggleButton = item.querySelector('.note-item-actions button');
      if (toggleButton) {
        const noteId = toggleButton.getAttribute('onclick').match(/'([^']+)'/)[1];
        const note = this.notes.get(noteId);
        if (note) {
          const icon = toggleButton.querySelector('i');
          if (icon) {
            icon.className = `fas fa-${note.isVisible ? 'eye' : 'eye-slash'}`;
          }
          toggleButton.title = `${note.isVisible ? 'Hide' : 'Show'} note`;
        }
      }
    });

    const toggleButton = document.getElementById('toggleNotesButton');
    if (toggleButton) {
      const icon = toggleButton.querySelector('i');
      if (icon) {
        icon.className = `fas fa-${this.areNotesVisible ? 'eye-slash' : 'eye'}`;
      }
      toggleButton.innerHTML = `<i class="fas fa-${this.areNotesVisible ? 'eye-slash' : 'eye'}"></i> ${this.areNotesVisible ? 'Hide All' : 'Show All'}`;
    }
  }
};

window.windowSystem.windows["notesWindow"] = {
  element: document.getElementById("notesWindow"),
  update: () => noteManager.updateNotesWindow()
};

document.addEventListener("DOMContentLoaded", async () => {
  await PlayerDB.init();
  initializeQuestListeners();
  await initializeSystem();
  if (isAuthenticated && currentUser) {
    await noteManager.loadNotes();
    windowSystem.updateNotificationBadge(unreadCount);
  }
});

window.noteManager = noteManager;

if (typeof window.printToTerminal !== 'function') {
  window.printToTerminal = function(text, type) {
    console.log(`[${type}] ${text}`);
    if (type === 'error') alert(text);
  };
}

window.Note = Note;

commands["!note"] = () => noteManager.createNote();
commands["!quicknote"] = () => noteManager.quickNote();
commands["!notes"] = () => windowSystem.showWindow("notesWindow");
commands["!shownotes"] = () => noteManager.showAllNotes();
commands["!hidenotes"] = () => noteManager.hideAllNotes();

async function loadNotificationBadge() {
  try {
    const count = await windowSystem.getUnreadNotificationsCount();
    windowSystem.updateNotificationBadge(count);
  } catch (error) {
    console.error("Error loading notification badge:", error);
  }
}






// Make sure the function is called when the window loads
window.initializeDailyQuestsWindow = function initializeDailyQuestsWindow() {
  console.log('Initializing daily quests window');
  setupDailyQuestsTabs();
  
  // Register with window system if it exists
  if (window.windowSystem) {
    window.windowSystem.registerWindow('dailyQuestsWindow', {
      onOpen: () => {
        // If the water intake tab is active, update its UI
        if (document.getElementById('water-intake-tab').classList.contains('active-tab')) {
          updateWaterIntakeUI();
        }
      }
    });
  }
};

// Call initializeDailyQuestsWindow on page load
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initializeDailyQuestsWindow === 'function') {
    initializeDailyQuestsWindow();
  }
});

// Add this to the window initialization function or wherever appropriate
window.initializeDailyQuestsWindow = function initializeDailyQuestsWindow() {
  setupDailyQuestsTabs();
  // Add to existing window initialization code
  windowSystem.registerWindow('dailyQuestsWindow', {
    onOpen: () => {
      // If the water intake tab is active, update its UI
      if (document.getElementById('water-intake-tab').classList.contains('active-tab')) {
        updateWaterIntakeUI();
      }
    }
  });
}

async function processOfflineQueue() {
  if (!window.isOnline || window.offlineActions.length === 0) return;
  
  showNotification("Syncing your offline changes...", "info");
  
  let successCount = 0;
  let failCount = 0;
  
  for (const action of window.offlineActions) {
    try {
      if (action.type === 'waterIntake') {
        await handleWaterIntake(action.args, action.exactAmount);
        successCount++;
      }
      // Handle other action types...
    } catch (error) {
      console.error("Failed to process offline action:", error);
      failCount++;
    }
  }
  
  // Clear processed actions
  window.offlineActions = [];
  
  if (failCount > 0) {
    showNotification(`Sync complete with ${failCount} errors. Some changes may need to be re-applied.`, "warning");
  } else {
    showNotification(`Successfully synced ${successCount} changes!`, "success");
  }
}

window.offlineActions = [];

// Check if we're online
window.isOnline = navigator.onLine;

// Listen for online/offline events
window.addEventListener('online', () => {
  window.isOnline = true;
  showNotification("You're back online!", "success");
  
  // Process queued actions
  processOfflineQueue();
});

window.addEventListener('offline', () => {
  window.isOnline = false;
  showNotification("You're offline. Changes will be saved when you're back online.", "warning");
});

// Update the WATER_INTAKE constants to support customization
const WATER_INTAKE = {
  DAILY_GOAL: 8, // Default number of cups/glasses
  GLASS_ML: 250, // Default ml per glass
  REWARDS: {
    exp: 10,
    gold: 10
  },
  ENCOURAGEMENTS: [
    { threshold: 0.25, message: "Good start! Keep hydrating!" },
    { threshold: 0.5, message: "Halfway there - you're doing great!" },
    { threshold: 0.75, message: "Almost at your goal - fantastic effort!" },
    { threshold: 1.0, message: "Hydration champion! Goal reached!" }
  ]
};

async function handleWaterIntake(args, exactAmount = null) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  if (!window.isOnline) {
    window.offlineActions.push({
      type: 'waterIntake',
      args: args,
      exactAmount: exactAmount,
      timestamp: new Date()
    });
    
    showNotification("Water tracking saved offline. Will sync when you're back online.", "info");
    return;
  }

  // Check if we need to reset daily progress
  await checkWaterIntakeReset();

  // Use exactAmount if provided, otherwise calculate from glasses
  let glasses = args && args.length > 0 ? parseFloat(args[0]) : 1;
  
  if (isNaN(glasses) || glasses <= 0) {
    printToTerminal("Please enter a valid number of glasses.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    
    // Get user's custom settings or use defaults
    const cupSizeMl = player.waterIntake?.cupSize || WATER_INTAKE.GLASS_ML;
    const dailyGoalCups = player.waterIntake?.dailyGoal || WATER_INTAKE.DAILY_GOAL;
    
    const currentIntake = player.waterIntake?.current || 0;
    // Remove the limit to allow exceeding the goal
    const newIntake = currentIntake + glasses;
    
    const wasGoalReached = 
      currentIntake < dailyGoalCups && 
      newIntake >= dailyGoalCups;
    
    const waterAmount = exactAmount || (glasses * cupSizeMl);
    const localTimestamp = new Date();

    // Use a batch to ensure atomic updates
    const batch = db.batch();
    
    // Initialize waterIntake if needed
    if (!player.waterIntake || typeof player.waterIntake !== 'object') {
      batch.update(playerRef, {
        "waterIntake": {
          current: newIntake,
          cupSize: cupSizeMl,
          dailyGoal: dailyGoalCups,
          lastReset: firebase.firestore.FieldValue.serverTimestamp(),
          streakDays: 0,
          history: [{
            amount: waterAmount,
            timestamp: localTimestamp
          }]
        }
      });
  } else {
      // Update water intake fields
      batch.update(playerRef, {
        "waterIntake.current": newIntake,
        "waterIntake.lastReset": 
          player.waterIntake?.lastReset || firebase.firestore.FieldValue.serverTimestamp(),
        "waterIntake.history": firebase.firestore.FieldValue.arrayUnion({
          amount: waterAmount,
          timestamp: localTimestamp
        })
      });
    }

    // If goal reached, update rewards and streak in the same batch
    if (wasGoalReached) {
      batch.update(playerRef, {
        exp: firebase.firestore.FieldValue.increment(WATER_INTAKE.REWARDS.exp),
        gold: firebase.firestore.FieldValue.increment(WATER_INTAKE.REWARDS.gold),
        "waterIntake.streakDays": firebase.firestore.FieldValue.increment(1),
      });
    }

    // Commit the batch
    await batch.commit();

    // Update local stats
    if (!playerStats.waterIntake) playerStats.waterIntake = {};
    playerStats.waterIntake.current = newIntake;
    playerStats.waterIntake.cupSize = cupSizeMl;
    playerStats.waterIntake.dailyGoal = dailyGoalCups;
    
    if (!playerStats.waterIntake.history) playerStats.waterIntake.history = [];
    playerStats.waterIntake.history.push({
      amount: waterAmount,
      timestamp: localTimestamp
    });

    if (wasGoalReached) {
      playerStats.exp += WATER_INTAKE.REWARDS.exp;
      playerStats.gold += WATER_INTAKE.REWARDS.gold;
      playerStats.waterIntake.streakDays = (playerStats.waterIntake.streakDays || 0) + 1;
    }

    // Show progress - now can exceed 100%
    const progressPercentage = (newIntake / dailyGoalCups) * 100;
    printToTerminal(
      `Added ${glasses} glass${glasses !== 1 ? "es" : ""} (${waterAmount}ml) of water!`,
      "success"
    );
    printToTerminal(
      `Current Water Intake: ${newIntake}/${dailyGoalCups} glasses` + 
      (progressPercentage > 100 ? ` (${progressPercentage.toFixed(1)}%)` : ""),
      "info"
    );
    printToTerminal(
      `Total: ${newIntake * cupSizeMl}ml / ${dailyGoalCups * cupSizeMl}ml`,
      "info"
    );

    // Show encouragement message
    if (progressPercentage > 100) {
      printToTerminal("🏆 WOW! You've exceeded your water goal! Incredible hydration!", "success");
  } else {
      for (let i = WATER_INTAKE.ENCOURAGEMENTS.length - 1; i >= 0; i--) {
        if (progressPercentage / 100 >= WATER_INTAKE.ENCOURAGEMENTS[i].threshold) {
          printToTerminal(WATER_INTAKE.ENCOURAGEMENTS[i].message, "system");
          break;
        }
      }
    }

    // Award rewards if daily goal is reached
    if (wasGoalReached) {
      printToTerminal("\n🎉 Daily Water Goal Achieved! 🎉", "success");
      printToTerminal(`Rewards:`, "reward");
      printToTerminal(`- ${WATER_INTAKE.REWARDS.exp} EXP`, "reward");
      printToTerminal(`- ${WATER_INTAKE.REWARDS.gold} Gold`, "reward");
      printToTerminal(
        `Water Streak: ${playerStats.waterIntake.streakDays} days`,
        "info"
      );

      // Check for level up and achievements
      await checkLevelUp(playerRef, playerStats.exp);
      await checkAchievements();
      updateStatusBar();
    }

    // Update the UI if available
    if (typeof updateWaterIntakeUI === 'function') {
      await updateWaterIntakeUI();
    }

    showNotification(
      `Water intake updated: ${newIntake}/${dailyGoalCups} glasses` + 
      (progressPercentage > 100 ? ` (${progressPercentage.toFixed(1)}%)` : "")
    );
  } catch (error) {
    printToTerminal("Error updating water intake: " + error.message, "error");
    console.error("Water intake update error:", error);
  }
}

async function checkWaterIntakeReset() {
  if (!currentUser) return;

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) {
      console.error("Player document not found");
      return;
  }

    const player = playerDoc.data();
    
    // Make sure waterIntake exists and is an object
    if (!player.waterIntake || typeof player.waterIntake !== 'object') {
      // Initialize waterIntake as an object if it's not one
      await playerRef.update({
        "waterIntake": {
          current: 0,
          lastReset: firebase.firestore.FieldValue.serverTimestamp(),
          streakDays: 0,
          cupSize: WATER_INTAKE.GLASS_ML,
          dailyGoal: WATER_INTAKE.DAILY_GOAL,
          history: []
        }
      });
      
      // Also update local playerStats
      if (playerStats) {
        playerStats.waterIntake = {
          current: 0, 
          streakDays: 0,
          cupSize: WATER_INTAKE.GLASS_ML,
          dailyGoal: WATER_INTAKE.DAILY_GOAL,
          history: []
        };
      }
      
      return; // Exit early since we've just initialized
    }
    
    const lastReset = player.waterIntake?.lastReset?.toDate() || new Date(0);
    const now = new Date();

    // Get user's custom daily goal or use default
    const dailyGoalCups = player.waterIntake?.dailyGoal || WATER_INTAKE.DAILY_GOAL;

    // Check if it's a new day
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getYear() !== now.getYear()
    ) {
      // Check if we need to break the streak
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const wasYesterdayGoalMet =
        player.waterIntake?.current >= dailyGoalCups;

      await playerRef.update({
        "waterIntake.current": 0,
        "waterIntake.lastReset":
          firebase.firestore.FieldValue.serverTimestamp(),
        "waterIntake.streakDays": wasYesterdayGoalMet
          ? firebase.firestore.FieldValue.increment(0)
          : 0,
      });

      // Update local stats
      if (playerStats && playerStats.waterIntake) {
        playerStats.waterIntake.current = 0;
        if (wasYesterdayGoalMet) {
          // Keep streak (don't change)
        } else {
          playerStats.waterIntake.streakDays = 0;
        }
      }

      if (!wasYesterdayGoalMet && (player.waterIntake?.streakDays > 0)) {
        printToTerminal(
          "Water streak reset! Remember to drink water daily!",
          "warning"
        );
      }
    }
  } catch (error) {
    console.error("Error checking water intake reset:", error);
  }
}

async function showWaterStatus() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  await checkWaterIntakeReset();

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    
    // Get user's custom settings or use defaults
    const cupSizeMl = player.waterIntake?.cupSize || WATER_INTAKE.GLASS_ML;
    const dailyGoalCups = player.waterIntake?.dailyGoal || WATER_INTAKE.DAILY_GOAL;
    const currentIntake = player.waterIntake?.current || 0;
    const streakDays = player.waterIntake?.streakDays || 0;

    printToTerminal("=== WATER INTAKE STATUS ===", "system");
    printToTerminal(
      `Current Progress: ${currentIntake}/${dailyGoalCups} glasses (${cupSizeMl}ml each)`,
      "info"
    );
    printToTerminal(
      `Total: ${currentIntake * cupSizeMl}ml / ${dailyGoalCups * cupSizeMl}ml`,
      "info"
    );
    printToTerminal(`Streak: ${streakDays} days`, "info");

    const remaining = dailyGoalCups - currentIntake;
    if (remaining > 0) {
      printToTerminal(
        `\nRemaining: ${remaining} glass${
          remaining > 1 ? "es" : ""
        } to reach your daily goal`,
        "warning"
      );
      const endOfDay = getEndOfDay();
      const timeRemaining = endOfDay - new Date();
      printToTerminal(
        `Time remaining: ${formatTimeRemaining(timeRemaining)}`,
        "warning"
      );
    } else {
      printToTerminal("\nDaily goal achieved! 🎉", "success");
    }
  } catch (error) {
    printToTerminal("Error showing water status: " + error.message, "error");
  }
}

window.addCupOfWater = async function addCupOfWater() {
  if (!isAuthenticated) {
    showNotification("You need to be logged in to add water", "error");
    return;
  }
  
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    
    // Get user's custom cup size, or use default
    const cupSizeMl = player.waterIntake?.cupSize || WATER_INTAKE.GLASS_ML;
    
    // FIXED: Use exact ml amount instead of glass equivalent calculation
    await handleWaterIntake([1], cupSizeMl); // Pass the exact amount in ml
    
    // Add the splash animation class
    const waterLevel = document.querySelector('.water-level');
    if (waterLevel) {
      waterLevel.classList.add('splash');
      
      // Remove the class after animation completes
      setTimeout(() => {
        waterLevel.classList.remove('splash');
      }, 1000);
    }
  } catch (error) {
    console.error("Error adding cup of water:", error);
    showNotification("Error adding water", "error");
  }
}

window.openPopup = function openPopup(popupId) {
  const popup = document.getElementById(popupId);
  if (!popup) {
    console.error(`Popup with ID ${popupId} not found`);
    return;
  }
  
  popup.style.display = 'flex';
  
  // Set current values in the popup inputs
  if (popupId === 'edit-goal-popup') {
    const goalInput = document.getElementById('edit-daily-goal');
    
    // Get the player data if authenticated
    if (isAuthenticated && playerStats && playerStats.waterIntake) {
      const cupSizeMl = playerStats.waterIntake.cupSize || WATER_INTAKE.GLASS_ML;
      const dailyGoalCups = playerStats.waterIntake.dailyGoal || WATER_INTAKE.DAILY_GOAL;
      const goalLiters = (dailyGoalCups * cupSizeMl) / 1000;
      goalInput.value = goalLiters;
      } else {
      goalInput.value = (WATER_INTAKE.DAILY_GOAL * WATER_INTAKE.GLASS_ML) / 1000; // Default
    }
  } 
  else if (popupId === 'edit-cup-popup') {
    const cupSizeInput = document.getElementById('edit-cup-size');
    
    if (isAuthenticated && playerStats && playerStats.waterIntake) {
      cupSizeInput.value = playerStats.waterIntake.cupSize || WATER_INTAKE.GLASS_ML;
      } else {
      cupSizeInput.value = WATER_INTAKE.GLASS_ML; // Default cup size
    }
  }
  else if (popupId === 'add-cup-popup') {
    const amountInput = document.getElementById('add-water-amount');
    
    if (isAuthenticated && playerStats && playerStats.waterIntake) {
      amountInput.value = playerStats.waterIntake.cupSize || WATER_INTAKE.GLASS_ML;
      } else {
      amountInput.value = WATER_INTAKE.GLASS_ML; // Default cup size
    }
  }
}

window.closePopup = function closePopup(popupId) {
  const popup = document.getElementById(popupId);
  if (!popup) {
    console.error(`Popup with ID ${popupId} not found`);
    return;
  }
  popup.style.display = 'none';
}

window.saveEditedGoal = async function saveEditedGoal() {
  if (!isAuthenticated) {
    showNotification("You need to be logged in to set water goals", "error");
    return;
  }
  
  const goalInput = document.getElementById('edit-daily-goal');
  let goalLiters = parseFloat(goalInput.value);
  if (isNaN(goalLiters) || goalLiters <= 0) {
      // Should also check for maximum reasonable value
      showNotification("Please enter a valid goal (minimum 0.1 liters)", "error");
      return;
  }
  
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    
    // Get cup size or use default
    const cupSizeMl = player.waterIntake?.cupSize || WATER_INTAKE.GLASS_ML;
    
    // Convert liters to cups and round up
    const goalCups = Math.ceil((goalLiters * 1000) / cupSizeMl);
    
    // Prepare update data
    let updateData = {};
    
    // Check if waterIntake exists
    if (!player.waterIntake || typeof player.waterIntake !== 'object') {
      updateData = {
        "waterIntake": {
          current: 0,
          cupSize: cupSizeMl,
          dailyGoal: goalCups,
          lastReset: firebase.firestore.FieldValue.serverTimestamp(),
          streakDays: 0,
          history: []
        }
      };
    } else {
      updateData = {
        "waterIntake.dailyGoal": goalCups
      };
    }
    
    // Update in Firestore
    await playerRef.update(updateData);
    
    // Update local player stats
    if (!playerStats.waterIntake) playerStats.waterIntake = {};
    playerStats.waterIntake.dailyGoal = goalCups;
    
    // Update UI
    updateWaterIntakeUI();
    
    // Close popup
    closePopup('edit-goal-popup');
    
    showNotification(`Daily goal updated to ${goalLiters.toFixed(1)}L`);
  } catch (error) {
    console.error("Error saving goal:", error);
    showNotification("Error saving water goal", "error");
  }
}

window.saveEditedCup = async function saveEditedCup() {
  if (!isAuthenticated) {
    showNotification("You need to be logged in to set cup size", "error");
    return;
  }
  
  const cupSizeInput = document.getElementById('edit-cup-size');
  let cupSize = parseInt(cupSizeInput.value);
  
  if (isNaN(cupSize) || cupSize < 50) {
    showNotification("Please enter a valid cup size (minimum 50ml)", "error");
    return;
  }
  
  // Round to nearest 10ml for cleaner values
  cupSize = Math.round(cupSize / 10) * 10;
  
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    
    // Prepare update data
    let updateData = {};
    
    // Check if waterIntake exists
    if (!player.waterIntake || typeof player.waterIntake !== 'object') {
      updateData = {
        "waterIntake": {
          current: 0,
          cupSize: cupSize,
          dailyGoal: WATER_INTAKE.DAILY_GOAL,
          lastReset: firebase.firestore.FieldValue.serverTimestamp(),
          streakDays: 0,
          history: []
        }
      };
  } else {
      updateData = {
        "waterIntake.cupSize": cupSize
      };
    }
    
    // Update in Firestore
    await playerRef.update(updateData);
    
    // Update local player stats
    if (!playerStats.waterIntake) playerStats.waterIntake = {};
    playerStats.waterIntake.cupSize = cupSize;
    
    // Update UI
    updateWaterIntakeUI();
    
    // Close popup
    closePopup('edit-cup-popup');
    
    showNotification(`Cup size updated to ${cupSize}ml`);
  } catch (error) {
    console.error("Error saving cup size:", error);
    showNotification("Error saving cup size", "error");
  }
}

function setupDailyQuestsTabs() {
  const dailyQuestsTab = document.getElementById('daily-quests-tab');
  const waterIntakeTab = document.getElementById('water-intake-tab');
  const dailyQuestsContent = document.getElementById('daily-quests-content');
  const waterIntakeContent = document.getElementById('water-intake-content');
  
  if (!dailyQuestsTab || !waterIntakeTab || !dailyQuestsContent || !waterIntakeContent) {
    console.error('Daily quests tabs elements not found');
    return;
  }

  // Add event listeners to tab buttons
  dailyQuestsTab.addEventListener('click', () => {
    dailyQuestsTab.classList.add('active-tab');
    waterIntakeTab.classList.remove('active-tab');
    dailyQuestsContent.style.display = 'block';
    waterIntakeContent.style.display = 'none';
  });

  waterIntakeTab.addEventListener('click', () => {
    waterIntakeTab.classList.add('active-tab');
    dailyQuestsTab.classList.remove('active-tab');
    waterIntakeContent.style.display = 'block';
    dailyQuestsContent.style.display = 'none';
    updateWaterIntakeUI(); // Update water intake content when switching to the tab
  });
}

window.initializeDailyQuestsWindow = function initializeDailyQuestsWindow() {
  setupDailyQuestsTabs();
  
  // Register with window system if it exists
  if (window.windowSystem && typeof window.windowSystem.registerWindow === 'function') {
    window.windowSystem.registerWindow('dailyQuestsWindow', {
      onOpen: () => {
        // If the water intake tab is active, update its UI
        const waterIntakeTab = document.getElementById('water-intake-tab');
        if (waterIntakeTab && waterIntakeTab.classList.contains('active-tab')) {
          updateWaterIntakeUI();
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initializeDailyQuestsWindow === 'function') {
    initializeDailyQuestsWindow();
  }
});

async function updateWaterIntakeUI() {
  if (!isAuthenticated) return;

  // Show loading state immediately
  const waterIntakeDetails = document.getElementById("water-intake-details");
  if (!waterIntakeDetails) return;
  
  waterIntakeDetails.innerHTML = `
    <div class="water-card">
      <h2>Drink Water</h2>
      <div style="display: flex; flex-direction: column; align-items: center; padding: 20px;">
        <div class="loading-spinner" style="
          width: 40px; 
          height: 40px; 
          border: 4px solid rgba(255, 255, 255, 0.2); 
          border-left-color: #5b86e5; 
          border-radius: 50%; 
          animation: spin 1s linear infinite;">
        </div>
        <p style="margin-top: 15px; color: rgba(255, 255, 255, 0.8);">Loading your water intake data...</p>
      </div>
    </div>
    
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;

  try {
    // Check for waterIntake reset
    await checkWaterIntakeReset();

    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      console.error("Player document not found");
      waterIntakeDetails.innerHTML = `
        <div class="error-message">
          <p>Player data not found</p>
          <button class="water-btn" onclick="updateWaterIntakeUI()">Retry</button>
        </div>`;
      return;
    }
    
    const player = playerDoc.data();
    
    // Make sure waterIntake exists and is an object
    if (!player.waterIntake || typeof player.waterIntake !== 'object') {
      // Show default/empty state if waterIntake is not initialized yet
      waterIntakeDetails.innerHTML = `
        <div class="water-card">
          <h2>Drink Water</h2>
          <p>Set up your water tracking by configuring your daily goal and cup size.</p>
          
          <div class="water-actions">
            <button class="water-btn" onclick="openPopup('edit-goal-popup')">
              <i class="fas fa-bullseye"></i> Set Daily Goal
            </button>
            <button class="water-btn" onclick="openPopup('edit-cup-popup')">
              <i class="fas fa-glass-water"></i> Set Cup Size
            </button>
          </div>
        </div>
      `;
      return;
    }
    
    // Get user's custom cup size and daily goal, or use defaults
    const cupSizeMl = player.waterIntake?.cupSize || WATER_INTAKE.GLASS_ML;
    const dailyGoalCups = player.waterIntake?.dailyGoal || WATER_INTAKE.DAILY_GOAL;
    
    const currentIntake = player.waterIntake?.current || 0;
    const streakDays = player.waterIntake?.streakDays || 0;
    const totalMl = currentIntake * cupSizeMl;
    const targetMl = dailyGoalCups * cupSizeMl;
    
    // Calculate progress percentage - can now exceed 100%
    const progressPercentage = (totalMl / targetMl) * 100;
    const isOverflowing = progressPercentage > 100;
    const remainingLiters = isOverflowing ? 0 : ((targetMl - totalMl) / 1000).toFixed(2);
    const displayPercentage = isOverflowing ? progressPercentage.toFixed(1) : Math.min(100, progressPercentage).toFixed(1);

    // Water visualization with edit buttons
    let waterHTML = `
      <div class="water-card">
        <h2>
          <button class="edit-btn" onclick="openPopup('edit-goal-popup')">
            <i class="fas fa-edit"></i>
            Edit Goal
          </button>
        </h2>
        <p class="water-goal">Goal: ${(targetMl/1000).toFixed(2)} Liters ${isOverflowing ? `<span class="achieved">✓ Exceeded!</span>` : ''}</p>
        
        <div class="water-glass-container ${isOverflowing ? 'overflowing' : ''}">
          ${isOverflowing ? `
          <div class="water-overflow"></div>
          <div class="water-drop"></div>
          <div class="water-drop"></div>
          <div class="water-drop"></div>
          <div class="water-drop"></div>
          <div class="water-drop"></div>
          ` : ''}
          <div class="water-glass">
            ${isOverflowing ? '' : `<div class="water-remaining">${remainingLiters}L<br>Remaining</div>`}
            <div class="water-percentage ${isOverflowing ? 'overflowing' : ''}">${displayPercentage}%</div>
            <div class="water-level ${isOverflowing ? 'overflowing' : ''}" style="height: ${isOverflowing ? 100 : Math.max(5, progressPercentage)}%">
            </div>
          </div>
        </div>
        
        <div class="water-stats">
          <div class="water-stat">
            <span class="stat-label">Current:</span>
            <span class="stat-value ${isOverflowing ? 'exceeding' : ''}">${(totalMl/1000).toFixed(2)}L</span>
          </div>
          <div class="water-stat">
            <span class="stat-label">Streak:</span>
            <span class="stat-value">${streakDays} days</span>
          </div>
        </div>
        
        <div class="water-actions">
          <button class="window-button" onclick="addCupOfWater()">
            <i class="fas fa-plus"></i>
            Add Cup (${cupSizeMl}ml)
          </button>
          <button class="edit-btn" onclick="openPopup('edit-cup-popup')">
            <i class="fas fa-edit"></i>
            Edit Cup Size
          </button>
        </div>
      </div>

      <div class="water-history">
        <h3>Today's Log</h3>
        <div class="water-logs">`;

    // Handle water intake history
    const todayHistory = player.waterIntake?.history?.filter(entry => {
      if (!entry || !entry.timestamp) return false;
      const entryDate = entry.timestamp instanceof Date ? entry.timestamp : entry.timestamp.toDate();
      const today = new Date();
      return (
        entryDate.getDate() === today.getDate() &&
        entryDate.getMonth() === today.getMonth() &&
        entryDate.getFullYear() === today.getFullYear()
      );
    }) || [];

    if (todayHistory.length > 0) {
      todayHistory.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp : a.timestamp.toDate();
        const timeB = b.timestamp instanceof Date ? b.timestamp : b.timestamp.toDate();
        return timeB - timeA; // Sort descending (newest first)
      });

      todayHistory.forEach(entry => {
        if (!entry || !entry.timestamp) return;
        
        const time = entry.timestamp instanceof Date ? entry.timestamp : entry.timestamp.toDate();
        const formattedTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        
        // Format amount to show L for larger amounts
        let displayAmount;
        if (entry.amount >= 1000) {
          displayAmount = `+${(entry.amount/1000).toFixed(2)}L`;
    } else {
          displayAmount = `+${entry.amount}ml`;
        }
        
        waterHTML += `
          <div class="water-log-entry">
            <span class="water-time">${formattedTime}</span>
            <span class="water-amount">${displayAmount}</span>
          </div>`;
      });
    } else {
      waterHTML += `<div class="water-log-empty">No water intake recorded today</div>`;
    }

    waterHTML += `</div></div>`;
    waterIntakeDetails.innerHTML = waterHTML;

  } catch (error) {
    console.error("Error updating water intake UI:", error);
    
    // Show error state
    if (waterIntakeDetails) {
      waterIntakeDetails.innerHTML = `
        <div class="error-message">
          <p>Error loading water intake data</p>
          <p>${error.message}</p>
          <button class="water-btn" onclick="updateWaterIntakeUI()">Retry</button>
        </div>`;
    }
  }
}


window.initializeDailyQuestsWindow = function initializeDailyQuestsWindow() {
  console.log('Initializing daily quests window');
  setupDailyQuestsTabs();
  
  if (window.windowSystem && typeof window.windowSystem.registerWindow === 'function') {
    window.windowSystem.registerWindow('dailyQuestsWindow', {
      onOpen: () => {
        // If the water intake tab is active, update its UI
        const waterIntakeTab = document.getElementById('water-intake-tab');
        if (waterIntakeTab && waterIntakeTab.classList.contains('active-tab')) {
          updateWaterIntakeUI();
        }
      }
    });
  }
};

// Call initializeDailyQuestsWindow on page load (only once)
document.addEventListener('DOMContentLoaded', () => {
  if (typeof initializeDailyQuestsWindow === 'function') {
    initializeDailyQuestsWindow();
  }
});

// Add near your other command handlers
async function checkRecentPenalties() {
  if (!isAuthenticated) return;

  try {
    const playerRef = db.collection('players').doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const playerData = playerDoc.data();

    if (playerData.penalties?.lastPenalty) {
      const lastPenalty = playerData.penalties.lastPenalty;
      const penaltyTime = lastPenalty.timestamp.toDate();
      const now = new Date();
      
      // Show penalty if it happened today
      if (penaltyTime.getDate() === now.getDate() &&
          penaltyTime.getMonth() === now.getMonth() &&
          penaltyTime.getFullYear() === now.getFullYear()) {
        printToTerminal(`[PENALTY NOTICE] You received a penalty of -${lastPenalty.amount} XP`, 'warning');
        lastPenalty.details.forEach(detail => {
          printToTerminal(detail, 'warning');
        });
      }
    }
  } catch (error) {
    console.error('Error checking penalties:', error);
  }
}

commands['!penalties'] = checkRecentPenalties;

// Add this function to create particle effects for windows
function initializeParticleEffects() {
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
function addHolographicEffects() {
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

// Add to window system initialization
const originalWindowSystemInit = windowSystem.init;
windowSystem.init = function() {
  originalWindowSystemInit.call(this);
  initializeParticleEffects();
  addHolographicEffects();
  
  // Add glitch effect when opening windows
  const originalShowWindow = this.showWindow;
  this.showWindow = function(windowId) {
    const windowElement = document.getElementById(windowId);
    if (windowElement) {
      windowElement.classList.add('window-opening');
      setTimeout(() => {
        windowElement.classList.remove('window-opening');
      }, 500);
    }
    originalShowWindow.call(this, windowId);
  };
};

// Add CSS for Solo Leveling design
function addSoloLevelingStyles() {
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

// Call this function to add the styles
addSoloLevelingStyles();

// Update this part of the initializeQuestSuggestionSystem function to fix the teleportation issue
function initializeQuestSuggestionSystem() {
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
async function loadSavedSuggestionText() {
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

async function saveSuggestionText(text) {
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
// Replace the generateQuestSuggestion function with this more robust version
async function generateQuestSuggestion() {
  const goalsText = document.getElementById('suggestionGoalsText').value.trim();
  const questType = document.querySelector('input[name="questType"]:checked').value;
  const resultsContainer = document.getElementById('suggestionResults');
  
  if (!goalsText) {
    resultsContainer.innerHTML = '<div class="error-message">Please describe your goals first.</div>';
    return;
  }
  
  // Save the suggestion text for future use
  await saveSuggestionText(goalsText);
  
  // Show loading indicator
  resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Generating suggestions...</p></div>';
  
  try {
    // Get player data for context
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const playerData = playerDoc.data();
    
    // Create a simpler, more direct prompt for better JSON response
    const prompt = `
Generate a personalized ${questType} quest for a productivity app based on these goals: "${goalsText}"

Create a quest with these exact properties:
1. title - Brief, engaging title
2. description - Clear description of what to do
3. targetCount - Numerical goal (between 1-100)
4. metric - Unit of measurement (e.g., minutes, pages, reps)
5. type - "${questType}"

Return ONLY a valid JSON object with these 5 fields, without any explanation or additional text:
{
  "title": "Quest Title",
  "description": "Quest description",
  "targetCount": 10,
  "metric": "unit",
  "type": "${questType}"
}
`;

    // Call AI API
    const aiResponse = await soloAISystem.callDeepSeekAPI(prompt);
    console.log("AI Response:", aiResponse);
    
    // Try multiple parsing strategies
    let quest = null;
    
    // Strategy 1: Try to extract and parse JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0].trim();
        try {
          quest = JSON.parse(jsonStr);
          console.log("JSON parsing successful:", quest);
        } catch (jsonError) {
          console.error("JSON parse error:", jsonError);
        }
      }
    } catch (error) {
      console.log("Strategy 1 failed:", error);
    }
    
    // Strategy 2: Parse key-value pairs directly
    if (!quest) {
      try {
        const title = aiResponse.match(/["']?title["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1]?.trim();
        const description = aiResponse.match(/["']?description["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1]?.trim();
        const targetCount = parseInt(aiResponse.match(/["']?targetCount["']?\s*[:=]\s*(\d+)/i)?.[1] || '0');
        const metric = aiResponse.match(/["']?metric["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1]?.trim();
        
        if (title && targetCount > 0 && metric) {
          quest = {
            title,
            description: description || `Complete ${targetCount} ${metric}`,
            targetCount,
            metric,
            type: questType
          };
          console.log("Key-value parsing successful:", quest);
        }
      } catch (error) {
        console.log("Strategy 2 failed:", error);
      }
    }
    
    // Strategy 3: Create a default quest from the response
    if (!quest) {
      try {
        const lines = aiResponse.split('\n').filter(line => line.trim());
        
        // Check if first line might be a title
        let possibleTitle = lines[0]?.replace(/^[^a-zA-Z0-9"']+/, '').trim() || "New Quest";
        if (possibleTitle.startsWith('"') && possibleTitle.endsWith('"')) {
          possibleTitle = possibleTitle.slice(1, -1);
        }
        
        // Look for any numbers to use as targetCount
        const numberMatch = aiResponse.match(/(\d+)\s*([a-zA-Z]+)/);
        const targetCount = numberMatch ? parseInt(numberMatch[1]) : 5;
        const possibleMetric = numberMatch ? numberMatch[2].trim() : "times";
        
        quest = {
          title: possibleTitle,
          description: goalsText.length > 80 ? goalsText.substring(0, 80) + "..." : goalsText,
          targetCount: targetCount,
          metric: possibleMetric,
          type: questType
        };
        console.log("Fallback quest created:", quest);
      } catch (error) {
        console.log("Strategy 3 failed:", error);
      }
    }
    
    // Final fallback - just create a basic quest
    if (!quest) {
      quest = {
        title: "Your Personal Quest",
        description: goalsText.length > 80 ? goalsText.substring(0, 80) + "..." : goalsText,
        targetCount: 5,
        metric: "times",
        type: questType
      };
      console.log("Using hardcoded fallback quest");
    }
    
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
    
    // Store the suggestion in a global variable for access in event handlers
    window.currentSuggestion = quest;
    
    // Add event listeners for buttons
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
    
    // Add retry button functionality
    const retryBtn = document.getElementById('retryGenerateBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', generateQuestSuggestion);
    }
  }
}

async function acceptQuestSuggestion(quest) {
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

function addQuestSuggestionStyles() {
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
      height: 450px;
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


// Initialize the quest suggestion system
initializeQuestSuggestionSystem();s