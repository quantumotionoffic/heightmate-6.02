/**
 * HeightMate - Production Web Bluetooth Telemetry Integration
 * Handles: Auto-discovery, characteristic caching, and version tracking.
 */

// 1. Structural UUID configuration mappings (Must match ESP32 exactly)
const BLE_CONFIG = {
    serviceUuid: "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
    charHeightUuid: "beb5483e-36e1-4688-b7f5-ea07361b26a8",
    charVersionUuid: "c2c546be-17b5-4a64-af20-d38a0f9b3b89",
    charDeviceInfoUuid: "a4b2c1d0-37b5-41ef-8d19-b52e071c89a4",
    otaServiceUuid: "d6f1d96d-594c-4c53-ae6c-bb98f7e9a2d1"
};

let bleDevice = null;
let bleServer = null;
let cachedCharacteristics = new Map();

/**
 * Main Trigger Function when user clicks the "Connect Device" button
 */
async function connectHeightMate() {
    try {
        console.log("Searching for HeightMate ecosystem over BLE...");
        
        // Request the device using the name prefix established in firmware
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'HeightMate' }
            ],
            optionalServices: [BLE_CONFIG.serviceUuid, BLE_CONFIG.otaServiceUuid]
        });

        // Register event listener to catch accidental dropouts cleanly
        bleDevice.addEventListener('gattserverdisconnected', onDeviceDisconnected);
        
        console.log("Connecting to GATT Server...");
        bleServer = await bleDevice.gatt.connect();
        
        console.log("Fetching primary tracking services...");
        const primaryService = await bleServer.getPrimaryService(BLE_CONFIG.serviceUuid);
        
        // Cache all exposed attributes immediately to reduce communication roundtrips
        const characteristics = await primaryService.getCharacteristics();
        cachedCharacteristics.clear();
        characteristics.forEach(char => {
            cachedCharacteristics.set(char.uuid.toLowerCase(), char);
        });

        console.log("GATT channel secured. Synchronizing device metadata...");
        await readDeviceTelemetry();

    } catch (error) {
        console.error("Web BLE Sync Exception:", error);
        alert(`Connection Failed: ${error.message}`);
    }
}

/**
 * Extracts version numbers and live telemetry fields directly from the ESP32 array map
 */
async function readDeviceTelemetry() {
    try {
        // Step A: Extract the Static Firmware Version String
        const versionChar = cachedCharacteristics.get(BLE_CONFIG.charVersionUuid);
        if (versionChar) {
            const versionBuffer = await versionChar.readValue();
            const currentVersionStr = new TextDecoder().decode(versionBuffer);
            
            console.log(`Hardware identified: Version running -> ${currentVersionStr}`);
            
            // Render on UI if you have an element for it
            const fwLabel = document.getElementById("fw-version-display");
            if (fwLabel) fwLabel.innerText = `Firmware: v${currentVersionStr}`;
            
            // Expose version globally so the OTA manager can access it next
            window.currentDeviceVersion = currentVersionStr;
        }

        // Step B: Extract the Dynamic JSON Telemetry Data Array
        const telemetryChar = cachedCharacteristics.get(BLE_CONFIG.charDeviceInfoUuid);
        if (telemetryChar) {
            const telemetryBuffer = await telemetryChar.readValue();
            const jsonText = new TextDecoder().decode(telemetryBuffer);
            const telemetryData = JSON.parse(jsonText);
            
            console.log("Decoded System Telemetry:", telemetryData);
            
            // Dynamically push to your UI Dashboard metrics
            if (document.getElementById("battery-metric")) {
                document.getElementById("battery-metric").innerText = `${telemetryData.bat}%`;
            }
            if (document.getElementById("model-metric")) {
                document.getElementById("model-metric").innerText = telemetryData.model;
            }
        }
        
        // Step C: Initialize the height metric notification stream (Your original feature)
        const heightChar = cachedCharacteristics.get(BLE_CONFIG.charHeightUuid);
        if (heightChar) {
            await heightChar.startNotifications();
            heightChar.addEventListener('characteristicvaluechanged', (event) => {
                const rawData = new TextDecoder().decode(event.target.value);
                console.log("Incoming tracking vector:", rawData); // e.g. "HEIGHT:124.5"
                
                if (typeof handleIncomingHeight === 'function') {
                    handleIncomingHeight(rawData);
                }
            });
        }

        // Trigger the update engine check instantly
        if (window.currentDeviceVersion && typeof orchestrateOTAUpdate === 'function') {
            await orchestrateOTAUpdate(window.currentDeviceVersion);
        }

    } catch (err) {
        console.error("Failed to safely compile device parameters:", err);
    }
}

/**
 * Graceful handling of peripheral drops
 */
function onDeviceDisconnected(event) {
    console.warn("HeightMate GATT stream dropped connections safely.");
    cachedCharacteristics.clear();
    
    // Reset dashboard connection indicators if present
    const fwLabel = document.getElementById("fw-version-display");
    if (fwLabel) fwLabel.innerText = "Device Disconnected";
    
    alert("HeightMate disconnected. Re-engaging hardware advertising loop...");
}
