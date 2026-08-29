window.addEventListener('onSendCheatToNetwork', function (event) {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onSendCheatToNetwork', data: event.detail });
});
window.addEventListener('onGameConfigResponse', function (event) {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onGameConfigResponse', data: event.detail });
});
window.addEventListener('onFailedToGetDirector', function (event) {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onFailedToGetDirector' });
});