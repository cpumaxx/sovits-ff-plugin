/**
 * Content script for SoVITS Screen Reader.
 * Runs in the context of web pages to get selected text, send it to the backend, and play audio.
 */

console.log("SoVITS Screen Reader: Content script loaded.");

// Audio playback queue and current audio reference
let audioQueue = [];
let currentAudio = null;
let isProcessing = false;
let totalSentences = 0;
let processedSentences = 0;

let progressElement = null;
let currentSentenceIndex = 0;
let totalSentenceCount = 0;

let isProgressDisplayVisible = false;

let abortController = null; // For cancelling ongoing API requests

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("SoVITS Screen Reader: Message received in content script:", request);

  if (request.action === "ping") {
    console.log("SoVITS Screen Reader: Ping received, responding");
    sendResponse({ status: "pong" });
    return true; // Keep message channel open
  } else if (request.action === "readSelectedText") {
    console.log("SoVITS Screen Reader: Processing readSelectedText action");
    // Get the selected text from the current page
    let selectedText = window.getSelection().toString().trim();

    if (!selectedText) {
      console.warn("SoVITS Screen Reader: No text selected.");
      updateStatus("error", "No text selected");
      sendResponse({ status: "error", message: "No text selected" });
      return true; // Keep message channel open
    }

    console.log("SoVITS Screen Reader: Selected text:", selectedText);

    // Split the text into sentences
    const sentences = splitIntoSentences(selectedText);
    console.log("SoVITS Screen Reader: Split text into sentences:", sentences);

    // Process sentences sequentially to maintain order
    processSentencesSequentially(sentences);

    sendResponse({ status: "processing", message: "Text processing started" });
    return true; // Keep message channel open
  } else if (request.action === "stopAudio") {
    console.log("SoVITS Screen Reader: Stop audio command received.");
    // Stop the current audio and clear the queue
    stopAudio();
    sendResponse({ status: "success", message: "Audio stopped" });
    return true; // Keep message channel open
  } else   if (request.action === "toggleProgressDisplay") {
    console.log("SoVITS Screen Reader: toggle display command");
    // Just update visibility based on new settings
    updateProgressDisplayVisibility();
    sendResponse({ status: "success", message: "Progress display toggled" });
    return true;
  }
  // For any unhandled messages, send a response
  sendResponse({ status: "unhandled", message: "Unknown action" });
  return true; // Keep message channel open
});

/**
 * Sends text to the backend TTS API and returns a Promise that resolves with the audio blob.
 * @param {string} text - The text to synthesize.
 * @returns {Promise<Blob>} A promise that resolves with the audio data as a Blob.
 */
