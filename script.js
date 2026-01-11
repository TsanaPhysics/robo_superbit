/**
 * Superbit Robot Controller - Web Bluetooth Implementation
 * Connecting to Micro:bit via Nordic UART Service
 */

// Basic UUIDs for Nordic UART Service
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Phone transmits to this (Write)
const UART_RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Phone receives from this (Notify)

let bluetoothDevice;
let txCharacteristic;
let rxCharacteristic;

// UI Elements
const connectBtn = document.getElementById('btn-connect');
const statusDiv = document.getElementById('connection-status');
const consoleOutput = document.getElementById('console-output');
const buttons = document.querySelectorAll('button.btn-dir, button.btn-action');

// Event Listeners
connectBtn.addEventListener('click', connectBluetooth);

buttons.forEach(btn => {
    // Repeated send on hold could be implemented here
    btn.addEventListener('touchstart', handleInput);
    btn.addEventListener('mousedown', handleInput);

    // Stop on release (optional, good for safety)
    btn.addEventListener('touchend', () => sendCommand('stop'));
    btn.addEventListener('mouseup', () => sendCommand('stop'));
});

function handleInput(e) {
    if (e.type === 'touchstart') e.preventDefault(); // Prevent ghost clicks
    const commandType = e.target.getAttribute('data-command');
    if (commandType) {
        sendCommand(commandType);
    }
}

/**
 * Connect to the Micro:bit via Bluetooth
 */
async function connectBluetooth() {
    if (!navigator.bluetooth) {
        alert("Web Bluetooth is NOT supported in this browser!\nPlease use Chrome, Edge, or Bluefy (iOS).\nAlso ensure you are using HTTPS or localhost.");
        logToConsole("Error: Web Bluetooth API not found.");
        return;
    }

    try {
        logToConsole('Requesting Bluetooth Device...');

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'BBC micro:bit' }],
            optionalServices: [UART_SERVICE_UUID]
        });

        // Detect disconnects
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        updateStatus('connecting'); // Visual feedback

        logToConsole('Connecting to GATT Server...');
        const server = await bluetoothDevice.gatt.connect();

        logToConsole('Getting UART Service...');
        const service = await server.getPrimaryService(UART_SERVICE_UUID);

        logToConsole('Getting TX Characteristic...');
        txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

        // OPTIONAL: Get RX Characteristic (for receiving data from Robot)
        // We wrap this in a try-catch so that if it fails (common on some Androids),
        // we can STILL connect and drive the robot (sending commands works via TX).
        try {
            logToConsole('Getting RX Characteristic (Optional)...');
            rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

            logToConsole('Starting Notifications...');
            await rxCharacteristic.startNotifications();
            rxCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
        } catch (rxError) {
            logToConsole('⚠️ Could not setup data receiving: ' + rxError);
            logToConsole('👉 You can still drive! (Just cannot receive data)');
        }

        logToConsole('Connected!');
        updateStatus(true);

    } catch (error) {
        console.error('Connection failed:', error);
        logToConsole('❌ Connection failed: ' + error);
        updateStatus(false);

        // Specific advice for common macOS/firmware errors
        let advice = "";
        if (error.name === "NotSupportedError" || error.toString().includes("GATT Error")) {
            advice = "👉 macOS Fix: Go to System Settings > Bluetooth. If 'BBC micro:bit' is listed, click (i) and 'Forget This Device'. Do NOT pair it manually. Try connecting again here.";
        } else if (error.name === "NotFoundError") {
            advice = "👉 Hex File Check: Device not found or incorrect service. Ensure you flashed the correct .hex file with Bluetooth services enabled.";
        } else if (error.name === "SecurityError") {
            advice = "👉 Permission: You cancelled the selection or permission was denied.";
        } else if (error.name === "NetworkError") {
            advice = "👉 Busy: Device might be connected to another computer/phone. Disconnect it there first.";
        }

        if (advice) {
            logToConsole(advice);
            alert('Connection Failed!\n\nCheck the Debug Log for a fix.\n\n' + error);
        } else {
            alert('Connection Failed!\n' + error);
        }
    }
}

function onDisconnected(event) {
    logToConsole('Device disconnected.');
    updateStatus(false);
}

function updateStatus(state) {
    if (state === true || state === 'connected') {
        statusDiv.textContent = 'Connected';
        statusDiv.className = 'status connected';
        connectBtn.style.display = 'none'; // Hide connect button
    } else if (state === 'connecting') {
        statusDiv.textContent = 'Connecting...';
        statusDiv.className = 'status connecting'; // You might need CSS for this, or reuse disconnected for now with text change
        statusDiv.style.backgroundColor = '#f39c12'; // Orange/Yellow manually
    } else {
        statusDiv.textContent = 'Disconnected';
        statusDiv.className = 'status disconnected';
        statusDiv.style.backgroundColor = ''; // Reset
        connectBtn.style.display = 'inline-block';
    }
}

/**
 * Generate and send the command
 */
async function sendCommand(action) {
    if (!bluetoothDevice || !bluetoothDevice.gatt.connected || !txCharacteristic) {
        logToConsole('Not connected. Cannot send: ' + action);
        return;
    }

    // JSON Command Structure
    // NOTE: This structure MUST match what your specific Micro:bit code expects.
    // Simple String Command Structure (per robot.json)
    // Commands: F=Forward, B=Backward, L=Left, R=Right, S=Stop, K1=Kick
    let commandString = "";

    switch (action) {
        case 'forward': commandString = "F"; break;
        case 'backward': commandString = "B"; break;
        case 'left': commandString = "L"; break;
        case 'right': commandString = "R"; break;
        case 'kick': commandString = "K1"; break;
        case 'stop': commandString = "S"; break;
        default: return; // Unknown command
    }

    // Append newline as is common for UART/Serial parsers
    const dataString = commandString + "\n";


    const encoder = new TextEncoder();
    const data = encoder.encode(dataString);

    try {
        // Android/WebBluetooth often prefers WriteWithoutResponse for UART services
        // to avoid "GATT Error" or "NotSupportedError"
        if (txCharacteristic.properties.writeWithoutResponse) {
            await txCharacteristic.writeValueWithoutResponse(data);
        } else {
            await txCharacteristic.writeValue(data);
        }
        logToConsole('Sent: ' + dataString.trim());
    } catch (error) {
        logToConsole('Send Error: ' + error);
    }
}

/**
 * Handle incoming data from Micro:bit
 */
function handleNotifications(event) {
    const value = event.target.value;
    const decoder = new TextDecoder();
    const message = decoder.decode(value);
    logToConsole('Received: ' + message.trim());
}

function logToConsole(message) {
    const timestamp = new Date().toLocaleTimeString();
    consoleOutput.textContent = `[${timestamp}] ${message}\n` + consoleOutput.textContent;
}
