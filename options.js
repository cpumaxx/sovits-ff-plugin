/**
 * Options page script for SoVITS Screen Reader.
 * Handles configuration of backend URL and character/emotion management.
 */

// Define language options for dropdowns
const langOptions = [
  "auto", "auto_yue", "en", "zh", "ja", "yue", "ko", "all_zh", "all_ja", "all_yue", "all_ko"
];

// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', function() {
  console.log("SoVITS Screen Reader: Options page loaded.");

  // --- Attach Event Listeners ---
  document.getElementById('save').addEventListener('click', saveBackendUrl);
  document.getElementById('testConnection').addEventListener('click', testBackendConnection);
  document.getElementById('newCharacter').addEventListener('click', newCharacter);
  document.getElementById('editCharacter').addEventListener('click', editCharacter);
  document.getElementById('removeCharacter').addEventListener('click', removeCharacter);
  document.getElementById('saveCharacter').addEventListener('click', saveCharacter);
  document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
  document.getElementById('addEmotion').addEventListener('click', addEmotion);
  document.getElementById('exportSettings').addEventListener('click', exportSettings);
  document.getElementById('importSettings').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('characterList').addEventListener('change', updateCharacterDetails);

  // --- Load Initial Data ---
  loadBackendUrl();
  loadCharacters();
  // updateCharacterDetails will be called when a character is selected in the list
});

/**
 * Shows a loading spinner on a button
 * @param {HTMLElement} button - The button element
 */
function showButtonLoading(button) {
  const spinner = button.querySelector('.loading-spinner');
  const text = button.querySelector('.btn-text');

  if (spinner && text) {
    spinner.classList.remove('hidden');
    text.classList.add('hidden');
  }

  button.disabled = true;
}

/**
 * Hides a loading spinner on a button
 * @param {HTMLElement} button - The button element
 */
function hideButtonLoading(button) {
  const spinner = button.querySelector('.loading-spinner');
  const text = button.querySelector('.btn-text');

  if (spinner && text) {
    spinner.classList.add('hidden');
    text.classList.remove('hidden');
  }

  button.disabled = false;
}

/**
 * Shows global progress indicator
 * @param {string} message - Progress message
 */
function showGlobalProgress(message = "Processing...") {
  const progress = document.getElementById('globalProgress');
  const text = progress.querySelector('.progress-text');

  text.textContent = message;
  progress.classList.remove('hidden');

  // Animate progress bar
  const fill = progress.querySelector('.progress-fill');
  fill.style.width = '30%';

  setTimeout(() => {
    fill.style.width = '70%';
  }, 300);
}

/**
 * Hides global progress indicator
 */
function hideGlobalProgress() {
  const progress = document.getElementById('globalProgress');
  const fill = progress.querySelector('.progress-fill');

  fill.style.width = '100%';

  setTimeout(() => {
    progress.classList.add('hidden');
    fill.style.width = '0%';
  }, 300);
}

/**
 * Updates the character details editor based on the selected character in the list.
 */
function updateCharacterDetails() {
  const characterList = document.getElementById('characterList');
  const selectedIndex = characterList.selectedIndex;
  console.log(`SoVITS Screen Reader: Character list selection changed. Index: ${selectedIndex}`);

  if (selectedIndex >= 0) {
    const selectedCharacterName = characterList.options[selectedIndex].value;
    console.log(`SoVITS Screen Reader: Selected character name: ${selectedCharacterName}`);

    chrome.storage.local.get('characters', function(items) {
      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error retrieving characters for details:", chrome.runtime.lastError.message);
        showStatusMessage("Failed to load character details.", 'error');
        return;
      }

      const characters = items && items.characters ? items.characters : [];
      const selectedChar = characters.find(char => char.name === selectedCharacterName);

      if (selectedChar) {
        console.log("SoVITS Screen Reader: Found character details:", selectedChar);
        document.getElementById('characterName').value = selectedChar.name || '';
        populateEmotionsGrid(selectedChar.emotions || []);
      } else {
        console.error('SoVITS Screen Reader: Selected character not found in storage:', selectedCharacterName);
        showStatusMessage(`Character '${selectedCharacterName}' not found.`, 'error');
      }
    });
  } else {
    console.log('SoVITS Screen Reader: No character selected in the list.');
    // Clear the editor if nothing is selected
    document.getElementById('characterName').value = '';
    clearEmotionsGrid();
  }
}

