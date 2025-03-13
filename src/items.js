


const ITEMS = {
    // 🎓 XP & Level Boosters
    MINOR_XP_BOOST: {
      id: "minor_xp_boost",
      name: "Minor XP Boost",
      description: "Increases XP gain by 10% for 30 minutes",
      price: 50,
      category: "booster",
      rankRequired: "E",
      duration: 1800000, // 30 minutes
      effect: { type: "global_xp", value: 1.1 },
    },
    GOLDEN_GRIMOIRE: {
      id: "golden_grimoire",
      name: "Golden Grimoire",
      description: "Increases XP gain from all activities by 25% for 2 hours",
      price: 250,
      category: "booster",
      rankRequired: "D",
      duration: 7200000, // 2 hours
      effect: { type: "global_xp", value: 1.25 },
    },
    RULERS_AUTHORITY: {
      id: "rulers_authority",
      name: "Ruler's Authority",
      description: "Triples XP gain from all sources for 30 minutes",
      price: 1000,
      category: "booster",
      rankRequired: "A",
      duration: 1800000, // 30 minutes
      effect: { type: "global_xp", value: 3.0 },
    },
  
    // 🎯 Quest & Progress
    BASIC_QUEST_BOOST: {
      id: "basic_quest_boost",
      name: "Basic Quest Boost",
      description: "Increases quest progress speed by 20% for 30 minutes",
      price: 75,
      category: "enhancer",
      rankRequired: "E",
      duration: 1800000, // 30 minutes
      effect: { type: "quest_progress", value: 1.2 },
    },
    MONARCHS_BLESSING: {
      id: "monarchs_blessing",
      name: "Monarch's Blessing",
      description: "Triples all quest rewards and progress for 30 minutes",
      price: 800,
      category: "enhancer",
      rankRequired: "B",
      duration: 1800000, // 30 minutes
      effect: { type: "quest_rewards", value: 3.0 },
    },
  
    // 🏆 Permanent Upgrades
    MINOR_UPGRADE: {
      id: "minor_upgrade",
      name: "Minor Upgrade",
      description: "Permanently increases all XP gain by 2%",
      price: 100,
      category: "upgrade",
      rankRequired: "E",
      effect: { type: "permanent_xp", value: 1.02 },
    },
    GOLD_MAGNET: {
      id: "gold_magnet",
      name: "Gold Magnet",
      description: "Permanently increases gold earned from all sources by 15%",
      price: 2000,
      category: "upgrade",
      rankRequired: "A",
      effect: { type: "gold_multiplier", value: 1.15 },
    },
    MONARCHS_DOMAIN: {
      id: "monarchs_domain",
      name: "Monarch's Domain",
      description: "Permanently increases all stats by 20%",
      price: 5000,
      category: "upgrade",
      rankRequired: "S",
      effect: { type: "all_stats", value: 1.2 },
    },
  
    // 🎨 Profile Customization
    CUSTOM_NAME_COLOR: {
      id: "custom_name_color",
      name: "Custom Name Color",
      description: "Change the color of your name in rankings and messages",
      price: 500,
      category: "cosmetic",
      rankRequired: "E",
      effect: { type: "name_color", value: true },
    },
    PROFILE_SHOWCASE: {
      id: "profile_showcase",
      name: "Profile Showcase",
      description: "Unlocks custom profile layout and background themes",
      price: 800,
      category: "cosmetic",
      rankRequired: "D",
      effect: { type: "profile_custom", value: true },
    },
    LEVEL_EFFECT: {
      id: "level_effect",
      name: "Level-Up Effect",
      description: "Adds custom visual effects when you level up",
      price: 1000,
      category: "cosmetic",
      rankRequired: "C",
      effect: { type: "level_visual", value: true },
    },
  
    // 👑 Titles
    TITLE_SHADOW_MONARCH: {
      id: "title_shadow_monarch",
      name: 'Title: "Shadow Monarch"',
      description: "The ultimate title reserved for the strongest",
      price: 5000,
      category: "title",
      rankRequired: "S",
      effect: { type: "title", value: "Shadow Monarch" },
    },
    TITLE_ARISE: {
      id: "title_arise",
      name: 'Title: "ARISE"',
      description: "The ultimate command of the Shadow Monarch",
      price: 10000,
      category: "title",
      rankRequired: "S",
      effect: { type: "title", value: "ARISE" },
    },
  
    // Colored Title Items
    TITLE_CRIMSON_LORD: {
      id: "title_crimson_lord",
      name: 'Title: "Crimson Lord"',
      description: "A blood-red title for those who command respect",
      price: 3000,
      category: "title",
      rankRequired: "A",
      effect: { type: "title", value: "Crimson Lord", color: "#ff3333" },
    },
    TITLE_FROST_SOVEREIGN: {
      id: "title_frost_sovereign",
      name: 'Title: "Frost Sovereign"',
      description: "An icy blue title for the masters of cold",
      price: 3000,
      category: "title",
      rankRequired: "A",
      effect: { type: "title", value: "Frost Sovereign", color: "#33ccff" },
    },
    TITLE_EMERALD_SAGE: {
      id: "title_emerald_sage",
      name: 'Title: "Emerald Sage"',
      description: "A mystical green title for the wisest hunters",
      price: 3000,
      category: "title",
      rankRequired: "A",
      effect: { type: "title", value: "Emerald Sage", color: "#33ff66" },
    },
    TITLE_GOLDEN_EMPEROR: {
      id: "title_golden_emperor",
      name: 'Title: "Golden Emperor"',
      description: "A majestic golden title for the wealthiest hunters",
      price: 5000,
      category: "title",
      rankRequired: "S",
      effect: { type: "title", value: "Golden Emperor", color: "#ffcc33" },
    },
  
    // 🌟 Special Items
    DAILY_QUEST_RESET: {
      id: "daily_quest_reset",
      name: "Daily Quest Reset",
      description: "Reset all daily quests immediately",
      price: 750,
      category: "special",
      rankRequired: "B",
      effect: { type: "reset_daily", value: true },
    },
    DEMON_KINGS_SOUL: {
      id: "demon_kings_soul",
      name: "Demon King's Soul",
      description: "Grants immense power for 5 minutes",
      price: 5000,
      category: "special",
      rankRequired: "A",
      duration: 300000, // 5 minutes
      effect: { type: "all_stats", value: 5.0 },
    },
  
    // 🆕 New Features
    QUEST_CHAIN: {
      id: "quest_chain",
      name: "Quest Chain",
      description: "Unlock chain quests that give increasing rewards for consecutive completion",
      price: 1500,
      category: "special",
      rankRequired: "C",
      effect: { type: "quest_chain", value: true },
    },
    ACHIEVEMENT_TRACKER: {
      id: "achievement_tracker",
      name: "Achievement Tracker",
      description: "Shows hidden achievements and tracks progress in real-time",
      price: 1000,
      category: "special",
      rankRequired: "D",
      effect: { type: "achievement_tracking", value: true },
    },
    CUSTOM_MILESTONES: {
      id: "custom_milestones",
      name: "Custom Milestones",
      description: "Create and track personal milestones with custom rewards",
      price: 2000,
      category: "special",
      rankRequired: "C",
      effect: { type: "milestone_custom", value: true },
    },
    SHADOW_ARMY_DISPLAY: {
      id: "shadow_army_display",
      name: "Shadow Army Display",
      description: "Shows your shadow army progress and achievements on profile",
      price: 1500,
      category: "cosmetic",
      rankRequired: "B",
      effect: { type: "army_display", value: true },
    },
    RANK_INSIGNIA: {
      id: "rank_insignia",
      name: "Rank Insignia",
      description: "Displays a special badge next to your name based on your rank",
      price: 1000,
      category: "cosmetic",
      rankRequired: "C",
      effect: { type: "rank_badge", value: true },
    },
    DUNGEON_LOG: {
      id: "dungeon_log",
      name: "Dungeon Log",
      description: "Tracks and displays your dungeon clear history and statistics",
      price: 800,
      category: "special",
      rankRequired: "D",
      effect: { type: "dungeon_history", value: true },
    },
  
    // 🖤 Shadow Abilities
    SHADOW_EXTRACTION: {
      id: "shadow_extraction",
      name: "Shadow Extraction",
      description: "Unlocks the ability to extract shadows from defeated bosses",
      price: 3000,
      category: "shadow",
      rankRequired: "A",
      effect: { type: "shadow_ability", value: "extraction" }
    },
    SHADOW_STORAGE_1: {
      id: "shadow_storage_1",
      name: "Shadow Storage I",
      description: "Increases maximum shadow soldier capacity by 10",
      price: 1000,
      category: "shadow",
      rankRequired: "B",
      effect: { type: "max_shadows", value: 10 }
    },
    SHADOW_STORAGE_2: {
      id: "shadow_storage_2",
      name: "Shadow Storage II",
      description: "Increases maximum shadow soldier capacity by 25",
      price: 2500,
      category: "shadow",
      rankRequired: "A",
      effect: { type: "max_shadows", value: 25 }
    },
    SHADOW_STORAGE_3: {
      id: "shadow_storage_3",
      name: "Shadow Storage III",
      description: "Increases maximum shadow soldier capacity by 50",
      price: 5000,
      category: "shadow",
      rankRequired: "S",
      effect: { type: "max_shadows", value: 50 }
    },
    ELITE_SHADOW_UPGRADE: {
      id: "elite_shadow_upgrade",
      name: "Elite Shadow Upgrade",
      description: "Unlocks the ability to create Elite Shadow Soldiers",
      price: 4000,
      category: "shadow",
      rankRequired: "A",
      effect: { type: "shadow_tier", value: "elite" }
    },
    GENERAL_SHADOW_UPGRADE: {
      id: "general_shadow_upgrade",
      name: "General Shadow Upgrade",
      description: "Unlocks the ability to create Shadow Generals",
      price: 6000,
      category: "shadow",
      rankRequired: "S",
      effect: { type: "shadow_tier", value: "general" }
    },
    MONARCH_SHADOW_UPGRADE: {
      id: "monarch_shadow_upgrade",
      name: "Monarch Shadow Upgrade",
      description: "Unlocks the ability to create Shadow Monarchs",
      price: 10000,
      category: "shadow",
      rankRequired: "S",
      effect: { type: "shadow_tier", value: "monarch" }
    },
  };

  export default ITEMS;