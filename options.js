document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('save').addEventListener('click', saveBackendUrl);
  document.getElementById('newCharacter').addEventListener('click', newCharacter);
  document.getElementById('editCharacter').addEventListener('click', editCharacter);
  document.getElementById('removeCharacter').addEventListener('click', removeCharacter);
  document.getElementById('saveCharacter').addEventListener('click', saveCharacter);
  document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
  document.getElementById('addEmotion').addEventListener('click', addEmotion);

  loadBackendUrl();
  loadCharacters();
});

function loadBackendUrl() {
  chrome.storage.local.get('backendUrl', function(items) {
    if (items && items.backendUrl) {
      document.getElementById('backendUrl').value = items.backendUrl;
    } else {
      document.getElementById('backendUrl').value = '';
    }
  });
}

function saveBackendUrl() {
  let backendUrl = document.getElementById('backendUrl').value;
  chrome.storage.local.set({ backendUrl: backendUrl }, function() {
    console.log('Backend URL saved:', backendUrl);
    alert('Backend URL saved.');
  });
}

function loadCharacters() {
  chrome.storage.local.get(['characters', 'selectedCharacterName', 'selectedEmotion'], function(items) {
    let characters = items && items.characters ? items.characters : {};
    populateCharacterList(Object.values(characters));
    setLastUsedCharacter(items.selectedCharacterName, items.selectedEmotion);
  });
}

function populateCharacterList(characters) {
  const characterList = document.getElementById('characterList');
  characterList.innerHTML = '';
  for (let char of characters) {
    const option = document.createElement('option');
    option.text = char.name;
    option.value = char.name;
    characterList.add(option);
  }
}

function newCharacter() {
  toggleCharacterEditor(true);
  clearEmotionsGrid();
}

function editCharacter() {
  const characterList = document.getElementById('characterList');
  const selectedIndex = characterList.selectedIndex;
  if (selectedIndex >= 0) {
    const selectedCharacterName = characterList.options[selectedIndex].value;
    chrome.storage.local.get('characters', function(items) {
      const characters = items && items.characters ? items.characters : {};
      const selectedCharacter = characters[selectedIndex];
      if (selectedCharacter) {
        document.getElementById('characterName').value = selectedCharacter.name;
        populateEmotionsGrid(selectedCharacter.emotions);
        document.getElementById('characterDetails').dataset.name = selectedCharacterName;
        toggleCharacterEditor(false);
      }
    });
  }
}

function removeCharacter() {
  const characterList = document.getElementById('characterList');
  const selectedIndex = characterList.selectedIndex;
  if (selectedIndex >= 0) {
    const selectedCharacterName = characterList.options[selectedIndex].value;
    chrome.storage.local.get('characters', function(items) {
      let characters = items && items.characters ? items.characters : [];
      // Find the index of the character with the given name
      const index = characters.findIndex(char => char.name === selectedCharacterName);
      if (index !== -1) {
        characters.splice(index, 1);
        chrome.storage.local.set({ characters: characters }, function() {
          loadCharacters();
          updateContextMenus();
        });
      }
    });
  }
}

function saveCharacter() {
  const characterName = document.getElementById('characterName').value.trim();
  const emotions = getEmotionsFromGrid();

  if (!characterName) {
    alert('Character name is required.');
    return;
  }

  if (emotions.length === 0) {
    alert('At least one emotion is required.');
    return;
  }

  chrome.storage.local.get('characters', function(items) {
    let characters = items && items.characters ? items.characters : [];

    // Find the index of the character with the given name
    const index = characters.findIndex(char => char.name === characterName);

    if (index !== -1) {
      // Update existing character
      characters[index] = {
        name: characterName,
        emotions: emotions
      };
    } else {
      // Add new character
      characters.push({
        name: characterName,
        emotions: emotions
      });
    }

    chrome.storage.local.set({ characters: characters }, function() {
      alert('Character saved.');
      toggleCharacterEditor(false);
      loadCharacters();
      updateContextMenus();
    });
  });
}

function cancelEdit() {
  toggleCharacterEditor(false);
  clearEmotionsGrid();
}

function toggleCharacterEditor(isNew, name) {
  const characterDetails = document.getElementById('characterDetails');
  if (isNew) {
    document.getElementById('characterName').value = '';
    characterDetails.dataset.name = '';
  } else {
    characterDetails.dataset.name = name;
  }
  characterDetails.style.display = characterDetails.style.display === 'none' ? 'block' : 'none';
}

