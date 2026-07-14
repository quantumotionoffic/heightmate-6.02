/**
 * HeightMate - Main Dashboard UI Integration Hooks
 * Connects the lower-level BLE controllers directly to the user interface.
 */

/**
 * Hook 1: Captures raw incoming height data vectors from bleController.js
 * Expected Input format: "HEIGHT:XYZ.Y"
 */
function handleIncomingHeight(rawData) {
    try {
        if (!rawData || !rawData.includes(":")) {
            console.warn("UI Warning: Malformed height vector received:", rawData);
            return;
        }

        // 1. Extract and clean the value segment
        const [prefix, numericValueStr] = rawData.split(":");
        if (prefix !== "HEIGHT") return;

        const heightInCm = parseFloat(numericValueStr);
        if (isNaN(heightInCm)) throw new Error("Parsed vector string is NaN.");

        console.log(`UI Thread Sync: Measured height -> ${heightInCm} cm`);

        // 2. Render to the dashboard DOM elements safely
        const cmDisplayNode = document.getElementById("live-height-cm");
        if (cmDisplayNode) {
            cmDisplayNode.innerText = heightInCm.toFixed(1);
        }

        // 3. Optional Imperial transformation layer (If user has toggled units)
        const imperialDisplayNode = document.getElementById("live-height-ft-in");
        if (imperialDisplayNode) {
            const totalInches = heightInCm / 2.54;
            const feet = Math.floor(totalInches / 12);
            const remainingInches = Math.round(totalInches % 12);
            imperialDisplayNode.innerText = `${feet}'${remainingInches}"`;
        }

        // 4. Update the active profile payload state for Supabase database insertion later
        window.latestRecordedHeight = heightInCm;

    } catch (error) {
        console.error("UI Height Stream Parsing Error:", error.message);
    }
}

/**
 * Hook 2: Visualizes the live binary slice-and-stream loop from otaController.js
 * Expected Input: progress integer from 0 to 100
 */
function updateProgressBarUI(progress) {
    // Standardize input bounds safely
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));

    // Target the dynamic elements injected by showUpdateModal
    const progressBar = document.getElementById("ota-progress-bar");
    const percentLabel = document.getElementById("ota-percentage-label");
    const statusLabel = document.getElementById("ota-status-label");

    if (progressBar) {
        progressBar.style.width = `${normalizedProgress}%`;
    }

    if (percentLabel) {
        percentLabel.innerText = `${normalizedProgress}%`;
    }

    if (statusLabel && normalizedProgress === 100) {
        statusLabel.innerText = "Rebooting device...";
        statusLabel.className = "text-emerald-500 font-bold animate-pulse";
    }
}

// Global scope attachment to guarantee availability across script bundles
window.handleIncomingHeight = handleIncomingHeight;
window.updateProgressBarUI = updateProgressBarUI;
