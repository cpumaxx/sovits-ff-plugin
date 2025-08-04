/**
 * Background script for SoVITS Screen Reader.
 * Handles commands, context menus, and manages character/emotion settings.
 */

console.log("SoVITS Screen Reader: Background script loaded.");

// Keep track of tabs where content script has been injected to avoid redundant injections
const injectedTabs = new Set();
// Keep track of processing status for tabs
const tabProcessingStatus = new Map();

// Listen for keyboard shortcuts defined in manifest.json
chrome.commands.onCommand.addListener(function(command) {
  console.log(`SoVITS Screen Reader: Command received: ${command}`);
  if (command === "read-selected-text") {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        processReadTextCommand(tabs[0]);
      } else {
        console.warn("SoVITS Screen Reader: No active tab found.");
      }
    });
  }
});

/**
 * Process the read text command for a tab
 * @param {Object} tab - The tab object
 */
function processReadTextCommand(tab) {
  // Send message to content script to read selected text
  chrome.tabs.sendMessage(tab.id, { action: "readSelectedText" }, function(response) {
    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error sending message to content script:", chrome.runtime.lastError.message);
      // If content script is not injected, inject it first
      injectContentScriptAndSendMessage(tab);
    } else {
      console.log("SoVITS Screen Reader: Message sent to content script successfully.");
    }
  });
}

/**
 * Sends the readSelectedText message to a tab's content script.
 * @param {number} tabId - The ID of the tab.
 */
function sendMessageAfterInjection(tabId) {
    chrome.tabs.sendMessage(tabId, { action: "readSelectedText" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error sending message to content script:", chrome.runtime.lastError.message);
        updateTabStatus(tabId, "error", "Failed to communicate with content script");
      } else {
        console.log("SoVITS Screen Reader: Message sent to content script.");
      }
    });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("SoVITS Screen Reader: Message received in content script:", request);

  if (request.action === "readSelectedText") {
    console.log("SoVITS Screen Reader: Processing readSelectedText action");
    // Get the selected text from the current page
    let selectedText = window.getSelection().toString().trim();

    if (!selectedText) {
      console.warn("SoVITS Screen Reader: No text selected.");
      updateStatus("error", "No text selected");
      return; // Exit early if no text is selected
    }

    console.log("SoVITS Screen Reader: Selected text:", selectedText);

    // Split the text into sentences
    const sentences = splitIntoSentences(selectedText);
    console.log("SoVITS Screen Reader: Split text into sentences:", sentences);

    // Process sentences sequentially to maintain order
    processSentencesSequentially(sentences);
  } else if (request.action === "stopAudio") {
    console.log("SoVITS Screen Reader: Stop audio command received.");
    // Stop the current audio and clear the queue
    stopAudio();
  }

  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Listen for changes to the characters list in storage
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'local' && changes.characters) {
    console.log("SoVITS Screen Reader: Characters list changed, updating context menus.");
    updateContextMenus();
  }
});

// Function to debug context menus (call this from console if needed)
function debugContextMenus() {
  chrome.contextMenus.getAll((menus) => {
    console.log("SoVITS Screen Reader: Current context menus:", menus);
  });
}

// Make it available globally for debugging
window.debugContextMenus = debugContextMenus;

// Initial loading of context menus
updateContextMenus();

/**
 * Updates the context menus based on characters stored in local storage.
 */
