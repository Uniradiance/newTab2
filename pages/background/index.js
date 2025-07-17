
(() => {
  // In Manifest V3, 'browser_action' is replaced by 'action'.
  chrome.action.onClicked.addListener(() => {
    // When the action icon is clicked, open a new tab.
    // An empty create call will open the page defined in 'chrome_url_overrides.newtab'.
    chrome.tabs.create({});
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      // On first install, open a new tab to show the extension's page.
      chrome.tabs.create({});
    }
  });

  // setUninstallURL is supported in V3. It's good practice to wrap this in a
  // try-catch as it might not be available in all contexts (e.g. some browsers).
  try {
    chrome.runtime.setUninstallURL('');
  } catch (e) {
    console.error('Setting uninstall URL failed:', e);
  }
})();
