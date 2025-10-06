console.log("🚀 API Interceptor Extension: Popup script initialized");

const toggle = document.getElementById("toggle");
const regexInput = document.getElementById("regexInput");
const saveButton = document.getElementById("saveRegex");
const blockingStatus = document.getElementById("blockingStatus");
const regexStatus = document.getElementById("regexStatus");

console.log("🔍 DOM elements found:", {
  toggle: !!toggle,
  regexInput: !!regexInput,
  saveButton: !!saveButton,
  blockingStatus: !!blockingStatus,
  regexStatus: !!regexStatus,
});

// Utility functions
function showStatus(element, message, type = "info") {
  element.textContent = message;
  element.className = `status ${type}`;
  element.style.display = "block";
  setTimeout(() => {
    element.style.display = "none";
  }, 3000);
}

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

// Toggle blocking on/off
toggle.addEventListener("click", () => {
  const isActive = toggle.classList.contains("active");
  const action = isActive ? "disable" : "enable";

  console.log("🔄 Toggle clicked:", { isActive, action });

  chrome.runtime.sendMessage({ type: action }, (res) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Message error:", chrome.runtime.lastError);
      showStatus(
        blockingStatus,
        "Error: Failed to update blocking state",
        "error"
      );
      return;
    }

    if (action === "enable") {
      toggle.classList.add("active");
      showStatus(blockingStatus, "API blocking enabled", "success");
    } else {
      toggle.classList.remove("active");
      showStatus(blockingStatus, "API blocking disabled", "info");
    }

    console.log("✅ Blocking state updated:", res?.enabled);
  });
});

// Real-time regex validation
regexInput.addEventListener("input", () => {
  const regex = regexInput.value.trim();
  if (regex) {
    const validation = validateRegex(regex);
    if (validation.valid) {
      showStatus(regexStatus, "Valid regex pattern", "success");
    } else {
      showStatus(regexStatus, `Invalid regex: ${validation.error}`, "error");
    }
  } else {
    regexStatus.style.display = "none";
  }
});

// Save regex with validation
saveButton.addEventListener("click", () => {
  const regex = regexInput.value.trim();
  console.log("💾 Save button clicked:", { regex, isEmpty: !regex });

  if (!regex) {
    showStatus(regexStatus, "Please enter a regex pattern", "error");
    return;
  }

  const validation = validateRegex(regex);
  if (!validation.valid) {
    showStatus(regexStatus, `Invalid regex: ${validation.error}`, "error");
    return;
  }

  console.log("📤 Sending regex update message:", regex);
  chrome.runtime.sendMessage({ type: "setRegex", regex }, (res) => {
    if (chrome.runtime.lastError) {
      console.error("❌ Regex update error:", chrome.runtime.lastError);
      showStatus(regexStatus, "Failed to save regex", "error");
      return;
    }

    showStatus(regexStatus, "Regex saved and applied", "success");
    console.log("✅ Regex updated successfully:", regex);
  });
});

// Restore state when popup opens
console.log("📊 Requesting status from background script");
chrome.runtime.sendMessage({ type: "status" }, (res) => {
  if (chrome.runtime.lastError) {
    console.error("❌ Status request error:", chrome.runtime.lastError);
    return;
  }

  if (!res) {
    console.warn("⚠️ No response received from background script");
    return;
  }

  console.log("📊 Status received:", res);
  console.log("🔄 Restoring UI state:", {
    enabled: res.enabled,
    regex: res.regex,
  });

  // Update toggle state
  if (res.enabled) {
    toggle.classList.add("active");
  } else {
    toggle.classList.remove("active");
  }

  regexInput.value = res.regex || "";

  console.log("✅ UI state restored successfully");
});
