/**
 * HeightMate - Cloud OTA Orchestration & Streaming Pipeline
 * Architecture: Non-blocking Chunked Binary Streamer
 */

const OTA_CONFIG = {
    serviceUuid: "d6f1d96d-594c-4c53-ae6c-bb98f7e9a2d1",
    characteristicUuid: "40c0aa24-5d51-4629-9d7a-d760b943d043",
    chunkSize: 512 // Explicit MTU layout alignment
};

async function orchestrateOTAUpdate(currentFirmwareVersion) {
    try {
        // Step A: Connect to Supabase Storage and pull the latest deployment manifest
        const { data, error } = await window.supabaseClient
            .storage
            .from('firmware')
            .download('firmware.json');
            
        if (error) throw error;
        
        const manifest = JSON.parse(await data.text());
        
        // Step B: Evaluate versions strictly using Semantic Rules (Major.Minor.Patch)
        const parse = (v) => v.split('.').map(Number);
        const [cMajor, cMinor, cPatch] = parse(currentFirmwareVersion);
        const [lMajor, lMinor, lPatch] = parse(manifest.latest_version);
        
        let updateAvailable = false;
        if (lMajor > cMajor) updateAvailable = true;
        else if (lMajor === cMajor && lMinor > cMinor) updateAvailable = true;
        else if (lMajor === cMajor && lMinor === cMinor && lPatch > cPatch) updateAvailable = true;

        if (updateAvailable) {
            console.log(`New Firmware version found: v${manifest.latest_version}`);
            
            // Step C: Launch the confirmation dialog to let the user stream it
            showUpdateModal(manifest);
        } else {
            console.log("HeightMate Hardware is running the optimized build.");
        }
    } catch (err) {
        console.error("OTA Check System Error:", err.message);
    }
}

/**
 * Manages the generation and deployment of the visual update confirmation UI
 */
function showUpdateModal(manifest) {
    // Check if modal container already exists, otherwise create it dynamically
    let modal = document.getElementById("ota-update-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "ota-update-modal";
        modal.className = "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4";
        document.body.appendChild(modal);
    }
    
    const releaseNotesHtml = manifest.release_notes.map(note => `<li>• ${note}</li>`).join('');
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 text-slate-900 dark:text-slate-100 animate-fade-in">
            <h3 class="text-xl font-bold tracking-tight">System Update Available</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">A new firmware update (<span class="font-semibold text-teal-500">v${manifest.latest_version}</span>) is available for your HeightMate tracking hardware.</p>
            
            <div class="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900 text-xs space-y-1">
                <span class="font-medium text-slate-400 block mb-1">Release Notes:</span>
                <ul class="space-y-1 font-mono">${releaseNotesHtml}</ul>
            </div>
            
            <div id="ota-progress-container" class="hidden space-y-2">
                <div class="flex justify-between text-xs font-mono">
                    <span id="ota-status-label">Streaming image...</span>
                    <span id="ota-percentage-label">0%</span>
                </div>
                <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div id="ota-progress-bar" class="bg-teal-500 h-full w-0 transition-all duration-150 ease-out"></div>
                </div>
            </div>
            
            <div id="ota-action-buttons" class="flex space-x-3 justify-end pt-2">
                <button onclick="document.getElementById('ota-update-modal').remove()" class="px-4 py-2 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">Skip</button>
                <button id="ota-confirm-btn" class="px-5 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white rounded-xl shadow-md transition">Update Now</button>
            </div>
        </div>
    `;
    
    document.getElementById("ota-confirm-btn").addEventListener("click", () => {
        executeFirmwareFlash(manifest.file);
    });
}

/**
 * Downloads binary image and coordinates packet delivery over GATT interfaces
 */
async function executeFirmwareFlash(fileName) {
    try {
        // 1. Download the raw binary build map from Supabase
        const { data, error } = await window.supabaseClient
            .storage
            .from('firmware')
            .download(fileName);
        if (error) throw error;
        
        const rawBuffer = await data.arrayBuffer();
        const totalBytes = rawBuffer.byteLength;
        
        // 2. Open up the communication line to the ESP32 OTA profile
        const otaService = await bleDevice.gatt.getPrimaryService("d6f1d96d-594c-4c53-ae6c-bb98f7e9a2d1");
        const otaCharacteristic = await otaService.getCharacteristic("40c0aa24-5d51-4629-9d7a-d760b943d043");
        
        let bytesSent = 0;
        
        // 3. Slice and stream loop
        while (bytesSent < totalBytes) {
            const currentChunkSize = Math.min(512, totalBytes - bytesSent);
            const chunkView = new Uint8Array(rawBuffer, bytesSent, currentChunkSize);
            
            // Stream chunk instantly without waiting for a confirmation overhead packet
            await otaCharacteristic.writeValueWithoutResponse(chunkView);
            bytesSent += currentChunkSize;
            
            // Calculate progress value for UI display bars
            const progress = Math.round((bytesSent / totalBytes) * 100);
            updateProgressBarUI(progress); 
        }
        
        console.log("Firmware payload written. ESP32 reboot sequence triggered.");
    } catch (err) {
        console.error("Flashing pipeline dropped:", err);
    }
}
