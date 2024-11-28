console.log("Background script loaded.");

const injectedTabs = new Set();

   chrome.commands.onCommand.addListener(function(command) {
     if (command === "read-selected-text") {
       chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
         if (tabs[0]) {
           chrome.tabs.sendMessage(tabs[0].id, { action: "readSelectedText" });
         }
       });
     }
   });

function setSelectedCharacter(characterIndex, emotionName) {
  chrome.storage.local.set({ selectedCharacterIndex: characterIndex, selectedEmotion: emotionName }, function() {
    console.log(`Selected character index: ${characterIndex}, Emotion: ${emotionName}`);
  });
}

// Function to update context menus
function updateContextMenus() {
  chrome.storage.local.get('characters', function(items) {
    const characters = items && items.characters ? items.characters : [];
    chrome.contextMenus.removeAll(function() {
      chrome.contextMenus.create({
        id: "readSelectedText",
        title: "Read Selected Text",
        contexts: ["selection"]
      });
      chrome.contextMenus.create({
        id: "stopAudio",
        title: "Stop Audio",
        contexts: ["selection"]
      });

      characters.forEach((character, index) => {
        chrome.contextMenus.create({
          id: `selectCharacter-${character.name}`,
          title: `Select Character: ${character.name}`,
          contexts: ["selection"]
        });
        if (character.emotions) {
          character.emotions.forEach(emotion => {
            chrome.contextMenus.create({
              id: `selectEmotion-${character.name}-${emotion.name.replace(/ /g, '-')}`,
              title: emotion.name,
              parentId: `selectCharacter-${character.name}`,
              contexts: ["selection"]
            });
          });
        }
      });
    });
  });
}

// Listen for storage changes to update context menus
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'local' && changes.characters) {
    updateContextMenus();
  }
});

// Initial loading of context menus
updateContextMenus();

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
  } else if (info.menuItemId.startsWith("selectEmotion-")) {
    const parts = info.menuItemId.split("-");
    if (parts.length >= 4 && parts[0] === "selectEmotion") {
      const characterIndex = parts[1];
      const emotionName = parts.slice(2).join(" ");
      setSelectedCharacter(characterIndex, emotionName);
    }
  }
});