/**
 * Loads the backend URL from storage and populates the input field.
 */
function loadBackendUrl() {
  const spinner = document.getElementById('backendUrlSpinner');
  spinner.classList.remove('hidden');

  chrome.storage.local.get('backendUrl', function(items) {
    spinner.classList.add('hidden');

    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error loading backend URL:", chrome.runtime.lastError.message);
      showStatusMessage("Error loading backend URL.", 'error');
      return;
    }

    const backendUrl = items && items.backendUrl ? items.backendUrl : '';
    console.log("SoVITS Screen Reader: Loaded backend URL:", backendUrl);
    document.getElementById('backendUrl').value = backendUrl;

    // If a URL was loaded, attempt to fetch backend files for autocomplete
    if (backendUrl) {
      fetchBackendFiles();
    }
  });
}

/**
 * Saves the backend URL entered in the input field to storage.
 */
function saveBackendUrl() {
  const saveButton = document.getElementById('save');
  showButtonLoading(saveButton);

  const backendUrlInput = document.getElementById('backendUrl');
  let backendUrl = backendUrlInput.value.trim();

  // Basic URL validation (can be improved)
  if (backendUrl && !backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
    // Prepend http:// if no protocol is specified
    backendUrl = 'http://' + backendUrl;
    backendUrlInput.value = backendUrl; // Update the input field
  }

  console.log("SoVITS Screen Reader: Saving backend URL:", backendUrl);

  chrome.storage.local.set({ backendUrl: backendUrl }, function() {
    hideButtonLoading(saveButton);

    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error saving backend URL:", chrome.runtime.lastError.message);
      showStatusMessage("Error saving backend URL.", 'error');
    } else {
      console.log('SoVITS Screen Reader: Backend URL saved successfully.');
      showStatusMessage('Backend URL saved successfully.', 'success');
      // Fetch backend files for autocomplete after saving
      fetchBackendFiles();
    }
  });
}

/**
 * Tests the connection to the backend server
 */
function testBackendConnection() {
  const testButton = document.getElementById('testConnection');
  showButtonLoading(testButton);

  const backendUrl = document.getElementById('backendUrl').value.trim();

  if (!backendUrl) {
    hideButtonLoading(testButton);
    showStatusMessage("Please enter a backend URL first.", 'warning');
    return;
  }

  showStatusMessage("Testing connection...", 'info');

  // Test connection by fetching list_audio_files endpoint
  fetch(`${backendUrl}/list_audio_files`, { method: 'GET', timeout: 5000 })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    })
    .then(data => {
      hideButtonLoading(testButton);
      showStatusMessage(`Connection successful!`, 'success');
    })
    .catch(error => {
      hideButtonLoading(testButton);
      console.error("SoVITS Screen Reader: Backend connection test failed:", error);
      showStatusMessage(`Connection failed: ${error.message}`, 'error');
    });
}

/**
 * Displays a temporary status message.
 * @param {string} message - The message to display.
 * @param {string} type - Type of message ('success', 'error', 'info', 'warning'). Defaults to 'success'.
 */
function showStatusMessage(message, type = 'success') {
  const statusElement = document.getElementById('statusMessage');

  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;

    // Clear the message after a few seconds
    setTimeout(() => {
      statusElement.className = 'status-message hidden';
    }, 5000);
  }
}

/**
 * Displays import status message.
 * @param {string} message - The message to display.
 * @param {string} type - Type of message ('success', 'error', 'info', 'warning').
 */
function showImportStatusMessage(message, type = 'success') {
  const statusElement = document.getElementById('importStatus');

  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;

    // Clear the message after a few seconds
    setTimeout(() => {
      statusElement.className = 'status-message hidden';
    }, 5000);
  }
}

/**
 * Loads the list of characters from storage and populates the character list dropdown.
 */
function loadCharacters() {
  const spinner = document.getElementById('characterListSpinner');
  spinner.classList.remove('hidden');

  chrome.storage.local.get(['characters'], function(items) {
    spinner.classList.add('hidden');

    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error loading characters list:", chrome.runtime.lastError.message);
      showStatusMessage("Failed to load characters list.", 'error');
      return;
    }

    let characters = items && items.characters ? items.characters : [];
    console.log("SoVITS Screen Reader: Loaded characters list:", characters);
    populateCharacterList(characters);
  });
}

