// background.js

console.log("Background script loaded.");

const injectedTabs = new Set();

// Create a context menu item to read selected text
chrome.contextMenus.create({
    id: "readSelectedText",
    title: "Read Selected Text",
    contexts: ["selection"]
}, () => {
    console.log("Read Selected Text menu item created.");
});

// Create a context menu item to stop audio
chrome.contextMenus.create({
    id: "stopAudio",
    title: "Stop Audio",
    contexts: ["selection"]
}, () => {
    console.log("Stop Audio menu item created.");
});

// Handle the context menu item clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log("Context menu item clicked:", info);
    if (info.menuItemId === "readSelectedText") {
        // Inject content script if not already injected
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
        // Send a message to the content script to read the selected text
        chrome.tabs.sendMessage(tab.id, { action: "readSelectedText" }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            }
        });
    } else if (info.menuItemId === "stopAudio") {
        // Send a message to the content script to stop audio
        chrome.tabs.sendMessage(tab.id, { action: "stopAudio" }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            }
        });
    }
});
