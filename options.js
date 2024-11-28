document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('save').addEventListener('click', function() {
    let backendUrl = document.getElementById('backendUrl').value;
    chrome.storage.local.set({ backendUrl: backendUrl }, function() {
      console.log('Backend URL saved:', backendUrl);
      alert('Backend URL saved.');
    });
  });

  // Load the current backend URL
  chrome.storage.local.get('backendUrl', function(items) {
    if (items && items.backendUrl) {
      document.getElementById('backendUrl').value = items.backendUrl;
    } else {
      document.getElementById('backendUrl').value = '';
    }
  });
});

