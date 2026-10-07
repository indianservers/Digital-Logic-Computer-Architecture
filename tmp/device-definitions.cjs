"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/studios/how-devices-work/advanced/data.ts
var data_exports = {};
__export(data_exports, {
  ADVANCED_LABS: () => ADVANCED_LABS,
  advancedPath: () => advancedPath,
  findAdvancedLab: () => findAdvancedLab,
  initialAdvancedValues: () => initialAdvancedValues
});
module.exports = __toCommonJS(data_exports);

// src/studios/how-devices-work/advanced/parameters.ts
function itemAt(values, index) {
  const value = typeof values === "string" ? values.charAt(Number(index)) || void 0 : values[index];
  if (value === void 0) throw new RangeError(`Missing device model entry: ${String(index)}`);
  return value;
}

// src/studios/how-devices-work/advanced/part-functions.ts
var functions = {
  75: ["Collect cockpit voice and area-microphone audio.", "Set suitable recording signal levels.", "Limit bandwidth before sampling to prevent aliasing.", "Converts conditioned audio into digital samples.", "Time-stamps and sequences the recording channels.", "Retains the most recent recording interval.", "Protects retained data against specified accident conditions.", "Emits an acoustic locator signal when activated underwater."],
  76: ["Directs the RF beam toward the satellite.", "Protects the antenna while passing the operating RF band.", "Separates transmit and receive frequency paths.", "Amplifies weak received RF while limiting added noise.", "Converts the receive band to the modem input frequency.", "Demodulates and decodes received traffic; encodes outgoing traffic.", "Converts outgoing modem signals to the RF transmit band.", "Raises RF output power for the satellite uplink.", "Commands antenna pointing and monitors pointing feedback."],
  77: ["Receives star-based absolute attitude observations.", "Receives angular-rate measurements between attitude observations.", "Estimates orientation and computes control torque demands.", "Retains control software, configuration and reference data.", "Controls wheel-motor current and speed.", "Exchanges angular momentum with the spacecraft body.", "Supplies stable electronics and actuator rails.", "Exchanges state, commands and health data with the spacecraft bus."],
  78: ["Radiate and receive the array signals.", "Switch or separate transmit and receive amplification at each element.", "Apply element phase offsets to steer the beam.", "Raise transmitted RF power at the array elements.", "Amplify weak echoes with low added noise.", "Combines element signals with steering-dependent phase weights.", "Digitizes receive-channel signals.", "Extracts echo range, Doppler and detection evidence.", "Removes heat from RF and processing electronics."],
  79: ["Sweeps the observation beam across the surveillance sector.", "Generates the RF illumination waveform.", "Protects and routes the transmit and receive paths.", "Amplifies the received echo before conversion.", "Converts RF echoes to an intermediate or baseband frequency.", "Digitizes the conditioned receive waveform.", "Extracts motion-related frequency shift and rejects stationary clutter.", "Associates detections over time to estimate target motion.", "Presents local detections and track information."],
  80: ["Observes the direct signal from an external illuminator.", "Observes reflected illuminator signals from the scene.", "Select the illuminator band and reject out-of-band signals.", "Acquire reference and surveillance signals with shared timing.", "Digitize both receive channels coherently.", "Compares the channels for bistatic delay and Doppler evidence.", "Suppresses strong direct-path and stationary reflections.", "Associates bistatic observations into illustrative target tracks."],
  81: ["Forms and steers the radar observation beam.", "Produces the radar reference and transmit waveform.", "Raises RF power for transmission.", "Routes the shared antenna transmit/receive paths.", "Amplifies, filters and converts radar echoes.", "Digitizes the receive waveform.", "Extracts range, Doppler and detection information.", "Associates detections and estimates track state.", "Presents the modeled surveillance observations."],
  82: ["Collects long-wave infrared radiation from the scene.", "Changes detector resistance with absorbed thermal radiation.", "Reads the small detector signals across the focal plane.", "Digitizes the conditioned detector measurements.", "Applies correction, calibration and false-colour mapping.", "Provides a reference for non-uniformity and drift correction.", "Presents the computed thermal scene.", "Supplies portable electrical power."],
  83: ["Focuses scene light onto the intensifier input.", "Converts incident photons into photoelectrons.", "Multiplies electrons in microscopic channels.", "Converts the amplified electron image back into visible light.", "Magnifies the output image for the observer.", "Provides the intensifier operating voltages.", "Adjusts intensification and limits excessive image brightness.", "Adds reflected near-infrared illumination when active assistance is selected."],
  84: ["Forms the scene image on the sensor.", "Blocks near-infrared light in day mode and retracts for night operation.", "Converts visible or reflected near-infrared light to pixel signals.", "Illuminates the scene with near-infrared light.", "Sets and supervises the illuminator current.", "Corrects and processes captured image samples.", "Compresses digital frames for transport or recording.", "Carries frames and camera configuration data.", "Supplies the image, processing and illumination electronics."],
  85: ["Emits a controlled optical measurement pulse.", "Collimate the transmitted beam toward the target.", "Collects reflected light onto the detector.", "Converts received light into an electrical signal.", "Converts detector current to a usable voltage.", "Identifies the pulse timing while limiting threshold-induced error.", "Measures the transmit-to-return time interval.", "Computes range and manages the measurement sequence.", "Shows the calculated range and measurement state."],
  86: ["Connects the antenna to the RF front end.", "Provides frequency and sample-timing references.", "Carries samples, commands and local device data.", "Select the receive or transmit operating band.", "Amplifies weak receive signals with low added noise.", "Converts between RF and complex baseband channels.", "Converts sampled signals between analog and digital domains.", "Performs digital modulation, filtering and demodulation.", "Raises the transmit signal to the illustrative output level."],
  87: ["Convert voice between sound and electrical audio.", "Digitizes microphone input and reconstructs speaker audio.", "Encrypts outgoing data and verifies authenticated incoming data.", "Provides and controls access to cryptographic key material.", "Frames, encodes and modulates the digital message.", "Converts baseband traffic to and from the radio band.", "Raises transmitted RF output power.", "Supplies portable electrical energy."],
  88: ["Schedules interrogation and reply timing.", "Radiates the interrogation waveform.", "Couples RF interrogation and reply signals to the scene.", "Receives and conditions transponder replies.", "Interprets the selected identification-mode fields.", "Checks the modeled authentication evidence for a valid response.", "Associates decoded replies with interrogation state.", "Provides stable RF and logic supply rails."],
  89: ["Carries the identifier presented to the reader.", "Couples RF energy and credential responses.", "Demodulates and digitizes credential evidence.", "Sequences identification and policy checks.", "Carries identifiers, policy and event data.", "Stores local allow, deny and revocation rules.", "Switches the virtual latch or lock circuit.", "Applies the authorized mechanical access state.", "Retains local access decisions and timestamps."],
  90: ["Measure specific force along the sensor axes.", "Measure angular rate for orientation propagation.", "Provides a magnetic heading reference when supported.", "Scales and filters inertial sensor signals.", "Digitizes conditioned measurements.", "Combines measurements and integrates attitude, velocity and position.", "Carry power, sensor and navigation-data connections.", "Supplies stable sensor and processor voltage rails."],
  91: ["Receives satellite navigation RF signals.", "Amplifies weak signals and selects the navigation band.", "Converts RF signals to the sampling frequency band.", "Digitizes the conditioned satellite signal.", "Track satellite spreading codes and derive timing observations.", "Combines timing and orbit data into position, velocity and time.", "Provides a temperature-stabilized frequency reference.", "Presents or transmits the computed navigation solution."],
  92: ["Measures the local magnetic field vector.", "Provides the gravity reference used for tilt compensation.", "Scales and digitizes the sensor channels.", "Removes modeled sensor offsets and computes corrected heading.", "Shows heading and acquisition status.", "Supplies portable electrical energy.", "Select calibration and display functions.", "Supports and protects the sensing electronics."],
  93: ["Concentrates RF energy toward the satellite direction.", "Couples the dish aperture to the transmit/receive waveguide paths.", "Converts and amplifies the outgoing RF uplink.", "Amplifies and downconverts the weak RF downlink.", "Modulates outgoing traffic and demodulates received traffic.", "Encodes and decodes the payload information.", "Adjusts antenna pointing using tracking evidence.", "Supplies logic, modem and RF power rails.", "Carries payload data to local user equipment."],
  94: ["Detects mechanical disturbance on the fence.", "Detects interruption of an optical perimeter beam.", "Detects motion-related thermal or microwave evidence.", "Filters and combines sensor evidence with detection thresholds.", "Carries event reports to local monitoring equipment.", "Supports operation when the main supply is unavailable.", "Limits transient stress at field wiring interfaces.", "Signals the modeled intrusion decision after confirmation."],
  95: ["Captures the synthetic face image.", "Adds near-IR illumination for the optical capture.", "Captures fingerprint ridge evidence.", "Runs capture processing and the local access policy.", "Stores firmware and enrolled template data.", "Protects authentication keys and credential operations.", "Switches the door-lock power after authorization.", "Carries access events and configuration data.", "Supplies regulated controller and lock rails.", "Maintains supply during loss of main power.", "Detects opening of the device enclosure.", "Reports access decisions acoustically."],
  96: ["Protects the submerged acoustic elements.", "Converts incoming pressure waves into electrical channels.", "Converts a transmit drive pulse into sound.", "Amplifies small hydrophone voltages.", "Rejects frequencies outside the receive band.", "Samples conditioned acoustic channels.", "Combines channels to estimate bearing and echo timing.", "Supplies logic and acoustic-transmit energy.", "Associates sonar observations with vessel motion.", "Shows computed range and bearing."],
  97: ["Stabilizes a visible-light camera and its pointing direction.", "Captures emitted infrared scene information.", "Provides satellite-based position and time.", "Measures acceleration and angular rate.", "Measures nearby geometry for obstacle supervision.", "Processes sensor streams and mission information.", "Closes attitude and motor-control loops.", "Carries remote commands and local telemetry.", "Stores captured scene data.", "Distributes protected electrical supply rails.", "Monitors pack voltage and current.", "Stores energy for avionics and propulsion."],
  98: ["Radiates RF and receives target echoes.", "Protects the rotating antenna while passing RF.", "Supports the scanner and its rotation mechanism.", "Rotates the antenna through the search azimuth.", "Transfers signals across the rotating interface.", "Guides microwave energy between RF stages and antenna.", "Generates the pulsed transmit energy.", "Separates and protects transmit and receive paths.", "Amplifies weak echoes and converts them to IF.", "Samples echoes and computes range/clutter filtering.", "Aligns radar bearings with vessel heading and position.", "Plots echoes and computed target information."],
  99: ["Presents depth and sonar-return history.", "Carries protected power and transducer signals.", "Converts electrical pulses to sound and echoes to voltage.", "Supplies logic and pulser rails.", "Excites the transducer with a short drive pulse.", "Protects the sensitive receiver during transmission.", "Amplifies and band-limits returning echoes.", "Samples the receive waveform.", "Detects echoes and calculates their travel-time depth.", "Transfers processed sonar pixels to the screen."],
  100: ["Displays the calculated depth and validity.", "Couples acoustic energy through the hull installation.", "Produces regulated logic and pulser rails.", "Excites the transducer with a timed high-voltage pulse.", "Protects the receive input from the transmit pulse.", "Amplifies weak acoustic echo voltages.", "Scales and band-limits the received waveform.", "Digitizes echo amplitude samples.", "Times echo arrivals and converts delay to depth.", "Updates the numeric and graphical display."],
  101: ["Shows chart layers and accepts route commands.", "Retains charts and locally saved route data.", "Receives satellite-navigation signals.", "Filters and downconverts weak GNSS RF.", "Computes navigation state and route geometry.", "Retains firmware and chart metadata.", "Produces protected regulated device rails.", "Exchanges serial navigation sentences.", "Exchanges navigation messages over a CAN-based vessel bus.", "Transfers chart or sensor data over a local network.", "Accepts processed acoustic observations for chart display."],
  102: ["Receives and radiates AIS VHF signals.", "Receives GNSS position/time signals.", "Filters and conditions the VHF receive path.", "Transmits and receives the AIS radio channels.", "Converts between radio symbols and digital frames.", "Encodes vessel reports and decodes received messages.", "Supervises slots, message state and target records.", "Shows vessel information and local status.", "Exchange navigation messages with vessel equipment.", "Supplies regulated radio and logic rails."],
  103: ["Accepts the desired steering mode and heading.", "Measures vessel heading for feedback.", "Receives navigation position and route information.", "Measures actual rudder position.", "Computes heading error and limited steering demand.", "Exchanges heading and route data with vessel systems.", "Supplies controller and pump-drive energy.", "Controls bidirectional pump motor current.", "Moves hydraulic fluid to position the rudder.", "Changes vessel steering force and heading response."],
  104: ["Protects electronics from weather exposure.", "Locates and secures the heading sensor.", "Routes the power and navigation cable.", "Measures three magnetic-field components.", "Measures a gravity reference for tilt compensation.", "Calibrates magnetic data and computes heading.", "Retains hard-iron and installation calibration values.", "Supplies stable sensor and MCU rails.", "Exchanges heading messages over the vessel CAN bus.", "Outputs serial heading sentences."],
  105: ["Converts voice pressure waves to a small voltage.", "Scales and filters microphone audio.", "Produces a channel carrier and frequency modulation.", "Raises RF transmit power before the antenna.", "Suppresses transmit harmonics.", "Separates antenna transmit and receive paths.", "Amplifies received RF and converts it to IF.", "Recovers audio from frequency modulation.", "Drives the speaker from recovered audio.", "Encodes and decodes digital selective-call messages.", "Supplies position data to the DSC controller.", "Selects channels and presents radio status."],
  106: ["Radiates the beacon RF signal.", "Provides a local visual locating indication.", "Requests manual beacon activation.", "Detects immersion for automatic activation.", "Provides synthetic navigation position for the message.", "Sends the encoded 406 MHz beacon waveform.", "Provides a separate 121.5 MHz homing waveform.", "Supervises activation, encoding and self-test.", "Supplies stored energy to the beacon electronics.", "Protects electronics against immersion."],
  107: ["Measures vessel position for station-keeping.", "Measures vessel heading.", "Measures wind speed and direction.", "Measures vessel motion and attitude.", "Accepts position and heading objectives.", "Estimates errors and allocates limited thrust.", "Convert allocation commands to motor-drive demand.", "Generate controllable vessel forces and yaw moment.", "Supplies regulated control and propulsion power."],
  108: ["Accepts operator commands and displays telemetry.", "Carries communications and power to the submerged vehicle.", "Encodes command and telemetry messages.", "Computes depth control and thruster allocation.", "Regulate electrical current to vehicle motors.", "Produces protected logic and actuator supply rails.", "Measures vehicle rotation and acceleration.", "Estimates depth from external water pressure.", "Captures the underwater scene.", "Illuminate the scene for the camera.", "Carries commands to the gripper actuator.", "Generate surge, sway, heave and rotation forces."],
  109: ["Exchanges low-rate messages acoustically underwater.", "Stores and sequences local mission waypoints.", "Fuses navigation inputs and computes guidance.", "Supplies vehicle electronics and propulsion energy.", "Measures underwater target/obstacle geometry.", "Estimates motion from inertial measurements.", "Measures velocity relative to a bottom or water reference.", "Measures pressure for depth estimation.", "Generates forward vehicle thrust.", "Apply attitude and depth steering forces."],
  110: ["Measures crank angle and rotational speed.", "Identifies engine phase over the four-stroke cycle.", "Measures the requested throttle position.", "Measures coolant temperature for enrichment and protection.", "Measures manifold pressure as a load reference.", "Protects, filters and scales sensor signals.", "Calculates fuel and ignition demands from engine state.", "Stores firmware, maps and retained calibration.", "Switch electrical current through fuel injectors.", "Control ignition-coil charging and release.", "Exchanges engine state over the local CAN bus.", "Provides protected power and physical environmental shielding."],
  111: ["Carries the controlled output angle.", "Reduces motor speed and increases output torque.", "Converts H-bridge current into shaft rotation.", "Measures actual shaft angle for feedback.", "Holds conditioning, controller and power-drive electronics.", "Decodes pulse width into a requested position.", "Drives motor current in either direction.", "Supplies logic and motor energy.", "Carries the timing command into the decoder."],
  112: ["Supports the rotating shaft at the front.", "Aligns with the magnetic field from energized phases.", "Produce the two independently controlled magnetic fields.", "Supports the rotating shaft at the rear.", "Advances the phase sequence from STEP and DIR.", "Controls winding current using chopper feedback.", "Apply bidirectional phase voltage/current.", "Measures winding current for regulation.", "Receives timing, direction and enable commands.", "Supplies motor current and regulated control rails."],
  113: ["Supports the drive and electronics mechanically.", "Supplies stored electrical energy.", "Apply bidirectional current to the wheel motors.", "Produce left and right wheel torque.", "Measure wheel rotation for odometry.", "Measures angular rate and acceleration.", "Measures nearby obstacle range.", "Computes wheel demands and the local obstacle rule.", "Couples the wireless command/telemetry signal."],
  114: ["Support motors, sensing and control electronics.", "Computes weighted line position and steering error.", "Controls independent left/right motor currents.", "Convert drive current into geared wheel torque.", "Transfer torque into vehicle motion.", "Measure reflected light at positions across the line.", "Supplies stored electrical energy.", "Produces a stable MCU and sensor rail.", "Report power and controller state visually."],
  115: ["Measures body pitch and angular rate.", "Calculates feedback error and PID motor demand.", "Controls left/right motor current and direction.", "Stores electrical energy for the robot.", "Supports the body above the wheel axis.", "Apply wheel torque and measure wheel rotation.", "Transfer motor torque into ground acceleration."],
  116: ["Remove heat from cabinet electronics.", "Produces isolated controller and drive supply rails.", "Monitors enabling and emergency-stop inputs.", "Runs motion programs and real-time supervision.", "Generates coordinated joint trajectory demands.", "Regulate joint motor current using encoder feedback.", "Connect tool signals and process interlocks.", "Exchange programs, diagnostics and process messages.", "Accepts operator programs and teaching commands.", "Measure actual joint positions for servo feedback."],
  117: ["Generates controlled joint torque.", "Reduces speed and increases joint output torque.", "Measures interaction torque for force supervision.", "Measures actual joint position.", "Monitor enabling and protective-stop conditions.", "Interacts with the workpiece through a gripper/tool.", "Provides visual observations for task processing.", "Plans motion and closes joint/safety feedback loops.", "Accepts and records local teaching commands."],
  118: ["Measures ranges at successive scan angles.", "Transforms rays, updates occupancy and plans a route.", "Measures acceleration and angular rate for pose estimation.", "Measure wheel rotation for odometry.", "Applies independent left/right motor currents.", "Supplies stored electrical energy.", "Carries local commands and map telemetry.", "Generate wheel motion for the planned route."],
  119: ["Provides geometry observations for localization.", "Measures angular rate and acceleration.", "Measure wheel displacement for odometry.", "Fuses motion and scan observations for SLAM.", "Stores free, occupied and unknown grid cells.", "Converts navigation demands to motor current commands.", "Generate the robot motion.", "Supplies stored electrical energy."],
  120: ["Supports the ground vehicle and its sensors.", "Measures scene geometry and obstacle distance.", "Estimates vehicle state and computes guidance.", "Sets the front-wheel steering angle.", "Apply traction torque to the wheels.", "Measures wheel displacement for motion estimation.", "Provides a satellite position reference.", "Stores energy and distributes protected supply rails."],
  121: ["Measures aisle and rack geometry.", "Carries transport tasks and status messages.", "Plans routes and sequences transport/lift actions.", "Stores energy and supervises pack protection.", "Produce traction torque for transport.", "Measure wheel displacement.", "Raises and lowers the modeled shelf load.", "Reads rack or station identification.", "Carries the transported items."],
  122: ["Captures the illuminated part as pixel samples.", "Focuses the scene onto the image sensor.", "Provides controlled illumination around the optical axis.", "Starts capture when a part reaches the inspection point.", "Measures features and applies acceptance limits.", "Carries image/inspection data to local equipment.", "Reports the virtual accept/reject command.", "Moves parts and illustrates the sorting output."],
  123: ["Measures nearby 3D geometry.", "Measures body attitude and angular rate.", "Computes body state, gait and foot targets.", "Supplies stored electrical energy.", "Generate controlled leg-joint torque.", "Reduce motor speed and increase joint torque.", "Transmit joint motion to the feet.", "Report whether each foot is in contact."],
  124: ["Couple 2.4/5 GHz signals to the RF electronics.", "Amplifies, filters and frequency-converts radio signals.", "Runs packet routing, radio control and configuration.", "Holds packet buffers and active process state.", "Retains firmware and local configuration.", "Converts between wired Ethernet signals and packets.", "Provides stable logic and radio supply rails.", "Provides the timing reference for digital and RF stages."]
};
function explicitPartFunctions(lab) {
  const descriptions = functions[lab.number];
  return descriptions ? Object.fromEntries(lab.parts.map((part, i) => [part, itemAt(descriptions, i)])) : {};
}

// src/studios/how-devices-work/advanced/household-data.ts
var specs = [
  { number: 135, slug: "microwave-oven-controller", name: "Microwave Oven Controller", subtitle: "Explore a microwave oven controller \u2014 from your input to your food.", principle: "The keypad selects cooking time and power. A microcontroller checks door interlocks, then sequences magnetron power, turntable, fan and display. A conventional oven varies average heating with on/off duty cycles. This compressed-time model integrates absorbed power into a food thermal mass and inhibits heating when the door is open or the load is absent.", parts: [["Keypad", "Captures cooking time and program inputs."], ["Display board", "Presents timer and controller status."], ["Main MCU board", "Runs timing and safety supervision."], ["Door interlock switches", "Interrupt the heating authorization when the door is open."], ["Relay / triac driver", "Switches the magnetron supply under controller command."], ["High-voltage supply / magnetron", "Converts electrical power into microwave energy."], ["Turntable motor", "Rotates the food through the cavity field."], ["Cooling fan", "Removes heat from power components."]], controls: "duration:Cooking time:2:0.5:5:0.5:min|power:Power level:100:10:100:10:%|mass:Food mass:0.5:0.1:2:0.1:kg", modes: ["Manual cook", "Reheat", "Defrost"], inputs: ["Keypad / program", "Door interlocks", "Load / temperature sensor"], processing: ["MCU / timer / safety", "Duty-cycle power control", "Relay / actuator drivers"], outputs: ["Magnetron heating", "Turntable / cooling fan", "Display / buzzer"], steps: [["User input", "Select time, average power and the teaching food mass."], ["Safety check", "An open door or absent load inhibits the virtual magnetron."], ["Process program", "The MCU advances a compressed cooking timer."], ["Control outputs", "Duty cycling switches heating while the fan and turntable run."], ["Monitor", "The thermal model integrates absorbed power and cooling loss."], ["Complete", "Heating stops at the selected duration and completion is indicated."]], apps: ["Home kitchen", "Office pantry", "Restaurants", "Food industry"], keys: ["A controller sequences outputs and monitors safety.", "Door interlocks inhibit heating.", "Duty cycling controls average power.", "The thermal response depends on load and time."], quiz: ["What must inhibit magnetron heating?", "An open door interlock", "A larger display", "A different keypad colour"], source: "https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens" },
  { number: 136, slug: "washing-machine-controller", name: "Washing Machine Controller", subtitle: "Explore. Learn. Simulate. Understand a modern washing machine controller.", principle: "A program supervisor reads water level, temperature, door-lock and tachometer feedback. Drivers control the inlet valves, heater, inverter-fed drum motor, drain pump and dispenser. A finite-state program sequences fill, wash, drain, rinse, drain and spin. The lab runs a compressed local cycle with sensor feedback and a door interlock.", parts: [["MCU / controller board", "Sequences the program and monitors sensors."], ["Power supply", "Provides isolated low-voltage logic rails."], ["Inlet valve", "Admits water during fill and rinse."], ["Drain pump", "Removes water before rinse or spin."], ["Drum motor", "Agitates laundry and spins the drum."], ["Inverter motor driver", "Applies commanded speed and direction."], ["Door lock / switch", "Inhibits movement if the door is open."], ["Water-level sensor", "Reports the virtual tub water volume."], ["NTC temperature sensor", "Feeds back washing-water temperature."], ["Tachometer", "Reports drum rotation speed."], ["Detergent dispenser", "Introduces detergent during wash."], ["Wiring harness", "Connects sensing and actuator circuits."]], controls: "temperature:Water temperature:40:20:60:5:\xB0C|spin:Spin speed:1000:400:1400:100:rpm|load:Laundry load:4:1:8:1:kg", modes: ["Cotton (Normal)", "Synthetics", "Delicates", "Quick Wash", "Rinse + Spin"], inputs: ["User program", "Water level / NTC", "Door switch / tachometer"], processing: ["MCU / cycle supervisor", "Water / temperature control", "Motor speed / inverter"], outputs: ["Inlet valve / dispenser", "Drum / drain pump", "Door lock / display"], steps: [["Select a program", "Choose the washing recipe and targets."], ["Read inputs", "Check door closure, water level, temperature and motor feedback."], ["Process decisions", "The state machine enables only the outputs needed by its current stage."], ["Actuate", "Valve, drum, heater and pump follow their drivers."], ["Cycle progresses", "Measured water level controls transitions before spin."], ["Complete", "Stop outputs, report completion and release the lock once drained."]], apps: ["Home appliances", "Industrial laundry", "Smart home monitoring", "Education & training"], keys: ["The MCU supervises the entire washing sequence.", "Sensors provide stage-transition feedback.", "Motor and pump outputs have separate drivers.", "The door interlock inhibits drum motion."], quiz: ["What confirms the tub can enter spin?", "Drained water-level feedback", "The cabinet colour", "The Wi-Fi SSID"], source: "https://www.ti.com/solution/washing-machine" },
  { number: 137, slug: "induction-cooktop", name: "Induction Cooktop", subtitle: "Modern cooking. Powered by electromagnetism.", principle: "Mains input is rectified into a DC bus. A controlled inverter drives a resonant work coil at high frequency, inducing currents and magnetic losses in compatible cookware. Current, pan detection and temperature feedback supervise the power stage. This thermal model relates power, pan coupling and thermal mass to pan temperature; it does not simulate transistor switching in hardware.", parts: [["Ceramic glass top", "Supports the cookware and protects the work coil."], ["Touch control panel", "Sets power and cooking commands."], ["Induction work coil", "Generates the alternating magnetic field."], ["Temperature sensor", "Monitors the teaching pan temperature."], ["IGBT / MOSFET power board", "Switches the DC bus into high-frequency coil current."], ["MCU / gate driver", "Controls switching demand and protection."], ["Cooling fan", "Cools the power electronics and heat sink."], ["Rectifier / DC bus", "Converts mains AC into a smoothed DC supply."]], controls: "power:Power level:7:1:10:1:level|diameter:Pan diameter:24:12:32:2:cm|mass:Pan and food thermal mass:1:0.3:3:0.1:kg|frequency:Inverter frequency:25:20:40:1:kHz", modes: ["Magnetic stainless steel", "Cast iron", "Aluminium (non-magnetic)", "No pan"], inputs: ["Touch power setting", "Pan presence / current", "NTC / bus voltage"], processing: ["Rectifier / DC bus", "Controlled resonant inverter", "Work coil / pan coupling"], outputs: ["Pan heating", "Fan / temperature status", "Protection indication"], steps: [["AC input", "Input protection and filtering precede the rectifier."], ["Rectify", "Convert alternating input into a DC bus."], ["Invert", "Gate drives switch the power stage at high frequency."], ["Generate field", "The coil creates an alternating magnetic field."], ["Induce currents", "Compatible cookware absorbs energy through induction."], ["Heat", "Absorbed power raises pan and food temperature."], ["Control / protect", "Sensor feedback disables incompatible pans or excessive temperatures."]], apps: ["Home cooking", "Commercial kitchens", "Energy-efficient cooking", "Power electronics education"], keys: ["Induction heats compatible cookware directly.", "Rectifier, inverter and coil form the power path.", "Pan coupling and thermal mass affect heating.", "Pan detection and temperature protection supervise operation."], quiz: ["Why does a non-magnetic aluminium pan fail in this model?", "The modeled pan lacks compatible magnetic coupling", "The display is too small", "The keypad is blue"], source: "https://www.infineon.com/applications/consumer-electronics/home-appliances/induction-cookers" },
  { number: 138, slug: "smart-energy-meter", name: "Smart Energy Meter", subtitle: "Understand. Explore. Simulate. Build a smarter tomorrow.", principle: "A current transformer or shunt and a voltage-sensing network feed isolated conditioning and anti-alias filters. A metering ADC samples voltage and current; instantaneous products are averaged to obtain real power and integrated to obtain energy. The MCU stores readings and manages display, communication, tamper status and a disconnect relay. This lab computes actual sampled sinusoidal voltage and current.", parts: [["Current transformer / shunt", "Measures load current."], ["Voltage sensing network", "Scales line voltage into a safe sensing range."], ["Metering IC", "Computes power and accumulates energy from conditioned samples."], ["Voltage / current ADC", "Digitizes conditioned voltage and current channels."], ["Microcontroller", "Manages readings, display, communications and relay state."], ["LCD display", "Shows accumulated energy and measured quantities."], ["Disconnect relay", "Opens the modeled supply path."], ["Communication module", "Carries meter records to a utility interface."], ["Memory / RTC", "Stores readings and associates them with time."], ["Tamper detection", "Reports an abnormal enclosure or magnetic event."], ["Power supply", "Provides isolated regulated rails."]], controls: "load:Real load power:2300:0:5000:100:W|voltage:Line voltage:230:100:260:1:V|pf:Power factor:0.85:0.2:1:0.05:PF|elapsed:Energy interval:1:0.1:24:0.1:h", modes: ["Normal metering", "Tamper event", "Disconnect relay"], inputs: ["Voltage sensing / divider", "Current sensor / shunt", "Tamper inputs"], processing: ["Conditioning / anti-alias", "Metering ADC / sample product", "MCU / energy integration"], outputs: ["LCD / kWh memory", "RF / PLC / utility data", "Disconnect relay"], steps: [["Measure inputs", "Acquire synthetic voltage and current waveforms."], ["Digitize", "Sample both channels at a common clock."], ["Calculate", "Average sample products for real power and derive RMS values."], ["Store / display", "Integrate real power over the selected interval."], ["Communicate", "Publish a local meter record to the communication display."], ["Protect", "Report tamper events and honor relay disconnection."]], apps: ["Residential metering", "Commercial & industrial", "Smart grid", "Renewable integration", "Prepaid energy"], keys: ["Real power is the mean of simultaneous voltage-current products.", "Energy integrates real power over time.", "Power factor changes current for the same real load.", "A disconnect relay interrupts the load path."], quiz: ["How is real power obtained from sampled waveforms?", "Average simultaneous voltage-current products", "Multiply peak voltage by display size", "Read the housing colour"], source: "https://www.analog.com/en/products/ade7753.html" },
  { number: 139, slug: "gps-receiver", name: "GPS Receiver", subtitle: "Global positioning. A clearer world.", principle: "A GNSS antenna and RF front end acquire weak satellite signals. Code correlation estimates pseudoranges; navigation processing solves receiver position and clock bias using at least four satellites. This consumer lab solves a synthetic three-dimensional least-squares pseudorange system in a local tangent frame and converts its result into latitude, longitude and altitude.", parts: [["Patch antenna", "Receives the GNSS radio signals."], ["Low-noise amplifier", "Amplifies the weak RF input."], ["SAW band-pass filter", "Suppresses out-of-band RF energy."], ["Mixer / local oscillator", "Converts RF to an intermediate or baseband frequency."], ["ADC", "Digitizes the received signal."], ["Baseband correlator", "Measures code phase and produces pseudoranges."], ["TCXO timing reference", "Provides a stable receiver sampling clock."], ["Navigation MCU", "Solves position and receiver clock offset."], ["Memory", "Stores firmware, navigation data and active state."], ["Display / power supply", "Presents the solution and powers the receiver."]], controls: "satellites:Number of satellites:6:3:12:1:satellites|noise:Pseudorange noise:2:0:20:1:m|clock:Receiver clock bias:50:-100:100:5:m", modes: ["New Delhi, India", "Mumbai, India", "London, UK"], inputs: ["GNSS antenna / RF", "TCXO timing reference", "Satellite navigation data"], processing: ["LNA / filter / mixer / ADC", "Code correlation / pseudorange", "Position + clock solver"], outputs: ["Latitude / longitude", "Altitude / clock offset", "Display / navigation data"], steps: [["Satellites transmit", "Each satellite broadcasts a coded timing signal."], ["Capture / amplify", "The antenna, LNA and filter acquire weak RF."], ["Process signals", "Code correlation yields satellite-to-receiver pseudoranges."], ["Solve position", "Iterative least squares estimates three position coordinates and clock bias."], ["Output", "Convert local position to the selected geographic origin and display the solution."]], apps: ["Car navigation", "Mapping & surveying", "Fleet tracking", "Precision agriculture", "Drones & robotics", "Emergency services", "Location-based services"], keys: ["Pseudorange contains geometric range and receiver clock error.", "Four independent satellite observations solve four unknowns.", "Noise and satellite geometry affect the solution.", "This lab uses synthetic ranges and requests no location permission."], quiz: ["Why are at least four satellites needed for a 3D fix?", "Three position coordinates and receiver clock bias are unknown", "Four batteries are used", "The screen has four corners"], source: "https://www.gps.gov/gps-accuracy" },
  { number: 140, slug: "digital-multimeter", name: "Digital Multimeter", subtitle: "Understand. Measure. Apply.", principle: "Protected input terminals route voltage through a divider, current through a shunt, or resistance through a known test-current source. Signal conditioning and an ADC produce digital samples for the measurement IC and display. This lab calculates loading in a resistor test circuit and shows how series current measurement differs from parallel voltage measurement.", parts: [["Input terminals / probes", "Connect the selected input path to a test circuit."], ["MOV / TVS / fuse protection", "Limit abnormal input energy in the protected measurement path."], ["Rotary selector", "Chooses voltage, current, resistance or continuity."], ["Voltage divider", "Attenuates input voltage before conversion."], ["Current shunt", "Converts measured current into a small voltage."], ["Resistance test source", "Supplies a known test current to an unpowered resistor."], ["Input conditioning / filter", "Conditions the selected analog signal."], ["ADC / measurement IC", "Converts and scales the measurement."], ["LCD / buzzer", "Displays the result and signals continuity."], ["Battery / supply", "Powers electronics and resistance testing."]], controls: "voltage:Supply voltage:5:0:24:0.5:V|resistance:Test resistor:1000:1:10000:1:\u03A9|series:Source series resistance:100:0:1000:10:\u03A9", modes: ["Measure Voltage", "Measure Current", "Measure Resistance", "Continuity", "AC RMS Voltage"], inputs: ["Protected input terminals", "Selector / test circuit", "Resistance test source"], processing: ["Divider / shunt path", "Signal conditioning / ADC", "Measurement IC / MCU"], outputs: ["LCD measurement", "Continuity buzzer", "Range / protection status"], steps: [["Connect probes", "Voltage is measured in parallel; current uses the series shunt path."], ["Protect input", "A protected path precedes the measurement electronics."], ["Choose range / mode", "The selector routes the relevant input network."], ["Condition / convert", "Scale the analog signal and digitize it."], ["Calculate", "Apply the selected conversion and range."], ["Display", "Present the reading or a disconnected / overload indication."]], apps: ["Electronics repair", "Automotive diagnostics", "Electrical installation", "Education & research"], keys: ["Voltage and current use different input paths.", "A meter has finite input impedance.", "Resistance testing uses an internal source on an unpowered circuit.", "Continuity is a thresholded resistance measurement."], quiz: ["How should a current meter be inserted?", "In series with the load", "Across the supply like a voltage meter", "Only beside the circuit"], source: "https://www.fluke.com/en-us/learn/blog/digital-multimeters/how-to-measure-dc-voltage-with-digital-multimeter" }
];
var HOUSEHOLD_DEFINITIONS = specs.map((s) => ({ number: s.number, id: `everyday/${s.slug}`, mockup: `${s.number} - ${s.name}.png`, theme: "light", family: s.slug, subtitle: s.subtitle, principle: s.principle, parts: s.parts.map((p) => p[0]), partFunctions: Object.fromEntries(s.parts), controls: s.controls, modes: s.modes, architecture: { inputs: s.inputs, processing: s.processing, outputs: s.outputs }, steps: s.steps, applications: s.apps, safety: s.keys, quiz: s.quiz, source: s.source }));

// src/studios/how-devices-work/advanced/consumer-data.ts
var rows = [
  [125, "bluetooth-headphones", "Wireless freedom. Immersive sound. Intelligent engineering.", "The antenna and Bluetooth SoC receive compressed audio. A codec decodes the stream; DSP applies equalization and microphone-based active noise cancellation. The DAC and amplifier drive dynamic speakers. A rechargeable cell supplies regulated rails. This local audio model illustrates signal mixing and cancellation, rather than implementing a Bluetooth radio.", ["Antenna", "Bluetooth SoC", "DSP / audio codec", "DAC / amplifier", "Speaker driver", "Microphones", "Battery / charging circuit"], ["SBC", "AAC", "LC3 teaching profile"], "volume:Volume:60:0:100:5:%|noise:Ambient noise:35:0:100:5:%|anc:ANC strength:80:0:100:5:%|frequency:Test tone:440:100:2000:20:Hz", ["Pair & connect", "Receive wireless audio", "Decode & process", "Convert to analog", "Drive speakers", "Capture microphone audio", "Manage power"], ["Music & entertainment", "Calls & remote work", "Travel", "Gaming", "Fitness", "Education"], ["Compressed wireless audio is decoded before conversion to analog.", "Microphones supply noise and voice inputs.", "Battery management and charging supply the electronics."], "https://www.bluetooth.com/specifications/specs/advanced-audio-distribution-profile-1-3-2/"],
  [126, "smartwatch", "A tiny computer on your wrist.", "Touch, accelerometer, gyro and optical pulse sensors feed a low-power SoC. Firmware filters measurements and detects events, then updates the OLED, vibration motor and wireless sync. The pulse model generates synthetic optical samples; no health measurement is taken.", ["Touch layer", "OLED display", "SoC / memory", "PPG sensor", "Accelerometer", "Gyroscope", "Haptic motor", "Wireless module", "Battery / charging coil"], ["Tap", "Move", "Heart Rate", "Sync"], "heart:Heart rate:78:40:180:1:bpm|motion:Movement cadence:100:0:180:5:steps/min|quality:Optical signal quality:85:10:100:5:%|battery:Battery:80:0:100:5:%", ["Interact with the watch", "Capture touch and sensors", "Filter sensor signals", "Process events", "Update the display", "Trigger haptics", "Sync wirelessly", "Repeat with low power"], ["Fitness & activity tracking", "Health monitoring", "Smart notifications", "Contactless payments", "Navigation & travel", "Safety & emergency"], ["Sensor processing turns raw inputs into events.", "Optical pulse sensing responds to blood-volume changes.", "Wireless synchronization transfers processed data."], "https://www.analog.com/en/resources/technical-articles/how-to-design-better-wearable-healthcare-devices.html"],
  [127, "rfid-access-card", "Tap. Authenticate. Access.", "A passive LF proximity teaching card harvests energy from a 125 kHz reader field. Its chip sends an identifier through load modulation; the reader decodes it and an access controller checks local authorization before enabling a door relay. RFID covers several frequencies: this page models an LF card, not every credential technology pictured.", ["Card antenna coil", "RFID chip", "Plastic shell", "Reader antenna", "RF front end", "Reader MCU", "Access controller", "Door relay", "12 V supply"], ["Authorized card", "Unknown card", "Revoked card"], "distance:Reader distance:2:0:15:0.5:cm|field:Reader field strength:80:5:100:5:%|alignment:Coil alignment:0:0:90:5:\xB0", ["Emit RF field", "Harvest energy", "Power card chip", "Load-modulate identifier", "Decode identifier", "Check access rules", "Drive door relay"], ["Office buildings", "Schools & universities", "Hospitals", "Data centres", "Parking garages", "Facilities access"], ["Passive LF cards harvest RF energy.", "An identifier requires an access-policy check.", "Card-reading success alone does not authorize a door."], "https://www.nxp.com/products/rfid-nfc/nfc-hf:MC_71110"],
  [128, "barcode-scanner", "Capture. Decode. Connect.", "Illumination exposes a printed barcode. A lens focuses reflected light on a sensor; the analog front end and ADC produce samples. Decoding validates symbol widths and the checksum before sending a value through USB or wireless. This lab encodes and reads an Code 128 teaching symbol with a verified checksum.", ["Illumination LED", "Lens", "CMOS / photodiode", "Analog front end / ADC", "Decoder MCU", "Trigger", "Buzzer", "USB / wireless", "Battery"], ["Clean surface", "Low contrast", "Damaged symbol"], "contrast:Print contrast:90:10:100:5:%|light:Illumination:80:10:100:5:%|damage:Damaged modules:0:0:12:1:modules", ["Press trigger", "Illuminate code", "Collect reflection", "Focus on sensor", "Decode and validate", "Send data to host", "Confirm with feedback"], ["Retail point of sale", "Warehouse & logistics", "Manufacturing", "Healthcare"], ["Optical contrast produces the barcode signal.", "Check digits detect many read errors.", "The host receives validated data."], "https://www.gs1.org/standards/barcodes/ean-upc"],
  [129, "qr-code-scanner", "Capture. Decode. Connect the real world.", "A camera captures a two-dimensional QR symbol. Image processing finds its finder patterns, corrects perspective and extracts modules. Error correction and payload decoding yield text or a link. The local scanner uses jsQR to decode actual pixels from an example or uploaded image; links are displayed for review.", ["Lens", "CMOS camera", "Flash LED", "Image signal processor", "SoC / decoder", "Memory", "Battery", "Display", "Wireless interface"], ["Scan a QR Code", "Upload Image", "Try Examples"], "contrast:Image contrast:100:10:100:5:%|rotation:Image rotation:0:0:270:90:\xB0", ["Capture image", "Preprocess", "Detect finder patterns", "Correct perspective", "Decode payload", "Present output / action"], ["Payments", "Event tickets", "Product information", "Restaurant menus", "Login & authentication"], ["QR codes encode data in two-dimensional modules.", "Finder patterns establish orientation.", "The decoded payload is shown before any action."], "https://github.com/cozmo/jsQR"],
  [130, "biometric-fingerprint-scanner", "Capture. Identify. Grant Access.", "Optical or capacitive sensors capture ridge patterns. Processing extracts minutiae and compares their geometry with an enrolled template. A threshold determines the access decision. This lab uses deterministic synthetic minutiae and a distance-based matcher; it stores no real fingerprint.", ["Sensing surface", "LED illumination", "Optical / capacitive sensor", "ADC", "Processor", "Template flash", "Secure element", "Interface driver", "Status LED / buzzer"], ["Optical", "Capacitive", "Ultrasonic"], "quality:Capture quality:85:10:100:5:%|threshold:Match threshold:75:30:100:5:%|offset:Feature displacement:1:0:20:1:pixels", ["Place finger", "Capture ridge image", "Extract minutiae", "Compare enrolled template", "Make decision", "Issue access output"], ["Door access control", "Time & attendance", "IT login", "Banking authentication", "Identity systems"], ["Minutiae geometry is compared with an enrolled template.", "Capture quality affects reliable feature extraction.", "A secure interface carries the decision to an access controller."], "https://www.nist.gov/programs-projects/fingerprint"],
  [131, "cctv-camera", "Capture. Process. Secure the world.", "A lens forms an image on a CMOS sensor. The ISP handles exposure, noise reduction and colour; an encoder compresses frames for local storage or a network video recorder. IR LEDs provide reflected near-infrared illumination at night. This simulation separates light level, exposure, encoding and network delivery.", ["Housing", "Lens", "CMOS sensor", "IR LEDs", "ISP / encoder", "Flash / SDRAM", "Ethernet PHY / PoE", "Microphone", "SD card"], ["Day / H.264", "Night IR / H.264", "Day / H.265", "Network disconnected"], "light:Light level:79:0:100:1:%|exposure:Exposure:10:1:30:1:ms|quality:Encoding quality:75:10:100:5:%|bandwidth:Network bandwidth:8:0.5:20:0.5:Mbps", ["Collect scene light", "Focus through lens", "Convert photons to sensor signals", "Process image", "Encode frames", "Store / transmit", "Display or replay", "Synchronize optional audio"], ["Homes", "Businesses", "Public places", "Transportation", "Institutions", "Industrial facilities"], ["CMOS sensors convert light into electrical signals.", "The ISP improves raw image data.", "Encoding and networking affect delivered video."], "https://www.axis.com/learning/web-articles/network-video-compression"],
  [132, "ir-camera", "See the invisible. Measure what matters.", "Germanium optics collect long-wave infrared radiation onto a microbolometer array. Calibration, reflected-temperature and emissivity compensation convert radiance into an estimated temperature map. A false-colour palette visualizes that map. The local model uses a broadband fourth-power approximation, rather than a calibrated camera response.", ["Germanium IR lens", "Calibration shutter", "Microbolometer array", "Analog front end / ADC", "Reference temperature sensor", "Processor", "Flash memory", "LCD / OLED", "Battery"], ["Heat Source", "Human Body", "Electrical Panel"], "emissivity:Assumed emissivity:0.95:0.1:1:0.01:\u03B5|ambient:Reflected ambient temperature:25:0:50:1:\xB0C|temperature:Object temperature:62.3:20:150:0.1:\xB0C", ["Emit infrared radiation", "Collect radiation", "Detect resistance changes", "Calibrate against reference", "Calculate temperature map", "Display false-colour image"], ["Electrical inspection", "Building diagnostics", "Mechanical maintenance", "HVAC inspection", "Research", "Security"], ["Thermal cameras measure emitted infrared radiation.", "Emissivity and reflected temperature affect estimates.", "False colours represent a temperature scale."], "https://docs.flir.com/T810605/en-US/latest/s10.html"],
  [133, "television", "From input signals to lifelike pictures and immersive sound.", "A tuner, HDMI receiver or network interface supplies media. The main SoC decodes video and audio; a scaler and display timing controller drive the panel. An audio DAC and amplifier drive speakers. Power conversion supplies the electronics and LED backlight. Source selection routes the active input.", ["RF tuner", "HDMI receiver", "Wi-Fi / Ethernet", "Main SoC", "RAM / flash", "T-CON board", "Display panel", "LED backlight", "Audio amplifier", "Speakers", "Power supply"], ["HDMI 1", "Broadcast tuner", "Streaming Wi-Fi", "USB media"], "brightness:Brightness:65:0:100:5:%|volume:Volume:50:0:100:5:%|bandwidth:Streaming bandwidth:12:1:30:1:Mbps|channel:Broadcast channel:3:1:12:1:channel", ["Receive media input", "Tune and decode", "Process in main SoC", "Scale video", "Decode audio", "Drive panel and speakers", "See and hear output"], ["Live TV", "Streaming", "Gaming", "Movies & sports", "Smart home", "Screen mirroring", "Video calls", "Music"], ["Several input paths converge in the main processor.", "The T-CON controls display timing.", "Audio and video use separate output branches."], "https://www.ti.com/solution/television"],
  [134, "digital-door-lock", "Smart security. Seamless access. A safer tomorrow.", "A keypad, fingerprint reader, RFID interface or mobile module supplies credentials. A secure controller authenticates them; an H-bridge drives the latch motor. A door-position sensor reports closure and the lock re-engages after its timer. This local teaching lock uses demonstration credentials and a failed-attempt lockout.", ["Keypad / touchscreen", "Fingerprint / RFID module", "MCU", "Secure element", "Motor / latch actuator", "H-bridge driver", "Door-position sensor", "Wireless module", "Battery pack"], ["PIN", "Fingerprint", "RFID Card", "Mobile App"], "battery:Battery charge:80:0:100:5:%|delay:Auto-lock delay:5:2:15:1:s", ["Enter credential", "Capture and convert", "Authenticate locally", "Allow or deny", "Drive latch", "Read door position", "Report status", "Auto-lock"], ["Residential homes", "Offices", "Hotels", "Schools", "Restricted facilities"], ["Authentication precedes latch actuation.", "The door sensor controls safe relocking.", "Repeated failures trigger a local lockout."], "https://www.ti.com/solution/smart-door-lock"]
];
var architectures = {
  125: { inputs: ["Bluetooth RF audio", "Microphone / ANC", "Touch controls"], processing: ["Bluetooth SoC / receiver", "Audio codec / DSP", "DAC / Class-D amplifier"], outputs: ["Left / right speakers", "Voice uplink", "Status / battery"] },
  126: { inputs: ["Touch input", "PPG / accelerometer / gyro", "User activity"], processing: ["Signal filtering", "Sensor fusion / event detection", "Low-power MCU / SoC"], outputs: ["OLED display", "Haptic motor", "Wireless sync"] },
  127: { inputs: ["Reader RF field", "Card coil / chip ID", "Access policy"], processing: ["RF demodulation", "Reader MCU / ID decoding", "Access controller"], outputs: ["Door relay", "Access status", "Audit event"] },
  128: { inputs: ["Printed symbol", "Illumination / lens", "Trigger"], processing: ["CMOS / photodiode", "AFE / ADC", "Symbol decode / checksum"], outputs: ["USB / Bluetooth data", "LED / beep feedback"] },
  129: { inputs: ["Camera image", "Lens / illumination"], processing: ["Grayscale / threshold", "Finder / perspective", "Error correction / decode"], outputs: ["Text / link payload", "Display / app action"] },
  130: { inputs: ["Synthetic ridge pattern", "Capture quality"], processing: ["Sensor / ADC", "Minutiae extraction", "Template matcher"], outputs: ["Access decision", "Interface / status"] },
  131: { inputs: ["Scene light / lens", "Microphone"], processing: ["CMOS sensor", "Image signal processor", "H.264 / H.265 encoder"], outputs: ["Ethernet / NVR", "SD storage", "Live display"] },
  132: { inputs: ["Infrared radiation", "Reference temperature"], processing: ["IR optics / microbolometer", "Analog front end / ADC", "Calibration / compensation"], outputs: ["Temperature map", "False-colour image", "Display / memory"] },
  133: { inputs: ["Antenna / tuner", "HDMI / USB", "Wi-Fi / Ethernet"], processing: ["Media decode / main SoC", "Video scaler / T-CON", "Audio DAC / amplifier"], outputs: ["Display panel / backlight", "Left / right speakers"] },
  134: { inputs: ["PIN / fingerprint / RFID", "Door-position sensor", "Mobile credential"], processing: ["Secure authentication", "MCU / access policy", "H-bridge / latch driver"], outputs: ["Latch lock / unlock", "LED / app status", "Local event log"] }
};
var stepDetails = { 125: ["Establish the wireless link.", "Receive encoded audio packets.", "Decode audio, apply EQ and noise cancellation.", "Convert digital samples into an analog waveform.", "Amplify and move speaker diaphragms.", "Digitize microphone signals for calls and ANC.", "Regulate supply rails and recharge the cell."], 126: ["Tap, move or select a sensor demonstration.", "Collect synthetic touch, motion and pulse readings.", "Suppress noise and estimate useful measurements.", "Firmware decides which event occurred.", "Present measured state on the OLED.", "Provide tactile feedback for user actions.", "Transfer the local sensor record to the sync display.", "Use scheduled sensor sampling to reduce consumption."], 127: ["The reader generates an alternating magnetic field.", "Mutual coupling induces card supply voltage.", "The chip operates only above its energy threshold.", "Changing the antenna load encodes the card identifier.", "The reader demodulates the response.", "Compare the recovered ID with local authorization.", "Enable the relay only after an authorized tap."], 128: ["Start a local optical acquisition.", "Illuminate dark bars and light spaces.", "Measure their reflected intensity.", "Focus the reflection onto the sensor.", "Identify Code 128 module patterns and verify its checksum.", "Publish the decoded number after validation.", "Show success or a failed read."], 129: ["Load an example or a local image.", "Read its actual grayscale pixel evidence.", "Locate QR finder patterns.", "Normalize the code sampling plane.", "Apply jsQR decoding and error correction.", "Show the decoded content for review."], 130: ["Start with a synthetic fingerprint sample.", "Capture a noisy ridge/minutiae representation.", "Extract surviving synthetic feature coordinates.", "Measure the distance from enrolled minutiae.", "Compare the score with the selected threshold.", "Issue an access signal only after the match step."], 131: ["Light or near-IR illumination enters the camera.", "Optics focus the scene on the sensor.", "Pixel charge represents incident photons.", "Apply exposure and signal conditioning.", "Compress the frame stream using a selected codec model.", "Compare the resulting bit rate with available bandwidth.", "Display delivered quality and frame rate.", "Audio follows its own codec path."], 132: ["Objects emit temperature-dependent radiation.", "IR optics collect the radiance.", "Microbolometer resistance changes with absorbed energy.", "An internal reference supports drift correction.", "Compensate using assumed emissivity and reflected temperature.", "Map temperatures to colours and a display."], 133: ["Select the active input interface.", "Decode broadcast or compressed media.", "Run display and media control in the SoC.", "Scale video and generate panel timing.", "Convert and amplify the audio branch.", "Adjust panel luminance and speaker level.", "Show selected source and rendered output."], 134: ["Use the demonstration PIN 1234 or a sample credential.", "The input subsystem reads the user action.", "Check the credential and failed-attempt state.", "An unauthorized request keeps the latch closed.", "The motor driver retracts the latch with sufficient battery.", "An open-door sensor inhibits automatic relocking.", "Report attempts and current latch state.", "Relock after the selected delay once the door is closed."] };
var functions2 = { 125: ["Receives and transmits Bluetooth RF.", "Handles link protocol and incoming audio packets.", "Decodes compressed samples and applies audio processing.", "Converts and amplifies audio into speaker current.", "Moves a diaphragm to produce pressure waves.", "Capture voice and ambient noise.", "Supplies regulated rails and safely charges the cell."], 126: ["Detects finger position and gestures.", "Shows pixels and user notifications.", "Runs firmware and stores active state.", "Measures optical pulse variation.", "Measures linear acceleration.", "Measures angular rate.", "Converts an electrical command into vibration.", "Transfers records to nearby devices.", "Stores energy and receives inductive charging power."], 127: ["Couples magnetically to the reader field.", "Stores card data and load-modulates a response.", "Protects the embedded coil and chip.", "Produces and receives the near-field RF signal.", "Generates RF and recovers load modulation.", "Decodes card messages.", "Applies access policy independently of read success.", "Switches the lock power path.", "Supplies the reader and controller."], 128: ["Illuminates the symbol.", "Focuses reflected light.", "Converts optical intensity to an electrical signal.", "Conditions and digitizes intensity samples.", "Recognizes modules and validates a checksum.", "Starts acquisition.", "Confirms a successful read acoustically.", "Transfers decoded data to a host.", "Powers portable scanning electronics."], 129: ["Focuses light on the sensor.", "Captures the two-dimensional image.", "Illuminates the target in low light.", "Conditions raw pixels.", "Locates and decodes the QR symbol.", "Holds image buffers and firmware.", "Supplies local electronics.", "Presents recovered content.", "Transfers data to apps or other devices."], 130: ["Positions the finger over the sensing array.", "Illuminates ridges for an optical sensor.", "Captures ridge contrast or capacitance.", "Digitizes the sensor response.", "Extracts and compares feature geometry.", "Stores enrolled template features.", "Protects keys and authentication operations.", "Carries the decision to an access controller.", "Reports success or failure."], 131: ["Protects optics and electronics.", "Forms the optical image.", "Converts light into pixel charge.", "Illuminates a night scene with reflected near-IR.", "Processes and compresses video.", "Stores firmware and frame buffers.", "Carries frames and receives PoE power.", "Captures an optional audio stream.", "Stores a local recording."], 132: ["Transmits long-wave infrared radiation.", "Provides an internal calibration reference.", "Changes resistance with absorbed thermal radiation.", "Conditions and digitizes sensor values.", "Measures the calibration reference temperature.", "Compensates radiance and calculates a temperature map.", "Stores calibration and captured images.", "Shows the false-colour map.", "Powers the portable instrument."], 133: ["Selects a broadcast RF channel.", "Receives external digital media.", "Receives streamed content.", "Decodes media and manages apps.", "Stores firmware and working frame buffers.", "Generates panel timing and drive signals.", "Converts drive signals into visible pixels.", "Illuminates an LCD panel.", "Drives speaker current.", "Convert audio current into sound.", "Converts mains input to isolated DC rails."], 134: ["Captures a typed credential.", "Reads biometric or card inputs.", "Coordinates authentication and lock timing.", "Protects credential and cryptographic operations.", "Moves the latch mechanically.", "Applies bidirectional motor current.", "Detects open or closed door state.", "Carries app commands through an authenticated interface.", "Supplies electronics and actuator energy."] };
var quizzes = { 125: ["Which block converts samples into analog audio?", "DAC", "Antenna", "Battery"], 126: ["What does a PPG sensor observe?", "Optical pulse variation", "Wi-Fi channel", "Display colour"], 127: ["What powers a passive LF card?", "Energy from the reader RF field", "A mains cord", "The door hinge"], 128: ["What must precede host output?", "Decode and check-digit validation", "Changing the housing", "Opening the lens"], 129: ["What locates a QR symbol?", "Finder patterns", "Audio volume", "Motor torque"], 130: ["What is compared during matching?", "Extracted features and an enrolled template", "Housing colour", "Wi-Fi throughput"], 131: ["What does the encoder do?", "Compress video frames", "Focus the lens", "Supply illumination"], 132: ["Which setting affects temperature estimation?", "Emissivity", "TV channel", "Speaker volume"], 133: ["Which block controls panel timing?", "T-CON", "Speaker cone", "Remote battery"], 134: ["What happens before latch actuation?", "Credential authentication", "Antenna painting", "Display scaling"] };
var CONSUMER_DEFINITIONS = rows.map(([number, slug, subtitle, principle, parts, modes, controls, steps, applications, safety, source]) => ({ number, id: `everyday/${slug}`, mockup: `${number} - ${{ "bluetooth-headphones": "Bluetooth Headphones", "smartwatch": "Smartwatch", "rfid-access-card": "RFID Access Card", "barcode-scanner": "Barcode Scanner", "qr-code-scanner": "QR Code Scanner", "biometric-fingerprint-scanner": "Biometric Fingerprint Scanner", "cctv-camera": "CCTV Camera", "ir-camera": "IR Camera", "television": "Television", "digital-door-lock": "Digital Door Lock" }[slug]}.png`, theme: "light", family: slug, subtitle, principle, parts, modes, controls, steps: steps.map((s, i) => [s, itemAt(itemAt(stepDetails, number), i)]), applications, safety, source, architecture: architectures[number], partFunctions: Object.fromEntries(parts.map((part, i) => [part, itemAt(itemAt(functions2, number), i)])), quiz: itemAt(quizzes, number) }));

// src/studios/how-devices-work/advanced/robotics-data.ts
var ROBOTICS_DEFINITIONS = [
  { number: 115, id: "robotics/self-balancing-robot", mockup: "115 - Self-Balancing Robot.png", theme: "light", family: "balance", subtitle: "Build. Understand. Control. Keep it upright.", principle: "A two-wheeled robot is an inverted pendulum. An IMU estimates pitch and angular rate; a PID controller commands wheel torque to oppose falling. Motor drivers apply signed demand and wheel motion accelerates the base beneath the body. This reduced linear model shows saturation and the loss of balance outside its small-angle region.", parts: ["MPU6050-style IMU", "Arduino Nano-style MCU", "TB6612-style dual motor driver", "Li-Po battery", "Frame", "DC gear motors / encoders", "Wheels"], architecture: { inputs: ["Pitch / gyro rate", "Upright setpoint", "Encoder feedback"], processing: ["Angle estimation", "PID error control", "Demand saturation", "Dual H-bridge"], outputs: ["Wheel torque demand", "Body tilt / rate", "Balance status"] }, controls: "setpoint:Tilt setpoint:0:-5:5:0.5:\xB0|initial:Initial tilt:8:-20:20:1:\xB0|kp:Proportional gain:35:0:70:1:\xD7|ki:Integral gain:0.8:0:5:0.1:\xD7|kd:Derivative gain:1.2:0:4:0.1:\xD7", modes: ["Balance control", "Controller disabled", "Push disturbance"], steps: [["Disturbance", "The body tilts away from its upright target."], ["Measure tilt", "Accelerometer and gyro measurements estimate pitch and rate."], ["Read state", "The MCU updates its filtered state estimate."], ["Calculate PID", "Angle error, accumulated error and rate determine wheel demand."], ["Limit demand", "Motor commands saturate at the teaching limit."], ["Drive wheels", "Signed H-bridge output accelerates the wheels."], ["Correct tilt", "Wheel motion shifts the base under the body."], ["Repeat", "The controller continuously updates its feedback loop."]], applications: ["Personal transporters", "Delivery robots", "Humanoid balance", "Control education"], safety: ["Linearized dynamics apply near upright.", "Large tilt or saturation can lose balance.", "Hardware is represented by a local model."], quiz: ["Why move the wheels when the robot tilts?", "To move the base beneath the body", "To erase the IMU reading", "To increase battery voltage"], source: "https://ctms.engin.umich.edu/CTMS/index.php?example=InvertedPendulum&section=SystemModeling" },
  { number: 116, id: "robotics/industrial-robot-controller", mockup: "116 - Industrial Robot Controller.png", theme: "light", family: "industrial-arm", subtitle: "Explore the hardware, control architecture and operation of an industrial robot controller.", principle: "A teach pendant supplies a program to a real-time controller. Trajectory planning produces joint position, velocity and torque demands for servo drives. Encoders close each joint loop. A separate safety controller monitors emergency stop and interlocks; I/O and fieldbus links coordinate tools and production equipment. The native arm is a reduced six-joint teaching model.", parts: ["Cooling fans", "AC-DC power supply", "Safety controller", "Real-time CPU board", "Motion control board", "Servo drive modules", "I/O terminals", "Ethernet / fieldbus", "Teach pendant", "Joint encoders"], architecture: { inputs: ["Pendant / program", "Joint encoders / sensors", "Safety inputs / E-stop"], processing: ["Safety controller", "Real-time control CPU", "Trajectory / motion control", "Multi-axis servo drives"], outputs: ["Six joint commands", "Gripper / I-O", "Diagnostics / fieldbus"] }, controls: "j1:Joint 1:0:-180:180:1:\xB0|j2:Joint 2:-45:-90:90:1:\xB0|j3:Joint 3:30:-120:120:1:\xB0|j4:Joint 4:0:-180:180:1:\xB0|j5:Joint 5:60:-120:120:1:\xB0|j6:Joint 6:0:-180:180:1:\xB0|speed:Speed override:100:10:100:5:%", modes: ["Manual Control", "Program Run", "I/O Monitor", "Diagnostics"], steps: [["Program input", "Enter a local joint target or run the demonstration program."], ["Process commands", "Compute a trajectory toward the requested joint positions."], ["Check safety", "Emergency stop and enable state inhibit virtual drives."], ["Drive control", "Send coordinated demands to six servo channels."], ["Execute motion", "Motors and reductions move the joints."], ["Read feedback", "Encoder measurements close the position loops."], ["Coordinate tools", "I/O and fieldbus signals report process status."]], applications: ["Automotive manufacturing", "Electronics assembly", "Palletizing", "Machine tending"], safety: ["E-stop inhibits virtual drive output.", "This simplified arm is not a manufacturer kinematic model.", "No physical robot is commanded."], quiz: ["Which feedback keeps joint motion precise?", "Joint encoder position and velocity", "The cabinet colour", "The network SSID"], source: "https://www.fanucamerica.com/products/robots/controllers" },
  { number: 117, id: "robotics/collaborative-robot", mockup: "117 - Collaborative Robot.png", theme: "light", family: "cobot", subtitle: "People + Robots. A Safer, Smarter Tomorrow.", principle: "A collaborative robot combines joint motors, reduction gears, encoders and force/torque sensing. The controller plans motion while monitoring speed, contact force and safety inputs. Teach mode records joint waypoints for local replay. A cobot\u2019s safety depends on the entire application; force and speed limits in this reduced lab are illustrative.", parts: ["Brushless joint motor", "Harmonic drive", "Torque sensor", "Position encoder", "Safety electronics", "End effector", "Vision camera", "Robot controller", "Teach pendant"], architecture: { inputs: ["User / teach commands", "Encoders / force sensor", "Proximity / safety inputs"], processing: ["Motion planning", "Safety limit monitor", "Joint feedback control", "Joint motor drives"], outputs: ["Joint motion", "Gripper action", "Slow / protective stop"] }, controls: "j1:Base joint:-12:-180:180:1:\xB0|j2:Shoulder joint:45:-90:90:1:\xB0|j3:Elbow joint:90:-120:120:1:\xB0|j4:Wrist 1:-30:-180:180:1:\xB0|j5:Wrist 2:60:-120:120:1:\xB0|j6:Wrist 3:10:-180:180:1:\xB0|speed:Speed limit:25:5:100:5:%|force:Force limit:50:10:100:5:N|contact:Contact force:0:0:120:5:N|distance:Human proximity:1.5:0.1:3:0.1:m", modes: ["Normal operation", "Teach mode", "Safety monitored motion"], steps: [["Sense", "Read joint positions, interaction force and nearby presence."], ["Plan", "Apply motion targets and active limits."], ["Control joints", "Servo channels drive motors using encoder feedback."], ["Monitor proximity", "Reduce demand when a person approaches in monitored mode."], ["Perform task", "Move the end effector toward the teaching target."], ["React to contact", "Stop virtual motion when force exceeds the limit."], ["Teach", "Record the requested joint positions locally."], ["Replay", "Follow recorded waypoints under the same limits."]], applications: ["Assembly & manufacturing", "Pick and place", "Quality inspection", "Research & education"], safety: ["An application risk assessment determines real collaboration safety.", "Force-limit exceedance stops this virtual arm.", "Teach waypoints remain local to the page."], quiz: ["What must still be assessed when using a cobot?", "The complete application and its hazards", "Only the paint colour", "Only the Wi-Fi password"], source: "https://www.universal-robots.com/manuals/EN/HTML/SW5_19/Content/prod-scriptmanual/G5/force_mode_task_frame_selection_vector.htm" },
  { number: 118, id: "robotics/lidar-mapping-robot", mockup: "118 - LiDAR Mapping Robot.png", theme: "light", family: "lidar-robot", subtitle: "Build. Map. Navigate. Explore the world with LiDAR.", principle: "A 2D LiDAR measures range at successive scan angles. IMU and wheel odometry estimate motion; transforming each ray into world coordinates updates an occupancy grid. A path planner finds free cells toward a goal and motion control follows the path. This lab performs actual grid ray casting and free/occupied updates in a synthetic room.", parts: ["2D LiDAR sensor", "Onboard computer", "IMU", "Wheel encoders", "Dual motor driver", "Battery", "Communication module", "Left / right motors"], architecture: { inputs: ["LiDAR ranges", "IMU / encoders", "Manual / goal command"], processing: ["Odometry / sensor fusion", "Ray-to-world transform", "Occupancy update", "Path planning / motion control"], outputs: ["Range points", "2D occupancy map", "Pose / motor commands"] }, controls: "speed:Robot speed:0.5:0.1:1:0.1:m/s|range:LiDAR range:8:1:12:1:m|rays:Scan rays:72:12:180:12:rays|bias:Odometry bias:0:0:0.2:0.01:m/s", modes: ["Manual", "Autonomous", "Mapping only"], steps: [["Emit / measure", "Cast a synthetic ray and measure its first intersection."], ["Collect polar points", "Record scan angle and range for each ray."], ["Transform", "Convert ranges to robot/world Cartesian coordinates."], ["Update map", "Mark traversed cells free and endpoints occupied."], ["Plan", "Search the occupancy grid for a route to the goal."], ["Control motion", "Follow the route with bounded speed."], ["Repeat", "New poses reveal additional cells."]], applications: ["Indoor mapping", "Autonomous navigation", "Inspection & surveying", "Search & rescue"], safety: ["The room is synthetic ground truth.", "Occupancy comes from measured rays, not a background picture.", "Odometry bias can distort point placement."], quiz: ["How is a polar scan point transformed to Cartesian coordinates?", "Using its range and scan angle", "Using the battery colour", "Using the network channel"], source: "https://docs.nav2.org/rolling/getting_started/navigation_concepts/navigation_servers/" },
  { number: 119, id: "robotics/slam-navigation-system", mockup: "119 - SLAM Navigation System.png", theme: "light", family: "slam", subtitle: "Map. Localize. Navigate. Repeat.", principle: "SLAM estimates robot pose while building a map from sensor observations. This reduced 2D lab combines biased odometry, ray-cast scans, occupancy updates and an optional landmark correction that limits accumulated error. It does not claim full graph optimization. A grid planner computes a collision-free route through the synthetic room.", parts: ["LiDAR / camera", "IMU", "Wheel encoders", "Onboard processor", "Map memory", "Motor controller", "DC motors", "Battery"], architecture: { inputs: ["Scan points / images", "IMU / odometry", "Start pose / goal"], processing: ["Sensor preprocessing", "Pose estimate / correction", "Occupancy-grid mapping", "Global path / local control"], outputs: ["Updated map", "Robot pose", "Planned path / motor commands"] }, controls: "startx:Start X:2:1:16:1:cell|starty:Start Y:14:1:16:1:cell|goalx:Goal X:16:1:16:1:cell|goaly:Goal Y:2:1:16:1:cell|speed:Navigation speed:0.5:0.1:1:0.1:m/s|bias:Odometry bias:0.03:0:0.2:0.01:m/s", modes: ["Localization + Mapping", "Odometry only", "Landmark correction"], steps: [["Acquire data", "LiDAR rays, IMU and encoder motion provide measurements."], ["Extract observations", "Identify occupied endpoints from range measurements."], ["Estimate pose", "Integrate odometry; optionally correct against a synthetic landmark."], ["Update map", "Accumulate free and occupied evidence in a grid."], ["Plan path", "Search free cells from start to goal."], ["Command motion", "Track successive path cells."]], applications: ["Warehouse robots", "Service robots", "Autonomous inspection", "Agriculture robots", "Search & rescue"], safety: ["Reduced odometry plus landmark correction model.", "Occupied goals are rejected.", "Obstacle edits immediately recompute the route."], quiz: ["What does SLAM estimate together?", "Robot location and a map of the environment", "Only motor colour and battery size", "Only Wi-Fi throughput"], source: "https://docs.nav2.org/jazzy/configuration_and_development/" },
  { number: 120, id: "robotics/autonomous-mobile-robot", mockup: "120 - Autonomous Mobile Robot.png", theme: "light", family: "autonomous-vehicle", subtitle: "Sense. Decide. Drive. Explore an autonomous ground vehicle.", principle: "The recovered reference depicts a vehicle platform. Cameras/range sensors and odometry supply a pose and obstacle estimate; guidance selects steering and speed commands. A reduced bicycle model links steering angle, wheelbase and forward speed to yaw rate and trajectory. Obstacle braking and a synthetic GNSS correction illustrate supervisory decisions.", parts: ["Vehicle platform", "Range / camera sensing", "Navigation processor", "Steering actuator", "Drive motors", "Wheel odometry", "GNSS receiver", "Battery / power distribution"], architecture: { inputs: ["Range / camera observations", "Odometry / GNSS", "Speed / steering target"], processing: ["Pose estimation", "Obstacle supervisor", "Vehicle guidance", "Steering / drive controller"], outputs: ["Steering / speed", "Vehicle pose", "Brake / status"] }, controls: "speed:Vehicle speed:1:0:3:0.1:m/s|steer:Steering angle:10:-30:30:1:\xB0|wheelbase:Wheelbase:1.5:0.5:2.5:0.1:m|distance:Obstacle distance:4:0.1:8:0.1:m", modes: ["Manual trajectory", "Obstacle braking", "GNSS-corrected pose"], steps: [["Observe", "Measure a synthetic obstacle range and vehicle motion."], ["Estimate", "Combine wheel motion with available position information."], ["Guide", "Choose steering and forward-speed demands."], ["Drive", "Steering changes yaw rate while wheels advance the platform."], ["Monitor", "Compare obstacle distance with the braking threshold."], ["Stop", "Brake forward motion when the safety rule requires it."]], applications: ["Autonomous ground transport", "Inspection", "Research platforms", "Outdoor navigation"], safety: ["The source is a recovered vehicle image.", "Bicycle kinematics omit tyre slip and suspension.", "Braking is a local teaching rule."], quiz: ["For a fixed speed, what increases the bicycle-model yaw rate?", "More steering angle or a shorter wheelbase", "A larger display", "A lower image resolution"], source: "https://docs.ros.org/en/rolling/p/ros2_controllers/doc/mobile_robot_kinematics.html" },
  { number: 121, id: "robotics/warehouse-robot", mockup: "121 - Warehouse Robot.png", theme: "light", family: "warehouse", subtitle: "Autonomous Mobile Robot for Smart Fulfilment", principle: "A warehouse robot receives a transport task, localizes with LiDAR and wheel motion, plans through rack aisles, identifies its target station and controls a lift. The task supervisor sequences approach, alignment, pickup, transport and delivery. This lab uses a computed grid route and timed virtual lift states with load-dependent speed.", parts: ["360\xB0 LiDAR", "Wireless antenna", "Industrial computer", "Battery / BMS", "Drive motors", "Wheel encoders", "Lift mechanism", "Barcode / vision sensor", "Shelf / bin"], architecture: { inputs: ["Transport task", "LiDAR / wheel encoders", "Rack identification"], processing: ["Localization / planning", "Task supervisor", "Drive control", "Lift control"], outputs: ["Transport route", "Shelf lift", "Task status / wireless report"] }, controls: "station:Target station:3:1:4:1:station|speed:Transport speed:0.8:0.2:1.2:0.1:m/s|load:Payload:30:0:100:5:kg|lift:Lift height:0.4:0.1:1:0.1:m", modes: ["Transport task", "Lift only", "Obstacle blocked"], steps: [["Receive task", "Select a synthetic destination station."], ["Plan / navigate", "Compute a route through the rack grid."], ["Identify rack", "Confirm the selected virtual station."], ["Align", "Stop at the station approach position."], ["Lift shelf", "Raise the virtual load to the requested height."], ["Transport", "Move toward the delivery point at load-limited speed."], ["Confirm delivery", "Lower the load and complete the local task."]], applications: ["E-commerce fulfilment", "Manufacturing", "Retail & grocery", "Healthcare & pharma"], safety: ["Loads reduce the teaching travel speed.", "Blocked routes inhibit transport.", "No warehouse task is transmitted."], quiz: ["What decides the pickup and delivery sequence?", "The task supervisor", "The camera lens alone", "The wheel colour"], source: "https://docs.nav2.org/rolling/getting_started/navigation_concepts/navigation_servers/" },
  { number: 122, id: "robotics/machine-vision-system", mockup: "122 - Machine-Vision System.png", theme: "light", family: "machine-vision", subtitle: "See. Analyze. Decide. Automate.", principle: "A trigger sensor starts camera exposure under controlled lighting. Pixel preprocessing, thresholding and connected-component analysis extract object area, centroid and a missing-feature defect score. The decision compares measured features with inspection limits before producing a virtual accept/reject output. The lab processes an actual synthetic pixel array locally.", parts: ["Industrial CMOS camera", "Lens", "LED ring light", "Trigger sensor", "Vision processor", "Communication interface", "PLC output", "Conveyor / diverter"], architecture: { inputs: ["Camera pixel array", "Trigger / illumination", "Inspection limits"], processing: ["Threshold preprocessing", "Connected components", "Feature / defect measurement", "Accept / reject decision"], outputs: ["Annotated image", "Measured features", "Virtual PLC decision"] }, controls: "threshold:Defect threshold:0.7:0.1:0.9:0.05:score|area:Minimum feature area:500:100:1500:50:pixels|edge:Edge sensitivity:0.6:0.1:1:0.1:\xD7|light:Illumination:90:10:100:5:%|defect:Missing feature size:0:0:12:1:pixels", modes: ["Normal part", "Missing feature", "Poor illumination"], steps: [["Detect part", "A local inspection button represents the trigger."], ["Capture image", "Build a grayscale test part under selected illumination."], ["Preprocess", "Threshold pixel evidence using edge sensitivity."], ["Extract features", "Label connected foreground pixels and calculate geometry."], ["Classify", "Compare area and defect score with limits."], ["Decide", "Generate a virtual accept or reject result."], ["Act", "Illustrate the diverter output."], ["Log", "Store the local inspection result."]], applications: ["Automotive inspection", "Electronics / PCB inspection", "Pharmaceutical packaging", "Food & beverage quality"], safety: ["Image features come from a synthetic pixel array.", "Lighting changes pixel evidence and classification.", "No real production decision is issued."], quiz: ["Why control illumination during inspection?", "To make pixel measurements repeatable", "To change the network address", "To replace the image sensor"], source: "https://www.cognex.com/what-is/machine-vision" },
  { number: 123, id: "robotics/quadruped-robot", mockup: "123 - Quadruped Robot.png", theme: "light", family: "quadruped", subtitle: "Design, control and experiment with a four-legged robot.", principle: "IMU, joint encoders, foot contacts and perception feed body-state estimation. A gait planner supplies foot trajectories; inverse kinematics converts them into joint targets and motor feedback tracks the motion. This reduced gait model computes two-link leg angles and alternating contact phases; body pitch and roll shift foot-height targets.", parts: ["LiDAR / depth camera", "IMU", "Compute module", "Battery pack", "BLDC servo actuators", "Reduction gears", "Leg links", "Foot contact sensors"], architecture: { inputs: ["IMU / body orientation", "Foot contacts / encoders", "Gait / speed target"], processing: ["State estimation", "Gait / foot trajectories", "Inverse kinematics", "Joint feedback control"], outputs: ["Joint angles / demands", "Foot contacts", "Body motion"] }, controls: "speed:Gait speed:0.5:0:1.5:0.1:m/s|pitch:Body pitch:0:-15:15:1:\xB0|roll:Body roll:0:-15:15:1:\xB0|height:Body height:0.3:0.2:0.4:0.01:m", modes: ["Walk", "Trot", "Bound", "Stand"], steps: [["Sense", "Read orientation, joint and foot-contact measurements."], ["Estimate", "Update the reduced body pose."], ["Plan gait", "Choose phase offsets and foot trajectories."], ["Solve geometry", "Use inverse kinematics for the two-link legs."], ["Control joints", "Send angles to virtual servo channels."], ["Maintain posture", "Shift foot targets for body pitch and roll."], ["Adapt", "Inspect contact sequence and reach limits."]], applications: ["Inspection", "Search & rescue", "Construction", "Agriculture", "Security patrol", "Research & education"], safety: ["Two-link kinematics omit full-body dynamics.", "Unreachable feet are flagged rather than fabricated.", "Virtual contact phase is not a physical stability guarantee."], quiz: ["What converts a target foot position to joint angles?", "Inverse kinematics", "RF demodulation", "Barcode decoding"], source: "https://github.com/unitreerobotics/unitree_ros" },
  { number: 124, id: "everyday/wi-fi-router", mockup: "124 - Wi-Fi Router.png", theme: "light", family: "wifi-router", subtitle: "Explore the hardware, architecture and working of a modern Wi-Fi router.", principle: "Ethernet PHYs receive frames from WAN and LAN links. A router SoC performs packet forwarding, NAT, firewall rules and queue management; its switch fabric and wireless MAC/PHY send traffic to selected interfaces. RF front ends and antennas convert wireless data into radio signals. The reduced throughput model illustrates shared airtime, signal loss and channel interference.", parts: ["Dual-band antennas", "RF front end", "Router SoC / CPU", "RAM", "Flash memory", "Ethernet switch / PHY", "Power regulation", "Crystal oscillator"], architecture: { inputs: ["Internet / WAN frames", "LAN traffic", "Wireless client requests"], processing: ["PHY / frame processing", "Routing / NAT / firewall", "Queue / QoS", "Wireless MAC / PHY"], outputs: ["Wi-Fi RF frames", "LAN port frames", "Forwarded WAN packets"] }, controls: "channel:Channel:6:1:11:1:channel|power:Transmit power:75:5:100:5:%|clients:Connected clients:5:1:30:1:clients|distance:Client distance:5:1:40:1:m|interference:Channel interference:10:0:100:5:%", modes: ["2.4 GHz", "5 GHz", "Dual-band"], steps: [["Receive Internet data", "Ethernet PHY receives upstream frames."], ["Process packets", "SoC applies route, NAT, firewall and queue decisions."], ["Switch", "Forward frames toward the intended interface."], ["Transmit wireless", "MAC scheduling and PHY modulation drive the RF chain."], ["Receive wireless", "Decode incoming frames from associated clients."], ["Communicate", "Share airtime and forward client traffic."], ["Deliver", "Send packets toward LAN clients or the WAN."]], applications: ["Home networking", "Small office", "Smart homes", "Education", "Public Wi-Fi", "Enterprise networking", "Mesh networks", "ISP deployment"], safety: ["Throughput is an illustrative payload estimate.", "Clients share available airtime.", "Settings affect the local model only."], quiz: ["Why can per-client throughput fall as clients increase?", "They share airtime and protocol overhead", "RAM changes colour", "The antenna loses its connector"], source: "https://www.cisco.com/c/en/us/support/docs/wireless/catalyst-9800-series-wireless-controllers/221766-validate-wi-fi-throughput-testing-and.html" }
];

// src/studios/how-devices-work/advanced/control-data.ts
var CONTROL_DEFINITIONS = [
  { number: 105, id: "marine/marine-vhf-radio", mockup: "105 - Marine VHF Radio.png", theme: "light", family: "marine-vhf", subtitle: "Clear Communication. Safer Voyages.", principle: "A microphone and audio preamplifier feed the FM modulator; a power amplifier and low-pass filter drive the VHF antenna. The receive path filters, mixes and demodulates RF before the audio amplifier and speaker. A separate DSC controller uses channel 70 for digital calling. The lab uses synthetic signals without a microphone or radio transmitter.", parts: ["Microphone", "Audio preamplifier", "FM synthesizer / modulator", "RF power amplifier", "Low-pass filter", "Duplexer", "LNA / mixer", "FM demodulator", "Audio amplifier", "DSC controller", "GPS interface", "Display / channel knob"], steps: [["Speak", "A microphone would produce the input waveform."], ["Amplify", "Audio conditioning boosts and filters the signal."], ["Modulate", "FM encodes audio onto the carrier."], ["Amplify RF", "The PA establishes transmit power."], ["Transmit", "The antenna radiates the physical radio signal."], ["Receive", "The RF front end selects a received carrier."], ["Output audio", "Demodulation recovers speaker audio."], ["Integrate DSC", "Channel 70 carries digital calling with navigation data."]], architecture: { inputs: ["Microphone audio", "Received VHF signal", "Channel / GPS"], processing: ["Audio preamp / FM", "RF PA / low-pass filter", "LNA / mixer / demodulator", "MCU / DSC controller"], outputs: ["Virtual VHF waveform", "Recovered audio", "DSC message illustration"] }, controls: "channel:Voice channel:16:1:28:1:channel|power:Transmit power:25:1:25:1:W|squelch:Squelch threshold:-95:-120:-60:1:dBm|signal:Received signal:-85:-120:-50:1:dBm|audio:Microphone level:60:0:100:1:%", modes: ["Voice FM", "DSC channel 70", "Receive only"], applications: ["Ship-to-ship communication", "Port contact", "Navigation information", "Search & rescue", "Routine operational traffic"], safety: ["All transmissions are local illustrations.", "Channel 70 carries DSC rather than voice.", "No actual distress alert is sent."], quiz: ["What is channel 70 used for?", "Digital selective calling", "FM voice chatting", "GPS satellite reception"], source: "https://navcen.uscg.gov/international-vhf-marine-radio-channels-freq" },
  { number: 106, id: "marine/epirb-emergency-beacon", mockup: "106 - EPIRB Emergency Beacon.png", theme: "light", family: "epirb", subtitle: "Small device. A global impact.", principle: "Activation starts a beacon controller, which forms a digital identifier and optional GNSS position for a 406 MHz satellite distress message. A 121.5 MHz homing transmitter and strobe aid local search. The staged simulation illustrates acquisition, encoding and relay; its times are compressed and no emergency service is contacted.", parts: ["Antenna", "Strobe LED", "Activation switch", "Water sensor", "GNSS receiver", "406 MHz transmitter", "121.5 MHz homing transmitter", "Controller", "Primary battery", "Waterproof housing"], steps: [["Activate", "Manual or immersion sensing starts the virtual sequence."], ["Acquire GNSS", "Collect a synthetic position when enough satellites are available."], ["Encode", "Combine beacon identifier and available position."], ["Relay", "Illustrate the 406 MHz satellite path."], ["Coordinate", "A simulated receiving station forwards the teaching alert."], ["Locate", "Illustrate homing and strobe outputs."]], architecture: { inputs: ["Manual / water activation", "GNSS position", "Battery state"], processing: ["Power regulator", "MCU message encoding", "406 MHz RF chain", "121.5 MHz RF chain"], outputs: ["Satellite message illustration", "Local homing signal", "Strobe"] }, controls: "battery:Battery charge:100:0:100:1:%|satellites:GNSS satellites:8:0:12:1:count", modes: ["Manual activation", "Immersion activation", "Self-test", "Satellite relay unavailable"], applications: ["Maritime emergencies", "Commercial fishing", "Recreational boating", "Offshore operations"], safety: ["The button runs a local simulation only.", "121.5 MHz is for local homing rather than satellite alerts.", "A real beacon requires registration and correct maintenance."], quiz: ["Which signal is relayed by the satellite distress system?", "The digital 406 MHz message", "Only the strobe light", "The 121.5 MHz audio channel"], source: "https://www.sarsat.noaa.gov/faqs/" },
  { number: 107, id: "marine/dynamic-positioning-system", mockup: "107 - Dynamic Positioning System.png", theme: "light", family: "dynamic-positioning", subtitle: "Maintain position and heading using sensors, computers and thrusters.", principle: "Position references, a heading sensor, wind sensors and a motion reference unit feed the DP computer. A reduced surge/sway/yaw controller estimates environmental forces and allocates corrective force to thrusters. Feedback updates position and heading. The teaching model includes bounded thrust and a loss-of-thruster case.", parts: ["GNSS position reference", "Gyrocompass", "Wind sensor", "Motion reference unit", "Operator console", "DP computer", "Thruster controllers", "Azimuth thrusters", "Power system"], steps: [["Measure", "Read position, heading and environmental measurements."], ["Compare", "Compute error from the station-keeping setpoint."], ["Calculate", "Determine required surge, sway and yaw correction."], ["Allocate", "Distribute demanded force among available thrusters."], ["Act", "Thrusters change vessel motion."], ["Maintain", "Measured vessel response closes the loop."]], architecture: { inputs: ["Position / heading reference", "Wind / current / waves", "Motion reference"], processing: ["Disturbance estimate", "Position / yaw control", "Thrust allocation", "Thruster feedback"], outputs: ["Allocated force", "Position / heading", "Station-keeping error"] }, controls: "wind:Wind speed:12:0:40:1:kn|current:Current speed:0.8:0:3:0.1:kn|waves:Wave height:1.2:0:5:0.1:m|heading:Heading setpoint:180:0:359:1:\xB0|gain:Position gain:1:0.2:3:0.1:\xD7", modes: ["Auto position hold", "Manual drift", "One thruster unavailable"], applications: ["Offshore construction", "Subsea operations", "Pipe laying", "Offshore wind installation"], safety: ["Reduced three-degree-of-freedom dynamics.", "Thruster saturation limits station keeping.", "No vessel commands are issued."], quiz: ["Why does DP use position feedback?", "To correct vessel motion after disturbances", "To replace all thrusters", "To increase wind speed"], source: "https://www.kongsberg.com/maritime/products/positioning-and-manoeuvring/dynamic-positioning/" },
  { number: 108, id: "marine/underwater-rov-control-system", mockup: "108 - Underwater ROV Control System.png", theme: "light", family: "rov", subtitle: "Design \xB7 Control \xB7 Explore \xB7 Real-World Impact", principle: "Pilot commands travel through the tether to an underwater control computer. IMU and pressure measurements support stabilization and depth hold. ESCs drive thrusters; camera and telemetry data return to the topside console. The reduced model exposes surge, yaw, depth, lights and a virtual manipulator.", parts: ["Topside console", "Tether", "Communication module", "Control computer", "Motor drivers", "Power converter", "IMU", "Pressure sensor", "Camera", "LED lights", "Manipulator interface", "Six thrusters"], steps: [["Command", "Pilot sets movement commands."], ["Transmit", "The tether carries commands and power/data."], ["Process", "The onboard computer uses sensor feedback."], ["Drive", "ESCs change thruster demand."], ["Return data", "Video and telemetry travel to the surface."], ["Observe", "Pilot evaluates the simulated scene."], ["Stabilize", "Depth and attitude loops correct motion."], ["Repeat", "Continuous command and feedback keep the ROV responsive."]], architecture: { inputs: ["Joystick / mission commands", "Pressure / IMU", "Camera / sonar"], processing: ["Tether interface", "Control computer", "Stabilization / allocation", "ESC motor drivers"], outputs: ["Thruster demands", "Lights / manipulator", "Video / telemetry"] }, controls: "surge:Forward thrust:0:-100:100:5:%|yaw:Yaw thrust:0:-100:100:5:%|depth:Target depth:15:0:100:1:m|heave:Vertical thrust:0:-100:100:5:%", modes: ["Manual Control", "Depth Hold", "Sensors", "Mission Tools"], applications: ["Infrastructure inspection", "Marine research", "Search & recovery", "Environmental monitoring"], safety: ["Tethered reduced teaching platform.", "Manipulator and lighting are virtual.", "No real vehicle or camera connection."], quiz: ["What is the tether used for?", "Command, telemetry and often power", "Only a compass reference", "Satellite communication underwater"], source: "https://www.ardusub.com/" },
  { number: 109, id: "marine/autonomous-underwater-vehicle-navigation", mockup: "109 - Autonomous Underwater Vehicle Navigation.png", theme: "light", family: "auv", subtitle: "Estimate position. Follow waypoints. Update at the surface.", principle: "Underwater navigation fuses inertial measurements, Doppler velocity and depth pressure data; sonar supports obstacle detection. A mission planner supplies waypoints and guidance commands control fins/thrusters. GNSS is available at the surface, where it can correct accumulated drift. The simulation uses a reduced position-error and waypoint model.", parts: ["Acoustic modem", "Mission planner", "Navigation computer", "Battery", "Sonar", "INS / IMU", "Doppler velocity log", "Pressure sensor", "Propulsion", "Control fins"], steps: [["Plan", "Choose waypoints, speed and maximum depth."], ["Dive", "Begin the synthetic underwater mission."], ["Estimate", "Fuse inertial, DVL and pressure measurements."], ["Follow", "Guidance tracks the local waypoint sequence."], ["Avoid", "Sonar-detected obstacles require a new path."], ["Surface", "Use a synthetic GNSS fix to reduce drift."], ["Continue", "Resume with a corrected position estimate."]], architecture: { inputs: ["INS / IMU", "DVL / pressure", "Sonar / surface GNSS"], processing: ["Sensor fusion", "State estimate", "Waypoint guidance", "Obstacle / mission supervisor"], outputs: ["Estimated pose", "Thruster / fin commands", "Mission progress"] }, controls: "speed:Cruise speed:1.5:0.5:3:0.1:m/s|depth:Maximum depth:50:5:100:5:m|bias:Inertial velocity bias:0.02:0:0.1:0.005:m/s", modes: ["INS + DVL fusion", "INS only", "Surface GNSS update", "Obstacle avoidance"], applications: ["Seafloor mapping", "Infrastructure inspection", "Search & recovery", "Environmental monitoring"], safety: ["GNSS is unavailable while submerged.", "DVL bottom lock can be lost.", "All mission geometry is synthetic."], quiz: ["Why surface for a GNSS update?", "Satellite radio signals do not provide an underwater fix", "GNSS requires colder water", "DVL cannot measure velocity"], source: "https://oceanservice.noaa.gov/facts/auv.html" },
  { number: 110, id: "marine/digital-engine-control", mockup: "110 - Digital Engine Control.png", theme: "light", family: "marine-engine", subtitle: "Understand \xB7 Explore \xB7 Simulate \xB7 Apply", principle: "Crank/cam, temperature, manifold pressure and throttle signals enter a conditioned ECU interface. The MCU estimates engine state and commands injector timing, ignition and actuators through power drivers. Engine response feeds back through sensors; CAN supports instrument and diagnostic communication. This reduced model does not represent a calibrated manufacturer map.", parts: ["Crankshaft sensor", "Camshaft sensor", "Throttle sensor", "Coolant temperature sensor", "MAP sensor", "ECU input conditioning", "Processor", "Flash / EEPROM", "Injector drivers", "Ignition drivers", "CAN transceiver", "Power / sealed enclosure"], steps: [["Sense", "Measure speed, load, temperature and pressure."], ["Condition", "Filter and digitize sensor signals."], ["Calculate", "Determine reduced fuel and timing commands."], ["Drive", "Power stages control injectors and actuators."], ["Respond", "Engine state changes and sensors report feedback."], ["Diagnose", "Monitor limits and publish instrument data."]], architecture: { inputs: ["CKP / CMP timing", "Throttle / MAP", "Coolant / intake temperature"], processing: ["Conditioning / ADC", "MCU control algorithms", "Memory / diagnostics", "Injector / ignition drivers"], outputs: ["Fuel pulse width", "Ignition timing", "Throttle / EGR / cooling", "CAN instrument data"] }, controls: "rpm:Engine speed:750:500:4000:50:rpm|throttle:Throttle position:16:0:100:1:%|load:Engine load:32:0:100:1:%|temperature:Coolant temperature:90:-20:120:1:\xB0C", modes: ["Normal operation", "Cold start", "Overtemperature protection"], applications: ["Marine engines", "Industrial generators", "Off-highway vehicles", "Stationary engines"], safety: ["Reduced fuel and ignition maps only.", "Overtemperature limits demand.", "Synthetic diagnostics do not control an ECU."], quiz: ["What drives fuel injectors from an MCU command?", "The ECU power-driver circuits", "The display pixels", "The GPS antenna"], source: "https://www.nxp.com/applications/automotive/powertrain:POWERTRAIN" },
  { number: 111, id: "robotics/servo-motor-controller", mockup: "111 - Servo Motor Controller.png", theme: "light", family: "servo", subtitle: "Understand. Experiment. Control. Real-world robotics starts here.", principle: "A pulse decoder converts command width to a target angle. The controller compares it with potentiometer/encoder feedback and drives a DC motor through an H-bridge. A gearbox reduces speed and increases output torque. This teaching servo is calibrated to 0\u2013180\xB0 over 1\u20132 ms; actual servo ranges and calibration vary.", parts: ["Output shaft", "Gearbox", "DC motor", "Position sensor", "Control PCB", "PWM decoder / MCU", "H-bridge", "Power input", "PWM input"], steps: [["Receive PWM", "Measure command pulse width."], ["Decode target", "Apply the teaching calibration."], ["Read feedback", "Measure current shaft position."], ["Compare", "Calculate angular error."], ["Drive motor", "Use signed H-bridge demand."], ["Reduce speed", "Gearbox transfers motor torque."], ["Reach target", "Reduce demand as error falls."], ["Hold", "Feedback corrects a sustained load."]], architecture: { inputs: ["PWM command", "Position feedback", "Supply / load"], processing: ["Pulse decoder", "Target calculation", "PID-like feedback", "H-bridge / DC motor"], outputs: ["Gearbox / shaft angle", "Holding demand"] }, controls: "angle:Target angle:90:0:180:1:\xB0|pulse:PWM pulse width:1.5:1:2:0.01:ms|gain:Position gain:2:0.5:5:0.1:\xD7|load:Opposing load:0:0:50:1:%", modes: ["Angle command", "Pulse-width command"], applications: ["Robotic arms", "Mobile robots", "Camera gimbals", "Humanoid joints", "RC models", "Grippers"], safety: ["Pulse-to-angle calibration is illustrative.", "Sustained stalls heat the motor.", "The simulated shaft cannot operate hardware."], quiz: ["What tells the servo it reached its target?", "Position feedback", "A larger PWM frequency alone", "The housing colour"], source: "https://www.pololu.com/blog/17/servo-control-interface-in-detail" },
  { number: 112, id: "robotics/stepper-motor-controller", mockup: "112 - Stepper Motor Controller.png", theme: "light", family: "stepper", subtitle: "Learn. Control. Move the World \u2014 One Step at a Time.", principle: "STEP and DIR inputs advance a translator that sets winding-current references. Chopper regulation and MOSFET H-bridges drive the two phases. Full/half/microstep sequences move the rotor by known increments; the open-loop command count does not prove actual position if torque limits cause missed steps.", parts: ["Front bearing", "Permanent-magnet rotor", "Phase A / B coils", "Rear bearing", "Translator", "Current regulator", "H-bridge MOSFETs", "Current-sense resistor", "STEP / DIR interface", "Motor power supply"], steps: [["Receive command", "Read STEP, DIR and enable."], ["Interpret", "Select direction and increment size."], ["Sequence", "Advance the phase-current references."], ["Regulate", "Chopper control maintains selected current."], ["Drive coils", "H-bridges energize motor phases."], ["Move shaft", "Rotor aligns with the changing field."], ["Repeat", "Count commands and continue until the programmed move completes."]], architecture: { inputs: ["STEP pulse", "DIR / enable", "Current / step-mode setting"], processing: ["Translator", "Microstep sequence", "Chopper current control", "Dual H-bridge"], outputs: ["Phase A current", "Phase B current", "Commanded shaft angle"] }, controls: "frequency:Step frequency:500:10:2000:10:pps|steps:Steps to move:200:1:2000:1:pulses|microsteps:Microstep divisor:16:1:16:1:\xD7|current:Phase current limit:1:0.2:2:0.1:A|direction:Direction:1:-1:1:2:CW / CCW", modes: ["Full Step", "Half Step", "Microstepping"], applications: ["CNC machines", "3D printers", "Robot joints", "Linear actuators"], safety: ["Commanded position assumes no missed steps.", "Current limits govern heating and torque.", "Microsteps improve command resolution, not guaranteed absolute accuracy."], quiz: ["What does microstepping change?", "Winding-current references and commanded angular increment", "The number of motor bearings", "The ADC clock of a camera"], source: "https://www.allegromicro.com/en/products/motor-drivers/brush-dc-motor-drivers/a4988" },
  { number: 113, id: "robotics/mobile-robot", mockup: "113 - Mobile Robot.png", theme: "light", family: "mobile-robot", subtitle: "Sense. Plan. Move. Explore the electronics of a mobile platform.", principle: "A mobile robot uses distance sensing, wheel encoders and inertial measurements to estimate motion. A controller computes wheel-speed commands and motor drivers apply them. This recovered reference shows the external wheeled platform; the native schematic explains its functional subsystems and a reduced differential-drive model.", parts: ["Wheeled chassis", "Battery", "Motor drivers", "Left / right motors", "Wheel encoders", "IMU", "Distance sensor", "Controller", "Communication antenna"], steps: [["Sense", "Measure a synthetic obstacle distance."], ["Estimate", "Use wheel speeds and track width for pose updates."], ["Plan", "Compare distance with the stop threshold."], ["Drive", "Send left and right wheel commands."], ["Feed back", "Update pose and encoder counts."], ["Stop safely", "Obstacle mode inhibits forward travel inside the threshold."]], architecture: { inputs: ["Distance sensor", "Encoder / IMU", "User motion target"], processing: ["Controller", "Obstacle rule", "Differential-drive kinematics", "Motor H-bridges"], outputs: ["Wheel commands", "Estimated pose", "Status / telemetry"] }, controls: "left:Left wheel speed:0.3:-1:1:0.05:m/s|right:Right wheel speed:0.3:-1:1:0.05:m/s|distance:Obstacle distance:1:0.05:3:0.05:m|track:Wheel track:0.3:0.2:0.6:0.05:m", modes: ["Manual drive", "Obstacle stop"], applications: ["Education", "Inspection", "Indoor transport", "Autonomous navigation"], safety: ["Reduced differential-drive geometry.", "Pose assumes no wheel slip.", "Recovered source supplies an external hardware view."], quiz: ["How does a differential-drive robot turn?", "By changing left/right wheel speeds", "By changing display brightness", "By rotating its battery"], source: "https://docs.ros.org/en/rolling/p/ros2_controllers/doc/mobile_robot_kinematics.html" },
  { number: 114, id: "robotics/line-following-robot", mockup: "114 - Line-Following Robot.png", theme: "light", family: "line-follower", subtitle: "Sense the line. Make a decision. Keep moving forward.", principle: "IR reflectance sensors distinguish a dark line from a light surface. Normalized sensor values provide a weighted line position. A controller converts line error into a difference between left and right wheel commands; motor and sensor feedback continually adjust the trajectory. The simulator models a synthetic curved track and a lost-line state.", parts: ["Chassis plates", "Microcontroller", "L298N-style motor driver", "DC gear motors", "Wheels", "IR reflectance array", "Battery", "5 V regulator", "Status LEDs"], steps: [["Detect surface", "Measure reflected IR intensity."], ["Normalize", "Convert sensor readings into line evidence."], ["Estimate position", "Use a weighted average across five sensors."], ["Decide", "Calculate steering from position error."], ["Adjust wheels", "Motor driver changes left and right demand."], ["Repeat", "Feedback keeps correcting the track position."]], architecture: { inputs: ["Five IR reflectance sensors", "Black / white surface", "Speed / controller setting"], processing: ["Normalization", "Weighted line position", "Proportional steering", "Dual motor driver"], outputs: ["Left wheel speed", "Right wheel speed", "Line-following motion"] }, controls: "speed:Base motor command:120:20:220:5:PWM|gain:Steering gain:50:0:100:1:\xD7|offset:Initial lateral offset:0:-1:1:0.05:normalized|contrast:Surface contrast:90:0:100:5:%", modes: ["Curvy Track", "Straight Track", "Lost Line"], applications: ["Industrial AGVs", "Warehouse transport", "Educational robots", "Service robots", "Autonomous cleaning", "Smart agriculture"], safety: ["Low contrast can invalidate the position estimate.", "Lost-line mode stops the virtual motors.", "PWM values are teaching motor commands."], quiz: ["What does the weighted sensor average estimate?", "The line position across the array", "The battery chemistry", "The Wi-Fi channel"], source: "https://www.pololu.com/docs/0J19/all" }
];

// src/studios/how-devices-work/advanced/marine-data.ts
var acoustics = "https://oceanservice.noaa.gov/facts/sound.html";
var MARINE_DEFINITIONS = [
  { number: 95, id: "defence/biometric-access-system", mockup: "095 - Biometric Access System.png", theme: "light", family: "biometric-access", subtitle: "Real Hardware. Real Security. A Smarter, Safer Tomorrow.", principle: "A camera, fingerprint reader or RFID reader captures a credential. Preprocessing and feature extraction produce a template, which is compared with enrolled references. Policy checks determine access; a relay drives the door lock and the event is logged. This lab compares synthetic match scores only and collects no biometric data.", parts: ["Camera module", "IR illuminator", "Fingerprint sensor", "ARM processor", "Flash memory", "Secure element", "Lock relay", "Wi-Fi / Ethernet", "12 V supply", "Backup battery", "Tamper switch", "Speaker / buzzer"], steps: [["Present credential", "Choose a synthetic fingerprint, face or card."], ["Capture and process", "Extract a numerical teaching template."], ["Match", "Compare the template with the enrolled reference."], ["Decision", "Apply the threshold and credential policy."], ["Unlock and log", "Pulse the virtual relay and record the decision locally."]], architecture: { inputs: ["Fingerprint", "Face camera", "RFID card", "Exit button"], processing: ["Feature extraction", "Template comparison", "MCU / policy", "Secure element / memory"], outputs: ["Door relay", "Buzzer / LED", "Event record", "Network interface"] }, controls: "similarity:Template similarity:92:0:100:1:%|threshold:Match threshold:80:50:99:1:%|quality:Capture quality:90:0:100:1:%", modes: ["Fingerprint", "Face", "RFID Card", "System Control"], applications: ["Schools & universities", "Corporate offices", "Factories", "Residential buildings", "Data centres", "Hospitals"], safety: ["Synthetic credentials stay local.", "A match score is not a real biometric probability.", "Low-quality capture must be retried."], quiz: ["What should determine unlocking?", "A valid match and authorization policy", "Any captured image", "Only network connectivity"], source: "https://pages.nist.gov/800-63-4/sp800-63b.html" },
  { number: 96, id: "defence/sonar-detection-system", mockup: "096 - Sonar Detection System.png", theme: "light", family: "sonar-detection", subtitle: "Sound for a Safer, Deeper World", principle: "Active sonar emits a pulse through a projector and receives target echoes on a hydrophone array. A low-noise amplifier, filter and ADC supply DSP beamforming and detection. Range is sound speed times round-trip delay divided by two. Passive sonar listens to sound sources without transmitting; it does not directly measure pulse round-trip range.", parts: ["Protective dome", "Hydrophone array", "Projector", "Preamplifier", "Band-pass filter", "ADC", "DSP / beamformer", "Power supply", "Navigation interface", "Display console"], steps: [["Transmit", "The projector emits a virtual acoustic pulse."], ["Propagate", "Sound travels through water."], ["Reflect", "Targets return a portion of the pulse."], ["Receive", "Hydrophones convert sound pressure into voltage."], ["Amplify and filter", "Condition the weak echo."], ["Digitize", "ADC samples preserve the receive waveform."], ["Detect", "DSP estimates target delay and bearing."], ["Display", "Show synthetic targets and their quality."]], architecture: { inputs: ["Projector trigger", "Hydrophone echoes", "GPS / INS reference"], processing: ["LNA / band-pass filter", "ADC", "DSP / beamforming", "Time-of-flight detection"], outputs: ["Target range / bearing", "Display console", "Detection quality"] }, controls: "frequency:Frequency:25:5:100:5:kHz|pulse:Pulse length:10:1:50:1:ms|range:Display range:2000:500:5000:500:m|gain:Receiver gain:30:0:60:1:dB", modes: ["Active Sonar", "Passive Sonar"], applications: ["Naval detection", "Ocean exploration", "Underwater navigation", "Search & rescue"], safety: ["All acoustic signals are synthetic.", "Passive mode has no direct pulse range.", "Sound speed varies with ocean conditions."], quiz: ["How does active sonar measure range?", "From round-trip acoustic delay", "From screen brightness alone", "From antenna voltage"], source: acoustics },
  { number: 97, id: "defence/unmanned-surveillance-vehicle-electronics", mockup: "097 - Unmanned Surveillance Vehicle Electronics.png", theme: "light", family: "surveillance-uav", subtitle: "Integrated sensors, intelligent electronics and secure communications for real-time situational awareness.", principle: "EO and thermal cameras feed an onboard computer for image processing and storage. GNSS, IMU and obstacle sensors support guidance; a dedicated flight controller stabilizes the airframe and commands ESCs. Telemetry carries synthetic status to a ground display. The reduced model shows wind disturbance, altitude response, speed and battery demand.", parts: ["EO gimbal camera", "Thermal camera", "GNSS module", "IMU", "Obstacle sensors", "Onboard computer", "Flight controller", "Telemetry radio", "SSD", "Power distribution board", "Battery management", "LiPo battery"], steps: [["Sense", "Cameras, IMU, GNSS and proximity sensors acquire data."], ["Capture", "Interfaces digitize and timestamp the streams."], ["Process", "Onboard computing fuses measurements and prepares video."], ["Communicate", "Telemetry conveys status and compressed streams."], ["Monitor", "The operator views images and vehicle state."], ["Control", "Guidance sends targets to the flight controller."], ["Maintain safety", "Reduced return-home and obstacle states illustrate supervisory control."]], architecture: { inputs: ["EO / thermal camera", "GNSS / IMU", "Obstacle sensors", "Battery sensors"], processing: ["Onboard computer", "Sensor fusion / video", "Flight-controller stabilization", "Telemetry framing"], outputs: ["Motor ESC commands", "Ground-station video", "Navigation state", "Stored data / alerts"] }, controls: "wind:Wind speed:5:0:20:1:m/s|altitude:Target altitude:100:10:200:5:m|speed:Flight speed:5:0:15:0.5:m/s", modes: ["EO (Day)", "Thermal", "Split View", "Return Home"], applications: ["Border & perimeter observation", "Search & rescue", "Disaster assessment", "Infrastructure inspection", "Environmental monitoring", "Event safety"], safety: ["Unarmed synthetic platform.", "The flight response is a reduced teaching model.", "No real aircraft commands are issued."], quiz: ["Which unit stabilizes attitude?", "The flight controller with IMU feedback", "The video storage drive", "The camera display alone"], source: "https://docs.px4.io/main/en/flight_stack/controller_diagrams.html" },
  { number: 98, id: "marine/marine-radar", mockup: "098 - Marine Radar.png", theme: "light", family: "marine-radar", subtitle: "See Further. Navigate Safer.", principle: "A rotating scanner emits microwave pulses through a duplexer. Returning echoes pass through a low-noise receiver, mixer, IF filter and ADC before DSP maps range and bearing onto a PPI. Sea-clutter suppression attenuates near-range returns; rain-clutter filtering reduces broad weather echoes but can also weaken targets.", parts: ["Scanner antenna", "Radome", "Pedestal", "Drive motor", "Rotary joint", "Waveguide", "RF transmitter", "Duplexer", "LNA / mixer", "ADC / DSP", "Heading / GPS interface", "Display"], steps: [["Transmit pulse", "Timing logic triggers the RF source."], ["Reflect", "Land, vessels and buoys return echoes."], ["Receive", "The duplexer routes echoes to the receiver."], ["Process", "Mix, filter, digitize and detect returns."], ["Calculate range / bearing", "Use pulse delay and scanner angle."], ["Display", "Plot echoes with range rings and heading reference."]], architecture: { inputs: ["Timing control", "Antenna echoes", "Heading / GPS"], processing: ["Modulator / PA", "Duplexer", "LNA / mixer / IF", "ADC / target DSP"], outputs: ["PPI range / bearing", "Vessel echoes", "Land / buoy echoes"] }, controls: "range:Range:6:1:24:1:NM|gain:Gain:72:0:100:1:%|sea:Sea clutter (STC):40:0:100:1:%|rain:Rain clutter (FTC):20:0:100:1:%|tuning:Tuning offset:0:-5:5:0.5:MHz", modes: ["Head-Up", "North-Up"], applications: ["Collision avoidance", "Low-visibility navigation", "Coastal approach", "Search & rescue", "Situational awareness"], safety: ["Synthetic radar returns only.", "High clutter suppression may hide small targets.", "Navigation requires multiple sources of information."], quiz: ["What supplies pulse-radar range?", "Round-trip radio delay", "Antenna rotation speed alone", "Display colour"], source: "https://www.furuno.com/en/technology/radar/basic/" },
  { number: 99, id: "marine/fish-finder", mockup: "099 - Fish Finder.png", theme: "light", family: "fish-finder", subtitle: "See Beneath the Surface", principle: "The pulser drives a downward acoustic transducer. Fish and seabed echoes return at different delays and strengths. A protected low-noise receiver, filter and ADC feed DSP, which plots an echogram over successive pings. Frequency affects wavelength and absorption; pulse duration sets an approximate c\u03C4/2 range resolution.", parts: ["Display head", "Cable", "Sonar transducer", "Power supply", "Pulser", "T/R protection", "Receiver / filter", "ADC", "DSP processor", "Display interface"], steps: [["Transmit pulse", "Drive the transducer with a short electrical pulse."], ["Propagate", "Sound travels through water."], ["Echo", "Fish and seabed reflect sound."], ["Receive", "The transducer detects returning sound."], ["Amplify / filter", "Condition and select the echo band."], ["Digitize", "Sample the acoustic return."], ["Process", "Estimate depths and echo strength."], ["Display", "Append the new ping to the scrolling echogram."]], architecture: { inputs: ["Transmit trigger", "Fish / seabed echoes"], processing: ["Pulser / transducer", "T/R switch", "Receiver / filter", "ADC / DSP"], outputs: ["Depth", "Fish returns", "Echogram history"] }, controls: "frequency:Frequency:200:50:200:10:kHz|pulse:Pulse length:50:10:200:10:\xB5s|gain:Gain:40:0:60:1:dB|depth:Water depth:50:5:150:1:m|strength:Fish target strength:60:0:100:1:%", modes: ["Conventional sonar", "CHIRP illustration"], applications: ["Recreational fishing", "Commercial fishing", "Marine research", "Underwater mapping", "Aquaculture", "Search & rescue"], safety: ["Echo colours are synthetic relative strength.", "Fish arches depend on motion through the beam.", "Temperature and salinity affect sound speed."], quiz: ["Why does the bottom echo arrive later than shallow fish?", "Its acoustic path is longer", "Its light is dimmer", "Its ADC samples are slower"], source: acoustics },
  { number: 100, id: "marine/depth-sounder", mockup: "100 - Depth Sounder.png", theme: "light", family: "depth-sounder", subtitle: "Explore how underwater depth is measured using sound", principle: "An echo sounder emits an acoustic pulse and measures its round-trip travel time to the seabed. Depth is c \xD7 time / 2. This simulation separates actual water sound speed from the receiver calibration so that a mismatched speed produces a proportional depth error.", parts: ["Display unit", "Through-hull transducer", "DC power converter", "High-voltage pulser", "T/R protection", "Low-noise receiver", "Amplifier / filter", "ADC", "Timing / MCU / DSP", "Display interface"], steps: [["Transmit", "Send a short virtual drive pulse."], ["Convert", "The transducer produces sound pressure."], ["Reflect", "The seabed returns an echo."], ["Receive", "The transducer converts the echo to voltage."], ["Condition", "Amplify, filter and digitize."], ["Measure delay", "Estimate round-trip echo time."], ["Calculate depth", "Multiply delay by calibrated sound speed / 2."], ["Display", "Show depth and the synthetic seabed profile."]], architecture: { inputs: ["Transducer echo", "Calibration sound speed"], processing: ["Pulser / T-R switch", "Receiver / amplifier", "ADC", "MCU timing calculation"], outputs: ["Depth reading", "Seabed echogram"] }, controls: "depth:Water depth:28:1:200:1:m|sound:Sound speed calibration:1500:1400:1600:5:m/s", modes: ["Seawater 1500 m/s", "Freshwater 1480 m/s"], applications: ["Navigation", "Fishing", "Hydrographic survey", "Marine research"], safety: ["Calibration affects measured depth.", "The synthetic profile is not a navigation chart.", "Transducer mounting offset matters on a real vessel."], quiz: ["What happens with an excessive sound-speed calibration?", "Calculated depth is too large", "Calculated depth becomes zero", "Echo time increases automatically"], source: acoustics },
  { number: 101, id: "marine/gps-chartplotter", mockup: "101 - GPS Chartplotter.png", theme: "light", family: "chartplotter", subtitle: "Navigate \xB7 Explore \xB7 Understand", principle: "A GNSS receiver estimates position, velocity and time. The navigation processor overlays the solution on a stored digital chart, calculates waypoint bearing and distance, and exchanges data through NMEA interfaces. The chart and route in this lab are synthetic; waypoints can be edited locally.", parts: ["Touch display", "Chart storage / SD", "GNSS antenna", "RF front end", "Navigation processor", "Flash memory", "Power management", "NMEA 0183", "NMEA 2000", "Ethernet", "Sonar interface"], steps: [["Receive signals", "The antenna collects GNSS radio signals."], ["Calculate position", "Correlate codes and solve position / clock."], ["Load charts", "Retrieve local chart data."], ["Overlay", "Plot own position and depth reference."], ["Plan route", "Create waypoints and calculate legs."], ["Navigate", "Update distance, bearing and route progress."]], architecture: { inputs: ["GNSS antenna", "NMEA data", "Sonar / depth", "Waypoint input"], processing: ["RF acquisition", "GNSS / MCU", "Chart database", "Route calculation"], outputs: ["Chart display", "Position / COG / SOG", "Waypoint guidance", "NMEA messages"] }, controls: "speed:Speed over ground:6.8:0:20:0.2:kn|course:Course over ground:123:0:359:1:\xB0|noise:Position noise:2:0:30:1:m", modes: ["Chart", "Satellite illustration", "Simulation"], applications: ["Recreational boating", "Fishing", "Sailing", "Commercial marine", "Search & rescue", "Education"], safety: ["Charts and waypoints are synthetic.", "GNSS does not replace lookout or sound seamanship.", "Routes remain local to this teaching page."], quiz: ["What does the chart processor combine?", "GNSS position and stored chart information", "Only battery voltage", "Only sonar amplitude"], source: "https://www.gps.gov/systems/gps/" },
  { number: 102, id: "marine/ais", mockup: "102 - Automatic Identification System - AIS.png", theme: "light", family: "marine-ais", subtitle: "Track Vessels \xB7 Enhance Safety \xB7 A Safer Sea for Everyone", principle: "AIS combines GNSS position/time with vessel identity and motion data. An encoder frames digital messages and a VHF transceiver sends and receives them on AIS channels, while the display and NMEA interfaces present nearby vessels. This lab animates synthetic reports and never transmits radio messages.", parts: ["VHF antenna", "GPS antenna", "RF front end", "VHF transceiver", "Baseband modem", "AIS encoder / decoder", "Processor", "Display", "NMEA ports", "Power supply"], steps: [["Acquire", "Collect synthetic position, time and vessel identity."], ["Format", "Create a teaching vessel report."], ["Transmit", "Illustrate a VHF broadcast slot."], ["Receive", "Update synthetic nearby-vessel reports."], ["Decode", "Extract motion and identity fields."], ["Display", "Plot targets and selected-vessel details."]], architecture: { inputs: ["GPS position / time", "Vessel identity", "NMEA motion data"], processing: ["AIS encoder / decoder", "GMSK baseband", "VHF transceiver", "Report ageing"], outputs: ["Nearby-vessel display", "VHF message illustration", "NMEA interfaces"] }, controls: "speed:Vessel speed:10:0:30:0.5:kn|course:Course:45:0:359:1:\xB0|interval:Update interval:10:2:30:1:s", modes: ["Training Ship", "Cargo Ship", "Sailing Vessel"], applications: ["Collision awareness", "Vessel traffic services", "Search & rescue", "Port management", "Environmental monitoring", "ECDIS / radar integration"], safety: ["All vessel identities are synthetic.", "No operational AIS transmission occurs.", "AIS reports may age or be absent."], quiz: ["Where does AIS obtain position and time?", "GNSS and onboard navigation data", "The audio speaker", "A magnetic lock"], source: "https://www.navcen.uscg.gov/automatic-identification-system-overview" },
  { number: 103, id: "marine/marine-autopilot", mockup: "103 - Marine Autopilot.png", theme: "light", family: "marine-autopilot", subtitle: "Hold Course. Go Further.", principle: "The controller compares desired heading with compass feedback. A reduced PID steering law commands a bounded rudder actuator; rudder feedback and vessel yaw dynamics close the loop. Wind/wave disturbances perturb heading, while speed affects rudder authority. This is a simulated control loop without real vessel commands.", parts: ["Control head", "Heading sensor", "GNSS antenna", "Rudder-angle sensor", "Autopilot MCU", "NMEA interface", "DC power supply", "H-bridge driver", "Hydraulic pump", "Rudder"], steps: [["Set heading", "Choose the desired course."], ["Measure state", "Read heading and rudder feedback."], ["Compute error", "Wrap heading error to the shortest turn."], ["Drive actuator", "Bound the controller rudder command."], ["Correct course", "Vessel yaw responds to rudder and disturbance."], ["Maintain", "Feedback continually reduces heading error."]], architecture: { inputs: ["Desired heading", "Compass heading", "Rudder feedback", "GNSS / speed"], processing: ["PID control law", "Actuator limits", "H-bridge / pump", "Vessel yaw dynamics"], outputs: ["Rudder command", "Actual heading", "Cross-track illustration"] }, controls: "heading:Desired heading:238:0:359:1:\xB0|speed:Boat speed:8:0:20:0.5:kn", modes: ["Calm (0\u20130.5 m)", "Moderate waves", "Rough sea", "Standby"], applications: ["Long-distance cruising", "Fishing operations", "Commercial shipping", "Research vessels", "Unmanned surface vehicles"], safety: ["Reduced teaching dynamics only.", "Standby removes automatic rudder demand.", "Real autopilots require operator supervision."], quiz: ["What closes the autopilot control loop?", "Heading and rudder feedback", "The chart colour", "The vessel name"], source: "https://www.simrad-yachting.com/en-us/simrad/type/autopilots/" },
  { number: 104, id: "marine/electronic-compass", mockup: "104 - Electronic Compass.png", theme: "light", family: "marine-compass", subtitle: "Sense the Earth. Find Your Heading. Navigate with Confidence.", principle: "A three-axis magnetometer measures the local field and accelerometers estimate tilt. Calibration removes a synthetic hard-iron offset before tilt compensation and atan2 heading calculation. The MCU sends heading to displays and NMEA interfaces. This marine sensor page is independent of the handheld Lab 92.", parts: ["Weatherproof radome", "Mounting base", "Cable outlet", "Magnetometer", "Accelerometer / tilt sensor", "Processing MCU", "Calibration EEPROM", "Power regulator", "NMEA 2000 transceiver", "NMEA 0183 interface"], steps: [["Sense field", "Acquire three-axis magnetic measurements."], ["Measure tilt", "Estimate vessel pitch and roll."], ["Fuse / filter", "Combine the reduced sensor measurements."], ["Calculate heading", "Compensate tilt before atan2."], ["Calibrate", "Remove the selected hard-iron offset."], ["Output", "Present heading and an illustrative NMEA sentence."]], architecture: { inputs: ["Magnetic field X / Y / Z", "Pitch / roll", "Calibration memory"], processing: ["Sensor interfaces", "Offset correction", "Tilt compensation", "MCU heading calculation"], outputs: ["Heading display", "NMEA 2000 / 0183", "Navigation systems"] }, controls: "yaw:Vessel heading:273.5:0:359.5:0.5:\xB0|pitch:Pitch:2:-30:30:0.5:\xB0|roll:Roll:-1.5:-30:30:0.5:\xB0", modes: ["None", "Hard-iron disturbance", "Calibrated disturbance", "Uncompensated tilt"], applications: ["Yachts & pleasure boats", "Commercial vessels", "Naval vessels", "Offshore workboats"], safety: ["Nearby metal can distort magnetic heading.", "Magnetic and true heading differ by declination.", "NMEA text is a local teaching example."], quiz: ["Why measure pitch and roll?", "To compensate magnetic heading for tilt", "To increase GPS satellite count", "To set the radar frequency"], source: "https://www.simrad-yachting.com/en-au/simradcommercial/autopilots/precision-9-compass3/" }
];

// src/studios/how-devices-work/catalogue.ts
var STUDIO_PATH = "/studios/how-devices-work";
var devicePath = (device) => `${STUDIO_PATH}/${device.category}/${device.slug}`;
var DEVICES = [
  {
    "id": "medical/digital-thermometer",
    "slug": "digital-thermometer",
    "name": "Digital Thermometer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Convert temperature-dependent sensor readings into a calibrated digital measurement.",
    "longDescription": "Convert temperature-dependent sensor readings into a calibrated digital measurement. The Digital Thermometer signal path begins with temperature and leads to display. Between these endpoints, thermistor, signal conditioning, adc, calibration mcu connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-digital-thermometer.svg",
    "status": "available",
    "keywords": [
      "temperature",
      "thermometer",
      "temperature",
      "thermistor",
      "signal conditioning",
      "adc",
      "calibration mcu",
      "display"
    ],
    "signalFlow": [
      "Temperature",
      "Thermistor",
      "Signal conditioning",
      "ADC",
      "Calibration MCU",
      "Display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/infrared-thermometer",
    "slug": "infrared-thermometer",
    "name": "Infrared Thermometer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Measure emitted infrared energy and compensate for ambient temperature to estimate surface temperature.",
    "longDescription": "Measure emitted infrared energy and compensate for ambient temperature to estimate surface temperature. The Infrared Thermometer signal path begins with infrared radiation and leads to display. Between these endpoints, thermopile, amplifier, adc, temperature compensation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-infrared-thermometer.svg",
    "status": "available",
    "keywords": [
      "infrared-temperature",
      "ir-thermometer",
      "infrared radiation",
      "thermopile",
      "amplifier",
      "adc",
      "temperature compensation",
      "display"
    ],
    "signalFlow": [
      "Infrared radiation",
      "Thermopile",
      "Amplifier",
      "ADC",
      "Temperature compensation",
      "Display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/pulse-oximeter",
    "slug": "pulse-oximeter",
    "name": "Pulse Oximeter",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Compare red and infrared light absorption to estimate blood oxygen saturation and pulse rate.",
    "longDescription": "Compare red and infrared light absorption to estimate blood oxygen saturation and pulse rate. The Pulse Oximeter signal path begins with red / ir leds and leads to spo\u2082 display. Between these endpoints, finger tissue, photodiode, analog front end, adc / ratio processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-pulse-oximeter.svg",
    "status": "available",
    "keywords": [
      "oxygen",
      "oximeter",
      "red / ir leds",
      "finger tissue",
      "photodiode",
      "analog front end",
      "adc / ratio processing",
      "spo\u2082 display"
    ],
    "signalFlow": [
      "Red / IR LEDs",
      "Finger tissue",
      "Photodiode",
      "Analog front end",
      "ADC / ratio processing",
      "SpO\u2082 display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/digital-blood-pressure-monitor",
    "slug": "digital-blood-pressure-monitor",
    "name": "Digital Blood Pressure Monitor",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Track pressure oscillations in an inflatable cuff to estimate systolic and diastolic blood pressure.",
    "longDescription": "Track pressure oscillations in an inflatable cuff to estimate systolic and diastolic blood pressure. The Digital Blood Pressure Monitor signal path begins with cuff inflation and leads to bp display. Between these endpoints, pressure sensor, amplifier, adc, oscillometric algorithm connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-digital-blood-pressure-monitor.svg",
    "status": "available",
    "keywords": [
      "pressure",
      "pressure",
      "cuff inflation",
      "pressure sensor",
      "amplifier",
      "adc",
      "oscillometric algorithm",
      "bp display"
    ],
    "signalFlow": [
      "Cuff inflation",
      "Pressure sensor",
      "Amplifier",
      "ADC",
      "Oscillometric algorithm",
      "BP display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/digital-stethoscope",
    "slug": "digital-stethoscope",
    "name": "Digital Stethoscope",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Capture body sounds and filter or amplify them for listening and recording.",
    "longDescription": "Capture body sounds and filter or amplify them for listening and recording. The Digital Stethoscope signal path begins with body sounds and leads to headphones / recording. Between these endpoints, chest-piece microphone, low-noise amplifier, adc, audio filtering connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-digital-stethoscope.svg",
    "status": "available",
    "keywords": [
      "audio",
      "stethoscope",
      "body sounds",
      "chest-piece microphone",
      "low-noise amplifier",
      "adc",
      "audio filtering",
      "headphones / recording"
    ],
    "signalFlow": [
      "Body sounds",
      "Chest-piece microphone",
      "Low-noise amplifier",
      "ADC",
      "Audio filtering",
      "Headphones / recording"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/glucometer",
    "slug": "glucometer",
    "name": "Glucometer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Measure an electrochemical reaction on a test strip and convert current into a glucose estimate.",
    "longDescription": "Measure an electrochemical reaction on a test strip and convert current into a glucose estimate. The Glucometer signal path begins with blood sample and leads to glucose display. Between these endpoints, enzyme test strip, current amplifier, adc, calibration processor connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-glucometer.svg",
    "status": "available",
    "keywords": [
      "glucose",
      "meter",
      "blood sample",
      "enzyme test strip",
      "current amplifier",
      "adc",
      "calibration processor",
      "glucose display"
    ],
    "signalFlow": [
      "Blood sample",
      "Enzyme test strip",
      "Current amplifier",
      "ADC",
      "Calibration processor",
      "Glucose display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/digital-weighing-scale",
    "slug": "digital-weighing-scale",
    "name": "Digital Weighing Scale",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Convert strain in load cells into a calibrated digital weight reading.",
    "longDescription": "Convert strain in load cells into a calibrated digital weight reading. The Digital Weighing Scale signal path begins with applied force and leads to weight display. Between these endpoints, load cell bridge, instrumentation amplifier, adc, calibration mcu connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-digital-weighing-scale.svg",
    "status": "available",
    "keywords": [
      "weight",
      "scale",
      "applied force",
      "load cell bridge",
      "instrumentation amplifier",
      "adc",
      "calibration mcu",
      "weight display"
    ],
    "signalFlow": [
      "Applied force",
      "Load cell bridge",
      "Instrumentation amplifier",
      "ADC",
      "Calibration MCU",
      "Weight display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/body-composition-analyzer",
    "slug": "body-composition-analyzer",
    "name": "Body Composition Analyzer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Combine weight measurements with electrical impedance to estimate body composition.",
    "longDescription": "Combine weight measurements with electrical impedance to estimate body composition. The Body Composition Analyzer signal path begins with low-level ac excitation and leads to display. Between these endpoints, body impedance, voltage / current sensing, adc, composition model connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-body-composition-analyzer.svg",
    "status": "available",
    "keywords": [
      "composition",
      "scale",
      "low-level ac excitation",
      "body impedance",
      "voltage / current sensing",
      "adc",
      "composition model",
      "display"
    ],
    "signalFlow": [
      "Low-level AC excitation",
      "Body impedance",
      "Voltage / current sensing",
      "ADC",
      "Composition model",
      "Display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/electronic-spirometer",
    "slug": "electronic-spirometer",
    "name": "Electronic Spirometer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Measure airflow and integrate sampled flow to estimate respiratory volumes.",
    "longDescription": "Measure airflow and integrate sampled flow to estimate respiratory volumes. The Electronic Spirometer signal path begins with exhaled airflow and leads to respiratory graph. Between these endpoints, flow transducer, signal conditioning, adc, flow / volume calculation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-electronic-spirometer.svg",
    "status": "available",
    "keywords": [
      "breath",
      "breath",
      "exhaled airflow",
      "flow transducer",
      "signal conditioning",
      "adc",
      "flow / volume calculation",
      "respiratory graph"
    ],
    "signalFlow": [
      "Exhaled airflow",
      "Flow transducer",
      "Signal conditioning",
      "ADC",
      "Flow / volume calculation",
      "Respiratory graph"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/peak-flow-meter",
    "slug": "peak-flow-meter",
    "name": "Peak Flow Meter",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Measure the maximum airflow reached during an exhalation and display the peak reading.",
    "longDescription": "Measure the maximum airflow reached during an exhalation and display the peak reading. The Peak Flow Meter signal path begins with exhaled airflow and leads to flow reading. Between these endpoints, flow sensor, signal conditioning, sampling, peak detection connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-peak-flow-meter.svg",
    "status": "available",
    "keywords": [
      "breath",
      "breath",
      "exhaled airflow",
      "flow sensor",
      "signal conditioning",
      "sampling",
      "peak detection",
      "flow reading"
    ],
    "signalFlow": [
      "Exhaled airflow",
      "Flow sensor",
      "Signal conditioning",
      "Sampling",
      "Peak detection",
      "Flow reading"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/ecg",
    "slug": "ecg",
    "name": "ECG Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Recover tiny electrical signals from electrodes and turn them into a readable cardiac waveform.",
    "longDescription": "Recover tiny electrical signals from electrodes and turn them into a readable cardiac waveform. The ECG Machine signal path begins with electrodes and leads to ecg display. Between these endpoints, instrumentation amplifier, noise filtering, adc, dsp / mcu connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-ecg.svg",
    "status": "available",
    "keywords": [
      "ecg",
      "ecg",
      "electrodes",
      "instrumentation amplifier",
      "noise filtering",
      "adc",
      "dsp / mcu",
      "ecg display"
    ],
    "signalFlow": [
      "Electrodes",
      "Instrumentation amplifier",
      "Noise filtering",
      "ADC",
      "DSP / MCU",
      "ECG display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/portable-ecg",
    "slug": "portable-ecg",
    "name": "Portable ECG",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Capture cardiac electrode signals in a compact recorder and transfer the waveform for review.",
    "longDescription": "Capture cardiac electrode signals in a compact recorder and transfer the waveform for review. The Portable ECG signal path begins with electrodes and leads to wireless waveform transfer. Between these endpoints, low-noise front end, filter / adc, ecg processor, local storage connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-portable-ecg.svg",
    "status": "available",
    "keywords": [
      "ecg",
      "portable-ecg",
      "electrodes",
      "low-noise front end",
      "filter / adc",
      "ecg processor",
      "local storage",
      "wireless waveform transfer"
    ],
    "signalFlow": [
      "Electrodes",
      "Low-noise front end",
      "Filter / ADC",
      "ECG processor",
      "Local storage",
      "Wireless waveform transfer"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/holter-monitor",
    "slug": "holter-monitor",
    "name": "Holter Monitor",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Record cardiac electrical activity continuously in a wearable device for later review.",
    "longDescription": "Record cardiac electrical activity continuously in a wearable device for later review. The Holter Monitor signal path begins with chest electrodes and leads to ecg review software. Between these endpoints, isolated front end, filter / adc, timestamping, nonvolatile storage connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-holter-monitor.svg",
    "status": "available",
    "keywords": [
      "ecg",
      "holter",
      "chest electrodes",
      "isolated front end",
      "filter / adc",
      "timestamping",
      "nonvolatile storage",
      "ecg review software"
    ],
    "signalFlow": [
      "Chest electrodes",
      "Isolated front end",
      "Filter / ADC",
      "Timestamping",
      "Nonvolatile storage",
      "ECG review software"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/heart-rate-monitor",
    "slug": "heart-rate-monitor",
    "name": "Heart Rate Monitor",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Track pulse-related changes in reflected light to calculate heart rate.",
    "longDescription": "Track pulse-related changes in reflected light to calculate heart rate. The Heart Rate Monitor signal path begins with led illumination and leads to heart-rate display. Between these endpoints, tissue reflection, photodiode, adc, pulse detection connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-heart-rate-monitor.svg",
    "status": "available",
    "keywords": [
      "pulse",
      "watch",
      "led illumination",
      "tissue reflection",
      "photodiode",
      "adc",
      "pulse detection",
      "heart-rate display"
    ],
    "signalFlow": [
      "LED illumination",
      "Tissue reflection",
      "Photodiode",
      "ADC",
      "Pulse detection",
      "Heart-rate display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/icu-patient-monitor",
    "slug": "icu-patient-monitor",
    "name": "ICU Patient Monitor",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Combine physiological measurements into synchronized waveforms, vital signs and alarm indicators.",
    "longDescription": "Combine physiological measurements into synchronized waveforms, vital signs and alarm indicators. The ICU Patient Monitor signal path begins with patient sensors and leads to patient display. Between these endpoints, isolated analog front ends, filtering / adc, vital-sign processing, alarm logic connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-icu-patient-monitor.svg",
    "status": "available",
    "keywords": [
      "patient",
      "ecg",
      "patient sensors",
      "isolated analog front ends",
      "filtering / adc",
      "vital-sign processing",
      "alarm logic",
      "patient display"
    ],
    "signalFlow": [
      "Patient sensors",
      "Isolated analog front ends",
      "Filtering / ADC",
      "Vital-sign processing",
      "Alarm logic",
      "Patient display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/defibrillator",
    "slug": "defibrillator",
    "name": "Defibrillator",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Analyze cardiac rhythm and supervise a controlled energy-delivery subsystem.",
    "longDescription": "Analyze cardiac rhythm and supervise a controlled energy-delivery subsystem. The Defibrillator signal path begins with ecg electrodes and leads to status / event log. Between these endpoints, isolated acquisition, rhythm analysis, safety checks, energy-control subsystem connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-defibrillator.svg",
    "status": "available",
    "keywords": [
      "defibrillator",
      "defibrillator",
      "ecg electrodes",
      "isolated acquisition",
      "rhythm analysis",
      "safety checks",
      "energy-control subsystem",
      "status / event log"
    ],
    "signalFlow": [
      "ECG electrodes",
      "Isolated acquisition",
      "Rhythm analysis",
      "Safety checks",
      "Energy-control subsystem",
      "Status / event log"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/aed",
    "slug": "aed",
    "name": "AED",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Analyze an acquired cardiac rhythm and guide a supervised emergency response through prompts.",
    "longDescription": "Analyze an acquired cardiac rhythm and guide a supervised emergency response through prompts. The AED signal path begins with ecg pads and leads to voice / visual prompts. Between these endpoints, isolated acquisition, rhythm classification, safety interlocks, therapy supervision connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-aed.svg",
    "status": "available",
    "keywords": [
      "defibrillator",
      "defibrillator",
      "ecg pads",
      "isolated acquisition",
      "rhythm classification",
      "safety interlocks",
      "therapy supervision",
      "voice / visual prompts"
    ],
    "signalFlow": [
      "ECG pads",
      "Isolated acquisition",
      "Rhythm classification",
      "Safety interlocks",
      "Therapy supervision",
      "Voice / visual prompts"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/pacemaker",
    "slug": "pacemaker",
    "name": "Pacemaker",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Sense cardiac activity and use timed control logic to coordinate prescribed electrical therapy.",
    "longDescription": "Sense cardiac activity and use timed control logic to coordinate prescribed electrical therapy. The Pacemaker signal path begins with cardiac electrodes and leads to telemetry. Between these endpoints, sensing amplifier, event detection, timing / therapy logic, output stage connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-pacemaker.svg",
    "status": "available",
    "keywords": [
      "implant",
      "implant",
      "cardiac electrodes",
      "sensing amplifier",
      "event detection",
      "timing / therapy logic",
      "output stage",
      "telemetry"
    ],
    "signalFlow": [
      "Cardiac electrodes",
      "Sensing amplifier",
      "Event detection",
      "Timing / therapy logic",
      "Output stage",
      "Telemetry"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/implantable-cardioverter-defibrillator",
    "slug": "implantable-cardioverter-defibrillator",
    "name": "Implantable Cardioverter Defibrillator",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Monitor cardiac rhythm and coordinate programmed pacing or defibrillation through implanted electronics.",
    "longDescription": "Monitor cardiac rhythm and coordinate programmed pacing or defibrillation through implanted electronics. The Implantable Cardioverter Defibrillator signal path begins with implanted leads and leads to telemetry. Between these endpoints, sensing front end, rhythm detection, therapy decision logic, pacing / energy stage connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-implantable-cardioverter-defibrillator.svg",
    "status": "available",
    "keywords": [
      "implant",
      "implant",
      "implanted leads",
      "sensing front end",
      "rhythm detection",
      "therapy decision logic",
      "pacing / energy stage",
      "telemetry"
    ],
    "signalFlow": [
      "Implanted leads",
      "Sensing front end",
      "Rhythm detection",
      "Therapy decision logic",
      "Pacing / energy stage",
      "Telemetry"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/fetal-heart-monitor",
    "slug": "fetal-heart-monitor",
    "name": "Fetal Heart Monitor",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Use reflected ultrasound to extract periodic motion and estimate fetal heart rate.",
    "longDescription": "Use reflected ultrasound to extract periodic motion and estimate fetal heart rate. The Fetal Heart Monitor signal path begins with ultrasound excitation and leads to audio / rate display. Between these endpoints, doppler probe, echo demodulation, sampling, heart-rate extraction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-fetal-heart-monitor.svg",
    "status": "available",
    "keywords": [
      "ultrasound",
      "ultrasound",
      "ultrasound excitation",
      "doppler probe",
      "echo demodulation",
      "sampling",
      "heart-rate extraction",
      "audio / rate display"
    ],
    "signalFlow": [
      "Ultrasound excitation",
      "Doppler probe",
      "Echo demodulation",
      "Sampling",
      "Heart-rate extraction",
      "Audio / rate display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/ultrasound-scanner",
    "slug": "ultrasound-scanner",
    "name": "Ultrasound Scanner",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Use timed acoustic pulses and returning echoes to reconstruct tissue structure or motion.",
    "longDescription": "Use timed acoustic pulses and returning echoes to reconstruct tissue structure or motion. The Ultrasound Scanner signal path begins with pulse generator and leads to ultrasound image. Between these endpoints, piezoelectric array, returning echoes, receive beamformer, signal processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-ultrasound-scanner.svg",
    "status": "available",
    "keywords": [
      "ultrasound",
      "ultrasound",
      "pulse generator",
      "piezoelectric array",
      "returning echoes",
      "receive beamformer",
      "signal processing",
      "ultrasound image"
    ],
    "signalFlow": [
      "Pulse generator",
      "Piezoelectric array",
      "Returning echoes",
      "Receive beamformer",
      "Signal processing",
      "Ultrasound image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/doppler-ultrasound",
    "slug": "doppler-ultrasound",
    "name": "Doppler Ultrasound",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Measure shifts in returning ultrasound frequency to estimate motion such as blood flow.",
    "longDescription": "Measure shifts in returning ultrasound frequency to estimate motion such as blood flow. The Doppler Ultrasound signal path begins with ultrasound pulse and leads to flow / spectral display. Between these endpoints, moving scatterers, echo receiver, i/q demodulation, doppler estimation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-doppler-ultrasound.svg",
    "status": "available",
    "keywords": [
      "ultrasound",
      "ultrasound",
      "ultrasound pulse",
      "moving scatterers",
      "echo receiver",
      "i/q demodulation",
      "doppler estimation",
      "flow / spectral display"
    ],
    "signalFlow": [
      "Ultrasound pulse",
      "Moving scatterers",
      "Echo receiver",
      "I/Q demodulation",
      "Doppler estimation",
      "Flow / spectral display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/x-ray-machine",
    "slug": "x-ray-machine",
    "name": "X-Ray Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Convert transmitted X-ray intensity into a digital projection image.",
    "longDescription": "Convert transmitted X-ray intensity into a digital projection image. The X-Ray Machine signal path begins with x-ray source and leads to projection image. Between these endpoints, patient attenuation, detector, readout / adc, image correction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-x-ray-machine.svg",
    "status": "available",
    "keywords": [
      "xray",
      "xray",
      "x-ray source",
      "patient attenuation",
      "detector",
      "readout / adc",
      "image correction",
      "projection image"
    ],
    "signalFlow": [
      "X-ray source",
      "Patient attenuation",
      "Detector",
      "Readout / ADC",
      "Image correction",
      "Projection image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/digital-radiography-detector",
    "slug": "digital-radiography-detector",
    "name": "Digital Radiography Detector",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Convert incident X-rays into electronic pixel measurements for digital radiography.",
    "longDescription": "Convert incident X-rays into electronic pixel measurements for digital radiography. The Digital Radiography Detector signal path begins with x-ray photons and leads to digital projection. Between these endpoints, scintillator / conversion layer, pixel array, readout electronics, adc / correction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-digital-radiography-detector.svg",
    "status": "available",
    "keywords": [
      "xray",
      "detector",
      "x-ray photons",
      "scintillator / conversion layer",
      "pixel array",
      "readout electronics",
      "adc / correction",
      "digital projection"
    ],
    "signalFlow": [
      "X-ray photons",
      "Scintillator / conversion layer",
      "Pixel array",
      "Readout electronics",
      "ADC / correction",
      "Digital projection"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/ct-scanner",
    "slug": "ct-scanner",
    "name": "CT Scanner",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Combine X-ray projections collected around the body into reconstructed cross-sectional images.",
    "longDescription": "Combine X-ray projections collected around the body into reconstructed cross-sectional images. The CT Scanner signal path begins with rotating x-ray source and leads to slice image. Between these endpoints, detector array, data acquisition, adc, tomographic reconstruction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-ct-scanner.svg",
    "status": "available",
    "keywords": [
      "ct",
      "ct",
      "rotating x-ray source",
      "detector array",
      "data acquisition",
      "adc",
      "tomographic reconstruction",
      "slice image"
    ],
    "signalFlow": [
      "Rotating X-ray source",
      "Detector array",
      "Data acquisition",
      "ADC",
      "Tomographic reconstruction",
      "Slice image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/mri-scanner",
    "slug": "mri-scanner",
    "name": "MRI Scanner",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "See how magnetic fields, RF signals and digital reconstruction create internal body images.",
    "longDescription": "See how magnetic fields, RF signals and digital reconstruction create internal body images. The MRI Scanner signal path begins with main magnet / rf excitation and leads to image. Between these endpoints, rf receive coil, signal acquisition, adc, reconstruction computer connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-mri-scanner.svg",
    "status": "available",
    "keywords": [
      "mri",
      "mri",
      "main magnet / rf excitation",
      "rf receive coil",
      "signal acquisition",
      "adc",
      "reconstruction computer",
      "image"
    ],
    "signalFlow": [
      "Main magnet / RF excitation",
      "RF receive coil",
      "Signal acquisition",
      "ADC",
      "Reconstruction computer",
      "Image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/pet-scanner",
    "slug": "pet-scanner",
    "name": "PET Scanner",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Detect emitted photons and reconstruct the distribution of an administered imaging tracer.",
    "longDescription": "Detect emitted photons and reconstruct the distribution of an administered imaging tracer. The PET Scanner signal path begins with tracer emission and leads to functional image. Between these endpoints, scintillation detectors, photodetector readout, energy / timing processing, tomographic reconstruction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-pet-scanner.svg",
    "status": "available",
    "keywords": [
      "pet",
      "pet",
      "tracer emission",
      "scintillation detectors",
      "photodetector readout",
      "energy / timing processing",
      "tomographic reconstruction",
      "functional image"
    ],
    "signalFlow": [
      "Tracer emission",
      "Scintillation detectors",
      "Photodetector readout",
      "Energy / timing processing",
      "Tomographic reconstruction",
      "Functional image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/spect-scanner",
    "slug": "spect-scanner",
    "name": "SPECT Scanner",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Collect gamma-photon projections with rotating detectors to reconstruct tracer distribution.",
    "longDescription": "Collect gamma-photon projections with rotating detectors to reconstruct tracer distribution. The SPECT Scanner signal path begins with tracer gamma emission and leads to functional image. Between these endpoints, collimator, gamma detector, energy / position processing, projection reconstruction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-spect-scanner.svg",
    "status": "available",
    "keywords": [
      "pet",
      "pet",
      "tracer gamma emission",
      "collimator",
      "gamma detector",
      "energy / position processing",
      "projection reconstruction",
      "functional image"
    ],
    "signalFlow": [
      "Tracer gamma emission",
      "Collimator",
      "Gamma detector",
      "Energy / position processing",
      "Projection reconstruction",
      "Functional image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/mammography-system",
    "slug": "mammography-system",
    "name": "Mammography System",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Acquire high-resolution X-ray projections with a dedicated breast-imaging detector system.",
    "longDescription": "Acquire high-resolution X-ray projections with a dedicated breast-imaging detector system. The Mammography System signal path begins with controlled x-ray source and leads to mammogram. Between these endpoints, tissue attenuation, digital detector, pixel readout, image correction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-mammography-system.svg",
    "status": "available",
    "keywords": [
      "xray",
      "xray",
      "controlled x-ray source",
      "tissue attenuation",
      "digital detector",
      "pixel readout",
      "image correction",
      "mammogram"
    ],
    "signalFlow": [
      "Controlled X-ray source",
      "Tissue attenuation",
      "Digital detector",
      "Pixel readout",
      "Image correction",
      "Mammogram"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/endoscope-camera-system",
    "slug": "endoscope-camera-system",
    "name": "Endoscope Camera System",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Carry illumination and optical images through an endoscope to a digital video processor.",
    "longDescription": "Carry illumination and optical images through an endoscope to a digital video processor. The Endoscope Camera System signal path begins with illumination and leads to clinical video display. Between these endpoints, endoscope optics, image sensor, video acquisition, image processor connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-endoscope-camera-system.svg",
    "status": "available",
    "keywords": [
      "camera",
      "endoscope",
      "illumination",
      "endoscope optics",
      "image sensor",
      "video acquisition",
      "image processor",
      "clinical video display"
    ],
    "signalFlow": [
      "Illumination",
      "Endoscope optics",
      "Image sensor",
      "Video acquisition",
      "Image processor",
      "Clinical video display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/ventilator",
    "slug": "ventilator",
    "name": "Ventilator",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Use pressure and flow feedback to regulate the delivery of breathing support.",
    "longDescription": "Use pressure and flow feedback to regulate the delivery of breathing support. The Ventilator signal path begins with breathing settings and leads to monitoring display. Between these endpoints, pressure / flow sensors, adc, feedback controller, valves / blower connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-ventilator.svg",
    "status": "available",
    "keywords": [
      "ventilator",
      "ventilator",
      "breathing settings",
      "pressure / flow sensors",
      "adc",
      "feedback controller",
      "valves / blower",
      "monitoring display"
    ],
    "signalFlow": [
      "Breathing settings",
      "Pressure / flow sensors",
      "ADC",
      "Feedback controller",
      "Valves / blower",
      "Monitoring display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/cpap-machine",
    "slug": "cpap-machine",
    "name": "CPAP Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Use pressure feedback to regulate a blower and maintain a prescribed continuous airway pressure.",
    "longDescription": "Use pressure feedback to regulate a blower and maintain a prescribed continuous airway pressure. The CPAP Machine signal path begins with pressure setting and leads to airway pressure feedback. Between these endpoints, pressure sensor, adc, pressure controller, blower connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-cpap-machine.svg",
    "status": "available",
    "keywords": [
      "ventilator",
      "cpap",
      "pressure setting",
      "pressure sensor",
      "adc",
      "pressure controller",
      "blower",
      "airway pressure feedback"
    ],
    "signalFlow": [
      "Pressure setting",
      "Pressure sensor",
      "ADC",
      "Pressure controller",
      "Blower",
      "Airway pressure feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/bipap-machine",
    "slug": "bipap-machine",
    "name": "BiPAP Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Detect breathing phases and switch between supervised inspiratory and expiratory pressure targets.",
    "longDescription": "Detect breathing phases and switch between supervised inspiratory and expiratory pressure targets. The BiPAP Machine signal path begins with two pressure targets and leads to airway feedback. Between these endpoints, flow / pressure sensors, breath-phase detection, pressure controller, blower / valves connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-bipap-machine.svg",
    "status": "available",
    "keywords": [
      "ventilator",
      "cpap",
      "two pressure targets",
      "flow / pressure sensors",
      "breath-phase detection",
      "pressure controller",
      "blower / valves",
      "airway feedback"
    ],
    "signalFlow": [
      "Two pressure targets",
      "Flow / pressure sensors",
      "Breath-phase detection",
      "Pressure controller",
      "Blower / valves",
      "Airway feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/infusion-pump",
    "slug": "infusion-pump",
    "name": "Infusion Pump",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Translate a programmed delivery rate into controlled motor motion with sensor-based supervision.",
    "longDescription": "Translate a programmed delivery rate into controlled motor motion with sensor-based supervision. The Infusion Pump signal path begins with rate settings and leads to alarm / display. Between these endpoints, control mcu, motor driver, pump mechanism, flow / pressure feedback connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-infusion-pump.svg",
    "status": "available",
    "keywords": [
      "pump",
      "pump",
      "rate settings",
      "control mcu",
      "motor driver",
      "pump mechanism",
      "flow / pressure feedback",
      "alarm / display"
    ],
    "signalFlow": [
      "Rate settings",
      "Control MCU",
      "Motor driver",
      "Pump mechanism",
      "Flow / pressure feedback",
      "Alarm / display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/syringe-pump",
    "slug": "syringe-pump",
    "name": "Syringe Pump",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Translate a programmed infusion rate into precise linear movement of a syringe plunger.",
    "longDescription": "Translate a programmed infusion rate into precise linear movement of a syringe plunger. The Syringe Pump signal path begins with rate setting and leads to delivery supervision. Between these endpoints, mcu / motion plan, motor drive, lead screw / plunger, position / force sensing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-syringe-pump.svg",
    "status": "available",
    "keywords": [
      "pump",
      "pump",
      "rate setting",
      "mcu / motion plan",
      "motor drive",
      "lead screw / plunger",
      "position / force sensing",
      "delivery supervision"
    ],
    "signalFlow": [
      "Rate setting",
      "MCU / motion plan",
      "Motor drive",
      "Lead screw / plunger",
      "Position / force sensing",
      "Delivery supervision"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/dialysis-machine",
    "slug": "dialysis-machine",
    "name": "Dialysis Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Coordinate fluid circuits and monitor pressure, conductivity and flow during blood filtration.",
    "longDescription": "Coordinate fluid circuits and monitor pressure, conductivity and flow during blood filtration. The Dialysis Machine signal path begins with blood / dialysate circuits and leads to treatment monitor. Between these endpoints, pressure / conductivity sensors, acquisition, supervisory controller, pump / valve control connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-dialysis-machine.svg",
    "status": "available",
    "keywords": [
      "dialysis",
      "dialysis",
      "blood / dialysate circuits",
      "pressure / conductivity sensors",
      "acquisition",
      "supervisory controller",
      "pump / valve control",
      "treatment monitor"
    ],
    "signalFlow": [
      "Blood / dialysate circuits",
      "Pressure / conductivity sensors",
      "Acquisition",
      "Supervisory controller",
      "Pump / valve control",
      "Treatment monitor"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/anesthesia-machine",
    "slug": "anesthesia-machine",
    "name": "Anesthesia Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Coordinate gas delivery and ventilation while monitoring pressure, flow and gas concentrations.",
    "longDescription": "Coordinate gas delivery and ventilation while monitoring pressure, flow and gas concentrations. The Anesthesia Machine signal path begins with gas supply / settings and leads to monitoring display. Between these endpoints, flow / concentration sensing, acquisition, delivery supervision, gas / ventilation control connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-anesthesia-machine.svg",
    "status": "available",
    "keywords": [
      "ventilator",
      "ventilator",
      "gas supply / settings",
      "flow / concentration sensing",
      "acquisition",
      "delivery supervision",
      "gas / ventilation control",
      "monitoring display"
    ],
    "signalFlow": [
      "Gas supply / settings",
      "Flow / concentration sensing",
      "Acquisition",
      "Delivery supervision",
      "Gas / ventilation control",
      "Monitoring display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/electrosurgical-unit",
    "slug": "electrosurgical-unit",
    "name": "Electrosurgical Unit",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Supervise a radio-frequency energy source using output feedback and safety interlocks.",
    "longDescription": "Supervise a radio-frequency energy source using output feedback and safety interlocks. The Electrosurgical Unit signal path begins with mode / power settings and leads to status display. Between these endpoints, control logic, rf generator, output sensing, feedback / interlocks connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-electrosurgical-unit.svg",
    "status": "available",
    "keywords": [
      "therapy",
      "therapy",
      "mode / power settings",
      "control logic",
      "rf generator",
      "output sensing",
      "feedback / interlocks",
      "status display"
    ],
    "signalFlow": [
      "Mode / power settings",
      "Control logic",
      "RF generator",
      "Output sensing",
      "Feedback / interlocks",
      "Status display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/tens-machine",
    "slug": "tens-machine",
    "name": "TENS Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Generate timed stimulation pulses with controlled amplitude and output supervision.",
    "longDescription": "Generate timed stimulation pulses with controlled amplitude and output supervision. The TENS Machine signal path begins with pulse settings and leads to output monitoring. Between these endpoints, timing mcu, pulse generator, output driver, electrode interface connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-tens-machine.svg",
    "status": "available",
    "keywords": [
      "therapy",
      "therapy",
      "pulse settings",
      "timing mcu",
      "pulse generator",
      "output driver",
      "electrode interface",
      "output monitoring"
    ],
    "signalFlow": [
      "Pulse settings",
      "Timing MCU",
      "Pulse generator",
      "Output driver",
      "Electrode interface",
      "Output monitoring"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/medical-laser-system",
    "slug": "medical-laser-system",
    "name": "Medical Laser System",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Coordinate optical pulses with power measurements, cooling and interlocks.",
    "longDescription": "Coordinate optical pulses with power measurements, cooling and interlocks. The Medical Laser System signal path begins with treatment settings and leads to interlock status. Between these endpoints, timing controller, laser source, optical delivery, power / thermal feedback connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-medical-laser-system.svg",
    "status": "available",
    "keywords": [
      "therapy",
      "laser",
      "treatment settings",
      "timing controller",
      "laser source",
      "optical delivery",
      "power / thermal feedback",
      "interlock status"
    ],
    "signalFlow": [
      "Treatment settings",
      "Timing controller",
      "Laser source",
      "Optical delivery",
      "Power / thermal feedback",
      "Interlock status"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/blood-cell-analyzer",
    "slug": "blood-cell-analyzer",
    "name": "Blood Cell Analyzer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Count and characterize cells using impedance or optical measurements from a prepared sample.",
    "longDescription": "Count and characterize cells using impedance or optical measurements from a prepared sample. The Blood Cell Analyzer signal path begins with prepared blood sample and leads to count report. Between these endpoints, flow / aperture system, optical / impedance detector, pulse acquisition, cell classification connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-blood-cell-analyzer.svg",
    "status": "upcoming",
    "keywords": [
      "chemistry",
      "analyzer",
      "prepared blood sample",
      "flow / aperture system",
      "optical / impedance detector",
      "pulse acquisition",
      "cell classification",
      "count report"
    ],
    "signalFlow": [
      "Prepared blood sample",
      "Flow / aperture system",
      "Optical / impedance detector",
      "Pulse acquisition",
      "Cell classification",
      "Count report"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/automated-chemistry-analyzer",
    "slug": "automated-chemistry-analyzer",
    "name": "Automated Chemistry Analyzer",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Sequence sample reactions and compare optical measurements with calibration references.",
    "longDescription": "Sequence sample reactions and compare optical measurements with calibration references. The Automated Chemistry Analyzer signal path begins with sample dispenser and leads to result report. Between these endpoints, reaction chamber, light source / detector, adc, calibration / concentration analysis connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-automated-chemistry-analyzer.svg",
    "status": "upcoming",
    "keywords": [
      "chemistry",
      "analyzer",
      "sample dispenser",
      "reaction chamber",
      "light source / detector",
      "adc",
      "calibration / concentration analysis",
      "result report"
    ],
    "signalFlow": [
      "Sample dispenser",
      "Reaction chamber",
      "Light source / detector",
      "ADC",
      "Calibration / concentration analysis",
      "Result report"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/pcr-machine",
    "slug": "pcr-machine",
    "name": "PCR Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Cycle a sample through controlled temperatures and monitor amplification through fluorescence.",
    "longDescription": "Cycle a sample through controlled temperatures and monitor amplification through fluorescence. The PCR Machine signal path begins with thermal program and leads to amplification curve. Between these endpoints, temperature sensing, feedback controller, heater / cooler, fluorescence detector connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-pcr-machine.svg",
    "status": "available",
    "keywords": [
      "pcr",
      "analyzer",
      "thermal program",
      "temperature sensing",
      "feedback controller",
      "heater / cooler",
      "fluorescence detector",
      "amplification curve"
    ],
    "signalFlow": [
      "Thermal program",
      "Temperature sensing",
      "Feedback controller",
      "Heater / cooler",
      "Fluorescence detector",
      "Amplification curve"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/centrifuge",
    "slug": "centrifuge",
    "name": "Centrifuge",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Regulate rotor speed and enforce lid and imbalance checks while separating a sample.",
    "longDescription": "Regulate rotor speed and enforce lid and imbalance checks while separating a sample. The Centrifuge signal path begins with speed settings and leads to status display. Between these endpoints, motor controller, rotor, speed / imbalance sensors, safety logic connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-centrifuge.svg",
    "status": "upcoming",
    "keywords": [
      "centrifuge",
      "centrifuge",
      "speed settings",
      "motor controller",
      "rotor",
      "speed / imbalance sensors",
      "safety logic",
      "status display"
    ],
    "signalFlow": [
      "Speed settings",
      "Motor controller",
      "Rotor",
      "Speed / imbalance sensors",
      "Safety logic",
      "Status display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/digital-microscope",
    "slug": "digital-microscope",
    "name": "Digital Microscope",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Magnify a specimen optically and digitize its image for display and measurement.",
    "longDescription": "Magnify a specimen optically and digitize its image for display and measurement. The Digital Microscope signal path begins with illumination and leads to magnified display. Between these endpoints, specimen / objective, image sensor, pixel readout, image processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-digital-microscope.svg",
    "status": "available",
    "keywords": [
      "camera",
      "microscope",
      "illumination",
      "specimen / objective",
      "image sensor",
      "pixel readout",
      "image processing",
      "magnified display"
    ],
    "signalFlow": [
      "Illumination",
      "Specimen / objective",
      "Image sensor",
      "Pixel readout",
      "Image processing",
      "Magnified display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/eeg-machine",
    "slug": "eeg-machine",
    "name": "EEG Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Acquire small electrical potentials from scalp electrodes and present synchronized brain-activity traces.",
    "longDescription": "Acquire small electrical potentials from scalp electrodes and present synchronized brain-activity traces. The EEG Machine signal path begins with scalp electrodes and leads to eeg traces. Between these endpoints, differential amplifier, filtering, adc, multichannel analysis connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-eeg-machine.svg",
    "status": "available",
    "keywords": [
      "eeg",
      "ecg",
      "scalp electrodes",
      "differential amplifier",
      "filtering",
      "adc",
      "multichannel analysis",
      "eeg traces"
    ],
    "signalFlow": [
      "Scalp electrodes",
      "Differential amplifier",
      "Filtering",
      "ADC",
      "Multichannel analysis",
      "EEG traces"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/emg-machine",
    "slug": "emg-machine",
    "name": "EMG Machine",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Acquire electrical signals from muscles and analyze their timing and amplitude.",
    "longDescription": "Acquire electrical signals from muscles and analyze their timing and amplitude. The EMG Machine signal path begins with muscle electrodes and leads to emg waveform. Between these endpoints, differential amplifier, signal filtering, adc, amplitude / timing analysis connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-emg-machine.svg",
    "status": "available",
    "keywords": [
      "eeg",
      "ecg",
      "muscle electrodes",
      "differential amplifier",
      "signal filtering",
      "adc",
      "amplitude / timing analysis",
      "emg waveform"
    ],
    "signalFlow": [
      "Muscle electrodes",
      "Differential amplifier",
      "Signal filtering",
      "ADC",
      "Amplitude / timing analysis",
      "EMG waveform"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/fetal-monitor",
    "slug": "fetal-monitor",
    "name": "Fetal Monitor",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Combine fetal heart-rate estimates and uterine activity measurements into synchronized traces.",
    "longDescription": "Combine fetal heart-rate estimates and uterine activity measurements into synchronized traces. The Fetal Monitor signal path begins with doppler / uterine sensors and leads to monitoring traces. Between these endpoints, signal conditioning, adc, rate / contraction processing, time alignment connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-fetal-monitor.svg",
    "status": "available",
    "keywords": [
      "ultrasound",
      "ultrasound",
      "doppler / uterine sensors",
      "signal conditioning",
      "adc",
      "rate / contraction processing",
      "time alignment",
      "monitoring traces"
    ],
    "signalFlow": [
      "Doppler / uterine sensors",
      "Signal conditioning",
      "ADC",
      "Rate / contraction processing",
      "Time alignment",
      "Monitoring traces"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "medical/hearing-aid",
    "slug": "hearing-aid",
    "name": "Hearing Aid",
    "category": "medical",
    "categories": [
      "medical"
    ],
    "shortDescription": "Turn sound into digital samples for filtering, analysis or controlled amplification.",
    "longDescription": "Turn sound into digital samples for filtering, analysis or controlled amplification. The Hearing Aid signal path begins with sound and leads to speaker / recording. Between these endpoints, microphone, preamplifier, adc, audio dsp connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/medical-hearing-aid.svg",
    "status": "available",
    "keywords": [
      "audio",
      "hearing",
      "sound",
      "microphone",
      "preamplifier",
      "adc",
      "audio dsp",
      "speaker / recording"
    ],
    "signalFlow": [
      "Sound",
      "Microphone",
      "Preamplifier",
      "ADC",
      "Audio DSP",
      "Speaker / recording"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/aircraft-flight-computer",
    "slug": "aircraft-flight-computer",
    "name": "Aircraft Flight Computer",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Fuse aircraft sensor data into flight-state estimates and guidance information.",
    "longDescription": "Fuse aircraft sensor data into flight-state estimates and guidance information. The Aircraft Flight Computer signal path begins with aircraft sensors and leads to cockpit display. Between these endpoints, data buses, state estimation, flight computation, guidance outputs connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-aircraft-flight-computer.svg",
    "status": "upcoming",
    "keywords": [
      "flight",
      "cockpit",
      "aircraft sensors",
      "data buses",
      "state estimation",
      "flight computation",
      "guidance outputs",
      "cockpit display"
    ],
    "signalFlow": [
      "Aircraft sensors",
      "Data buses",
      "State estimation",
      "Flight computation",
      "Guidance outputs",
      "Cockpit display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/glass-cockpit",
    "slug": "glass-cockpit",
    "name": "Glass Cockpit",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Bring flight, navigation and engine data together on coordinated electronic instrument displays.",
    "longDescription": "Bring flight, navigation and engine data together on coordinated electronic instrument displays. The Glass Cockpit signal path begins with aircraft data buses and leads to cockpit screens. Between these endpoints, sensor / navigation data, display computer, graphics composition, display drivers connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-glass-cockpit.svg",
    "status": "upcoming",
    "keywords": [
      "flight",
      "cockpit",
      "aircraft data buses",
      "sensor / navigation data",
      "display computer",
      "graphics composition",
      "display drivers",
      "cockpit screens"
    ],
    "signalFlow": [
      "Aircraft data buses",
      "Sensor / navigation data",
      "Display computer",
      "Graphics composition",
      "Display drivers",
      "Cockpit screens"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/primary-flight-display",
    "slug": "primary-flight-display",
    "name": "Primary Flight Display",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Turn attitude, altitude and airspeed data into a synchronized flight-instrument view.",
    "longDescription": "Turn attitude, altitude and airspeed data into a synchronized flight-instrument view. The Primary Flight Display signal path begins with attitude / air-data sensors and leads to flight display. Between these endpoints, aircraft data bus, validity checks, display computation, graphics pipeline connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-primary-flight-display.svg",
    "status": "upcoming",
    "keywords": [
      "flight",
      "cockpit",
      "attitude / air-data sensors",
      "aircraft data bus",
      "validity checks",
      "display computation",
      "graphics pipeline",
      "flight display"
    ],
    "signalFlow": [
      "Attitude / air-data sensors",
      "Aircraft data bus",
      "Validity checks",
      "Display computation",
      "Graphics pipeline",
      "Flight display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/aircraft-autopilot",
    "slug": "aircraft-autopilot",
    "name": "Aircraft Autopilot",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Compare commanded flight targets with measured aircraft motion to calculate corrective control commands.",
    "longDescription": "Compare commanded flight targets with measured aircraft motion to calculate corrective control commands. The Aircraft Autopilot signal path begins with pilot target and leads to aircraft feedback. Between these endpoints, air / inertial sensors, state estimate, control law, flight-control actuators connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-aircraft-autopilot.svg",
    "status": "available",
    "keywords": [
      "autopilot",
      "cockpit",
      "pilot target",
      "air / inertial sensors",
      "state estimate",
      "control law",
      "flight-control actuators",
      "aircraft feedback"
    ],
    "signalFlow": [
      "Pilot target",
      "Air / inertial sensors",
      "State estimate",
      "Control law",
      "Flight-control actuators",
      "Aircraft feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/air-data-computer",
    "slug": "air-data-computer",
    "name": "Air Data Computer",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Convert air pressure and temperature measurements into flight parameters.",
    "longDescription": "Convert air pressure and temperature measurements into flight parameters. The Air Data Computer signal path begins with pitot / static pressure and leads to flight instruments. Between these endpoints, pressure / temperature sensors, adc, air-data computation, aircraft data bus connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-air-data-computer.svg",
    "status": "upcoming",
    "keywords": [
      "air-data",
      "cockpit",
      "pitot / static pressure",
      "pressure / temperature sensors",
      "adc",
      "air-data computation",
      "aircraft data bus",
      "flight instruments"
    ],
    "signalFlow": [
      "Pitot / static pressure",
      "Pressure / temperature sensors",
      "ADC",
      "Air-data computation",
      "Aircraft data bus",
      "Flight instruments"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/inertial-navigation-system",
    "slug": "inertial-navigation-system",
    "name": "Inertial Navigation System",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Integrate measured rotation and acceleration to estimate orientation and movement.",
    "longDescription": "Integrate measured rotation and acceleration to estimate orientation and movement. The Inertial Navigation System signal path begins with gyroscopes / accelerometers and leads to position / attitude. Between these endpoints, sensor readout, calibration, attitude integration, navigation filter connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-inertial-navigation-system.svg",
    "status": "upcoming",
    "keywords": [
      "inertial",
      "navigation",
      "gyroscopes / accelerometers",
      "sensor readout",
      "calibration",
      "attitude integration",
      "navigation filter",
      "position / attitude"
    ],
    "signalFlow": [
      "Gyroscopes / accelerometers",
      "Sensor readout",
      "Calibration",
      "Attitude integration",
      "Navigation filter",
      "Position / attitude"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/gps-navigation-system",
    "slug": "gps-navigation-system",
    "name": "GPS Navigation System",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Use satellite timing measurements to calculate position, velocity and time.",
    "longDescription": "Use satellite timing measurements to calculate position, velocity and time. The GPS Navigation System signal path begins with satellite rf signals and leads to position / time. Between these endpoints, antenna / rf front end, correlation, pseudorange measurements, navigation solution connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-gps-navigation-system.svg",
    "status": "upcoming",
    "keywords": [
      "gps",
      "navigation",
      "satellite rf signals",
      "antenna / rf front end",
      "correlation",
      "pseudorange measurements",
      "navigation solution",
      "position / time"
    ],
    "signalFlow": [
      "Satellite RF signals",
      "Antenna / RF front end",
      "Correlation",
      "Pseudorange measurements",
      "Navigation solution",
      "Position / time"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/radar-altimeter",
    "slug": "radar-altimeter",
    "name": "Radar Altimeter",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Estimate height above terrain from the delay or frequency difference of reflected radio signals.",
    "longDescription": "Estimate height above terrain from the delay or frequency difference of reflected radio signals. The Radar Altimeter signal path begins with downward rf transmission and leads to altitude output. Between these endpoints, terrain reflection, receive antenna, mixer / sampling, height estimation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-radar-altimeter.svg",
    "status": "upcoming",
    "keywords": [
      "altimeter",
      "radar",
      "downward rf transmission",
      "terrain reflection",
      "receive antenna",
      "mixer / sampling",
      "height estimation",
      "altitude output"
    ],
    "signalFlow": [
      "Downward RF transmission",
      "Terrain reflection",
      "Receive antenna",
      "Mixer / sampling",
      "Height estimation",
      "Altitude output"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/radio-altimeter",
    "slug": "radio-altimeter",
    "name": "Radio Altimeter",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Estimate height above terrain from the delay or frequency difference of reflected radio signals.",
    "longDescription": "Estimate height above terrain from the delay or frequency difference of reflected radio signals. The Radio Altimeter signal path begins with downward rf transmission and leads to altitude output. Between these endpoints, terrain reflection, receive antenna, mixer / sampling, height estimation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-radio-altimeter.svg",
    "status": "upcoming",
    "keywords": [
      "altimeter",
      "radar",
      "downward rf transmission",
      "terrain reflection",
      "receive antenna",
      "mixer / sampling",
      "height estimation",
      "altitude output"
    ],
    "signalFlow": [
      "Downward RF transmission",
      "Terrain reflection",
      "Receive antenna",
      "Mixer / sampling",
      "Height estimation",
      "Altitude output"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/weather-radar",
    "slug": "weather-radar",
    "name": "Weather Radar",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Interpret radar echoes from precipitation to display weather structure ahead of an aircraft.",
    "longDescription": "Interpret radar echoes from precipitation to display weather structure ahead of an aircraft. The Weather Radar signal path begins with radar transmitter and leads to cockpit weather display. Between these endpoints, scanning antenna, precipitation echoes, receive / sample chain, weather processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-weather-radar.svg",
    "status": "upcoming",
    "keywords": [
      "radar",
      "radar",
      "radar transmitter",
      "scanning antenna",
      "precipitation echoes",
      "receive / sample chain",
      "weather processing",
      "cockpit weather display"
    ],
    "signalFlow": [
      "Radar transmitter",
      "Scanning antenna",
      "Precipitation echoes",
      "Receive / sample chain",
      "Weather processing",
      "Cockpit weather display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/traffic-collision-avoidance-system",
    "slug": "traffic-collision-avoidance-system",
    "name": "Traffic Collision Avoidance System",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Combine surveillance replies and own-aircraft motion to evaluate traffic proximity.",
    "longDescription": "Combine surveillance replies and own-aircraft motion to evaluate traffic proximity. The Traffic Collision Avoidance System signal path begins with traffic interrogations and leads to cockpit alert. Between these endpoints, surveillance replies, track estimation, conflict prediction, advisory logic connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-traffic-collision-avoidance-system.svg",
    "status": "upcoming",
    "keywords": [
      "collision",
      "cockpit",
      "traffic interrogations",
      "surveillance replies",
      "track estimation",
      "conflict prediction",
      "advisory logic",
      "cockpit alert"
    ],
    "signalFlow": [
      "Traffic interrogations",
      "Surveillance replies",
      "Track estimation",
      "Conflict prediction",
      "Advisory logic",
      "Cockpit alert"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/aircraft-transponder",
    "slug": "aircraft-transponder",
    "name": "Aircraft Transponder",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Encode aircraft identity or surveillance data into standardized radio messages.",
    "longDescription": "Encode aircraft identity or surveillance data into standardized radio messages. The Aircraft Transponder signal path begins with interrogation / aircraft data and leads to ground receiver. Between these endpoints, message decoder, identity / position data, reply encoder, rf transmitter connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-aircraft-transponder.svg",
    "status": "upcoming",
    "keywords": [
      "transponder",
      "radio",
      "interrogation / aircraft data",
      "message decoder",
      "identity / position data",
      "reply encoder",
      "rf transmitter",
      "ground receiver"
    ],
    "signalFlow": [
      "Interrogation / aircraft data",
      "Message decoder",
      "Identity / position data",
      "Reply encoder",
      "RF transmitter",
      "Ground receiver"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/ads-b-system",
    "slug": "ads-b-system",
    "name": "ADS-B System",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Broadcast aircraft position and identity derived from navigation and onboard data.",
    "longDescription": "Broadcast aircraft position and identity derived from navigation and onboard data. The ADS-B System signal path begins with gnss position and leads to surveillance receiver. Between these endpoints, aircraft identity / state, ads-b message encoder, transmission scheduling, rf transmitter connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-ads-b-system.svg",
    "status": "upcoming",
    "keywords": [
      "transponder",
      "radio",
      "gnss position",
      "aircraft identity / state",
      "ads-b message encoder",
      "transmission scheduling",
      "rf transmitter",
      "surveillance receiver"
    ],
    "signalFlow": [
      "GNSS position",
      "Aircraft identity / state",
      "ADS-B message encoder",
      "Transmission scheduling",
      "RF transmitter",
      "Surveillance receiver"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/flight-data-recorder",
    "slug": "flight-data-recorder",
    "name": "Flight Data Recorder",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Store timestamped aircraft parameters received from onboard acquisition units and buses.",
    "longDescription": "Store timestamped aircraft parameters received from onboard acquisition units and buses. The Flight Data Recorder signal path begins with aircraft parameter buses and leads to flight-data retrieval. Between these endpoints, acquisition unit, frame validation, timestamping, protected memory connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-flight-data-recorder.svg",
    "status": "upcoming",
    "keywords": [
      "recorder",
      "recorder",
      "aircraft parameter buses",
      "acquisition unit",
      "frame validation",
      "timestamping",
      "protected memory",
      "flight-data retrieval"
    ],
    "signalFlow": [
      "Aircraft parameter buses",
      "Acquisition unit",
      "Frame validation",
      "Timestamping",
      "Protected memory",
      "Flight-data retrieval"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/cockpit-voice-recorder",
    "slug": "cockpit-voice-recorder",
    "name": "Cockpit Voice Recorder",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Digitize cockpit microphone and audio-channel inputs into a protected recording.",
    "longDescription": "Digitize cockpit microphone and audio-channel inputs into a protected recording. The Cockpit Voice Recorder signal path begins with cockpit microphones and leads to audio retrieval. Between these endpoints, audio conditioning, adc, timestamp / channel framing, protected memory connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-cockpit-voice-recorder.svg",
    "status": "upcoming",
    "keywords": [
      "recorder",
      "recorder",
      "cockpit microphones",
      "audio conditioning",
      "adc",
      "timestamp / channel framing",
      "protected memory",
      "audio retrieval"
    ],
    "signalFlow": [
      "Cockpit microphones",
      "Audio conditioning",
      "ADC",
      "Timestamp / channel framing",
      "Protected memory",
      "Audio retrieval"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/fly-by-wire",
    "slug": "fly-by-wire",
    "name": "Fly-by-Wire System",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Translate pilot inputs and sensor feedback into electronically supervised flight-control commands.",
    "longDescription": "Translate pilot inputs and sensor feedback into electronically supervised flight-control commands. The Fly-by-Wire System signal path begins with pilot controls and leads to control surfaces. Between these endpoints, input sensors, flight-control computers, control law / monitoring, actuator electronics connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-fly-by-wire.svg",
    "status": "upcoming",
    "keywords": [
      "fly-wire",
      "cockpit",
      "pilot controls",
      "input sensors",
      "flight-control computers",
      "control law / monitoring",
      "actuator electronics",
      "control surfaces"
    ],
    "signalFlow": [
      "Pilot controls",
      "Input sensors",
      "Flight-control computers",
      "Control law / monitoring",
      "Actuator electronics",
      "Control surfaces"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/engine-fadec-controller",
    "slug": "engine-fadec-controller",
    "name": "Engine FADEC Controller",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Process engine measurements to coordinate control outputs and report operating conditions.",
    "longDescription": "Process engine measurements to coordinate control outputs and report operating conditions. The Engine FADEC Controller signal path begins with engine sensors and leads to engine feedback. Between these endpoints, signal conditioning, adc / bus input, engine controller, fuel / actuator command connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-engine-fadec-controller.svg",
    "status": "upcoming",
    "keywords": [
      "engine",
      "controller",
      "engine sensors",
      "signal conditioning",
      "adc / bus input",
      "engine controller",
      "fuel / actuator command",
      "engine feedback"
    ],
    "signalFlow": [
      "Engine sensors",
      "Signal conditioning",
      "ADC / bus input",
      "Engine controller",
      "Fuel / actuator command",
      "Engine feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/aircraft-engine-monitoring-system",
    "slug": "aircraft-engine-monitoring-system",
    "name": "Aircraft Engine Monitoring System",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Convert engine measurements into trends, status indications and recorded alerts.",
    "longDescription": "Convert engine measurements into trends, status indications and recorded alerts. The Aircraft Engine Monitoring System signal path begins with engine sensors and leads to engine indications. Between these endpoints, data acquisition, validation / calibration, trend / limit processing, aircraft data bus connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-aircraft-engine-monitoring-system.svg",
    "status": "upcoming",
    "keywords": [
      "engine",
      "controller",
      "engine sensors",
      "data acquisition",
      "validation / calibration",
      "trend / limit processing",
      "aircraft data bus",
      "engine indications"
    ],
    "signalFlow": [
      "Engine sensors",
      "Data acquisition",
      "Validation / calibration",
      "Trend / limit processing",
      "Aircraft data bus",
      "Engine indications"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/drone-flight-controller",
    "slug": "drone-flight-controller",
    "name": "Drone Flight Controller",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Fuse motion sensors and guidance targets to coordinate multiple motor speeds.",
    "longDescription": "Fuse motion sensors and guidance targets to coordinate multiple motor speeds. The Drone Flight Controller signal path begins with imu / navigation sensors and leads to vehicle feedback. Between these endpoints, state estimation, flight controller, motor mixing, escs / motors connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-drone-flight-controller.svg",
    "status": "upcoming",
    "keywords": [
      "drone",
      "drone",
      "imu / navigation sensors",
      "state estimation",
      "flight controller",
      "motor mixing",
      "escs / motors",
      "vehicle feedback"
    ],
    "signalFlow": [
      "IMU / navigation sensors",
      "State estimation",
      "Flight controller",
      "Motor mixing",
      "ESCs / motors",
      "Vehicle feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/satellite-attitude-control-computer",
    "slug": "satellite-attitude-control-computer",
    "name": "Satellite Attitude-Control Computer",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Estimate satellite orientation and coordinate actuators to follow a pointing target.",
    "longDescription": "Estimate satellite orientation and coordinate actuators to follow a pointing target. The Satellite Attitude-Control Computer signal path begins with star tracker / gyroscopes and leads to orientation feedback. Between these endpoints, attitude estimation, pointing target, control law, reaction wheels / actuators connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-satellite-attitude-control-computer.svg",
    "status": "upcoming",
    "keywords": [
      "satellite",
      "satellite",
      "star tracker / gyroscopes",
      "attitude estimation",
      "pointing target",
      "control law",
      "reaction wheels / actuators",
      "orientation feedback"
    ],
    "signalFlow": [
      "Star tracker / gyroscopes",
      "Attitude estimation",
      "Pointing target",
      "Control law",
      "Reaction wheels / actuators",
      "Orientation feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "aviation/satellite-communication-terminal",
    "slug": "satellite-communication-terminal",
    "name": "Satellite Communication Terminal",
    "category": "aviation",
    "categories": [
      "aviation"
    ],
    "shortDescription": "Track a satellite link and convert between digital messages and modulated radio signals.",
    "longDescription": "Track a satellite link and convert between digital messages and modulated radio signals. The Satellite Communication Terminal signal path begins with digital messages and leads to satellite link. Between these endpoints, channel coding, modem, rf up / down conversion, pointed antenna connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-satellite-communication-terminal.svg",
    "status": "upcoming",
    "keywords": [
      "satellite",
      "dish",
      "digital messages",
      "channel coding",
      "modem",
      "rf up / down conversion",
      "pointed antenna",
      "satellite link"
    ],
    "signalFlow": [
      "Digital messages",
      "Channel coding",
      "Modem",
      "RF up / down conversion",
      "Pointed antenna",
      "Satellite link"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/surveillance-radar",
    "slug": "surveillance-radar",
    "name": "Surveillance Radar",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Process returning radio echoes to estimate object range, direction or motion.",
    "longDescription": "Process returning radio echoes to estimate object range, direction or motion. The Surveillance Radar signal path begins with rf transmitter and leads to radar display. Between these endpoints, antenna, echo receiver, adc, range / doppler processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-surveillance-radar.svg",
    "status": "available",
    "keywords": [
      "radar",
      "radar",
      "rf transmitter",
      "antenna",
      "echo receiver",
      "adc",
      "range / doppler processing",
      "radar display"
    ],
    "signalFlow": [
      "RF transmitter",
      "Antenna",
      "Echo receiver",
      "ADC",
      "Range / Doppler processing",
      "Radar display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/phased-array-radar",
    "slug": "phased-array-radar",
    "name": "Phased-Array Radar",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Coordinate multiple antenna elements to steer a sensing beam electronically.",
    "longDescription": "Coordinate multiple antenna elements to steer a sensing beam electronically. The Phased-Array Radar signal path begins with waveform generator and leads to sensing display. Between these endpoints, element phase control, antenna array, receive channels, beamforming / range processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-phased-array-radar.svg",
    "status": "upcoming",
    "keywords": [
      "radar",
      "phased-radar",
      "waveform generator",
      "element phase control",
      "antenna array",
      "receive channels",
      "beamforming / range processing",
      "sensing display"
    ],
    "signalFlow": [
      "Waveform generator",
      "Element phase control",
      "Antenna array",
      "Receive channels",
      "Beamforming / range processing",
      "Sensing display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/air-defence-radar",
    "slug": "air-defence-radar",
    "name": "Air-Defence Radar",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Use radar echoes to build airspace surveillance tracks and defensive situational awareness.",
    "longDescription": "Use radar echoes to build airspace surveillance tracks and defensive situational awareness. The Air-Defence Radar signal path begins with rf illumination and leads to airspace display. Between these endpoints, echo reception, digital acquisition, detection / tracking, track fusion connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-air-defence-radar.svg",
    "status": "upcoming",
    "keywords": [
      "radar",
      "radar",
      "rf illumination",
      "echo reception",
      "digital acquisition",
      "detection / tracking",
      "track fusion",
      "airspace display"
    ],
    "signalFlow": [
      "RF illumination",
      "Echo reception",
      "Digital acquisition",
      "Detection / tracking",
      "Track fusion",
      "Airspace display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/ground-surveillance-radar",
    "slug": "ground-surveillance-radar",
    "name": "Ground Surveillance Radar",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Process radio echoes to estimate the location and motion of objects near the ground.",
    "longDescription": "Process radio echoes to estimate the location and motion of objects near the ground. The Ground Surveillance Radar signal path begins with rf illumination and leads to surveillance display. Between these endpoints, ground-object echoes, receive chain, adc, clutter / motion processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-ground-surveillance-radar.svg",
    "status": "upcoming",
    "keywords": [
      "radar",
      "radar",
      "rf illumination",
      "ground-object echoes",
      "receive chain",
      "adc",
      "clutter / motion processing",
      "surveillance display"
    ],
    "signalFlow": [
      "RF illumination",
      "Ground-object echoes",
      "Receive chain",
      "ADC",
      "Clutter / motion processing",
      "Surveillance display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/passive-radar",
    "slug": "passive-radar",
    "name": "Passive Radar",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Compare direct and reflected signals from an external transmitter to detect motion and range.",
    "longDescription": "Compare direct and reflected signals from an external transmitter to detect motion and range. The Passive Radar signal path begins with external rf illumination and leads to detection display. Between these endpoints, reference / surveillance antennas, receive channels, adc, correlation / doppler processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-passive-radar.svg",
    "status": "upcoming",
    "keywords": [
      "radar",
      "radar",
      "external rf illumination",
      "reference / surveillance antennas",
      "receive channels",
      "adc",
      "correlation / doppler processing",
      "detection display"
    ],
    "signalFlow": [
      "External RF illumination",
      "Reference / surveillance antennas",
      "Receive channels",
      "ADC",
      "Correlation / Doppler processing",
      "Detection display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/thermal-imaging-camera",
    "slug": "thermal-imaging-camera",
    "name": "Thermal Imaging Camera",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Map infrared radiation onto a detector array and convert it into a temperature-related image.",
    "longDescription": "Map infrared radiation onto a detector array and convert it into a temperature-related image. The Thermal Imaging Camera signal path begins with infrared radiation and leads to thermal image. Between these endpoints, ir optics, detector array, readout / adc, correction / image processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-thermal-imaging-camera.svg",
    "status": "upcoming",
    "keywords": [
      "thermal",
      "thermal",
      "infrared radiation",
      "ir optics",
      "detector array",
      "readout / adc",
      "correction / image processing",
      "thermal image"
    ],
    "signalFlow": [
      "Infrared radiation",
      "IR optics",
      "Detector array",
      "Readout / ADC",
      "Correction / image processing",
      "Thermal image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/night-vision-system",
    "slug": "night-vision-system",
    "name": "Night-Vision System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Amplify faint light or use sensitive imaging electronics to make dark scenes visible.",
    "longDescription": "Amplify faint light or use sensitive imaging electronics to make dark scenes visible. The Night-Vision System signal path begins with low-light scene and leads to visible scene. Between these endpoints, objective optics, intensifier / sensitive detector, signal gain, viewing optics / processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-night-vision-system.svg",
    "status": "upcoming",
    "keywords": [
      "night",
      "thermal",
      "low-light scene",
      "objective optics",
      "intensifier / sensitive detector",
      "signal gain",
      "viewing optics / processing",
      "visible scene"
    ],
    "signalFlow": [
      "Low-light scene",
      "Objective optics",
      "Intensifier / sensitive detector",
      "Signal gain",
      "Viewing optics / processing",
      "Visible scene"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/infrared-surveillance-camera",
    "slug": "infrared-surveillance-camera",
    "name": "Infrared Surveillance Camera",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Capture infrared scene information and convert it into a digital surveillance image.",
    "longDescription": "Capture infrared scene information and convert it into a digital surveillance image. The Infrared Surveillance Camera signal path begins with infrared scene and leads to surveillance video. Between these endpoints, ir optics, sensitive image sensor, pixel acquisition, image correction connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-infrared-surveillance-camera.svg",
    "status": "upcoming",
    "keywords": [
      "thermal",
      "thermal",
      "infrared scene",
      "ir optics",
      "sensitive image sensor",
      "pixel acquisition",
      "image correction",
      "surveillance video"
    ],
    "signalFlow": [
      "Infrared scene",
      "IR optics",
      "Sensitive image sensor",
      "Pixel acquisition",
      "Image correction",
      "Surveillance video"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/laser-range-finder",
    "slug": "laser-range-finder",
    "name": "Laser Range Finder",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Measure the travel time or phase of reflected light to estimate distance.",
    "longDescription": "Measure the travel time or phase of reflected light to estimate distance. The Laser Range Finder signal path begins with laser pulse and leads to distance display. Between these endpoints, target reflection, photodetector, timing measurement, range calculation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-laser-range-finder.svg",
    "status": "upcoming",
    "keywords": [
      "laser",
      "laser",
      "laser pulse",
      "target reflection",
      "photodetector",
      "timing measurement",
      "range calculation",
      "distance display"
    ],
    "signalFlow": [
      "Laser pulse",
      "Target reflection",
      "Photodetector",
      "Timing measurement",
      "Range calculation",
      "Distance display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/secure-digital-radio",
    "slug": "secure-digital-radio",
    "name": "Secure Digital Radio",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Digitize voice and protect encoded messages before transmitting them over a radio link.",
    "longDescription": "Digitize voice and protect encoded messages before transmitting them over a radio link. The Secure Digital Radio signal path begins with voice / data and leads to authorized receiver. Between these endpoints, audio sampling, codec / authorized encryption, channel coding, rf modem connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-secure-digital-radio.svg",
    "status": "upcoming",
    "keywords": [
      "radio",
      "radio",
      "voice / data",
      "audio sampling",
      "codec / authorized encryption",
      "channel coding",
      "rf modem",
      "authorized receiver"
    ],
    "signalFlow": [
      "Voice / data",
      "Audio sampling",
      "Codec / authorized encryption",
      "Channel coding",
      "RF modem",
      "Authorized receiver"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/software-defined-radio",
    "slug": "software-defined-radio",
    "name": "Software Defined Radio",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Move radio filtering and modulation into software that processes digitized RF signals.",
    "longDescription": "Move radio filtering and modulation into software that processes digitized RF signals. The Software Defined Radio signal path begins with antenna and leads to decoded data. Between these endpoints, rf front end, i/q adc, digital filtering, software demodulation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-software-defined-radio.svg",
    "status": "upcoming",
    "keywords": [
      "sdr",
      "radio",
      "antenna",
      "rf front end",
      "i/q adc",
      "digital filtering",
      "software demodulation",
      "decoded data"
    ],
    "signalFlow": [
      "Antenna",
      "RF front end",
      "I/Q ADC",
      "Digital filtering",
      "Software demodulation",
      "Decoded data"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/electronic-identification-system",
    "slug": "electronic-identification-system",
    "name": "Electronic Identification System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Read electronic credentials and validate identity data for system identification.",
    "longDescription": "Read electronic credentials and validate identity data for system identification. The Electronic Identification System signal path begins with electronic credential and leads to status output. Between these endpoints, reader interface, protocol decode, identity validation, identification logic connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-electronic-identification-system.svg",
    "status": "upcoming",
    "keywords": [
      "identity",
      "nfc",
      "electronic credential",
      "reader interface",
      "protocol decode",
      "identity validation",
      "identification logic",
      "status output"
    ],
    "signalFlow": [
      "Electronic credential",
      "Reader interface",
      "Protocol decode",
      "Identity validation",
      "Identification logic",
      "Status output"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/iff-system",
    "slug": "iff-system",
    "name": "IFF System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Exchange identification challenges and replies to support recognized-platform identification.",
    "longDescription": "Exchange identification challenges and replies to support recognized-platform identification. The IFF System signal path begins with interrogation message and leads to identification display. Between these endpoints, rf receiver, protocol / identity checks, authorized reply encoding, rf transmitter connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-iff-system.svg",
    "status": "upcoming",
    "keywords": [
      "identity",
      "nfc",
      "interrogation message",
      "rf receiver",
      "protocol / identity checks",
      "authorized reply encoding",
      "rf transmitter",
      "identification display"
    ],
    "signalFlow": [
      "Interrogation message",
      "RF receiver",
      "Protocol / identity checks",
      "Authorized reply encoding",
      "RF transmitter",
      "Identification display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/electronic-compass",
    "slug": "electronic-compass",
    "name": "Electronic Compass",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Measure the magnetic field and compensate for orientation to calculate heading.",
    "longDescription": "Measure the magnetic field and compensate for orientation to calculate heading. The Electronic Compass signal path begins with magnetic field and leads to compass display. Between these endpoints, magnetometer, sensor calibration, tilt compensation, heading computation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-electronic-compass.svg",
    "status": "upcoming",
    "keywords": [
      "compass",
      "navigation",
      "magnetic field",
      "magnetometer",
      "sensor calibration",
      "tilt compensation",
      "heading computation",
      "compass display"
    ],
    "signalFlow": [
      "Magnetic field",
      "Magnetometer",
      "Sensor calibration",
      "Tilt compensation",
      "Heading computation",
      "Compass display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/gps-receiver",
    "slug": "gps-receiver",
    "name": "GPS Receiver",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Use satellite timing measurements to calculate position, velocity and time.",
    "longDescription": "Use satellite timing measurements to calculate position, velocity and time. The GPS Receiver signal path begins with satellite rf signals and leads to position / time. Between these endpoints, antenna / rf front end, correlation, pseudorange measurements, navigation solution connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-gps-receiver.svg",
    "status": "upcoming",
    "keywords": [
      "gps",
      "navigation",
      "satellite rf signals",
      "antenna / rf front end",
      "correlation",
      "pseudorange measurements",
      "navigation solution",
      "position / time"
    ],
    "signalFlow": [
      "Satellite RF signals",
      "Antenna / RF front end",
      "Correlation",
      "Pseudorange measurements",
      "Navigation solution",
      "Position / time"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/sonar-detection-system",
    "slug": "sonar-detection-system",
    "name": "Sonar Detection System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Process underwater acoustic signals to support defensive detection and observation.",
    "longDescription": "Process underwater acoustic signals to support defensive detection and observation. The Sonar Detection System signal path begins with underwater sound / echoes and leads to observation display. Between these endpoints, hydrophone array, receive front end, adc, acoustic detection / tracking connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-sonar-detection-system.svg",
    "status": "upcoming",
    "keywords": [
      "sonar",
      "sonar",
      "underwater sound / echoes",
      "hydrophone array",
      "receive front end",
      "adc",
      "acoustic detection / tracking",
      "observation display"
    ],
    "signalFlow": [
      "Underwater sound / echoes",
      "Hydrophone array",
      "Receive front end",
      "ADC",
      "Acoustic detection / tracking",
      "Observation display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/perimeter-intrusion-detection-system",
    "slug": "perimeter-intrusion-detection-system",
    "name": "Perimeter Intrusion Detection System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Interpret sensor events to detect intrusion and report location-specific alerts.",
    "longDescription": "Interpret sensor events to detect intrusion and report location-specific alerts. The Perimeter Intrusion Detection System signal path begins with perimeter sensors and leads to security console. Between these endpoints, signal conditioning, event acquisition, detection logic, alarm verification connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-perimeter-intrusion-detection-system.svg",
    "status": "upcoming",
    "keywords": [
      "perimeter",
      "security",
      "perimeter sensors",
      "signal conditioning",
      "event acquisition",
      "detection logic",
      "alarm verification",
      "security console"
    ],
    "signalFlow": [
      "Perimeter sensors",
      "Signal conditioning",
      "Event acquisition",
      "Detection logic",
      "Alarm verification",
      "Security console"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/biometric-access-system",
    "slug": "biometric-access-system",
    "name": "Biometric Access System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Extract identifying features from a captured biometric sample and compare a stored template.",
    "longDescription": "Extract identifying features from a captured biometric sample and compare a stored template. The Biometric Access System signal path begins with biometric sample and leads to access decision. Between these endpoints, sensor, digital capture, feature extraction, template matching connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-biometric-access-system.svg",
    "status": "upcoming",
    "keywords": [
      "biometric",
      "fingerprint",
      "biometric sample",
      "sensor",
      "digital capture",
      "feature extraction",
      "template matching",
      "access decision"
    ],
    "signalFlow": [
      "Biometric sample",
      "Sensor",
      "Digital capture",
      "Feature extraction",
      "Template matching",
      "Access decision"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/unmanned-surveillance-vehicle-electronics",
    "slug": "unmanned-surveillance-vehicle-electronics",
    "name": "Unmanned Surveillance Vehicle Electronics",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Coordinate vehicle sensing, navigation and observation data through an onboard computer.",
    "longDescription": "Coordinate vehicle sensing, navigation and observation data through an onboard computer. The Unmanned Surveillance Vehicle Electronics signal path begins with cameras / navigation sensors and leads to observation telemetry. Between these endpoints, perception / localization, mission controller, vehicle control outputs, communication link connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-unmanned-surveillance-vehicle-electronics.svg",
    "status": "upcoming",
    "keywords": [
      "rov",
      "drone",
      "cameras / navigation sensors",
      "perception / localization",
      "mission controller",
      "vehicle control outputs",
      "communication link",
      "observation telemetry"
    ],
    "signalFlow": [
      "Cameras / navigation sensors",
      "Perception / localization",
      "Mission controller",
      "Vehicle control outputs",
      "Communication link",
      "Observation telemetry"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/marine-radar",
    "slug": "marine-radar",
    "name": "Marine Radar",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Process returning radio echoes to estimate object range, direction or motion.",
    "longDescription": "Process returning radio echoes to estimate object range, direction or motion. The Marine Radar signal path begins with rf transmitter and leads to radar display. Between these endpoints, antenna, echo receiver, adc, range / doppler processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-marine-radar.svg",
    "status": "upcoming",
    "keywords": [
      "radar",
      "radar",
      "rf transmitter",
      "antenna",
      "echo receiver",
      "adc",
      "range / doppler processing",
      "radar display"
    ],
    "signalFlow": [
      "RF transmitter",
      "Antenna",
      "Echo receiver",
      "ADC",
      "Range / Doppler processing",
      "Radar display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/sonar",
    "slug": "sonar",
    "name": "SONAR",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Convert acoustic echoes into estimates of underwater distance or object location.",
    "longDescription": "Convert acoustic echoes into estimates of underwater distance or object location. The SONAR signal path begins with acoustic transmitter and leads to sonar display. Between these endpoints, water / target, transducer, receiver / adc, echo processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-sonar.svg",
    "status": "available",
    "keywords": [
      "sonar",
      "sonar",
      "acoustic transmitter",
      "water / target",
      "transducer",
      "receiver / adc",
      "echo processing",
      "sonar display"
    ],
    "signalFlow": [
      "Acoustic transmitter",
      "Water / target",
      "Transducer",
      "Receiver / ADC",
      "Echo processing",
      "Sonar display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/fish-finder",
    "slug": "fish-finder",
    "name": "Fish Finder",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Interpret downward acoustic echoes to show bottom structure and possible fish returns.",
    "longDescription": "Interpret downward acoustic echoes to show bottom structure and possible fish returns. The Fish Finder signal path begins with acoustic pulse and leads to fish-finder view. Between these endpoints, underwater echoes, transducer, receive acquisition, echo strength / depth analysis connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-fish-finder.svg",
    "status": "upcoming",
    "keywords": [
      "sonar",
      "sonar",
      "acoustic pulse",
      "underwater echoes",
      "transducer",
      "receive acquisition",
      "echo strength / depth analysis",
      "fish-finder view"
    ],
    "signalFlow": [
      "Acoustic pulse",
      "Underwater echoes",
      "Transducer",
      "Receive acquisition",
      "Echo strength / depth analysis",
      "Fish-finder view"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/depth-sounder",
    "slug": "depth-sounder",
    "name": "Depth Sounder",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Estimate water depth from the round-trip time of an acoustic pulse reflected by the seabed.",
    "longDescription": "Estimate water depth from the round-trip time of an acoustic pulse reflected by the seabed. The Depth Sounder signal path begins with acoustic pulse and leads to depth display. Between these endpoints, seabed reflection, transducer, echo timing, depth calculation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-depth-sounder.svg",
    "status": "upcoming",
    "keywords": [
      "sonar",
      "sonar",
      "acoustic pulse",
      "seabed reflection",
      "transducer",
      "echo timing",
      "depth calculation",
      "depth display"
    ],
    "signalFlow": [
      "Acoustic pulse",
      "Seabed reflection",
      "Transducer",
      "Echo timing",
      "Depth calculation",
      "Depth display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/gps-chartplotter",
    "slug": "gps-chartplotter",
    "name": "GPS Chartplotter",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Place a GNSS position estimate onto a digital marine chart with navigation overlays.",
    "longDescription": "Place a GNSS position estimate onto a digital marine chart with navigation overlays. The GPS Chartplotter signal path begins with satellite signals and leads to navigation display. Between these endpoints, gnss receiver, position solution, digital chart database, chart / route rendering connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-gps-chartplotter.svg",
    "status": "upcoming",
    "keywords": [
      "gps",
      "navigation",
      "satellite signals",
      "gnss receiver",
      "position solution",
      "digital chart database",
      "chart / route rendering",
      "navigation display"
    ],
    "signalFlow": [
      "Satellite signals",
      "GNSS receiver",
      "Position solution",
      "Digital chart database",
      "Chart / route rendering",
      "Navigation display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/marine-autopilot",
    "slug": "marine-autopilot",
    "name": "Marine Autopilot",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Compare the desired heading with measured vessel motion and command a steering correction.",
    "longDescription": "Compare the desired heading with measured vessel motion and command a steering correction. The Marine Autopilot signal path begins with heading target and leads to vessel feedback. Between these endpoints, compass / motion sensors, heading estimate, steering controller, rudder actuator connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-marine-autopilot.svg",
    "status": "upcoming",
    "keywords": [
      "positioning",
      "ship",
      "heading target",
      "compass / motion sensors",
      "heading estimate",
      "steering controller",
      "rudder actuator",
      "vessel feedback"
    ],
    "signalFlow": [
      "Heading target",
      "Compass / motion sensors",
      "Heading estimate",
      "Steering controller",
      "Rudder actuator",
      "Vessel feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/ais",
    "slug": "ais",
    "name": "Automatic Identification System (AIS)",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Broadcast vessel identity and navigation data and decode nearby ships\u2019 standardized messages.",
    "longDescription": "Broadcast vessel identity and navigation data and decode nearby ships\u2019 standardized messages. The Automatic Identification System (AIS) signal path begins with gnss / vessel data and leads to traffic display. Between these endpoints, ais encoder, time-slot scheduler, vhf transmitter, nearby receiver connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-ais.svg",
    "status": "upcoming",
    "keywords": [
      "ais",
      "radio",
      "gnss / vessel data",
      "ais encoder",
      "time-slot scheduler",
      "vhf transmitter",
      "nearby receiver",
      "traffic display"
    ],
    "signalFlow": [
      "GNSS / vessel data",
      "AIS encoder",
      "Time-slot scheduler",
      "VHF transmitter",
      "Nearby receiver",
      "Traffic display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/marine-vhf-radio",
    "slug": "marine-vhf-radio",
    "name": "Marine VHF Radio",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Encode and modulate data for transmission, then recover it through a receive chain.",
    "longDescription": "Encode and modulate data for transmission, then recover it through a receive chain. The Marine VHF Radio signal path begins with voice / digital data and leads to recovered data. Between these endpoints, encoding, modulation, rf front end, demodulation / decoding connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-marine-vhf-radio.svg",
    "status": "upcoming",
    "keywords": [
      "radio",
      "radio",
      "voice / digital data",
      "encoding",
      "modulation",
      "rf front end",
      "demodulation / decoding",
      "recovered data"
    ],
    "signalFlow": [
      "Voice / digital data",
      "Encoding",
      "Modulation",
      "RF front end",
      "Demodulation / decoding",
      "Recovered data"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/epirb-emergency-beacon",
    "slug": "epirb-emergency-beacon",
    "name": "EPIRB Emergency Beacon",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Encode identification and location into emergency radio messages for a rescue network.",
    "longDescription": "Encode identification and location into emergency radio messages for a rescue network. The EPIRB Emergency Beacon signal path begins with activation / gnss and leads to rescue satellite. Between these endpoints, beacon controller, identity encoding, rf power stage, antenna connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-epirb-emergency-beacon.svg",
    "status": "upcoming",
    "keywords": [
      "beacon",
      "beacon",
      "activation / gnss",
      "beacon controller",
      "identity encoding",
      "rf power stage",
      "antenna",
      "rescue satellite"
    ],
    "signalFlow": [
      "Activation / GNSS",
      "Beacon controller",
      "Identity encoding",
      "RF power stage",
      "Antenna",
      "Rescue satellite"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/digital-engine-control",
    "slug": "digital-engine-control",
    "name": "Digital Engine Control",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Process engine measurements to coordinate control outputs and report operating conditions.",
    "longDescription": "Process engine measurements to coordinate control outputs and report operating conditions. The Digital Engine Control signal path begins with engine sensors and leads to engine feedback. Between these endpoints, signal conditioning, adc / bus input, engine controller, fuel / actuator command connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-digital-engine-control.svg",
    "status": "upcoming",
    "keywords": [
      "engine",
      "controller",
      "engine sensors",
      "signal conditioning",
      "adc / bus input",
      "engine controller",
      "fuel / actuator command",
      "engine feedback"
    ],
    "signalFlow": [
      "Engine sensors",
      "Signal conditioning",
      "ADC / bus input",
      "Engine controller",
      "Fuel / actuator command",
      "Engine feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/dynamic-positioning-system",
    "slug": "dynamic-positioning-system",
    "name": "Dynamic Positioning System",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Fuse position references and motion sensors to hold vessel position with coordinated thrusters.",
    "longDescription": "Fuse position references and motion sensors to hold vessel position with coordinated thrusters. The Dynamic Positioning System signal path begins with position target and leads to vessel position feedback. Between these endpoints, gnss / motion references, state estimation, thrust allocation, thruster controllers connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-dynamic-positioning-system.svg",
    "status": "upcoming",
    "keywords": [
      "positioning",
      "ship",
      "position target",
      "gnss / motion references",
      "state estimation",
      "thrust allocation",
      "thruster controllers",
      "vessel position feedback"
    ],
    "signalFlow": [
      "Position target",
      "GNSS / motion references",
      "State estimation",
      "Thrust allocation",
      "Thruster controllers",
      "Vessel position feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/underwater-rov-control-system",
    "slug": "underwater-rov-control-system",
    "name": "Underwater ROV Control System",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Combine operator commands and underwater sensor feedback to control propulsion and observation.",
    "longDescription": "Combine operator commands and underwater sensor feedback to control propulsion and observation. The Underwater ROV Control System signal path begins with operator / mission input and leads to telemetry / video. Between these endpoints, control link, vehicle controller, thruster drivers, underwater sensors connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-underwater-rov-control-system.svg",
    "status": "upcoming",
    "keywords": [
      "rov",
      "rov",
      "operator / mission input",
      "control link",
      "vehicle controller",
      "thruster drivers",
      "underwater sensors",
      "telemetry / video"
    ],
    "signalFlow": [
      "Operator / mission input",
      "Control link",
      "Vehicle controller",
      "Thruster drivers",
      "Underwater sensors",
      "Telemetry / video"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/autonomous-underwater-vehicle-navigation",
    "slug": "autonomous-underwater-vehicle-navigation",
    "name": "Autonomous Underwater Vehicle Navigation",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Combine inertial, acoustic and velocity measurements to estimate an underwater vehicle\u2019s position.",
    "longDescription": "Combine inertial, acoustic and velocity measurements to estimate an underwater vehicle\u2019s position. The Autonomous Underwater Vehicle Navigation signal path begins with imu / acoustic / velocity sensors and leads to navigation telemetry. Between these endpoints, sensor acquisition, navigation filter, mission planner, vehicle controller connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/marine-autonomous-underwater-vehicle-navigation.svg",
    "status": "upcoming",
    "keywords": [
      "rov",
      "rov",
      "imu / acoustic / velocity sensors",
      "sensor acquisition",
      "navigation filter",
      "mission planner",
      "vehicle controller",
      "navigation telemetry"
    ],
    "signalFlow": [
      "IMU / acoustic / velocity sensors",
      "Sensor acquisition",
      "Navigation filter",
      "Mission planner",
      "Vehicle controller",
      "Navigation telemetry"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/robotic-arm",
    "slug": "robotic-arm",
    "name": "Robotic Arm",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Transform a desired pose into coordinated joint motion using motor feedback.",
    "longDescription": "Transform a desired pose into coordinated joint motion using motor feedback. The Robotic Arm signal path begins with target pose and leads to position feedback. Between these endpoints, inverse kinematics, trajectory planner, servo drives, joint motors / encoders connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-robotic-arm.svg",
    "status": "available",
    "keywords": [
      "arm",
      "arm",
      "target pose",
      "inverse kinematics",
      "trajectory planner",
      "servo drives",
      "joint motors / encoders",
      "position feedback"
    ],
    "signalFlow": [
      "Target pose",
      "Inverse kinematics",
      "Trajectory planner",
      "Servo drives",
      "Joint motors / encoders",
      "Position feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/servo-motor-controller",
    "slug": "servo-motor-controller",
    "name": "Servo Motor Controller",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Compare commanded and measured position to regulate motor torque through a feedback loop.",
    "longDescription": "Compare commanded and measured position to regulate motor torque through a feedback loop. The Servo Motor Controller signal path begins with position target and leads to motor motion. Between these endpoints, encoder feedback, position / velocity control, current controller, power driver connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-servo-motor-controller.svg",
    "status": "upcoming",
    "keywords": [
      "motor",
      "motor",
      "position target",
      "encoder feedback",
      "position / velocity control",
      "current controller",
      "power driver",
      "motor motion"
    ],
    "signalFlow": [
      "Position target",
      "Encoder feedback",
      "Position / velocity control",
      "Current controller",
      "Power driver",
      "Motor motion"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/stepper-motor-controller",
    "slug": "stepper-motor-controller",
    "name": "Stepper Motor Controller",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Translate motion commands into sequenced winding currents that advance a motor in steps.",
    "longDescription": "Translate motion commands into sequenced winding currents that advance a motor in steps. The Stepper Motor Controller signal path begins with motion command and leads to rotor steps. Between these endpoints, step / direction logic, microstep sequencer, current-regulated driver, motor windings connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-stepper-motor-controller.svg",
    "status": "upcoming",
    "keywords": [
      "motor",
      "motor",
      "motion command",
      "step / direction logic",
      "microstep sequencer",
      "current-regulated driver",
      "motor windings",
      "rotor steps"
    ],
    "signalFlow": [
      "Motion command",
      "Step / direction logic",
      "Microstep sequencer",
      "Current-regulated driver",
      "Motor windings",
      "Rotor steps"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/mobile-robot",
    "slug": "mobile-robot",
    "name": "Mobile Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Combine environmental sensors and a motion planner to control a mobile platform.",
    "longDescription": "Combine environmental sensors and a motion planner to control a mobile platform. The Mobile Robot signal path begins with environmental sensors and leads to movement feedback. Between these endpoints, perception, localization / planner, motion controller, wheel / leg drives connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-mobile-robot.svg",
    "status": "upcoming",
    "keywords": [
      "robot",
      "robot",
      "environmental sensors",
      "perception",
      "localization / planner",
      "motion controller",
      "wheel / leg drives",
      "movement feedback"
    ],
    "signalFlow": [
      "Environmental sensors",
      "Perception",
      "Localization / planner",
      "Motion controller",
      "Wheel / leg drives",
      "Movement feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/line-following-robot",
    "slug": "line-following-robot",
    "name": "Line-Following Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Use reflected-light measurements to adjust wheel speeds along a marked path.",
    "longDescription": "Use reflected-light measurements to adjust wheel speeds along a marked path. The Line-Following Robot signal path begins with track reflection and leads to path feedback. Between these endpoints, ir sensor array, threshold / position estimate, steering controller, wheel motors connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-line-following-robot.svg",
    "status": "upcoming",
    "keywords": [
      "line",
      "robot",
      "track reflection",
      "ir sensor array",
      "threshold / position estimate",
      "steering controller",
      "wheel motors",
      "path feedback"
    ],
    "signalFlow": [
      "Track reflection",
      "IR sensor array",
      "Threshold / position estimate",
      "Steering controller",
      "Wheel motors",
      "Path feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/self-balancing-robot",
    "slug": "self-balancing-robot",
    "name": "Self-Balancing Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Estimate tilt and adjust wheel torque to keep a robot balanced.",
    "longDescription": "Estimate tilt and adjust wheel torque to keep a robot balanced. The Self-Balancing Robot signal path begins with imu measurements and leads to tilt feedback. Between these endpoints, tilt estimation, balance controller, motor drivers, wheel torque connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-self-balancing-robot.svg",
    "status": "upcoming",
    "keywords": [
      "balance",
      "robot",
      "imu measurements",
      "tilt estimation",
      "balance controller",
      "motor drivers",
      "wheel torque",
      "tilt feedback"
    ],
    "signalFlow": [
      "IMU measurements",
      "Tilt estimation",
      "Balance controller",
      "Motor drivers",
      "Wheel torque",
      "Tilt feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/autonomous-mobile-robot",
    "slug": "autonomous-mobile-robot",
    "name": "Autonomous Mobile Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Combine environmental sensors and a motion planner to control a mobile platform.",
    "longDescription": "Combine environmental sensors and a motion planner to control a mobile platform. The Autonomous Mobile Robot signal path begins with environmental sensors and leads to movement feedback. Between these endpoints, perception, localization / planner, motion controller, wheel / leg drives connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-autonomous-mobile-robot.svg",
    "status": "upcoming",
    "keywords": [
      "robot",
      "robot",
      "environmental sensors",
      "perception",
      "localization / planner",
      "motion controller",
      "wheel / leg drives",
      "movement feedback"
    ],
    "signalFlow": [
      "Environmental sensors",
      "Perception",
      "Localization / planner",
      "Motion controller",
      "Wheel / leg drives",
      "Movement feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/warehouse-robot",
    "slug": "warehouse-robot",
    "name": "Warehouse Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Combine environmental sensors and a motion planner to control a mobile platform.",
    "longDescription": "Combine environmental sensors and a motion planner to control a mobile platform. The Warehouse Robot signal path begins with environmental sensors and leads to movement feedback. Between these endpoints, perception, localization / planner, motion controller, wheel / leg drives connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-warehouse-robot.svg",
    "status": "upcoming",
    "keywords": [
      "robot",
      "robot",
      "environmental sensors",
      "perception",
      "localization / planner",
      "motion controller",
      "wheel / leg drives",
      "movement feedback"
    ],
    "signalFlow": [
      "Environmental sensors",
      "Perception",
      "Localization / planner",
      "Motion controller",
      "Wheel / leg drives",
      "Movement feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/industrial-robot-controller",
    "slug": "industrial-robot-controller",
    "name": "Industrial Robot Controller",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Coordinate robot trajectories, axis drives and interlocks in an industrial control cabinet.",
    "longDescription": "Coordinate robot trajectories, axis drives and interlocks in an industrial control cabinet. The Industrial Robot Controller signal path begins with robot program and leads to controller status. Between these endpoints, trajectory planner, axis coordination, servo drive commands, encoder / safety feedback connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-industrial-robot-controller.svg",
    "status": "upcoming",
    "keywords": [
      "motor",
      "controller",
      "robot program",
      "trajectory planner",
      "axis coordination",
      "servo drive commands",
      "encoder / safety feedback",
      "controller status"
    ],
    "signalFlow": [
      "Robot program",
      "Trajectory planner",
      "Axis coordination",
      "Servo drive commands",
      "Encoder / safety feedback",
      "Controller status"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/machine-vision-system",
    "slug": "machine-vision-system",
    "name": "Machine-Vision System",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Analyze camera images to extract positions, measurements or inspection results.",
    "longDescription": "Analyze camera images to extract positions, measurements or inspection results. The Machine-Vision System signal path begins with scene illumination and leads to automation output. Between these endpoints, camera / optics, image capture, feature processing, inspection / pose decision connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-machine-vision-system.svg",
    "status": "upcoming",
    "keywords": [
      "camera",
      "camera",
      "scene illumination",
      "camera / optics",
      "image capture",
      "feature processing",
      "inspection / pose decision",
      "automation output"
    ],
    "signalFlow": [
      "Scene illumination",
      "Camera / optics",
      "Image capture",
      "Feature processing",
      "Inspection / pose decision",
      "Automation output"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/lidar-mapping-robot",
    "slug": "lidar-mapping-robot",
    "name": "LiDAR Mapping Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Measure laser returns across a scene and combine them into a spatial map.",
    "longDescription": "Measure laser returns across a scene and combine them into a spatial map. The LiDAR Mapping Robot signal path begins with scanning laser and leads to navigation map. Between these endpoints, scene reflection, return timing, point cloud, localization / mapping connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-lidar-mapping-robot.svg",
    "status": "upcoming",
    "keywords": [
      "lidar",
      "laser",
      "scanning laser",
      "scene reflection",
      "return timing",
      "point cloud",
      "localization / mapping",
      "navigation map"
    ],
    "signalFlow": [
      "Scanning laser",
      "Scene reflection",
      "Return timing",
      "Point cloud",
      "Localization / mapping",
      "Navigation map"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/slam-navigation-system",
    "slug": "slam-navigation-system",
    "name": "SLAM Navigation System",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Match observations over time to build a map while estimating the robot\u2019s position.",
    "longDescription": "Match observations over time to build a map while estimating the robot\u2019s position. The SLAM Navigation System signal path begins with camera / lidar / odometry and leads to navigation planner. Between these endpoints, feature extraction, data association, pose estimation, map update connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-slam-navigation-system.svg",
    "status": "upcoming",
    "keywords": [
      "slam",
      "robot",
      "camera / lidar / odometry",
      "feature extraction",
      "data association",
      "pose estimation",
      "map update",
      "navigation planner"
    ],
    "signalFlow": [
      "Camera / LiDAR / odometry",
      "Feature extraction",
      "Data association",
      "Pose estimation",
      "Map update",
      "Navigation planner"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/collaborative-robot",
    "slug": "collaborative-robot",
    "name": "Collaborative Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Coordinate joint movement with force feedback and supervisory safety monitoring.",
    "longDescription": "Coordinate joint movement with force feedback and supervisory safety monitoring. The Collaborative Robot signal path begins with task target and leads to motion feedback. Between these endpoints, kinematics / trajectory, joint servo control, torque / position sensors, safety monitoring connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-collaborative-robot.svg",
    "status": "upcoming",
    "keywords": [
      "arm",
      "arm",
      "task target",
      "kinematics / trajectory",
      "joint servo control",
      "torque / position sensors",
      "safety monitoring",
      "motion feedback"
    ],
    "signalFlow": [
      "Task target",
      "Kinematics / trajectory",
      "Joint servo control",
      "Torque / position sensors",
      "Safety monitoring",
      "Motion feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "robotics/quadruped-robot",
    "slug": "quadruped-robot",
    "name": "Quadruped Robot",
    "category": "robotics",
    "categories": [
      "robotics"
    ],
    "shortDescription": "Fuse body motion and contact information to coordinate the movement of four articulated legs.",
    "longDescription": "Fuse body motion and contact information to coordinate the movement of four articulated legs. The Quadruped Robot signal path begins with imu / joint / contact sensors and leads to balance feedback. Between these endpoints, body-state estimate, gait planner, joint control, leg actuators connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/robotics-quadruped-robot.svg",
    "status": "upcoming",
    "keywords": [
      "robot",
      "quadruped",
      "imu / joint / contact sensors",
      "body-state estimate",
      "gait planner",
      "joint control",
      "leg actuators",
      "balance feedback"
    ],
    "signalFlow": [
      "IMU / joint / contact sensors",
      "Body-state estimate",
      "Gait planner",
      "Joint control",
      "Leg actuators",
      "Balance feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/tv-remote",
    "slug": "tv-remote",
    "name": "TV Remote Control",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Follow a button press from key matrix to IR modulation and the television receiver.",
    "longDescription": "Follow a button press from key matrix to IR modulation and the television receiver. The TV Remote Control signal path begins with button matrix and leads to television receiver. Between these endpoints, mcu, command encoder, 38 khz modulator, ir led connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-tv-remote.svg",
    "status": "available",
    "keywords": [
      "remote",
      "remote",
      "button matrix",
      "mcu",
      "command encoder",
      "38 khz modulator",
      "ir led",
      "television receiver"
    ],
    "signalFlow": [
      "Button matrix",
      "MCU",
      "Command encoder",
      "38 kHz modulator",
      "IR LED",
      "Television receiver"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/television",
    "slug": "television",
    "name": "Television",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Decode incoming media and transform compressed video and audio into synchronized output.",
    "longDescription": "Decode incoming media and transform compressed video and audio into synchronized output. The Television signal path begins with broadcast / media input and leads to screen / speakers. Between these endpoints, demodulator / interface, media decoder, image processing, display driver connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-television.svg",
    "status": "upcoming",
    "keywords": [
      "television",
      "television",
      "broadcast / media input",
      "demodulator / interface",
      "media decoder",
      "image processing",
      "display driver",
      "screen / speakers"
    ],
    "signalFlow": [
      "Broadcast / media input",
      "Demodulator / interface",
      "Media decoder",
      "Image processing",
      "Display driver",
      "Screen / speakers"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/smartphone",
    "slug": "smartphone",
    "name": "Smartphone",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Coordinate touch, sensors, radio links and applications through a mobile system on chip.",
    "longDescription": "Coordinate touch, sensors, radio links and applications through a mobile system on chip. The Smartphone signal path begins with touch / sensors / radios and leads to screen / speakers. Between these endpoints, interface controllers, mobile soc, memory / operating system, graphics / audio pipeline connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-smartphone.svg",
    "status": "available",
    "keywords": [
      "phone",
      "phone",
      "touch / sensors / radios",
      "interface controllers",
      "mobile soc",
      "memory / operating system",
      "graphics / audio pipeline",
      "screen / speakers"
    ],
    "signalFlow": [
      "Touch / sensors / radios",
      "Interface controllers",
      "Mobile SoC",
      "Memory / operating system",
      "Graphics / audio pipeline",
      "Screen / speakers"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/digital-camera",
    "slug": "digital-camera",
    "name": "Digital Camera",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Convert focused light into pixel values and process them into a digital image.",
    "longDescription": "Convert focused light into pixel values and process them into a digital image. The Digital Camera signal path begins with light / lens and leads to image / video. Between these endpoints, image sensor, pixel readout, adc, image signal processor connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-digital-camera.svg",
    "status": "available",
    "keywords": [
      "camera",
      "camera",
      "light / lens",
      "image sensor",
      "pixel readout",
      "adc",
      "image signal processor",
      "image / video"
    ],
    "signalFlow": [
      "Light / lens",
      "Image sensor",
      "Pixel readout",
      "ADC",
      "Image signal processor",
      "Image / video"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/ir-camera",
    "slug": "ir-camera",
    "name": "IR Camera",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Map infrared radiation onto a detector array and convert it into a temperature-related image.",
    "longDescription": "Map infrared radiation onto a detector array and convert it into a temperature-related image. The IR Camera signal path begins with infrared radiation and leads to thermal image. Between these endpoints, ir optics, detector array, readout / adc, correction / image processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-ir-camera.svg",
    "status": "upcoming",
    "keywords": [
      "thermal",
      "thermal",
      "infrared radiation",
      "ir optics",
      "detector array",
      "readout / adc",
      "correction / image processing",
      "thermal image"
    ],
    "signalFlow": [
      "Infrared radiation",
      "IR optics",
      "Detector array",
      "Readout / ADC",
      "Correction / image processing",
      "Thermal image"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/cctv-camera",
    "slug": "cctv-camera",
    "name": "CCTV Camera",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Acquire video frames, compress them and deliver a surveillance stream to a recorder or network.",
    "longDescription": "Acquire video frames, compress them and deliver a surveillance stream to a recorder or network. The CCTV Camera signal path begins with scene / lens and leads to recorder / network stream. Between these endpoints, image sensor, pixel acquisition, image processor, video compression connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-cctv-camera.svg",
    "status": "upcoming",
    "keywords": [
      "camera",
      "cctv",
      "scene / lens",
      "image sensor",
      "pixel acquisition",
      "image processor",
      "video compression",
      "recorder / network stream"
    ],
    "signalFlow": [
      "Scene / lens",
      "Image sensor",
      "Pixel acquisition",
      "Image processor",
      "Video compression",
      "Recorder / network stream"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/wi-fi-router",
    "slug": "wi-fi-router",
    "name": "Wi-Fi Router",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Receive network frames, route packets and transmit them through wired or wireless interfaces.",
    "longDescription": "Receive network frames, route packets and transmit them through wired or wireless interfaces. The Wi-Fi Router signal path begins with ethernet / wi-fi input and leads to network interface. Between these endpoints, phy / mac, packet buffers, routing / switching, output queues connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-wi-fi-router.svg",
    "status": "upcoming",
    "keywords": [
      "router",
      "router",
      "ethernet / wi-fi input",
      "phy / mac",
      "packet buffers",
      "routing / switching",
      "output queues",
      "network interface"
    ],
    "signalFlow": [
      "Ethernet / Wi-Fi input",
      "PHY / MAC",
      "Packet buffers",
      "Routing / switching",
      "Output queues",
      "Network interface"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/bluetooth-headphones",
    "slug": "bluetooth-headphones",
    "name": "Bluetooth Headphones",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Decode wireless audio packets and transform digital samples into sound.",
    "longDescription": "Decode wireless audio packets and transform digital samples into sound. The Bluetooth Headphones signal path begins with bluetooth rf and leads to headphone drivers. Between these endpoints, baseband decoder, audio codec, audio dsp, dac / amplifier connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-bluetooth-headphones.svg",
    "status": "upcoming",
    "keywords": [
      "bluetooth",
      "headphones",
      "bluetooth rf",
      "baseband decoder",
      "audio codec",
      "audio dsp",
      "dac / amplifier",
      "headphone drivers"
    ],
    "signalFlow": [
      "Bluetooth RF",
      "Baseband decoder",
      "Audio codec",
      "Audio DSP",
      "DAC / amplifier",
      "Headphone drivers"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/smartwatch",
    "slug": "smartwatch",
    "name": "Smartwatch",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Combine motion, optical pulse and touch inputs in a compact wearable computing system.",
    "longDescription": "Combine motion, optical pulse and touch inputs in a compact wearable computing system. The Smartwatch signal path begins with motion / optical / touch sensors and leads to screen / wireless sync. Between these endpoints, sensor interfaces, wearable processor, application / health processing, display driver connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-smartwatch.svg",
    "status": "upcoming",
    "keywords": [
      "pulse",
      "watch",
      "motion / optical / touch sensors",
      "sensor interfaces",
      "wearable processor",
      "application / health processing",
      "display driver",
      "screen / wireless sync"
    ],
    "signalFlow": [
      "Motion / optical / touch sensors",
      "Sensor interfaces",
      "Wearable processor",
      "Application / health processing",
      "Display driver",
      "Screen / wireless sync"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/nfc-payment-system",
    "slug": "nfc-payment-system",
    "name": "NFC Payment System",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Exchange short-range radio data between a reader and a nearby payment credential.",
    "longDescription": "Exchange short-range radio data between a reader and a nearby payment credential. The NFC Payment System signal path begins with reader rf field and leads to payment-system response. Between these endpoints, phone / card antenna, nfc interface, protocol exchange, secure credential processing connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-nfc-payment-system.svg",
    "status": "available",
    "keywords": [
      "nfc",
      "nfc",
      "reader rf field",
      "phone / card antenna",
      "nfc interface",
      "protocol exchange",
      "secure credential processing",
      "payment-system response"
    ],
    "signalFlow": [
      "Reader RF field",
      "Phone / card antenna",
      "NFC interface",
      "Protocol exchange",
      "Secure credential processing",
      "Payment-system response"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/rfid-access-card",
    "slug": "rfid-access-card",
    "name": "RFID Access Card",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Harvest reader-field energy and exchange an identifier with an access-control reader.",
    "longDescription": "Harvest reader-field energy and exchange an identifier with an access-control reader. The RFID Access Card signal path begins with reader rf field and leads to reader validation. Between these endpoints, card antenna, rectifier / chip, rfid protocol, credential identifier connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-rfid-access-card.svg",
    "status": "upcoming",
    "keywords": [
      "identity",
      "rfid",
      "reader rf field",
      "card antenna",
      "rectifier / chip",
      "rfid protocol",
      "credential identifier",
      "reader validation"
    ],
    "signalFlow": [
      "Reader RF field",
      "Card antenna",
      "Rectifier / chip",
      "RFID protocol",
      "Credential identifier",
      "Reader validation"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/barcode-scanner",
    "slug": "barcode-scanner",
    "name": "Barcode Scanner",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Capture an optical code and decode its pattern into a digital identifier.",
    "longDescription": "Capture an optical code and decode its pattern into a digital identifier. The Barcode Scanner signal path begins with printed code and leads to identifier output. Between these endpoints, illumination / optics, image / line sensor, digital capture, code decoding connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-barcode-scanner.svg",
    "status": "upcoming",
    "keywords": [
      "barcode",
      "scanner",
      "printed code",
      "illumination / optics",
      "image / line sensor",
      "digital capture",
      "code decoding",
      "identifier output"
    ],
    "signalFlow": [
      "Printed code",
      "Illumination / optics",
      "Image / line sensor",
      "Digital capture",
      "Code decoding",
      "Identifier output"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/qr-code-scanner",
    "slug": "qr-code-scanner",
    "name": "QR Code Scanner",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Capture a two-dimensional code and recover its data using pattern detection and error correction.",
    "longDescription": "Capture a two-dimensional code and recover its data using pattern detection and error correction. The QR Code Scanner signal path begins with qr pattern and leads to decoded data. Between these endpoints, camera, digital image, finder / alignment detection, error-correcting decode connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-qr-code-scanner.svg",
    "status": "upcoming",
    "keywords": [
      "barcode",
      "phone",
      "qr pattern",
      "camera",
      "digital image",
      "finder / alignment detection",
      "error-correcting decode",
      "decoded data"
    ],
    "signalFlow": [
      "QR pattern",
      "Camera",
      "Digital image",
      "Finder / alignment detection",
      "Error-correcting decode",
      "Decoded data"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/biometric-fingerprint-scanner",
    "slug": "biometric-fingerprint-scanner",
    "name": "Biometric Fingerprint Scanner",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Extract identifying features from a captured biometric sample and compare a stored template.",
    "longDescription": "Extract identifying features from a captured biometric sample and compare a stored template. The Biometric Fingerprint Scanner signal path begins with biometric sample and leads to access decision. Between these endpoints, sensor, digital capture, feature extraction, template matching connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-biometric-fingerprint-scanner.svg",
    "status": "upcoming",
    "keywords": [
      "biometric",
      "fingerprint",
      "biometric sample",
      "sensor",
      "digital capture",
      "feature extraction",
      "template matching",
      "access decision"
    ],
    "signalFlow": [
      "Biometric sample",
      "Sensor",
      "Digital capture",
      "Feature extraction",
      "Template matching",
      "Access decision"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/digital-door-lock",
    "slug": "digital-door-lock",
    "name": "Digital Door Lock",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Validate a credential and coordinate a lock actuator with door-state feedback.",
    "longDescription": "Validate a credential and coordinate a lock actuator with door-state feedback. The Digital Door Lock signal path begins with credential input and leads to door sensor / log. Between these endpoints, reader / keypad, validation controller, access policy, lock actuator connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-digital-door-lock.svg",
    "status": "upcoming",
    "keywords": [
      "lock",
      "lock",
      "credential input",
      "reader / keypad",
      "validation controller",
      "access policy",
      "lock actuator",
      "door sensor / log"
    ],
    "signalFlow": [
      "Credential input",
      "Reader / keypad",
      "Validation controller",
      "Access policy",
      "Lock actuator",
      "Door sensor / log"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/microwave-oven-controller",
    "slug": "microwave-oven-controller",
    "name": "Microwave Oven Controller",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Sequence cooking time and supervise door-state checks and power-control outputs.",
    "longDescription": "Sequence cooking time and supervise door-state checks and power-control outputs. The Microwave Oven Controller signal path begins with keypad / time setting and leads to display / cycle feedback. Between these endpoints, door / temperature inputs, control mcu, timing / interlock logic, power control outputs connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-microwave-oven-controller.svg",
    "status": "upcoming",
    "keywords": [
      "appliance",
      "microwave",
      "keypad / time setting",
      "door / temperature inputs",
      "control mcu",
      "timing / interlock logic",
      "power control outputs",
      "display / cycle feedback"
    ],
    "signalFlow": [
      "Keypad / time setting",
      "Door / temperature inputs",
      "Control MCU",
      "Timing / interlock logic",
      "Power control outputs",
      "Display / cycle feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/washing-machine-controller",
    "slug": "washing-machine-controller",
    "name": "Washing Machine Controller",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Coordinate fill, wash, rinse and spin stages using water, temperature and motor feedback.",
    "longDescription": "Coordinate fill, wash, rinse and spin stages using water, temperature and motor feedback. The Washing Machine Controller signal path begins with cycle settings and leads to cycle feedback. Between these endpoints, water / temperature / speed sensors, control mcu, cycle sequencing, valve / heater / motor drives connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-washing-machine-controller.svg",
    "status": "upcoming",
    "keywords": [
      "appliance",
      "appliance",
      "cycle settings",
      "water / temperature / speed sensors",
      "control mcu",
      "cycle sequencing",
      "valve / heater / motor drives",
      "cycle feedback"
    ],
    "signalFlow": [
      "Cycle settings",
      "Water / temperature / speed sensors",
      "Control MCU",
      "Cycle sequencing",
      "Valve / heater / motor drives",
      "Cycle feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/induction-cooktop",
    "slug": "induction-cooktop",
    "name": "Induction Cooktop",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Control a high-frequency power stage using temperature and pan-detection feedback.",
    "longDescription": "Control a high-frequency power stage using temperature and pan-detection feedback. The Induction Cooktop signal path begins with user power setting and leads to heating feedback. Between these endpoints, pan / temperature sensing, control mcu, inverter drive, induction coil connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-induction-cooktop.svg",
    "status": "upcoming",
    "keywords": [
      "induction",
      "cooktop",
      "user power setting",
      "pan / temperature sensing",
      "control mcu",
      "inverter drive",
      "induction coil",
      "heating feedback"
    ],
    "signalFlow": [
      "User power setting",
      "Pan / temperature sensing",
      "Control MCU",
      "Inverter drive",
      "Induction coil",
      "Heating feedback"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/smart-energy-meter",
    "slug": "smart-energy-meter",
    "name": "Smart Energy Meter",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Sample voltage and current to calculate power and accumulate energy use.",
    "longDescription": "Sample voltage and current to calculate power and accumulate energy use. The Smart Energy Meter signal path begins with voltage / current sensors and leads to display / communication. Between these endpoints, analog front end, adc, power calculation, energy accumulator connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-smart-energy-meter.svg",
    "status": "upcoming",
    "keywords": [
      "energy",
      "meter",
      "voltage / current sensors",
      "analog front end",
      "adc",
      "power calculation",
      "energy accumulator",
      "display / communication"
    ],
    "signalFlow": [
      "Voltage / current sensors",
      "Analog front end",
      "ADC",
      "Power calculation",
      "Energy accumulator",
      "Display / communication"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/digital-multimeter",
    "slug": "digital-multimeter",
    "name": "Digital Multimeter",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Select a measurement range and convert conditioned electrical inputs into a digital reading.",
    "longDescription": "Select a measurement range and convert conditioned electrical inputs into a digital reading. The Digital Multimeter signal path begins with electrical input and leads to numeric display. Between these endpoints, protection / range selection, signal conditioning, adc, measurement processor connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/everyday-digital-multimeter.svg",
    "status": "upcoming",
    "keywords": [
      "multimeter",
      "multimeter",
      "electrical input",
      "protection / range selection",
      "signal conditioning",
      "adc",
      "measurement processor",
      "numeric display"
    ],
    "signalFlow": [
      "Electrical input",
      "Protection / range selection",
      "Signal conditioning",
      "ADC",
      "Measurement processor",
      "Numeric display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/inertial-navigation-system",
    "slug": "inertial-navigation-system",
    "name": "Inertial Navigation System",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Integrate measured rotation and acceleration to estimate orientation and movement.",
    "longDescription": "Integrate measured rotation and acceleration to estimate orientation and movement. The Inertial Navigation System signal path begins with gyroscopes / accelerometers and leads to position / attitude. Between these endpoints, sensor readout, calibration, attitude integration, navigation filter connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-inertial-navigation-system.svg",
    "status": "upcoming",
    "keywords": [
      "inertial",
      "navigation",
      "gyroscopes / accelerometers",
      "sensor readout",
      "calibration",
      "attitude integration",
      "navigation filter",
      "position / attitude"
    ],
    "signalFlow": [
      "Gyroscopes / accelerometers",
      "Sensor readout",
      "Calibration",
      "Attitude integration",
      "Navigation filter",
      "Position / attitude"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "defence/satellite-communication-terminal",
    "slug": "satellite-communication-terminal",
    "name": "Satellite Communication Terminal",
    "category": "defence",
    "categories": [
      "defence"
    ],
    "shortDescription": "Track a satellite link and convert between digital messages and modulated radio signals.",
    "longDescription": "Track a satellite link and convert between digital messages and modulated radio signals. The Satellite Communication Terminal signal path begins with digital messages and leads to satellite link. Between these endpoints, channel coding, modem, rf up / down conversion, pointed antenna connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/aviation-satellite-communication-terminal.svg",
    "status": "upcoming",
    "keywords": [
      "satellite",
      "dish",
      "digital messages",
      "channel coding",
      "modem",
      "rf up / down conversion",
      "pointed antenna",
      "satellite link"
    ],
    "signalFlow": [
      "Digital messages",
      "Channel coding",
      "Modem",
      "RF up / down conversion",
      "Pointed antenna",
      "Satellite link"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "marine/electronic-compass",
    "slug": "electronic-compass",
    "name": "Electronic Compass",
    "category": "marine",
    "categories": [
      "marine"
    ],
    "shortDescription": "Measure the magnetic field and compensate for orientation to calculate heading.",
    "longDescription": "Measure the magnetic field and compensate for orientation to calculate heading. The Electronic Compass signal path begins with magnetic field and leads to compass display. Between these endpoints, magnetometer, sensor calibration, tilt compensation, heading computation connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-electronic-compass.svg",
    "status": "upcoming",
    "keywords": [
      "compass",
      "navigation",
      "magnetic field",
      "magnetometer",
      "sensor calibration",
      "tilt compensation",
      "heading computation",
      "compass display"
    ],
    "signalFlow": [
      "Magnetic field",
      "Magnetometer",
      "Sensor calibration",
      "Tilt compensation",
      "Heading computation",
      "Compass display"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  },
  {
    "id": "everyday/gps-receiver",
    "slug": "gps-receiver",
    "name": "GPS Receiver",
    "category": "everyday",
    "categories": [
      "everyday"
    ],
    "shortDescription": "Use satellite timing measurements to calculate position, velocity and time.",
    "longDescription": "Use satellite timing measurements to calculate position, velocity and time. The GPS Receiver signal path begins with satellite rf signals and leads to position / time. Between these endpoints, antenna / rf front end, correlation, pseudorange measurements, navigation solution connect the physical system to its digital processing and output.",
    "thumbnail": "/devices/defence-gps-receiver.svg",
    "status": "upcoming",
    "keywords": [
      "gps",
      "navigation",
      "satellite rf signals",
      "antenna / rf front end",
      "correlation",
      "pseudorange measurements",
      "navigation solution",
      "position / time"
    ],
    "signalFlow": [
      "Satellite RF signals",
      "Antenna / RF front end",
      "Correlation",
      "Pseudorange measurements",
      "Navigation solution",
      "Position / time"
    ],
    "futureFeatures": [
      "anatomy",
      "signal",
      "logic",
      "waveforms",
      "simulation",
      "failure"
    ]
  }
];

// src/studios/how-devices-work/advanced/security-data.ts
var SECURITY_DEFINITIONS = [
  { number: 85, id: "defence/laser-range-finder", mockup: "085 - Laser Range Finder.png", theme: "light", family: "laser-ranging", subtitle: "Measure distance with light.", principle: "A timed laser pulse reflects from a target into a photodetector. A transimpedance amplifier, filter and timing discriminator estimate the round-trip interval. Distance is c \xD7 delay / 2. Synthetic timing jitter and reflectivity illustrate measurement uncertainty; no laser is operated.", parts: ["Laser diode", "Transmit optics", "Receiver lens", "Photodiode / APD", "Transimpedance amplifier", "Timing discriminator", "Time-to-digital converter", "MCU", "OLED display"], steps: [["Laser emission", "The driver generates a short optical pulse."], ["Propagation", "Light travels toward the target at the speed of light."], ["Reflection", "The surface returns a fraction of the incident light."], ["Reception", "The receiver lens focuses returned light on a photodetector."], ["Signal processing", "A TIA amplifies detector current and filtering reduces noise."], ["Distance calculation", "A timing circuit measures round-trip delay; d = c\u0394t/2."], ["Output", "Display distance and measurement quality."]], architecture: { inputs: ["Measurement trigger", "Reflected laser pulse"], processing: ["Laser driver / emitter", "Photodiode \u2192 TIA \u2192 filter", "Comparator / TDC", "Range processor"], outputs: ["Distance display", "Measurement quality", "Data interface"] }, controls: "distance:Target distance:250:5:1000:5:m|reflectivity:Surface reflectivity:50:5:95:5:%|jitter:Timing jitter:2:0.1:10:0.1:ns", modes: ["Tree", "Bright target", "Dark target"], applications: ["Surveying", "Construction", "Robot perception", "Mapping", "Industrial measurement"], safety: ["Eye safety depends on the actual laser product and class.", "Weak reflection increases timing uncertainty.", "The teaching pulse has no physical emission."], quiz: ["Why divide optical round-trip distance by two?", "The pulse travels to the target and back", "Light moves at half speed", "The receiver has two lenses"], source: "https://www.analog.com/en/resources/technical-articles/how-to-effectively-design-and-optimize-tia-interfaces-of-lidar-systems.html" },
  { number: 86, id: "defence/software-defined-radio", mockup: "086 - Software Defined Radio.png", theme: "light", family: "sdr", subtitle: "A radio for every signal. A software-defined signal path.", principle: "The RF front end filters and amplifies an antenna signal. Mixing translates it to sampled I/Q baseband, where software performs filtering and demodulation. The synthetic receiver shows frequency offset, bandwidth, gain, squelch and aliasing; transmit mode creates digital samples only and emits no RF.", parts: ["SMA antenna port", "Clock reference", "USB interface", "RF filters", "LNA", "I/Q mixer", "ADC / DAC", "FPGA / DSP", "RF amplifier"], steps: [["Receive RF", "The antenna collects an RF waveform."], ["Filter and amplify", "The RF front end selects the band and applies gain."], ["Downconvert", "The local oscillator mixes RF into I/Q baseband."], ["Digitize", "ADC samples produce complex digital data."], ["Process in software", "Filter and demodulate the selected channel."], ["Generate transmit samples", "A digital modulator sends samples to a virtual DAC."], ["Upconvert and output", "The physical chain would filter and amplify RF; this lab does not transmit."]], architecture: { inputs: ["RF antenna signal", "Local oscillator", "Host samples"], processing: ["LNA / band filter", "I/Q mixer", "ADC \u2192 DSP / host", "DAC \u2192 upconverter"], outputs: ["Spectrum / waterfall", "Demodulated baseband", "Virtual transmit samples"] }, controls: "frequency:Tuned frequency:98.7:88:108:0.1:MHz|bandwidth:Channel bandwidth:200:25:400:25:kHz|gain:Receiver gain:20:0:50:1:dB|squelch:Squelch threshold:-65:-100:-20:1:dBm|rate:Sample rate:1000:100:2000:100:kS/s", modes: ["Receive FM", "Receive AM", "Transmit illustration"], applications: ["Radio education", "Protocol research", "Spectrum observation", "Signal processing", "Software prototyping"], safety: ["Synthetic signals only; no radio transmission.", "Aliasing occurs when sampled bandwidth is insufficient.", "Gain and squelch do not create a stronger antenna signal."], quiz: ["What makes an SDR flexible?", "Software processing of sampled signals", "A fixed audio volume", "A larger battery label"], source: "https://hackrf.readthedocs.io/en/latest/hackrf_one.html" },
  { number: 87, id: "defence/secure-digital-radio", mockup: "087 - Secure Digital Radio.png", theme: "light", family: "secure-radio", subtitle: "Trusted communications through coding, encryption and authentication.", principle: "Audio is digitized and framed before encryption and RF modulation. A receiver demodulates the packet, verifies authentication, decrypts it and reconstructs audio. The local cryptography demonstration uses browser AES-GCM with an ephemeral key and fresh nonce; no messages leave this page.", parts: ["Microphone / speaker", "Audio codec", "Encryption module", "Key management", "Baseband processor", "RF transceiver", "Power amplifier", "Battery"], steps: [["Capture", "Convert sound into an electrical input."], ["Digitize and compress", "The audio codec creates digital samples."], ["Secure", "Encrypt and authenticate a framed message."], ["Process", "Baseband logic prepares symbols and framing."], ["Transmit", "The RF chain would send the modulated frame."], ["Receive", "A remote receiver would demodulate the frame."], ["Verify and decrypt", "Authenticate before releasing plaintext."], ["Output", "Reconstruct the recovered audio or data."]], architecture: { inputs: ["Audio / data", "Ephemeral key", "Frame counter"], processing: ["Audio ADC / codec", "AES-GCM authentication", "Baseband framing", "RF transceiver"], outputs: ["Encrypted packet", "Verified plaintext", "Speaker / data output"] }, controls: "snr:Channel SNR:18:0:30:1:dB|rate:Payload rate:9.6:2.4:64:0.8:kbps|loss:Packet loss:0:0:100:1:%", modes: ["Authenticated link", "Wrong key", "Tampered packet"], applications: ["Public safety communications", "Infrastructure maintenance", "Disaster response", "Secure-radio education"], safety: ["Keys are local and ephemeral.", "Authentication failure must withhold plaintext.", "The demonstration emits no RF and sends no external messages."], quiz: ["What should happen when packet authentication fails?", "Withhold decrypted output", "Play corrupted plaintext", "Ignore the verification result"], source: "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt" },
  { number: 88, id: "defence/iff-system", mockup: "088 - IFF System.png", theme: "light", family: "iff", subtitle: "Interrogate. Decode. Verify. Identify.", principle: "An interrogator sends a coded request and a transponder checks its mode before preparing an identity response. This synthetic model illustrates 1030 MHz interrogation and 1090 MHz response with octal identity validation. Secure modes show verification state only; no classified protocol or operational identification algorithm is implemented.", parts: ["Interrogator timing unit", "RF transmitter", "Antenna", "RF receiver", "Mode decoder", "Authentication module", "Response processor", "Power supply"], steps: [["Interrogate", "Send a virtual coded request."], ["Receive", "Collect the interrogation at the transponder antenna."], ["Condition", "Filter and amplify the receive signal."], ["Decode", "Identify the requested mode and code."], ["Verify", "Check the selected teaching authentication state."], ["Respond", "Prepare a virtual identity reply when valid."], ["Display identity", "Show the decoded response with its validity status."]], architecture: { inputs: ["1030 MHz interrogation", "Mode / identity", "Authentication state"], processing: ["RF front end", "Mode decoder", "Verification gate", "Response formatter"], outputs: ["1090 MHz response", "Identity / validity", "Teaching display"] }, controls: "code:Identity code:4721:0:7777:1:octal|delay:Response latency:3:1:10:0.5:\xB5s|range:Target range:40:1:100:1:km", modes: ["Mode 3/A", "Mode S illustration", "Secure mode \u2014 verified", "Secure mode \u2014 unverified"], applications: ["Surveillance interoperability", "Aircraft identification education", "Timing diagrams", "Avionics architecture study"], safety: ["No response does not establish hostile identity.", "Codes contain four octal digits.", "Secure modes are abstract validity examples."], quiz: ["Does lack of an authenticated reply prove a hostile target?", "No \u2014 identification remains unknown", "Yes, in every case", "It proves the antenna is perfect"], source: "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4_section_1.html" },
  { number: 89, id: "defence/electronic-identification-system", mockup: "089 - Electronic Identification System.png", theme: "light", family: "electronic-id", subtitle: "Tap. Identify. Validate. Decide.", principle: "A reader exchanges a credential identifier with a tag, forwards it to a controller and checks a local authorization policy. The teaching simulation separates readable identity, authorization, expiry and event logging. A UID by itself is not cryptographic authentication.", parts: ["RFID credential", "Reader antenna", "RF interface", "Controller MCU", "Communication link", "Local policy database", "Relay driver", "Door lock", "Event log"], steps: [["Present tag", "Place a virtual credential within the reader's field."], ["RF interrogation", "The reader energizes and requests data from the tag."], ["Data transfer", "Receive a synthetic credential identifier."], ["Process", "Validate the format and availability of the response."], ["Check policy", "Compare identifier and expiry with the local teaching policy."], ["Decide", "Grant access only when authorization is valid."], ["Output", "Drive the virtual lock state."], ["Log event", "Store the event in the page's local session log."]], architecture: { inputs: ["Virtual credential", "Reader field", "Authorization policy"], processing: ["RF reader", "Credential decoding", "Controller / local policy", "Grant / deny decision"], outputs: ["Virtual relay / lock", "Event record", "Status display"] }, controls: "distance:Tag distance:2:0:15:0.5:cm|timeout:Reader timeout:200:50:500:10:ms", modes: ["Valid employee card", "Unknown card", "Expired card", "Revoked card"], applications: ["Building entry education", "Asset identification", "Inventory systems", "Transport credentials"], safety: ["This page controls no actual lock.", "A credential UID alone does not establish authenticity.", "Event logs contain only synthetic identities."], quiz: ["Is a readable UID sufficient proof of authorization?", "No \u2014 policy and authentication are separate checks", "Yes, for every reader", "Only if the LED is green"], source: "https://www.nxp.com/products/rfid-nfc/nfc-hf:RFID-NFC" },
  { number: 90, id: "defence/inertial-navigation-system", mockup: "090 - Inertial Navigation System.png", theme: "light", family: "ins", subtitle: "Estimate orientation, velocity and position from motion sensors.", principle: "Gyroscopes estimate changing attitude and accelerometers estimate specific force. Strapdown navigation transforms force into a navigation frame, compensates gravity and integrates velocity and position. This reduced horizontal model shows acceleration bias accumulating into quadratic position error; aiding attenuates the illustrative bias.", parts: ["Accelerometers", "Gyroscopes", "Optional magnetometer", "Signal conditioning", "ADC", "Sensor-fusion processor", "Interface connectors", "Power regulation"], steps: [["Measure motion", "Sample acceleration and angular rate."], ["Condition signals", "Filter and compensate sensor offsets."], ["Convert to digital", "Digitize synchronized sensor channels."], ["Estimate attitude", "Integrate angular rate into orientation."], ["Estimate navigation", "Transform acceleration and integrate velocity and position."], ["Provide output", "Publish the reduced navigation solution and validity."]], architecture: { inputs: ["Accelerometer", "Gyroscope", "Optional aiding"], processing: ["Conditioning / calibration", "ADC", "Attitude estimate", "Navigation integrator"], outputs: ["Attitude", "Velocity", "Position"] }, controls: "acceleration:Forward acceleration:0.5:-2:2:0.1:m/s\xB2|bias:Accelerometer bias:0.02:-0.1:0.1:0.01:m/s\xB2|rotation:Yaw rate:3:-20:20:1:\xB0/s|duration:Navigation interval:60:10:300:10:s", modes: ["Unaided inertial", "GNSS-aided illustration"], applications: ["Vehicle navigation", "Motion education", "Robot state estimation", "Marine navigation", "Spacecraft study"], safety: ["Unaided errors grow with time.", "The full three-axis Earth model is reduced here.", "Invalid sensors inhibit dependent navigation results."], quiz: ["How does a constant acceleration bias affect position error?", "It grows approximately with time squared", "It always stays zero", "It depends only on display color"], source: "https://www.vectornav.com/resources/inertial-navigation-primer/theory-of-operation/theory-inertial" },
  { number: 91, id: "defence/gps-receiver", mockup: "091 - GPS Receiver.png", theme: "light", family: "gps-receiver", subtitle: "From weak satellite signals to a position and time solution.", principle: "A GNSS antenna and RF front end feed sampled signals to correlators. Code timing estimates pseudoranges, and a navigation solver estimates receiver position and clock bias. The synthetic sky geometry model demonstrates satellite count, noise and dilution of precision; positions are educational examples.", parts: ["GNSS antenna", "LNA / SAW filter", "Downconverter", "ADC", "Code correlators", "Navigation processor", "TCXO", "Display / NMEA interface"], steps: [["Receive", "Collect weak satellite RF signals."], ["Amplify and filter", "Select the band with a low-noise RF front end."], ["Downconvert", "Translate the signal to an intermediate frequency."], ["Correlate", "Match local spreading-code replicas with received samples."], ["Measure pseudorange", "Estimate code arrival time including clock bias."], ["Compute position", "Solve the satellite timing equations."], ["Output", "Present position, time and navigation messages."]], architecture: { inputs: ["GNSS satellite signals", "Satellite orbit data"], processing: ["LNA / filter", "Downconversion / ADC", "Code correlators", "Pseudoranges / PVT solver"], outputs: ["Position / time", "Sky view", "Illustrative NMEA"] }, controls: "satellites:Number of satellites:8:0:16:1:|noise:Range noise:2:0.5:20:0.5:m|geometry:Geometry dilution:1.2:1:8:0.2:|strength:Signal C/N0:42:15:55:1:dB-Hz", modes: ["GPS only", "Multi-constellation", "Urban multipath"], applications: ["Surveying", "Timing", "Navigation", "Precision agriculture", "Location services"], safety: ["At least four independent pseudoranges are needed for 3D position and clock bias.", "Multipath and weak signals affect accuracy.", "NMEA output here is illustrative and carries synthetic coordinates."], quiz: ["Why are four satellites generally needed for a 3D fix?", "Solve three position coordinates and receiver clock bias", "Each satellite supplies a compass direction", "Four satellites remove all multipath"], source: "https://www.gps.gov/systems/gps/" },
  { number: 92, id: "defence/electronic-compass", mockup: "092 - Electronic Compass.png", theme: "light", family: "electronic-compass", subtitle: "Find direction through magnetic sensing and tilt compensation.", principle: "A three-axis magnetometer measures the local magnetic field. Calibration removes hard-iron offsets; an accelerometer provides tilt for transforming readings into a level plane. Heading is atan2 of the compensated horizontal components, plus magnetic declination. This model demonstrates the transformation with synthetic fields.", parts: ["Three-axis magnetometer", "Accelerometer", "Conditioning / ADC", "Calibration processor", "Display", "Battery", "Control buttons", "Housing"], steps: [["Sense", "Measure local magnetic field components."], ["Condition", "Filter sensor outputs."], ["Digitize", "Sample the three magnetic axes."], ["Fuse", "Use the tilt estimate with magnetic measurements."], ["Calibrate", "Subtract the selected hard-iron offset."], ["Compute heading", "Rotate into the horizontal plane and evaluate atan2."], ["Output", "Normalize heading into 0\u2013360 degrees."]], architecture: { inputs: ["Magnetic field Hx / Hy / Hz", "Pitch / roll", "Calibration offset"], processing: ["Magnetometer / ADC", "Bias correction", "Tilt compensation", "atan2 heading"], outputs: ["Heading degrees", "Compass rose", "Raw sensor vector"] }, controls: "yaw:Rotate yaw:287:0:359:1:\xB0|pitch:Tilt pitch:5:-60:60:1:\xB0|roll:Tilt roll:-3:-60:60:1:\xB0|offset:Hard-iron X offset:0:-20:20:1:\xB5T|declination:Magnetic declination:0:-20:20:1:\xB0", modes: ["Tilt compensated", "Uncompensated", "Calibrated offset"], applications: ["Navigation", "Robot orientation", "Outdoor instruments", "Vehicle heading", "Sensor education"], safety: ["Nearby magnetic materials distort the field.", "Tilt compensation requires a reliable tilt estimate.", "Magnetic north differs from true north by local declination."], quiz: ["Why use accelerometer tilt in an electronic compass?", "Transform magnetic readings to a horizontal plane", "Transmit a GNSS signal", "Encrypt compass digits"], source: "https://www.nxp.com/docs/en/application-note/AN4248.pdf" },
  { number: 93, id: "defence/satellite-communication-terminal", mockup: "093 - Satellite Communication Terminal.png", theme: "light", family: "ground-satellite", subtitle: "Connect beyond boundaries through a pointed ground terminal.", principle: "A ground terminal encodes data, modulates it and uses a block upconverter to drive the dish feed. A low-noise receive chain reverses the process on the downlink. This independent context uses source-matching ground-terminal controls and the same free-space link-budget principle as the aircraft terminal.", parts: ["Parabolic dish", "Feed horn", "Block upconverter", "LNB receive chain", "Modem", "Codec / baseband", "Tracking controller", "Power supply", "Network interface"], steps: [["User input", "Accept local voice, video or digital data."], ["Encoding", "Frame and code the payload."], ["Modulation", "Create a modem waveform."], ["Upconversion", "The BUC translates and amplifies transmit RF."], ["Transmission", "The dish radiates toward the selected satellite."], ["Reception and output", "LNB, modem and codec recover the downlink data."]], architecture: { inputs: ["User network data", "Satellite downlink", "Pointing commands"], processing: ["Codec / baseband", "Modem", "BUC / dish feed", "LNB receive chain"], outputs: ["Satellite uplink", "Decoded network data", "Link quality"] }, controls: "azimuth:Antenna azimuth:180:150:210:1:\xB0|elevation:Antenna elevation:35:10:65:1:\xB0|power:BUC power:10:0:20:1:dBW|rate:Payload rate:25:1:50:1:Mbps", modes: ["Ku band 14 / 12 GHz", "Ka band 30 / 20 GHz", "C band 6 / 4 GHz"], applications: ["Remote connectivity", "Disaster relief", "Broadcast distribution", "Enterprise links", "Maritime connectivity"], safety: ["Pointing and rain fade affect link margins.", "All gain and bandwidth values are teaching assumptions.", "No RF transmission or external network connection occurs."], quiz: ["Which module upconverts and amplifies the uplink?", "Block upconverter", "LNB only", "Display controller"], source: "https://www.itu.int/rec/R-REC-P.525/en" },
  { number: 94, id: "defence/perimeter-intrusion-detection-system", mockup: "094 - Perimeter Intrusion Detection System.png", theme: "light", family: "perimeter", subtitle: "Sense activity. Correlate events. Report an alarm.", principle: "Fence, beam and motion sensors feed a controller that filters transient events and applies a detection policy. The virtual system correlates sensor strength, persistence and environmental noise, then logs a synthetic alarm. It controls no physical security system and sends no notifications.", parts: ["Fence vibration sensor", "Infrared beam sensor", "PIR / microwave sensor", "Main controller", "Network module", "Backup battery", "Surge protection", "Alarm output"], steps: [["Monitor", "Acquire fence, beam and motion signals."], ["Detect event", "Identify a change in the selected synthetic sensor."], ["Filter noise", "Reject short disturbances using persistence and thresholds."], ["Confirm", "Apply the teaching sensor-correlation policy."], ["Alarm", "Activate the virtual alarm indicator."], ["Log", "Record the synthetic event locally in the page."], ["Review", "Display evidence for a simulated operator."], ["Clear", "Return to monitoring after the event is cleared."]], architecture: { inputs: ["Fence vibration", "IR beam continuity", "PIR / microwave motion"], processing: ["Input conditioning", "Noise / persistence filter", "Correlation policy", "Alarm controller"], outputs: ["Virtual siren / strobe", "Local event log", "Monitoring status"] }, controls: "strength:Event strength:80:0:100:1:%|persistence:Event duration:2:0.1:5:0.1:s|threshold:Detection threshold:50:10:90:1:%|noise:Environmental noise:10:0:80:1:%", modes: ["Human crossing \u2014 IR beam", "Fence vibration", "Animal motion", "Wind disturbance"], applications: ["Facility monitoring education", "Sensor fusion", "Alarm filtering", "Controller architecture study"], safety: ["Noise and animals can produce false alarms.", "Correlated detection still requires review.", "Virtual notifications remain local; no external messages are sent."], quiz: ["Why check persistence before raising an alarm?", "Reject brief transient disturbances", "Make all events invisible", "Replace every sensor with a timer"], source: "https://www.optex-europe.com/products/intrusion-detection" }
];

// src/studios/how-devices-work/advanced/systems-data.ts
var radar = "https://www.analog.com/en/resources/analog-dialogue/articles/phased-array-antenna-patterns-part1.html";
var imaging = "https://www.hamamatsu.com/eu/en/product/optical-sensors/image-sensor/image-intensifier.html";
var SYSTEMS_DEFINITIONS = [
  { number: 75, id: "aviation/cockpit-voice-recorder", mockup: "075 - Cockpit Voice Recorder.png", theme: "light", family: "voice-recorder", subtitle: "Capture. Protect. Recover. Understand.", principle: "Four audio inputs are conditioned, sampled and quantized before circular nonvolatile storage. Crash-protected memory preserves recorded sound. An underwater locator beacon activates on immersion; this model uses 8 kHz, 16-bit uncompressed PCM, not an aircraft-specific recorder specification.", parts: ["Microphone inputs", "Audio preamplifiers", "Anti-alias filters", "Audio ADC", "Recording processor", "Circular memory", "Crash-protected enclosure", "Underwater locator beacon"], steps: [["Capture audio", "Receive pilot, copilot, intercom and cockpit-area microphone channels."], ["Condition signals", "Amplify and filter each channel before sampling."], ["Digitize", "Sample audio and quantize amplitudes into PCM words."], ["Record continuously", "Write timestamped channels to a circular memory buffer."], ["Protect memory", "A hardened enclosure protects the recording medium."], ["Locate and recover", "Immersion activates the acoustic locator beacon."]], architecture: { inputs: ["Pilot microphone", "Copilot microphone", "Intercom", "Cockpit area microphone"], processing: ["Preamplifiers / filters", "Four-channel ADC", "Timestamp + recording CPU", "Circular nonvolatile memory"], outputs: ["Crash-protected recording", "Maintenance playback", "Immersion-activated ULB"] }, controls: "level:Audio input level:60:0:100:1:%|sampleRate:Sample rate:8:4:16:1:kHz|bits:Quantization:16:8:24:1:bit|capacity:Recording duration:120:30:180:10:min", modes: ["Normal recording", "Playback", "Underwater recovery"], applications: ["Accident investigation", "Cockpit audio reconstruction", "Maintenance checks", "Recorder education"], safety: ["Audio here is synthetic; no microphone permission is requested.", "Protected memory and locator hardware have separate functions.", "Retention and certification requirements depend on the installation."], quiz: ["What activates the underwater locator beacon?", "Water immersion", "Radio tuning", "A squawk code"], source: "https://www.ntsb.gov/news/pages/cvr_fdr.aspx" },
  { number: 76, id: "aviation/satellite-communication-terminal", mockup: "076 - Satellite Communication Terminal.png", theme: "light", family: "satellite-link", subtitle: "Connecting aircraft through space.", principle: "A pointed antenna transmits coded, modulated messages through an RF upconverter and power amplifier. The receive path uses a low-noise amplifier, downconverter and demodulator. This illustrative 14 GHz link budget includes free-space and pointing losses, thermal noise and a simplified error bound.", parts: ["Steerable antenna", "Radome", "Diplexer", "Low-noise amplifier", "Downconverter", "Modem and codec", "Upconverter", "High-power amplifier", "Antenna controller"], steps: [["Prepare data", "Encode digital voice and data into modem symbols."], ["Upconvert and amplify", "Convert the transmit signal to RF and amplify it."], ["Point antenna", "Track the selected satellite despite aircraft motion."], ["Transmit through space", "The satellite relay forwards the signal to a ground station."], ["Receive RF", "The antenna and low-noise amplifier collect the downlink."], ["Decode output", "Downconvert, demodulate and check recovered messages."]], architecture: { inputs: ["Aircraft voice / data", "Satellite downlink", "Aircraft attitude"], processing: ["Codec + modem", "Upconverter \u2192 HPA", "Diplexer / antenna", "LNA \u2192 downconverter", "Pointing controller"], outputs: ["Satellite uplink", "Decoded aircraft data", "Link quality / status"] }, controls: "azimuth:Antenna azimuth:124.5:90:160:0.5:\xB0|elevation:Antenna elevation:36.2:10:70:0.2:\xB0|power:Transmit power:10:1:50:1:W|rate:Data rate:4:0.5:16:0.5:Mbps", modes: ["Automatic tracking", "Manual pointing", "Receive only"], applications: ["Passenger connectivity", "Aircraft operational data", "Remote oceanic communications", "Satellite link training"], safety: ["Pointing error reduces antenna gain.", "Low SNR inhibits payload throughput.", "All values are illustrative, not a service coverage prediction."], quiz: ["Why use a low-noise amplifier near the antenna?", "Preserve weak received signals", "Store cockpit sound", "Measure engine oil"], source: "https://www.itu.int/rec/R-REC-P.525/en" },
  { number: 77, id: "aviation/satellite-attitude-control-computer", mockup: "077 - Satellite Attitude-Control Computer.png", theme: "light", family: "satellite-attitude", subtitle: "Sense orientation. Compute corrections. Point precisely.", principle: "Star trackers and inertial sensors estimate satellite orientation. Feedback control commands reaction wheels or other actuators to reduce attitude error. The simulation integrates a one-axis rigid body with bounded PD torque and reaction-wheel angular momentum; it is a reduced teaching model.", parts: ["Star tracker interface", "Gyroscope interface", "Attitude processor", "Program memory", "Wheel motor driver", "Reaction wheel", "Power regulation", "Telemetry interface"], steps: [["Sense orientation", "Acquire star-tracker and gyro measurements."], ["Estimate attitude", "Combine absolute orientation with angular-rate data."], ["Compare target", "Calculate error relative to the pointing objective."], ["Compute correction", "A bounded proportional-derivative law requests torque."], ["Drive reaction wheel", "Wheel momentum changes produce opposite spacecraft torque."], ["Close feedback loop", "Measure the new orientation and repeat."]], architecture: { inputs: ["Star tracker", "Gyroscope", "Pointing command"], processing: ["Sensor interfaces", "Attitude estimator", "PD controller", "Wheel driver"], outputs: ["Reaction-wheel torque", "Spacecraft attitude", "Telemetry"] }, controls: "target:Target angle:0:-90:90:1:\xB0|gain:Proportional gain:0.5:0.1:2:0.1:Nm/rad|damping:Rate damping:1.2:0.1:3:0.1:Nms/rad|disturbance:Disturbance torque:0:0:0.1:0.005:Nm", modes: ["Earth pointing", "Sun pointing", "Instrument pointing"], applications: ["Earth observation", "Solar array orientation", "Instrument targeting", "Communication antenna pointing"], safety: ["Wheel torque and momentum are bounded.", "Real spacecraft require three-axis estimation and momentum unloading.", "Sensor faults invalidate the teaching attitude output."], quiz: ["Why does accelerating a reaction wheel rotate a satellite?", "Conservation of angular momentum", "An increase in radio frequency", "Thermal image processing"], source: "https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/" },
  { number: 78, id: "defence/phased-array-radar", mockup: "078 - Phased-Array Radar.png", theme: "light", family: "phased-array", subtitle: "Steer a beam electronically. Detect and track echoes.", principle: "Controlled phase differences across antenna elements produce constructive interference in a chosen direction. The model computes the normalized array factor for a 16-element half-wavelength-spaced linear array, plus pulse timing and synthetic target returns.", parts: ["Antenna elements", "T/R modules", "Phase shifters", "Power amplifiers", "Low-noise amplifiers", "Beamformer", "ADC", "Radar signal processor", "Cooling system"], steps: [["Generate waveform", "Create a timed RF pulse train."], ["Set phase shifts", "Calculate phase progression for the desired beam direction."], ["Transmit beam", "Element fields combine into a directional beam."], ["Receive echoes", "T/R modules amplify weak reflected signals."], ["Digitize and process", "Estimate target delay and Doppler from samples."], ["Display tracks", "Plot synthetic range and bearing measurements."]], architecture: { inputs: ["Beam steering command", "Pulse timing", "Target echoes"], processing: ["Waveform generator", "Phase-controlled T/R array", "Receive beamformer", "ADC + DSP"], outputs: ["Steered RF beam", "Range / angle tracks", "Radar display"] }, controls: "azimuth:Beam azimuth:24:-60:60:1:\xB0|elevation:Beam elevation:5:0:30:1:\xB0|prf:Pulse repetition frequency:1000:500:5000:100:Hz|elements:Active elements:16:4:32:1:", modes: ["Electronic steering", "Mechanical scan illustration", "3D track display"], applications: ["Airspace surveillance", "Weather observation", "Space-object tracking", "Array antenna research"], safety: ["Targets are synthetic examples.", "Spacing and scan angle affect grating lobes.", "The pulse range limit is not a detection-performance claim."], quiz: ["What steers an electronically scanned array beam?", "Relative element phase", "Cabin pressure", "Memory overwrite"], source: radar },
  { number: 79, id: "defence/ground-surveillance-radar", mockup: "079 - Ground Surveillance Radar.png", theme: "light", family: "ground-radar", subtitle: "Detect movement. Measure range. Track the ground scene.", principle: "A scanning antenna receives echoes from moving objects. Round-trip delay gives range and Doppler shift gives radial velocity. This synthetic 10 GHz model illustrates inverse-fourth-power echo scaling and clutter; it does not predict operational detection ranges.", parts: ["Scanning antenna", "RF transmitter", "T/R switch", "Receive amplifier", "Mixer", "ADC", "Doppler processor", "Track computer", "Operator display"], steps: [["Scan sector", "Rotate the antenna through the coverage region."], ["Transmit pulses", "Send a timed radar waveform."], ["Receive returns", "Collect target echoes and ground clutter."], ["Measure range", "Convert round-trip delay into distance."], ["Extract motion", "Estimate radial speed from Doppler frequency."], ["Track and display", "Associate synthetic detections over successive scans."]], architecture: { inputs: ["Scan settings", "Target echoes", "Ground clutter"], processing: ["Pulse transmitter", "T/R switch + receiver", "ADC", "Doppler / clutter filter", "Tracker"], outputs: ["Range / bearing", "Radial velocity", "PPI / track list"] }, controls: "range:Display range:20:5:40:1:km|rpm:Scan speed:12:2:30:1:rpm|targets:Number of targets:5:1:10:1:|speed:Target speed:10:0:30:1:m/s", modes: ["Vehicle", "Person", "Unknown target"], applications: ["Ground movement monitoring", "Airport surface observation", "Perimeter monitoring", "Radar education"], safety: ["Clutter can obscure weak returns.", "Doppler measures radial motion, not full speed.", "Example reflectivity is not a classification guarantee."], quiz: ["Which measurement yields target range?", "Echo round-trip delay", "Display color", "Antenna paint"], source: radar },
  { number: 80, id: "defence/passive-radar", mockup: "080 - Passive Radar.png", theme: "light", family: "passive-radar", subtitle: "Detect reflections without transmitting your own signal.", principle: "Reference and surveillance channels receive a third-party broadcast and its target reflections. Cross-correlation estimates excess bistatic delay. Geometry uses a transmitter 20 km west of the receiver and a synthetic moving target; Doppler follows the rate of change of transmitter-target-receiver path length.", parts: ["Reference antenna", "Surveillance antenna", "RF filters", "Synchronized receivers", "ADC channels", "Cross-correlator", "Clutter cancellation", "Bistatic tracker"], steps: [["Receive illumination", "Collect the direct broadcast in the reference channel."], ["Receive reflections", "Collect the delayed target signal in the surveillance channel."], ["Synchronize channels", "Sample both channels on a common clock."], ["Cancel clutter", "Suppress direct-path leakage and stationary echoes."], ["Cross-correlate", "Estimate excess delay and Doppler relative to the reference."], ["Track target", "Use bistatic geometry to interpret the measurements."]], architecture: { inputs: ["Broadcast reference", "Reflected surveillance signal"], processing: ["Synchronized RF receivers", "Dual ADC", "Clutter cancellation", "Delay\u2013Doppler correlator"], outputs: ["Excess path delay", "Bistatic Doppler", "Synthetic target map"] }, controls: "range:Receiver-target range:50:5:100:1:km|altitude:Target altitude:10000:0:15000:500:m|speed:Target speed:780:0:1000:10:km/h|bearing:Target bearing:45:0:180:1:\xB0", modes: ["FM 100.7 MHz", "DAB 220 MHz", "DVB-T 650 MHz"], applications: ["Broadcast-based sensing", "Airspace research", "Spectrum-efficient radar", "Bistatic signal processing"], safety: ["Coverage depends on the illuminator and geometry.", "Passive reception does not remove interference or clutter.", "A single bistatic delay does not uniquely locate a target."], quiz: ["What supplies the transmitted signal in passive radar?", "An external illuminator", "The surveillance receiver", "The display computer"], source: "https://publica-rest.fraunhofer.de/server/api/core/bitstreams/b6a19994-04ff-4bbe-a0d6-5bb9b3c92ea6/content" },
  { number: 81, id: "defence/air-defence-radar", mockup: "081 - Air-Defence Radar.png", theme: "light", family: "air-defence-radar", subtitle: "Search the sky. Resolve echoes. Build a picture.", principle: "Timed RF pulses, scanning antennas and digital receive processing estimate synthetic target range and bearing. The teaching model shows range-dependent echo scaling, sweep timing and geometric horizon effects without operational targeting or engagement guidance.", parts: ["Antenna array", "RF exciter", "Power amplifier", "Duplexer", "Receiver", "ADC", "Signal processor", "Track processor", "Display console"], steps: [["Generate pulses", "Synchronize waveform and receive timing."], ["Transmit and scan", "Illuminate a rotating search sector."], ["Receive echoes", "Amplify weak reflected signals."], ["Digitize", "Sample the receive waveform."], ["Detect and associate", "Compare synthetic returns with an illustrative threshold."], ["Display air picture", "Plot teaching targets and scan coverage."]], architecture: { inputs: ["Search settings", "Aircraft / object echoes"], processing: ["RF exciter + amplifier", "Duplexer / receiver", "ADC + matched filter", "Detection + tracker"], outputs: ["Range / bearing tracks", "Coverage display", "System health"] }, controls: "rpm:Antenna scan speed:12:2:24:1:rpm|power:Transmit power:250:50:500:10:kW|range:Display range:400:50:500:10:km|clutter:Clutter level:10:0:100:1:%", modes: ["Aircraft", "Drones", "Missiles \u2014 synthetic example"], applications: ["Airspace surveillance education", "Radar signal processing", "Track association research", "System architecture study"], safety: ["All targets and performance values are synthetic.", "Curvature, terrain and clutter limit line of sight.", "No operational targeting or engagement commands are modeled."], quiz: ["Why can low-altitude echoes be harder to observe?", "Line of sight and ground clutter", "Faster memory writes", "A higher audio bit depth"], source: radar },
  { number: 82, id: "defence/thermal-imaging-camera", mockup: "082 - Thermal Imaging Camera.png", theme: "light", family: "thermal-imaging", subtitle: "See emitted heat. Reveal temperature patterns.", principle: "A microbolometer array responds to incident long-wave infrared radiation. Readout electronics, digitization and nonuniformity correction form a thermal image. The synthetic field illustrates emissivity and reflected ambient radiation using a fourth-power radiance approximation, rather than calibrated thermography.", parts: ["Infrared lens", "Microbolometer array", "Readout IC", "ADC", "Image processor", "Calibration shutter", "Display", "Battery supply"], steps: [["Collect infrared", "The lens focuses emitted infrared radiation."], ["Detect radiation", "Microbolometer pixels change resistance as they warm."], ["Read pixels", "A readout IC scans the detector array."], ["Digitize and correct", "ADC and nonuniformity correction reduce pixel offsets."], ["Map temperatures", "Convert the synthetic field into a display range."], ["Apply palette", "Color-map intensity and present the image."]], architecture: { inputs: ["Emitted long-wave IR", "Emissivity setting", "Ambient reflection"], processing: ["IR lens / microbolometer", "ROIC + ADC", "NUC / image processor"], outputs: ["Thermal image", "Spot / range indication"] }, controls: "minimum:Display minimum:-10:-20:30:1:\xB0C|maximum:Display maximum:40:31:100:1:\xB0C|emissivity:Emissivity:0.95:0.1:1:0.01:|ambient:Ambient temperature:20:-10:40:1:\xB0C", modes: ["House \u2014 Ironbow", "Electrical \u2014 Rainbow", "Person \u2014 White hot", "House \u2014 Black hot", "House \u2014 Greyscale"], applications: ["Building heat-loss inspection", "Electrical inspection", "Search and rescue", "Industrial diagnostics"], safety: ["Low emissivity makes reflections significant.", "The image is synthetic and not a calibrated temperature measurement.", "Thermal imaging differs from reflected near-infrared night imaging."], quiz: ["What does a thermal camera primarily detect?", "Emitted infrared radiation", "Visible paint color", "Ultrasound echoes"], source: "https://support.flir.com/Answers/A4456/IR_Imaging_Radiometry_Handbook.pdf" },
  { number: 83, id: "defence/night-vision-system", mockup: "083 - Night-Vision System.png", theme: "light", family: "night-vision", subtitle: "Amplify available light through an image intensifier.", principle: "An objective focuses low-light photons onto a photocathode. A microchannel plate multiplies photoelectrons and a phosphor converts them back to visible light. The thumbnail is the supplied hardware reference; the interactive diagram teaches this common intensifier architecture without claiming the pictured unit's specifications.", parts: ["Objective lens", "Photocathode", "Microchannel plate", "Phosphor screen", "Eyepiece", "High-voltage supply", "Gain controller", "IR illuminator"], partFunctions: { "Objective lens": "Focuses the low-light scene on the photocathode.", "Photocathode": "Converts incident photons into emitted electrons.", "Microchannel plate": "Multiplies electrons through secondary emission in microscopic channels.", "Phosphor screen": "Converts the amplified electron image into visible light.", "Eyepiece": "Magnifies the phosphor image for the viewer.", "High-voltage supply": "Regulated internal voltages accelerate electrons through the tube.", "Gain controller": "Adjusts brightness amplification within a limited operating range.", "IR illuminator": "Adds reflected near-infrared light when selected in the teaching scene." }, steps: [["Collect photons", "Focus starlight or moonlight through the objective."], ["Release electrons", "The photocathode converts photons into electrons."], ["Multiply electrons", "The microchannel plate provides electron gain."], ["Form visible image", "Electrons excite the phosphor screen."], ["Observe", "The eyepiece presents the amplified image."], ["Regulate gain", "Control brightness to reduce excessive saturation."]], architecture: { inputs: ["Low-light photons", "Optional near-IR illumination"], processing: ["Objective lens", "Photocathode", "Microchannel plate", "Phosphor screen"], outputs: ["Visible amplified image", "Eyepiece"] }, controls: "light:Ambient illuminance:0.01:0.001:0.1:0.001:lux|gain:Electron gain:30:1:100:1:\xD7|exposure:Integration interval:20:1:50:1:ms|infrared:IR assist level:50:0:100:1:%", modes: ["Starlight", "Moonlight", "IR assist"], applications: ["Low-light observation", "Wildlife study", "Search and rescue", "Image-intensifier education"], safety: ["Bright sources can saturate an intensifier.", "Amplification does not remove photon shot noise.", "This reflected-light model does not measure temperature."], quiz: ["Which stage multiplies photoelectrons?", "Microchannel plate", "Thermal shutter", "Radar duplexer"], source: imaging },
  { number: 84, id: "defence/infrared-surveillance-camera", mockup: "084 - Infrared Surveillance Camera.png", theme: "light", family: "infrared-camera", subtitle: "Illuminate the night. Capture reflected infrared.", principle: "Near-infrared LEDs illuminate a scene. A day/night camera removes its IR-cut filter at night so a silicon image sensor can detect reflected near-IR light. Exposure, gain and noise reduction affect the output; this system is not a thermal imager.", parts: ["Lens", "IR-cut filter", "CMOS sensor", "IR LED array", "LED driver", "Image processor", "Video encoder", "Network interface", "Power supply"], steps: [["Select day or night", "Switch the IR-cut filter and illumination mode."], ["Illuminate scene", "LEDs emit near-infrared light in night mode."], ["Collect reflections", "The lens focuses reflected light on the image sensor."], ["Read and digitize", "Pixel charge becomes digital image samples."], ["Process image", "Exposure, gain and denoising shape the display."], ["Encode and transmit", "Provide the processed video through the network interface."]], architecture: { inputs: ["Visible / reflected near-IR", "Day/night command"], processing: ["Lens + IR-cut filter", "CMOS readout", "Exposure / gain / denoising", "Video encoder"], outputs: ["Network video", "Monochrome night image", "Camera status"] }, controls: "led:IR LED brightness:70:0:100:1:%|ambient:Ambient light:0:0:100:1:%|gain:Sensor gain:60:1:100:1:%|noise:Noise reduction:50:0:100:1:%", modes: ["Night \u2014 850 nm", "Night \u2014 940 nm", "Day", "Low light"], applications: ["Building observation", "Entry monitoring", "Wildlife cameras", "Industrial machine vision"], safety: ["Near-IR illumination depends on reflectivity and distance.", "Gain amplifies noise as well as signal.", "Synthetic images are for learning, not surveillance evidence."], quiz: ["Why remove the IR-cut filter at night?", "Let near-infrared reach the sensor", "Measure thermal emission", "Increase radar range"], source: "https://whitepapers.axis.com/en-us/ir-in-surveillance" }
];

// src/studios/how-devices-work/advanced/aviation-data.ts
var airframe = "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation";
var AVIATION_DEFINITIONS = [
  {
    number: 65,
    id: "aviation/engine-fadec-controller",
    mockup: "065 - Engine FADEC Controller.png",
    theme: "light",
    family: "fadec",
    subtitle: "Control. Protect. Optimize. Automatically.",
    principle: "A dual-channel engine computer combines throttle demand, shaft speeds, temperatures and pressures. Control laws command fuel metering, variable stator vanes, bleed valves and ignition while supervising engine limits. The response here is an illustrative turbofan model, not a certified engine schedule.",
    parts: ["EMI filter and supply", "Signal conditioning", "ADC", "Dual control processor", "Program memory", "Actuator drivers", "Connectors and cooling"],
    partFunctions: { "EMI filter and supply": "Filters electrical interference and regulates aircraft power.", "Signal conditioning": "Protects, filters and scales temperature, speed and pressure inputs.", "ADC": "Converts conditioned analog sensor voltages to digital samples.", "Dual control processor": "Runs independent engine-control channels and compares their health.", "Program memory": "Stores control schedules, calibration and diagnostic records.", "Actuator drivers": "Drive the fuel metering unit, stator vanes, bleed valves and ignition interfaces.", "Connectors and cooling": "Connect power and avionics buses while carrying heat away from electronics." },
    steps: [["Sense command", "Read electronic throttle demand and aircraft conditions."], ["Collect data", "Acquire N1, N2, EGT and pressure inputs."], ["Process", "Compute scheduled fuel and actuator targets."], ["Check limits", "Constrain speed and exhaust temperature."], ["Command actuators", "Drive fuel metering, vanes, bleed and ignition."], ["Control engine", "Use measured response to correct demand."], ["Continuously adapt", "Update control and built-in-test status."]],
    architecture: { inputs: ["Throttle / power lever", "N1 / N2 speed pickups", "EGT thermocouples", "Pressure / temperature", "Air data / ARINC bus"], processing: ["Input protection + conditioning", "ADC / digital interfaces", "Dual CPU control schedules", "Limit monitoring + BIT", "Output drivers"], outputs: ["Fuel metering unit", "Variable stator vanes", "Bleed valves", "Starter / ignition", "Engine health data"] },
    controls: "throttle:Throttle lever angle:65:0:100:1:%|altitude:Altitude:10000:0:40000:500:ft|mach:Mach number:0.6:0:0.9:0.01:|temperature:Ambient temperature:15:-40:50:1:\xB0C",
    modes: ["Normal dual channel", "Backup channel"],
    applications: ["Commercial turbofans", "Business jets", "Military aircraft", "Turboshaft helicopters", "Engine diagnostics"],
    safety: ["Independent control channels support fault detection.", "Speed and temperature limits constrain commands.", "This simplified model does not implement a certified fuel schedule."],
    quiz: ["Which input supports exhaust overtemperature protection?", "EGT sensor data", "Cabin lighting", "Squawk code"],
    source: "https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf"
  },
  {
    number: 66,
    id: "aviation/aircraft-engine-monitoring-system",
    mockup: "066 - Aircraft Engine Monitoring System.png",
    theme: "light",
    family: "engine-monitor",
    subtitle: "Measure. Analyze. Protect. Perform.",
    principle: "Thermocouples, pressure transducers, magnetic speed pickups and vibration sensors feed protected acquisition circuits. A monitoring processor filters and trends engine parameters, compares them with limits and sends indications, alerts and maintenance records. Example thresholds are instructional, not aircraft operating limits.",
    parts: ["Input signal conditioning", "Analog-to-digital converters", "Monitoring processor", "Data memory", "ARINC / CAN interface", "Power supply"],
    steps: [["Sense", "Measure temperature, pressure, vibration, fuel flow and speed."], ["Condition", "Amplify, filter and protect sensor signals."], ["Digitize", "Convert analog inputs into sampled digital data."], ["Analyze", "Compare values and trends with programmed limits."], ["Display and alert", "Show parameters and identify exceedances."], ["Store and transmit", "Log time-aligned data for maintenance and recording."]],
    architecture: { inputs: ["EGT thermocouples", "Pressure transducers", "Vibration accelerometer", "N1 / N2 pickups", "Fuel flow meter"], processing: ["Amplifiers / filters", "Isolation / protection", "ADC", "Monitoring DSP", "Trend + fault analysis"], outputs: ["EICAS / EFIS display", "Avionics data bus", "Maintenance download", "Nonvolatile health logs"] },
    controls: "n1:N1 fan speed:85:0:110:1:%|egt:EGT:650:200:1000:10:\xB0C|oil:Oil pressure:70:0:120:1:psi|fuel:Fuel flow:2500:0:6000:100:kg/h",
    modes: ["Normal acquisition", "Sensor noise"],
    applications: ["Cockpit engine indication", "Predictive maintenance", "Trend analysis", "Dispatch reliability"],
    safety: ["Example EGT bands: normal below 750\xB0C; caution 750\u2013850; warning 850\u2013950; critical above 950.", "Low oil pressure and speed exceedances are flagged independently.", "Actual limits depend on the engine and installation."],
    quiz: ["Which sensor measures exhaust gas temperature?", "Thermocouple", "GPS receiver", "Fuel flow meter"],
    source: "https://www.faa.gov/newsroom/safety-briefing/engine-maintenance-and-performance-monitoring"
  },
  {
    number: 67,
    id: "aviation/drone-flight-controller",
    mockup: "067 - Drone Flight Controller.png",
    theme: "light",
    family: "drone-control",
    subtitle: "Stabilize. Navigate. Fly Smarter.",
    principle: "Gyroscopes and accelerometers estimate attitude; barometer and GNSS support altitude and navigation. Attitude and rate loops convert desired motion into torque requests, and a motor mixer allocates those requests to ESCs. This reduced-order four-motor model demonstrates feedback and saturation.",
    parts: ["Power regulation", "IMU gyroscope / accelerometer", "Barometer", "Flight control MCU", "GNSS / UART interface", "PWM / DShot outputs"],
    steps: [["Sense", "Acquire IMU, barometer, GNSS and radio commands."], ["Fuse", "Estimate attitude and position from complementary measurements."], ["Plan", "Form desired attitude, rate or altitude targets."], ["Command", "Mix thrust and torque requests into motor outputs."], ["Stabilize", "Correct errors using measured motion."], ["Monitor", "Supervise battery, link and sensor validity."]],
    architecture: { inputs: ["IMU angular rate", "Accelerometer", "Barometer", "GNSS position", "RC commands"], processing: ["Sensor calibration", "Attitude estimator", "Attitude / rate controller", "Quad-X motor mixer", "Failsafe supervision"], outputs: ["ESC commands", "Motor thrust", "Telemetry", "Status LEDs", "Gimbal interface"] },
    controls: "roll:Roll input:0:-30:30:1:\xB0|pitch:Pitch input:0:-30:30:1:\xB0|yaw:Yaw rate input:0:-90:90:1:\xB0/s|throttle:Throttle:40:0:100:1:%|wind:Wind disturbance:0:0:20:1:\xB0",
    modes: ["Stabilized attitude hold", "Rate mode"],
    applications: ["Aerial photography", "Mapping and surveying", "Search and rescue", "Agriculture", "Inspection", "Research and education"],
    safety: ["Link loss and low battery require configured failsafe responses.", "Saturated motors reduce available control authority.", "The example is a software teaching model."],
    quiz: ["Which sensor measures angular rotation rate?", "Gyroscope", "Barometer", "GNSS receiver"],
    source: "https://docs.px4.io/main/en/flight_stack/controller_diagrams"
  },
  { number: 68, id: "aviation/weather-radar", mockup: "068 - Weather Radar.png", theme: "light", family: "weather-radar", subtitle: "Detect. Avoid. Fly Safer.", principle: "A scanned microwave antenna transmits pulses and receives precipitation echoes. Time delay gives range; signal power and processing produce a colored return map. Tilt, beam geometry, gain and attenuation affect what is visible. The display uses synthetic precipitation cells, not live weather.", parts: ["Scanning antenna", "Transmit / receive switch", "Microwave transmitter", "Low-noise receiver", "Signal processor", "Display computer", "Control panel"], steps: [["Transmit", "Emit a short microwave pulse through the antenna."], ["Propagate", "The pulse travels through the atmosphere."], ["Reflect", "Hydrometeors scatter some energy back."], ["Receive", "Route weak echoes to a protected receiver."], ["Process", "Filter, sample and estimate echo range and strength."], ["Display", "Map returns into a navigation-display sector."]], architecture: { inputs: ["Antenna echoes", "Tilt / gain controls", "Attitude stabilization"], processing: ["T/R switch", "LNA + mixer", "IF filter", "ADC", "Range / reflectivity DSP"], outputs: ["Weather return map", "Navigation display", "Status / test data"] }, controls: "range:Display range:80:40:320:40:NM|tilt:Antenna tilt:0:-5:10:0.5:\xB0|gain:Receiver gain:70:0:100:1:%", modes: ["Line of storms", "Scattered showers", "Heavy attenuation"], applications: ["Weather avoidance", "Route planning", "In-flight assessment", "Situational awareness"], safety: ["Clear-air turbulence is not generally visible to conventional weather radar.", "Heavy rain can attenuate returns and hide weather behind it.", "Gain and tilt change displayed returns; colors alone are not a complete hazard assessment."], quiz: ["What determines pulse-echo range?", "Round-trip time delay", "Aircraft squawk code", "Battery voltage"], source: airframe },
  { number: 69, id: "aviation/radar-altimeter", mockup: "069 - Radar Altimeter.png", theme: "light", family: "radar-height", subtitle: "True Height. Greater Safety.", principle: "Transmit and receive antennas face the terrain. An FMCW transmitter sweeps frequency; mixing the delayed return with the transmitted signal creates a beat frequency proportional to height: h = c \xD7 f\u1D66 / (2 \xD7 sweep slope). The equivalent round-trip delay is 2h/c.", parts: ["RF synthesizer", "Power amplifier", "Transmit / receive antennas", "Mixer", "IF filter and amplifier", "ADC", "Height processor", "Avionics interface", "Power supply"], steps: [["Transmit RF", "Sweep a microwave signal toward the ground."], ["Receive reflection", "Receive the terrain echo through a separate antenna."], ["Measure difference", "Mix transmit and delayed receive signals."], ["Compute height", "Convert beat frequency to height above ground."], ["Output to avionics", "Send height and validity to aircraft systems."], ["Update continuously", "Repeat and supervise signal quality."]], architecture: { inputs: ["Transmit reference", "Terrain echo", "Sweep timing"], processing: ["4.2\u20134.4 GHz synthesizer", "RF amplifier / coupler", "Mixer", "IF filtering / ADC", "Height DSP"], outputs: ["AGL height", "ARINC 429 interface", "Validity / BIT"] }, controls: "height:Aircraft altitude AGL:250:0:2500:10:ft|speed:Aircraft speed:140:0:250:5:kt|sweep:Sweep bandwidth:200:50:200:10:MHz", modes: ["Dry runway", "Water surface", "Rough terrain"], applications: ["Autoland", "Terrain awareness", "Flare control", "Helicopter low-altitude operations", "UAV operations"], safety: ["Blocked or damaged antennas can invalidate height.", "Terrain reflectivity and attitude affect the received signal.", "Radio height differs from barometric altitude."], quiz: ["Which quantity is proportional to FMCW height?", "Beat frequency", "Squawk code", "Ambient temperature alone"], source: airframe },
  { number: 70, id: "aviation/radio-altimeter", mockup: "070 - Radio Altimeter.png", theme: "light", family: "radio-height", subtitle: "Measure Height. Enable Safer Landings.", principle: "A radio altimeter measures height above the reflecting terrain independently of GNSS. A swept transmitter, receiver and timing/frequency measurement circuit estimate propagation delay, then a processor publishes height and validity. A synthetic landing profile illustrates decreasing AGL height and flare.", parts: ["RF transmitter / receiver", "Processor board", "Power supply", "Transmit antenna", "Receive antenna", "Avionics connector"], steps: [["Transmit", "Send radio energy toward the ground."], ["Reflect", "The surface returns part of the transmitted signal."], ["Receive", "A second antenna receives the delayed echo."], ["Measure", "Compare transmit and receive time or frequency."], ["Calculate", "Use light speed and measured delay to calculate height."], ["Output", "Publish AGL height and validity to avionics."]], architecture: { inputs: ["Sweep oscillator", "Terrain echo"], processing: ["Power amplifier", "Directional coupler", "Mixer / beat detector", "IF filter + ADC", "Height calculation"], outputs: ["Radio altitude", "Cockpit indication", "Autoland / GPWS data"] }, controls: "height:Aircraft height AGL:250:0:2500:10:ft|speed:Aircraft speed:140:0:250:5:kt", modes: ["Runway hard surface", "Water", "Rough terrain"], applications: ["Autoland systems", "Flare height", "Ground proximity warnings", "Helicopter operations", "Flight data recording"], safety: ["Independent from barometric and GNSS altitude.", "Invalid received signals must be flagged.", "Actual usable height range and precision depend on equipment."], quiz: ["Which physical principle supports radio height measurement?", "Radio wave propagation delay", "Atmospheric pressure alone", "Magnetic north"], source: airframe },
  { number: 71, id: "aviation/aircraft-transponder", mockup: "071 - Aircraft Transponder.png", theme: "light", family: "transponder", subtitle: "Your Aircraft\u2019s Digital ID in the Sky.", principle: "The receiver decodes 1030 MHz interrogations. Control logic selects a Mode A identity, Mode C pressure-altitude or Mode S addressed reply and transmits on 1090 MHz. Squawk digits are octal. This page shows a simplified pulse reply; it does not transmit RF.", parts: ["1030 MHz receiver", "Decoder and signal processing", "Mode control processor", "Code selector and memory", "Altitude encoder", "1090 MHz transmitter", "Power amplifier", "Avionics interface"], steps: [["Receive", "Acquire the ground interrogator\u2019s 1030 MHz pulses."], ["Decode", "Identify the interrogation type."], ["Match", "Select identity, pressure-altitude or addressed data."], ["Prepare reply", "Format the requested reply."], ["Transmit", "Send the coded reply at 1090 MHz."], ["Seen on radar", "ATC associates the reply with its surveillance track."]], architecture: { inputs: ["1030 MHz antenna", "Pressure altitude encoder", "Squawk / flight identity"], processing: ["RF receiver", "Pulse decoder", "Mode A / C / S logic", "Reply encoder", "RF transmitter + PA"], outputs: ["1090 MHz reply", "ATC surveillance", "TCAS replies"] }, controls: "squawk:Squawk code:1200:0:7777:1:octal digits|altitude:Pressure altitude:28000:-1000:50000:100:ft", modes: ["Mode A", "Mode C", "Mode S"], applications: ["Air traffic surveillance", "Collision avoidance support", "Aircraft identification", "Search and rescue"], safety: ["Only digits 0\u20137 are valid in a four-digit squawk.", "Pressure-altitude reporting requires valid encoder data.", "This simulator emits no real radio signal."], quiz: ["On which frequency is a transponder reply sent?", "1090 MHz", "1030 MHz", "121.5 MHz"], source: "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4_section_1.html" },
  { number: 72, id: "aviation/ads-b-system", mockup: "072 - ADS-B System.png", theme: "light", family: "adsb", subtitle: "See and be seen. A safer, more connected sky.", principle: "GNSS position and avionics data are combined with identity and encoded for automatic broadcast. This example uses the 1090 MHz extended-squitter path. Receivers on aircraft and ground stations decode traffic; broadcast quality depends on valid navigation data.", parts: ["RF antenna connector", "1090 MHz transmitter", "ADS-B encoder", "Control processor", "ARINC data interfaces", "Power supply", "GNSS receiver"], steps: [["Get position", "Obtain position, velocity and time from GNSS."], ["Combine data", "Add pressure altitude, identity and status."], ["Encode message", "Format extended-squitter message data."], ["Broadcast", "Transmit without requiring an interrogation."], ["Receive by others", "Aircraft and ground stations receive the broadcast."], ["Display traffic", "Decode and plot nearby aircraft."]], architecture: { inputs: ["GNSS position / time", "Altitude / heading / identity", "ARINC data buses"], processing: ["Control processor", "ADS-B message encoder", "Integrity / scheduling", "1090 MHz transmitter"], outputs: ["Top antenna broadcast", "Ground surveillance", "ADS-B In traffic displays"] }, controls: "altitude:Altitude:8500:0:40000:500:ft|speed:Ground speed:180:0:450:5:kt|heading:Track heading:270:0:359:1:\xB0|rate:Transmit rate:2:0.5:5:0.5:Hz", modes: ["Nearby traffic shown", "Traffic hidden", "GNSS source failure"], applications: ["Traffic awareness", "Air traffic services", "Search and rescue", "Weather / operational awareness", "Airspace modernization"], safety: ["Position and integrity depend on the navigation source.", "Traffic displays complement collision avoidance systems.", "ADS-B In and Out serve different roles."], quiz: ["Which input supplies ADS-B position?", "GNSS receiver", "Cabin pressure switch", "Audio microphone"], source: "https://www.faa.gov/air_traffic/technology/adsb/faq" },
  { number: 73, id: "aviation/traffic-collision-avoidance-system", mockup: "073 - Traffic Collision Avoidance System.png", theme: "light", family: "tcas", subtitle: "Detect. Assess. Alert. Keep Separation.", principle: "TCAS interrogates transponders and tracks relative range, altitude and closure. Threat logic estimates encounter risk and generates traffic or resolution advisories. This page uses explicitly simplified time-to-contact and vertical-separation thresholds, not certified TCAS logic or operational guidance.", parts: ["1030 / 1090 MHz transceiver", "Signal processing", "Surveillance processor", "Threat tracking logic", "RA decision computer", "Avionics interface", "Directional antennas"], steps: [["Interrogate / receive", "Send 1030 MHz interrogations and receive 1090 MHz replies."], ["Compute position", "Estimate relative range, bearing and altitude."], ["Track and classify", "Track closure and classify nearby traffic."], ["Determine threat", "Compare encounter time and vertical separation."], ["Generate alert", "Present a visual and aural advisory."], ["Update continuously", "Revise tracking and advisories as the encounter evolves."]], architecture: { inputs: ["Directional antennas", "Own pressure altitude", "Air data / configuration"], processing: ["RF transceiver", "Surveillance processor", "Threat tracking", "RA coordination / decision"], outputs: ["Traffic display", "Traffic advisory", "Resolution advisory", "Aural alert"] }, controls: "range:Intruder range:2.8:0.1:10:0.1:NM|relative:Relative altitude:700:-3000:3000:100:ft|closure:Closure rate:450:0:600:10:kt", modes: ["TA / RA enabled", "TA only"], applications: ["Commercial aviation", "General aviation", "Military aviation", "Mixed traffic environments"], safety: ["Simplified teaching bands: TA at \u226440 s / <2350 ft; RA at \u226425 s / <850 ft.", "Real TCAS uses altitude-dependent logic and additional conditions.", "This display does not provide flight instructions."], quiz: ["Which frequency carries replies received by TCAS?", "1090 MHz", "1030 MHz", "978 kHz"], source: airframe },
  { number: 74, id: "aviation/flight-data-recorder", mockup: "074 - Flight Data Recorder.png", theme: "light", family: "fdr", subtitle: "Record Today. A Safer Tomorrow.", principle: "Aircraft sensors and data buses feed a data acquisition unit. Validated parameters are formatted and time-stamped before being written to protected solid-state memory. Downloaded data can reconstruct flight conditions. This model records a synthetic stream with a bounded in-memory buffer.", parts: ["Front cover and connector", "Shock mounts", "Data acquisition unit", "Processor and formatter", "Solid-state memory", "Power backup", "Underwater locator beacon", "Thermal insulation"], steps: [["Collect", "Receive aircraft parameters from sensors and buses."], ["Format", "Validate and label the digital values."], ["Timestamp", "Add time for sequencing and correlation."], ["Store", "Write data to a continuous memory buffer."], ["Protect", "Crash-protected structure shields the memory."], ["Recover", "Locate the recorder and retrieve stored data."], ["Analyze", "Decode records and reconstruct the flight."]], architecture: { inputs: ["Air data computer", "Inertial sensors", "FADEC engine data", "Flight controls", "FMS / other systems"], processing: ["ARINC bus interface", "Data acquisition unit", "Processor / formatter", "Time synchronization", "Protected solid-state memory"], outputs: ["Time-stamped records", "Maintenance download", "Post-flight analysis"] }, controls: "speed:Airspeed:250:0:450:5:kt|altitude:Altitude:32000:0:40000:500:ft|pitch:Pitch angle:2.5:-15:20:0.5:\xB0|bank:Bank angle:0:-60:60:1:\xB0", modes: ["Normal flight", "Maneuver", "Engine event", "Approach"], applications: ["Accident investigation", "Safety analysis", "Design and certification", "Training and education"], safety: ["Crash-protected memory is distinct from ordinary data-acquisition electronics.", "A locator beacon assists recovery; it does not store flight parameters.", "No real aircraft data is captured by this simulator."], quiz: ["What is the primary purpose of an FDR?", "Store time-stamped flight parameters", "Transmit weather radar", "Control aircraft in an emergency"], source: airframe }
];

// src/studios/how-devices-work/advanced/data.ts
var rows2 = [
  {
    number: 55,
    id: "medical/centrifuge",
    mockup: "055 - Centrifuge.png",
    theme: "dark",
    family: "centrifuge",
    subtitle: "Explore how a centrifuge separates components using high-speed rotation and centrifugal force.",
    principle: "A controlled motor rotates balanced samples. Relative centrifugal force is RCF = 1.118 \xD7 10\u207B\u2075 \xD7 radius(cm) \xD7 RPM\xB2. Sedimentation depends on particle density, size, medium and time; the displayed separation fraction is an illustrative kinetic model.",
    parts: ["Lid lock interlock", "Rotor and tube holders", "Spindle", "Tachometer", "Brushless motor", "Imbalance sensor", "Control board", "Power supply", "Cooling fan"],
    steps: [["Load samples", "Place matched masses in opposite rotor positions."], ["Close lid", "The interlock confirms the lid is securely locked."], ["Set parameters", "Select speed, duration and the correct rotor radius."], ["Motor accelerates", "Closed-loop speed control compares tachometer feedback with the target."], ["Separation occurs", "Density and sedimentation characteristics determine sample migration."], ["Motor decelerates", "Controlled braking reduces rotor speed before access is allowed."], ["Retrieve results", "The lid releases only after the rotor has stopped."]],
    applications: ["Clinical sample preparation", "DNA and protein research", "Cell pelleting", "Pharmaceutical development", "Environmental sample preparation", "Food quality analysis"],
    safety: ["Lid interlock inhibits rotation when open.", "Unbalanced loads trigger a vibration alarm.", "Rotor speed must remain within its rated limit.", "Access waits for the rotor to stop."],
    modes: ["Blood", "Cell suspension", "Protein precipitate"],
    controls: "rpm:RPM (speed):6000:500:20000:100:rpm|duration:Time:10:1:60:1:min|radius:Rotor radius:8:5:15:0.5:cm|imbalance:Load imbalance:0:0:100:1:%",
    quiz: ["Which change doubles relative centrifugal force?", "Double rotor radius", "Double time", "Double RPM"],
    source: "https://www.eppendorf.com/gb-en/lab-academy/life-science/cell-biology/basics-in-centrifugation/"
  },
  {
    number: 56,
    id: "medical/blood-cell-analyzer",
    mockup: "056 - Blood Cell Analyzer.png",
    theme: "dark",
    family: "hematology",
    subtitle: "From a drop of blood to a complete picture.",
    principle: "Metered EDTA blood is diluted and routed through measurement channels. Impedance pulses estimate RBC and platelet volume; optical scatter and fluorescence help classify white cells. Counts require known dilution and sampled volume.",
    parts: ["Sample probe", "Reagent pumps", "Fluidics manifold", "Mixing chamber", "Impedance aperture", "Laser optical module", "Photodiodes", "Control electronics", "Waste chamber"],
    steps: [["Load sample", "Present a mixed, anticoagulated test sample."], ["Aspirate and dilute", "A metering pump takes a measured aliquot and adds diluent."], ["Add reagents", "Different measurement channels receive appropriate reagents."], ["Mix and incubate", "Timed mixing prepares cells for detection."], ["Measure", "Cells passing an aperture generate pulses; optical channels measure scatter."], ["Analyze and classify", "Pulse heights and scatter distributions produce counts and indices."], ["Report CBC", "The processor presents results with quality flags."]],
    applications: ["Routine complete blood counts", "Anemia screening", "Infection monitoring", "Hematology research"],
    safety: ["Use the specified sample and anticoagulant.", "Clots or blocked apertures invalidate counts.", "Quality-control and background checks precede patient testing.", "Handle samples and waste using laboratory biosafety procedures."],
    modes: ["Normal teaching sample", "Low RBC teaching sample", "Elevated WBC teaching sample"],
    controls: "volume:Sample volume:20:5:100:1:\xB5L|dilution:Dilution ratio:50:10:200:10:\xD7|threshold:RBC size threshold:20:5:150:1:fL|noise:Pulse amplitude noise:5:0:50:1:%",
    quiz: ["What does the height of an impedance pulse primarily represent?", "Cell volume", "Cell color", "Battery charge"],
    source: "https://www.sysmex.com/en-us/customer-support/tools/product-comparison/details"
  },
  {
    number: 57,
    id: "medical/automated-chemistry-analyzer",
    mockup: "057 - Automated Chemistry Analyzer.png",
    theme: "dark",
    family: "chemistry",
    subtitle: "Explore. Understand. Simulate. Master Clinical Biochemistry.",
    principle: "The analyzer meters sample and reagent into a cuvette, controls incubation, and measures transmitted light. Absorbance A = \u2212log\u2081\u2080(I/I\u2080) is converted to concentration using an assay-specific calibration. This virtual assay uses a simplified temperature-dependent reaction curve.",
    parts: ["Sample carousel", "Pipetting arm", "Reagent tray", "Mixing system", "Reaction cuvette", "Incubator heater", "Light source", "Wavelength filter", "Photodiode", "Control board"],
    steps: [["Load sample and reagents", "Identify tubes and reagent positions."], ["Aspirate and meter", "The pipetting mechanism transfers known volumes."], ["Mix and incubate", "Mix the reaction at the selected temperature."], ["Optical measurement", "A wavelength-selected beam passes through the cuvette."], ["Calibration", "Compare absorbance with the calibrated assay response."], ["Result output", "Display concentration with assay and quality information."]],
    applications: ["Glucose assays", "Renal chemistry panels", "Liver chemistry panels", "Research assay development"],
    safety: ["Calibration and control materials are assay specific.", "Carryover and contaminated cuvettes bias results.", "Temperature and reagent quality affect reaction kinetics.", "Handle potentially infectious samples using laboratory procedures."],
    modes: ["Glucose teaching assay", "Urea teaching assay", "Creatinine teaching assay"],
    controls: "volume:Sample volume:10:2:50:1:\xB5L|wavelength:Wavelength:505:340:800:5:nm|temperature:Incubation temperature:37:25:45:1:\xB0C|concentration:Test concentration:92:10:300:1:relative",
    quiz: ["Which component measures transmitted light?", "Photodiode", "Pipetting arm", "Waste container"],
    source: "https://www.beckmancoulter.com/en/products/chemistry/au680?index=0"
  },
  {
    number: 58,
    id: "aviation/aircraft-flight-computer",
    mockup: "058 - Aircraft Flight Computer.png",
    theme: "light",
    family: "flight-computer",
    subtitle: "Combine aircraft measurements into guidance and control information.",
    principle: "Aircraft computers validate and combine air-data, inertial and navigation inputs. Guidance calculations compare desired and estimated state; interfaces carry commands and status to other avionics. The virtual response is a bounded first-order guidance example.",
    parts: ["Avionics connectors", "Air-data interface", "Inertial data interface", "Processor boards", "Memory", "Power conversion", "Data bus transceiver", "Cooling chassis"],
    steps: [["Acquire aircraft data", "Receive validated sensor and avionics messages."], ["Check integrity", "Reject stale or implausible input data."], ["Estimate state", "Combine attitude, speed, altitude and navigation information."], ["Compare target", "Calculate deviation from selected guidance targets."], ["Compute guidance", "Apply the selected teaching control law."], ["Publish output", "Send guidance and status through avionics interfaces."]],
    applications: ["Flight guidance", "Navigation integration", "Autopilot coordination", "Avionics education"],
    safety: ["Redundant channels require independent monitoring.", "Invalid inputs must be flagged.", "This is a guidance demonstration, not an aircraft control implementation."],
    modes: ["Altitude guidance", "Heading guidance"],
    controls: "altitude:Current altitude:10000:0:40000:100:ft|target:Target altitude:12000:0:40000:100:ft|heading:Heading target:90:0:359:1:\xB0|gain:Response gain:1:0.2:2:0.1:\xD7",
    quiz: ["Why validate incoming sensor data?", "Prevent invalid inputs from driving guidance", "Increase display brightness", "Replace flight controls"],
    source: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number: 59,
    id: "aviation/fly-by-wire",
    mockup: "059 - Fly-by-Wire System.png",
    theme: "dark",
    family: "fly-by-wire",
    subtitle: "From pilot input to aircraft response \u2014 all through electronics, algorithms and actuators.",
    principle: "Pilot commands and aircraft sensors enter redundant flight-control computers. Control laws produce actuator demands; position feedback closes the actuator loop. The model illustrates tracking and limits, without representing a certified flight-control law.",
    parts: ["Side-stick sensors", "Air data sensors", "IMU", "Redundant flight computers", "Data buses", "Actuator electronics", "Servo actuator", "Position feedback sensor", "Power supply"],
    steps: [["Pilot input", "Convert stick displacement into a desired response."], ["Sensor inputs", "Measure air data and aircraft motion."], ["Flight computers", "Redundant channels calculate and monitor commands."], ["Actuator commands", "Drivers request control-surface movement."], ["Actuator movement", "The servo moves a control surface."], ["Feedback", "Position sensors measure the actual movement."], ["Aircraft response", "The closed loop tracks the bounded command."]],
    applications: ["Transport aircraft controls", "Flight-control education", "Redundancy analysis", "Actuator-loop demonstrations"],
    safety: ["Independent channels monitor discrepancies.", "Actuator commands remain bounded.", "A sensor fault invalidates the affected teaching output."],
    modes: ["Normal law illustration", "Direct law illustration"],
    controls: "pitch:Pitch command:2:-15:15:0.5:\xB0|roll:Roll command:5:-30:30:1:\xB0|speed:Airspeed:250:100:400:10:kt|gain:Actuator response:1:0.2:2:0.1:\xD7",
    quiz: ["What closes the actuator position loop?", "Position feedback", "Cabin lights", "A fuel gauge"],
    source: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number: 60,
    id: "aviation/glass-cockpit",
    mockup: "060 - Glass Cockpit.png",
    theme: "dark",
    family: "cockpit",
    subtitle: "See More. Know More. Fly Smarter.",
    principle: "Air-data, attitude, navigation and engine sources feed display computers through avionics buses. Validated values are rendered as coordinated primary and multifunction displays; invalid source data must remain visibly flagged.",
    parts: ["LCD display", "Backlight", "Graphics processor", "Flight computer", "ARINC data interface", "Power regulator", "Cooling assembly", "Connector panel"],
    steps: [["Sense aircraft state", "Air-data and attitude systems measure aircraft state."], ["Transmit avionics data", "Buses carry values and validity indicators."], ["Validate inputs", "The display computer checks input status."], ["Render instruments", "Graphics draw attitude, speed, altitude and heading."], ["Show navigation", "The multifunction view adds route and traffic context."], ["Update continuously", "Displays refresh as source values change."]],
    applications: ["Primary flight instruments", "Navigation displays", "Engine information", "Avionics integration education"],
    safety: ["Source validity must be visible.", "Display redundancy supports continuity.", "The virtual cockpit is not a flight instrument."],
    modes: ["Primary flight display", "Navigation display", "Engine display"],
    controls: "altitude:Altitude:35000:0:40000:100:ft|speed:Airspeed:250:60:400:5:kt|heading:Heading:270:0:359:1:\xB0",
    quiz: ["Where does displayed altitude originate?", "Air-data measurements", "Screen backlight", "Audio amplifier"],
    source: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number: 61,
    id: "aviation/primary-flight-display",
    mockup: "061 - Primary Flight Display.png",
    theme: "dark",
    family: "pfd",
    subtitle: "The pilot\u2019s real-time window into aircraft attitude, airspeed and flight path.",
    principle: "A primary flight display combines air-data, inertial attitude and navigation information into an instrument presentation. The horizon rotates with bank; speed, altitude and heading retain their own units and validity.",
    parts: ["Display screen", "Function keys", "Bezel", "Graphics processor", "Data interface boards", "Power supply", "Cooling and EMI shielding"],
    steps: [["Measure", "Sensors provide attitude, speed, altitude and heading."], ["Acquire data", "The interface receives avionics messages."], ["Process", "Check data validity and calculate display values."], ["Render graphics", "Draw instrument tapes and the artificial horizon."], ["Display output", "Present synchronized flight parameters."], ["Integrate navigation", "Add heading and route guidance."], ["Pilot interpretation", "The pilot interprets the instrument indication."], ["Continuous update", "Refresh as measurements change."]],
    applications: ["Aircraft instrument displays", "Flight training", "Avionics maintenance education"],
    safety: ["Failed sources require visible flags.", "Attitude and air-data sources are distinct.", "No real flight guidance is provided."],
    modes: ["Normal instruments", "Source failure example"],
    controls: "pitch:Pitch:0:-20:20:1:\xB0|roll:Bank angle:0:-60:60:1:\xB0|speed:Airspeed:142:60:300:1:kt|altitude:Altitude:12000:0:20000:100:ft|heading:Heading:275:0:359:1:\xB0|climb:Vertical speed:0:-2000:2000:100:ft/min",
    quiz: ["Which source provides attitude information?", "Inertial attitude sensors", "Temperature alone", "An audio codec"],
    source: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number: 62,
    id: "aviation/air-data-computer",
    mockup: "062 - Air Data Computer.png",
    theme: "dark",
    family: "air-data",
    subtitle: "Sensing the air. Powering the flight.",
    principle: "Pitot and static pressure sensors supply total and ambient pressure. Pressure difference supports an indicated-speed estimate; static pressure supports pressure altitude. Temperature permits an illustrative density and true-speed calculation under a simplified atmosphere.",
    parts: ["Pitot pressure port", "Static pressure port", "Pressure sensors", "Temperature input", "ADC", "Processor board", "Calibration memory", "ARINC interface", "Power regulator"],
    steps: [["Measure", "Pressure and temperature sensors acquire physical inputs."], ["Condition signals", "Amplify and filter sensor outputs."], ["Convert", "An ADC produces calibrated digital measurements."], ["Calculate", "Compute pressure altitude, speed and Mach-related values."], ["Check validity", "Monitor plausibility and sensor failures."], ["Publish", "Transmit air-data values to avionics."], ["Update", "Repeat measurements and computations."]],
    applications: ["Flight instrument inputs", "Autopilot air-data inputs", "Navigation integration", "Air-data testing education"],
    safety: ["Blocked pitot or static sources corrupt different measurements.", "Calibration and installation errors matter.", "Compressibility limits the simplified speed model."],
    modes: ["Normal sensing", "Blocked pitot illustration", "Blocked static illustration"],
    controls: "static:Static pressure:800:200:1030:5:hPa|dynamic:Dynamic pressure:50:0:200:1:hPa|temperature:Air temperature:15:-60:40:1:\xB0C|bias:Sensor bias:0:-10:10:0.5:hPa",
    quiz: ["Which measurement primarily determines pressure altitude?", "Static pressure", "Display brightness", "Engine RPM"],
    source: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number: 63,
    id: "aviation/inertial-navigation-system",
    mockup: "063 - Inertial Navigation System.png",
    theme: "dark",
    family: "ins",
    subtitle: "Measure motion. Compute position. Go anywhere.",
    principle: "Gyroscopes propagate attitude while accelerometers measure specific force. After transforming to a navigation frame and compensating gravity, integration yields velocity and position. Bias integrates into drift; optional aiding constrains the simplified one-dimensional estimate.",
    parts: ["Gyroscope assembly", "Accelerometer assembly", "ADC interface", "Processor board", "Memory", "Power supply", "Data bus interface", "Rugged enclosure"],
    steps: [["Measure motion", "Gyros sense rotation and accelerometers sense specific force."], ["Integrate attitude", "Update orientation from angular-rate measurements."], ["Transform acceleration", "Rotate measurements into the navigation frame."], ["Integrate velocity", "Gravity-compensated acceleration changes velocity."], ["Integrate position", "Velocity updates estimated position."], ["Apply aiding", "External measurements can constrain drift."], ["Publish solution", "Report attitude, velocity, position and status."]],
    applications: ["Aircraft navigation", "Inertial attitude reference", "GNSS outage demonstrations", "Sensor calibration education"],
    safety: ["Bias accumulates through integration.", "Alignment is required before navigation.", "The one-dimensional teaching model omits full earth-frame navigation."],
    modes: ["Unaided inertial", "GNSS-aided illustration"],
    controls: "acceleration:Forward acceleration:0.5:-2:2:0.1:m/s\xB2|bias:Accelerometer bias:0.02:-0.1:0.1:0.01:m/s\xB2|rotation:Yaw rate:3:-20:20:1:\xB0/s|duration:Navigation interval:60:10:300:10:s",
    quiz: ["What happens to a constant accelerometer bias when integrated twice?", "Position error grows with time squared", "It disappears automatically", "It changes only screen color"],
    source: "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html"
  },
  {
    number: 64,
    id: "aviation/gps-navigation-system",
    mockup: "064 - GPS Navigation System.png",
    theme: "dark",
    family: "gps",
    subtitle: "From satellite signals to your position on Earth.",
    principle: "A receiver correlates GNSS signals to obtain pseudoranges. A position solution estimates three spatial coordinates and receiver-clock offset. At least four suitable satellite observations are needed for an unconstrained three-dimensional solution; geometry and errors affect accuracy.",
    parts: ["GNSS antenna", "Low-noise amplifier", "RF filter", "Downconverter", "Reference oscillator", "Correlator", "Navigation processor", "Memory", "Display interface"],
    steps: [["Transmit timing signals", "Satellites broadcast timed navigation signals."], ["Receive", "The antenna and RF front end acquire signals."], ["Correlate", "Tracking loops estimate code phase and pseudorange."], ["Read navigation data", "Decode satellite orbit and clock information."], ["Solve position", "Estimate receiver position and clock offset."], ["Display navigation", "Publish position, velocity, time and integrity information."]],
    applications: ["Aircraft navigation", "Position and time distribution", "Route displays", "Satellite geometry education"],
    safety: ["Insufficient satellites prevent an unconstrained 3D fix.", "Multipath and poor geometry degrade accuracy.", "This model illustrates uncertainty, not a real GNSS solver."],
    modes: ["Open sky", "Urban multipath", "Poor satellite geometry"],
    controls: "satellites:Tracked satellites:6:0:16:1:|strength:Signal strength (C/N\u2080):45:15:55:1:dB-Hz",
    quiz: ["How many satellite observations are needed for an unconstrained 3D position and clock solution?", "At least four", "One", "Two"],
    source: "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html"
  }
];
var ADVANCED_LABS = [...rows2, ...AVIATION_DEFINITIONS, ...SYSTEMS_DEFINITIONS, ...SECURITY_DEFINITIONS, ...MARINE_DEFINITIONS, ...CONTROL_DEFINITIONS, ...ROBOTICS_DEFINITIONS, ...CONSUMER_DEFINITIONS, ...HOUSEHOLD_DEFINITIONS].map((row) => {
  const device = DEVICES.find((d) => d.id === row.id);
  if (!device) throw new Error(`Missing lab ${row.number}: ${row.id}`);
  const controls = row.controls.split("|").map((c) => {
    const [key, label, initial, min, max, step, unit] = c.split(":");
    return { key, label, initial: Number(initial), min: Number(min), max: Number(max), step: Number(step), unit: unit ?? "" };
  });
  return { ...row, device, controls, partFunctions: { ...explicitPartFunctions(row), ...row.partFunctions } };
});
var advancedPath = (lab) => devicePath(lab.device);
var findAdvancedLab = (id) => ADVANCED_LABS.find((l) => l.device.id === id);
var initialAdvancedValues = (lab) => Object.fromEntries(lab.controls.map((c) => [c.key, c.initial]));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADVANCED_LABS,
  advancedPath,
  findAdvancedLab,
  initialAdvancedValues
});
