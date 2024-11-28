console.log("Content script loaded.");

let audioQueue = [];
let currentAudio = null;

// Function to play the next audio in the queue
function playNext() {
  if (audioQueue.length === 0) {
    currentAudio = null;
    return;
  }

  const { src, type } = audioQueue.shift();

  currentAudio = new Audio();
  currentAudio.src = src;
  currentAudio.type = type;
  currentAudio.load();

  // Listen for end of current audio and play next
  currentAudio.addEventListener('ended', playNext);

  // Play the audio
  currentAudio.play();
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  if (request.action === "readSelectedText") {
    // Get the selected text
    let selectedText = window.getSelection().toString();

    console.log("Selected text:", selectedText);

    // Split the text into sentences based on language
    const sentences = splitIntoSentences(selectedText);

    // Send each sentence to the backend and enqueue the audio
    sentences.forEach(sentence => {
        if (sentence) {
            sendToBackend(sentence)
                .then(audioBlob => {
                    const type = audioBlob.type || 'audio/wav';
                    const audioUrl = URL.createObjectURL(audioBlob);
                    audioQueue.push({ src: audioUrl, type: type });

                    // If no audio is currently playing, start the next one
                    if (!currentAudio) {
                        playNext();
                    }
                })
                .catch(error => console.error('Error:', error));
            }
         });
     } else if (request.action === "stopAudio") {
    // Stop the current audio and clear the queue
    stopAudio();
  }
});

// Function to stop the current audio and clear the queue
function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.remove();
    currentAudio = null;
  }
  audioQueue = [];
}

// Function to send the selected text to the backend
function sendToBackend(text) {
  return new Promise((resolve, reject) => {
    // Retrieve backend URL and selected settings from storage
    chrome.storage.local.get(['backendUrl', 'selectedCharacterIndex', 'selectedEmotion'], function(items) {
      const backendUrl = items.backendUrl;
      const selectedCharacterIndex = items.selectedCharacterIndex;
      const selectedEmotionName = items.selectedEmotion;

      if (!backendUrl) {
        console.error("Backend URL is not set.");
        reject(new Error("Backend URL is not set."));
        return;
      }

      // Get the selected character and emotion
      chrome.storage.local.get('characters', function(items) {
        const characters = items && items.characters ? items.characters : [];
        const chararrayIndex = characters.findIndex(char => char.name === selectedCharacterIndex);
        const selectedCharacter = chararrayIndex >= 0 ? characters[chararrayIndex] : null;

        if (!selectedCharacter || !selectedCharacter.emotions) {
          console.error("Selected character is not defined or has no emotions.");
          reject(new Error("Selected character is not defined or has no emotions."));
          return;
        }

        let emotion = selectedCharacter.emotions.find(em => em.name === selectedEmotionName);

        if (!emotion) {
          // Default to the first emotion if selected emotion is not found
          emotion = selectedCharacter.emotions[0];
        }

        if (!emotion) {
          console.error("No emotion found for the selected character.");
          reject(new Error("No emotion found for the selected character."));
          return;
        }

        // Construct the query string with the required parameters
        const queryParams = new URLSearchParams({
          text: text,
          text_lang: emotion.text_lang,
          ref_audio_path: emotion.ref_audio_path,
          prompt_lang: emotion.prompt_lang,
          prompt_text: emotion.prompt_text,
          text_split_method: 'cut5', // Default text split method
          batch_size: 1, // Default batch size
          media_type: 'wav', // Default media type
          streaming_mode: false // Default to non-streaming mode
        }).toString();

        console.log("Sending to backend:", backendUrl + '/tts?' + queryParams);

        fetch(backendUrl + '/tts?' + queryParams, {
          method: 'GET'
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
          }
          return response.blob();
        })
        .then(audioBlob => {
          resolve(audioBlob);
        })
        .catch(error => {
          reject(error);
        });
      });
    });
  });
}

// Function to split text into sentences using a comprehensive regex
function splitIntoSentences(text) {
  // Regex pattern to match sentence delimiters
  const sentenceDelimiterPattern = /[。！？.?!¿¡⁇⁈⁉‽]/g;

  // Split the text into sentences
  const sentences = text.split(sentenceDelimiterPattern).filter(Boolean);
  return sentences.map(sentence => sentence.trim());
}
