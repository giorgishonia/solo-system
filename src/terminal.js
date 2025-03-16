import { playerStats } from './playerStats.js';

export function updateTerminalPrompt() {
    const prompt = document.querySelector(".terminal-prompt-user");
    if (prompt && playerStats.profile) {
        prompt.textContent = `${playerStats.profile.name || "Anonymous"}@${playerStats.profile.class || "Unknown"}`;
    }
}

export async function printToTerminal(text, type = "default") {
    const terminal = document.getElementById("terminal");
    const output = document.querySelector(".terminal-output");
    
    if (!terminal || !output) return;
    
    const line = document.createElement("div");
    line.className = `terminal-line ${type}`;
    
    // Handle HTML content
    if (text.includes("<") && text.includes(">")) {
        line.innerHTML = text;
    } else {
        line.textContent = text;
    }
    
    output.appendChild(line);
    
    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
    
    // Play sound based on message type
    if (type === "error") {
        audioSystem.playSound("error");
    } else if (type === "success") {
        audioSystem.playSound("success");
    } else if (type === "warning") {
        audioSystem.playSound("warning");
    } else if (type === "system") {
        audioSystem.playSound("system");
    }
}

export function clearTerminal() {
    const output = document.querySelector(".terminal-output");
    if (output) {
        output.innerHTML = "";
    }
}

export function toggleTerminalDisplay() {
    const terminal = document.getElementById("terminal");
    if (terminal) {
        terminal.classList.toggle("hidden");
    }
}

// Command history functionality
let commandHistory = [];
let historyIndex = -1;

export function addToCommandHistory(command) {
    if (command && command.trim()) {
        commandHistory.unshift(command);
        if (commandHistory.length > 50) { // Limit history size
            commandHistory.pop();
        }
        historyIndex = -1;
    }
}

export function getPreviousCommand() {
    if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        return commandHistory[historyIndex];
    }
    return null;
}

export function getNextCommand() {
    if (historyIndex > 0) {
        historyIndex--;
        return commandHistory[historyIndex];
    } else if (historyIndex === 0) {
        historyIndex = -1;
        return "";
    }
    return null;
}

// Command suggestions
const commandSuggestions = {
    "!reawaken": "Connect to the system",
    "!sleep": "Disconnect from the system",
    "!help": "Show available commands",
    "!status": "Show your current status",
    "!quests": "Show available quests",
    "!dailyquests": "Show daily quests",
    "!profile": "Show your profile",
    "!shop": "Show the item shop",
    "!inventory": "Show your inventory",
    "!achievements": "Show your achievements",
    "!leaderboard": "Show the leaderboard",
    "!notifications": "Show your notifications",
    "!clear": "Clear the terminal",
    "!water": "Track water intake",
    "!rank": "Show your rank progress",
    "!battles": "Show available boss battles",
    "!army": "Show your shadow army"
};

let currentSuggestions = [];
let suggestionIndex = -1;

export function suggest(input) {
    if (!input) return [];
    
    input = input.toLowerCase();
    currentSuggestions = Object.keys(commandSuggestions).filter(cmd => 
        cmd.toLowerCase().startsWith(input)
    );
    suggestionIndex = -1;
    
    return currentSuggestions;
}

export function showNextSuggestion(input) {
    if (currentSuggestions.length === 0) {
        currentSuggestions = suggest(input);
    }
    
    if (currentSuggestions.length > 0) {
        suggestionIndex = (suggestionIndex + 1) % currentSuggestions.length;
        return currentSuggestions[suggestionIndex];
    }
    
    return input;
}

export function getCommandDescription(command) {
    return commandSuggestions[command] || "";
} 