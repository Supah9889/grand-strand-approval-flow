/**
 * WebView Bridge for native mobile integration
 * Detects platform and manages hardware back button events
 */

export const isAndroid = () => {
  return /android/i.test(navigator.userAgent);
};

export const isIOS = () => {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

export const isMobileWebView = () => {
  return isAndroid() || isIOS();
};

export const isCordovaAvailable = () => {
  return typeof window !== 'undefined' && window.cordova !== undefined;
};

/**
 * Initialize WebView bridge and hardware back button handler
 * @param {Function} onBackPressed - Callback when hardware back button is pressed
 */
export const initializeWebViewBridge = (onBackPressed) => {
  // Only register on Cordova (native mobile app)
  if (!isCordovaAvailable()) {
    return;
  }

  // For Cordova/PhoneGap apps
  document.addEventListener('backbutton', (event) => {
    event.preventDefault();
    onBackPressed();
  });
};

/**
 * Check if this is a development environment
 */
export const isDevelopment = () => {
  return import.meta.env.MODE === 'development';
};

/**
 * Log navigation debug info (only in development)
 */
export const logNavigation = (message, data = {}) => {
  if (isDevelopment()) {
    console.log(`[Navigation] ${message}`, data);
  }
};