function updateContextMenus() {
  chrome.storage.local.get(['characters', 'selectedCharacterName', 'selectedEmotion', 'showProgressDisplay'], function(items) {
    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error retrieving data from storage:", chrome.runtime.lastError.message);
      return;
    }

    const characters = items && items.characters ? items.characters : [];
    const selectedCharacterName = items.selectedCharacterName || '';
    const selectedEmotion = items.selectedEmotion || '';
    const showProgressDisplay = items.showProgressDisplay !== undefined ? items.showProgressDisplay : true;

    console.log("SoVITS Screen Reader: Updating context menus with characters:", characters);

    // Remove all existing context menus
    chrome.contextMenus.removeAll(function() {
      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error removing context menus:", chrome.runtime.lastError.message);
        return;
      }

      // Create main context menu parent item
      chrome.contextMenus.create({
        id: "sovitsMainMenu",
        title: "SoVITS Screen Reader",
        contexts: ["selection"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("SoVITS Screen Reader: Error creating main menu:", chrome.runtime.lastError.message);
        } else {
          console.log("SoVITS Screen Reader: Main menu created successfully");
        }
      });

      // Use setTimeout to ensure proper sequencing of menu creation
      setTimeout(() => {
        // Create read text submenu with static title
        chrome.contextMenus.create({
          id: "readSelectedText",
          title: "Read Selected Text",
          parentId: "sovitsMainMenu",
          contexts: ["selection"]
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("SoVITS Screen Reader: Error creating 'Read Selected Text' menu:", chrome.runtime.lastError.message);
          } else {
            console.log("SoVITS Screen Reader: 'Read Selected Text' menu created successfully");
          }
        });

        // Create stop audio submenu with static title
        chrome.contextMenus.create({
          id: "stopAudio",
          title: "Stop Audio",
          parentId: "sovitsMainMenu",
          contexts: ["selection"]
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("SoVITS Screen Reader: Error creating 'Stop Audio' menu:", chrome.runtime.lastError.message);
          } else {
            console.log("SoVITS Screen Reader: 'Stop Audio' menu created successfully");
          }
        });

        // Create progress display toggle submenu
        chrome.contextMenus.create({
          id: "toggleProgressDisplay",
          title: showProgressDisplay ? "Hide Progress Display" : "Show Progress Display",
          parentId: "sovitsMainMenu",
          contexts: ["selection"]
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("SoVITS Screen Reader: Error creating 'Toggle Progress Display' menu:", chrome.runtime.lastError.message);
          } else {
            console.log("SoVITS Screen Reader: 'Toggle Progress Display' menu created successfully");
          }
        });

        // Create character selection submenu
        if (characters.length > 0) {
          chrome.contextMenus.create({
            id: "characterSelection",
            title: "Select Character/Emotion",
            parentId: "sovitsMainMenu",
            contexts: ["selection"]
          }, () => {
            if (chrome.runtime.lastError) {
              console.error("SoVITS Screen Reader: Error creating character selection menu:", chrome.runtime.lastError.message);
            } else {
              console.log("SoVITS Screen Reader: Character selection menu created successfully");
            }
          });

          // Create character and emotion sub-menus
          characters.forEach((character) => {
            if (character.emotions && character.emotions.length > 0) {
              // Create character submenu
              const characterMenuId = `character-${character.name}`;
              chrome.contextMenus.create({
                id: characterMenuId,
                title: character.name,
                parentId: "characterSelection",
                contexts: ["selection"]
              }, () => {
                if (chrome.runtime.lastError) {
                  console.error(`SoVITS Screen Reader: Error creating menu for character ${character.name}:`, chrome.runtime.lastError.message);
                } else {
                  console.log(`SoVITS Screen Reader: Character menu '${characterMenuId}' created successfully`);
                }
              });

              // Create emotion submenus for each character
              character.emotions.forEach(emotion => {
                // Sanitize emotion name for ID
                const sanitizedEmotionName = emotion.name.replace(/[^a-zA-Z0-9\-_]/g, "-");
                const emotionMenuId = `selectEmotion-${character.name}-${sanitizedEmotionName}`;
                chrome.contextMenus.create({
                  id: emotionMenuId,
                  title: emotion.name,
                  parentId: characterMenuId,
                  contexts: ["selection"]
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.error(`SoVITS Screen Reader: Error creating menu for emotion ${emotion.name} of character ${character.name}:`, chrome.runtime.lastError.message);
                  } else {
                    console.log(`SoVITS Screen Reader: Emotion menu '${emotionMenuId}' created successfully`);
                  }
                });
              });
            } else {
              console.warn(`SoVITS Screen Reader: Character ${character.name} has no emotions defined.`);
            }
          });
        }
      }, 100); // Small delay to ensure parent menu is created first
    });
  });
}

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("SoVITS Screen Reader: Context menu item clicked!");
  console.log("SoVITS Screen Reader: Full info object:", JSON.stringify(info, null, 2));
  console.log("SoVITS Screen Reader: Full tab object:", JSON.stringify(tab, null, 2));

  // Log the specific menu item ID
  console.log("SoVITS Screen Reader: Menu item ID:", info.menuItemId);
  console.log("SoVITS Screen Reader: Menu item type:", typeof info.menuItemId);

  // Check different possible values
  if (info.menuItemId === "readSelectedText") {
    console.log("SoVITS Screen Reader: MATCHED 'readSelectedText' exactly!");
    processReadTextContextMenu(tab);
  } else if (info.menuItemId === "stopAudio") {
    console.log("SoVITS Screen Reader: MATCHED 'stopAudio' exactly!");
    processStopAudioContextMenu(tab);
  } else if (info.menuItemId === "toggleProgressDisplay") {
    console.log("SoVITS Screen Reader: MATCHED 'toggleProgressDisplay' exactly!");
    toggleProgressDisplay();
  } else if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith("selectEmotion-")) {
    console.log("SoVITS Screen Reader: MATCHED selectEmotion pattern!");
    processCharacterSelection(info.menuItemId);
  } else {
    console.log("SoVITS Screen Reader: No match found for menu item ID:", info.menuItemId);
    // Let's try some debugging - list all possible menu items
    console.log("SoVITS Screen Reader: Checking if this might be 'readSelectedText' with different formatting...");
    if (info.menuItemId && info.menuItemId.toLowerCase().includes("read") && info.menuItemId.toLowerCase().includes("text")) {
      console.log("SoVITS Screen Reader: Found potential read text match:", info.menuItemId);
      processReadTextContextMenu(tab);
    }
  }
});

