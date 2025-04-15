
// Boss Battle definitions
const BOSSES = {
    SHADOW_KING: {
      id: "shadow_king",
      name: "Shadow King",
      description:
        "Train in the darkness to unlock your hidden strength. Complete 60 minutes of night training (after 8 PM).",
      baseTargetCount: 60,
      targetCount: 60,
      metric: "minutes",
      timeLimit: 24 * 1000,
      rewards: {
        exp: 200,  // Reduced from 500
        gold: 100, // Reduced from 250
        title: "Ruler of Shadows",
      },
      scaling: {
        targetCount: 5,
        rewards: {
          exp: 25,  // Reduced from 75
          gold: 15, // Reduced from 35
        },
      },
    },
  
    MONARCH_OF_FLESH: {
      id: "monarch_of_flesh",
      name: "Monarch of Flesh",
      description:
        "Push your body to its limit. Complete 150 push-ups within 24 hours.",
      baseTargetCount: 150,
      targetCount: 150,
      metric: "push-ups",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 250,  // Reduced from 600
        gold: 125, // Reduced from 300
        title: "Body of a Warrior",
      },
      scaling: {
        targetCount: 10,
        rewards: {
          exp: 30,  // Reduced from 100
          gold: 20, // Reduced from 50
        },
      },
    },
  
    IRON_FIST: {
      id: "iron_fist",
      name: "Iron Fist",
      description:
        "Forge your fists in fire. Complete 200 push-ups in a single session.",
      baseTargetCount: 200,
      targetCount: 200,
      metric: "push-ups",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 300,  // Reduced from 800
        gold: 150, // Reduced from 400
        title: "Unbreakable Fist",
      },
      scaling: {
        targetCount: 20,
        rewards: {
          exp: 35,  // Reduced from 100
          gold: 20, // Reduced from 50
        },
      },
    },
  
    CORE_OVERLORD: {
      id: "core_overlord",
      name: "Core Overlord",
      description:
        "Dominate your core. Complete 300 sit-ups in a single session.",
      baseTargetCount: 300,
      targetCount: 300,
      metric: "sit-ups",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 350,  // Reduced from 900
        gold: 175, // Reduced from 450
        title: "Master of the Core",
      },
      scaling: {
        targetCount: 30,
        rewards: {
          exp: 40,  // Reduced from 100
          gold: 25, // Reduced from 50
        },
      },
    },
  
    PUSHUP_WARLORD: {
      id: "pushup_warlord",
      name: "Push-Up Warlord",
      description:
        "Conquer the ultimate push-up challenge. Complete 100 push-ups in 10 minutes.",
      baseTargetCount: 100,
      targetCount: 100,
      metric: "push-ups",
      timeLimit: 10 * 60 * 1000,
      rewards: {
        exp: 275,  // Reduced from 700
        gold: 140, // Reduced from 350
        title: "Push-Up Champion",
      },
      scaling: {
        targetCount: 10,
        rewards: {
          exp: 30,  // Reduced from 75
          gold: 15, // Reduced from 35
        },
      },
    },
  
    SITUP_SORCERER: {
      id: "situp_sorcerer",
      name: "Sit-Up Sorcerer",
      description:
        "Harness the magic of endurance. Complete 150 sit-ups in 15 minutes.",
      baseTargetCount: 150,
      targetCount: 150,
      metric: "sit-ups",
      timeLimit: 15 * 60 * 1000,
      rewards: {
        exp: 300,  // Reduced from 750
        gold: 150, // Reduced from 375
        title: "Core Mage",
      },
      scaling: {
        targetCount: 15,
        rewards: {
          exp: 35,  // Reduced from 75
          gold: 20, // Reduced from 35
        },
      },
    },
  
    PUSHUP_TITAN: {
      id: "pushup_titan",
      name: "Push-Up Titan",
      description: "Prove your might. Complete 500 push-ups in a week.",
      baseTargetCount: 500,
      targetCount: 500,
      metric: "push-ups",
      timeLimit: 7 * 24 * 60 * 60 * 1000,
      rewards: {
        exp: 1000,
        gold: 500,
        title: "Titan of Push-Ups",
      },
      scaling: {
        targetCount: 50,
        rewards: {
          exp: 150,
          gold: 75,
        },
      },
    },
  
    SITUP_SENTINEL: {
      id: "situp_sentinel",
      name: "Sit-Up Sentinel",
      description: "Guard your core. Complete 1,000 sit-ups in a week.",
      baseTargetCount: 1000,
      targetCount: 1000,
      metric: "sit-ups",
      timeLimit: 7 * 24 * 60 * 60 * 1000,
      rewards: {
        exp: 1200,
        gold: 600,
        title: "Core Sentinel",
      },
      scaling: {
        targetCount: 100,
        rewards: {
          exp: 150,
          gold: 75,
        },
      },
    },
  
    PUSHUP_PHANTOM: {
      id: "pushup_phantom",
      name: "Push-Up Phantom",
      description: "Move like a shadow. Complete 50 push-ups in 5 minutes.",
      baseTargetCount: 50,
      targetCount: 50,
      metric: "push-ups",
      timeLimit: 5 * 60 * 1000,
      rewards: {
        exp: 600,
        gold: 300,
        title: "Shadow Pusher",
      },
      scaling: {
        targetCount: 5,
        rewards: {
          exp: 50,
          gold: 25,
        },
      },
    },
  
    SITUP_SPECTER: {
      id: "situp_specter",
      name: "Sit-Up Specter",
      description: "Haunt your core. Complete 75 sit-ups in 7 minutes.",
      baseTargetCount: 75,
      targetCount: 75,
      metric: "sit-ups",
      timeLimit: 7 * 60 * 1000,
      rewards: {
        exp: 650,
        gold: 325,
        title: "Ghost of the Core",
      },
      scaling: {
        targetCount: 7,
        rewards: {
          exp: 50,
          gold: 25,
        },
      },
    },
  
    PUSHUP_DRAGON: {
      id: "pushup_dragon",
      name: "Push-Up Dragon",
      description:
        "Breathe fire into your arms. Complete 300 push-ups in 30 minutes.",
      baseTargetCount: 300,
      targetCount: 300,
      metric: "push-ups",
      timeLimit: 30 * 60 * 1000,
      rewards: {
        exp: 900,
        gold: 450,
        title: "Dragon of Strength",
      },
      scaling: {
        targetCount: 30,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    SITUP_SERPENT: {
      id: "situp_serpent",
      name: "Sit-Up Serpent",
      description: "Coil your core. Complete 200 sit-ups in 20 minutes.",
      baseTargetCount: 200,
      targetCount: 200,
      metric: "sit-ups",
      timeLimit: 20 * 60 * 1000,
      rewards: {
        exp: 800,
        gold: 400,
        title: "Serpent of the Core",
      },
      scaling: {
        targetCount: 20,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    GATE_KEEPER: {
      id: "gate_keeper",
      name: "Gate Keeper",
      description:
        "Pass through the threshold of strength. Run 5 kilometers in a single session.",
      baseTargetCount: 5,
      targetCount: 5,
      metric: "kilometers",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 700,
        gold: 350,
        title: "Breaker of Chains",
      },
      scaling: {
        targetCount: 0.5,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    RULER_OF_STAMINA: {
      id: "ruler_of_stamina",
      name: "Ruler of Stamina",
      description:
        "Survive the test of endurance. Burn 2,000 calories in a week.",
      baseTargetCount: 2000,
      targetCount: 2000,
      metric: "calories",
      timeLimit: 7 * 24 * 60 * 60 * 1000,
      rewards: {
        exp: 800,
        gold: 400,
        title: "Everlasting Hunter",
      },
      scaling: {
        targetCount: 200,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    TITAN_SLAYER: {
      id: "titan_slayer",
      name: "Titan Slayer",
      description:
        "Overcome the mightiest. Lift a total of 5,000 kg in weight training.",
      baseTargetCount: 5000,
      targetCount: 5000,
      metric: "kilograms lifted",
      timeLimit: 7 * 24 * 60 * 60 * 1000,
      rewards: {
        exp: 1000,
        gold: 500,
        title: "Crusher of Giants",
      },
      scaling: {
        targetCount: 500,
        rewards: {
          exp: 150,
          gold: 75,
        },
      },
    },
    PHANTOM_RUNNER: {
      id: "phantom_runner",
      name: "Phantom Runner",
      description: "Outpace the unseen. Run 10 kilometers in under 60 minutes.",
      baseTargetCount: 10,
      targetCount: 10,
      metric: "kilometers",
      timeLimit: 60 * 60 * 1000,
      rewards: {
        exp: 750,
        gold: 375,
        title: "Speed Demon",
      },
      scaling: {
        targetCount: 1,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    IRON_WILL: {
      id: "iron_will",
      name: "Iron Will",
      description: "Forge your mind and body. Hold a plank for 5 minutes.",
      baseTargetCount: 5,
      targetCount: 5,
      metric: "minutes",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 400,
        gold: 200,
        title: "Unbreakable",
      },
      scaling: {
        targetCount: 0.5,
        rewards: {
          exp: 50,
          gold: 25,
        },
      },
    },
  
    STORM_CALLER: {
      id: "storm_caller",
      name: "Storm Caller",
      description: "Summon the storm within. Complete 100 burpees in 20 minutes.",
      baseTargetCount: 100,
      targetCount: 100,
      metric: "burpees",
      timeLimit: 20 * 60 * 1000,
      rewards: {
        exp: 600,
        gold: 300,
        title: "Thunder Lord",
      },
      scaling: {
        targetCount: 10,
        rewards: {
          exp: 75,
          gold: 35,
        },
      },
    },
  
    ABYSS_WALKER: {
      id: "abyss_walker",
      name: "Abyss Walker",
      description:
        "Descend into the depths. Perform 50 pull-ups in a single session.",
      baseTargetCount: 50,
      targetCount: 50,
      metric: "pull-ups",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 700,
        gold: 350,
        title: "Void Strider",
      },
      scaling: {
        targetCount: 5,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    FLAME_EMPEROR: {
      id: "flame_emperor",
      name: "Flame Emperor",
      description:
        "Burn with intensity. Complete 30 minutes of high-intensity interval training (HIIT).",
      baseTargetCount: 30,
      targetCount: 30,
      metric: "minutes",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 550,
        gold: 275,
        title: "Inferno Lord",
      },
      scaling: {
        targetCount: 2,
        rewards: {
          exp: 75,
          gold: 35,
        },
      },
    },
  
    FROST_GIANT: {
      id: "frost_giant",
      name: "Frost Giant",
      description: "Endure the cold. Swim 1 kilometer in open water or a pool.",
      baseTargetCount: 1,
      targetCount: 1,
      metric: "kilometers",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 650,
        gold: 325,
        title: "Ice Breaker",
      },
      scaling: {
        targetCount: 0.2,
        rewards: {
          exp: 75,
          gold: 35,
        },
      },
    },
  
    EARTH_SHAKER: {
      id: "earth_shaker",
      name: "Earth Shaker",
      description:
        "Shake the ground beneath you. Perform 200 squats in a single session.",
      baseTargetCount: 200,
      targetCount: 200,
      metric: "squats",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 800,
        gold: 400,
        title: "Titan of Strength",
      },
      scaling: {
        targetCount: 20,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    WIND_RIDER: {
      id: "wind_rider",
      name: "Wind Rider",
      description:
        "Ride the winds of speed. Cycle 20 kilometers in a single session.",
      baseTargetCount: 20,
      targetCount: 20,
      metric: "kilometers",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 700,
        gold: 350,
        title: "Gale Force",
      },
      scaling: {
        targetCount: 2,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    VOID_SEEKER: {
      id: "void_seeker",
      name: "Void Seeker",
      description: "Seek the unknown. Meditate for 30 minutes daily for 7 days.",
      baseTargetCount: 7,
      targetCount: 7,
      metric: "days",
      timeLimit: 7 * 24 * 60 * 60 * 1000,
      rewards: {
        exp: 900,
        gold: 450,
        title: "Mind of the Void",
      },
      scaling: {
        targetCount: 1,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
  
    BLAZE_ARCHER: {
      id: "blaze_archer",
      name: "Blaze Archer",
      description:
        "Strike with precision. Complete 100 archery shots or similar precision training.",
      baseTargetCount: 100,
      targetCount: 100,
      metric: "shots",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 600,
        gold: 300,
        title: "Eagle Eye",
      },
      scaling: {
        targetCount: 10,
        rewards: {
          exp: 75,
          gold: 35,
        },
      },
    },
  
    THUNDER_GOD: {
      id: "thunder_god",
      name: "Thunder God",
      description:
        "Channel the power of thunder. Perform 50 box jumps in 10 minutes.",
      baseTargetCount: 50,
      targetCount: 50,
      metric: "box jumps",
      timeLimit: 10 * 60 * 1000,
      rewards: {
        exp: 650,
        gold: 325,
        title: "Storm Bringer",
      },
      scaling: {
        targetCount: 5,
        rewards: {
          exp: 75,
          gold: 35,
        },
      },
    },
  
    MOONLIGHT_ASSASSIN: {
      id: "moonlight_assassin",
      name: "Moonlight Assassin",
      description:
        "Move in silence. Complete 30 minutes of yoga or flexibility training.",
      baseTargetCount: 30,
      targetCount: 30,
      metric: "minutes",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 500,
        gold: 250,
        title: "Shadow Dancer",
      },
      scaling: {
        targetCount: 2,
        rewards: {
          exp: 50,
          gold: 25,
        },
      },
    },
  
    STARGAZER: {
      id: "stargazer",
      name: "Stargazer",
      description:
        "Reach for the stars. Climb 500 meters on a climbing wall or rock face.",
      baseTargetCount: 500,
      targetCount: 500,
      metric: "meters climbed",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 800,
        gold: 400,
        title: "Celestial Climber",
      },
      scaling: {
        targetCount: 50,
        rewards: {
          exp: 100,
          gold: 50,
        },
      },
    },
    DRAGON_TAMER: {
      id: "dragon_tamer",
      name: "Dragon Tamer",
      description:
        "Tame the beast within. Complete 3 consecutive days of intense training.",
      baseTargetCount: 3,
      targetCount: 3,
      metric: "days",
      timeLimit: 3 * 24 * 60 * 60 * 1000,
      rewards: {
        exp: 1000,
        gold: 500,
        title: "Beast Master",
      },
      scaling: {
        targetCount: 1,
        rewards: {
          exp: 150,
          gold: 75,
        },
      },
    },
    ETERNAL_GUARDIAN: {
      id: "eternal_guardian",
      name: "Eternal Guardian",
      description: "Protect the realm. Complete 10,000 steps in a single day.",
      baseTargetCount: 10000,
      targetCount: 10000,
      metric: "steps",
      timeLimit: 24 * 60 * 60 * 1000,
      rewards: {
        exp: 700,
        gold: 350,
        title: "Guardian of Eternity",
      },
      scaling: {
        targetCount: 500,
        rewards: {
          exp: 75,
          gold: 35,
        },
      },
    },
  };
    

  export default BOSSES;