/**
 * Populates the character list dropdown with character names.
 * @param {Array} characters - Array of character objects.
 */
function populateCharacterList(characters) {
  const characterList = document.getElementById('characterList');
  characterList.innerHTML = ''; // Clear existing options
  characters.forEach(char => {
    const option = document.createElement('option');
    option.text = char.name;
    option.value = char.name;
    characterList.add(option);
  });
  console.log(`SoVITS Screen Reader: Populated character list with ${characters.length} characters.`);
}

/**
 * Handles the 'New Character' button click.
 */
function newCharacter() {
  const newCharButton = document.getElementById('newCharacter');
  showButtonLoading(newCharButton);

  console.log("SoVITS Screen Reader: Creating new character.");
  // Clear the character name input
  document.getElementById('characterName').value = '';
  // Clear the emotions grid
  clearEmotionsGrid();
  // Show the character details editor
  toggleCharacterEditor(true); // true indicates it's a new character

  setTimeout(() => {
    hideButtonLoading(newCharButton);
  }, 300);
}

/**
 * Handles the 'Edit Character' button click.
 */
function editCharacter() {
  const editCharButton = document.getElementById('editCharacter');
  showButtonLoading(editCharButton);

  const characterList = document.getElementById('characterList');
  if (characterList.selectedIndex < 0) {
    hideButtonLoading(editCharButton);
    showStatusMessage("Please select a character to edit.", 'warning');
    return;
  }
  console.log("SoVITS Screen Reader: Editing selected character.");
  // updateCharacterDetails() will populate the fields based on the selection
  // We just need to show the editor
  toggleCharacterEditor(false); // false indicates it's an edit

  setTimeout(() => {
    hideButtonLoading(editCharButton);
  }, 300);
}

/**
 * Handles the 'Remove Character' button click.
 */
function removeCharacter() {
  const removeCharButton = document.getElementById('removeCharacter');
  showButtonLoading(removeCharButton);

  const characterList = document.getElementById('characterList');
  const selectedIndex = characterList.selectedIndex;
  if (selectedIndex < 0) {
    hideButtonLoading(removeCharButton);
    showStatusMessage("Please select a character to remove.", 'warning');
    return;
  }

  const selectedCharacterName = characterList.options[selectedIndex].value;
  console.log(`SoVITS Screen Reader: Removing character: ${selectedCharacterName}`);

  const confirmation = confirm(`Are you sure you want to remove the character '${selectedCharacterName}'?`);
  if (!confirmation) {
    hideButtonLoading(removeCharButton);
    return;
  }

  chrome.storage.local.get('characters', function(items) {
    if (chrome.runtime.lastError) {
      hideButtonLoading(removeCharButton);
      console.error("SoVITS Screen Reader: Error retrieving characters for removal:", chrome.runtime.lastError.message);
      showStatusMessage("Failed to remove character.", 'error');
      return;
    }

    const characters = items && items.characters ? items.characters : [];
    // Filter out the character to be removed
    const updatedCharacters = characters.filter(char => char.name !== selectedCharacterName);

    chrome.storage.local.set({ characters: updatedCharacters }, function() {
      hideButtonLoading(removeCharButton);

      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error saving updated characters list:", chrome.runtime.lastError.message);
        showStatusMessage("Failed to remove character.", 'error');
      } else {
        console.log(`SoVITS Screen Reader: Character '${selectedCharacterName}' removed successfully.`);
        showStatusMessage(`Character '${selectedCharacterName}' removed successfully.`, 'success');
        loadCharacters(); // Reload the character list
        // Hide the editor if it was for the removed character
        if (document.getElementById('characterDetails').style.display !== 'none') {
            const editingCharName = document.getElementById('characterName').value;
            if (editingCharName === selectedCharacterName) {
                toggleCharacterEditor(false); // Hide editor
                clearEmotionsGrid();
            }
        }
        // Update context menus in the background script
        updateContextMenus();
      }
    });
  });
}

/**
 * Saves the character currently being edited (new or existing).
 */
