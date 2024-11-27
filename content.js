// content.js

console.log("Content script loaded.");

let audioElement;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request);
    if (request.action === "readSelectedText") {
        // Get the selected text
        let selectedText = window.getSelection().toString();

        console.log("Selected text:", selectedText);

        // If text is selected, send it to the backend
        if (selectedText) {
            // Stop and remove any existing audio
            if (audioElement) {
                audioElement.pause();
                audioElement.remove();
            }

            sendToBackend(selectedText)
                .then(() => {})
                .catch(error => console.error('Error:', error));
        }
    }
});

// Function to send the selected text to the backend
function sendToBackend(text) {
    return new Promise(async (resolve, reject) => {
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

        console.log("Sending to backend:", `https://tts.yourdomain.com/api_v2/tts?${queryParams}`);

        try {
            const response = await fetch(`https://tts.yourdomain.com/api_v2/tts?${queryParams}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }

            const audioBlob = await response.blob();
            const type = audioBlob.type || 'audio/wav'; // Set the MIME type based on the blob type

            // Convert blob to data URL
            const audioUrl = await convertBlobToDataURL(audioBlob);

            // Create an audio element and play the audio
            audioElement = new Audio();
            audioElement.src = audioUrl;
            audioElement.type = type; // Set the MIME type
            audioElement.load();
            audioElement.play();

            document.body.appendChild(audioElement);

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// Function to convert blob to data URL
function convertBlobToDataURL(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
}

