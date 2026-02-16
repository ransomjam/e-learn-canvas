import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress noisy "Uncaught (in promise)" console errors from Axios/React Query
// These are already handled by React Query's error states and the auth interceptor
window.addEventListener('unhandledrejection', (event) => {
  // Only suppress Axios errors (they have isAxiosError or response properties)
  const reason = event.reason;
  if (reason && (reason.isAxiosError || reason?.response?.status)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