function saveCharacter() {
  const saveCharButton = document.getElementById('saveCharacter');
  showButtonLoading(saveCharButton);

  const characterNameInput = document.getElementById('characterName');
  const characterName = characterNameInput.value.trim();
  const emotions = getEmotionsFromGrid();

  console.log("SoVITS Screen Reader: Saving character:", characterName, emotions);

  // Validate input
  if (!characterName) {
    hideButtonLoading(saveCharButton);
    showStatusMessage('Character name is required.', 'warning');
    characterNameInput.focus();
    return;
  }

  if (emotions.length === 0) {
    hideButtonLoading(saveCharButton);
    showStatusMessage('At least one emotion is required.', 'warning');
    return;
  }

  // Validate emotions
  for (let i = 0; i < emotions.length; i++) {
    const emotion = emotions[i];
    if (!emotion.name) {
        hideButtonLoading(saveCharButton);
        showStatusMessage(`Emotion name is required for emotion ${i + 1}.`, 'warning');
        return;
    }
    if (!emotion.text_lang) {
        hideButtonLoading(saveCharButton);
        showStatusMessage(`Text language is required for emotion '${emotion.name}'.`, 'warning');
        return;
    }
    if (!emotion.ref_audio_path) {
        hideButtonLoading(saveCharButton);
        showStatusMessage(`Reference audio path is required for emotion '${emotion.name}'.`, 'warning');
        return;
    }
    if (!emotion.prompt_lang) {
        hideButtonLoading(saveCharButton);
        showStatusMessage(`Prompt language is required for emotion '${emotion.name}'.`, 'warning');
        return;
    }
    if (!emotion.prompt_text) {
        hideButtonLoading(saveCharButton);
        showStatusMessage(`Prompt text is required for emotion '${emotion.name}'.`, 'warning');
        return;
    }
    // Add checks for other fields if they become mandatory
  }

  chrome.storage.local.get('characters', function(items) {
    if (chrome.runtime.lastError) {
      hideButtonLoading(saveCharButton);
      console.error("SoVITS Screen Reader: Error retrieving characters for saving:", chrome.runtime.lastError.message);
      showStatusMessage("Failed to save character.", 'error');
      return;
    }

    let characters = items && items.characters ? items.characters : [];
    // Check if character already exists (by name)
    const existingCharacterIndex = characters.findIndex(char => char.name === characterName);

    const characterToSave = { name: characterName, emotions: emotions };

    if (existingCharacterIndex !== -1) {
      // Update existing character
      console.log(`SoVITS Screen Reader: Updating existing character at index ${existingCharacterIndex}.`);
      characters[existingCharacterIndex] = characterToSave;
    } else {
      // Add new character
      console.log("SoVITS Screen Reader: Adding new character.");
      characters.push(characterToSave);
    }

    chrome.storage.local.set({ characters: characters }, function() {
      hideButtonLoading(saveCharButton);

      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error saving character to storage:", chrome.runtime.lastError.message);
        showStatusMessage("Failed to save character.", 'error');
      } else {
        console.log('SoVITS Screen Reader: Character saved successfully.');
        showStatusMessage('Character saved successfully.', 'success');
        // Hide the editor
        toggleCharacterEditor(false);
        // Reload the character list
        loadCharacters();
        // Update context menus in the background script
        updateContextMenus();
      }
    });
  });
}

/**
 * Handles the 'Cancel' button click in the character editor.
 */
function cancelEdit() {
  const cancelEditButton = document.getElementById('cancelEdit');
  showButtonLoading(cancelEditButton);

  console.log("SoVITS Screen Reader: Cancelling character edit.");
  toggleCharacterEditor(false);
  clearEmotionsGrid();

  setTimeout(() => {
    hideButtonLoading(cancelEditButton);
  }, 300);
}

/**
 * Toggles the visibility of the character details editor.
 * @param {boolean} isNew - True if creating a new character, false if editing.
 */
function toggleCharacterEditor(isNew) {
  const characterDetails = document.getElementById('characterDetails');
  const emotionsGridContainer = document.getElementById('emotionsGridContainer');

  if (characterDetails.classList.contains('hidden') || isNew) {
    characterDetails.classList.remove('hidden');
    emotionsGridContainer.style.display = 'block';
    console.log("SoVITS Screen Reader: Character editor shown.");
  } else {
    characterDetails.classList.add('hidden');
    emotionsGridContainer.style.display = 'none';
    console.log("SoVITS Screen Reader: Character editor hidden.");
  }
  // Fetch backend files again when the editor is shown, in case the URL changed
  if (!characterDetails.classList.contains('hidden')) {
    fetchBackendFiles();
  }
}