function addEmotion() {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  const newRow = emotionsGridBody.insertRow();

  const nameCell = newRow.insertCell(0);
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.classList.add('emotion-name');
  nameCell.appendChild(nameInput);

  const textLangCell = newRow.insertCell(1);
  const textLangInput = document.createElement('input');
  textLangInput.type = 'text';
  textLangInput.classList.add('text-lang');
  textLangInput.value = 'en'; // Default text language
  textLangCell.appendChild(textLangInput);

  const refAudioCell = newRow.insertCell(2);
  const refAudioInput = document.createElement('input');
  refAudioInput.type = 'text';
  refAudioInput.classList.add('ref-audio-path');
  refAudioCell.appendChild(refAudioInput);

  const promptLangCell = newRow.insertCell(3);
  const promptLangInput = document.createElement('input');
  promptLangInput.type = 'text';
  promptLangInput.classList.add('prompt-lang');
  promptLangInput.value = 'en'; // Default prompt language
  promptLangCell.appendChild(promptLangInput);

  const promptTextCell = newRow.insertCell(4);
  const promptTextInput = document.createElement('input');
  promptTextInput.type = 'text';
  promptTextInput.classList.add('prompt-text');
  promptTextCell.appendChild(promptTextInput);

  const actionCell = newRow.insertCell(5);
  const removeButton = document.createElement('button');
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', function() {
    emotionsGridBody.deleteRow(newRow.rowIndex);
  });
  actionCell.appendChild(removeButton);
}

function populateEmotionsGrid(emotions) {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  emotionsGridBody.innerHTML = '';
  emotions.forEach(emotion => {
    const newRow = emotionsGridBody.insertRow();

    const nameCell = newRow.insertCell(0);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.classList.add('emotion-name');
    nameInput.value = emotion.name;
    nameCell.appendChild(nameInput);

    const textLangCell = newRow.insertCell(1);
    const textLangInput = document.createElement('input');
    textLangInput.type = 'text';
    textLangInput.classList.add('text-lang');
    textLangInput.value = emotion.text_lang;
    textLangCell.appendChild(textLangInput);

    const refAudioCell = newRow.insertCell(2);
    const refAudioInput = document.createElement('input');
    refAudioInput.type = 'text';
    refAudioInput.classList.add('ref-audio-path');
    refAudioInput.value = emotion.ref_audio_path;
    refAudioCell.appendChild(refAudioInput);

    const promptLangCell = newRow.insertCell(3);
    const promptLangInput = document.createElement('input');
    promptLangInput.type = 'text';
    promptLangInput.classList.add('prompt-lang');
    promptLangInput.value = emotion.prompt_lang;
    promptLangCell.appendChild(promptLangInput);

    const promptTextCell = newRow.insertCell(4);
    const promptTextInput = document.createElement('input');
    promptTextInput.type = 'text';
    promptTextInput.classList.add('prompt-text');
    promptTextInput.value = emotion.prompt_text;
    promptTextCell.appendChild(promptTextInput);

    const actionCell = newRow.insertCell(5);
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', function() {
      emotionsGridBody.deleteRow(newRow.rowIndex);
    });
    actionCell.appendChild(removeButton);
  });
}

function getEmotionsFromGrid() {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  const emotions = [];
  for (let i = 0; i < emotionsGridBody.rows.length; i++) {
    const row = emotionsGridBody.rows[i];
    const nameInput = row.cells[0].querySelector('.emotion-name');
    const textLangInput = row.cells[1].querySelector('.text-lang');
    const refAudioInput = row.cells[2].querySelector('.ref-audio-path');
    const promptLangInput = row.cells[3].querySelector('.prompt-lang');
    const promptTextInput = row.cells[4].querySelector('.prompt-text');

    const emotion = {
      name: nameInput.value.trim(),
      text_lang: textLangInput.value.trim(),
      ref_audio_path: refAudioInput.value.trim(),
      prompt_lang: promptLangInput.value.trim(),
      prompt_text: promptTextInput.value.trim()
    };

    if (emotion.name) {
      emotions.push(emotion);
    }
  }
  return emotions;
}

function clearEmotionsGrid() {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  emotionsGridBody.innerHTML = '';
}

function setLastUsedCharacter(characterName, selectedEmotion) {
  const characterList = document.getElementById('characterList');
  for (let i = 0; i < characterList.options.length; i++) {
    if (characterList.options[i].value === characterName) {
      characterList.selectedIndex = i;
      break;
    }
  }

  if (selectedEmotion) {
    // Optionally, select the emotion in the grid
  }
}

// Function to update context menus based on current characters
function updateContextMenus() {
  chrome.storage.local.get('characters', function(items) {
    const characters = items && items.characters ? Object.values(items.characters) : [];
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

      characters.forEach((character) => {
        if (character.emotions) {
          chrome.contextMenus.create({
            id: `selectCharacter-${character.name}`,
            title: `Select Character: ${character.name}`,
            contexts: ["selection"]
          });
          character.emotions.forEach(emotion => {
            chrome.contextMenus.create({
              id: `selectEmotion-${character.name}-${emotion.name.replace(/ /g, '-')}`,
              title: emotion.name,
              parentId: `selectCharacter-${character.name}`,
              contexts: ["selection"]
            });
          });
        } else {
          console.warn(`Character ${character.name} has no emotions.`);
        }
      });
    });
  });
}

// Initial loading of context menus
updateContextMenus();