function sendToBackend(text) {
  return new Promise((resolve, reject) => {
    // Create a new AbortController for this request
    const controller = new AbortController();
    const signal = controller.signal;

    // Store reference so we can abort if needed
    abortController = controller;

    // Retrieve backend URL and selected settings from storage
    chrome.storage.local.get(['backendUrl', 'selectedCharacterName', 'selectedEmotion'], function(storageItems) {
      if (chrome.runtime.lastError) {
        console.error("SoVITS Screen Reader: Error retrieving settings from storage:", chrome.runtime.lastError.message);
        reject(new Error("Failed to retrieve settings from storage."));
        return;
      }

      const backendUrl = storageItems.backendUrl;
      const selectedCharacterName = storageItems.selectedCharacterName; // This is the NAME, not an index
      const selectedEmotionName = storageItems.selectedEmotion;

      console.log("SoVITS Screen Reader: Retrieved settings from storage:", { backendUrl, selectedCharacterName, selectedEmotionName });

      // Validate backend URL
      if (!backendUrl) {
        console.error("SoVITS Screen Reader: Backend URL is not set.");
        reject(new Error("Backend URL is not set. Please configure it in the extension options."));
        return;
      }

      // Retrieve the full list of characters
      chrome.storage.local.get('characters', function(charItems) {
        if (chrome.runtime.lastError) {
          console.error("SoVITS Screen Reader: Error retrieving characters list from storage:", chrome.runtime.lastError.message);
          reject(new Error("Failed to retrieve character list from storage."));
          return;
        }

        const characters = charItems && charItems.characters ? charItems.characters : [];
        console.log("SoVITS Screen Reader: Retrieved characters list:", characters);

        // --- FIX: Find the selected character object by name ---
        const selectedCharacter = characters.find(char => char.name === selectedCharacterName);

        // Validate character and emotions
        if (!selectedCharacter || !selectedCharacter.emotions) {
          const errorMsg = `Selected character '${selectedCharacterName}' is not defined or has no emotions.`;
          console.error("SoVITS Screen Reader: " + errorMsg, selectedCharacter);
          reject(new Error(errorMsg));
          return;
        }

        // Find the selected emotion object within the character's emotions
        let emotion = selectedCharacter.emotions.find(em => em.name === selectedEmotionName);

        // Default to the first emotion if the selected one is not found
        if (!emotion) {
          console.warn(`SoVITS Screen Reader: Selected emotion '${selectedEmotionName}' not found for character '${selectedCharacterName}'. Defaulting to first emotion.`);
          emotion = selectedCharacter.emotions[0];
        }

        // Validate that an emotion was found (even after defaulting)
        if (!emotion) {
          const errorMsg = `No emotion found for character '${selectedCharacterName}'.`;
          console.error("SoVITS Screen Reader: " + errorMsg);
          reject(new Error(errorMsg));
          return;
        }

        // Construct the query parameters for the TTS request
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

        const fullUrl = `${backendUrl}/tts?${queryParams}`;
        console.log("SoVITS Screen Reader: Sending request to backend:", fullUrl);

        // Perform the fetch request to the backend with abort signal
        fetch(fullUrl, {
          method: 'GET',
          signal: signal // Pass the abort signal
        })
        .then(response => {
          // Clear the abort controller reference when request completes
          abortController = null;

          console.log("SoVITS Screen Reader: Received response from backend:", response.status, response.statusText);
          if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
          }
          // Resolve the promise with the audio blob
          return response.blob();
        })
        .then(audioBlob => {
          console.log("SoVITS Screen Reader: Backend request successful, received audio blob.");
          resolve(audioBlob);
        })
        .catch(error => {
          // Clear the abort controller reference when request fails
          abortController = null;

          // Check if the error was due to aborting
          if (error.name === 'AbortError') {
            console.log("SoVITS Screen Reader: Backend request was aborted.");
            reject(new Error("Request aborted by user."));
          } else {
            console.error("SoVITS Screen Reader: Error during backend request or processing:", error);
            reject(new Error(`Failed to get audio from backend: ${error.message}`));
          }
        });
      });
    });
  });
}

/**
 * Splits text into sentences using a simple approach that avoids
 * splitting on periods in numbers, abbreviations, etc., with special handling for Japanese.
 * @param {string} text - The text to split.
 * @returns {Array<string>} An array of trimmed sentences.
 */
function splitIntoSentences(text) {
  // Handle edge cases
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Now split on sentence boundaries using a more precise regex
  // This regex looks for sentence-ending punctuation followed by:
  // 1. Whitespace and then a capital letter or ideographic character, OR
  // 2. End of string
  const sentenceRegex = /([.!?。！？…])(?=\s+[A-Z\u0080-\u024F\u4e00-\u9fff]|[\n\r]+|$)/g;

  // Split the text
  let parts = text.split(sentenceRegex);

  // Reconstruct sentences by pairing punctuation with the following text
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const textPart = parts[i] || '';
    const punctuation = (i + 1 < parts.length) ? parts[i + 1] : '';

    // Combine text with its punctuation
    let sentence = textPart + punctuation;

    // Trim whitespace
    sentence = sentence.trim();

    // Only add non-empty sentences
    if (sentence) {
      sentences.push(sentence);
    }
  }

  // Handle remaining newlines by splitting further if needed
  const finalSentences = [];
  sentences.forEach(sentence => {
    if (sentence.includes('\n') || sentence.includes('\r')) {
      // Split on newlines
      const lines = sentence.split(/[\n\r]+/).filter(line => line.trim() !== '');
      lines.forEach(line => {
        if (line.trim()) {
          finalSentences.push(line.trim());
        }
      });
    } else {
      finalSentences.push(sentence);
    }
  });

  // Filter out empty sentences and trim whitespace
  const result = finalSentences.filter(sentence => sentence.trim() !== '').map(sentence => sentence.trim());

  console.log("SoVITS Screen Reader: Split text into sentences:", result);
  return result;
}