function processReadTextContextMenu(tab) {
  console.log("SoVITS Screen Reader: Processing 'Read Selected Text' menu item");
  console.log("SoVITS Screen Reader: Tab ID:", tab ? tab.id : "No tab object");

  // Ensure we have a valid tab with ID
  if (tab && tab.id) {
    console.log(`SoVITS Screen Reader: Calling injectContentScriptAndSendMessage for tab ${tab.id}`);
    injectContentScriptAndSendMessage(tab);
  } else {
    console.error("SoVITS Screen Reader: Invalid tab object in context menu handler");
  }
}

function processStopAudioContextMenu(tab) {
  console.log("SoVITS Screen Reader: Processing 'Stop Audio' menu item");
  // Send stop audio command to content script
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "stopAudio" }, () => {
      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error sending stopAudio message:", chrome.runtime.lastError.message);
      } else {
        console.log("SoVITS Screen Reader: stopAudio message sent successfully");
      }
    });
  } else {
    console.error("SoVITS Screen Reader: Invalid tab object for stopAudio");
  }
}

function processCharacterSelection(menuItemId) {
  console.log("SoVITS Screen Reader: Processing character/emotion selection");
  // Parse character and emotion from menu item ID
  const parts = menuItemId.split("-");
  if (parts.length >= 3 && parts[0] === "selectEmotion") {
    // parts[1] is the character name, parts[2+] is the emotion name (with spaces replaced by hyphens)
    const characterName = parts[1];
    // Reconstruct emotion name, handling potential hyphens
    const emotionName = parts.slice(2).join("-").replace(/-/g, " ");
    console.log(`SoVITS Screen Reader: Selected character: ${characterName}, emotion: ${emotionName}`);
    setSelectedCharacter(characterName, emotionName);
  } else {
    console.error("SoVITS Screen Reader: Malformed selectEmotion menu item ID:", menuItemId);
  }
}

/**
 * Sets the selected character and emotion in local storage.
 * @param {string} characterName - The name of the character.
 * @param {string} emotionName - The name of the emotion.
 */
function setSelectedCharacter(characterName, emotionName) {
  chrome.storage.local.set({ selectedCharacterName: characterName, selectedEmotion: emotionName }, function() {
    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error saving selected character/emotion to storage:", chrome.runtime.lastError.message);
    } else {
      console.log(`SoVITS Screen Reader: Selected character: ${characterName}, Emotion: ${emotionName}`);
    }
  });
}

/**
 * Sets default character and emotion selections on startup.
 */