/**
 * Adds a new, empty row to the emotions grid.
 */
function addEmotion() {
  const addEmotionButton = document.getElementById('addEmotion');
  showButtonLoading(addEmotionButton);

  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  const newRow = emotionsGridBody.insertRow();
  console.log("SoVITS Screen Reader: Adding new emotion row to grid.");

  // --- Emotion Name Cell ---
  const nameCell = newRow.insertCell(0);
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.classList.add('emotion-name');
  nameInput.placeholder = 'e.g., Happy';
  nameCell.appendChild(nameInput);

  // --- Text Lang Cell ---
  const textLangCell = newRow.insertCell(1);
  const textLangSelect = document.createElement('select');
  textLangSelect.classList.add('text-lang');
  // Populate options
  langOptions.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    textLangSelect.appendChild(option);
  });
  textLangSelect.value = 'en'; // Default text language
  textLangCell.appendChild(textLangSelect);

  // --- Ref Audio Path Cell ---
  const refAudioCell = newRow.insertCell(2);
  const refAudioInput = document.createElement('input');
  refAudioInput.type = 'text';
  refAudioInput.classList.add('ref-audio-path');
  refAudioInput.placeholder = 'Select or enter path';
  refAudioInput.setAttribute('list', 'audioFilesList');
  refAudioCell.appendChild(refAudioInput);

  // --- Prompt Lang Cell ---
  const promptLangCell = newRow.insertCell(3);
  const promptLangSelect = document.createElement('select');
  promptLangSelect.classList.add('prompt-lang');
  // Populate options
  langOptions.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    promptLangSelect.appendChild(option);
  });
  promptLangSelect.value = 'en'; // Default prompt language
  promptLangCell.appendChild(promptLangSelect);

  // --- Prompt Text Cell ---
  const promptTextCell = newRow.insertCell(4);
  const promptTextInput = document.createElement('input');
  promptTextInput.type = 'text';
  promptTextInput.classList.add('prompt-text');
  promptTextInput.placeholder = 'Enter prompt text';
  promptTextCell.appendChild(promptTextInput);

  // --- Action Cell ---
  const actionCell = newRow.insertCell(5);
  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove';
  removeButton.type = 'button'; // Prevent form submission
  removeButton.classList.add('btn', 'btn-outline');
  removeButton.addEventListener('click', function() {
    console.log("SoVITS Screen Reader: Removing emotion row from grid.");
    emotionsGridBody.deleteRow(newRow.rowIndex - 1); // Adjust for header row
  });
  actionCell.appendChild(removeButton);

  setTimeout(() => {
    hideButtonLoading(addEmotionButton);
  }, 300);
}

/**
 * Populates the emotions grid with existing emotion data.
 * @param {Array} emotions - Array of emotion objects.
 */
