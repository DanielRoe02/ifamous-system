import axios from 'axios';

let isHandlingExpiration = false;

/**
 * Handles session expiration by logging a console alert, alerting the user,
 * clearing auth storage, and redirecting to the login page.
 */
export function handleSessionExpired(router, message = "Session expired. Please log in again.") {
  console.warn("[AUTH ALERT] Session expired. Token validation failed or the configured login session expired.");
  console.error("SESSION_EXPIRED: Invalid or expired JWT token detected.");

  if (isHandlingExpiration) return;
  isHandlingExpiration = true;

  alert(message);

  // Clear stored tokens and session
  localStorage.removeItem("token");
  localStorage.removeItem("authToken");
  localStorage.removeItem("ifamous_token");
  localStorage.removeItem("ifamousToken");
  localStorage.removeItem("userSession");
  localStorage.removeItem("user");
  localStorage.removeItem("currentUser");

  if (router) {
    router.push("/").catch(() => {
      window.location.href = "/";
    });
  } else {
    window.location.href = "/";
  }

  setTimeout(() => {
    isHandlingExpiration = false;
  }, 3000);
}

/**
 * Sets up global Axios and Fetch response interceptors for JWT token validation.
 * @param {object} router - Vue router instance
 */
export function setupAuthInterceptor(router) {
  // 1. Axios Interceptors
  axios.interceptors.request.use((config) => {
    let session = {};
    try {
      session = JSON.parse(localStorage.getItem("userSession") || "null") || {};
    } catch (_) {
      session = {};
    }
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("ifamous_token") ||
      session.token;
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        const responseData = error.response.data || {};
        const code = responseData.code;
        const errText = typeof responseData.error === 'string' ? responseData.error : '';

        if (
          code === 'SESSION_EXPIRED' ||
          code === 'INVALID_TOKEN' ||
          errText.toLowerCase().includes('session expired') ||
          errText.toLowerCase().includes('expired') ||
          errText.toLowerCase().includes('invalid token')
        ) {
          handleSessionExpired(router, errText || "Session expired. Please log in again.");
        }
      }
      return Promise.reject(error);
    }
  );

  // 2. Window Fetch Wrapper Interceptor
  const originalFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    try {
      let session = {};
      try {
        session = JSON.parse(localStorage.getItem("userSession") || "null") || {};
      } catch (_) {
        session = {};
      }
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("ifamous_token") ||
        session.token;
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      const response = await originalFetch.call(this, input, { ...init, headers });
      if (response.status === 401) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          const code = data?.code;
          const errText = typeof data?.error === 'string' ? data.error : '';

          if (
            code === 'SESSION_EXPIRED' ||
            code === 'INVALID_TOKEN' ||
            errText.toLowerCase().includes('session expired') ||
            errText.toLowerCase().includes('expired') ||
            errText.toLowerCase().includes('invalid token')
          ) {
            handleSessionExpired(router, errText || "Session expired. Please log in again.");
          }
        } catch (_) {
          // If response body is not JSON, check status text
          if (response.statusText?.toLowerCase().includes('unauthorized')) {
            handleSessionExpired(router, "Session expired. Please log in again.");
          }
        }
      }
      return response;
    } catch (err) {
      throw err;
    }
  };
}
