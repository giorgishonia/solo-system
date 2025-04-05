import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.module.js'; // Adjust version as needed
import BOSSES from '../src/bosses.js';
import ITEMS from '../src/items.js';
import ACHIEVEMENTS from '../src/achievements.js';
import { showProfile } from '../src/profile.js';
import { showInventory } from '../src/inventory.js';
import { showHelp } from '../src/commands.js';

/**
 * SOLO SYSTEM - TASK MANAGEMENT & GAMING SYSTEM
 * 
 * @version 1.0.0
 * 
 * IMPORTANT DEVELOPMENT NOTES:
 * - This file contains the main system logic
 * - All duplicate function declarations should be removed
 * - Code has been cleaned up to avoid overlapping definitions
 * - Timer system, UI functions, and quest handling have been centralized
 * - Any future refactoring should ensure functions are only defined once
 * - Please check for duplicate declarations when adding code
 */

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
const auth = firebase.auth();
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
      if (element.dataset.timeoutProcessed !== "true") { // Prevent repeat processing
        element.textContent = "Time's up!";
        const bossId = element.dataset.bossId;
        if (bossId) {
          handleBossBattleTimeout(db.collection("players").doc(currentUser.uid), bossId);
          element.dataset.timeoutProcessed = "true"; // Mark as processed
        }
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
    handleDailyReset();
    checkDailyStreak(); // Add this line
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
  
      // Check if player exists before initializing
      const playerRef = db.collection("players").doc(user.uid);
      const playerDoc = await playerRef.get();
  
      if (!playerDoc.exists) {
        // Create new player only on first login
        const newPlayer = {
          name: user.displayName || "Player",
          level: 1,
          exp: 0,
          gold: 100,
          energy: 100,
          streak: 0,
          questsCompleted: 0,
          battlesWon: 0,
          battlesLost: 0,
          waterIntake: {
            today: 0,
            lastUpdated: firebase.firestore.Timestamp.now()
          },
          inventory: [],
          achievements: {},
          rank: "E",
          profile: {
            name: user.displayName || "Player",
            title: "Novice",
            picture: "default.png",
            bio: "",
            class: "Hunter",
            joinDate: firebase.firestore.FieldValue.serverTimestamp(),
            unlockedTitles: []
          },
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await playerRef.set(newPlayer);
      }
  
      // Now initialize the player
      await initializePlayer(user.uid);
  
      // Welcome sequence
      await printToTerminal("[ SYSTEM RECOGNIZES YOU ]", "system");
      await new Promise(resolve => setTimeout(resolve, 1100));
      
    } else {
      // Handle unauthenticated state
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
  streak: 0,          // Already exists, keeping it
  lastDailyCheck: null, // Add this to track when we last checked daily completion
  level: 1,
  exp: 0,
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
  },
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

// Update shop to handle purchasing these items
window.showShop = async function showShop() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const shopContent = document.getElementById("shopContent");
  let html = '<div class="window-section">';
  
  for (const [itemId, item] of Object.entries(ITEMS)) {
    html += `
      <div class="window-item">
        <div class="window-item-title">${item.name}</div>
        <div class="window-item-description">${item.description}</div>
        <div class="window-item-description">Price: ${item.price} Gold</div>
        <div class="window-item-description">Rank Required: ${item.rankRequired}</div>
        <button class="window-button" onclick="buyItem('${itemId}')">Buy</button>
      </div>
    `;
  }
  
  html += '</div>';
  shopContent.innerHTML = html;
  windowSystem.showWindow("shopWindow");
}

async function buyItem(itemId) {
  if (!currentUser) {
    printToTerminal("You must be logged in to purchase items!", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  
  try {
    // Wrap in a transaction to ensure atomic updates
    await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) {
        throw new Error("Player data not found");
      }
      
      const player = playerDoc.data();

      // Try direct key lookup first
      let item = ITEMS[itemId];
      if (!item) {
        // If not found, search by id field
        item = Object.values(ITEMS).find(i => i.id === itemId);
      }

      if (!item) {
        throw new Error(`Item not found for ID: ${itemId}`);
      }

      if (player.gold < item.price) {
        throw new Error("Not enough gold!");
      }

      const isOneTimePurchase = item.effect && (
        item.effect.type === "title" ||
        item.effect.type === "profile_custom" ||
        item.effect.type === "achievement_tracking" ||
        item.effect.type === "milestone_custom" ||
        item.effect.type === "quest_chain"
      );

      // Check if already owned for one-time purchases
      if (isOneTimePurchase && player.inventory?.some(invItem => invItem.id === item.id)) {
        throw new Error("You already own this item!");
      }

      // Calculate new values
      const newGold = player.gold - item.price;
      const currentInventory = player.inventory || [];
      const newInventory = [...currentInventory, { id: item.id, name: item.name, used: false }];

      // Update database
      transaction.update(playerRef, {
        gold: newGold,
        inventory: newInventory,
      });

      // Update local stats
      playerStats.gold = newGold;
      playerStats.inventory = newInventory;

      printToTerminal(`Purchased ${item.name} successfully!`, "success");
      showNotification(`Purchased ${item.name}`);
    });

    // Refresh inventory display
    if (typeof window.showInventory === 'function') {
      window.showInventory();
    }

  } catch (error) {
    console.error("Error purchasing item:", error);
    printToTerminal(error.message || "Failed to purchase item!", "error");
  }
}

window.buyItem = buyItem;

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

async function showStreakStatus() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  await checkDailyStreak();
  
  printToTerminal("\n=== STREAK STATUS ===", "system");
  printToTerminal(`Current Daily Quest Streak: ${playerStats.streak} days`, "success");
  
  const playerRef = db.collection("players").doc(currentUser.uid);
  const snapshot = await playerRef.collection("dailyQuests").get();
  
  if (!snapshot.empty) {
    let incompleteCount = 0;
    snapshot.forEach(doc => {
      const quest = doc.data();
      if (!quest.completed || !quest.lastCompletion || !wasCompletedToday(quest.lastCompletion)) {
        incompleteCount++;
      }
    });
    
    printToTerminal(`Daily Quests Remaining Today: ${incompleteCount}`, "info");
    if (incompleteCount > 0) {
      printToTerminal("Complete all daily quests to maintain your streak!", "warning");
    } else {
      printToTerminal("All daily quests completed for today!", "success");
    }
  } else {
    printToTerminal("No active daily quests.", "info");
  }
}

// Command Handler
const commands = {
  "!switch": toggleTerminalDisplay,
  "!streak": showStreakStatus,
  "!str": showStreakStatus,
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
  "!bp": updateBattleProgress, // Changed from !p to !bp for battle progress
  "!waterDrank": handleWaterIntake,
  "!wd": handleWaterIntake,
  "!waterStatus": showWaterStatus,
  "!ws": showWaterStatus,
  "!motivation": showMotivation,
  "!m": showMotivation,
  "!setname": setPlayerName,
  "!settitle": setPlayerTitle,
  "!setbio": setPlayerBio,
  "!setclass": setPlayerClass,
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
  "!settitle": setPlayerTitle,
  "!st": setPlayerTitle,
  "!setclass": setPlayerClass,
  "!sc": setPlayerClass,
  "!notifications": showNotificationsWindow,
  "!n": showNotificationsWindow,
  "!stats": showStatsWindow,
};

  function showStatsWindow() {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }
    windowSystem.showWindow("statsWindow");
  }





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
window.updateStatsWindow = async function updateStatsWindow() {
  try {
    if (ActivityTracker.activities.length === 0) {
      await ActivityTracker.loadActivities();
    }

    if (typeof Chart === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const canvases = {
      completion: document.getElementById('completionChart'),
      progress: document.getElementById('progressChart'),
      activity: document.getElementById('activityChart')
    };

    if (!canvases.completion || !canvases.progress || !canvases.activity) {
      console.warn('One or more chart canvas elements not found');
      return;
    }

    // Reset all canvas sizes
    Object.values(canvases).forEach(canvas => {
      canvas.width = 500;
      canvas.height = 300;
    });

    try {
      createCompletionRateChart();
    } catch (chartError) {
      console.warn('Error creating completion chart:', chartError);
    }
    try {
      createProgressByDayChart();
    } catch (chartError) {
      console.warn('Error creating progress chart:', chartError);
    }
    try {
      createActivityBreakdownChart();
    } catch (chartError) {
      console.warn('Error creating activity chart:', chartError);
    }

    const windowTitle = document.querySelector('#statsWindow .window-header span');
    if (windowTitle) {
      windowTitle.textContent = 'User Activity Statistics';
    }
  } catch (error) {
    console.error("Error updating stats window:", error);
  }
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

// Keep this one (should be around line 270-290)
input.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const value = input.value.trim();
    input.value = "";

    if (creatingQuest) {
      handleQuestCreation(value);
      return;
    }

    // Get the current prompt text
    const promptUser = playerStats?.profile?.name?.toUpperCase() || "PLAYER";
    // Print command with prompt to terminal
    printToTerminal(`${promptUser} : ${value}`, "command");

    // Check for reset confirmation first
    if (awaitingResetConfirmation) {
      if (value === "Reset the dungeon") {
        handleReset(["Reset", "the", "dungeon"]);
      } else {
        printToTerminal(
          'Please type "Reset the dungeon" exactly to confirm reset',
          "warning"
        );
      }
      return;
    }

    // Split command and arguments
    const [command, ...args] = value.split(" ");

    // Execute command if it exists
    if (commands[command]) {
      commands[command](args);
    } else if (value !== "") {
      printToTerminal(
        "Unknown command. Type !commands for available commands.",
        "error"
      );
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
    console.log('Saving quest to Firebase:', questData);
    const docRef = await questRef.add(questData);
    console.log('Quest saved, ID:', docRef.id);
    printToTerminal(`${quest.type === "daily" ? "Daily quest" : "Quest"} created successfully!`, "success");
    showNotification("Quest created!");
    windowSystem.updateWindowContent("questsWindow");
    windowSystem.updateWindowContent("dailyQuestsWindow");
    return docRef.id;
  } catch (error) {
    printToTerminal("Error creating quest: " + error.message, "error");
    console.error("Error details:", error);
    return undefined;
  }
};

window.showQuestWindow = async function showQuestWindow(type) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Fetch the quests based on the type
  let quests;
  if (type === "daily") {
    quests = await fetchDailyQuests(); // Assume this function fetches daily quests
  } else {
    quests = await fetchNormalQuests(); // Assume this function fetches normal quests
  }
  windowSystem.showWindow("dailyQuestsWindow");
  windowSystem.showWindow("questsWindow");
}

window.fetchDailyQuests = async function fetchDailyQuests() {
  if (!currentUser || !currentUser.uid) {
    console.log("User not authenticated for fetching daily quests.");
    return {};
  }
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const snapshot = await playerRef.collection("dailyQuests").get();
    const quests = {};
    snapshot.forEach(doc => {
      quests[doc.id] = doc.data();
    });
    console.log("Fetched daily quests:", quests);
    return quests;
  } catch (error) {
    console.error("Error fetching daily quests:", error);
    return {};
  }
};

window.fetchNormalQuests = async function fetchNormalQuests() {
  if (!currentUser || !currentUser.uid) {
    console.log("User not authenticated for fetching normal quests.");
    return {};
  }
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const snapshot = await playerRef.collection("quests").get();
    const quests = {};
    snapshot.forEach(doc => {
      quests[doc.id] = doc.data();
    });
    console.log("Fetched normal quests:", quests);
    return quests;
  } catch (error) {
    console.error("Error fetching normal quests:", error);
    return {};
  }
};


async function printToTerminal(text, type = "default") {
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
  }

  if (type === "system") {
    // For system messages, add characters one by one
    line.textContent = "";
    output.appendChild(line);

    for (let i = 0; i < text.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      line.textContent += text[i];
    }
  } else {
    line.innerHTML = text;
    output.appendChild(line);
  }

  terminal.scrollTop = terminal.scrollHeight;
}




window.showNotification = function showNotification(message) {
  notification.querySelector(".notification-content").textContent = message;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3333);
}

window.showStatus = function showStatus() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }
  printToTerminal(`Level: ${playerStats.level}`, "info");
  printToTerminal(`Experience: ${playerStats.exp}/100`, "info");
  printToTerminal(`Gold: ${playerStats.gold}`, "info");
  printToTerminal(`Rank: ${playerStats.rank}`, "info");
}

function clearTerminal() {
  output.innerHTML = "";
}

// Modify updateStatusBar (around line 1420)
function updateStatusBar() {
  const statusBar = document.querySelector(".status-bar");
  const expNeeded = getExpNeededForLevel(playerStats.level);
  statusBar.innerHTML = `
            <span>RANK: ${playerStats.rank}</span>
            <span>LEVEL: ${playerStats.level}</span>
            <span>EXP: ${playerStats.exp}/${expNeeded}</span>
            <span>GOLD: ${playerStats.gold}</span>
    <span>STREAK: ${playerStats.streak}</span>
        `;

  const expProgress = (playerStats.exp / expNeeded) * 100;
  statusBar.style.setProperty('--exp-progress', `${expProgress}%`);
}

