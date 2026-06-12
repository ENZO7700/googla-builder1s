import "@testing-library/jest-dom";

// Set up test environment variables for Vite/Supabase client initialization
// These are fake values used only during unit tests and do not connect to real services
Object.defineProperty(import.meta, "env", {
  value: {
    ...import.meta.env,
    VITE_SUPABASE_URL: "https://test.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
