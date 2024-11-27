// background.js

console.log("Background script loaded.");

const injectedTabs = new Set();

// Create a context menu item
chrome.contextMenus.create({
    id: "readSelectedText",
    title: "Read Selected Text",
    contexts: ["selection"]
}, () => {
    console.log("Context menu item created.");
});

// Handle the context menu item click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log("Context menu item clicked:", info);
    if (info.menuItemId === "readSelectedText") {
        // Inject content script only if not already injected
        if (!injectedTabs.has(tab.id)) {
            chrome.tabs.executeScript(tab.id, {
                file: "content.js"
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                } else {
                    injectedTabs.add(tab.id);
                }
            });
        }
        // Send a message to the content script
        chrome.tabs.sendMessage(tab.id, { action: "readSelectedText" }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            }
        });
    }
});
