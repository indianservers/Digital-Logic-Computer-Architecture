import {explicitPartFunctions} from './part-functions';
import { HOUSEHOLD_DEFINITIONS } from "./household-data";
import { CONSUMER_DEFINITIONS } from "./consumer-data";
import { ROBOTICS_DEFINITIONS } from "./robotics-data";
import { CONTROL_DEFINITIONS } from "./control-data";
import { MARINE_DEFINITIONS } from "./marine-data";
import { DEVICES, devicePath, type Device } from "../catalogue";
import type { Control } from "../labs/data";
import { SECURITY_DEFINITIONS } from "./security-data";
import { SYSTEMS_DEFINITIONS } from "./systems-data";
import { AVIATION_DEFINITIONS } from "./aviation-data";

export interface AdvancedLab {
  number: number; device: Device; mockup: string; theme: "dark" | "light";
  family: string; subtitle: string; principle: string; parts: string[];
  steps: [string, string][]; applications: string[]; safety: string[];
  modes: string[]; controls: Control[]; quiz: [string, string, string, string];
  source: string;
  architecture?: { inputs: string[]; processing: string[]; outputs: string[] };
  partFunctions?: Record<string,string>;
}
export interface Definition extends Omit<AdvancedLab,"device"|"controls"> { id: string; controls: string }
const rows: Definition[] = [
  {
    number:55,id:"medical/centrifuge",mockup:"055 - Centrifuge.png",theme:"dark",family:"centrifuge",
    subtitle:"Explore how a centrifuge separates components using high-speed rotation and centrifugal force.",
    principle:"A controlled motor rotates balanced samples. Relative centrifugal force is RCF = 1.118 × 10⁻⁵ × radius(cm) × RPM². Sedimentation depends on particle density, size, medium and time; the displayed separation fraction is an illustrative kinetic model.",
    parts:["Lid lock interlock","Rotor and tube holders","Spindle","Tachometer","Brushless motor","Imbalance sensor","Control board","Power supply","Cooling fan"],
    steps:[["Load samples","Place matched masses in opposite rotor positions."],["Close lid","The interlock confirms the lid is securely locked."],["Set parameters","Select speed, duration and the correct rotor radius."],["Motor accelerates","Closed-loop speed control compares tachometer feedback with the target."],["Separation occurs","Density and sedimentation characteristics determine sample migration."],["Motor decelerates","Controlled braking reduces rotor speed before access is allowed."],["Retrieve results","The lid releases only after the rotor has stopped."]],
    applications:["Clinical sample preparation","DNA and protein research","Cell pelleting","Pharmaceutical development","Environmental sample preparation","Food quality analysis"],
    safety:["Lid interlock inhibits rotation when open.","Unbalanced loads trigger a vibration alarm.","Rotor speed must remain within its rated limit.","Access waits for the rotor to stop."],
    modes:["Blood","Cell suspension","Protein precipitate"],controls:"rpm:RPM (speed):6000:500:20000:100:rpm|duration:Time:10:1:60:1:min|radius:Rotor radius:8:5:15:0.5:cm|imbalance:Load imbalance:0:0:100:1:%",
    quiz:["Which change doubles relative centrifugal force?","Double rotor radius","Double time","Double RPM"],source:"https://www.eppendorf.com/gb-en/lab-academy/life-science/cell-biology/basics-in-centrifugation/"
  },
  {
    number:56,id:"medical/blood-cell-analyzer",mockup:"056 - Blood Cell Analyzer.png",theme:"dark",family:"hematology",
    subtitle:"From a drop of blood to a complete picture.",
    principle:"Metered EDTA blood is diluted and routed through measurement channels. Impedance pulses estimate RBC and platelet volume; optical scatter and fluorescence help classify white cells. Counts require known dilution and sampled volume.",
    parts:["Sample probe","Reagent pumps","Fluidics manifold","Mixing chamber","Impedance aperture","Laser optical module","Photodiodes","Control electronics","Waste chamber"],
    steps:[["Load sample","Present a mixed, anticoagulated test sample."],["Aspirate and dilute","A metering pump takes a measured aliquot and adds diluent."],["Add reagents","Different measurement channels receive appropriate reagents."],["Mix and incubate","Timed mixing prepares cells for detection."],["Measure","Cells passing an aperture generate pulses; optical channels measure scatter."],["Analyze and classify","Pulse heights and scatter distributions produce counts and indices."],["Report CBC","The processor presents results with quality flags."]],
    applications:["Routine complete blood counts","Anemia screening","Infection monitoring","Hematology research"],safety:["Use the specified sample and anticoagulant.","Clots or blocked apertures invalidate counts.","Quality-control and background checks precede patient testing.","Handle samples and waste using laboratory biosafety procedures."],
    modes:["Normal teaching sample","Low RBC teaching sample","Elevated WBC teaching sample"],controls:"volume:Sample volume:20:5:100:1:µL|dilution:Dilution ratio:50:10:200:10:×|threshold:RBC size threshold:20:5:150:1:fL|noise:Pulse amplitude noise:5:0:50:1:%",
    quiz:["What does the height of an impedance pulse primarily represent?","Cell volume","Cell color","Battery charge"],source:"https://www.sysmex.com/en-us/customer-support/tools/product-comparison/details"
  },
  {
    number:57,id:"medical/automated-chemistry-analyzer",mockup:"057 - Automated Chemistry Analyzer.png",theme:"dark",family:"chemistry",
    subtitle:"Explore. Understand. Simulate. Master Clinical Biochemistry.",
    principle:"The analyzer meters sample and reagent into a cuvette, controls incubation, and measures transmitted light. Absorbance A = −log₁₀(I/I₀) is converted to concentration using an assay-specific calibration. This virtual assay uses a simplified temperature-dependent reaction curve.",
    parts:["Sample carousel","Pipetting arm","Reagent tray","Mixing system","Reaction cuvette","Incubator heater","Light source","Wavelength filter","Photodiode","Control board"],
    steps:[["Load sample and reagents","Identify tubes and reagent positions."],["Aspirate and meter","The pipetting mechanism transfers known volumes."],["Mix and incubate","Mix the reaction at the selected temperature."],["Optical measurement","A wavelength-selected beam passes through the cuvette."],["Calibration","Compare absorbance with the calibrated assay response."],["Result output","Display concentration with assay and quality information."]],
    applications:["Glucose assays","Renal chemistry panels","Liver chemistry panels","Research assay development"],safety:["Calibration and control materials are assay specific.","Carryover and contaminated cuvettes bias results.","Temperature and reagent quality affect reaction kinetics.","Handle potentially infectious samples using laboratory procedures."],
    modes:["Glucose teaching assay","Urea teaching assay","Creatinine teaching assay"],controls:"volume:Sample volume:10:2:50:1:µL|wavelength:Wavelength:505:340:800:5:nm|temperature:Incubation temperature:37:25:45:1:°C|concentration:Test concentration:92:10:300:1:relative",
    quiz:["Which component measures transmitted light?","Photodiode","Pipetting arm","Waste container"],source:"https://www.beckmancoulter.com/en/products/chemistry/au680?index=0"
  },
  {
    number:58,id:"aviation/aircraft-flight-computer",mockup:"058 - Aircraft Flight Computer.png",theme:"light",family:"flight-computer",
    subtitle:"Combine aircraft measurements into guidance and control information.",
    principle:"Aircraft computers validate and combine air-data, inertial and navigation inputs. Guidance calculations compare desired and estimated state; interfaces carry commands and status to other avionics. The virtual response is a bounded first-order guidance example.",
    parts:["Avionics connectors","Air-data interface","Inertial data interface","Processor boards","Memory","Power conversion","Data bus transceiver","Cooling chassis"],
    steps:[["Acquire aircraft data","Receive validated sensor and avionics messages."],["Check integrity","Reject stale or implausible input data."],["Estimate state","Combine attitude, speed, altitude and navigation information."],["Compare target","Calculate deviation from selected guidance targets."],["Compute guidance","Apply the selected teaching control law."],["Publish output","Send guidance and status through avionics interfaces."]],
    applications:["Flight guidance","Navigation integration","Autopilot coordination","Avionics education"],safety:["Redundant channels require independent monitoring.","Invalid inputs must be flagged.","This is a guidance demonstration, not an aircraft control implementation."],
    modes:["Altitude guidance","Heading guidance"],controls:"altitude:Current altitude:10000:0:40000:100:ft|target:Target altitude:12000:0:40000:100:ft|heading:Heading target:90:0:359:1:°|gain:Response gain:1:0.2:2:0.1:×",
    quiz:["Why validate incoming sensor data?","Prevent invalid inputs from driving guidance","Increase display brightness","Replace flight controls"],source:"https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number:59,id:"aviation/fly-by-wire",mockup:"059 - Fly-by-Wire System.png",theme:"dark",family:"fly-by-wire",
    subtitle:"From pilot input to aircraft response — all through electronics, algorithms and actuators.",
    principle:"Pilot commands and aircraft sensors enter redundant flight-control computers. Control laws produce actuator demands; position feedback closes the actuator loop. The model illustrates tracking and limits, without representing a certified flight-control law.",
    parts:["Side-stick sensors","Air data sensors","IMU","Redundant flight computers","Data buses","Actuator electronics","Servo actuator","Position feedback sensor","Power supply"],
    steps:[["Pilot input","Convert stick displacement into a desired response."],["Sensor inputs","Measure air data and aircraft motion."],["Flight computers","Redundant channels calculate and monitor commands."],["Actuator commands","Drivers request control-surface movement."],["Actuator movement","The servo moves a control surface."],["Feedback","Position sensors measure the actual movement."],["Aircraft response","The closed loop tracks the bounded command."]],
    applications:["Transport aircraft controls","Flight-control education","Redundancy analysis","Actuator-loop demonstrations"],safety:["Independent channels monitor discrepancies.","Actuator commands remain bounded.","A sensor fault invalidates the affected teaching output."],
    modes:["Normal law illustration","Direct law illustration"],controls:"pitch:Pitch command:2:-15:15:0.5:°|roll:Roll command:5:-30:30:1:°|speed:Airspeed:250:100:400:10:kt|gain:Actuator response:1:0.2:2:0.1:×",
    quiz:["What closes the actuator position loop?","Position feedback","Cabin lights","A fuel gauge"],source:"https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number:60,id:"aviation/glass-cockpit",mockup:"060 - Glass Cockpit.png",theme:"dark",family:"cockpit",
    subtitle:"See More. Know More. Fly Smarter.",
    principle:"Air-data, attitude, navigation and engine sources feed display computers through avionics buses. Validated values are rendered as coordinated primary and multifunction displays; invalid source data must remain visibly flagged.",
    parts:["LCD display","Backlight","Graphics processor","Flight computer","ARINC data interface","Power regulator","Cooling assembly","Connector panel"],
    steps:[["Sense aircraft state","Air-data and attitude systems measure aircraft state."],["Transmit avionics data","Buses carry values and validity indicators."],["Validate inputs","The display computer checks input status."],["Render instruments","Graphics draw attitude, speed, altitude and heading."],["Show navigation","The multifunction view adds route and traffic context."],["Update continuously","Displays refresh as source values change."]],
    applications:["Primary flight instruments","Navigation displays","Engine information","Avionics integration education"],safety:["Source validity must be visible.","Display redundancy supports continuity.","The virtual cockpit is not a flight instrument."],
    modes:["Primary flight display","Navigation display","Engine display"],controls:"altitude:Altitude:35000:0:40000:100:ft|speed:Airspeed:250:60:400:5:kt|heading:Heading:270:0:359:1:°",
    quiz:["Where does displayed altitude originate?","Air-data measurements","Screen backlight","Audio amplifier"],source:"https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number:61,id:"aviation/primary-flight-display",mockup:"061 - Primary Flight Display.png",theme:"dark",family:"pfd",
    subtitle:"The pilot’s real-time window into aircraft attitude, airspeed and flight path.",
    principle:"A primary flight display combines air-data, inertial attitude and navigation information into an instrument presentation. The horizon rotates with bank; speed, altitude and heading retain their own units and validity.",
    parts:["Display screen","Function keys","Bezel","Graphics processor","Data interface boards","Power supply","Cooling and EMI shielding"],
    steps:[["Measure","Sensors provide attitude, speed, altitude and heading."],["Acquire data","The interface receives avionics messages."],["Process","Check data validity and calculate display values."],["Render graphics","Draw instrument tapes and the artificial horizon."],["Display output","Present synchronized flight parameters."],["Integrate navigation","Add heading and route guidance."],["Pilot interpretation","The pilot interprets the instrument indication."],["Continuous update","Refresh as measurements change."]],
    applications:["Aircraft instrument displays","Flight training","Avionics maintenance education"],safety:["Failed sources require visible flags.","Attitude and air-data sources are distinct.","No real flight guidance is provided."],
    modes:["Normal instruments","Source failure example"],controls:"pitch:Pitch:0:-20:20:1:°|roll:Bank angle:0:-60:60:1:°|speed:Airspeed:142:60:300:1:kt|altitude:Altitude:12000:0:20000:100:ft|heading:Heading:275:0:359:1:°|climb:Vertical speed:0:-2000:2000:100:ft/min",
    quiz:["Which source provides attitude information?","Inertial attitude sensors","Temperature alone","An audio codec"],source:"https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number:62,id:"aviation/air-data-computer",mockup:"062 - Air Data Computer.png",theme:"dark",family:"air-data",
    subtitle:"Sensing the air. Powering the flight.",
    principle:"Pitot and static pressure sensors supply total and ambient pressure. Pressure difference supports an indicated-speed estimate; static pressure supports pressure altitude. Temperature permits an illustrative density and true-speed calculation under a simplified atmosphere.",
    parts:["Pitot pressure port","Static pressure port","Pressure sensors","Temperature input","ADC","Processor board","Calibration memory","ARINC interface","Power regulator"],
    steps:[["Measure","Pressure and temperature sensors acquire physical inputs."],["Condition signals","Amplify and filter sensor outputs."],["Convert","An ADC produces calibrated digital measurements."],["Calculate","Compute pressure altitude, speed and Mach-related values."],["Check validity","Monitor plausibility and sensor failures."],["Publish","Transmit air-data values to avionics."],["Update","Repeat measurements and computations."]],
    applications:["Flight instrument inputs","Autopilot air-data inputs","Navigation integration","Air-data testing education"],safety:["Blocked pitot or static sources corrupt different measurements.","Calibration and installation errors matter.","Compressibility limits the simplified speed model."],
    modes:["Normal sensing","Blocked pitot illustration","Blocked static illustration"],controls:"static:Static pressure:800:200:1030:5:hPa|dynamic:Dynamic pressure:50:0:200:1:hPa|temperature:Air temperature:15:-60:40:1:°C|bias:Sensor bias:0:-10:10:0.5:hPa",
    quiz:["Which measurement primarily determines pressure altitude?","Static pressure","Display brightness","Engine RPM"],source:"https://www.faa.gov/regulations_policies/handbooks_manuals/aviation"
  },
  {
    number:63,id:"aviation/inertial-navigation-system",mockup:"063 - Inertial Navigation System.png",theme:"dark",family:"ins",
    subtitle:"Measure motion. Compute position. Go anywhere.",
    principle:"Gyroscopes propagate attitude while accelerometers measure specific force. After transforming to a navigation frame and compensating gravity, integration yields velocity and position. Bias integrates into drift; optional aiding constrains the simplified one-dimensional estimate.",
    parts:["Gyroscope assembly","Accelerometer assembly","ADC interface","Processor board","Memory","Power supply","Data bus interface","Rugged enclosure"],
    steps:[["Measure motion","Gyros sense rotation and accelerometers sense specific force."],["Integrate attitude","Update orientation from angular-rate measurements."],["Transform acceleration","Rotate measurements into the navigation frame."],["Integrate velocity","Gravity-compensated acceleration changes velocity."],["Integrate position","Velocity updates estimated position."],["Apply aiding","External measurements can constrain drift."],["Publish solution","Report attitude, velocity, position and status."]],
    applications:["Aircraft navigation","Inertial attitude reference","GNSS outage demonstrations","Sensor calibration education"],safety:["Bias accumulates through integration.","Alignment is required before navigation.","The one-dimensional teaching model omits full earth-frame navigation."],
    modes:["Unaided inertial","GNSS-aided illustration"],controls:"acceleration:Forward acceleration:0.5:-2:2:0.1:m/s²|bias:Accelerometer bias:0.02:-0.1:0.1:0.01:m/s²|rotation:Yaw rate:3:-20:20:1:°/s|duration:Navigation interval:60:10:300:10:s",
    quiz:["What happens to a constant accelerometer bias when integrated twice?","Position error grows with time squared","It disappears automatically","It changes only screen color"],source:"https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html"
  },
  {
    number:64,id:"aviation/gps-navigation-system",mockup:"064 - GPS Navigation System.png",theme:"dark",family:"gps",
    subtitle:"From satellite signals to your position on Earth.",
    principle:"A receiver correlates GNSS signals to obtain pseudoranges. A position solution estimates three spatial coordinates and receiver-clock offset. At least four suitable satellite observations are needed for an unconstrained three-dimensional solution; geometry and errors affect accuracy.",
    parts:["GNSS antenna","Low-noise amplifier","RF filter","Downconverter","Reference oscillator","Correlator","Navigation processor","Memory","Display interface"],
    steps:[["Transmit timing signals","Satellites broadcast timed navigation signals."],["Receive","The antenna and RF front end acquire signals."],["Correlate","Tracking loops estimate code phase and pseudorange."],["Read navigation data","Decode satellite orbit and clock information."],["Solve position","Estimate receiver position and clock offset."],["Display navigation","Publish position, velocity, time and integrity information."]],
    applications:["Aircraft navigation","Position and time distribution","Route displays","Satellite geometry education"],safety:["Insufficient satellites prevent an unconstrained 3D fix.","Multipath and poor geometry degrade accuracy.","This model illustrates uncertainty, not a real GNSS solver."],
    modes:["Open sky","Urban multipath","Poor satellite geometry"],controls:"satellites:Tracked satellites:6:0:16:1:|strength:Signal strength (C/N₀):45:15:55:1:dB-Hz",
    quiz:["How many satellite observations are needed for an unconstrained 3D position and clock solution?","At least four","One","Two"],source:"https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html"
  }
];

export const ADVANCED_LABS: AdvancedLab[] = [...rows,...AVIATION_DEFINITIONS,...SYSTEMS_DEFINITIONS,...SECURITY_DEFINITIONS,...MARINE_DEFINITIONS,...CONTROL_DEFINITIONS,...ROBOTICS_DEFINITIONS,...CONSUMER_DEFINITIONS,...HOUSEHOLD_DEFINITIONS].map(row => {
  const device=DEVICES.find(d=>d.id===row.id);
  if(!device) throw new Error(`Missing lab ${row.number}: ${row.id}`);
  const controls=row.controls.split("|").map(c=>{const [key,label,initial,min,max,step,unit]=c.split(":");return {key:key!,label:label!,initial:Number(initial),min:Number(min),max:Number(max),step:Number(step),unit:unit??""};});
  return {...row,device,controls,partFunctions:{...explicitPartFunctions(row),...row.partFunctions}};
});
export const advancedPath=(lab:AdvancedLab)=>devicePath(lab.device);
export const findAdvancedLab=(id:string)=>ADVANCED_LABS.find(l=>l.device.id===id);
export const initialAdvancedValues=(lab:AdvancedLab)=>Object.fromEntries(lab.controls.map(c=>[c.key,c.initial]));









