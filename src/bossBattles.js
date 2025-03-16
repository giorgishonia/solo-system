import BOSSES from './bosses.js';
import { printToTerminal } from './terminal.js';
import { formatTimeLimit } from './utils.js';
import { playerStats } from './playerStats.js';

export async function handleBossBattleTimeout(playerRef, bossId, battle) {
    if (!battle) {
        const doc = await playerRef.collection("activeBattles").doc(bossId).get();
        if (!doc.exists) return;
        battle = doc.data();
    }

    const endTime = battle.endTime.toDate();
    if (Date.now() >= endTime) {
        await playerRef.collection("activeBattles").doc(bossId).delete();
        printToTerminal(`Boss battle against ${BOSSES[bossId].name} has expired!`, "error");
        return true;
    }
    return false;
}

export async function startBossBattle(args) {
    if (!args || args.length === 0) {
        printToTerminal("Available boss battles:", "info");
        Object.values(BOSSES).forEach(boss => {
            printToTerminal(`- ${boss.id}: ${boss.name}`, "info");
        });
        printToTerminal("Usage: !challenge <boss_id>", "info");
        return;
    }

    const bossId = args[0];
    const boss = Object.values(BOSSES).find(b => b.id === bossId);
    
    if (!boss) {
        printToTerminal("Invalid boss battle ID.", "error");
        return;
    }

    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const activeBattleRef = playerRef.collection("activeBattles").doc(bossId);
        const activeBattle = await activeBattleRef.get();

        if (activeBattle.exists) {
            printToTerminal("You're already challenging this boss!", "error");
            return;
        }

        const player = (await playerRef.get()).data();
        const defeatCount = player.defeatedBosses?.[bossId] || 0;
        const scaledTarget = boss.baseTargetCount + (defeatCount * (boss.scaling?.targetCount || 0));

        const battle = {
            startTime: new Date(),
            endTime: new Date(Date.now() + boss.timeLimit),
            currentCount: 0,
            targetCount: scaledTarget,
            completed: false
        };

        await activeBattleRef.set(battle);
        printToTerminal(`Boss battle against ${boss.name} started!`, "success");
        printToTerminal(`Target: ${scaledTarget} ${boss.metric}`, "info");
        printToTerminal(`Time limit: ${formatTimeLimit(boss.timeLimit)}`, "info");
    } catch (error) {
        console.error("Error starting boss battle:", error);
        printToTerminal("Error starting boss battle: " + error.message, "error");
    }
}

export async function updateBattleProgress(args) {
    if (!args || args.length < 2) {
        printToTerminal("Usage: !progress <boss_id> <amount>", "warning");
        printToTerminal("Or use: !progress <boss_id> complete", "info");
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
        const endTime = battle.endTime.toDate();

        if (Date.now() >= endTime) {
            await handleBossBattleTimeout(playerRef, bossId, battle);
            return;
        }

        const newCount = amount === "complete" ? battle.targetCount : parseInt(amount);
        if (isNaN(newCount)) {
            printToTerminal("Invalid progress amount.", "error");
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

            const defeatedBossesUpdate = {
                [`defeatedBosses.${bossId}`]:
                    firebase.firestore.FieldValue.increment(1),
            };

            // Update player stats
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

            // Delete completed battle
            await activeBattleRef.delete();

            printToTerminal(`Boss defeated! Earned ${scaledExp} EXP and ${scaledGold} gold.`, "success");
        } else {
            await activeBattleRef.update({
                currentCount: newCount,
            });
            printToTerminal(`Progress updated: ${newCount}/${battle.targetCount} ${boss.metric}`, "success");
        }
    } catch (error) {
        console.error("Error updating battle progress:", error);
        printToTerminal("Error updating progress: " + error.message, "error");
    }
}

export function showBossBattles() {
    windowSystem.showWindow("bossBattlesWindow");
}

export async function extractShadow(bossId) {
    try {
        const playerRef = db.collection("players").doc(currentUser.uid);
        const player = (await playerRef.get()).data();

        if (!player.defeatedBosses?.[bossId]) {
            printToTerminal("You haven't defeated this boss yet!", "error");
            return;
        }

        const boss = BOSSES[bossId];
        if (!boss) {
            printToTerminal("Invalid boss ID.", "error");
            return;
        }

        const shadowSoldier = {
            id: `shadow_${Date.now()}`,
            name: `Shadow of ${boss.name}`,
            type: "shadow",
            bossOrigin: bossId,
            stats: {
                power: Math.floor(Math.random() * 100) + 50,
                defense: Math.floor(Math.random() * 50) + 25
            }
        };

        await playerRef.update({
            shadowArmy: firebase.firestore.FieldValue.arrayUnion(shadowSoldier)
        });

        printToTerminal(`Successfully extracted shadow from ${boss.name}!`, "success");
        printToTerminal(`Power: ${shadowSoldier.stats.power}`, "info");
        printToTerminal(`Defense: ${shadowSoldier.stats.defense}`, "info");

    } catch (error) {
        console.error("Error extracting shadow:", error);
        printToTerminal("Error extracting shadow: " + error.message, "error");
    }
} 