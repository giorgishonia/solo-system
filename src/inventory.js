
export async function showInventory() {
    if (!isAuthenticated) {
      printToTerminal("You must !reawaken first.", "error");
      return;
    }
    windowSystem.showWindow("inventoryWindow");
  } 