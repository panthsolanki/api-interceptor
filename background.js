const RULE_ID = 1;
let ruleEnabled = false;
let currentRegex = ".*api\\.example\\.com.*"; // default regex

console.log("🚀 API Interceptor Extension: Background script initialized");
console.log("📋 Initial state:", {
  ruleEnabled,
  currentRegex,
  RULE_ID,
});

// Load saved data from storage on startup
chrome.storage.local
  .get(["regex", "ruleEnabled"])
  .then((result) => {
    if (result.regex) {
      console.log("📂 Loading saved regex from storage:", result.regex);
      currentRegex = result.regex;
    } else {
      console.log("📂 No saved regex found, using default:", currentRegex);
    }

    if (result.ruleEnabled !== undefined) {
      console.log("📂 Loading saved rule state:", result.ruleEnabled);
      ruleEnabled = result.ruleEnabled;

      // Re-enable the rule if it was active before
      if (ruleEnabled) {
        console.log("🔄 Re-enabling rule from previous session");
        enableRule().catch((error) => {
          console.error("❌ Failed to restore rule on startup:", error);
          ruleEnabled = false;
        });
      }
    } else {
      console.log("📂 No saved rule state found, using default:", ruleEnabled);
    }
  })
  .catch((error) => {
    console.error("❌ Failed to load data from storage:", error);
  });

function validateRegex(regex) {
  try {
    // Basic JavaScript regex validation
    new RegExp(regex);

    // Additional Chrome declarativeNetRequest specific validations
    // Regex must be within reasonable length (Chrome has limits)
    if (regex.length > 2000) {
      return {
        valid: false,
        error: "Regex pattern is too long (max 2000 characters)",
      };
    }

    // Check for empty regex
    if (!regex || regex.trim() === "") {
      return { valid: false, error: "Regex pattern cannot be empty" };
    }

    // Warn about potentially problematic patterns
    // Chrome's RE2 engine doesn't support some JS regex features
    const unsupportedFeatures = [
      { pattern: /\\b/, name: "word boundaries (\\b)" },
      { pattern: /\(\?<=/, name: "lookbehind assertions (?<=)" },
      { pattern: /\(\?<!/, name: "negative lookbehind (?<!)" },
      { pattern: /\(\?=/, name: "lookahead assertions (?=)" },
      { pattern: /\(\?!/, name: "negative lookahead (?!)" },
      { pattern: /\\[0-9]/, name: "backreferences (\\1, \\2, etc.)" },
    ];

    for (const feature of unsupportedFeatures) {
      if (feature.pattern.test(regex)) {
        console.warn(
          `⚠️ Regex contains ${feature.name} which may not work in Chrome's RE2 engine`
        );
      }
    }

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

      // Persist the enabled state
      return chrome.storage.local.set({ ruleEnabled: true });
    })
    .then(() => {
      console.log("💾 Rule state saved to storage");
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

      // Persist the disabled state
      return chrome.storage.local.set({ ruleEnabled: false });
    })
    .then(() => {
      console.log("💾 Rule state saved to storage");
    })
    .catch((error) => {
      console.error("❌ Failed to disable rule:", error);
      throw error;
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
    });
    sendResponse({
      enabled: ruleEnabled,
      regex: currentRegex,
    });
  }
});
