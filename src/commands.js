// Add these helper functions
function showHelp(args) {
    if (!args || args.length === 0) {
      // Show categories only
      printToTerminal("[ SYSTEM COMMANDS ] 📜");
      printToTerminal("--------------------------------------------");
      printToTerminal("!commands general - General Commands");
      printToTerminal("!commands profile - User Authentication & Profile");
      printToTerminal("!commands quests - Quests & Progression");
      printToTerminal("!commands status - Player Status & Progress");
      printToTerminal("!commands achievements - Achievements & Leaderboards");
      printToTerminal("!commands inventory - Inventory & Shop");
      printToTerminal("!commands water - Water Tracking");
      printToTerminal(
        "\n> Each category contains specific commands for that area."
      );
      printToTerminal("> Type the category command to see detailed commands.");
      printToTerminal("--------------------------------------------");
      return;
    }
  
    // Handle category-specific commands
    const category = args[0].toLowerCase();
    switch (category) {
      case "general":
        printToTerminal("\n=== 📜 GENERAL COMMANDS ===", "system");
        printToTerminal("!commands, !c - Show all commands");
        printToTerminal("!clear, !cl - Clear the terminal");
        printToTerminal("!sleep - Log out (Enter sleep mode)");
        printToTerminal(
          "!simulate - Simulate daily quest timeout [Testing]",
          "warning"
        );
        break;
  
      case "auth":
      case "profile":
        printToTerminal("\n=== 🛡️ USER AUTHENTICATION & PROFILE ===", "system");
        printToTerminal("!reawaken, !r - Authenticate user");
        printToTerminal("!profile, !p - Show player profile");
        printToTerminal("!setname <name> - Set hunter name");
        printToTerminal("!settitle <title> - Set your title");
        printToTerminal("!setbio <text> - Set your profile bio");
        printToTerminal("!setclass <class> - Set your hunter class");
        break;
  
      case "quests":
      case "quest":
        printToTerminal("\n=== 🎯 QUESTS & PROGRESSION ===", "system");
        printToTerminal("!quests, !q - Show active quests");
        printToTerminal("!dailyquests, !dq - Show daily quests");
        printToTerminal("!addquest, !aq - Create a new quest");
        printToTerminal("!adddailyquest, !adq - Create a daily quest");
        printToTerminal(
          "!update <quest_id> <type> <amount> - Update quest progress"
        );
        break;
  
      case "status":
      case "progress":
        printToTerminal("\n=== 📊 PLAYER STATUS & PROGRESS ===", "system");
        printToTerminal("!status, !s - Show player status");
        printToTerminal("!addxp, !ax - Add experience points");
        printToTerminal("!reset - Reset progress (level, exp, gold)", "warning");
        break;
  
      case "achievements":
      case "leaderboard":
        printToTerminal("\n=== 🏆 ACHIEVEMENTS & LEADERBOARDS ===", "system");
        printToTerminal("!achievements, !ach - Show unlocked achievements");
        printToTerminal("!leaderboard, !lb - Show global leaderboard");
        break;
  
      case "inventory":
      case "shop":
        printToTerminal("\n=== 🎒 INVENTORY & SHOP ===", "system");
        printToTerminal("!inventory, !i - Show player inventory");
        printToTerminal("!shop, !sh - Open the shop");
        break;
  
      case "water":
        printToTerminal("\n=== 💧 WATER TRACKING ===", "system");
        printToTerminal("!waterDrank, !wd <glasses> - Track water intake");
        printToTerminal("!waterStatus, !ws - Show water intake progress");
        break;
  
      case "motivation":
        printToTerminal("\n=== 💪 MOTIVATION ===", "system");
        printToTerminal("!motivation, !m - Get a motivational quote");
        break;
      default:
        printToTerminal("Unknown category. Available categories:", "warning");
        printToTerminal("!commands general - General commands");
        printToTerminal("!commands profile - Profile & authentication");
        printToTerminal("!commands quests - Quest management");
        printToTerminal("!commands status - Player status");
        printToTerminal("!commands achievements - Achievements");
        printToTerminal("!commands inventory - Inventory");
        printToTerminal("!commands water - Water tracking");
        break;
    }
  }

  export { showHelp };