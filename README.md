# API Interceptor

Block API requests that match your custom regular expressions. Simplify front-end testing by simulating network failures without ever reloading your web page.

## Features

- 🚫 **Block requests** using custom regex patterns
- 🎯 **Target specific APIs** with precise pattern matching
- 💾 **Persistent settings** - your patterns and state are saved
- ⚡ **Real-time control** - enable/disable blocking instantly
- ✅ **Pattern validation** - validates regex before applying
- 🔒 **Privacy-focused** - minimal permissions, no data collection

## How to Use

1. Click the extension icon to open the popup
2. Enter a regex pattern to match URLs you want to block (e.g., `.*api\.example\.com.*`)
3. Click "Save & Apply" to save your pattern
4. Toggle the switch to enable/disable blocking
5. Your settings persist across browser sessions

## Examples

Block all requests to a specific API:

```
.*api\.example\.com.*
```

Block all API endpoints:

```
.*\/api\/.*
```

Block analytics services:

```
.*analytics.*
```

## Permissions

- `declarativeNetRequest` - Required to block network requests
- `storage` - Required to save your settings
- `host_permissions: <all_urls>` - Required to intercept requests on all websites

## Privacy

This extension does not collect, store, or transmit any personal data. All settings are stored locally on your device.