// Add this function after checkDailyQuests (around line 1450)
window.checkDailyStreak = async function checkDailyStreak() {
  if (!currentUser) return;

  const playerRef = db.collection("players").doc(currentUser.uid);
  const dailyQuestsRef = playerRef.collection("dailyQuests");
  
  try {
    const playerDoc = await playerRef.get();
    const playerData = playerDoc.data();
    const now = new Date();
    const lastCheck = playerData.lastDailyCheck?.toDate() || new Date(0);
    const lastCompletion = playerData.lastDailyCompletion?.toDate() || new Date(0);
    
    // Only check once per day unless it's a new day
    if (isSameDay(now, lastCheck) && !isPreviousDay(lastCompletion, now)) return;

    const snapshot = await dailyQuestsRef.get();
    if (snapshot.empty) {
      // If no daily quests, set up new ones
      await setupDailyQuests();
      return;
    }

    // Check if all daily quests are completed
    let allCompleted = true;
    let atLeastOneQuest = false;
    
    snapshot.forEach(doc => {
      atLeastOneQuest = true;
      const quest = doc.data();
      if (!quest.completed || !quest.lastCompletion || !wasCompletedToday(quest.lastCompletion)) {
        allCompleted = false;
      }
    });

    if (!atLeastOneQuest) {
      // No quests found, set up new ones
      await setupDailyQuests();
      return;
    }

    // Update streak based on completion
    if (allCompleted) {
      // Check if we completed quests yesterday or today is a consecutive day
      const isConsecutive = isPreviousDay(lastCompletion, now) || isSameDay(lastCompletion, now);
      const isNewDay = !isSameDay(lastCheck, now);
      
      // Only update streak if it's a new day
      if (isNewDay) {
        await playerRef.update({
          streak: isConsecutive ? firebase.firestore.FieldValue.increment(1) : 1,
          lastDailyCompletion: firebase.firestore.FieldValue.serverTimestamp(),
          lastDailyCheck: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        playerStats.streak = isConsecutive ? playerStats.streak + 1 : 1;
        playerStats.lastDailyCheck = now;
        playerStats.lastDailyCompletion = now;
        
        printToTerminal(`🎯 Daily Streak Updated: ${playerStats.streak} days!`, "success");
        showNotification(`Streak increased to ${playerStats.streak} days!`);
        audioSystem.playVoiceLine('STREAK');
        await checkAchievements(); // Check for streak-related achievements
      } else {
        // Already checked/completed today, just update the check time
        await playerRef.update({
          lastDailyCheck: firebase.firestore.FieldValue.serverTimestamp()
        });
        playerStats.lastDailyCheck = now;
      }
    } else {
      // Check if we need to reset the streak (if it's a new day after last completion day + 1)
      const dayAfterLastCompletion = new Date(lastCompletion);
      dayAfterLastCompletion.setDate(dayAfterLastCompletion.getDate() + 2); // Allow one day grace period
      
      if (now > dayAfterLastCompletion && playerStats.streak > 0) {
        // It's been more than one day since completion, reset streak
        await playerRef.update({
          streak: 0,
          lastDailyCheck: firebase.firestore.FieldValue.serverTimestamp()
        });
        playerStats.streak = 0;
        playerStats.lastDailyCheck = now;
        printToTerminal("🔥 Daily Streak Broken!", "warning");
        showNotification("Your daily streak has been reset - complete all daily quests to start a new streak!");
      } else if (!isSameDay(lastCheck, now)) {
        // It's a new day but we still have time to complete quests
        await playerRef.update({
          lastDailyCheck: firebase.firestore.FieldValue.serverTimestamp()
        });
        playerStats.lastDailyCheck = now;
        printToTerminal("Remember to complete your daily quests to maintain your streak!", "info");
      }
    }

    updateStatusBar();
    windowSystem.updateWindowContent("profileWindow");
  } catch (error) {
    console.error("Error checking daily streak:", error);
    printToTerminal("Error checking streak: " + error.message, "error");
  }
};

// Helper functions
function isSameDay(date1, date2) {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}

function isPreviousDay(date1, date2) {
  const prevDay = new Date(date1);
  prevDay.setDate(prevDay.getDate() + 1);
  return isSameDay(prevDay, date2);
}

// Add this to check and reset daily quests
window.checkDailyQuests = async function checkDailyQuests() {
  if (!currentUser) return;

  const dailyQuestsRef = db
    .collection("players")
    .doc(currentUser.uid)
    .collection("dailyQuests");

  const snapshot = await dailyQuestsRef.get();

  snapshot.forEach(async (doc) => {
    const quest = doc.data();
    const lastReset = quest.lastReset?.toDate() || new Date(0);
    const now = new Date();

    // Check if it's a new day
    if (
      lastReset.getDate() !== now.getDate() ||
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getYear() !== now.getYear()
    ) {
      // Reset the daily quest
      await dailyQuestsRef.doc(doc.id).update({
        currentCount: 0,
        completed: false,
        lastReset: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
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
      initializePlayer();
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
  // Clear any existing content
  clearTerminal();

  // Sequence of initialization messages with delays
  const messages = [
    { text: "[ SYSTEM ONLINE ]", type: "system", delay: 0 },
    {
      text: "[ INITIALIZING SYSTEM ]",
      type: "system",
      delay: 1300,
    },
    {
      text: "[ SYSTEM INITIALIZATION COMPLETE ]",
      type: "system",
      delay: 0,
    },
    {
      text: "Type !commands to view available protocols",
      type: "info",
      delay: 200,
      speed: 0.1,
    },
  ];

  

  // Function to print messages with delay
  for (const message of messages) {
    await new Promise((resolve) => setTimeout(resolve, message.delay));
    await printToTerminal(message.text, message.type);
  }

  if (isAuthenticated) {
    await checkDailyStreak();
  }

  // Check authentication after initialization
  if (!isAuthenticated) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await printToTerminal("\n[ ACCESS DENIED ]", "error");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await printToTerminal("Hunter Authentication Required", "warning");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await printToTerminal("Use !reawaken to establish connection", "info");
  }
}

// Initialize systems
document.addEventListener("DOMContentLoaded", async () => {
  await PlayerDB.init();
  initializeQuestListeners();
  await initializeSystem();

  // Add suggestion box to DOM
  const suggestionBox = document.createElement("div");
  suggestionBox.innerHTML = suggestionBoxHTML;
  document.body.appendChild(suggestionBox);

  // Add new styles
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles + suggestionStyles;
  document.head.appendChild(styleSheet);

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
async function checkAchievements() {
  try {
    if (!currentUser) {
      console.log("User not authenticated. Cannot check achievements.");
      return;
    }

    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) {
      console.log("Player document not found.");
      return;
    }
    
    const player = playerDoc.data();
    
    // Initialize playerStats if not already done
    playerStats = {
      ...playerStats,
      ...player,
      exp: player.exp || 0,
      level: player.level || 1,
      gold: player.gold || 0,
      streak: player.streak || 0,
      questsCompleted: player.questsCompleted || 0,
      battlesWon: player.battlesWon || 0,
      locations: player.locations || ["town"],
      waterIntake: player.waterIntake || { today: 0, streakDays: 0 },
      inventory: player.inventory || [],
      achievements: player.achievements || {},
      rank: player.rank || "E",
      shadowCount: player.shadowCount || 0,
      shadowTier: player.shadowTier || 0,
      itemsCrafted: player.itemsCrafted || 0,
      friendsAdded: player.friendsAdded || 0,
      rareItemsCollected: player.rareItemsCollected || 0,
      earlyLogins: player.earlyLogins || 0,
      challengesCompleted: player.challengesCompleted || 0,
      legendaryShadowCount: player.legendaryShadowCount || 0,
      totalGold: player.totalGold || player.gold || 0
    };
    
    // Initialize achievements if not exists
    if (!playerStats.achievements) {
      playerStats.achievements = {};
    }
    
    const updatedAchievements = { ...playerStats.achievements };
    let achievementUpdated = false;
    let expGained = 0;
    let goldGained = 0;
    
    // Initialize notified achievements
    if (!playerStats.notifiedAchievements) {
      playerStats.notifiedAchievements = {};
    }
    const notifiedAchievements = { ...playerStats.notifiedAchievements };

    // Rank value mapping for comparison
    const rankMap = { "E": 0, "D": 1, "C": 2, "B": 3, "A": 4, "S": 5 };

    // Check each achievement
    for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
      // Initialize achievement tracking if not exists
      if (!updatedAchievements[achievementId]) {
        updatedAchievements[achievementId] = {
          currentRank: 0,
          progress: 0
        };
      }
      
      const currentAchievement = updatedAchievements[achievementId];
      const maxRank = achievement.ranks.length;
      
      if (currentAchievement.currentRank >= maxRank) {
        continue; // Skip if already at max rank
      }
      
      let progressValue = 0;
      
      // Calculate progress based on achievement type
      switch (achievement.type.toLowerCase()) {
        case "rank":
          progressValue = rankMap[playerStats.rank] || 0;
          break;
        case "level":
          progressValue = playerStats.level || 0;
          break;
        case "quests_completed":
          progressValue = playerStats.questsCompleted || 0;
          break;
        case "daily_streak":
          progressValue = playerStats.streak || 0;
          break;
        case "water_streak":
          progressValue = playerStats.waterIntake.streakDays || 0;
          break;
        case "total_gold":
          progressValue = playerStats.totalGold || playerStats.gold || 0;
          break;
        case "battles_won":
          progressValue = playerStats.battlesWon || 0;
          break;
        case "locations_discovered":
          progressValue = (playerStats.locations || []).length;
          break;
        case "items_crafted":
          progressValue = playerStats.itemsCrafted || 0;
          break;
        case "friends_added":
          progressValue = playerStats.friendsAdded || 0;
          break;
        case "rare_items_collected":
          progressValue = playerStats.rareItemsCollected || 0;
          break;
        case "early_logins":
          progressValue = playerStats.earlyLogins || 0;
          break;
        case "challenges_completed":
          progressValue = playerStats.challengesCompleted || 0;
          break;
        case "legendary_shadow_count":
          progressValue = playerStats.legendaryShadowCount || 0;
          break;
        case "shadow_count":
          progressValue = playerStats.shadowCount || 0;
          break;
        case "shadow_tier":
          progressValue = playerStats.shadowTier || 0;
          break;
        default:
          console.warn(`Unhandled achievement type: ${achievement.type} for ${achievementId}`);
          progressValue = 0;
          break;
      }
      
      currentAchievement.progress = progressValue;
      
      // Check for rank ups - we check all possible rank ups in sequence
      while (currentAchievement.currentRank < maxRank) {
        const currentRankData = achievement.ranks[currentAchievement.currentRank];
        let shouldRankUp = false;
        
        // For rank achievements, compare numeric values
        if (achievement.type.toLowerCase() === "rank") {
          const requiredRankValue = rankMap[currentRankData.requirement] || 0;
          shouldRankUp = progressValue >= requiredRankValue;
        } else {
          shouldRankUp = progressValue >= currentRankData.requirement;
        }

        if (!shouldRankUp) break; // Stop checking ranks if we don't meet the next requirement

        const notificationKey = `${achievementId}_${currentAchievement.currentRank + 1}`;
        const alreadyNotified = notifiedAchievements[notificationKey];
        
        // Increment rank
        currentAchievement.currentRank++;
        achievementUpdated = true;
        
        const rewardObj = currentRankData.reward || {};
        expGained += rewardObj.exp || 0;
        goldGained += rewardObj.gold || 0;
        
        notifiedAchievements[notificationKey] = true;
        
        if (!alreadyNotified) {
          const notificationRef = db.collection("notifications").doc();
          await notificationRef.set({
            userId: currentUser.uid,
            type: "achievement",
            title: `Achievement Unlocked: ${achievement.name}`,
            message: `You've reached rank ${currentAchievement.currentRank} in ${achievement.name}!`,
            read: false,
            achievementId: achievementId,
            achievementRank: currentAchievement.currentRank,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          printToTerminal(`🏆 Achievement Unlocked: ${achievement.name} (Rank ${currentAchievement.currentRank})`, "success");
          printToTerminal(`Description: ${achievement.description}`, "info");
          if (rewardObj.exp) printToTerminal(`Reward: ${rewardObj.exp} XP`, "reward");
          if (rewardObj.gold) printToTerminal(`Reward: ${rewardObj.gold} Gold`, "reward");
          
          showNotification(`Achievement: ${achievement.name} Rank ${currentAchievement.currentRank} Unlocked!`);
        }
      }
    }

    // Update player data if any achievements changed
    if (achievementUpdated) {
      await playerRef.update({
        achievements: updatedAchievements,
        exp: firebase.firestore.FieldValue.increment(expGained),
        gold: firebase.firestore.FieldValue.increment(goldGained),
        notifiedAchievements: notifiedAchievements,
        totalGold: firebase.firestore.FieldValue.increment(goldGained) // Update totalGold as well
      });

      playerStats.achievements = updatedAchievements;
      playerStats.exp += expGained;
      playerStats.gold += goldGained;
      playerStats.totalGold = (playerStats.totalGold || 0) + goldGained;
      playerStats.notifiedAchievements = notifiedAchievements;

      updateStatusBar();
      if (windowSystem.isWindowOpen("achievementsWindow")) {
        windowSystem.updateWindowContent("achievementsWindow");
      }
      
      // Check for level up after gaining exp
      await checkLevelUp(playerRef, playerStats.exp);
    }

  } catch (error) {
    console.error("Error checking achievements:", error);
    printToTerminal("Error checking achievements: " + error.message, "error");
  }
}
function updateRankProgressWindow() {
  try {
    // Check if rank progress window is open
    if (windowSystem.isWindowOpen("rankProgressWindow")) {
      // Get current rank info
      const { level, questsCompleted } = playerStats;
      const achievements = playerStats.achievements || {};
      
      // Get current rank and next rank
      const currentRank = playerStats.rank || 1;
      const nextRank = currentRank + 1;
      
      // Get requirements for next rank
      const nextRankRequirements = RANKS[nextRank] || null;
      
      // If there's a next rank, update the window content
      if (nextRankRequirements) {
        // Count completed achievements
        let completedAchievements = 0;
        for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
          if (achievements[achievementId] && achievements[achievementId].currentRank > 0) {
            completedAchievements++;
          }
        }
        
        // Update window content with accurate progress information
        showRankProgress(currentRank, nextRank, level, questsCompleted, completedAchievements);
      }
    }
  } catch (error) {
    console.error("Error updating rank progress window:", error);
  }
}

function getExpNeededForLevel(level) {
  const baseXP = 100;
  const linearThreshold = 10;
  const scalingFactor = 1.02;
  const maxLevel = 100;

  if (level <= linearThreshold) {
    return Math.floor(baseXP + (level - 1) * 50);
  }
  return Math.floor(baseXP * Math.pow(scalingFactor, level - linearThreshold) + (level * 100));
};

window.checkLevelUp = async function checkLevelUp(playerRef, currentExp) {
  let remainingExp = currentExp;
  let levelsGained = 0;
  let currentLevel = playerStats.level;

  // Calculate level changes
  while (true) {
    const expNeeded = getExpNeededForLevel(currentLevel);

    if (remainingExp >= expNeeded) {
      // Level up
      remainingExp -= expNeeded;
      levelsGained++;
      currentLevel++;
    } else if (remainingExp < 0 && currentLevel > 1) {
      // Level down
      const prevLevelExp = getExpNeededForLevel(currentLevel - 1);
      remainingExp += prevLevelExp; // Add back the XP required for the previous level
      levelsGained--;
      currentLevel--;
    } else {
      // No further changes needed
      break;
    }
  }

  // Apply changes to player data if there's a level change or XP update
  if (levelsGained !== 0 || remainingExp !== playerStats.exp) {
    // Ensure level doesn't go below 1 and adjust XP accordingly
    if (currentLevel < 1) {
      currentLevel = 1;
      remainingExp = 0; // Reset XP to 0 if below level 1
    }

    // Update database
    await playerRef.update({
      level: currentLevel,
      exp: remainingExp // Use 'exp' to match your playerStats object
    });

    // Update local stats
    playerStats.level = currentLevel;
    playerStats.exp = remainingExp;

    // Update UI
    updateStatusBar();

    // Handle notifications
    if (levelsGained > 0) {
      handleLevelUp(levelsGained);
      showNotification(`Level up! You are now level ${currentLevel}!`);
    } else if (levelsGained < 0) {
      showNotification(
        `You lost ${Math.abs(levelsGained)} level(s) due to penalties. You are now level ${currentLevel}.`,
        "error"
      );
      audioSystem.playVoiceLine('PENALTY');
    }
  }

  return { levelsGained, newLevel: currentLevel, newExp: remainingExp };
};



printToTerminal(`XP needed for level ${playerStats.level}: ${getExpNeededForLevel(playerStats.level)}`, "debug");

window.completeQuest = async function completeQuest(questTitle, type) {
  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questsCollection = db
      .collection("players")
      .doc(currentUser.uid)
      .collection(type === "daily" ? "dailyQuests" : "quests");

    console.log(`Attempting to complete ${type} quest with title: "${questTitle}"`);
    const normalizedQuestTitle = questTitle.trim().toLowerCase();

    // Query for quest by normalized title
    const querySnapshot = await questsCollection
      .where("titleLower", "==", normalizedQuestTitle)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.log(`No ${type} quest found with title: "${questTitle}"`);
      printToTerminal(`Quest "${questTitle}" not found.`, "error");
      return { success: false, error: `Quest "${questTitle}" not found` };
    }

    const questDoc = querySnapshot.docs[0];
    const questId = questDoc.id;
    const quest = questDoc.data();
    const questRef = questsCollection.doc(questId);

    console.log(`Quest found: "${quest.title}" (ID: ${questId})`, quest);

    if (type === "daily") {
      const lastCompletionDate = quest.lastCompletion?.toDate() || new Date(0);
      const wasCompletedToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
      };
      if (quest.completed && wasCompletedToday(lastCompletionDate)) {
        console.log(`Quest "${questTitle}" already completed today at ${lastCompletionDate}`);
        printToTerminal("This daily quest was already completed today!", "warning");
        return { success: false, error: "Already completed today" };
      }
    }

    const baseExpReward = type === "daily" ? 50 : 30;
    const baseGoldReward = type === "daily" ? 25 : 15;

    const result = await db.runTransaction(async (transaction) => {
      console.log(`Starting transaction for "${questTitle}" (ID: ${questId})`);
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) throw new Error("Player not found");
      const player = playerDoc.data();
      console.log(`Player data fetched:`, player);

      const difficultyMultiplier = quest.difficulty || 1;
      const activeEffects = getActiveItemEffects(player.inventory || []) || [];
      const questRewardBoost = calculateTotalBoost("quest_rewards", activeEffects) || 1;

      const expReward = Math.round(baseExpReward * difficultyMultiplier * questRewardBoost);
      const goldReward = Math.round(baseGoldReward * difficultyMultiplier * questRewardBoost);

      const newExp = (player.exp || 0) + expReward;
      const newGold = (player.gold || 0) + goldReward;
      const newQuestsCompleted = (player.questsCompleted || 0) + 1;

      const completedQuestRef = db.collection("completedQuests").doc();
      transaction.set(completedQuestRef, {
        ...quest,
        userId: currentUser.uid,
        questId: questId,
        originalType: type,
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        expRewarded: expReward,
        goldRewarded: goldReward
      });

      if (type === "daily") {
        transaction.update(questRef, {
          completed: true,
          lastCompletion: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Updating ${type} quest "${questTitle}" (ID: ${questId}) to completed`);
      } else {
        transaction.delete(questRef);
        console.log(`Deleting ${type} quest "${questTitle}" (ID: ${questId})`);
      }

      transaction.update(playerRef, {
        exp: newExp,
        gold: newGold,
        questsCompleted: newQuestsCompleted,
      });
      console.log(`Transaction completed: exp=${newExp}, gold=${newGold}`);

      return { expReward, goldReward, questId };
    });

    notificationSystem.playSound("quest_complete");
    handleQuestComplete();
    printToTerminal(`\n✅ Quest complete: ${quest.title}`, "success");
    printToTerminal(`Received rewards: XP=${result.expReward}, Gold=${result.goldReward}`, "reward");
    showNotification(`Quest Complete: ${quest.title}`);

    if (type === "daily") {
      windowSystem.updateDailyQuestsWindow();
    } else {
      removeQuestFromUI(questId, "normal");
      const questElement = document.getElementById(`quest-normal-${questId}`);
      if (questElement) questElement.remove();
      if (windowSystem.windows.questsWindow?.classList.contains("show")) {
        document.getElementById("questsList")?.innerHTML = "";
        windowSystem.updateWindowContent("questsWindow");
        window.fetchNormalQuests();
      }
    }
    updateStatusBar();

    await checkLevelUp(playerRef, playerStats.exp);
    await checkAchievements();
    attemptShardDrop();

    return { 
      success: true, 
      title: quest.title,
      expGained: result.expReward,
      goldGained: result.goldReward,
      questId: result.questId
    };
  } catch (error) {
    console.error("Error completing quest:", error);
    printToTerminal("Error completing quest: " + error.message, "error");
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

  let completionDate;
  if (dateInput.toDate) {
    // Firebase Timestamp
    completionDate = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    // Already a Date object
    completionDate = dateInput;
  } else {
    // Invalid input, assume not completed today
    console.warn("Invalid date input for wasCompletedToday:", dateInput);
    return false;
  }

  const now = new Date();
  return (
    completionDate.getDate() === now.getDate() &&
    completionDate.getMonth() === now.getMonth() &&
    completionDate.getFullYear() === now.getFullYear()
  );
}

window.wasCompletedToday = wasCompletedToday; // Make globally available if needed
window.sellShard = async function sellShard(shardId, quantity = 1) {
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

    // Get shard data to calculate proper rewards
    const shardData = ITEMS[shardId] || {};
    const totalQuantity = Math.min(quantity, shards.length);
    
    // Get base values with fallbacks
    const goldReward = (shardData.sellValue || shards[0].goldValue || 50) * totalQuantity;
    const expReward = (shardData.expValue || 20) * totalQuantity;

    // Remove the specified quantity of shards from the inventory
    const shardsToRemove = shards.slice(0, totalQuantity);
    
    await playerRef.update({
      inventory: firebase.firestore.FieldValue.arrayRemove(...shardsToRemove),
      gold: firebase.firestore.FieldValue.increment(goldReward),
      exp: firebase.firestore.FieldValue.increment(expReward)
    });

    // Update local stats
    playerStats.inventory = playerStats.inventory.filter(item => 
      !(shardsToRemove.some(shard => shard === item))
    );
    playerStats.gold += goldReward;
    playerStats.exp += expReward;

    // Show feedback with all rewards
    printToTerminal(`Sold ${totalQuantity} ${shards[0].name || "Crystal Shard"}${totalQuantity > 1 ? 's' : ''} for:`, "success");
    printToTerminal(`  - ${goldReward} gold`, "reward");
    printToTerminal(`  - ${expReward} XP`, "reward");
    
    showNotification(`Sold shard(s) for ${goldReward} gold and ${expReward} XP!`);

    // Update UI
    windowSystem.updateWindowContent("inventoryWindow");
    updateStatusBar();
    
    // Check for possible level up with the new XP
    await checkLevelUp(playerRef, playerStats.exp);
    
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

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    const player = playerDoc.data();

    // Find the shard in inventory
    const shard = player.inventory.find(item => item.id === shardId);
    if (!shard) {
      printToTerminal("Shard not found in inventory.", "error");
      return;
    }

    // Get shard data to calculate proper rewards
    const shardData = ITEMS[shardId] || {};
    
    // Set reasonable default rewards in case they're not defined on the shard
    const goldReward = shardData.useGoldReward || 75;
    const expReward = shardData.useExpReward || 35;
    
    // Determine any special effects this shard might have
    const specialEffect = shardData.specialEffect || null;
    let specialEffectMessage = "";
    
    // Handle any special effects the shard may have
    if (specialEffect) {
      // Implement special effect logic here
      specialEffectMessage = `\nSpecial effect: ${specialEffect}`;
    }

    // Update the database (remove shard, add rewards)
    await playerRef.update({
      // Remove the specific shard that was used
      inventory: firebase.firestore.FieldValue.arrayRemove(shard),
      // Add rewards
      gold: firebase.firestore.FieldValue.increment(goldReward),
      exp: firebase.firestore.FieldValue.increment(expReward)
    });

    // Update local player stats
    playerStats.inventory = playerStats.inventory.filter(item => item !== shard);
    playerStats.gold += goldReward;
    playerStats.exp += expReward;

    // Provide feedback to the player
    printToTerminal(`Used ${shard.name || "Crystal Shard"} successfully!`, "success");
    printToTerminal(`Rewards:`, "info");
    printToTerminal(`  - ${goldReward} gold`, "reward");
    printToTerminal(`  - ${expReward} XP`, "reward");
    
    if (specialEffectMessage) {
      printToTerminal(specialEffectMessage, "special");
    }
    
    showNotification(`Used shard for ${goldReward} gold and ${expReward} XP!`);

    // Update UI
    windowSystem.updateWindowContent("inventoryWindow");
    updateStatusBar();
    
    // Check for level up with the new XP
    await checkLevelUp(playerRef, playerStats.exp);
    
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

  if (!args || args.length < 2) {
    printToTerminal("Usage: !progress <boss_id> <amount>", "warning");
    printToTerminal("Example: !progress step_master 1000", "info");
    return;
  }

  const [bossId, amount] = args;
  const boss = Object.values(BOSSES).find((b) => b.id === bossId);
  if (!boss) {
    printToTerminal("Invalid boss battle ID.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const activeBattleRef = playerRef.collection("activeBattles").doc(bossId);
    const activeBattle = await activeBattleRef.get();

    if (!activeBattle.exists) {
      printToTerminal("You haven't started this boss battle yet!", "error");
      printToTerminal(`Use !challenge ${bossId} to start`, "info");
      return;
    }

    const battle = activeBattle.data();
    const now = new Date();
    const endTime = battle.endTime.toDate();

    if (now > endTime) {
      // Only call handleBossBattleTimeout if battle data is valid
      if (battle) {
        await handleBossBattleTimeout(playerRef, bossId, battle);
      }
      return;
    }

    const newCount =
      amount === "complete" ? battle.targetCount : parseInt(amount);
    if (isNaN(newCount)) {
      printToTerminal("Please provide a valid number.", "error");
      return;
    }

    if (newCount >= battle.targetCount && !battle.completed) {
      // Boss defeated!
      const player = (await playerRef.get()).data();
      const defeatCount = player.defeatedBosses?.[bossId] || 0;

      // Calculate scaled rewards
      const scaledExp =
        boss.rewards.exp + defeatCount * boss.scaling.rewards.exp;
      const scaledGold =
        boss.rewards.gold + defeatCount * boss.scaling.rewards.gold;

      // Update defeat count
      const defeatedBossesUpdate = {
        [`defeatedBosses.${bossId}`]:
          firebase.firestore.FieldValue.increment(1),
      };

      // Award rewards
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(scaledExp),
        gold: firebase.firestore.FieldValue.increment(scaledGold),
        "profile.title": boss.rewards.title,
        ...defeatedBossesUpdate,
      });

      // Update local stats
      playerStats.exp += scaledExp;
      playerStats.gold += scaledGold;
      playerStats.profile.title = boss.rewards.title;
      if (!playerStats.defeatedBosses) playerStats.defeatedBosses = {};
      playerStats.defeatedBosses[bossId] =
        (playerStats.defeatedBosses[bossId] || 0) + 1;
      
            // Update local stats
            const currentLevel = playerStats.level || 1; // Get current level before XP is added
      
            playerStats.exp += scaledExp;
            playerStats.gold += scaledGold;
            playerStats.profile.title = boss.rewards.title;
            if (!playerStats.defeatedBosses) playerStats.defeatedBosses = {};
            playerStats.defeatedBosses[bossId] = 
              (playerStats.defeatedBosses[bossId] || 0) + 1;
            
            // Show battle completion messages first
            printToTerminal(`Boss defeated! Gained ${scaledExp} XP and ${scaledGold} gold!`, "success");
            showNotification(`Boss defeated! Rewards claimed!`);
            
            // Check for level up using the existing function
            const levelUpResult = await checkLevelUp(playerRef, playerStats.exp);
            
            // If we have a result and the new level is higher, show level-up message
            if (levelUpResult && levelUpResult.newLevel > currentLevel) {
              const levelsGained = levelUpResult.newLevel - currentLevel;
              printToTerminal(`🎉 Level Up! +${levelsGained} level${levelsGained > 1 ? 's' : ''}! You are now level ${levelUpResult.newLevel}!`, "success");
              showNotification(`Level Up! You are now level ${levelUpResult.newLevel}!`);
              
              // Call the level up handler if it exists
              if (typeof handleLevelUp === 'function') {
                handleLevelUp(levelsGained);
              }
            }
      // Add notification for boss victory
      const victoryTime = new Date();
      await db.collection('notifications').add({
        userId: auth.currentUser.uid,
        title: "Boss Victory",
        message: `You defeated ${battle.bossName} and earned ${scaledExp} XP and ${scaledGold} gold!`,
        type: "victory",
        timestamp: firebase.firestore.Timestamp.fromDate(victoryTime),
        read: false
      });
      
      // Update notification badge
      const count = await windowSystem.getUnreadNotificationsCount();
      windowSystem.updateNotificationBadge(count);

      // Delete completed battle
      await activeBattleRef.delete();
    }
  } catch (error) {
    console.error("Error updating battle progress:", error);
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

// Add water intake constants
const WATER_INTAKE = {
  DAILY_GOAL: 14, // glasses per day
  GLASS_ML: 250, // ml per glass
  ENCOURAGEMENTS: [
    { threshold: 0.25, message: "Great start! Keep going! 💧" },
    {
      threshold: 0.5,
      message: "Halfway there! Your body thanks you! 💪",
    },
    {
      threshold: 0.75,
      message: "Almost there! You're doing amazing! 🌊",
    },
    {
      threshold: 1,
      message: "Daily goal achieved! You're a hydration champion! 🏆",
    },
  ],
  REWARDS: {
    exp: 50, // EXP reward for reaching daily goal
    gold: 25, // Gold reward for reaching daily goal
  },
};

// Water intake tracking functions
async function handleWaterIntake(args) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  // Check if we need to reset daily progress
  await checkWaterIntakeReset();

  const glasses = args && args.length > 0 ? parseInt(args[0]) : 1;

  if (isNaN(glasses) || glasses <= 0) {
    printToTerminal("Please enter a valid number of glasses.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const currentIntake = player.waterIntake?.current || 0;
    const newIntake = Math.min(
      currentIntake + glasses,
      WATER_INTAKE.DAILY_GOAL
    );
    const wasGoalReached =
      currentIntake < WATER_INTAKE.DAILY_GOAL &&
      newIntake >= WATER_INTAKE.DAILY_GOAL;

    // Update water intake
    await playerRef.update({
      "waterIntake.current": newIntake,
      "waterIntake.lastReset":
        player.waterIntake?.lastReset ||
        firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Update local stats
    playerStats.waterIntake.current = newIntake;

    // Show progress
    const progressPercentage = newIntake / WATER_INTAKE.DAILY_GOAL;
    printToTerminal(
      `Added ${glasses} glass${glasses > 1 ? "es" : ""} of water!`,
      "success"
    );
    printToTerminal(
      `Current Water Intake: ${newIntake}/${WATER_INTAKE.DAILY_GOAL} glasses`,
      "info"
    );
    printToTerminal(
      `Total: ${newIntake * WATER_INTAKE.GLASS_ML}ml / ${
        WATER_INTAKE.DAILY_GOAL * WATER_INTAKE.GLASS_ML
      }ml`,
      "info"
    );

    // Show encouragement message
    for (let i = WATER_INTAKE.ENCOURAGEMENTS.length - 1; i >= 0; i--) {
      if (progressPercentage >= WATER_INTAKE.ENCOURAGEMENTS[i].threshold) {
        printToTerminal(WATER_INTAKE.ENCOURAGEMENTS[i].message, "system");
        break;
      }
    }

    // Award rewards if daily goal is reached
    if (wasGoalReached) {
      await playerRef.update({
        exp: firebase.firestore.FieldValue.increment(WATER_INTAKE.REWARDS.exp),
        gold: firebase.firestore.FieldValue.increment(
          WATER_INTAKE.REWARDS.gold
        ),
        "waterIntake.streakDays": firebase.firestore.FieldValue.increment(1),
      });

      // Update local stats
      playerStats.exp += WATER_INTAKE.REWARDS.exp;
      playerStats.gold += WATER_INTAKE.REWARDS.gold;
      playerStats.waterIntake.streakDays++;

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

    showNotification(
      `Water intake updated: ${newIntake}/${WATER_INTAKE.DAILY_GOAL} glasses`
    );
  } catch (error) {
    printToTerminal("Error updating water intake: " + error.message, "error");
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
    const currentIntake = player.waterIntake?.current || 0;
    const streakDays = player.waterIntake?.streakDays || 0;

    printToTerminal("=== WATER INTAKE STATUS ===", "system");
    printToTerminal(
      `Current Progress: ${currentIntake}/${WATER_INTAKE.DAILY_GOAL} glasses`,
      "info"
    );
    printToTerminal(
      `Total: ${currentIntake * WATER_INTAKE.GLASS_ML}ml / ${
        WATER_INTAKE.DAILY_GOAL * WATER_INTAKE.GLASS_ML
      }ml`,
      "info"
    );
    printToTerminal(`Streak: ${streakDays} days`, "info");

    const remaining = WATER_INTAKE.DAILY_GOAL - currentIntake;
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

async function checkWaterIntakeReset() {
  if (!currentUser) return;

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const lastReset = player.waterIntake?.lastReset?.toDate() || new Date(0);
    const now = new Date();

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
        player.waterIntake?.current >= WATER_INTAKE.DAILY_GOAL;

      await playerRef.update({
        "waterIntake.current": 0,
        "waterIntake.lastReset":
          firebase.firestore.FieldValue.serverTimestamp(),
        "waterIntake.streakDays": wasYesterdayGoalMet
          ? player.waterIntake?.streakDays || 0
          : 0,
      });

      // Update local stats
      playerStats.waterIntake.current = 0;
      playerStats.waterIntake.streakDays = wasYesterdayGoalMet
        ? player.waterIntake?.streakDays || 0
        : 0;

      if (!wasYesterdayGoalMet && player.waterIntake?.streakDays > 0) {
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



// Add this companion function to handle item usage
window.useInventoryItem = async function useInventoryItem(itemId, index) {
  if (!isAuthenticated || !currentUser) {
    printToTerminal("You must be logged in to use items!", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);

  try {
    await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) {
        throw new Error("Player data not found");
      }

      const playerData = playerDoc.data();
      const inventory = [...playerData.inventory];
      
      if (index < 0 || index >= inventory.length || inventory[index].id !== itemId) {
        throw new Error("Invalid inventory item");
      }

      if (inventory[index].used) {
        throw new Error("This item has already been used!");
      }

      const itemData = ITEMS[itemId];
      if (!itemData || !itemData.consumable) {
        throw new Error("This item cannot be used!");
      }

      // Mark item as used
      inventory[index].used = true;

      // Apply item effect (you'll need to implement this based on your item types)
      await applyItemEffect(itemId, playerRef, transaction);

      // Update database
      transaction.update(playerRef, { inventory });

    // Update local stats
      playerStats.inventory = inventory;

      printToTerminal(`Successfully used ${itemData.name}!`, "success");
      showNotification(`Used ${itemData.name}`);
    });

    // Refresh inventory display
    await showInventory();

  } catch (error) {
    console.error("Error using item:", error);
    printToTerminal(error.message || "Failed to use item!", "error");
  }
};

// Example item effect application function (customize based on your needs)
async function applyItemEffect(itemId, playerRef, transaction) {
  const itemData = ITEMS[itemId];
  if (!itemData?.effect) return;

  switch (itemData.effect.type) {
    case "xp_boost":
      // Example: Add XP boost effect (you might want to track this separately)
      const expGain = itemData.effect.value || 50;
      transaction.update(playerRef, {
        exp: firebase.firestore.FieldValue.increment(expGain)
      });
      playerStats.exp += expGain;
      break;
    case "gold_boost":
      const goldGain = itemData.effect.value || 25;
      transaction.update(playerRef, {
        gold: firebase.firestore.FieldValue.increment(goldGain)
      });
      playerStats.gold += goldGain;
      break;
    case "title":
      // Add title to unlocked titles
      const currentProfile = playerStats.profile || {};
      const newTitles = [...(currentProfile.unlockedTitles || []), itemData.effect.value];
      transaction.update(playerRef, {
        "profile.unlockedTitles": newTitles
      });
      playerStats.profile.unlockedTitles = newTitles;
      break;
    // Add more effect types as needed
    default:
      console.warn(`Unknown item effect type: ${itemData.effect.type}`);
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
    leaderboardWindow: document.getElementById("leaderboardWindow"),
    notificationsWindow: document.getElementById("notificationsWindow"),
    bossBattlesWindow: document.getElementById("bossBattlesWindow"),
    setNameWindow: document.getElementById("setNameWindow"),
    setTitleWindow: document.getElementById("setTitleWindow"),
    setClassWindow: document.getElementById("setClassWindow"),
    setBioWindow: document.getElementById("setBioWindow"),
    statsWindow: document.getElementById("statsWindow"),
  },


  zIndex: 100,

  init() {
    // Check if taskbar exists, if not create it
    let taskbar = document.getElementById("taskbar");
    if (!taskbar) {
      taskbar = document.createElement("div");
      taskbar.id = "taskbar";
      taskbar.className = "window-taskbar";
      document.body.appendChild(taskbar);
    }
    
    this.zIndex = 100;

    // Initialize windows
    Object.entries(this.windows).forEach(([id, window]) => {
      if (!window) return;

      // Set initial position if not set
      if (!window.style.top) {
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowHeight = window.offsetHeight || 400;
        const top = Math.max(10, (viewportHeight - windowHeight) / 2);
        window.style.top = `${top}px`;
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
      {
        id: "notificationsWindow",
        icon: "fa-bell",
        title: "Notifications",
      },
      // Adding the new windows (without taskbar icons - these will be opened via buttons)
      { id: "setNameWindow", icon: "", title: "Set Name", hideFromTaskbar: true },
      { id: "setTitleWindow", icon: "", title: "Set Title", hideFromTaskbar: true },
      { id: "setClassWindow", icon: "", title: "Set Class", hideFromTaskbar: true },
      { id: "setBioWindow", icon: "", title: "Set Bio", hideFromTaskbar: true },
      { id: "statsWindow", icon: "fa-chart-line", title: "Statistics" },
      {
        id: "progressReportWindow",
        icon: "fa-chart-line",
        title: "Progress Report",
        customHandler: true
      },
    ];

    windowConfigs.forEach((config) => {
      // Only add taskbar items for windows that shouldn't be hidden
      if (!config.hideFromTaskbar) {
        const taskbarItem = document.createElement("div");
        taskbarItem.className = "taskbar-item";
        taskbarItem.title = config.title;
        taskbarItem.innerHTML = `<i class="fas ${config.icon}"></i>`;
        
        // Use custom handler for progress report
        if (config.customHandler && config.id === "progressReportWindow") {
          taskbarItem.addEventListener("click", () => {
            // Create dropdown for weekly/monthly options
            const dropdown = document.createElement("div");
            dropdown.className = "taskbar-dropdown";
            dropdown.innerHTML = `
              <div class="dropdown-item" id="weeklyReport">Weekly Report</div>
              <div class="dropdown-item" id="monthlyReport">Monthly Report</div>
            `;
            
            // Position the dropdown above the button
            const buttonRect = taskbarItem.getBoundingClientRect();
            dropdown.style.position = "absolute";
            dropdown.style.bottom = `${window.innerHeight - buttonRect.top + 5}px`;
            dropdown.style.left = `${buttonRect.left}px`;
            dropdown.style.zIndex = "1000";
            dropdown.style.backgroundColor = "#222";
            dropdown.style.border = "1px solid #444";
            dropdown.style.borderRadius = "4px";
            dropdown.style.padding = "5px 0";
            dropdown.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";
            
            // Style dropdown items
            const dropdownItems = dropdown.querySelectorAll(".dropdown-item");
            dropdownItems.forEach(item => {
              item.style.padding = "8px 15px";
              item.style.cursor = "pointer";
              item.style.color = "#ddd";
              item.style.fontSize = "14px";
              
              // Hover effect
              item.addEventListener("mouseover", () => {
                item.style.backgroundColor = "#333";
              });
              item.addEventListener("mouseout", () => {
                item.style.backgroundColor = "transparent";
              });
            });
            
            // Add event listeners for options
            dropdown.querySelector("#weeklyReport").addEventListener("click", () => {
              window.showProgressReport("weekly");
              document.body.removeChild(dropdown);
            });
            
            dropdown.querySelector("#monthlyReport").addEventListener("click", () => {
              window.showProgressReport("monthly");
              document.body.removeChild(dropdown);
            });
            
            // Add click outside to close
            const closeDropdown = (e) => {
              if (!dropdown.contains(e.target) && e.target !== taskbarItem) {
                if (document.body.contains(dropdown)) {
                  document.body.removeChild(dropdown);
                }
                document.removeEventListener("click", closeDropdown);
              }
            };
            
            // Add the dropdown to the body
            document.body.appendChild(dropdown);
            
            // Add event listener with a slight delay to prevent immediate closing
            setTimeout(() => {
              document.addEventListener("click", closeDropdown);
            }, 100);
          });
        } else {
          taskbarItem.addEventListener("click", () => this.toggleWindow(config.id));
        }
        
        taskbar.appendChild(taskbarItem);
      }
      
      // Add window to the windowSystem.windows object if it exists in the DOM but not in the object
      const windowElement = document.getElementById(config.id);
      if (windowElement && !this.windows[config.id]) {
        this.windows[config.id] = windowElement;
        
        // Make these windows draggable too
        this.makeDraggable(windowElement);
      }
    });
    
    
    const toggleTerminalButton = document.getElementById("toggleTerminal");
    if (toggleTerminalButton) {
      taskbar.appendChild(toggleTerminalButton);
    }

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

        // Update taskbar
        try {
          const taskbarItem = this.getTaskbarItem(windowId);
          if (taskbarItem) {
            taskbarItem.classList.add("active");
          }
        } catch (error) {
          console.warn(`Error updating taskbar for ${windowId}:`, error);
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
    // First check if window exists and has the window-title element
    const window = this.windows[windowId];
    if (!window) return null;
    
    // Try to find the window title from different possible elements
    let windowTitle = '';
    const titleElement = window.querySelector(".window-title");
    
    if (titleElement) {
      windowTitle = titleElement.textContent;
    } else {
      // Alternative: look for span in window-header
      const headerSpan = window.querySelector(".window-header span");
      if (headerSpan) {
        windowTitle = headerSpan.textContent;
      }
    }
    
    return Array.from(document.querySelectorAll(".taskbar-item")).find(
      (item) => {
        // Handle special cases for Profile and Quests windows
        if (windowId === "profileWindow" && item.title === "Profile") return true;
        if (windowId === "questsWindow" && item.title === "Quests") return true;
        if (windowId === "statsWindow" && item.title === "Statistics") return true;
        // For other windows, check if the taskbar item title matches the window title
        return windowTitle && item.title === windowTitle;
      }
    );
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
      case "statsWindow":
        await this.updateStatsWindow();
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
      
      // Add the centralized timer at the top
      const timerSection = document.createElement("div");
      timerSection.className = "daily-timer-section";
      const endOfDay = getEndOfDay();
      const now = new Date();
      const remaining = endOfDay - now;
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      const totalDayDuration = endOfDay - startOfDay;
      const progress = ((totalDayDuration - remaining) / totalDayDuration) * 100;
      
      timerSection.innerHTML = `
        <div class="daily-timer-container">
          <div class="daily-timer-label">Time Until Reset</div>
          <div class="daily-timer-display" id="centralDailyTimer">${formatTimeRemaining(remaining)}</div>
          <div class="daily-timer-progress">
            <div class="timer-progress-bar" style="width: ${progress}%"></div>
            <div class="timer-markers">
              <span class="marker" style="left: 0%">00:00</span>
              <span class="marker" style="left: 25%">06:00</span>
              <span class="marker" style="left: 50%">12:00</span>
              <span class="marker" style="left: 75%">18:00</span>
              <span class="marker" style="left: 100%">24:00</span>
            </div>
          </div>
        </div>
      `;
      
      dailyQuestsList.innerHTML = "";
      dailyQuestsList.appendChild(timerSection);

      if (snapshot.empty) {
        dailyQuestsList.innerHTML += '<div class="window-item">No daily quests available</div>';
        return;
      }

      snapshot.forEach((doc) => {
        const quest = doc.data();
        const questElement = document.createElement("div");
        questElement.className = "window-item";

        // Check if quest was completed today
        const isCompletedToday = quest.completed && quest.lastCompletion && wasCompletedToday(quest.lastCompletion);

        // Add completed class if quest is completed today
        if (isCompletedToday) {
          questElement.classList.add("completed-quest");
        }

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
                   onchange="updateQuestCount('${doc.id}', 'daily', this.value)"
                   style="width: 60px; background: transparent; color: var(--text-color); border: 1px solid var(--system-blue);"
                   ${isCompletedToday ? "disabled" : ""}>
            /${quest.targetCount} ${quest.metric}
          </div>
          <div class="window-item-description">${quest.description}</div>
          <div class="window-item-progress">
            <div class="window-item-progress-bar" style="width: ${isCompletedToday ? 100 : (quest.currentCount / quest.targetCount) * 100}%"></div>
          </div>
          
                   <div class="window-actions" style="margin-top: 10px;">
            <button id="dailyquestcompletebutton" class="window-button" onclick="completeQuest('${doc.id}', '${type}')" ${isCompletedToday ? "disabled" : ""}>
              Complete Quest
            </button>
            <button class="window-button danger" onclick="deleteQuest('${doc.id}', '${type}')">
              Delete Quest
            </button>
          </div>`;

        dailyQuestsList.appendChild(questElement);
      });
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
        battles_won: "Battle Achievements",
        locations_discovered: "Exploration Achievements",
        items_crafted: "Crafting Achievements",
        friends_added: "Social Achievements",
        rare_items_collected: "Collection Achievements",
        early_logins: "Time-Based Achievements",
        challenges_completed: "Challenge Achievements"
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
            const isMaxRank = currentRank >= achievement.ranks.length;
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
                  currentValue = player.level || 0;
                  progressText = `Level ${currentValue}/${nextRank.requirement}`;
                  break;
                case "quests_completed":
                  currentValue = player.questsCompleted || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Quests`;
                  break;
                case "daily_streak":
                  currentValue = player.streak || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Days`;
                  break;
                case "water_streak":
                  currentValue = player.waterIntake?.streakDays || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Days`;
                  break;
                case "total_gold":
                  currentValue = player.totalGold || player.gold || 0;
                  progressText = `${currentValue.toLocaleString()}/${nextRank.requirement.toLocaleString()} Gold`;
                  break;
                case "rank":
                  const ranks = ["E", "D", "C", "B", "A", "S"];
                  const currentRankIndex = ranks.indexOf(player.rank || "E");
                  const requiredRankIndex = ranks.indexOf(nextRank.requirement);
                  currentValue = currentRankIndex;
                  progressText = `Current: ${player.rank || "E"} / Required: ${nextRank.requirement}`;
                  break;
                case "battles_won":
                  currentValue = player.battlesWon || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Battles`;
                  break;
                case "locations_discovered":
                  currentValue = (player.locations || []).length;
                  progressText = `${currentValue}/${nextRank.requirement} Locations`;
                  break;
                case "items_crafted":
                  currentValue = player.itemsCrafted || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Items`;
                  break;
                case "friends_added":
                  currentValue = player.friendsAdded || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Friends`;
                  break;
                case "rare_items_collected":
                  currentValue = player.rareItemsCollected || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Items`;
                  break;
                case "early_logins":
                  currentValue = player.earlyLogins || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Logins`;
                  break;
                case "challenges_completed":
                  currentValue = player.challengesCompleted || 0;
                  progressText = `${currentValue}/${nextRank.requirement} Challenges`;
                  break;
              }

              // Calculate progress percentage
              if (achievement.type === "rank") {
                const ranks = ["E", "D", "C", "B", "A", "S"];
                const currentRankIndex = ranks.indexOf(player.rank || "E");
                const requiredRankIndex = ranks.indexOf(nextRank.requirement);
                progressPercentage = Math.min(100, (currentRankIndex / Math.max(1, requiredRankIndex)) * 100);
              } else {
                progressPercentage = Math.min(100, (currentValue / nextRank.requirement) * 100);
              }

              achievementElement.innerHTML = `
                <div class="achievement-rank ${isMaxRank ? "max" : ""}">
                    ${isMaxRank ? "MAX" : `Rank ${currentRank}`}
                </div>
                <div class="achievement-glow"></div>
                <div class="achievement-header">
                    <div class="achievement-name">
                        <span class="achievement-icon">${achievement.icon}</span>
                        ${achievement.name}
                    </div>
                </div>
                <div class="achievement-description">${achievement.description}</div>
                ${
                  nextRank
                    ? `
                    <div class="achievement-rewards">
                        Next Rank Rewards: ${nextRank.reward.exp} XP, ${nextRank.reward.gold} Gold
                    </div>
                    <div class="achievement-progress-container">
                        <div class="achievement-progress-bar" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="achievement-progress-text">${progressText}</div>
                    <div class="achievement-next-rank">Next: Rank ${currentRank + 1}</div>
                `
                    : `
                    <div class="achievement-rewards">
                        Achievement Mastered!
                    </div>
                `
                }
            `;

              achievementsList.appendChild(achievementElement);
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
        training: { name: "💪 Training Boosters", items: [] }, // Note: No items currently use this, but kept for future use
        upgrade: { name: "🏆 Permanent Upgrades", items: [] },
        economy: { name: "💰 Gold & Economy", items: [] }, // Note: No items currently use this, but kept for future use
        title: { name: "🏅 Special Titles", items: [] },
        cosmetic: { name: "🎨 Profile Customization", items: [] }, // Added for cosmetic items
        utility: { name: "🛠️ Utility Items", items: [] }, // Added for utility items
        special: { name: "🌟 Special Items", items: [] },
        shadow: { name: "🖤 Shadow Abilities", items: [] }, // Added for shadow items
      };

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
                    ? `<button onclick="window.buyItem('${item.id}')" class="shop-button">Purchase</button>`
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
      const leaderboardList = document.getElementById("leaderboardList");
      leaderboardList.innerHTML = "";
  
      const playersRef = db.collection("players");
      const snapshot = await playersRef.orderBy("level", "desc").limit(10).get();
  
      let rank = 1; // Track the rank manually for top 3 styling
      snapshot.forEach((doc) => {
        const player = doc.data();
        const playerElement = document.createElement("div");
        playerElement.className = "leaderboard-entry window-item"; // Base class
  
        // Apply top-3 specific styles
        if (rank === 1) {
          playerElement.classList.add("top-3", "first-place");
        } else if (rank === 2) {
          playerElement.classList.add("top-3", "second-place");
        } else if (rank === 3) {
          playerElement.classList.add("top-3", "third-place");
        }
  
        // Ensure profile exists
        const profile = player.profile || {};
        
        const titleSpan = document.createElement("span");
        titleSpan.textContent = profile.title || "Novice";
        if (profile.titleColor) {
          titleSpan.style.color = profile.titleColor;
        }
  
        // Add medal for top 3
        let medalHTML = "";
        if (rank <= 3) {
          medalHTML = `<div class="place-medal">${rank}</div>`;
        }
  
        playerElement.innerHTML = `
          <div class="window-item-title">
            ${profile.name || "Anonymous"} 
            [${titleSpan.outerHTML}]
          </div>
          <div class="window-item-description">
            <div class="leaderboard-stats">
              <div class="leaderboard-stat">
                Level<br>${player.level || 1}
              </div>
              <div class="leaderboard-stat">
                Rank<br>${player.rank || "Novice"}
              </div>
              <div class="leaderboard-stat">
                XP<br>${player.exp || 0}
              </div>
              <div class="leaderboard-stat">
                Gold<br>${player.gold || 0}
              </div>
            </div>
          </div>
          ${medalHTML} <!-- Medal for top 3 -->
        `;
  
        leaderboardList.appendChild(playerElement);
        rank++; // Increment rank for the next player
      });
    } catch (error) {
      console.error("Error updating leaderboard window:", error);
    }
  },
  
  async updateNotificationsWindow() {
    if (!currentUser) return;
    try {
      const notificationsRef = db.collection("notifications")
        .where("userId", "==", currentUser.uid)
        .orderBy("createdAt", "desc");
      
      const snapshot = await notificationsRef.get();
      const notificationsList = document.getElementById("notificationsList");
      notificationsList.innerHTML = "";

      // Add notification management buttons
      const headerDiv = document.createElement("div");
      headerDiv.className = "notifications-header";
      headerDiv.innerHTML = `
        <div class="notifications-actions">
          <button class="notification-action-button" onclick="windowSystem.markAllNotificationsAsRead()">
            <i class="fas fa-check-double"></i> Read All
          </button>
          <button class="notification-action-button delete" onclick="windowSystem.deleteAllNotifications()">
            <i class="fas fa-trash"></i> Delete All
          </button>
        </div>
      `;
      notificationsList.appendChild(headerDiv);

      if (snapshot.empty) {
        notificationsList.innerHTML += '<div class="window-item">No notifications</div>';
        return;
      }

      snapshot.forEach((doc) => {
        const notification = doc.data();
        const notificationElement = document.createElement("div");
        notificationElement.className = `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`;
        notificationElement.dataset.notificationId = doc.id;
        
        // Make the element look clickable for unread notifications
        if (!notification.read) {
          notificationElement.style.cursor = "pointer";
        }

        const timestamp = notification.createdAt.toDate();
        const timeString = timestamp.toLocaleString();

        notificationElement.innerHTML = `
          <div class="notification-content">
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${timeString}</div>
          </div>
        `;

        // Add click event listener to mark notification as read
        if (!notification.read) {
          notificationElement.addEventListener("click", () => {
            this.markNotificationAsRead(doc.id);
          });
        }

        notificationsList.appendChild(notificationElement);
      });

      // Update the notification badge
      const unreadCount = (await notificationsRef.where("read", "==", false).get()).size;
      this.updateNotificationBadge(unreadCount);
      
    } catch (error) {
      console.error("Error updating notifications window:", error);
    }
  },

  async markNotificationAsRead(notificationId) {
    try {
      // Find the notification element and add the animation class
      const notificationElement = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
      if (notificationElement && notificationElement.classList.contains('unread')) {
        notificationElement.classList.add('marking-read');
        
        // Let the animation play before updating the class
        setTimeout(() => {
          notificationElement.classList.remove('unread', 'marking-read');
          notificationElement.classList.add('read');
        }, 600);
      }
      
      // Update in the database
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

  async updateStatsWindow() {
    try {
      // Import ActivityTracker and StatsVisualizer
      const { ActivityTracker, StatsVisualizer } = await import('./activityTracker.js');
      
      // Load activities if they haven't been loaded yet
      if (ActivityTracker.activities.length === 0) {
        await ActivityTracker.loadActivities();
      }
      
      // Check if Chart.js is loaded
      if (typeof Chart === 'undefined') {
        // Load Chart.js if it's not already loaded
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // Wait a moment to ensure Chart.js is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if canvas elements exist before trying to create charts
      if (document.getElementById('completionChart') && 
          document.getElementById('progressChart') && 
          document.getElementById('activityChart')) {
        
        // Safely create charts with error handling for each
        try {
          StatsVisualizer.createCompletionRateChart();
        } catch (chartError) {
          console.warn('Error creating completion chart:', chartError);
        }
        
        try {
          StatsVisualizer.createProgressByDayChart();
        } catch (chartError) {
          console.warn('Error creating progress chart:', chartError);
        }
        
        try {
          StatsVisualizer.createActivityBreakdownChart();
        } catch (chartError) {
          console.warn('Error creating activity chart:', chartError);
        }
      } else {
        console.warn('One or more chart canvas elements not found');
      }
      
      // Update window title to include data range
      const windowTitle = document.querySelector('#statsWindow .window-header span');
      if (windowTitle) {
        windowTitle.textContent = 'User Activity Statistics';
      }
    } catch (error) {
      console.error("Error updating stats window:", error);
    }
  },
};

// Initialize window system
document.addEventListener("DOMContentLoaded", () => {
  windowSystem.init();
});



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


// Set Name
window.showSetNamePrompt = async function showSetNamePrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const hasToken = await hasItem("name_change_token");
  if (!hasToken) {
    printToTerminal("You need a Name Change Token from the shop to change your name!", "warning");
    return;
  }

  // Set content for the window
  const setNameContent = document.getElementById("setNameContent");
  setNameContent.innerHTML = `
    <div class="window-section">
      <div class="window-item">
        <input type="text" id="nameInput" class="modal-input" placeholder="Enter your new name" maxlength="20">
      </div>
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
      if (await useItem("name_change_token")) {
        await setPlayerName([nameInput]);
        printToTerminal("Name changed successfully!", "success");
        showNotification("Name updated!");
        windowSystem.updateWindowContent("profileWindow");
        windowSystem.closeWindow("setNameWindow");
      } else {
        printToTerminal("Failed to use Name Change Token", "error");
      }
    } else {
      printToTerminal("Name cannot be empty!", "warning");
    }
  });

  document.getElementById("setNameCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setNameWindow");
  });

  // Show the window
  windowSystem.showWindow("setNameWindow");
}

async function setPlayerName(args) {
  if (!args || args.length === 0) {
    printToTerminal("Please provide a name: !setname <name>", "warning");
    return;
  }

  const name = args.join(" ").trim();
  if (name.length > 20) {
    printToTerminal("Name must be 20 characters or less!", "warning");
    return;
  }

    const playerRef = db.collection("players").doc(currentUser.uid);
  await playerRef.update({
    "profile.name": name
  });
  playerStats.profile.name = name;
  updateTerminalPrompt();
  updateStatusBar();
}

// Check if player has required item
async function hasItem(itemId) {
  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  const inventory = playerDoc.data().inventory || [];
  return inventory.some(item => item.id === itemId && !item.used);
}

// Set Title
window.showSetTitlePrompt = async function showSetTitlePrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const hasToken = await hasItem("title_change_token");
  if (!hasToken) {
    printToTerminal("You need a Title Change Token from the shop to change your title!", "warning");
    return;
  }

  // Set content for the window
  const setTitleContent = document.getElementById("setTitleContent");
  setTitleContent.innerHTML = `
    <div class="window-section">
      <div class="window-item">
        <input type="text" id="titleInput" class="modal-input" placeholder="Enter your new title" maxlength="30">
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
      if (await useItem("title_change_token")) {
        await setPlayerTitle([titleInput]);
        printToTerminal("Title changed successfully!", "success");
        showNotification("Title updated!");
        windowSystem.updateWindowContent("profileWindow");
        windowSystem.closeWindow("setTitleWindow");
      } else {
        printToTerminal("Failed to use Title Change Token", "error");
      }
    } else {
      printToTerminal("Title cannot be empty!", "warning");
    }
  });

  document.getElementById("setTitleCancel").addEventListener("click", () => {
    windowSystem.closeWindow("setTitleWindow");
  });

  // Show the window
  windowSystem.showWindow("setTitleWindow");
}

async function setPlayerTitle(args) {
  if (!args || args.length === 0) {
    printToTerminal("Please provide a title: !settitle <title>", "warning");
    return;
  }

  const title = args.join(" ").trim();
  if (title.length > 30) {
    printToTerminal("Title must be 30 characters or less!", "warning");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  await playerRef.update({
    "profile.title": title
  });
  playerStats.profile.title = title;
  updateTerminalPrompt();
  updateStatusBar();
}

const AVAILABLE_CLASSES = [
  "Hunter",
  "Warrior",
  "Mage",
  "Assassin",
  "Tank",
  "Healer"
];

function showModal(title, content, onSubmit) {
  const modal = document.getElementById("profileEditModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const submitBtn = document.getElementById("modalSubmit");
  const cancelBtn = document.getElementById("modalCancel");
  const closeBtn = document.querySelector(".modal-close");

  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modal.style.display = "block";

  const closeModal = () => {
    modal.style.display = "none";
  };

  submitBtn.onclick = () => {
    onSubmit();
    closeModal();
  };
  cancelBtn.onclick = closeModal;
  closeBtn.onclick = closeModal;
}

// Set Class
window.showSetClassPrompt = function showSetClassPrompt() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const options = AVAILABLE_CLASSES.map(cls => 
    `<option value="${cls}">${cls}</option>`
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
}

async function setPlayerClass(args) {
  if (!args || args.length === 0) {
    printToTerminal("Please provide a class: !setclass <class>", "warning");
    return;
  }

  const playerClass = args[0];
  if (!AVAILABLE_CLASSES.includes(playerClass)) {
    printToTerminal(`Invalid class. Available classes: ${AVAILABLE_CLASSES.join(", ")}`, "warning");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  await playerRef.update({
    "profile.class": playerClass
  });
  playerStats.profile.class = playerClass;
  updateStatusBar();
}

// Set Bio
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
        <textarea id="bioInput" class="modal-input" placeholder="Enter your bio" maxlength="200"></textarea>
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
}

async function setPlayerBio(args) {
  const bio = args.join(" ").trim();
  if (bio.length > 200) {
    printToTerminal("Bio must be 200 characters or less!", "warning");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  await playerRef.update({
    "profile.bio": bio
  });
  playerStats.profile.bio = bio;
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

// Helper function for rank comparison
function isRankSufficient(currentRank, requiredRank) {
  const rankOrder = ["E", "D", "C", "B", "A", "S"];
  return rankOrder.indexOf(currentRank) >= rankOrder.indexOf(requiredRank);
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
// Use item from inventory
async function useItem(itemId) {
  if (!isAuthenticated || !currentUser) {
    printToTerminal("You must be logged in to use items!", "error");
    return false;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  
  if (!playerDoc.exists) {
    printToTerminal("Player data not found", "error");
    return false;
  }
  
  const inventory = playerDoc.data().inventory || [];
  const itemIndex = inventory.findIndex(item => item.id === itemId && !item.used);
  
  if (itemIndex === -1) {
    printToTerminal("Item not found or already used", "error");
    return false;
  }

  try {
    // Use the more complete implementation from useInventoryItem
    await useInventoryItem(itemId, itemIndex);
    return true;
  } catch (error) {
    console.error("Error using item:", error);
    printToTerminal(error.message || "Failed to use item!", "error");
    return false;
  }
}

// Modify the updateInventoryWindow to add "Use" buttons for usable items
async function updateInventoryWindow() {
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

    player.inventory.forEach((inventoryItem) => {
      const item = Object.values(ITEMS).find(
        (item) => item.id === inventoryItem.id
      );
      if (item) {
        const itemElement = document.createElement("div");
        itemElement.className = "window-item";

        const isExpired =
          inventoryItem.expiresAt && inventoryItem.expiresAt <= Date.now();
        const timeLeft = inventoryItem.expiresAt
          ? Math.max(0, inventoryItem.expiresAt - Date.now())
          : null;

        if (isExpired) {
          itemElement.classList.add("expired-item");
        }

        // Check if item is usable
        const isUsable =
          item.effect &&
          (item.effect.type === "name_color" ||
            item.effect.type === "gold" ||
            item.effect.type === "complete_quest" ||
            item.effect.type === "reset_daily" ||
            item.effect.type === "remove_fatigue" ||
            item.effect.type === "title" ||
            item.effect.type === "title_color");

        itemElement.innerHTML = `
            <div class="window-item-title">${item.name}</div>
            <div class="window-item-description">${item.description}</div>
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
            <div class="window-actions">
              ${
                isExpired
                  ? `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                   <button onclick="sellItem('${
                     item.id
                   }')" class="window-button">Sell</button>`
                  : isUsable
                  ? `<button onclick="useItem('${item.id}')" class="window-button">Use</button>`
                  : `<div class="window-item-price">Sell price: ${calculateSellPrice(
                      item
                    )} gold</div>
                     <button onclick="sellItem('${
                       item.id
                     }')" class="window-button">Sell</button>`
              }
            </div>
          `;
        inventoryList.appendChild(itemElement);
      }
    });
  } catch (error) {
    console.error("Error updating inventory window:", error);
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
        <input type="color" id="colorPicker" value="#00ffff">
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
window.RANKS = RANKS; // Make it globally accessible

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
window.RANK_REQUIREMENTS = RANK_REQUIREMENTS; // Make it globally accessible

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

  const penaltyAmount = args.length > 0 ? parseInt(args[0], 10) : 100; // Default to 100 if no amount specified
  if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
    printToTerminal("Please provide a valid penalty amount (e.g., !penalty 100)", "warning");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);

  try {
    await db.runTransaction(async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists) {
        printToTerminal("Player data not found.", "error");
        return;
      }

      const player = playerDoc.data();
      const currentLevel = player.level || 1;
      const currentExp = player.exp || 0;

      // Calculate new XP and level after penalty
      const result = calculateExpAfterPenalty(currentLevel, currentExp, penaltyAmount);

      // Update database
      transaction.update(playerRef, {
        level: result.newLevel,
        exp: result.newExp
      });

      // Update local stats
      playerStats.level = result.newLevel;
      playerStats.exp = result.newExp;

      // Notify user
      printToTerminal(`Penalty applied: -${penaltyAmount} XP`, "error");
      if (result.levelsLost > 0) {
        printToTerminal(
          `You lost ${result.levelsLost} level(s). Now at Level ${result.newLevel} with ${result.newExp} XP.`,
          "error"
        );
        showNotification(
          `You lost ${result.levelsLost} level(s) due to penalty. Now Level ${result.newLevel}.`,
          "error"
        );
        audioSystem.playVoiceLine('PENALTY');
      } else {
        printToTerminal(`No levels lost. Now at ${result.newExp} XP.`, "info");
      }

      // Update UI
      updateStatusBar();
    });
  } catch (error) {
    console.error("Error applying penalty:", error);
    printToTerminal("Error applying penalty: " + error.message, "error");
  }
}
commands["!penalty"] = handlePenaltyCommand; 

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
  },
  
  // Add playSound method for compatibility
  playSound(soundName) {
    try {
      const audio = new Audio(`sounds/${soundName}.mp3`);
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.log(`Error playing sound ${soundName}:`, error);
      });
    } catch (error) {
      console.log(`Error creating audio for ${soundName}:`, error);
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

// Add function to check rank progress
function checkRankProgress(player) {
  const currentRank = player.rank || "E";
  const nextRank = RANKS[RANKS.indexOf(currentRank) + 1];

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

  // Get requirements for next rank
  const nextRankReqs = RANK_REQUIREMENTS[nextRank];

  // Count achievements with rank > 0
  let completedAchievementsCount = 0;
  if (player.achievements && typeof player.achievements === 'object') {
    completedAchievementsCount = Object.values(player.achievements)
      .filter(achievement => achievement && achievement.currentRank > 0)
      .length;
  }

  // Calculate progress percentages
  const levelProgress = Math.min(
    100,
    ((player.level || 1) / nextRankReqs.level) * 100
  );
  const questProgress = Math.min(
    100,
    ((player.questsCompleted || 0) / nextRankReqs.quests) * 100
  );
  const achievementProgress = Math.min(
    100,
    (completedAchievementsCount / nextRankReqs.achievements) * 100
  );
  const overallProgress = Math.min(
    100,
    (levelProgress + questProgress + achievementProgress) / 3
  );

  return {
    currentRank,
    nextRank,
    progress: {
      level: Math.round(levelProgress),
      quests: Math.round(questProgress),
      achievements: Math.round(achievementProgress),
      overall: Math.round(overallProgress),
    },
    requirements: nextRankReqs,
    currentValues: {
      level: player.level || 1,
      questsCompleted: player.questsCompleted || 0,
      achievements: completedAchievementsCount,
    },
  };
}

// Add function to show rank progress window
async function showRankProgress() {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  try {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const player = (await playerRef.get()).data();
    const rankProgress = checkRankProgress(player);

    const rankProgressContent = document.getElementById("rankProgressContent");
    rankProgressContent.innerHTML = `
      <div class="window-section">
        ${
          rankProgress.nextRank
            ? `
            <div class="rank-info">
              <div class="current-rank">
                <div class="rank-circle">${rankProgress.currentRank}</div>
                <div class="rank-label">Current Rank</div>
              </div>
              <div class="rank-arrow">→</div>
              <div class="next-rank">
                <div class="rank-circle next">${rankProgress.nextRank}</div>
                <div class="rank-label">Next Rank</div>
              </div>
            </div>

            <div class="requirements-section">
              <div class="requirement-item ${rankProgress.currentValues.level >= rankProgress.requirements.level ? 'met' : ''}">
                <div class="requirement-header">
                  <span class="requirement-title">Level</span>
                  <span class="requirement-value">${rankProgress.currentValues.level}/${rankProgress.requirements.level}
                  ${rankProgress.currentValues.level >= rankProgress.requirements.level ? ' ✓' : ''}
                  </span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.level}%"></div>
              </div>
            </div>

              <div class="requirement-item ${rankProgress.currentValues.questsCompleted >= rankProgress.requirements.quests ? 'met' : ''}">
                <div class="requirement-header">
                  <span class="requirement-title">Quests Completed</span>
                  <span class="requirement-value">${rankProgress.currentValues.questsCompleted}/${rankProgress.requirements.quests}
                  ${rankProgress.currentValues.questsCompleted >= rankProgress.requirements.quests ? ' ✓' : ''}
                  </span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.quests}%"></div>
              </div>
            </div>

              <div class="requirement-item ${rankProgress.currentValues.achievements >= rankProgress.requirements.achievements ? 'met' : ''}">
                <div class="requirement-header">
                  <span class="requirement-title">Achievements</span>
                  <span class="requirement-value">${rankProgress.currentValues.achievements}/${rankProgress.requirements.achievements}
                  ${rankProgress.currentValues.achievements >= rankProgress.requirements.achievements ? ' ✓' : ''}
                  </span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.achievements}%"></div>
              </div>
            </div>

              <div class="requirement-item overall ${
                rankProgress.currentValues.level >= rankProgress.requirements.level &&
                rankProgress.currentValues.questsCompleted >= rankProgress.requirements.quests &&
                rankProgress.currentValues.achievements >= rankProgress.requirements.achievements ? 'met' : ''
              }">
                <div class="requirement-header">
                  <span class="requirement-title">Overall Progress</span>
                  <span class="requirement-value">${rankProgress.progress.overall}%</span>
              </div>
              <div class="window-item-progress">
                  <div class="window-item-progress-bar" style="width: ${rankProgress.progress.overall}%"></div>
              </div>
            </div>
            
            <div class="rank-up-message ${
              rankProgress.currentValues.level >= rankProgress.requirements.level &&
              rankProgress.currentValues.questsCompleted >= rankProgress.requirements.quests &&
              rankProgress.currentValues.achievements >= rankProgress.requirements.achievements ? 'ready' : 'not-ready'
            }">
              ${
                rankProgress.currentValues.level >= rankProgress.requirements.level &&
                rankProgress.currentValues.questsCompleted >= rankProgress.requirements.quests &&
                rankProgress.currentValues.achievements >= rankProgress.requirements.achievements
                ? "You've met all requirements! Updating your rank now..."
                : "Complete all requirements to rank up!"
              }
            </div>
          </div>
        `
            : `
            <div class="max-rank-message">
              <div class="rank-circle max">${rankProgress.currentRank}</div>
              <div class="max-rank-text">
              Congratulations! You have reached the maximum rank!
            </div>
          </div>
        `
        }
      </div>
    `;

    // Show the window using the window system
    windowSystem.showWindow("rankProgressWindow");
    
    // If all requirements are met, automatically update rank
    if (rankProgress.nextRank && 
        rankProgress.currentValues.level >= rankProgress.requirements.level &&
        rankProgress.currentValues.questsCompleted >= rankProgress.requirements.quests &&
        rankProgress.currentValues.achievements >= rankProgress.requirements.achievements) {
      await checkAndUpdateRank(playerRef, player);
    }
  } catch (error) {
    console.error("Error showing rank progress:", error);
    printToTerminal("Error showing rank progress: " + error.message, "error");
  }
}

async function checkAndUpdateRank(playerRef, player) {
  const rankRequirements = RANK_REQUIREMENTS[player.rank] || { nextRank: null };
  
  if (!rankRequirements.nextRank) {
    return false; // Already at highest rank
  }
  
  const levelReq = rankRequirements.level || 0;
  const questsReq = rankRequirements.questsCompleted || 0;
  const achievementsReq = rankRequirements.achievements || 0;
  
  // Check if all requirements are met
  const levelMet = player.level >= levelReq;
  const questsMet = player.questsCompleted >= questsReq;
  const achievementsMet = player.achievements?.length >= achievementsReq;
  
  if (levelMet && questsMet && achievementsMet) {
    // Update rank
    const oldRank = player.rank;
    const newRank = rankRequirements.nextRank;
    
    await playerRef.update({
      rank: newRank,
      // Add other rewards here if needed
      gold: firebase.firestore.FieldValue.increment(rankRequirements.goldReward || 500)
    });
    
    // Update local player stats
    playerStats.rank = newRank;
    playerStats.gold += (rankRequirements.goldReward || 500);
    
    // Show notification
    printToTerminal(`Congratulations! You've been promoted to ${newRank}!`, "success");
    showNotification(`Rank Up! You are now a ${newRank}!`);
    
    // Play rank up sound
    handleRankUp();
    
    // Update relevant UI windows to reflect the new rank
    updateStatusBar();
    windowSystem.updateWindowContent("profileWindow");
    
    // Update rank progress window to show current progress toward next rank
    updateRankProgressWindow();
    
    // Also update the rank progress window UI
    if (windowSystem.windows.rankProgressWindow && 
        windowSystem.windows.rankProgressWindow.classList.contains("show")) {
      await showRankProgress();
    }
    
    return true;
  }
  
  return false;
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
        rankProgress.requirements.quests
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
    
    // Display a message about what still needs to be completed
    const missingRequirements = [];
    if (rankProgress.currentValues.level < rankProgress.requirements.level) {
      missingRequirements.push(`Level: need ${rankProgress.requirements.level - rankProgress.currentValues.level} more levels`);
    }
    if (rankProgress.currentValues.questsCompleted < rankProgress.requirements.quests) {
      missingRequirements.push(`Quests: need ${rankProgress.requirements.quests - rankProgress.currentValues.questsCompleted} more quests`);
    }
    if (rankProgress.currentValues.achievements < rankProgress.requirements.achievements) {
      missingRequirements.push(`Achievements: need ${rankProgress.requirements.achievements - rankProgress.currentValues.achievements} more achievements`);
    }
    
    if (missingRequirements.length > 0) {
      printToTerminal("\nTo rank up, you still need:", "info");
      missingRequirements.forEach(req => printToTerminal(`- ${req}`, "info"));
    } else {
      printToTerminal("\nYou've met all requirements! Use !rankprogress to advance your rank.", "success");
    }
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
    await db.runTransaction(async (transaction) => {
      const battleRef = playerRef.collection("activeBattles").doc(bossId);
      const playerDoc = await transaction.get(playerRef);
      const battleDoc = await transaction.get(battleRef);

      const battle = battleDoc.data();
      if (battle.penaltyApplied) {
        printToTerminal("Penalties have already been applied for this battle.", "warning");
        return;
      }

      const now = new Date();
      const endTime = battle.endTime?.toDate();
      if (!endTime || now < endTime) {
        return; // Battle hasn't timed out yet
      }

      // Create timeout notification
      const timeoutTime = new Date();
      await db.collection('notifications').add({
        userId: auth.currentUser.uid,
        title: "Boss Battle Failed",
        message: `Your battle against ${battle.bossName} has timed out. Better luck next time!`,
        type: "defeat",
        timestamp: firebase.firestore.Timestamp.fromDate(timeoutTime),
        read: false
      });
      
      // Update notification badge
      const count = await windowSystem.getUnreadNotificationsCount();
      windowSystem.updateNotificationBadge(count);

      const player = playerDoc.data();
      const currentLevel = player.level || 1;
      const currentExp = player.exp || 0;
      const penaltyExp = Math.abs(BOSS_PENALTIES.exp);
      const updatedGold = Math.max(player.gold + BOSS_PENALTIES.gold, 0);

      const result = calculateExpAfterPenalty(currentLevel, currentExp, penaltyExp);

      // Update without preconditions
      transaction.update(playerRef, {
        level: result.newLevel,
        exp: result.newExp,
        gold: updatedGold
      });

      transaction.update(battleRef, { penaltyApplied: true });
      transaction.delete(battleRef);

      // Update local stats
      playerStats.level = result.newLevel;
      playerStats.exp = result.newExp;
      playerStats.gold = updatedGold;

      const bossName = battle.bossName || (BOSSES[bossId] ? BOSSES[bossId].name : "Unknown Boss");

      printToTerminal(`\n⚠️ Boss Battle Failed: ${bossName}`, "error");
      printToTerminal("Time's up! You've suffered penalties:", "error");
      printToTerminal(`${BOSS_PENALTIES.exp} XP`, "error");
      printToTerminal(`${BOSS_PENALTIES.gold} Gold`, "error");
      if (result.levelsLost > 0) {
        printToTerminal(
          `You lost ${result.levelsLost} level(s). Now at Level ${result.newLevel} with ${result.newExp} XP.`,
          "error"
        );
        showNotification(
          `You lost ${result.levelsLost} level(s) due to battle timeout. Now Level ${result.newLevel}.`,
          "error"
        );
        audioSystem.playVoiceLine('PENALTY');
      } else {
        printToTerminal(`No levels lost. Now at ${result.newExp} XP.`, "info");
      }

      updateStatusBar();
      windowSystem.updateWindowContent("BattleWindow");
    });
  } catch (error) {
    console.error("Error handling boss battle timeout:", error);
    printToTerminal("Error processing battle timeout: " + error.message, "error");
  }
}
window.handleBossBattleTimeout = handleBossBattleTimeout; // Make globally available if needed

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

      this.speechRecognition.onend = () => {
        if (this.listening) {
          this.speechRecognition.start();
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
    }

    this.addMessage('system', 'Awaiting your command, Player...');
    this.initialized = true;
    this.updateDebug('system', 'SOLO AI System initialized and ready');
  }

  startListening() {
    if (!this.initialized) {
      this.initialize();
      return;
    }
    if (this.speechRecognition) {
      this.listening = true;
      this.speechRecognition.start();
      this.updateListeningUI(true);
    }
  }

  stopListening() {
    if (this.speechRecognition) {
      this.listening = false;
      this.speechRecognition.stop();
      this.updateListeningUI(false);
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

  async handleUserInput(text) {
    if (this.processing) return;
  
    this.addMessage('user', text);
    this.updateProcessingUI(true);
  
    try {
      let response;
      const lowerText = text.toLowerCase();
  
      if (lowerText.includes('complete daily quest') || lowerText.includes('complete quest')) {
        if (!auth.currentUser) {
          response = "You must authenticate first with !reawaken.";
          this.addMessage('ai', response);
          this.updateProcessingUI(false);
          return;
        }
  
        const questType = lowerText.includes('daily') ? 'daily' : 'normal';
        const questTitle = text.replace(/complete\s+(daily\s+)?quest\s+/i, '').trim();
  
        console.log(`Quest completion requested - Type: ${questType}, Title: "${questTitle}"`);
  
        if (!questTitle) {
          response = `Please specify which ${questType} quest to complete.`;
        } else {
          console.log(`Calling window.completeQuest("${questTitle}", "${questType}")`);
          const result = await window.completeQuest(questTitle, questType);
  
          if (result.success) {
            response = `${questType.charAt(0).toUpperCase() + questType.slice(1)} quest "${result.title}" completed! Received ${result.expGained} XP and ${result.goldGained} gold.`;
            if (questType === 'daily') {
              await new Promise(resolve => setTimeout(resolve, 500));
              windowSystem.updateDailyQuestsWindow();
            } else {
              removeQuestFromUI(result.questId, 'normal');
              if (windowSystem.windows.questsWindow && 
                  windowSystem.windows.questsWindow.classList.contains("show")) {
                windowSystem.updateWindowContent("questsWindow");
                window.fetchNormalQuests();
              }
            }
            updateStatusBar();
          } else {
            response = `Failed to complete ${questType} quest "${questTitle}": ${result.error}`;
          }
        }
      } else {
        response = await this.callDeepSeekAPI(text);
      }
  
      this.addMessage('ai', response);
      await this.speakResponse(response);
    } catch (error) {
      console.error('Error in handleUserInput:', error);
      this.addMessage('ai', "Sorry, I encountered an error: " + error.message);
    } finally {
      this.updateProcessingUI(false);
    }
  }

  parseAIQuestResponse(response) {
    const technicalMatch = response.match(/\*\*(.*?)\*\*/);
    if (technicalMatch) {
      const technicalContent = technicalMatch[1];
      const match = technicalContent.match(/type:\s*(daily|quest),\s*title:\s*(.+?),\s*count:\s*(\d+),\s*metric:\s*(\w+),\s*description:\s*(.+?)(?:\.\s*|$)/i);
      if (match) {
        return {
          type: match[1].trim() === 'quest' ? 'normal' : match[1].trim(),
          title: match[2].trim(),
          count: parseInt(match[3], 10),
          metric: match[4].trim(),
          description: match[5].trim()
        };
      }
    }
    return null;
  }

  async callDeepSeekAPI(text) {
    const conversationHistory = this.formatConversationForDeepSeek();
    conversationHistory.push({ role: 'user', content: text });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        messages: conversationHistory,
        max_tokens: 250,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const result = await response.json();
    return result.choices[0].message.content.trim();
  }

  formatConversationForDeepSeek() {
    const formattedConversation = [{
      role: 'system',
      content: `You are SOLO, an AI assistant for a fitness app inspired by Solo Leveling. You can control the app by:
        - Creating quests: Respond with "**type: [daily/quest], title: [epic title], count: [count], metric: [short metric], description: [short thematic description]**"
        - Completing quests: Respond with "**type: [daily/quest], questId: [provided id or 'lookup']**"
        Keep responses concise and use technical blocks for parsing.`
    }];
    const recentConversation = this.conversation.slice(-10);
    for (const msg of recentConversation) {
      formattedConversation.push({ 
        role: msg.type === 'user' ? 'user' : 'assistant', 
        content: msg.text 
      });
    }
    return formattedConversation;
  }

  async speakResponse(text) {
    try {
      const tokenResponse = await fetch(`https://eastus.api.cognitive.microsoft.com/sts/v1.0/issuetoken`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': "FANcfK9JLli9bfNboMTIVRIhY3a6BJJf1ifjGP4gUwylRN00Bez0JQQJ99BCACYeBjFXJ3w3AAAYACOG4YgF"
        }
      });
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

      await audio.play();
      return true;
    } catch (error) {
      console.error('Speech synthesis error:', error);
      return false;
    }
  }

  addMessage(type, text) {
    if (this.conversation.length > 0 && this.conversation[this.conversation.length - 1].text === text) {
      return;
    }
    this.conversation.push({ type, text });
    const messageElement = document.createElement('div');
    messageElement.style.marginBottom = '10px';
    messageElement.innerHTML = `<strong>${type === 'user' ? 'You' : 'AI'}:</strong> ${text}`;
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
window.startBossBattle = startBossBattle;
window.showInventory = showInventory;
window.showShop = showShop;
window.showAchievements = showAchievements;
window.showRankProgress = showRankProgress;


document.addEventListener('DOMContentLoaded', async () => {
  const soloAISystem = new SoloAISystem();
  
  // Add notification badge update on page load
  try {
    // Wait a short time to ensure windowSystem is fully initialized
    setTimeout(async () => {
      if (window.windowSystem) {
        const unreadCount = await window.windowSystem.getUnreadNotificationsCount();
        window.windowSystem.updateNotificationBadge(unreadCount);
      }
    }, 1000);
  } catch (error) {
    console.error("Error updating notification badge on load:", error);
  }
});




async function initializePlayer(uid) {
  try {
    if (!uid) {
      console.log("No UID provided for player initialization");
      return null;
    }

    const playerRef = db.collection("players").doc(uid);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      // Only create a new player if explicitly needed (e.g., first login)
      // For now, we'll just log this and return null
      console.log("Player document does not exist for UID:", uid);
      printToTerminal("No player profile found. Please authenticate first.", "warning");
      return null;
    }

    // Load existing player data
    const playerData = playerDoc.data();
    playerStats = {
      ...playerData,
      exp: playerData.exp || 0,
      level: playerData.level || 1,
      gold: playerData.gold || 0,
      energy: playerData.energy || 100,
      achievements: playerData.achievements || {},
      questsCompleted: playerData.questsCompleted || 0,
      battlesWon: playerData.battlesWon || 0,
      battlesLost: playerData.battlesLost || 0,
      streak: playerData.streak || 0,
      waterIntake: playerData.waterIntake || { today: 0, lastUpdated: new Date(0) },
      inventory: playerData.inventory || [],
      profile: playerData.profile || {
        name: currentUser.displayName || "Player",
        title: "Novice",
        picture: "default.png",
        bio: "",
        class: "Hunter",
        joinDate: playerData.createdAt || new Date()
      }
    };

    console.log("Player loaded:", playerStats);

    // Reset daily water intake if it's a new day
    const lastUpdated = playerStats.waterIntake?.lastUpdated?.toDate() || new Date(0);
    if (!wasCompletedToday(lastUpdated)) {
      await playerRef.update({
        "waterIntake.today": 0,
        "waterIntake.lastUpdated": firebase.firestore.FieldValue.serverTimestamp()
      });
      playerStats.waterIntake = {
        ...playerStats.waterIntake,
        today: 0,
        lastUpdated: new Date()
      };
    }

    // Welcome message
    printToTerminal(`Welcome back, ${playerStats.profile?.name || playerStats.name}!`, "system");

    // Set up daily quests if they don't exist
    await setupDailyQuests();

    // Check and update achievements
    await checkAchievements();

    // Update UI elements
    updateStatusBar();
    updateTerminalPrompt();

    // Show any pending notifications
    await loadNotifications();

    // Initialize timers
    initializeTimers();

    return playerStats;

  } catch (error) {
    console.error("Error initializing player:", error);
    printToTerminal("Error initializing player: " + error.message, "error");
    return null;
  }
}
async function loadNotifications() {
  try {
    if (!currentUser) return;
    
    const notificationsRef = db.collection("notifications")
      .where("userId", "==", currentUser.uid)
      .where("read", "==", false)
      .orderBy("createdAt", "desc")    
    try {
      const snapshot = await notificationsRef.get();
      
      snapshot.forEach(doc => {
        const notification = doc.data();
        showNotification(`${notification.title}: ${notification.message}`);
      });
      
      if (window.windowSystem) {
        const unreadCount = snapshot.size;
        window.windowSystem.updateNotificationBadge(unreadCount);
      }
    } catch (indexError) {
      if (indexError.code === 'failed-precondition') {
        console.warn("Notification index not yet created. Falling back to basic fetch.");
        const basicNotifications = await db.collection("notifications")
          .where("userId", "==", currentUser.uid)
          .where("read", "==", false)
          .limit(10)
          .get();
          
        basicNotifications.forEach(doc => {
          const notification = doc.data();
          showNotification(`${notification.title}: ${notification.message}`);
        });
      } else {
        throw indexError;
      }
    }
  } catch (error) {
    console.error("Error loading notifications:", error);
    printToTerminal("Error loading notifications: " + error.message, "error");
  }
}

window.handleWaterIntake = async function handleWaterIntake(amount) {
  try {
    if (!currentUser) {
      printToTerminal("You must be logged in to track water intake.", "error");
      return;
    }

    const playerRef = db.collection("players").doc(currentUser.uid);
    
    // Convert amount to number and validate
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) {
      printToTerminal("Please enter a valid positive number for water intake.", "error");
      return;
    }
    
    // Update player's water intake
    await playerRef.update({
      "waterIntake.today": firebase.firestore.FieldValue.increment(amount),
      "waterIntake.lastUpdated": firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local player stats
    if (!playerStats.waterIntake) {
      playerStats.waterIntake = { today: 0 };
    }
    playerStats.waterIntake.today = (playerStats.waterIntake.today || 0) + amount;
    playerStats.waterIntake.lastUpdated = new Date();
    
    // Display message
    printToTerminal(`\n💧 You drank ${amount}ml of water!`, "success");
    
    // Award small bonuses for hydration
    const healthBonus = Math.min(5, Math.floor(amount / 100));
    const energyBonus = Math.min(3, Math.floor(amount / 200));
    
    if (healthBonus > 0 || energyBonus > 0) {
      await playerRef.update({
        health: firebase.firestore.FieldValue.increment(healthBonus),
        energy: firebase.firestore.FieldValue.increment(energyBonus)
      });
      
      // Update local player stats
      playerStats.health = Math.min(playerStats.maxHealth, playerStats.health + healthBonus);
      playerStats.energy = Math.min(playerStats.maxEnergy, playerStats.energy + energyBonus);
      
      printToTerminal("Hydration bonuses:", "info");
      if (healthBonus > 0) printToTerminal(`  - Health: +${healthBonus}`, "reward");
      if (energyBonus > 0) printToTerminal(`  - Energy: +${energyBonus}`, "reward");
    }
    
    // Check for achievements
    await checkAchievements();
    
    // Update UI
    updateStatusBar();
    updateWaterUI();
    
  } catch (error) {
    console.error("Water intake error:", error);
    printToTerminal("Error tracking water intake: " + error.message, "error");
  }
};

// Add setupDailyQuests function to set up daily quests
async function setupDailyQuests() {
  try {
    if (!currentUser) {
      console.log("User not authenticated. Cannot set up daily quests.");
      return;
    }

    const dailyQuestsRef = db.collection("players")
      .doc(currentUser.uid)
      .collection("dailyQuests");
    
    const existingQuests = await dailyQuestsRef.get();
    
    // If there are no daily quests or if it's a new day, set up new ones
    if (existingQuests.empty) {
      console.log("Setting up new daily quests...");
      
      // Generate 3 random daily quests
      const dailyQuestTemplates = [
        {
          id: "daily_run",
          title: "Run",
          targetCount: 10,
          currentCount: 0,
          metric: "km",
          description: "Run 10km everyday",
          type: "daily",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          completed: false,
          
        },
        {
          id: "daily_pushups",
          title: "Push-Ups",
          targetCount: 100,
          currentCount: 0,
          metric: "reps",
          description: "Do 100 push-ups every day",
          type: "daily",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          completed: false,
        },
        {
          id: "daily_squats",
          title: "Squats",
          targetCount: 100,
          currentCount: 0,
          metric: "reps",
          description: "Do 100 squats every day",
          type: "daily",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          completed: false,
        },
        {
          id: "daily_situps",
          title: "Sit-Ups",
          targetCount: 100,
          currentCount: 0,
          metric: "reps",
          description: "Do 100 sit-ups every day",
          type: "daily",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          completed: false,
        }
      ];
      
      // Add daily quests to the database
      const batch = db.batch();
      dailyQuestTemplates.forEach(quest => {
        const questRef = dailyQuestsRef.doc(quest.id);
        batch.set(questRef, {
          ...quest,
          lastCompletion: null
        });
      });
      
      await batch.commit();
      console.log("Daily quests set up successfully");
      
      // Update UI if the daily quests window is open
      if (windowSystem.windows["dailyQuestsWindow"]?.classList.contains("show")) {
        windowSystem.updateWindowContent("dailyQuestsWindow");
      }
    } else {
      // Check if daily quests need to be reset
      const resetNeeded = await checkDailyQuestReset();
      if (resetNeeded) {
        await resetDailyQuests();
      }
    }
  } catch (error) {
    console.error("Error setting up daily quests:", error);
  }
}


// Add function to check if daily quests need to be reset
async function checkDailyQuestReset() {
  try {
    if (!currentUser) return false;
    
    const playerRef = db.collection("players").doc(currentUser.uid);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) return false;
    
    const player = playerDoc.data();
    const lastDailyReset = player.lastDailyReset?.toDate() || new Date(0);
    
    // Check if it's a new day since the last reset
    return !wasCompletedToday(lastDailyReset);
  } catch (error) {
    console.error("Error checking daily quest reset:", error);
    return false;
  }
}

// Add function to reset daily quests
async function resetDailyQuests() {
  try {
    if (!currentUser) return;
    
    const dailyQuestsRef = db.collection("players")
      .doc(currentUser.uid)
      .collection("dailyQuests");
    
    const questDocs = await dailyQuestsRef.get();
    
    // Reset each daily quest
    const batch = db.batch();
    questDocs.forEach(doc => {
      batch.update(doc.ref, {
        currentCount: 0,
        completed: false,
        lastCompletion: null
      });
    });
    
    // Update the last daily reset timestamp
    const playerRef = db.collection("players").doc(currentUser.uid);
    batch.update(playerRef, {
      lastDailyReset: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    console.log("Daily quests reset successfully");
    
    // Update UI if window is open
    if (windowSystem.windows["dailyQuestsWindow"]?.classList.contains("show")) {
      windowSystem.updateWindowContent("dailyQuestsWindow");
    }
    
    // Notification
    printToTerminal("Daily quests have been reset for a new day!", "system");
    showNotification("Daily quests have been reset");
    handleDailyReset();
  } catch (error) {
    console.error("Error resetting daily quests:", error);
  }
}


// Activity Tracking System for SOLO System
// This module tracks user activities and provides methods for visualization

// ActivityTracker class
export const ActivityTracker = {
  activities: [],
  
  // Track an activity event (quest completion, level up, battle, etc.)
  trackActivity(type, value, timestamp = Date.now()) {
    if (!window.isAuthenticated || !window.currentUser) return;
    
    const activity = {
      type,
      value,
      timestamp,
      date: new Date(timestamp).toISOString().split('T')[0], // YYYY-MM-DD format
    };
    
    this.activities.push(activity);
    this.saveActivity(activity);
    
    return activity;
  },
  
  // Save activity to Firebase
  async saveActivity(activity) {
    try {
      const db = window.firebase.firestore();
      await db.collection("users").doc(window.currentUser.uid).collection("activities").add(activity);
      console.log(`Activity tracked: ${activity.type}`);
    } catch (error) {
      console.error("Error saving activity:", error);
    }
  },
  
  // Load activities from Firebase
  async loadActivities() {
    if (!window.isAuthenticated || !window.currentUser) return [];
    
    try {
      const db = window.firebase.firestore();
      const snapshot = await db.collection("users").doc(window.currentUser.uid)
        .collection("activities")
        .orderBy("timestamp", "desc")
        .limit(500) // Limit to last 500 activities for performance
        .get();
      
      this.activities = snapshot.docs.map(doc => doc.data());
      console.log(`Loaded ${this.activities.length} activities`);
      return this.activities;
    } catch (error) {
      console.error("Error loading activities:", error);
      return [];
    }
  },
  
  // Get activity data grouped by date for a specific type
  getActivityByDateForType(type, days = 7) {
    const today = new Date();
    const dateMap = {};
    
    // Initialize the last 'days' dates
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = 0;
    }
    
    // Count activities by date
    this.activities.forEach(activity => {
      if (activity.type === type && dateMap[activity.date] !== undefined) {
        dateMap[activity.date] += typeof activity.value === 'number' ? activity.value : 1;
      }
    });
    
    // Convert to arrays for Chart.js (sort dates in ascending order)
    const dates = Object.keys(dateMap).sort();
    const values = dates.map(date => dateMap[date]);
    
    return { dates, values };
  },
  
  // Get daily completion rate for quests
  getQuestCompletionRate(days = 7) {
    const completedByDay = this.getActivityByDateForType('quest_completed', days);
    const attemptedByDay = this.getActivityByDateForType('quest_attempted', days);
    
    // Calculate completion rates
    const rates = completedByDay.dates.map((date, index) => {
      const completed = completedByDay.values[index];
      const attempted = attemptedByDay.values[index] || 0;
      return attempted > 0 ? (completed / attempted) * 100 : 0;
    });
    
    return { dates: completedByDay.dates, rates };
  },
  
  // Get activity breakdown for the current day
  getActivityBreakdown() {
    const today = new Date().toISOString().split('T')[0];
    const activityCounts = {};
    
    this.activities.forEach(activity => {
      if (activity.date === today) {
        activityCounts[activity.type] = (activityCounts[activity.type] || 0) + 1;
      }
    });
    
    // Convert to arrays for Chart.js
    const types = Object.keys(activityCounts);
    const counts = types.map(type => activityCounts[type]);
    
    // Create friendly labels
    const labels = types.map(type => {
      const typeMap = {
        'quest_completed': 'Quests Completed',
        'quest_attempted': 'Quests Attempted',
        'level_up': 'Level Ups',
        'battle_won': 'Battles Won',
        'battle_lost': 'Battles Lost',
        'item_used': 'Items Used',
        'gold_earned': 'Gold Transactions',
        'exp_earned': 'XP Earned'
      };
      return typeMap[type] || type.replace('_', ' ');
    });
    
    return { labels, counts };
  },
  
  // Get progress stats (total count and average per day)
  getProgressStats(type, days = 30) {
    const { values } = this.getActivityByDateForType(type, days);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / days;
    
    return { total, average };
  }
};

// Visualization helper functions
export const StatsVisualizer = {
  // Create completion rate chart
  createCompletionRateChart() {
    try {
      const canvas = document.getElementById('completionChart');
      if (!canvas) {
        console.warn('Completion chart canvas not found');
        return;
      }
  
      // Reset canvas dimensions to prevent growth
      canvas.width = 500;  // Match the initial width
      canvas.height = 300; // Match the initial height
  
      const ctx = canvas.getContext('2d');
      const { dates, rates } = ActivityTracker.getQuestCompletionRate();
  
      // Format dates to be more readable
      const formattedDates = dates.map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
  
      // Check if Chart.js is loaded
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded');
        return;
      }
  
      // Destroy existing chart instance if it exists
      if (window.completionChart && typeof window.completionChart.destroy === 'function') {
        window.completionChart.destroy();
      }
  
      // Create new chart with explicit size maintenance
      window.completionChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: formattedDates,
          datasets: [{
            label: 'Completion Rate (%)',
            data: rates,
            backgroundColor: 'rgba(0, 168, 255, 0.2)',
            borderColor: 'rgba(0, 168, 255, 1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true, // Enforce aspect ratio
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: { color: 'rgba(255, 255, 255, 0.7)' }
            },
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: { color: 'rgba(255, 255, 255, 0.7)' }
            }
          },
          plugins: {
            legend: {
              labels: { color: 'rgba(255, 255, 255, 0.7)' }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating completion rate chart:', error);
    }
  },
  
  // Create progress by day chart
  createProgressByDayChart() {
    try {
      const canvas = document.getElementById('progressChart');
      if (!canvas) {
        console.warn('Progress chart canvas not found');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      const questData = ActivityTracker.getActivityByDateForType('quest_completed');
      const expData = ActivityTracker.getActivityByDateForType('exp_earned');
      
      // Format dates to be more readable
      const formattedDates = questData.dates.map(dateStr => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      
      // Check if Chart is defined
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded');
        return;
      }
      
      // Safely destroy existing chart if it exists
      if (window.progressChart && typeof window.progressChart.destroy === 'function') {
        window.progressChart.destroy();
      }
      
      window.progressChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: formattedDates,
          datasets: [
            {
              label: 'Quests Completed',
              data: questData.values,
              backgroundColor: 'rgba(0, 168, 255, 0.5)',
              borderColor: 'rgba(0, 168, 255, 1)',
              borderWidth: 1
            },
            {
              label: 'XP Gained (÷10)',
              data: expData.values.map(val => val / 10), // Scale down XP for better visualization
              backgroundColor: 'rgba(46, 213, 115, 0.5)',
              borderColor: 'rgba(46, 213, 115, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)'
              }
            },
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)'
              }
            }
          },
          plugins: {
            legend: {
              labels: {
                color: 'rgba(255, 255, 255, 0.7)'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating progress by day chart:', error);
    }
  },
  
  // Create activity breakdown chart
  createActivityBreakdownChart() {
    try {
      const canvas = document.getElementById('activityChart');
      if (!canvas) {
        console.warn('Activity chart canvas not found');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      const { labels, counts } = ActivityTracker.getActivityBreakdown();
      
      // Color palette for the pie chart
      const backgroundColors = [
        'rgba(0, 168, 255, 0.7)',
        'rgba(46, 213, 115, 0.7)',
        'rgba(255, 71, 87, 0.7)',
        'rgba(255, 159, 64, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(201, 203, 207, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(255, 205, 86, 0.7)'
      ];
      
      // Check if Chart is defined
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded');
        return;
      }
      
      // Safely destroy existing chart if it exists
      if (window.activityChart && typeof window.activityChart.destroy === 'function') {
        window.activityChart.destroy();
      }
      
      // If no data, create a placeholder
      const displayLabels = labels.length === 0 ? ['No Activity Today'] : labels;
      const displayCounts = labels.length === 0 ? [1] : counts;
      
      window.activityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: displayLabels,
          datasets: [{
            data: displayCounts,
            backgroundColor: backgroundColors.slice(0, displayLabels.length),
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: 'rgba(255, 255, 255, 0.7)',
                font: {
                  size: 11
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating activity breakdown chart:', error);
    }
  }
}; 