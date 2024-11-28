// content.js

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

        // If text is selected, send it to the backend
        if (selectedText) {
            sendToBackend(selectedText)
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
        // Retrieve backend URL from storage
        chrome.storage.local.get('backendUrl', function(items) {
            if (!items || !items.backendUrl) {
                console.error("Backend URL is not set.");
                reject(new Error("Backend URL is not set."));
                return;
            }
            const backendUrl = items.backendUrl;
            console.log("Backend URL:", backendUrl);

            // Construct the query string with the required parameters
            const queryParams = new URLSearchParams({
                text: text,
                text_lang: 'ja', // Assuming the text language is Japanese
                ref_audio_path: 'maaya-umi.wav', // Default reference audio path
                prompt_lang: 'ja', // Assuming the prompt language is Japanese
                prompt_text: '眉唾な話だけど、わたしのおばあちゃんは、月からやってきた人らしい', // Default prompt text
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
}

// Function to split text into sentences using a comprehensive regex
function splitIntoSentences(text) {
    // Regex pattern to match sentence delimiters
    const sentenceDelimiterPattern = /[。！？.\\?!¿¡⁇⁈⁉‽']+\\\\s*/g;

    // Split the text into sentences
    const sentences = text.split(sentenceDelimiterPattern).filter(Boolean);
    return sentences.map(sentence => sentence.trim());
}
