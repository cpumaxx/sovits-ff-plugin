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
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }, function(response) {
        if (response && response.selectedText) {
          const text = response.selectedText;
          sendTextToBackend(text, requestSequence++);
        }
      });
    }
  });
}

let requestSequence = 0;
const audioQueue = [];

function sendTextToBackend(text, sequence) {
  getAudioFromBackend(text, function(audioData) {
    handleAudioResponse(audioData, sequence);
  });
}

function getAudioFromBackend(text, callback) {
  setTimeout(function() {
    const audioData = `audio_for_${text}`;
    callback(audioData);
  }, Math.random() * 3000);
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
  setTimeout(playNextAudio, 1000);
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
    updateContextMenuTitle(characterIndex, emotionName);
  });
}

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

chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'local' && changes.characters) {
    updateContextMenus();
  }
});

// Initial loading of context menus
updateContextMenus();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu item clicked:", info);
  if (info.menuItemId === "readSelectedText") {
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
    chrome.tabs.sendMessage(tab.id, { action: "readSelectedText" }, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      }
    });
  } else if (info.menuItemId === "stopAudio") {
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

function updateContextMenuTitle(characterIndex, emotionName) {
  const title = `Read Selected Text - ${characterIndex}/${emotionName}`;
  chrome.contextMenus.update("readSelectedText", { title: title });
}

// Function to set default selections on startup
function setDefaultSelections() {
  chrome.storage.local.get(['characters', 'selectedCharacterIndex', 'selectedEmotion'], function(items) {
    const characters = items.characters || [];
    const selectedCharacterIndex = items.selectedCharacterIndex;
    const selectedEmotion = items.selectedEmotion;

    if (characters.length === 0) {
      console.log("No characters defined.");
      return;
    }

    if (!selectedCharacterIndex || !selectedEmotion) {
      const firstChar = characters[0];
      const firstEmotion = firstChar.emotions ? firstChar.emotions[0].name : 'default';
      setSelectedCharacter(firstChar.name, firstEmotion);
      updateContextMenuTitle(firstChar.name, firstEmotion);
      return;
    }
    updateContextMenuTitle(selectedCharacterIndex, selectedEmotion);
  });
}

// Call setDefaultSelections when background script loads
setDefaultSelections();