function populateEmotionsGrid(emotions) {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  emotionsGridBody.innerHTML = ''; // Clear existing rows
  console.log("SoVITS Screen Reader: Populating emotions grid with data:", emotions);

  emotions.forEach(emotion => {
    const newRow = emotionsGridBody.insertRow();

    // --- Emotion Name Cell ---
    const nameCell = newRow.insertCell(0);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.classList.add('emotion-name');
    nameInput.value = emotion.name || '';
    nameInput.placeholder = 'e.g., Happy';
    nameCell.appendChild(nameInput);

    // --- Text Lang Cell ---
    const textLangCell = newRow.insertCell(1);
    const textLangSelect = document.createElement('select');
    textLangSelect.classList.add('text-lang');
    langOptions.forEach(optionValue => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      if (optionValue === (emotion.text_lang || '')) {
        option.selected = true;
      }
      textLangSelect.appendChild(option);
    });
    textLangCell.appendChild(textLangSelect);

    // --- Ref Audio Path Cell ---
    const refAudioCell = newRow.insertCell(2);
    const refAudioInput = document.createElement('input');
    refAudioInput.type = 'text';
    refAudioInput.classList.add('ref-audio-path');
    refAudioInput.value = emotion.ref_audio_path || '';
    refAudioInput.placeholder = 'Select or enter path';
    refAudioInput.setAttribute('list', 'audioFilesList');
    refAudioCell.appendChild(refAudioInput);

    // --- Prompt Lang Cell ---
    const promptLangCell = newRow.insertCell(3);
    const promptLangSelect = document.createElement('select');
    promptLangSelect.classList.add('prompt-lang');
    langOptions.forEach(optionValue => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      if (optionValue === (emotion.prompt_lang || '')) {
        option.selected = true;
      }
      promptLangSelect.appendChild(option);
    });
    promptLangCell.appendChild(promptLangSelect);

    // --- Prompt Text Cell ---
    const promptTextCell = newRow.insertCell(4);
    const promptTextInput = document.createElement('input');
    promptTextInput.type = 'text';
    promptTextInput.classList.add('prompt-text');
    promptTextInput.value = emotion.prompt_text || '';
    promptTextInput.placeholder = 'Enter prompt text';
    promptTextCell.appendChild(promptTextInput);

    // --- Action Cell ---
    const actionCell = newRow.insertCell(5);
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.type = 'button'; // Prevent form submission
    removeButton.classList.add('btn', 'btn-outline');
    removeButton.addEventListener('click', function() {
      console.log(`SoVITS Screen Reader: Removing emotion '${emotion.name}' row from grid.`);
      emotionsGridBody.deleteRow(newRow.rowIndex - 1); // Adjust for header row
    });
    actionCell.appendChild(removeButton);
  });
}

/**
 * Retrieves the list of emotions from the emotions grid.
 * @returns {Array} An array of emotion objects.
 */
function getEmotionsFromGrid() {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  const emotions = [];
  console.log("SoVITS Screen Reader: Retrieving emotions from grid.");

  for (let i = 0; i < emotionsGridBody.rows.length; i++) {
    const row = emotionsGridBody.rows[i];
    const nameInput = row.cells[0].querySelector('.emotion-name');
    const textLangSelect = row.cells[1].querySelector('.text-lang');
    const refAudioInput = row.cells[2].querySelector('.ref-audio-path');
    const promptLangSelect = row.cells[3].querySelector('.prompt-lang');
    const promptTextInput = row.cells[4].querySelector('.prompt-text');
    // GPT and SoVITS inputs removed

    const emotion = {
      name: nameInput.value.trim(),
      text_lang: textLangSelect.value,
      ref_audio_path: refAudioInput.value.trim(),
      prompt_lang: promptLangSelect.value,
      prompt_text: promptTextInput.value.trim()
      // gpt and soVITS properties removed
    };

    // Only add emotion if it has a name (considering it a valid entry)
    if (emotion.name) {
      emotions.push(emotion);
    }
  }
  console.log("SoVITS Screen Reader: Retrieved emotions from grid:", emotions);
  return emotions;
}

/**
 * Clears all rows from the emotions grid.
 */
function clearEmotionsGrid() {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  emotionsGridBody.innerHTML = '';
  console.log("SoVITS Screen Reader: Emotions grid cleared.");
}

/**
 * Sends a message to the background script to update context menus.
 * This function is defined here to avoid circular dependencies if it were in background.js.
 */
function updateContextMenus() {
    // Send a message to the background script to trigger menu update
    chrome.runtime.sendMessage({action: "updateContextMenus"}, function(response) {
        if (chrome.runtime.lastError) {
            console.warn("SoVITS Screen Reader: Could not send updateContextMenus message to background:", chrome.runtime.lastError.message);
            // It's often okay if the background script is busy or not listening
        } else {
            console.log("SoVITS Screen Reader: Sent updateContextMenus message to background script.");
        }
    });
}

/**
 * Fetches lists of available files from the backend for autocomplete.
 */