/**
 * Preprocesses a sentence for TTS backend, handling abbreviations, numbers, etc.
 * @param {string} sentence - The sentence to preprocess.
 * @param {boolean} hasJapanese - Whether the text contains Japanese characters.
 * @returns {string} The preprocessed sentence.
 */
function preprocessSentenceForTTS(sentence, hasJapanese) {
  if (!sentence || typeof sentence !== 'string') {
    return sentence;
  }

  let processedSentence = sentence;

  // Protect decimal numbers by temporarily replacing periods with a placeholder
  const numberPlaceholders = [];
  let numberIndex = 0;

  // Replace decimal numbers (e.g., 3.14, 0.5, 123.456)
  processedSentence = processedSentence.replace(/\b\d+\.\d+\b/g, (match) => {
    const placeholder = `__NUM_${numberIndex++}__`;
    // For Japanese, convert period to 点 (ten)
    const processedMatch = hasJapanese ? match.replace('.', '点') : match;
    numberPlaceholders.push({ placeholder, content: processedMatch });
    return placeholder;
  });

  // NEW: Handle domain names and email addresses with Japanese substitutions
  if (hasJapanese) {
    // Replace @ with アット in email addresses
    processedSentence = processedSentence.replace(/([a-zA-Z0-9])@([a-zA-Z0-9])/g, '$1アット$2');

    // Replace periods in domain names/emails with ドット (but not at the end of sentences)
    // This matches periods that have letters on both sides and are not followed by whitespace or end of string
    processedSentence = processedSentence.replace(/([a-zA-Z0-9])\.([a-zA-Z0-9])(?!\s|$|[.!?。！？…])/g, '$1ドット$2');
  }

  // Protect common abbreviations and acronyms
  const abbrPlaceholders = [];
  let abbrIndex = 0;

  // Common English abbreviations
  const englishAbbreviations = [
    'Mr\\.', 'Mrs\\.', 'Ms\\.', 'Dr\\.', 'Prof\\.', 'Sr\\.', 'Jr\\.', 
    'vs\\.', 'etc\\.', 'i\\.e\\.', 'e\\.g\\.', 'Inc\\.', 'Ltd\\.', 
    'Corp\\.', 'Co\\.', 'Jan\\.', 'Feb\\.', 'Mar\\.', 'Apr\\.', 'Jun\\.', 
    'Jul\\.', 'Aug\\.', 'Sep\\.', 'Oct\\.', 'Nov\\.', 'Dec\\.',
    'Mon\\.', 'Tue\\.', 'Wed\\.', 'Thu\\.', 'Fri\\.', 'Sat\\.', 'Sun\\.',
    'U\\.S\\.', 'U\\.K\\.', 'U\\.S\\.A\\.', 'E\\.U\\.', 'U\\.N\\.'
  ];

  englishAbbreviations.forEach(abbr => {
    const regex = new RegExp(`\\b${abbr}`, 'g');
    processedSentence = processedSentence.replace(regex, (match) => {
      const placeholder = `__ABBR_${abbrIndex++}__`;
      abbrPlaceholders.push({ placeholder, content: match.replace(/\\/g, '') });
      return placeholder;
    });
  });

  // Handle acronyms (sequences of capital letters)
  processedSentence = processedSentence.replace(/\b[A-Z]{2,}\b/g, (match) => {
    const placeholder = `__ACRONYM_${abbrIndex++}__`;
    // Convert acronym to phonetic spelling
    const phonetic = convertAcronymToPhonetic(match, hasJapanese);
    abbrPlaceholders.push({ placeholder, content: phonetic });
    return placeholder;
  });

  // Protect email addresses and URLs
  const emailUrlPlaceholders = [];
  let emailUrlIndex = 0;

  // Email addresses
  processedSentence = processedSentence.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (match) => {
    const placeholder = `__EMAILURL_${emailUrlIndex++}__`;
    emailUrlPlaceholders.push({ placeholder, content: match });
    return placeholder;
  });

  // URLs
  processedSentence = processedSentence.replace(/\b(?:https?:\/\/|www\.)[^\s]+/g, (match) => {
    const placeholder = `__EMAILURL_${emailUrlIndex++}__`;
    emailUrlPlaceholders.push({ placeholder, content: match });
    return placeholder;
  });

  // Restore all placeholders in reverse order to handle nested replacements correctly
  // Restore URLs and emails first
  emailUrlPlaceholders.forEach(({ placeholder, content }) => {
    processedSentence = processedSentence.replace(placeholder, content);
  });

  // Restore abbreviations and acronyms
  abbrPlaceholders.forEach(({ placeholder, content }) => {
    processedSentence = processedSentence.replace(placeholder, content);
  });

  // Restore numbers last
  numberPlaceholders.forEach(({ placeholder, content }) => {
    processedSentence = processedSentence.replace(placeholder, content);
  });

  // Additional preprocessing for Japanese text to improve TTS quality
  if (hasJapanese) {
    processedSentence = preprocessJapaneseText(processedSentence);
  }

  return processedSentence.trim();
}

