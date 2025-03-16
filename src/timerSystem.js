import { updateBattleTimers } from './bossBattles.js';
import { checkWaterIntakeReset } from './waterSystem.js';
import { updateDailyQuestTimers } from './quests.js';

class TimerSystem {
    constructor() {
        this.timers = new Map();
        this.isInitialized = false;
    }

    startTimer(id, updateFn, interval = 1000) {
        if (this.timers.has(id)) {
            return this.timers.get(id);
        }

        // Start new timer
        const timerId = setInterval(updateFn, interval);
        this.timers.set(id, timerId);
        return timerId;
    }

    stopTimer(id) {
        if (this.timers.has(id)) {
            clearInterval(this.timers.get(id));
            this.timers.delete(id);
        }
    }

    stopAllTimers() {
        this.timers.forEach((timerId) => clearInterval(timerId));
        this.timers.clear();
        this.isInitialized = false;
    }

    hasActiveTimer(id) {
        return this.timers.has(id);
    }

    initializeTimers() {
        if (this.isInitialized) return;

        // Start battle timers if not already running
        if (!this.hasActiveTimer('battleTimers')) {
            this.startTimer('battleTimers', updateBattleTimers);
        }

        // Start daily quest timers if not already running
        if (!this.hasActiveTimer('questTimers')) {
            this.startTimer('questTimers', updateDailyQuestTimers);
        }

        // Start water check timer
        if (!this.hasActiveTimer('waterCheck')) {
            this.startTimer('waterCheck', checkWaterIntakeReset, 60000); // Check every minute
        }

        this.isInitialized = true;
    }
}

export const timerSystem = new TimerSystem();

export function formatTimeRemaining(milliseconds) {
    if (milliseconds < 0) return "Time's up!";
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
}

export function formatTimeLimit(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

export function getEndOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
} 