const RULE_ID = 1;
let ruleEnabled = false;
let currentRegex = ".*api\\.example\\.com.*"; // default regex
let blockedCount = 0;

console.log("🚀 API Interceptor Extension: Background script initialized");
console.log("📋 Initial state:", {
  ruleEnabled,
  currentRegex,
  RULE_ID,
  blockedCount,
});

// Load saved data from storage on startup
chrome.storage.local
  .get(["regex", "blockedCount"])
  .then((result) => {
    if (result.regex) {
      console.log("📂 Loading saved regex from storage:", result.regex);
      currentRegex = result.regex;
    } else {
      console.log("📂 No saved regex found, using default:", currentRegex);
    }

    if (result.blockedCount !== undefined) {
      console.log("📂 Loading saved blocked count:", result.blockedCount);
      blockedCount = result.blockedCount;
    } else {
      console.log(
        "📂 No saved blocked count found, using default:",
        blockedCount
      );
    }
  })
  .catch((error) => {
    console.error("❌ Failed to load data from storage:", error);
  });

function validateRegex(regex) {
  try {
    new RegExp(regex);
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function enableRule() {
  console.log("🔧 Enabling rule with regex:", currentRegex);

  // Validate regex before applying
  const validation = validateRegex(currentRegex);
  if (!validation.valid) {
    console.error("❌ Invalid regex pattern:", validation.error);
    return Promise.reject(new Error(`Invalid regex: ${validation.error}`));
  }

  console.log("📝 Rule configuration:", {
    id: RULE_ID,
    priority: 1,
    action: { type: "block" },
    condition: {
      regexFilter: currentRegex,
      resourceTypes: ["xmlhttprequest", "script"],
    },
  });

  return chrome.declarativeNetRequest
    .updateDynamicRules({
      addRules: [
        {
          id: RULE_ID,
          priority: 1,
          action: { type: "block" },
          condition: {
            regexFilter: currentRegex,
            resourceTypes: ["xmlhttprequest", "script"],
          },
        },
      ],
      removeRuleIds: [RULE_ID],
    })
    .then(() => {
      console.log("✅ Rule enabled successfully");
      ruleEnabled = true;
      console.log("🚫 Now blocking requests matching:", currentRegex);
    })
    .catch((error) => {
      console.error("❌ Failed to enable rule:", error);
      throw error;
    });
}

function disableRule() {
  console.log("🔧 Disabling rule with ID:", RULE_ID);

  return chrome.declarativeNetRequest
    .updateDynamicRules({
      removeRuleIds: [RULE_ID],
    })
    .then(() => {
      console.log("✅ Rule disabled successfully");
      ruleEnabled = false;
      console.log("✅ No longer blocking requests");
    })
    .catch((error) => {
      console.error("❌ Failed to disable rule:", error);
      throw error;
    });
}

function incrementBlockedCount() {
  blockedCount++;
  console.log("📊 Blocked request count:", blockedCount);

  // Save to storage
  chrome.storage.local
    .set({ blockedCount })
    .then(() => {
      console.log("💾 Blocked count saved to storage:", blockedCount);
    })
    .catch((error) => {
      console.error("❌ Failed to save blocked count:", error);
    });
}

function clearStats() {
  blockedCount = 0;
  console.log("📊 Statistics cleared");

  chrome.storage.local
    .set({ blockedCount })
    .then(() => {
      console.log("💾 Statistics cleared from storage");
    })
    .catch((error) => {
      console.error("❌ Failed to clear statistics:", error);
    });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 Message received:", { type: msg.type, data: msg });
  console.log("📤 Sender:", sender);

  if (msg.type === "enable") {
    console.log("🟢 Enable request received");
    enableRule()
      .then(() => {
        sendResponse({ success: true, enabled: ruleEnabled });
      })
      .catch((error) => {
        console.error("❌ Failed to enable rule:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (msg.type === "disable") {
    console.log("🔴 Disable request received");
    disableRule()
      .then(() => {
        sendResponse({ success: true, enabled: ruleEnabled });
      })
      .catch((error) => {
        console.error("❌ Failed to disable rule:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (msg.type === "setRegex") {
    console.log("🔧 Regex update request:", {
      oldRegex: currentRegex,
      newRegex: msg.regex,
    });

    // Validate regex before saving
    const validation = validateRegex(msg.regex);
    if (!validation.valid) {
      console.error("❌ Invalid regex provided:", validation.error);
      sendResponse({
        success: false,
        error: `Invalid regex: ${validation.error}`,
      });
      return;
    }

    currentRegex = msg.regex;
    chrome.storage.local
      .set({ regex: currentRegex })
      .then(() => {
        console.log("💾 Regex saved to storage:", currentRegex);
        if (ruleEnabled) {
          console.log("🔄 Refreshing rule with new regex");
          return enableRule();
        }
      })
      .then(() => {
        sendResponse({ success: true, regex: currentRegex });
      })
      .catch((error) => {
        console.error("❌ Failed to save regex to storage:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (msg.type === "status") {
    console.log("📊 Status request received, responding with:", {
      enabled: ruleEnabled,
      regex: currentRegex,
      blockedCount: blockedCount,
    });
    sendResponse({
      enabled: ruleEnabled,
      regex: currentRegex,
      blockedCount: blockedCount,
    });
  }

  if (msg.type === "getStats") {
    console.log("📊 Stats request received, responding with:", {
      blockedCount,
    });
    sendResponse({ blockedCount: blockedCount });
  }

  if (msg.type === "clearStats") {
    console.log("🗑️ Clear stats request received");
    clearStats();
    sendResponse({ success: true, blockedCount: blockedCount });
  }
});

// Listen for blocked requests to update statistics
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
  if (details.rule.ruleId === RULE_ID) {
    console.log("🚫 Request blocked:", {
      url: details.request.url,
      type: details.request.type,
      timestamp: new Date().toISOString(),
      ruleId: details.rule.ruleId,
    });
    incrementBlockedCount();
  }
});
