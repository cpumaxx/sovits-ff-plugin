// Define language options
const langOptions = [
  "auto", "auto_yue", "en", "zh", "ja", "yue", "ko", "all_zh", "all_ja", "all_yue", "all_ko"
];

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('save').addEventListener('click', saveBackendUrl);
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

  // Add event listener for change event on characterList dropdown
  document.getElementById('characterList').addEventListener('change', updateCharacterDetails);

  loadBackendUrl();
  loadCharacters();
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
      fetchBackendFiles(); // Fetch backend files on page load
    } else {
      document.getElementById('backendUrl').value = '';
    }
  });
}

function saveBackendUrl() {
  let backendUrl = document.getElementById('backendUrl').value;
  chrome.storage.local.set({ backendUrl: backendUrl }, function() {
    console.log('Backend URL saved:', backendUrl);
    fetchBackendFiles(); // Fetch lists after saving backend URL
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
  fetchBackendFiles();
}

function addEmotion() {
  const emotionsGridBody = document.querySelector('#emotionsGrid tbody');
  const newRow = emotionsGridBody.insertRow();

  // Emotion Name Cell
  const nameCell = newRow.insertCell(0);
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.classList.add('emotion-name');
  nameCell.appendChild(nameInput);

  // Text Lang Cell
  const textLangCell = newRow.insertCell(1);
  const textLangSelect = document.createElement('select');
  textLangSelect.classList.add('text-lang');
  langOptions.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    textLangSelect.appendChild(option);
  });
  textLangSelect.value = 'en'; // Default text language
  textLangCell.appendChild(textLangSelect);

  // Ref Audio Path Cell
  const refAudioCell = newRow.insertCell(2);
  const refAudioInput = document.createElement('input');
  refAudioInput.type = 'text';
  refAudioInput.classList.add('ref-audio-path');
  refAudioInput.setAttribute('list', 'audioFilesList'); 
  refAudioCell.appendChild(refAudioInput);

  // Prompt Lang Cell
  const promptLangCell = newRow.insertCell(3);
  const promptLangSelect = document.createElement('select');
  promptLangSelect.classList.add('prompt-lang');
  langOptions.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    promptLangSelect.appendChild(option);
  });
  promptLangSelect.value = 'en'; // Default prompt language
  promptLangCell.appendChild(promptLangSelect);

  // Prompt Text Cell
  const promptTextCell = newRow.insertCell(4);
  const promptTextInput = document.createElement('input');
  promptTextInput.type = 'text';
  promptTextInput.classList.add('prompt-text');
  promptTextCell.appendChild(promptTextInput);

  // GPT Cell
  const gptCell = newRow.insertCell(5);
  const gptInput = document.createElement('input');
  gptInput.type = 'text';
  gptInput.classList.add('gpt-text');
  gptInput.setAttribute('list', 'gptModelsList');
  gptInput.list = 'gptModelsList';
  gptCell.appendChild(gptInput);

  // SoVITS Cell
  const soVITSCell = newRow.insertCell(6);
  const soVITSInput = document.createElement('input');
  soVITSInput.type = 'text';
  soVITSInput.classList.add('soVITS-text');
  soVITSInput.setAttribute('list', 'sovitsModelsList');
  soVITSInput.list = 'sovitsModelsList';
  soVITSCell.appendChild(soVITSInput);

  // Action Cell
  const actionCell = newRow.insertCell(7);
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

    // Emotion Name Cell
    const nameCell = newRow.insertCell(0);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.classList.add('emotion-name');
    nameInput.value = emotion.name;
    nameCell.appendChild(nameInput);

    // Text Lang Cell
    const textLangCell = newRow.insertCell(1);
    const textLangSelect = document.createElement('select');
    textLangSelect.classList.add('text-lang');
    langOptions.forEach(optionValue => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      if (optionValue === emotion.text_lang) {
        option.selected = true;
      }
      textLangSelect.appendChild(option);
    });
    textLangCell.appendChild(textLangSelect);

    // Ref Audio Path Cell
    const refAudioCell = newRow.insertCell(2);
    const refAudioInput = document.createElement('input');
    refAudioInput.type = 'text';
    refAudioInput.classList.add('ref-audio-path');
    refAudioInput.value = emotion.ref_audio_path;
    refAudioInput.setAttribute('list', 'audioFilesList');
    refAudioCell.appendChild(refAudioInput);

    // Prompt Lang Cell
    const promptLangCell = newRow.insertCell(3);
    const promptLangSelect = document.createElement('select');
    promptLangSelect.classList.add('prompt-lang');
    langOptions.forEach(optionValue => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      if (optionValue === emotion.prompt_lang) {
        option.selected = true;
      }
      promptLangSelect.appendChild(option);
    });
    promptLangCell.appendChild(promptLangSelect);

    // Prompt Text Cell
    const promptTextCell = newRow.insertCell(4);
    const promptTextInput = document.createElement('input');
    promptTextInput.type = 'text';
    promptTextInput.classList.add('prompt-text');
    promptTextInput.value = emotion.prompt_text;
    promptTextCell.appendChild(promptTextInput);

    // GPT Cell
    const gptCell = newRow.insertCell(5);
    const gptInput = document.createElement('input');
    gptInput.type = 'text';
    gptInput.classList.add('gpt-text');
    gptInput.value = emotion.gpt || '';
    gptInput.setAttribute('list', 'gptModelsList');
    gptCell.appendChild(gptInput);

    // SoVITS Cell
    const soVITSCell = newRow.insertCell(6);
    const soVITSInput = document.createElement('input');
    soVITSInput.type = 'text';
    soVITSInput.classList.add('soVITS-text');
    soVITSInput.value = emotion.soVITS || '';
    soVITSInput.setAttribute('list', 'sovitsModelsList');
    soVITSCell.appendChild(soVITSInput);

    // Action Cell
    const actionCell = newRow.insertCell(7);
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
    const textLangSelect = row.cells[1].querySelector('.text-lang');
    const refAudioInput = row.cells[2].querySelector('.ref-audio-path');
    const promptLangSelect = row.cells[3].querySelector('.prompt-lang');
    const promptTextInput = row.cells[4].querySelector('.prompt-text');
    const gptInput = row.cells[5].querySelector('.gpt-text');
    const soVITSInput = row.cells[6].querySelector('.soVITS-text');

    const emotion = {
      name: nameInput.value.trim(),
      text_lang: textLangSelect.value,
      ref_audio_path: refAudioInput.value.trim(),
      prompt_lang: promptLangSelect.value,
      prompt_text: promptTextInput.value.trim(),
      gpt: gptInput.value.trim(),
      soVITS: soVITSInput.value.trim()
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

function fetchBackendFiles() {
  const backendUrl = document.getElementById('backendUrl').value;
  if (!backendUrl) {
    console.log('Backend URL is not set.');
    return;
  }
  fetch(`${backendUrl}/list_audio_files`)
    .then(response => response.json())
    .then(data => {
      const audioFiles = data.audio_files;
      if (Array.isArray(audioFiles)) {
        const audioFilesList = document.getElementById('audioFilesList');
        audioFilesList.innerHTML = '';
        audioFiles.forEach(audioFile => {
          const option = document.createElement('option');
          option.value = audioFile;
          audioFilesList.appendChild(option);
        });
      } else {
        console.error('Invalid data format. Expected an array in "audio_files" property.');
      }
    })
    .catch(error => console.error('Error fetching audio files:', error));

  fetch(`${backendUrl}/list_gpt_files`)
    .then(response => response.json())
    .then(data => {
      const gptModels = data.gpt_files;
      if (Array.isArray(gptModels)) {
        const gptModelsList = document.getElementById('gptModelsList');
        gptModelsList.innerHTML = '';
        gptModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          gptModelsList.appendChild(option);
        });
      } else {
        console.error('Invalid data format for GPT models.');
      }
    })
    .catch(error => console.error('Error fetching GPT models:', error));

  fetch(`${backendUrl}/list_sovits_files`)
    .then(response => response.json())
    .then(data => {
      const sovitsModels = data.sovits_files;
      if (Array.isArray(sovitsModels)) {
        const sovitsModelsList = document.getElementById('sovitsModelsList');
        sovitsModelsList.innerHTML = '';
        sovitsModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          sovitsModelsList.appendChild(option);
        });
      } else {
        console.error('Invalid data format for SoVITS models.');
      }
    })
    .catch(error => console.error('Error fetching SoVITS models:', error));
}

// Export settings
function exportSettings() {
  chrome.storage.local.get(['characters', 'backendUrl'], function (items) {
    const data = {
      characters: items && items.characters ? items.characters : {},
      backendUrl: items && items.backendUrl ? items.backendUrl : ''
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadLink = document.createElement('a');
    downloadLink.href = dataStr;
    downloadLink.download = 'settings.json';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  });
}

// Import settings
document.getElementById('importFile').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = JSON.parse(e.target.result);
      chrome.storage.local.set({
        characters: data.characters || {},
        backendUrl: data.backendUrl || ''
      }, function () {
        alert('Settings imported successfully.');
        loadCharacters();
        updateContextMenus();
      });
    };
    reader.readAsText(file);
  }
});


// Initial loading of context menus
updateContextMenus();

