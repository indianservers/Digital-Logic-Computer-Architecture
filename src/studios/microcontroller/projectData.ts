export type ProjectId = "traffic" | "street" | "thermometer" | "ultrasonic" | "irrigation" | "robot" | "motor" | "arm" | "weather" | "home" | "iot" | "builder";
export type Control = { key: string; label: string; kind: "range" | "toggle" | "select"; min?: number; max?: number; step?: number; unit?: string; options?: string[] };
export type ProjectDef = { id: ProjectId; number: number; slug: string; title: string; objective: string; code: string; controls: Control[]; notes: string[]; pins: Array<[string, string]> };

export const PROJECT_LABS: ProjectDef[] = [
  { id: "traffic", number: 61, slug: "traffic-light-controller", title: "Traffic Light Controller", objective: "Design safe two-axis traffic sequencing and test pedestrian and emergency events.", code: `#define GREEN_TIME 8
#define YELLOW_TIME 2
#define ALL_RED_TIME 1
void loop() {
  trafficCycle(GREEN_TIME, YELLOW_TIME);
}`, controls: [
    { key: "greenTime", label: "Green time", kind: "range", min: 2, max: 20, unit: "s" }, { key: "yellowTime", label: "Yellow time", kind: "range", min: 1, max: 6, unit: "s" }, { key: "mode", label: "Mode", kind: "select", options: ["Auto", "Manual"] }, { key: "pedestrian", label: "Pedestrian request", kind: "toggle" }, { key: "emergency", label: "Emergency override", kind: "toggle" },
  ], notes: ["Opposing approaches can never both show green.", "Yellow and all-red provide a safe transition.", "Try shortening green time in the code and rerun."], pins: [["PA0", "N/S red"], ["PA1", "N/S yellow"], ["PA2", "N/S green"], ["PB0", "E/W red"], ["PB1", "E/W yellow"], ["PB2", "E/W green"]] },
  { id: "street", number: 62, slug: "automatic-street-light", title: "Automatic Street Light", objective: "Switch street lamps from a simulated LDR reading and compare automatic and manual control.", code: `#define LDR_THRESHOLD 300
void loop() {
  int light = analogRead(LDR);
  if (light < LDR_THRESHOLD) {
    setLamp(true);
  } else {
    setLamp(false);
  }
}`, controls: [
    { key: "ambient", label: "Ambient light", kind: "range", min: 0, max: 1000, unit: "lux" }, { key: "threshold", label: "Light threshold", kind: "range", min: 50, max: 800, unit: "lux" }, { key: "mode", label: "Mode", kind: "select", options: ["Auto", "Manual"] }, { key: "override", label: "Manual lamp switch", kind: "toggle" },
  ], notes: ["An LDR provides an analog light reading.", "The relay switches the higher-current lamp circuit.", "Edit LDR_THRESHOLD to move the switching point."], pins: [["PA0", "LDR (ADC)"], ["PB5", "Lamp relay"], ["3V3", "Sensor supply"], ["GND", "Common ground"]] },
  { id: "thermometer", number: 63, slug: "digital-thermometer", title: "Digital Thermometer", objective: "Convert sensor readings into a temperature display and test the alarm threshold.", code: `#define TEMP_SCALE 100
#define ALARM_TEMP 40
void loop() {
  float measured = readTemperature();
  displayTemperature(measured * TEMP_SCALE / 100);
}`, controls: [
    { key: "environment", label: "Room temperature", kind: "range", min: -10, max: 60, step: 0.5, unit: "°C" }, { key: "sensor", label: "Sensor", kind: "select", options: ["LM35", "DS18B20"] }, { key: "unit", label: "Display unit", kind: "select", options: ["°C", "°F"] }, { key: "alarm", label: "Alarm threshold", kind: "range", min: 0, max: 60, unit: "°C" },
  ], notes: ["LM35 produces about 10 mV per degree Celsius.", "DS18B20 reports a digital temperature value.", "TEMP_SCALE in the code calibrates the display."], pins: [["PA0", "LM35 analog input"], ["PB7", "LCD SDA"], ["PB6", "LCD SCL"], ["PC13", "Alarm LED"]] },
  { id: "ultrasonic", number: 64, slug: "ultrasonic-distance-meter", title: "Ultrasonic Distance Meter", objective: "Measure an object's distance from a trigger and echo time-of-flight signal.", code: `#define ALERT_DISTANCE 30
#define TRIGGER_US 10
void loop() {
  measureDistance(TRIGGER_US);
}`, controls: [
    { key: "distance", label: "Object distance", kind: "range", min: 5, max: 200, step: 0.5, unit: "cm" }, { key: "alert", label: "Alert threshold", kind: "range", min: 5, max: 100, unit: "cm" }, { key: "temperature", label: "Air temperature", kind: "range", min: 0, max: 40, unit: "°C" }, { key: "buzzer", label: "Buzzer enabled", kind: "toggle" },
  ], notes: ["Distance is echo time multiplied by sound speed, divided by two.", "Sound speed changes slightly with air temperature.", "Edit TRIGGER_US or ALERT_DISTANCE and rerun."], pins: [["PA1", "Trigger"], ["PA2", "Echo"], ["PA5", "Buzzer"], ["5V", "Sensor supply"]] },
  { id: "irrigation", number: 65, slug: "smart-irrigation-controller", title: "Smart Irrigation Controller", objective: "Keep three garden zones watered with moisture hysteresis and a shared pump.", code: `#define MOISTURE_ON 30
#define MOISTURE_OFF 50
#define MIN_RUN_TIME 3
void loop() {
  controlIrrigation(MOISTURE_ON, MOISTURE_OFF);
}`, controls: [
    { key: "zone", label: "Selected zone", kind: "select", options: ["Vegetables", "Herbs", "Flowers"] }, { key: "moisture", label: "Selected zone moisture", kind: "range", min: 0, max: 100, unit: "%" }, { key: "onThreshold", label: "Turn on below", kind: "range", min: 5, max: 70, unit: "%" }, { key: "offThreshold", label: "Turn off above", kind: "range", min: 20, max: 95, unit: "%" }, { key: "weather", label: "Weather", kind: "select", options: ["Sunny", "Cloudy", "Rain"] }, { key: "mode", label: "Mode", kind: "select", options: ["Auto", "Manual"] }, { key: "override", label: "Manual pump", kind: "toggle" },
  ], notes: ["Separate on/off thresholds prevent rapid relay chatter.", "The pump increases soil moisture while evaporation decreases it.", "Change MOISTURE_ON to see a different start point."], pins: [["PA0", "Vegetables sensor"], ["PA1", "Herbs sensor"], ["PA2", "Flowers sensor"], ["PB0", "Pump relay"]] },
  { id: "robot", number: 66, slug: "line-following-robot", title: "Line-Following Robot Controller", objective: "Tune a moving robot to follow a track using three infrared sensors.", code: `#define KP 0.60
#define KI 0.00
#define KD 0.30
void loop() {
  setMotorSpeed(150, 150);
}`, controls: [
    { key: "track", label: "Track", kind: "select", options: ["Oval", "S curve", "Figure eight", "Challenging"] }, { key: "speed", label: "Speed", kind: "range", min: 20, max: 100, unit: "%" }, { key: "control", label: "Control", kind: "select", options: ["PID", "Threshold"] }, { key: "kp", label: "Kp", kind: "range", min: 0, max: 2, step: 0.05 }, { key: "ki", label: "Ki", kind: "range", min: 0, max: 1, step: 0.01 }, { key: "kd", label: "Kd", kind: "range", min: 0, max: 1, step: 0.05 },
  ], notes: ["Three IR sensors report where the dark line lies.", "Wheel speed difference changes heading.", "Try extreme gains or uneven motor speeds in code."], pins: [["PA0", "Left IR"], ["PA1", "Center IR"], ["PA2", "Right IR"], ["PB0", "Left motor PWM"], ["PB1", "Right motor PWM"]] },
  { id: "motor", number: 67, slug: "dc-motor-speed-controller", title: "DC Motor Speed Controller", objective: "Drive a motor through an H-bridge and observe speed, current, and PWM.", code: `#define PWM_DUTY 60
#define PWM_FREQUENCY 1000
void loop() {
  analogWrite(MOTOR_PIN, PWM_DUTY);
}`, controls: [
    { key: "duty", label: "PWM duty", kind: "range", min: 0, max: 100, unit: "%" }, { key: "voltage", label: "Supply voltage", kind: "range", min: 3, max: 15, step: 0.5, unit: "V" }, { key: "load", label: "Load", kind: "range", min: 0, max: 100, unit: "%" }, { key: "direction", label: "Direction", kind: "select", options: ["Forward", "Reverse"] }, { key: "acceleration", label: "Acceleration", kind: "range", min: 1, max: 10, step: 0.5, unit: "s" },
  ], notes: ["More PWM duty raises average motor voltage.", "Mechanical load reduces RPM and increases current.", "The H-bridge changes polarity for reverse drive."], pins: [["PA8", "PWM enable"], ["PB0", "H-bridge IN1"], ["PB1", "H-bridge IN2"], ["12V", "Motor supply"]] },
  { id: "arm", number: 68, slug: "servo-robotic-arm", title: "Servo-Based Robotic Arm", objective: "Move five servo axes, record poses, and perform a pick-and-place sequence.", code: `#define BASE_ANGLE 90
#define SHOULDER_ANGLE 45
#define ELBOW_ANGLE 60
#define WRIST_ANGLE 20
#define GRIPPER_OPEN 80
void loop() {
  servo_write(BASE, BASE_ANGLE);
  servo_write(SHOULDER, SHOULDER_ANGLE);
  servo_write(ELBOW, ELBOW_ANGLE);
  servo_write(WRIST, WRIST_ANGLE);
  servo_write(GRIPPER, GRIPPER_OPEN);
}`, controls: [
    { key: "base", label: "Base", kind: "range", min: 0, max: 180, unit: "°" }, { key: "shoulder", label: "Shoulder", kind: "range", min: 0, max: 180, unit: "°" }, { key: "elbow", label: "Elbow", kind: "range", min: 0, max: 180, unit: "°" }, { key: "wrist", label: "Wrist", kind: "range", min: 0, max: 180, unit: "°" }, { key: "gripper", label: "Gripper", kind: "range", min: 0, max: 100, unit: "%" },
  ], notes: ["A servo pulse width maps to a target angle.", "The arm moves gradually toward commanded poses.", "Edit a servo_write value and rerun to change the pose."], pins: [["PA0", "Base servo"], ["PA1", "Shoulder servo"], ["PA2", "Elbow servo"], ["PA3", "Wrist servo"], ["PB0", "Gripper servo"]] },
  { id: "weather", number: 69, slug: "weather-monitoring-station", title: "Weather Monitoring Station", objective: "Sample environmental sensors and watch measured trends update over time.", code: `#define SAMPLE_INTERVAL 2
#define TEMP_SENSOR 1
#define HUMIDITY_SENSOR 1
#define WIND_SENSOR 1
void loop() {
  sampleWeather(SAMPLE_INTERVAL);
}`, controls: [
    { key: "temperature", label: "Temperature", kind: "range", min: -10, max: 50, unit: "°C" }, { key: "humidity", label: "Humidity", kind: "range", min: 0, max: 100, unit: "%" }, { key: "wind", label: "Wind speed", kind: "range", min: 0, max: 80, unit: "km/h" }, { key: "rain", label: "Rainfall", kind: "range", min: 0, max: 20, unit: "mm" }, { key: "light", label: "Light", kind: "range", min: 0, max: 1000, unit: "lux" }, { key: "logging", label: "Data logging", kind: "toggle" },
  ], notes: ["Sensors sample the environment at a programmed interval.", "Trends reflect collected runtime samples.", "Edit SAMPLE_INTERVAL to change chart density."], pins: [["PA1", "DHT22 temperature/humidity"], ["PA4", "Pressure sensor"], ["PB0", "Anemometer"], ["PB1", "Rain gauge"]] },
  { id: "home", number: 70, slug: "home-automation-controller", title: "Home Automation Controller", objective: "Apply household scenes and respond to motion, light, and security inputs.", code: `#define DARK_THRESHOLD 300
#define MOTION_LIGHT 1
void loop() {
  automateHome(DARK_THRESHOLD, MOTION_LIGHT);
}`, controls: [
    { key: "mode", label: "Scene", kind: "select", options: ["Home", "Away", "Night", "Custom"] }, { key: "ambient", label: "Ambient light", kind: "range", min: 0, max: 1000, unit: "lux" }, { key: "motion", label: "Motion detected", kind: "toggle" }, { key: "hour", label: "Clock hour", kind: "range", min: 0, max: 23, unit: ":00" }, { key: "schedule", label: "Lighting schedule", kind: "select", options: ["None", "Evening 18–23", "Night 23–06"] }, { key: "living", label: "Living-room light", kind: "toggle" }, { key: "bedroom", label: "Bedroom light", kind: "toggle" }, { key: "kitchen", label: "Kitchen light", kind: "toggle" }, { key: "fan", label: "Ceiling fan", kind: "toggle" }, { key: "lock", label: "Door locked", kind: "toggle" }, { key: "garage", label: "Garage light", kind: "toggle" },
  ], notes: ["Motion and ambient light are inputs to the scene rules.", "Device states and power are derived together.", "Change DARK_THRESHOLD or MOTION_LIGHT in code."], pins: [["PA0", "PIR motion"], ["PA1", "LDR"], ["PB0", "Living light relay"], ["PB1", "Bedroom relay"], ["PB2", "Kitchen relay"], ["PB3", "Fan relay"], ["PB4", "Garage relay"], ["PB5", "Door lock"]] },
  { id: "iot", number: 71, slug: "iot-sensor-node", title: "IoT Sensor Node", objective: "Sample field sensors, send simulated telemetry, and manage power and weak connections.", code: `#define SAMPLE_INTERVAL 5
#define TRANSMIT_INTERVAL 15
#define SEND_TEMPERATURE 1
#define SEND_MOISTURE 1
void loop() {
  publishMQTT(SAMPLE_INTERVAL, TRANSMIT_INTERVAL);
}`, controls: [
    { key: "temperature", label: "Temperature", kind: "range", min: -10, max: 50, unit: "°C" }, { key: "humidity", label: "Humidity", kind: "range", min: 0, max: 100, unit: "%" }, { key: "moisture", label: "Soil moisture", kind: "range", min: 0, max: 100, unit: "%" }, { key: "light", label: "Light", kind: "range", min: 0, max: 1000, unit: "lux" }, { key: "rssi", label: "Signal strength", kind: "range", min: -110, max: -35, unit: "dBm" }, { key: "sample", label: "Sample interval", kind: "range", min: 1, max: 30, unit: "s" }, { key: "transmit", label: "Transmit interval", kind: "range", min: 2, max: 60, unit: "s" }, { key: "sleep", label: "Deep sleep", kind: "toggle" },
  ], notes: ["Telemetry is simulated locally; no cloud account is needed.", "Weak RSSI increases packet loss and buffering.", "Edit the sample and transmit intervals in code."], pins: [["GPIO4", "DHT22"], ["GPIO34", "Soil sensor"], ["GPIO21", "Light sensor"], ["GPIO35", "Battery monitor"]] },
  { id: "builder", number: 72, slug: "build-your-own-mcu", title: "Mini Embedded System – Build Your Own MCU Project", objective: "Choose, wire, program, and test a small embedded system with configurable components.", code: `#define TEMP_LIMIT 30
#define DISTANCE_LIMIT 20
void loop() {
  digitalWrite(LED_GREEN, readTemperature() < TEMP_LIMIT);
  digitalWrite(LED_RED, readDistance() < DISTANCE_LIMIT);
  relayWrite(RELAY, digitalRead(BUTTON));
}`, controls: [
    { key: "board", label: "MCU board", kind: "select", options: ["STM32", "ESP32", "ATmega328P"] }, { key: "temperature", label: "Temperature", kind: "range", min: -10, max: 60, unit: "°C" }, { key: "distance", label: "Distance", kind: "range", min: 2, max: 200, unit: "cm" }, { key: "light", label: "Ambient light", kind: "range", min: 0, max: 1000, unit: "lux" }, { key: "pot", label: "Potentiometer", kind: "range", min: 0, max: 100, unit: "%" }, { key: "button", label: "Button pressed", kind: "toggle" },
  ], notes: ["Select components and assign each a unique output pin.", "Missing power, ground, or duplicate pins produce diagnostics.", "Edit code, run again, and inspect outputs and serial events."], pins: [["PA1", "Temperature sensor"], ["PA2", "Distance sensor"], ["PA4", "Green LED"], ["PA5", "Red LED"], ["PB0", "Buzzer"], ["PB1", "Relay"]] },
];

export const projectBySlug = (slug: string) => PROJECT_LABS.find((lab) => lab.slug === slug);
