import { timerSystem, formatTimeRemaining, getEndOfDay } from './timerSystem.js';
import { printToTerminal } from './terminal.js';
import { playerStats } from './playerStats.js';
import { windowSystem } from './windowSystem.js';
import { showNotification } from './notifications.js';

let creatingQuest = false;
let questCreationState = {};

export function wasCompletedToday(lastCompletion) {
    if (!lastCompletion) return false;

    // Convert to Date object if it's a Firestore Timestamp
    const completionDate = lastCompletion instanceof Date 
        ? lastCompletion 
        : lastCompletion.toDate?.() || new Date(lastCompletion);

    const today = new Date();
    return (
        completionDate.getDate() === today.getDate() &&
        completionDate.getMonth() === today.getMonth() &&
        completionDate.getFullYear() === today.getFullYear()
    );
}

export async function updateDailyQuestTimers() {
    const centralTimer = document.getElementById("centralDailyTimer");
    if (!centralTimer) return;

    const endOfDay = getEndOfDay();
    const now = new Date();
    const remaining = endOfDay - now;

    if (remaining <= 0) {
        centralTimer.textContent = "Time's up!";
        // Handle daily reset
        handleDailyReset();
    } else {
        centralTimer.textContent = formatTimeRemaining(remaining);
        const progressBar = centralTimer.parentElement.querySelector(".timer-progress-bar");
        if (progressBar) {
            const progress = ((24 * 60 * 60 * 1000 - remaining) / (24 * 60 * 60 * 1000)) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }
}

export async function handleDailyReset() {
    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        
        // Reset daily quests
        const dailyQuestsRef = playerRef.collection("dailyQuests");
        const dailyQuests = await dailyQuestsRef.get();
        
        const batch = db.batch();
        dailyQuests.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Reset water intake
        await playerRef.update({
            "waterIntake.amount": 0,
            "waterIntake.lastReset": new Date()
        });
        
        // Update UI
        windowSystem.updateDailyQuestsWindow();
        showNotification("Daily reset complete!");
        printToTerminal("Daily quests and water intake have been reset.", "success");
        
        // Restart timers
        timerSystem.stopAllTimers();
        timerSystem.initializeTimers();
        
    } catch (error) {
        console.error("Error during daily reset:", error);
        printToTerminal("Error during daily reset: " + error.message, "error");
    }
}

export function startQuestCreation(type) {
    if (creatingQuest) {
        printToTerminal("Already creating a quest!", "error");
        return;
    }

    creatingQuest = true;
    questCreationState = {
        type,
        title: null,
        count: null,
        metric: null,
        description: null
    };

    if (type === "daily") {
        printToTerminal("Creating new daily quest", "info");
    } else {
        printToTerminal("Creating new quest", "info");
    }
    printToTerminal("Enter quest title (or press Enter to cancel):", "info");
}

export async function handleQuestCreation(value) {
    // Reset quest creation if no input is received
    if (!value) {
        if (questCreationState.timeout) {
            clearTimeout(questCreationState.timeout);
        }
        creatingQuest = false;
        questCreationState = {};
        printToTerminal("Quest creation cancelled.", "warning");
        return;
    }

    // Set or reset timeout for quest creation
    if (questCreationState.timeout) {
        clearTimeout(questCreationState.timeout);
    }
    questCreationState.timeout = setTimeout(() => {
        creatingQuest = false;
        questCreationState = {};
        printToTerminal("Quest creation timed out.", "warning");
    }, 30000); // 30 seconds timeout

    try {
        if (!questCreationState.title) {
            questCreationState.title = value;
            printToTerminal("Enter target count (number):", "info");
        } else if (!questCreationState.count) {
            const count = parseInt(value);
            if (isNaN(count) || count <= 0) {
                printToTerminal("Invalid count. Please enter a positive number:", "error");
                return;
            }
            questCreationState.count = count;
            printToTerminal("Enter metric (e.g., 'pages', 'minutes', 'times'):", "info");
        } else if (!questCreationState.metric) {
            questCreationState.metric = value;
            printToTerminal("Enter quest description:", "info");
        } else if (!questCreationState.description) {
            questCreationState.description = value;
            // Clear timeout before creating quest
            if (questCreationState.timeout) {
                clearTimeout(questCreationState.timeout);
            }
            await createQuest(questCreationState);
            creatingQuest = false;
            questCreationState = {};
        }
    } catch (error) {
        // Clear timeout and state if an error occurs
        if (questCreationState.timeout) {
            clearTimeout(questCreationState.timeout);
        }
        creatingQuest = false;
        questCreationState = {};
        printToTerminal("Error during quest creation: " + error.message, "error");
    }
}

