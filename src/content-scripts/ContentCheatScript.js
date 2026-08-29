window.addEventListener('onGameConfigResponse', function (event) {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onGameConfigResponse', data: event.detail });
});
window.addEventListener('onFailedToGetDirector', function () {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onFailedToGetDirector' });
});
window.addEventListener('onCheatProgress', function (event) {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onCheatProgress', data: event.detail });
});
window.addEventListener('onSymbolAssets', function (event) {
    if (chrome && chrome.runtime) chrome.runtime.sendMessage({ action: 'onSymbolAssets', data: event.detail });
});
