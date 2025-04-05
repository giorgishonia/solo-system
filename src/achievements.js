
// Achievement definitions
const ACHIEVEMENTS = {
    // Level Achievements
    NOVICE_HUNTER: {
      id: "novice_hunter",
      name: "Novice Hunter",
      description: "Reach level 5",
      ranks: [
        { rank: 1, requirement: 5, reward: { exp: 50, gold: 25 } },
        { rank: 2, requirement: 10, reward: { exp: 100, gold: 50 } },
        { rank: 3, requirement: 25, reward: { exp: 200, gold: 100 } },
        { rank: 4, requirement: 50, reward: { exp: 400, gold: 200 } },
        { rank: 5, requirement: 100, reward: { exp: 800, gold: 400 } },
      ],
      currentRank: 0,
      type: "level",
      icon: "🌟",
    },
  
    // Quest Achievements
    QUEST_MASTER: {
      id: "quest_master",
      name: "Quest Master",
      description: "Complete quests",
      ranks: [
        { rank: 1, requirement: 5, reward: { exp: 25, gold: 15 } },
        { rank: 2, requirement: 10, reward: { exp: 50, gold: 25 } },
        { rank: 3, requirement: 25, reward: { exp: 100, gold: 50 } },
        { rank: 4, requirement: 50, reward: { exp: 200, gold: 100 } },
        { rank: 5, requirement: 100, reward: { exp: 400, gold: 200 } },
      ],
      currentRank: 0,
      type: "quests_completed",
      icon: "📚",
    },
  
    // Streak Achievements
    STREAK_WARRIOR: {
      id: "streak_warrior",
      name: "Streak Warrior",
      description: "Maintain a daily streak",
      ranks: [
        { rank: 1, requirement: 3, reward: { exp: 25, gold: 15 } },
        { rank: 2, requirement: 7, reward: { exp: 100, gold: 50 } },
        { rank: 3, requirement: 14, reward: { exp: 200, gold: 100 } },
        { rank: 4, requirement: 30, reward: { exp: 400, gold: 200 } },
        { rank: 5, requirement: 60, reward: { exp: 800, gold: 400 } },
      ],
      currentRank: 0,
      type: "daily_streak",
      icon: "🔥",
    },
  
    // Water Intake Achievements
    HYDRATION_MASTER: {
      id: "hydration_master",
      name: "Hydration Master",
      description: "Maintain a water intake streak",
      ranks: [
        { rank: 1, requirement: 3, reward: { exp: 50, gold: 25 } },
        { rank: 2, requirement: 7, reward: { exp: 100, gold: 50 } },
        { rank: 3, requirement: 14, reward: { exp: 200, gold: 100 } },
        { rank: 4, requirement: 30, reward: { exp: 500, gold: 250 } },
        { rank: 5, requirement: 60, reward: { exp: 1000, gold: 500 } },
      ],
      currentRank: 0,
      type: "water_streak",
      icon: "💧",
    },
  
    // Gold Achievements
    GOLD_BARON: {
      id: "gold_baron",
      name: "Gold Baron",
      description: "Accumulate gold",
      ranks: [
        { rank: 1, requirement: 1000, reward: { exp: 100, gold: 50 } },
        { rank: 2, requirement: 5000, reward: { exp: 300, gold: 150 } },
        { rank: 3, requirement: 10000, reward: { exp: 500, gold: 250 } },
        { rank: 4, requirement: 25000, reward: { exp: 1000, gold: 500 } },
        { rank: 5, requirement: 50000, reward: { exp: 2000, gold: 1000 } },
      ],
      currentRank: 0,
      type: "total_gold",
      icon: "💎",
    },

     // Combat Achievements
  BATTLE_VETERAN: {
    id: "battle_veteran",
    name: "Battle Veteran",
    description: "Win battles",
    ranks: [
      { rank: 1, requirement: 10, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 50, reward: { exp: 300, gold: 150 } },
      { rank: 3, requirement: 100, reward: { exp: 500, gold: 250 } },
      { rank: 4, requirement: 250, reward: { exp: 1000, gold: 500 } },
      { rank: 5, requirement: 500, reward: { exp: 2000, gold: 1000 } },
    ],
    currentRank: 0,
    type: "battles_won",
    icon: "⚔️",
  },

  // Exploration Achievements
  WORLD_EXPLORER: {
    id: "world_explorer",
    name: "World Explorer",
    description: "Discover new locations",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 10, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 20, reward: { exp: 400, gold: 200 } },
      { rank: 4, requirement: 35, reward: { exp: 600, gold: 300 } },
      { rank: 5, requirement: 50, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "locations_discovered",
    icon: "🗺️",
  },

  // Crafting Achievements
  MASTER_CRAFTSMAN: {
    id: "master_craftsman",
    name: "Master Craftsman",
    description: "Craft items",
    ranks: [
      { rank: 1, requirement: 10, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 25, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 50, reward: { exp: 400, gold: 200 } },
      { rank: 4, requirement: 100, reward: { exp: 600, gold: 300 } },
      { rank: 5, requirement: 200, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "items_crafted",
    icon: "🛠️",
  },

  // Social Achievements
  FRIENDLY_NEIGHBOR: {
    id: "friendly_neighbor",
    name: "Friendly Neighbor",
    description: "Make friends",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 10, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 20, reward: { exp: 400, gold: 200 } },
      { rank: 4, requirement: 35, reward: { exp: 600, gold: 300 } },
      { rank: 5, requirement: 50, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "friends_added",
    icon: "🤝",
  },

  // Collection Achievements
  COLLECTOR_EXTRAORDINAIRE: {
    id: "collector_extraordinaire",
    name: "Collector Extraordinaire",
    description: "Collect rare items",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 10, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 20, reward: { exp: 400, gold: 200 } },
      { rank: 4, requirement: 35, reward: { exp: 600, gold: 300 } },
      { rank: 5, requirement: 50, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "rare_items_collected",
    icon: "📦",
  },

  // Time-Based Achievements
  EARLY_BIRD: {
    id: "early_bird",
    name: "Early Bird",
    description: "Log in early in the morning",
    ranks: [
      { rank: 1, requirement: 1, reward: { exp: 50, gold: 25 } },
      { rank: 2, requirement: 5, reward: { exp: 100, gold: 50 } },
      { rank: 3, requirement: 10, reward: { exp: 200, gold: 100 } },
      { rank: 4, requirement: 20, reward: { exp: 400, gold: 200 } },
      { rank: 5, requirement: 30, reward: { exp: 800, gold: 400 } },
    ],
    currentRank: 0,
    type: "early_logins",
    icon: "🌅",
  },

  // Challenge Achievements
  CHALLENGE_CHAMPION: {
    id: "challenge_champion",
    name: "Challenge Champion",
    description: "Complete challenges",
    ranks: [
      { rank: 1, requirement: 5, reward: { exp: 100, gold: 50 } },
      { rank: 2, requirement: 10, reward: { exp: 200, gold: 100 } },
      { rank: 3, requirement: 20, reward: { exp: 400, gold: 200 } },
      { rank: 4, requirement: 35, reward: { exp: 600, gold: 300 } },
      { rank: 5, requirement: 50, reward: { exp: 1000, gold: 500 } },
    ],
    currentRank: 0,
    type: "challenges_completed",
    icon: "🏆",
  },
  
    // Rank Achievements
    RANK_MASTER: {
      id: "rank_master",
      name: "Rank Master",
      description: "Achieve higher ranks",
      ranks: [
        { rank: 1, requirement: "D", reward: { exp: 100, gold: 50 } },
        { rank: 2, requirement: "C", reward: { exp: 200, gold: 100 } },
        { rank: 3, requirement: "B", reward: { exp: 300, gold: 150 } },
        { rank: 4, requirement: "A", reward: { exp: 400, gold: 200 } },
        { rank: 5, requirement: "S", reward: { exp: 500, gold: 250 } },
      ],
      currentRank: 0,
      type: "rank",
      icon: "👑",
    },
  };

  export default ACHIEVEMENTS;