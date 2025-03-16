class AudioSystem {
    constructor() {
        this.sounds = {
            success: new Audio("sounds/success.mp3"),
            warning: new Audio("sounds/warning.mp3"),
            error: new Audio("sounds/error.mp3"),
            buy: new Audio("sounds/buy.mp3"),
            sell: new Audio("sounds/sell.mp3"),
            system: new Audio("sounds/system.mp3"),
            levelup: new Audio("sounds/levelup.mp3"),
            close: new Audio("sounds/close.mp3"),
            activated: new Audio("sounds/activated.mp3"),
            questComplete: new Audio("sounds/quest_complete.mp3"),
            battleStart: new Audio("sounds/battle_start.mp3"),
            battleWin: new Audio("sounds/battle_win.mp3"),
            battleLose: new Audio("sounds/battle_lose.mp3"),
            achievementUnlock: new Audio("sounds/achievement_unlock.mp3"),
            dailyReset: new Audio("sounds/daily_reset.mp3"),
            penalty: new Audio("sounds/penalty.mp3"),
            rankUp: new Audio("sounds/rank_up.mp3"),
            streakMilestone: new Audio("sounds/streak_milestone.mp3")
        };

        this.voiceLines = {
            DAILY_RESET: [
                "sounds/voice/daily_reset_1.mp3",
                "sounds/voice/daily_reset_2.mp3",
                "sounds/voice/daily_reset_3.mp3"
            ],
            LEVEL_UP: [
                "sounds/voice/level_up_1.mp3",
                "sounds/voice/level_up_2.mp3",
                "sounds/voice/level_up_3.mp3"
            ],
            QUEST_COMPLETE: [
                "sounds/voice/quest_complete_1.mp3",
                "sounds/voice/quest_complete_2.mp3",
                "sounds/voice/quest_complete_3.mp3"
            ],
            BOSS_BATTLE_START: [
                "sounds/voice/boss_battle_start_1.mp3",
                "sounds/voice/boss_battle_start_2.mp3",
                "sounds/voice/boss_battle_start_3.mp3"
            ],
            ACHIEVEMENT_UNLOCK: [
                "sounds/voice/achievement_unlock_1.mp3",
                "sounds/voice/achievement_unlock_2.mp3",
                "sounds/voice/achievement_unlock_3.mp3"
            ],
            PENALTY: [
                "sounds/voice/penalty_1.mp3",
                "sounds/voice/penalty_2.mp3",
                "sounds/voice/penalty_3.mp3"
            ],
            RANK_UP: [
                "sounds/voice/rank_up_1.mp3",
                "sounds/voice/rank_up_2.mp3",
                "sounds/voice/rank_up_3.mp3"
            ],
            STREAK_MILESTONE: [
                "sounds/voice/streak_milestone_1.mp3",
                "sounds/voice/streak_milestone_2.mp3",
                "sounds/voice/streak_milestone_3.mp3"
            ]
        };

        // Initialize all audio elements
        Object.values(this.sounds).forEach(sound => {
            sound.load();
            sound.volume = 0.5;
        });
    }

    // Function to safely play sounds
    playSound(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(error => {
                console.warn(`Error playing sound ${soundName}:`, error);
            });
        }
    }

    playVoiceLine(category) {
        const voiceLines = this.voiceLines[category];
        if (voiceLines && voiceLines.length > 0) {
            const randomIndex = Math.floor(Math.random() * voiceLines.length);
            const audio = new Audio(voiceLines[randomIndex]);
            audio.volume = 0.7;
            audio.play().catch(error => {
                console.warn(`Error playing voice line for ${category}:`, error);
            });
        }
    }

    // Event handlers for different game events
    handleLevelUp(levelsGained) {
        this.playVoiceLine('LEVEL_UP');
    }

    handleQuestComplete() {
        this.playVoiceLine('QUEST_COMPLETE');
    }

    handleBossBattleStart() {
        this.playVoiceLine('BOSS_BATTLE_START');
    }

    handleAchievementUnlock() {
        this.playVoiceLine('ACHIEVEMENT_UNLOCK');
    }

    handleDailyReset() {
        this.playVoiceLine('DAILY_RESET');
    }

    handlePenalty() {
        this.playVoiceLine('PENALTY');
    }

    handleRankUp() {
        this.playVoiceLine('RANK_UP');
    }

    handleStreakMilestone() {
        this.playVoiceLine('STREAK_MILESTONE');
    }
}

export const audioSystem = new AudioSystem(); 