export async function createQuest(quest) {
    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const questData = {
            title: quest.title,
            targetCount: quest.count,
            currentCount: 0,
            metric: quest.metric,
            description: quest.description,
            createdAt: new Date()
        };

        const collection = quest.type === "daily" ? "dailyQuests" : "quests";
        await playerRef.collection(collection).add(questData);

        printToTerminal("Quest created successfully!", "success");
        showNotification("New quest created!");

        // Update UI
        if (quest.type === "daily") {
            windowSystem.updateDailyQuestsWindow();
        } else {
            windowSystem.updateQuestsWindow();
        }
    } catch (error) {
        console.error("Error creating quest:", error);
        printToTerminal("Error creating quest: " + error.message, "error");
    }
}

export async function showQuestWindow(type) {
    windowSystem.showWindow(type === "daily" ? "dailyQuestsWindow" : "questsWindow");
}

export async function fetchDailyQuests() {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questsRef = playerRef.collection("dailyQuests");
    const snapshot = await questsRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function fetchNormalQuests() {
    const playerRef = db.collection("players").doc(currentUser.uid);
    const questsRef = playerRef.collection("quests");
    const snapshot = await questsRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function completeQuest(questId, type) {
    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const questRef = playerRef.collection(type === "daily" ? "dailyQuests" : "quests").doc(questId);
        
        // Use transaction to ensure atomic updates
        await db.runTransaction(async (transaction) => {
            const questDoc = await transaction.get(questRef);
            
            if (!questDoc.exists) {
                throw new Error("Quest not found!");
            }

            const quest = questDoc.data();

            // Check if quest was already completed today (for daily quests)
            if (type === "daily" && quest.completed && quest.lastCompletion) {
                if (wasCompletedToday(quest.lastCompletion)) {
                    throw new Error("This daily quest was already completed today!");
                }
            }

            // Check if quest is already completed (for normal quests)
            if (type !== "daily" && quest.completed) {
                throw new Error("This quest has already been completed!");
            }

            const expReward = Math.floor(quest.targetCount * 2);
            const goldReward = Math.floor(quest.targetCount * 1.5);

            // Update quest status
            if (type === "daily") {
                transaction.update(questRef, {
                    completed: true,
                    lastCompletion: firebase.firestore.FieldValue.serverTimestamp(),
                    currentCount: quest.targetCount
                });
            } else {
                // For normal quests, we'll delete them after completion
                transaction.delete(questRef);
            }

            // Update player stats
            transaction.update(playerRef, {
                exp: firebase.firestore.FieldValue.increment(expReward),
                gold: firebase.firestore.FieldValue.increment(goldReward),
                questsCompleted: firebase.firestore.FieldValue.increment(1),
                lastDailyCompletion: type === "daily" ? firebase.firestore.FieldValue.serverTimestamp() : playerStats.lastDailyCompletion
            });

            // Update local stats after successful transaction
            playerStats.exp += expReward;
            playerStats.gold += goldReward;
            playerStats.questsCompleted++;
            if (type === "daily") {
                playerStats.lastDailyCompletion = new Date();
            }
        });

        // Show completion messages and update UI
        printToTerminal(`Quest completed! Earned ${expReward} EXP and ${goldReward} gold.`, "success");
        showNotification("Quest completed!");

        // Update UI
        if (type === "daily") {
            windowSystem.updateDailyQuestsWindow();
        } else {
            windowSystem.updateQuestsWindow();
        }

        // Check for level up
        await checkLevelUp(playerRef, playerStats.exp);
        
        // Play sound effect
        audioSystem.playSound('questComplete');
        audioSystem.playVoiceLine('QUEST_COMPLETE');

    } catch (error) {
        console.error("Error completing quest:", error);
        printToTerminal(error.message, "error");
    }
}

export async function updateQuestProgress(questId, type, amount) {
    if (!questId || !type) {
        printToTerminal("Usage: !update <quest_id> <type> [amount|complete]", "warning");
        printToTerminal("Examples:", "info");
        printToTerminal("  !update abc123 daily 5     - Add 5 to progress", "info");
        printToTerminal("  !update abc123 normal 10   - Add 10 to progress", "info");
        printToTerminal("  !update abc123 daily complete  - Complete instantly", "info");
        return;
    }

    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const questRef = playerRef
            .collection(type === "daily" ? "dailyQuests" : "quests")
            .doc(questId);

        const questDoc = await questRef.get();
        if (!questDoc.exists) {
            printToTerminal("Quest not found!", "error");
            return;
        }

        const quest = questDoc.data();
        const newCount = amount === "complete" ? quest.targetCount : parseInt(amount);

        if (isNaN(newCount)) {
            printToTerminal("Invalid amount. Please enter a number or 'complete'.", "error");
            return;
        }

        if (newCount >= quest.targetCount) {
            await completeQuest(questId, type);
        } else {
            await questRef.update({
                currentCount: newCount
            });
            printToTerminal(`Progress updated: ${newCount}/${quest.targetCount} ${quest.metric}`, "success");
            
            // Update UI
            if (type === "daily") {
                windowSystem.updateDailyQuestsWindow();
            } else {
                windowSystem.updateQuestsWindow();
            }
        }
    } catch (error) {
        console.error("Error updating quest progress:", error);
        printToTerminal("Error updating progress: " + error.message, "error");
    }
}