function fetchBackendFiles() {
  const backendUrl = document.getElementById('backendUrl').value.trim();
  if (!backendUrl) {
    console.log('SoVITS Screen Reader: Backend URL is not set, skipping file fetch.');
    return;
  }
  console.log(`SoVITS Screen Reader: Fetching backend files from ${backendUrl}`);

  // Fetch audio files with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  fetch(`${backendUrl}/list_audio_files`, { signal: controller.signal })
    .then(response => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("SoVITS Screen Reader: Received audio files list:", data);
      const audioFiles = data.audio_files;
      if (Array.isArray(audioFiles)) {
        const audioFilesList = document.getElementById('audioFilesList');
        audioFilesList.innerHTML = '';
        audioFiles.forEach(audioFile => {
          const option = document.createElement('option');
          option.value = audioFile;
          audioFilesList.appendChild(option);
        });
        console.log(`SoVITS Screen Reader: Populated audio files datalist with ${audioFiles.length} items.`);
      } else {
        console.error('SoVITS Screen Reader: Invalid data format for audio files. Expected an array in "audio_files" property.', data);
      }
    })
    .catch(error => {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('SoVITS Screen Reader: Request timeout when fetching audio files.');
        showStatusMessage('Request timeout when fetching audio files.', 'warning');
      } else {
        console.error('SoVITS Screen Reader: Error fetching audio files:', error.message);
        showStatusMessage(`Error fetching audio files: ${error.message}`, 'error');
      }
    });
}

// --- Export/Import Functions ---

/**
 * Exports the current settings (characters and backend URL) as a JSON file.
 */
function exportSettings() {
  const exportButton = document.getElementById('exportSettings');
  showButtonLoading(exportButton);

  console.log("SoVITS Screen Reader: Initiating settings export.");
  chrome.storage.local.get(['characters', 'backendUrl'], function (items) {
    hideButtonLoading(exportButton);

    if (chrome.runtime.lastError) {
      console.error("SoVITS Screen Reader: Error retrieving settings for export:", chrome.runtime.lastError.message);
      showStatusMessage("Failed to export settings.", 'error');
      return;
    }

    const data = {
      characters: items && items.characters ? items.characters : [],
      backendUrl: items && items.backendUrl ? items.backendUrl : ''
    };

    console.log("SoVITS Screen Reader: Settings data for export:", data);

    const dataStr = JSON.stringify(data, null, 2); // Pretty print JSON
    const dataBlob = new Blob([dataStr], {type: 'application/json'});

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(dataBlob);
    downloadLink.download = 'sovits_reader_settings.json'; // More descriptive filename
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href); // Clean up

    console.log("SoVITS Screen Reader: Settings export completed.");
    showStatusMessage('Settings exported successfully.', 'success');
  });
}

/**
 * Handles the file input change event for importing settings.
 */
document.getElementById('importFile').addEventListener('change', function (event) {
  const importButton = document.getElementById('importSettings');
  showButtonLoading(importButton);

  const file = event.target.files[0];
  if (file) {
    console.log(`SoVITS Screen Reader: Initiating settings import from file: ${file.name}`);
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        console.log("SoVITS Screen Reader: Parsed imported data:", data);

        // Validate basic structure
        if (!data || typeof data !== 'object') {
            throw new Error("Invalid file format: Data is not an object.");
        }
 else if (!Array.isArray(data.characters)) {
            throw new Error("Invalid file format: 'characters' is not an array.");
        }
        // backendUrl can be a string or missing, which is fine

        // Save to storage
        chrome.storage.local.set({
          characters: data.characters,
          backendUrl: data.backendUrl || '' // Default to empty string if missing
        }, function () {
          hideButtonLoading(importButton);

          if (chrome.runtime.lastError) {
            console.error("SoVITS Screen Reader: Error saving imported settings:", chrome.runtime.lastError.message);
            showImportStatusMessage("Failed to import settings.", 'error');
          } else {
            console.log("SoVITS Screen Reader: Settings imported and saved successfully.");
            showImportStatusMessage('Settings imported successfully.', 'success');
            // Reload UI elements
            loadBackendUrl();
            loadCharacters();
            // Update context menus
            updateContextMenus();
          }
        });
      } catch (parseError) {
        hideButtonLoading(importButton);
        console.error("SoVITS Screen Reader: Error parsing imported JSON file:", parseError.message);
        showImportStatusMessage(`Error parsing file: ${parseError.message}`, 'error');
      }
    };
    reader.onerror = function (e) {
      hideButtonLoading(importButton);
      console.error("SoVITS Screen Reader: Error reading imported file:", e.target.error.message);
      showImportStatusMessage(`Error reading file: ${e.target.error.message}`, 'error');
    };
    reader.readAsText(file);
  } else {
    hideButtonLoading(importButton);
    showImportStatusMessage("No file selected.", 'warning');
  }
  // Reset the file input value to allow selecting the same file again
  event.target.value = '';
});

