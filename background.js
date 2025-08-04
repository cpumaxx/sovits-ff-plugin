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
