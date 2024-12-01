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

function readSelectedText(tab) {
  // Get the selected text
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, function(response) {
        if (response && response.selectedText) {
          const text = response.selectedText;
          // Send the text to the backend with a sequence number
          const sequence = requestSequence++;
          sendTextToBackend(text, sequence);
        }
      });
    }
  });
}

let requestSequence = 0;
const audioQueue = [];

function sendTextToBackend(text, sequence) {
  // Simulate sending text to backend and getting audio back (replace with actual API call)
  getAudioFromBackend(text, function(audioData) {
    // Handle the audio response with the associated sequence number
    handleAudioResponse(audioData, sequence);
  });
}  
function getAudioFromBackend(text, callback) {
  // Replace this with actual API call to get audio from backend
  setTimeout(function() {
    const audioData = `audio_for_${text}`;
    callback(audioData);
  }, Math.random() * 3000); // Simulate variable response time
}  
function handleAudioResponse(audioData, sequence) {
  audioQueue.push({ sequence: sequence, audio: audioData });
  audioQueue.sort((a, b) => a.sequence - b.sequence);
  playNextAudio();
}  
function playNextAudio() {
  if (audioQueue.length > 0 && audioQueue[0].sequence === requestSequence - audioQueue.length) {
    const audioItem = audioQueue.shift();
    playAudio(audioItem.audio);
  }
}  
function playAudio(audioData) {
  console.log(`Playing audio: ${audioData}`);
  // Replace with actual audio playback code
  setTimeout(playNextAudio, 1000); // Simulate audio playback duration
}  
chrome.commands.onCommand.addListener(function(command) {
  if (command === "read-selected-text") {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        readSelectedText(tabs[0]);
      }
    });
  }
});  
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "readSelectedText") {
    readSelectedText(tab);
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
    if (parts.length >= 3 && parts[0] === "selectEmotion") {
      const characterIndex = parts[1];
      const emotionName = parts.slice(2).join(" ");
      setSelectedCharacter(characterIndex, emotionName);
    }
  }
});