/**
 * Converts acronyms to phonetic spelling, with Japanese support.
 * @param {string} acronym - The acronym to convert.
 * @param {boolean} isJapanese - Whether the text is in Japanese.
 * @returns {string} The phonetic spelling of the acronym.
 */
function convertAcronymToPhonetic(acronym, isJapanese) {
  if (isJapanese) {
    // Convert English letters to Japanese phonetic equivalents
    const englishToJapanese = {
      'A': 'エー', 'B': 'ビー', 'C': 'シー', 'D': 'ディー', 'E': 'イー',
      'F': 'エフ', 'G': 'ジー', 'H': 'エイチ', 'I': 'アイ', 'J': 'ジェー',
      'K': 'ケー', 'L': 'エル', 'M': 'エム', 'N': 'エヌ', 'O': 'オー',
      'P': 'ピー', 'Q': 'キュー', 'R': 'アール', 'S': 'エス', 'T': 'ティー',
      'U': 'ユー', 'V': 'ブイ', 'W': 'ダブリュー', 'X': 'エックス', 'Y': 'ワイ', 'Z': 'ゼット'
    };

    return acronym.split('').map(letter => englishToJapanese[letter] || letter).join('');
  } else {
    // For non-Japanese, just separate letters with spaces
    return acronym.split('').join(' ');
  }
}

/**
 * Additional preprocessing for Japanese text to improve TTS quality.
 * @param {string} text - The text to preprocess.
 * @returns {string} The preprocessed text.
 */
function preprocessJapaneseText(text) {
  // Handle common Japanese text normalization
  return text
    // Normalize full-width numbers to half-width
    .replace(/[\uFF10-\uFF19]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
    })
    // Normalize full-width alphabet to half-width
    .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0xFEE0);
    })
    // Add space after Japanese punctuation that precedes English text
    .replace(/([。！？])([A-Za-z])/g, '$1 $2')
    // Add space before English text that follows Japanese text
    .replace(/([\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff])([A-Za-z])/g, '$1 $2');
}

/**
 * Update status and send message to background script
 * @param {string} status - Status type (idle, processing, playing, stopping, error)
 * @param {string} message - Status message
 */
function updateStatus(status, message) {
  console.log(`SoVITS Screen Reader: Status update - ${status}: ${message}`);
  chrome.runtime.sendMessage({
    action: "updateTabStatus",
    status: status,
    message: message
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.warn("SoVITS Screen Reader: Could not send status update:", chrome.runtime.lastError.message);
    }
  });
}

/**
 * Creates and injects a progress display element into the page
 * @param {number} total - Total number of sentences
 */
