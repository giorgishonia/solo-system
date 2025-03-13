export async function showProfile(isAuthenticated) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const player = (await playerRef.get()).data();

  // Ensure profile exists
  if (!player.profile) {
    player.profile = {
      name: "",
      title: "Novice",
      picture: "default.png",
      bio: "",
      class: "Hunter",
      joinDate: null,
    };
    // Update the player document with initialized profile
    await playerRef.update({ profile: player.profile });
  }

  printToTerminal("\n=== PLAYER PROFILE ===", "system");
  printToTerminal(`Name: ${player.profile.name || "Not set"}`, "info");
  printToTerminal(`Title: ${player.profile.title || "Novice"}`, "info");
  printToTerminal(`Class: ${player.profile.class || "Hunter"}`, "info");
  if (player.profile.bio) {
    printToTerminal(`\nBio: ${player.profile.bio}`, "info");
  }
  printToTerminal("\nStats:", "info");
  printToTerminal(`Level: ${player.level}`, "info");
  printToTerminal(`EXP: ${player.exp}/100`, "info");
  printToTerminal(`Gold: ${player.gold}`, "info");
  printToTerminal(`Rank: ${player.rank}`, "info");
  printToTerminal(`Daily Streak: ${player.streak} days`, "info");
  printToTerminal(`Quests Completed: ${player.questsCompleted}`, "info");

  if (player.waterIntake?.streakDays > 0) {
    printToTerminal(
      `Water Streak: ${player.waterIntake.streakDays} days`,
      "info"
    );
  }

  printToTerminal("\nAchievements:", "info");
  if (!player.achievements || player.achievements.length === 0) {
    printToTerminal("No achievements yet", "warning");
  } else {
    player.achievements.forEach((achievementId) => {
      const achievement = Object.values(ACHIEVEMENTS).find(
        (a) => a.id === achievementId
      );
      if (achievement) {
        printToTerminal(`- ${achievement.name}`, "info");
      }
    });
  }

  printToTerminal("\nProfile Commands:", "system");
  printToTerminal("!setname <name> - Set your hunter name", "info");
  printToTerminal("!settitle <title> - Set your title", "info");
  printToTerminal("!setbio <text> - Set your profile bio", "info");
  printToTerminal("!setclass <class> - Set your hunter class", "info");
}
