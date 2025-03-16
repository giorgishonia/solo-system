import { windowSystem } from './windowSystem.js';
import { printToTerminal } from './terminal.js';

export function showNotification(message, type = "info") {
    const notification = document.getElementById("notification");
    const content = notification.querySelector(".notification-content");
    
    notification.className = `notification ${type}`;
    content.textContent = message;
    
    notification.classList.remove("slide-in", "slide-out");
    
    // Show notification and start slide-in
    notification.style.display = "block";
    notification.classList.add("slide-in");
    
    // Set timeout to start slide-out
    setTimeout(() => {
        notification.classList.remove("slide-in");
        notification.classList.add("slide-out");
        
        // Hide notification after slide-out animation
        setTimeout(() => {
            notification.style.display = "none";
            notification.classList.remove("slide-out");
        }, 500);
    }, 3000);
}

export function showNotificationsWindow() {
    windowSystem.showWindow("notificationsWindow");
}

export async function markNotificationAsRead(notificationId) {
    try {
        const notificationRef = db.collection("notifications")
            .doc(currentUser.uid)
            .collection("userNotifications")
            .doc(notificationId);
            
        await notificationRef.update({
            read: true
        });
        
        // Update UI
        windowSystem.updateNotificationsWindow();
        windowSystem.getUnreadNotificationsCount();
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

export async function markAllNotificationsAsRead() {
    try {
        const notificationsRef = db.collection("notifications")
            .doc(currentUser.uid)
            .collection("userNotifications");
            
        const snapshot = await notificationsRef.where("read", "==", false).get();
        
        if (snapshot.empty) {
            showNotification("No unread notifications");
            return;
        }
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        
        await batch.commit();
        
        // Update UI
        windowSystem.updateNotificationsWindow();
        windowSystem.getUnreadNotificationsCount();
        showNotification("All notifications marked as read");
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        printToTerminal("Error marking notifications as read: " + error.message, "error");
    }
}

export async function deleteAllNotifications() {
    try {
        const notificationsRef = db.collection("notifications")
            .doc(currentUser.uid)
            .collection("userNotifications");
            
        const snapshot = await notificationsRef.get();
        
        if (snapshot.empty) {
            showNotification("No notifications to delete");
            return;
        }
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Update UI
        windowSystem.updateNotificationsWindow();
        windowSystem.getUnreadNotificationsCount();
        showNotification("All notifications deleted");
    } catch (error) {
        console.error("Error deleting all notifications:", error);
        printToTerminal("Error deleting notifications: " + error.message, "error");
    }
}

export async function getUnreadNotificationsCount() {
    try {
        const notificationsRef = db.collection("notifications")
            .doc(currentUser.uid)
            .collection("userNotifications");
            
        const snapshot = await notificationsRef.where("read", "==", false).get();
        return snapshot.size;
    } catch (error) {
        console.error("Error getting unread notifications count:", error);
        return 0;
    }
}

export function updateNotificationBadge(count) {
    const badge = document.querySelector(".notification-badge");
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = "block";
        } else {
            badge.style.display = "none";
        }
    }
    
    // Update taskbar icon
    const taskbarItem = document.querySelector(".taskbar-item[data-window='notificationsWindow']");
    if (taskbarItem) {
        if (count > 0) {
            taskbarItem.classList.add("has-notifications");
        } else {
            taskbarItem.classList.remove("has-notifications");
        }
    }
} 