function createProgressDisplay(total) {
  // If element already exists, just update it
  if (progressElement) {
    totalSentenceCount = total;
    currentSentenceIndex = 0;
    updateProgressDisplay('Loading...', 0, total);
    return;
  }

  // Create progress container only if it doesn't exist
  progressElement = document.createElement('div');
  progressElement.id = 'sovits-progress-display';

  // Set styles for the progress display
  progressElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 20px;
    border-radius: 25px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    z-index: 10000;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 200px;
    max-width: 80%;
    word-wrap: break-word;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  `;

  // Add to page
  document.body.appendChild(progressElement);

  totalSentenceCount = total;
  currentSentenceIndex = 0;

  // Show initial "Loading..." state
  updateProgressDisplay('Loading...', 0, total);
}

/**
 * Updates the progress display with current sentence
 * @param {string} sentence - Current sentence being processed (original text for display)
 * @param {number} index - Current sentence index (0-based)
 * @param {number} total - Total number of sentences
 */
function updateProgressDisplay(sentence, index, total) {
  if (!progressElement) return;

  currentSentenceIndex = index + 1; // 1-based for display
  totalSentenceCount = total;

  // Remove the 100 character truncation - show full original text
  let displaySentence = sentence;
  // No truncation anymore - show the full original sentence

  // Special handling for initial loading state
  if (sentence === 'Loading...') {
    progressElement.innerHTML = `
      <div style="font-size: 14px; margin-bottom: 5px; opacity: 0.8;">
        Preparing audio...
      </div>
      <div style="font-size: 16px; font-weight: normal;">
        ${displaySentence}
      </div>
      <div style="width: 100%; height: 4px; background: rgba(255, 255, 255, 0.2); margin-top: 8px; border-radius: 2px;">
        <div style="height: 100%; width: 0%; 
                    background: #4cc9f0; border-radius: 2px; transition: width 0.3s ease;"></div>
      </div>
    `;
  } else {
    progressElement.innerHTML = `
      <div style="font-size: 14px; margin-bottom: 5px; opacity: 0.8;">
        Playing sentence ${currentSentenceIndex} of ${totalSentenceCount}
      </div>
      <div style="font-size: 16px; font-weight: normal;">
        ${displaySentence || 'Processing...'}
      </div>
      <div style="width: 100%; height: 4px; background: rgba(255, 255, 255, 0.2); margin-top: 8px; border-radius: 2px;">
        <div style="height: 100%; width: ${(currentSentenceIndex/totalSentenceCount)*100}%; 
                    background: #4cc9f0; border-radius: 2px; transition: width 0.3s ease;"></div>
      </div>
    `;
  }
}

/**
 * Shows or hides the progress display based on settings and playback state
 */
function updateProgressDisplayVisibility() {
  if (!progressElement) return;

  chrome.storage.local.get(['showProgressDisplay'], function(items) {
    const showProgress = items.showProgressDisplay !== undefined ? items.showProgressDisplay : true;

    // Show if progress display is enabled AND we're currently processing/playing
    if (showProgress && (isProcessing || currentAudio)) {
      if (!isProgressDisplayVisible) {
        progressElement.style.opacity = '1';
        isProgressDisplayVisible = true;
      }
    } else {
      // Only hide if we're not in a loading state
      const isInitialState = progressElement.textContent.includes('Loading') || progressElement.textContent.includes('Preparing');
      if (!isInitialState && isProgressDisplayVisible) {
        progressElement.style.opacity = '0';
        isProgressDisplayVisible = false;
      }
    }
  });
}

/**
 * Force the progress display to be visible immediately
 */
function showProgressDisplayImmediately() {
  if (!progressElement) return;

  chrome.storage.local.get(['showProgressDisplay'], function(items) {
    const showProgress = items.showProgressDisplay !== undefined ? items.showProgressDisplay : true;

    // Show if progress display is enabled
    if (showProgress) {
      progressElement.style.opacity = '1';
      isProgressDisplayVisible = true;
    }
  });
}


/**
 * Removes the progress display element - now just hides it
 */
function removeProgressDisplay() {
  if (progressElement) {
    // Just hide it instead of removing from DOM
    progressElement.style.opacity = '0';
    isProgressDisplayVisible = false;
  }
  // Don't reset counters or nullify progressElement
  // Keep the element in DOM for reuse
}

/**
 * Process sentences, keeping original text for display and preprocessing for TTS
 * @param {Array<string>} originalSentences - The original sentences for display
 * @param {boolean} hasJapanese - Whether text contains Japanese characters
 * @param {boolean} showProgress - Whether to show progress display
 */
async function processSentences(originalSentences, hasJapanese, showProgress) {
    // Set processing state to ensure progress display stays visible
    isProcessing = true;
    updateProgressDisplayVisibility();

    for (let i = 0; i < originalSentences.length; i++) {
        let originalSentence = originalSentences[i];
        if (!originalSentence) continue; // Skip empty sentences

        // Preprocess sentence for TTS backend
        const processedSentence = preprocessSentenceForTTS(originalSentence, hasJapanese);

        try {
            console.log(`SoVITS Screen Reader: Processing sentence ${i + 1}/${originalSentences.length}: "${originalSentence}"`);
            const audioBlob = await sendToBackend(processedSentence); // Send processed text to backend
            console.log(`SoVITS Screen Reader: Received audio blob for sentence ${i + 1}`);

            const type = audioBlob.type || 'audio/wav';
            const audioUrl = URL.createObjectURL(audioBlob);
            audioQueue.push({ 
              src: audioUrl, 
              type: type, 
              sentenceIndex: i + 1, 
              sentenceText: originalSentence  // Use original text for display
            });
            console.log(`SoVITS Screen Reader: Enqueued audio for sentence ${i + 1}. Queue size: ${audioQueue.length}`);

            // If no audio is currently playing, start playing from the queue
            if (!currentAudio) {
              console.log("SoVITS Screen Reader: No audio currently playing, starting playback.");
              playNext();
            }
        }
        catch (error) {
            // Check if this was an abort error
            if (error.message === "Request aborted by user.") {
              console.log(`SoVITS Screen Reader: Request for sentence ${i + 1} was aborted.`);
              // Break out of the loop when aborted
              break;
            } else {
              console.error(`SoVITS Screen Reader: Error processing sentence ${i + 1} ('${originalSentence}'):`, error);
            }
        }
    }

    // Reset processing state when done
    isProcessing = false;
    updateProgressDisplayVisibility();
}

async function processSentencesSequentially(sentences) {
    // Check if we're dealing with Japanese text
    const sampleText = sentences.join(' ');
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(sampleText);

    // Create progress display immediately with initial status
    createProgressDisplay(sentences.length);

    // Show "Loading..." status immediately
    updateProgressDisplay('Loading...', 0, sentences.length);

    // Force visibility on for initial loading state
    showProgressDisplayImmediately();

    // Process sentences
    processSentences(sentences, hasJapanese, true);
}

// Modify playNext to update visibility
function playNext() {
  // If queue is empty, reset currentAudio and return
  if (audioQueue.length === 0) {
    console.log("SoVITS Screen Reader: Audio queue is empty.");
    currentAudio = null;
    isProcessing = false;
    updateStatus("idle", "Finished reading");

    // Hide progress display when done
    updateProgressDisplayVisibility();
    return;
  }

  // Dequeue the next audio item
  const { src, type, sentenceIndex, sentenceText } = audioQueue.shift();
  console.log(`SoVITS Screen Reader: Playing next audio from queue. Queue size: ${audioQueue.length}`);

  // Update progress display when actual playback starts
  updateProgressDisplay(sentenceText, sentenceIndex - 1, totalSentenceCount);
  updateProgressDisplayVisibility();

  // Update status
  updateStatus("playing", `Playing sentence ${sentenceIndex}/${totalSentences}`);

  // Create a new Audio element
  currentAudio = new Audio();
  currentAudio.src = src;

  // Listen for the 'ended' event to play the next item in the queue
  currentAudio.addEventListener('ended', () => {
    console.log("SoVITS Screen Reader: Current audio ended.");
    URL.revokeObjectURL(src); // Clean up the object URL
    playNext(); // Play the next item
  });

  // Listen for 'error' event
  currentAudio.addEventListener('error', (e) => {
    console.error("SoVITS Screen Reader: Error playing audio:", e);
    URL.revokeObjectURL(src); // Clean up the object URL even on error
    playNext(); // Try to play the next item
  });

  // Attempt to play the audio
  currentAudio.play().catch(error => {
    console.error("SoVITS Screen Reader: Error initiating audio playback:", error);
    URL.revokeObjectURL(src); // Clean up the object URL on play failure
    playNext(); // Try to play the next item
  });
}

// Modify stopAudio to update visibility
function stopAudio() {
  console.log("SoVITS Screen Reader: Stopping audio and clearing queue.");
  updateStatus("stopping", "Stopping audio...");

  // Hide progress display when stopping
  updateProgressDisplayVisibility();

  // Abort any ongoing API requests
  if (abortController) {
    console.log("SoVITS Screen Reader: Aborting ongoing API request.");
    abortController.abort();
    abortController = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    // Revoke the object URL for the current audio source if it exists
    if (currentAudio.src && currentAudio.src.startsWith('blob:')) {
      URL.revokeObjectURL(currentAudio.src);
    }
    currentAudio = null;
  }

  // Revoke object URLs for all items in the queue
  audioQueue.forEach(item => {
    if (item.src && item.src.startsWith('blob:')) {
      URL.revokeObjectURL(item.src);
    }
  });

  audioQueue = []; // Clear the queue
  isProcessing = false;
  console.log("SoVITS Screen Reader: Audio stopped and queue cleared.");
  updateStatus("idle", "Audio stopped");
}