function setDefaultSelections() {
  chrome.storage.local.get(['characters', 'selectedCharacterName', 'selectedEmotion', 'showProgressDisplay'], function(items) {
    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error retrieving default selections from storage:", chrome.runtime.lastError.message);
      return;
    }

    const characters = items.characters || [];
    const selectedCharacterName = items.selectedCharacterName;
    const selectedEmotion = items.selectedEmotion;
    const showProgressDisplay = items.showProgressDisplay !== undefined ? items.showProgressDisplay : true; // Default to true

    console.log("SoVITS Screen Reader: Setting default selections. Characters:", characters.length, "Selected Character:", selectedCharacterName, "Selected Emotion:", selectedEmotion, "Show Progress:", showProgressDisplay);

    if (characters.length === 0) {
      console.log("SoVITS Screen Reader: No characters defined in storage.");
      return;
    }

    // If no character or emotion is selected, default to the first one
    if (!selectedCharacterName || !selectedEmotion) {
      const firstChar = characters[0];
      const firstEmotion = firstChar.emotions && firstChar.emotions.length > 0 ? firstChar.emotions[0].name : 'default';
      console.log(`SoVITS Screen Reader: No selection found, defaulting to character '${firstChar.name}' and emotion '${firstEmotion}'.`);
      setSelectedCharacter(firstChar.name, firstEmotion);
      // Don't update menu title to keep it static
    }

    // Save the default progress display setting if not set
    if (items.showProgressDisplay === undefined) {
      chrome.storage.local.set({ showProgressDisplay: true }, function() {
        if (chrome.runtime.lastError) {
          console.error("SoVITS Screen Reader: Error saving default progress display setting:", chrome.runtime.lastError.message);
        } else {
          console.log("SoVITS Screen Reader: Default progress display setting saved.");
        }
      });
    }
    // Don't update menu title even if selections exist to keep it static
  });
}

// Call setDefaultSelections when background script loads
setDefaultSelections();

/**
 * Update the processing status for a tab
 * @param {number} tabId - The ID of the tab
 * @param {string} status - The status (idle, processing, stopping, error)
 * @param {string} message - Status message
 */
function updateTabStatus(tabId, status, message) {
  tabProcessingStatus.set(tabId, { status, message, timestamp: Date.now() });

  // Remove dynamic menu updates to prevent interference
  // The menu items will keep their static titles

  // Clean up old status entries (older than 5 minutes)
  const now = Date.now();
  for (const [id, statusObj] of tabProcessingStatus.entries()) {
    if (now - statusObj.timestamp > 300000) { // 5 minutes
      tabProcessingStatus.delete(id);
    }
  }
}

/**
 * Injects content script into a tab and sends the readSelectedText message.
 * @param {Object} tab - The tab object.
 */
function injectContentScriptAndSendMessage(tab) {
  // Validate tab object
  if (!tab || !tab.id) {
    console.error("SoVITS Screen Reader: Invalid tab object passed to injectContentScriptAndSendMessage");
    return;
  }

  console.log(`SoVITS Screen Reader: Checking if content script is already injected in tab ${tab.id}`);

  // Check if content script is already injected by sending a test message
  chrome.tabs.sendMessage(tab.id, { action: "ping" }, (response) => {
    if (chrome.runtime.lastError) {
      // Content script is not injected or not responding
      console.log(`SoVITS Screen Reader: Content script not found in tab ${tab.id}, injecting now`);
      chrome.tabs.executeScript(tab.id, {
        file: "content.js"
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("SoVITS Screen Reader: Error injecting content script:", chrome.runtime.lastError.message);
          updateTabStatus(tab.id, "error", "Failed to inject content script");
        } else {
          console.log(`SoVITS Screen Reader: Content script injected into tab ${tab.id}`);
          // Add a small delay to ensure content script is fully loaded
          setTimeout(() => {
            sendMessageAfterInjection(tab.id);
          }, 100);
        }
      });
    } else {
      // Content script is already injected and responding
      console.log(`SoVITS Screen Reader: Content script already injected in tab ${tab.id}, sending message directly`);
      sendMessageAfterInjection(tab.id);
    }
  });
}

/**
 * Toggles the progress display setting and updates the context menu
 */
function toggleProgressDisplay() {
  chrome.storage.local.get(['showProgressDisplay'], function(items) {
    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error retrieving progress display setting:", chrome.runtime.lastError.message);
      return;
    }

    const currentSetting = items.showProgressDisplay !== undefined ? items.showProgressDisplay : true;
    const newSetting = !currentSetting;

    chrome.storage.local.set({ showProgressDisplay: newSetting }, function() {
      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error saving progress display setting:", chrome.runtime.lastError.message);
      } else {
        console.log(`SoVITS Screen Reader: Progress display setting toggled to: ${newSetting}`);

        // If progress display was toggled, send message to content script to change display visiblity
        if (!newSetting) {
          // Get active tab to send message to content script
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "toggleProgressDisplay" }, function(response) {
                if (chrome.runtime.lastError) {
                  // This is expected if content script isn't loaded
                  console.log("SoVITS Screen Reader: Content script not available to toggle progress display");
                } else {
                  console.log("SoVITS Screen Reader: Sent toggle progress display message to content script");
                }
              });
            }
          });
        }

        // Update context menus to reflect the new setting
        updateContextMenus();
      }
    });
  });
}