export async function deleteQuest(questId, type) {
    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const questRef = playerRef
            .collection(type === "daily" ? "dailyQuests" : "quests")
            .doc(questId);

        await questRef.delete();
        printToTerminal("Quest deleted successfully!", "success");
        showNotification("Quest deleted");

        // Update UI
        if (type === "daily") {
            windowSystem.updateDailyQuestsWindow();
        } else {
            windowSystem.updateQuestsWindow();
        }
    } catch (error) {
        console.error("Error deleting quest:", error);
        printToTerminal("Error deleting quest: " + error.message, "error");
    }
}

export async function completeAllQuests(type) {
    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const questsRef = playerRef.collection(type === "daily" ? "dailyQuests" : "quests");
        const snapshot = await questsRef.get();

        if (snapshot.empty) {
            printToTerminal(`No ${type} quests to complete!`, "warning");
            return;
        }

        let totalExp = 0;
        let totalGold = 0;
        let completedCount = 0;

        for (const doc of snapshot.docs) {
            const quest = doc.data();
            const expReward = Math.floor(quest.targetCount * 2);
            const goldReward = Math.floor(quest.targetCount * 1.5);

            totalExp += expReward;
            totalGold += goldReward;
            completedCount++;
        }

        await playerRef.update({
            exp: firebase.firestore.FieldValue.increment(totalExp),
            gold: firebase.firestore.FieldValue.increment(totalGold),
            questsCompleted: firebase.firestore.FieldValue.increment(completedCount),
            lastDailyCompletion: type === "daily" ? new Date() : playerStats.lastDailyCompletion
        });

        // Update local stats
        playerStats.exp += totalExp;
        playerStats.gold += totalGold;
        playerStats.questsCompleted += completedCount;
        if (type === "daily") {
            playerStats.lastDailyCompletion = new Date();
        }

        // Delete all quests
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        printToTerminal(`All ${type} quests completed!`, "success");
        printToTerminal(`Total rewards: ${totalExp} EXP and ${totalGold} gold`, "success");
        showNotification(`All ${type} quests completed!`);

        // Update UI
        if (type === "daily") {
            windowSystem.updateDailyQuestsWindow();
        } else {
            windowSystem.updateQuestsWindow();
        }

        // Check for level up
        await checkLevelUp(playerRef, playerStats.exp);
        
        // Play sound effect
        audioSystem.playSound('questComplete');

    } catch (error) {
        console.error("Error completing all quests:", error);
        printToTerminal("Error completing quests: " + error.message, "error");
    }
} 