// Don't import from script.js since it uses globals
// Use window.variable instead where needed

export async function showInventory() {
  // Access the variables through the window global object
  if (!window.isAuthenticated) {
    window.printToTerminal("You must !reawaken first.", "error");
    return;
  }

  const inventoryContent = document.getElementById("inventoryContent");
  if (!inventoryContent) {
    window.printToTerminal("Inventory UI element not found!", "error");
    return;
  }

  try {
    const playerRef = window.db.collection("players").doc(window.currentUser.uid);
    const playerDoc = await playerRef.get();
    
    if (!playerDoc.exists) {
      window.printToTerminal("Player data not found!", "error");
      inventoryContent.innerHTML = '<div class="window-section">Error loading inventory</div>';
      return;
    }

    const inventory = playerDoc.data().inventory || [];

    let html = '<div class="window-section">';
    if (inventory.length === 0) {
      html += '<div class="window-item">Your inventory is empty</div>';
    } else {
      inventory.forEach((item, index) => {
        const itemData = window.ITEMS[item.id] || {
          name: item.name || "Unknown Item",
          description: "No description available",
          consumable: false
        };
        
        const isUsed = item.used || false;
        const statusText = isUsed ? " (Used)" : itemData.consumable ? " (Available)" : " (Permanent)";
        
        html += `
          <div class="window-item${isUsed ? ' used' : ''}">
            <div class="window-item-title">${itemData.name}${statusText}</div>
            <div class="window-item-description">${itemData.description}</div>
            <div class="window-item-actions">
              ${
                !isUsed && itemData.consumable
                  ? `<button class="window-button" onclick="useInventoryItem('${item.id}', ${index})">Use</button>`
                  : isUsed
                  ? '<span class="item-status">Already Used</span>'
                  : '<span class="item-status">Permanent Item</span>'
              }
            </div>
          </div>
        `;
      });
    }
    html += '</div>';
    
    inventoryContent.innerHTML = html;
    window.windowSystem.showWindow("inventoryWindow");

  } catch (error) {
    console.error("Error loading inventory:", error);
    window.printToTerminal("Failed to load inventory: " + error.message, "error");
    inventoryContent.innerHTML = '<div class="window-section">Error loading inventory</div>';
  }
}

// Register the function on the window object so it can be called from script.js
window.showInventory = showInventory;