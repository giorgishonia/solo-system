export async function showProfile(isAuthenticated) {
  if (!isAuthenticated) {
    printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const playerRef = db.collection("players").doc(currentUser.uid);
  const playerDoc = await playerRef.get();
  const player = playerDoc.data();

  // Ensure profile exists
  if (!player.profile) {
    player.profile = {
      name: "",
      title: "Novice",
      picture: "default.png",
      bio: "",
      class: "Hunter",
      joinDate: player.profile?.joinDate || firebase.firestore.FieldValue.serverTimestamp(),
      unlockedTitles: [],
    };
    await playerRef.update({ profile: player.profile });
  }

  // Update streak before displaying
  await checkDailyStreak();
  
  // Update local playerStats
  playerStats.profile = player.profile;
  playerStats.level = player.level;
  playerStats.exp = player.exp;
  playerStats.gold = player.gold;
  playerStats.rank = player.rank;
  playerStats.streak = player.streak;
  playerStats.questsCompleted = player.questsCompleted;
  playerStats.waterIntake = player.waterIntake;
  playerStats.achievements = player.achievements;

  // Prepare achievements display
  let achievementsHTML = '';
  if (!player.achievements || Object.keys(player.achievements).length === 0) {
    achievementsHTML = '<div class="profile-achievements-none">No achievements yet</div>';
  } else {
    achievementsHTML = '<div class="profile-achievements-list">';
    for (const [achId, achData] of Object.entries(player.achievements)) {
      const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achId);
      if (achievement) {
        const rankText = achData.currentRank === achievement.ranks.length ? "MAX" : achData.currentRank;
        achievementsHTML += `
          <div class="profile-achievement-item">
            <span class="achievement-name">${achievement.name}</span>
            <span class="achievement-rank">Rank ${rankText}</span>
          </div>`;
      }
    }
    achievementsHTML += '</div>';
  }

  // Generate profile HTML
  const profileContent = document.getElementById("profileContent");
  profileContent.innerHTML = `
    <div class="window-section">
      <div class="profile-header">
        <img src="${player.profile.picture}" alt="Profile Picture" class="profile-picture">
        <div class="profile-title" style="color: ${player.profile.titleColor || 'white'}">
          [${player.profile.title || "Novice"}] ${player.profile.name || "Unnamed Hunter"}
        </div>
      </div>
      <div class="profile-details">
        <div>Class: ${player.profile.class || "Hunter"}</div>
        <div>Rank: ${player.rank}</div>
        <div>Level: ${player.level}</div>
        <div>EXP: ${player.exp}/${getExpNeededForLevel(player.level)}</div>
        <div>Gold: ${player.gold}</div>
        <div>Daily Streak: ${player.streak} days</div>
        ${player.waterIntake?.streakDays > 0 ? `<div>Water Streak: ${player.waterIntake.streakDays} days</div>` : ''}
        <div>Quests Completed: ${player.questsCompleted}</div>
        <div>Bio: ${player.profile.bio || "No bio set"}</div>
        <div>Join Date: ${player.profile.joinDate?.toDate().toLocaleDateString() || "Unknown"}</div>
      </div>
      <div class="profile-achievements">
        <h3>Achievements:</h3>
        ${achievementsHTML}
      </div>
      <div class="profile-commands">
        <h3>Profile Commands:</h3>
        <div>!setname &lt;name&gt; - Set your hunter name</div>
        <div>!settitle &lt;title&gt; - Set your title</div>
        <div>!setbio &lt;text&gt; - Set your profile bio</div>
        <div>!setclass &lt;class&gt; - Set your hunter class</div>
      </div>
    </div>
  `;

  // Show the profile window
  windowSystem.showWindow("profileWindow");

  // Also print basic info to terminal for quick reference
  printToTerminal("\n=== PLAYER PROFILE ===", "system");
  printToTerminal(`[${player.profile.title || "Novice"}] ${player.profile.name || "Unnamed Hunter"}`, "info");
  printToTerminal(`Rank: ${player.rank} | Level: ${player.level} | Streak: ${player.streak} days`, "info");
  printToTerminal("Use !profile to view full details in window", "system");
}