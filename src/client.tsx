import "./styles.css";
import { createRoot } from "react-dom/client";
import App from "./app";
import { Providers } from "@/providers";

async function validatePasscode(passcode: string): Promise<boolean> {
  try {
    const response = await fetch("/api/validate-passcode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passcode }),
    });
    return response.ok;
  } catch (error) {
    console.error("Error validating passcode:", error);
    return false;
  }
}

async function promptForPasscode(): Promise<string | null> {
  const storedPasscode = sessionStorage.getItem("app_passcode");
  if (storedPasscode) {
    // Validate stored passcode
    const isValid = await validatePasscode(storedPasscode);
    if (isValid) {
      return storedPasscode;
    }
    // If invalid, clear it and prompt again
    sessionStorage.removeItem("app_passcode");
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const passcode = prompt("Please enter the passcode to access this application (see github page for more info):");
    if (!passcode) {
      return null; // User cancelled
    }

    const isValid = await validatePasscode(passcode);
    if (isValid) {
      sessionStorage.setItem("app_passcode", passcode);
      return passcode;
    }

    attempts++;
    if (attempts < maxAttempts) {
      alert(`Incorrect passcode. ${maxAttempts - attempts} attempt(s) remaining.`);
    } else {
      alert("Maximum attempts reached. Please refresh the page to try again.");
      return null;
    }
  }

  return null;
}

async function initApp() {
  const passcode = await promptForPasscode();
  
  if (!passcode) {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif;">
        <div style="text-align: center;">
          <h1>Access Denied</h1>
          <p>Please refresh the page and enter the correct passcode.</p>
        </div>
      </div>
    `;
    return;
  }

  const root = createRoot(document.getElementById("app")!);

  root.render(
    <Providers>
      <div className="bg-neutral-50 text-base text-neutral-900 antialiased transition-colors selection:bg-blue-700 selection:text-white dark:bg-neutral-950 dark:text-neutral-100">
        <App />
      </div>
    </Providers>
  );
}

initApp();
