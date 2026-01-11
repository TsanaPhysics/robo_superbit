/**
 * SUPERBIT SOCCER ROBOT CODE (FINAL)
 * ----------------------------------
 * 1. Go to MakeCode: https://makecode.microbit.org/
 * 2. Extensions: Search and add "SuperBit" or "Yahboom" (SuperBitV2) if not already there.
 * 3. Switch to "JavaScript" view.
 * 4. Paste this ENTIRE code.
 * 5. Download .hex and Flash.
 */

let command = ""

// Handle Bluetooth Data
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    command = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    // Motor Logic
    if (command == "F") {
        // Forward
        SuperBitV2.MotorRunDual(SuperBitV2.enMotors.M1, 150, SuperBitV2.enMotors.M2, -150)
        basic.showArrow(ArrowNames.North)
    } else if (command == "B") {
        // Backward
        SuperBitV2.MotorRunDual(SuperBitV2.enMotors.M1, -150, SuperBitV2.enMotors.M2, 150)
        basic.showArrow(ArrowNames.South)
    } else if (command == "L") {
        // Left
        SuperBitV2.MotorRunDual(SuperBitV2.enMotors.M1, -100, SuperBitV2.enMotors.M2, -100)
        basic.showArrow(ArrowNames.West)
    } else if (command == "R") {
        // Right
        SuperBitV2.MotorRunDual(SuperBitV2.enMotors.M1, 100, SuperBitV2.enMotors.M2, 100)
        basic.showArrow(ArrowNames.East)
    } else if (command == "S") {
        // Stop
        SuperBitV2.MotorRunDual(SuperBitV2.enMotors.M1, 0, SuperBitV2.enMotors.M2, 0)
        basic.showIcon(IconNames.SmallDiamond)

        // OPTIONAL: Reset Servo when stopped? 
        // If you want the kick to retract automatically when you release the button, uncomment the line below:
        // SuperBitV2.Servo(SuperBitV2.enServo.S1, 90)

    } else if (command == "K1") {
        // Kick
        SuperBitV2.Servo(SuperBitV2.enServo.S1, 50)
    }
})

// Start Bluetooth Service
bluetooth.startUartService()

// Show "Happy" to confirm code is running
basic.showIcon(IconNames.Happy)
