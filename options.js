document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('save').addEventListener('click', saveBackendUrl);
  document.getElementById('newCharacter').addEventListener('click', newCharacter);
  document.getElementById('editCharacter').addEventListener('click', editCharacter);
  document.getElementById('removeCharacter').addEventListener('click', removeCharacter);
  document.getElementById('saveCharacter').addEventListener('click', saveCharacter);
  document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
  document.getElementById('addEmotion').addEventListener('click', addEmotion);

  // Add event listener for change event on characterList dropdown
  document.getElementById('characterList').addEventListener('change', updateCharacterDetails);

  loadBackendUrl();
  loadCharacters();
  // Initial call to update character details
  updateCharacterDetails();
});

// Function to update character details based on selected character
function updateCharacterDetails() {
  const characterList = document.getElementById('characterList');
  const selectedIndex = characterList.selectedIndex;
  if (selectedIndex >= 0) {
    const selectedCharacter = characterList.options[selectedIndex].value;
    chrome.storage.local.get('characters', function(items) {
      const characters = items && items.characters ? items.characters : [];
      const selectedChar = characters.find(char => char.name === selectedCharacter);
      if (selectedChar) {
        document.getElementById('characterName').value = selectedChar.name;
        populateEmotionsGrid(selectedChar.emotions);
      } else {
        console.error('Selected character not found:', selectedCharacter);
      }
    });
  } else {
    console.log('No character selected');
  }
}

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
  chrome.storage.local.get(['characters'], function(items) {
    let characters = items && items.characters ? items.characters : [];
    populateCharacterList(characters);
  });
}

function populateCharacterList(characters) {
  const characterList = document.getElementById('characterList');
  characterList.innerHTML = '';
  characters.forEach(char => {
    const option = document.createElement('option');
    option.text = char.name;
    option.value = char.name;
    characterList.add(option);
  });
}

function newCharacter() {
  toggleCharacterEditor(true);
  clearEmotionsGrid();
}

function editCharacter() {
  updateCharacterDetails();
  toggleCharacterEditor(false);
}

function removeCharacter() {
  const characterList = document.getElementById('characterList');
  const selectedIndex = characterList.selectedIndex;
  if (selectedIndex >= 0) {
    const selectedCharacter = characterList.options[selectedIndex].value;
    chrome.storage.local.get('characters', function(items) {
      const characters = items && items.characters ? items.characters : [];
      const updatedCharacters = characters.filter(char => char.name !== selectedCharacter);
      chrome.storage.local.set({ characters: updatedCharacters }, function() {
        loadCharacters();
        updateContextMenus();
      });
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
    const existingCharacterIndex = characters.findIndex(char => char.name === characterName);
    if (existingCharacterIndex !== -1) {
      characters[existingCharacterIndex] = { name: characterName, emotions: emotions };
    } else {
      characters.push({ name: characterName, emotions: emotions });
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

function toggleCharacterEditor(isNew) {
  const characterDetails = document.getElementById('characterDetails');
  const emotionsGridContainer = document.getElementById('emotionsGridContainer');
  if (characterDetails.style.display === 'none') {
    characterDetails.style.display = 'block';
    emotionsGridContainer.style.display = 'block';
  } else {
    characterDetails.style.display = 'none';
    emotionsGridContainer.style.display = 'none';
  }
  if (isNew) {
    document.getElementById('characterName').value = '';
    clearEmotionsGrid();
  }
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

      characters.forEach((character) => {
        if (character.emotions && character.emotions.length > 0) {
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
