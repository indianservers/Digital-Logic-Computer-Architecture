# How Devices Work tab migration audit

All 140 existing device pages were captured individually before editing and compared against complete post-migration renderings. All 140 preservation comparisons pass.

Seven main tabs: Overview, Inside, Deep Dive, How It Works, Live Examples, Simulation, Applications & Quiz. Inside has separate Internal Components & Exploded View and Parts Anatomy subtabs.

Comparison checks preserve educational text, paragraphs, image paths and multiplicities, original SVG diagrams/charts, and input/select controls. Original navigation labels are replaced; quiz totals are updated. Lab 85 removes only one byte-identical duplicate quiz, verified against its two original copies. Original quiz questions remain.

Validation: 968 permanent tests passed plus one migration snapshot job (969 total in the saved run). Strict Studio TypeScript and Vite production build passed. Browser checks: all 140 pages across eight views each (1,120 checks); 15 sampled mobile pages (120 checks); 11 sampled tablet pages (88 checks). No final overflow, broken visible images, or page errors. Minified production quizzes verified on labs 1 and 65. Multimeter control changes, tab-state persistence, quiz answering and retry were exercised.

Scope: code changes are confined to How Devices Work. Existing unrelated workspace changes remain. Full-project type checking has a pre-existing unused args error in src/studios/microcontroller/labs/core/cinterp.test.ts:19; Studio-specific type checking passes.

Raw evidence: before/ and after/ contain all 140 full page snapshots; comparison.json contains per-page missing-content checks; compare.py documents comparison normalization.

| Lab | Device | Sections before → after | Images | SVGs | Inputs/selects | Quiz questions | Preservation |
|---|---|---|---|---|---|---|---|
| 1 | [Digital Thermometer](http://localhost:5187/studios/how-devices-work/medical/digital-thermometer) | 12 → 18 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 2 | [ECG Machine](http://localhost:5187/studios/how-devices-work/medical/ecg) | 12 → 18 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 3 | [Pulse Oximeter](http://localhost:5187/studios/how-devices-work/medical/pulse-oximeter) | 12 → 18 | 3 → 3 | 2 → 4 | 7/1 → 7/1 | 3 → 3 | PASS |
| 4 | [Digital Blood Pressure Monitor](http://localhost:5187/studios/how-devices-work/medical/digital-blood-pressure-monitor) | 12 → 18 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 5 | [Ultrasound Scanner](http://localhost:5187/studios/how-devices-work/medical/ultrasound-scanner) | 12 → 18 | 3 → 3 | 2 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 6 | [MRI Scanner](http://localhost:5187/studios/how-devices-work/medical/mri-scanner) | 12 → 18 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 7 | [CT Scanner](http://localhost:5187/studios/how-devices-work/medical/ct-scanner) | 12 → 18 | 4 → 4 | 1 → 2 | 6/1 → 6/1 | 3 → 3 | PASS |
| 8 | [TV Remote Control](http://localhost:5187/studios/how-devices-work/everyday/tv-remote) | 12 → 18 | 3 → 3 | 1 → 2 | 5/1 → 5/1 | 3 → 3 | PASS |
| 9 | [NFC Payment System](http://localhost:5187/studios/how-devices-work/everyday/nfc-payment-system) | 12 → 18 | 3 → 3 | 1 → 2 | 5/1 → 5/1 | 3 → 3 | PASS |
| 10 | [Robotic Arm](http://localhost:5187/studios/how-devices-work/robotics/robotic-arm) | 12 → 18 | 3 → 3 | 2 → 3 | 10/1 → 10/1 | 3 → 3 | PASS |
| 11 | [SONAR](http://localhost:5187/studios/how-devices-work/marine/sonar) | 12 → 18 | 3 → 3 | 2 → 3 | 7/1 → 7/1 | 3 → 3 | PASS |
| 12 | [Aircraft Autopilot](http://localhost:5187/studios/how-devices-work/aviation/aircraft-autopilot) | 12 → 18 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 13 | [Surveillance Radar](http://localhost:5187/studios/how-devices-work/defence/surveillance-radar) | 12 → 18 | 3 → 3 | 2 → 3 | 7/1 → 7/1 | 3 → 3 | PASS |
| 14 | [Digital Camera](http://localhost:5187/studios/how-devices-work/everyday/digital-camera) | 12 → 18 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 15 | [Smartphone](http://localhost:5187/studios/how-devices-work/everyday/smartphone) | 12 → 18 | 3 → 3 | 1 → 2 | 8/1 → 8/1 | 3 → 3 | PASS |
| 16 | [Infrared Thermometer](http://localhost:5187/studios/how-devices-work/medical/infrared-thermometer) | 11 → 17 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 17 | [Digital Stethoscope](http://localhost:5187/studios/how-devices-work/medical/digital-stethoscope) | 11 → 17 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 18 | [Glucometer](http://localhost:5187/studios/how-devices-work/medical/glucometer) | 11 → 17 | 3 → 3 | 1 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 19 | [ICU Patient Monitor](http://localhost:5187/studios/how-devices-work/medical/icu-patient-monitor) | 11 → 17 | 3 → 3 | 3 → 5 | 7/1 → 7/1 | 3 → 3 | PASS |
| 20 | [Heart Rate Monitor](http://localhost:5187/studios/how-devices-work/medical/heart-rate-monitor) | 11 → 17 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 21 | [Portable ECG](http://localhost:5187/studios/how-devices-work/medical/portable-ecg) | 11 → 17 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 22 | [Holter Monitor](http://localhost:5187/studios/how-devices-work/medical/holter-monitor) | 11 → 17 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 23 | [EEG Machine](http://localhost:5187/studios/how-devices-work/medical/eeg-machine) | 11 → 17 | 3 → 3 | 2 → 4 | 6/1 → 6/1 | 3 → 3 | PASS |
| 24 | [EMG Machine](http://localhost:5187/studios/how-devices-work/medical/emg-machine) | 11 → 17 | 3 → 3 | 1 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 25 | [Fetal Heart Monitor](http://localhost:5187/studios/how-devices-work/medical/fetal-heart-monitor) | 12 → 18 | 3 → 3 | 2 → 4 | 5/1 → 5/1 | 3 → 3 | PASS |
| 26 | [Fetal Monitor](http://localhost:5187/studios/how-devices-work/medical/fetal-monitor) | 11 → 17 | 3 → 3 | 2 → 4 | 5/1 → 5/1 | 3 → 3 | PASS |
| 27 | [Electronic Spirometer](http://localhost:5187/studios/how-devices-work/medical/electronic-spirometer) | 11 → 17 | 3 → 3 | 3 → 4 | 5/1 → 5/1 | 3 → 3 | PASS |
| 28 | [Peak Flow Meter](http://localhost:5187/studios/how-devices-work/medical/peak-flow-meter) | 11 → 17 | 3 → 3 | 2 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 29 | [Digital Weighing Scale](http://localhost:5187/studios/how-devices-work/medical/digital-weighing-scale) | 11 → 17 | 3 → 3 | 1 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 30 | [Body Composition Analyzer](http://localhost:5187/studios/how-devices-work/medical/body-composition-analyzer) | 11 → 17 | 3 → 3 | 1 → 2 | 6/1 → 6/1 | 3 → 3 | PASS |
| 31 | [X-Ray Machine](http://localhost:5187/studios/how-devices-work/medical/x-ray-machine) | 11 → 17 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 32 | [Digital Radiography Detector](http://localhost:5187/studios/how-devices-work/medical/digital-radiography-detector) | 11 → 17 | 3 → 3 | 2 → 4 | 6/1 → 6/1 | 3 → 3 | PASS |
| 33 | [Doppler Ultrasound](http://localhost:5187/studios/how-devices-work/medical/doppler-ultrasound) | 11 → 17 | 3 → 3 | 2 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 34 | [PET Scanner](http://localhost:5187/studios/how-devices-work/medical/pet-scanner) | 11 → 17 | 3 → 3 | 2 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 35 | [SPECT Scanner](http://localhost:5187/studios/how-devices-work/medical/spect-scanner) | 13 → 19 | 5 → 5 | 11 → 12 | 7/1 → 7/1 | 3 → 3 | PASS |
| 36 | [Mammography System](http://localhost:5187/studios/how-devices-work/medical/mammography-system) | 12 → 18 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 37 | [Endoscope Camera System](http://localhost:5187/studios/how-devices-work/medical/endoscope-camera-system) | 12 → 18 | 4 → 4 | 1 → 2 | 6/1 → 6/1 | 3 → 3 | PASS |
| 38 | [Digital Microscope](http://localhost:5187/studios/how-devices-work/medical/digital-microscope) | 12 → 18 | 4 → 4 | 1 → 2 | 6/1 → 6/1 | 3 → 3 | PASS |
| 39 | [Ventilator](http://localhost:5187/studios/how-devices-work/medical/ventilator) | 11 → 17 | 3 → 3 | 3 → 4 | 8/1 → 8/1 | 3 → 3 | PASS |
| 40 | [Infusion Pump](http://localhost:5187/studios/how-devices-work/medical/infusion-pump) | 11 → 17 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 41 | [Syringe Pump](http://localhost:5187/studios/how-devices-work/medical/syringe-pump) | 11 → 17 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 42 | [Defibrillator](http://localhost:5187/studios/how-devices-work/medical/defibrillator) | 11 → 17 | 3 → 3 | 1 → 2 | 5/1 → 5/1 | 3 → 3 | PASS |
| 43 | [AED](http://localhost:5187/studios/how-devices-work/medical/aed) | 11 → 17 | 3 → 3 | 1 → 2 | 5/1 → 5/1 | 3 → 3 | PASS |
| 44 | [Pacemaker](http://localhost:5187/studios/how-devices-work/medical/pacemaker) | 13 → 19 | 5 → 5 | 2 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 45 | [Implantable Cardioverter Defibrillator](http://localhost:5187/studios/how-devices-work/medical/implantable-cardioverter-defibrillator) | 13 → 19 | 5 → 5 | 2 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 46 | [Dialysis Machine](http://localhost:5187/studios/how-devices-work/medical/dialysis-machine) | 12 → 18 | 4 → 4 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 47 | [CPAP Machine](http://localhost:5187/studios/how-devices-work/medical/cpap-machine) | 11 → 17 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 48 | [BiPAP Machine](http://localhost:5187/studios/how-devices-work/medical/bipap-machine) | 11 → 17 | 3 → 3 | 3 → 4 | 7/1 → 7/1 | 3 → 3 | PASS |
| 49 | [Anesthesia Machine](http://localhost:5187/studios/how-devices-work/medical/anesthesia-machine) | 11 → 17 | 3 → 3 | 3 → 4 | 7/1 → 7/1 | 3 → 3 | PASS |
| 50 | [Electrosurgical Unit](http://localhost:5187/studios/how-devices-work/medical/electrosurgical-unit) | 11 → 17 | 3 → 3 | 1 → 2 | 5/1 → 5/1 | 3 → 3 | PASS |
| 51 | [TENS Machine](http://localhost:5187/studios/how-devices-work/medical/tens-machine) | 11 → 17 | 3 → 3 | 1 → 2 | 5/1 → 5/1 | 3 → 3 | PASS |
| 52 | [Medical Laser System](http://localhost:5187/studios/how-devices-work/medical/medical-laser-system) | 11 → 17 | 3 → 3 | 1 → 2 | 6/1 → 6/1 | 3 → 3 | PASS |
| 53 | [Hearing Aid](http://localhost:5187/studios/how-devices-work/medical/hearing-aid) | 11 → 17 | 4 → 4 | 1 → 3 | 5/1 → 5/1 | 3 → 3 | PASS |
| 54 | [PCR Machine](http://localhost:5187/studios/how-devices-work/medical/pcr-machine) | 11 → 17 | 3 → 3 | 2 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 55 | [Centrifuge](http://localhost:5187/studios/how-devices-work/medical/centrifuge) | 13 → 17 | 13 → 13 | 4 → 4 | 6/1 → 6/1 | 1 → 3 | PASS |
| 56 | [Blood Cell Analyzer](http://localhost:5187/studios/how-devices-work/medical/blood-cell-analyzer) | 12 → 16 | 7 → 7 | 3 → 3 | 6/1 → 6/1 | 3 → 3 | PASS |
| 57 | [Automated Chemistry Analyzer](http://localhost:5187/studios/how-devices-work/medical/automated-chemistry-analyzer) | 13 → 17 | 8 → 8 | 7 → 7 | 6/1 → 6/1 | 3 → 3 | PASS |
| 58 | [Aircraft Flight Computer](http://localhost:5187/studios/how-devices-work/aviation/aircraft-flight-computer) | 14 → 18 | 2 → 2 | 6 → 6 | 6/1 → 6/1 | 3 → 3 | PASS |
| 59 | [Fly-by-Wire System](http://localhost:5187/studios/how-devices-work/aviation/fly-by-wire) | 10 → 14 | 3 → 3 | 4 → 4 | 6/1 → 6/1 | 3 → 3 | PASS |
| 60 | [Glass Cockpit](http://localhost:5187/studios/how-devices-work/aviation/glass-cockpit) | 12 → 16 | 3 → 3 | 4 → 4 | 5/3 → 5/3 | 3 → 3 | PASS |
| 61 | [Primary Flight Display](http://localhost:5187/studios/how-devices-work/aviation/primary-flight-display) | 12 → 16 | 4 → 4 | 1 → 1 | 8/1 → 8/1 | 3 → 3 | PASS |
| 62 | [Air Data Computer](http://localhost:5187/studios/how-devices-work/aviation/air-data-computer) | 12 → 16 | 3 → 3 | 10 → 10 | 6/1 → 6/1 | 3 → 3 | PASS |
| 63 | [Inertial Navigation System](http://localhost:5187/studios/how-devices-work/aviation/inertial-navigation-system) | 14 → 18 | 4 → 4 | 5 → 5 | 6/1 → 6/1 | 3 → 3 | PASS |
| 64 | [GPS Navigation System](http://localhost:5187/studios/how-devices-work/aviation/gps-navigation-system) | 14 → 18 | 4 → 4 | 9 → 9 | 5/1 → 5/1 | 3 → 3 | PASS |
| 65 | [Engine FADEC Controller](http://localhost:5187/studios/how-devices-work/aviation/engine-fadec-controller) | 12 → 16 | 3 → 3 | 6 → 6 | 6/1 → 6/1 | 5 → 5 | PASS |
| 66 | [Aircraft Engine Monitoring System](http://localhost:5187/studios/how-devices-work/aviation/aircraft-engine-monitoring-system) | 12 → 16 | 4 → 4 | 2 → 2 | 6/1 → 6/1 | 3 → 3 | PASS |
| 67 | [Drone Flight Controller](http://localhost:5187/studios/how-devices-work/aviation/drone-flight-controller) | 12 → 16 | 3 → 3 | 3 → 3 | 7/1 → 7/1 | 1 → 3 | PASS |
| 68 | [Weather Radar](http://localhost:5187/studios/how-devices-work/aviation/weather-radar) | 12 → 16 | 3 → 3 | 2 → 2 | 4/1 → 4/1 | 1 → 3 | PASS |
| 69 | [Radar Altimeter](http://localhost:5187/studios/how-devices-work/aviation/radar-altimeter) | 12 → 16 | 3 → 3 | 5 → 5 | 5/1 → 5/1 | 1 → 3 | PASS |
| 70 | [Radio Altimeter](http://localhost:5187/studios/how-devices-work/aviation/radio-altimeter) | 14 → 19 | 4 → 4 | 6 → 6 | 4/1 → 4/1 | 1 → 3 | PASS |
| 71 | [Aircraft Transponder](http://localhost:5187/studios/how-devices-work/aviation/aircraft-transponder) | 11 → 15 | 4 → 4 | 2 → 2 | 4/0 → 4/0 | 3 → 3 | PASS |
| 72 | [ADS-B System](http://localhost:5187/studios/how-devices-work/aviation/ads-b-system) | 11 → 16 | 2 → 2 | 6 → 6 | 6/1 → 6/1 | 1 → 3 | PASS |
| 73 | [Traffic Collision Avoidance System](http://localhost:5187/studios/how-devices-work/aviation/traffic-collision-avoidance-system) | 12 → 16 | 3 → 3 | 5 → 5 | 5/1 → 5/1 | 3 → 3 | PASS |
| 74 | [Flight Data Recorder](http://localhost:5187/studios/how-devices-work/aviation/flight-data-recorder) | 12 → 16 | 3 → 3 | 9 → 9 | 6/1 → 6/1 | 3 → 3 | PASS |
| 75 | [Cockpit Voice Recorder](http://localhost:5187/studios/how-devices-work/aviation/cockpit-voice-recorder) | 11 → 15 | 5 → 5 | 6 → 6 | 5/2 → 5/2 | 1 → 3 | PASS |
| 76 | [Satellite Communication Terminal](http://localhost:5187/studios/how-devices-work/aviation/satellite-communication-terminal) | 12 → 16 | 3 → 3 | 2 → 2 | 5/1 → 5/1 | 1 → 3 | PASS |
| 77 | [Satellite Attitude-Control Computer](http://localhost:5187/studios/how-devices-work/aviation/satellite-attitude-control-computer) | 11 → 15 | 3 → 3 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 78 | [Phased-Array Radar](http://localhost:5187/studios/how-devices-work/defence/phased-array-radar) | 13 → 17 | 3 → 3 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 79 | [Ground Surveillance Radar](http://localhost:5187/studios/how-devices-work/defence/ground-surveillance-radar) | 12 → 16 | 3 → 3 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 80 | [Passive Radar](http://localhost:5187/studios/how-devices-work/defence/passive-radar) | 11 → 15 | 3 → 3 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 81 | [Air-Defence Radar](http://localhost:5187/studios/how-devices-work/defence/air-defence-radar) | 12 → 16 | 3 → 3 | 10 → 10 | 5/1 → 5/1 | 1 → 3 | PASS |
| 82 | [Thermal Imaging Camera](http://localhost:5187/studios/how-devices-work/defence/thermal-imaging-camera) | 12 → 16 | 5 → 5 | 10 → 10 | 5/2 → 5/2 | 1 → 3 | PASS |
| 83 | [Night-Vision System](http://localhost:5187/studios/how-devices-work/defence/night-vision-system) | 11 → 15 | 2 → 2 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 84 | [Infrared Surveillance Camera](http://localhost:5187/studios/how-devices-work/defence/infrared-surveillance-camera) | 12 → 16 | 6 → 6 | 5 → 5 | 5/1 → 5/1 | 1 → 3 | PASS |
| 85 | [Laser Range Finder](http://localhost:5187/studios/how-devices-work/defence/laser-range-finder) | 10 → 14 | 3 → 3 | 3 → 3 | 4/1 → 4/1 | 1 → 3 | PASS |
| 86 | [Software Defined Radio](http://localhost:5187/studios/how-devices-work/defence/software-defined-radio) | 10 → 14 | 4 → 4 | 5 → 5 | 6/1 → 6/1 | 1 → 3 | PASS |
| 87 | [Secure Digital Radio](http://localhost:5187/studios/how-devices-work/defence/secure-digital-radio) | 11 → 15 | 3 → 3 | 2 → 2 | 5/1 → 5/1 | 1 → 3 | PASS |
| 88 | [IFF System](http://localhost:5187/studios/how-devices-work/defence/iff-system) | 10 → 14 | 11 → 11 | 3 → 3 | 4/1 → 4/1 | 1 → 3 | PASS |
| 89 | [Electronic Identification System](http://localhost:5187/studios/how-devices-work/defence/electronic-identification-system) | 10 → 14 | 4 → 4 | 2 → 2 | 3/1 → 3/1 | 1 → 3 | PASS |
| 90 | [Inertial Navigation System](http://localhost:5187/studios/how-devices-work/defence/inertial-navigation-system) | 10 → 14 | 3 → 3 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 91 | [GPS Receiver](http://localhost:5187/studios/how-devices-work/defence/gps-receiver) | 10 → 14 | 2 → 2 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 92 | [Electronic Compass](http://localhost:5187/studios/how-devices-work/defence/electronic-compass) | 9 → 13 | 3 → 3 | 2 → 2 | 6/1 → 6/1 | 1 → 3 | PASS |
| 93 | [Satellite Communication Terminal](http://localhost:5187/studios/how-devices-work/defence/satellite-communication-terminal) | 8 → 12 | 2 → 2 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 94 | [Perimeter Intrusion Detection System](http://localhost:5187/studios/how-devices-work/defence/perimeter-intrusion-detection-system) | 9 → 13 | 3 → 3 | 2 → 2 | 5/1 → 5/1 | 1 → 3 | PASS |
| 95 | [Biometric Access System](http://localhost:5187/studios/how-devices-work/defence/biometric-access-system) | 11 → 15 | 26 → 26 | 2 → 2 | 4/1 → 4/1 | 1 → 3 | PASS |
| 96 | [Sonar Detection System](http://localhost:5187/studios/how-devices-work/defence/sonar-detection-system) | 8 → 12 | 8 → 8 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 97 | [Unmanned Surveillance Vehicle Electronics](http://localhost:5187/studios/how-devices-work/defence/unmanned-surveillance-vehicle-electronics) | 9 → 13 | 6 → 6 | 5 → 5 | 4/1 → 4/1 | 1 → 3 | PASS |
| 98 | [Marine Radar](http://localhost:5187/studios/how-devices-work/marine/marine-radar) | 9 → 13 | 3 → 3 | 5 → 5 | 6/1 → 6/1 | 1 → 3 | PASS |
| 99 | [Fish Finder](http://localhost:5187/studios/how-devices-work/marine/fish-finder) | 9 → 13 | 4 → 4 | 12 → 12 | 6/1 → 6/1 | 1 → 3 | PASS |
| 100 | [Depth Sounder](http://localhost:5187/studios/how-devices-work/marine/depth-sounder) | 11 → 15 | 7 → 7 | 14 → 14 | 3/1 → 3/1 | 1 → 3 | PASS |
| 101 | [GPS Chartplotter](http://localhost:5187/studios/how-devices-work/marine/gps-chartplotter) | 10 → 14 | 4 → 4 | 5 → 5 | 4/1 → 4/1 | 1 → 3 | PASS |
| 102 | [Automatic Identification System (AIS)](http://localhost:5187/studios/how-devices-work/marine/ais) | 12 → 16 | 3 → 3 | 5 → 5 | 6/1 → 6/1 | 1 → 3 | PASS |
| 103 | [Marine Autopilot](http://localhost:5187/studios/how-devices-work/marine/marine-autopilot) | 10 → 14 | 4 → 4 | 3 → 3 | 3/1 → 3/1 | 1 → 3 | PASS |
| 104 | [Electronic Compass](http://localhost:5187/studios/how-devices-work/marine/electronic-compass) | 10 → 14 | 7 → 7 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 105 | [Marine VHF Radio](http://localhost:5187/studios/how-devices-work/marine/marine-vhf-radio) | 12 → 17 | 3 → 3 | 4 → 4 | 6/1 → 6/1 | 1 → 3 | PASS |
| 106 | [EPIRB Emergency Beacon](http://localhost:5187/studios/how-devices-work/marine/epirb-emergency-beacon) | 12 → 17 | 6 → 6 | 3 → 3 | 3/1 → 3/1 | 1 → 3 | PASS |
| 107 | [Dynamic Positioning System](http://localhost:5187/studios/how-devices-work/marine/dynamic-positioning-system) | 10 → 15 | 7 → 7 | 4 → 4 | 6/1 → 6/1 | 1 → 3 | PASS |
| 108 | [Underwater ROV Control System](http://localhost:5187/studios/how-devices-work/marine/underwater-rov-control-system) | 13 → 18 | 7 → 7 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 109 | [Autonomous Underwater Vehicle Navigation](http://localhost:5187/studios/how-devices-work/marine/autonomous-underwater-vehicle-navigation) | 10 → 15 | 7 → 7 | 4 → 4 | 12/1 → 12/1 | 1 → 3 | PASS |
| 110 | [Digital Engine Control](http://localhost:5187/studios/how-devices-work/marine/digital-engine-control) | 11 → 16 | 2 → 2 | 8 → 8 | 5/1 → 5/1 | 1 → 3 | PASS |
| 111 | [Servo Motor Controller](http://localhost:5187/studios/how-devices-work/robotics/servo-motor-controller) | 12 → 17 | 9 → 9 | 5 → 5 | 5/1 → 5/1 | 1 → 3 | PASS |
| 112 | [Stepper Motor Controller](http://localhost:5187/studios/how-devices-work/robotics/stepper-motor-controller) | 12 → 17 | 6 → 6 | 8 → 8 | 6/1 → 6/1 | 1 → 3 | PASS |
| 113 | [Mobile Robot](http://localhost:5187/studios/how-devices-work/robotics/mobile-robot) | 12 → 17 | 1 → 1 | 5 → 5 | 5/1 → 5/1 | 1 → 3 | PASS |
| 114 | [Line-Following Robot](http://localhost:5187/studios/how-devices-work/robotics/line-following-robot) | 10 → 15 | 11 → 11 | 4 → 4 | 8/1 → 8/1 | 1 → 3 | PASS |
| 115 | [Self-Balancing Robot](http://localhost:5187/studios/how-devices-work/robotics/self-balancing-robot) | 9 → 14 | 9 → 9 | 4 → 4 | 6/1 → 6/1 | 1 → 3 | PASS |
| 116 | [Industrial Robot Controller](http://localhost:5187/studios/how-devices-work/robotics/industrial-robot-controller) | 13 → 18 | 6 → 6 | 4 → 4 | 8/1 → 8/1 | 1 → 3 | PASS |
| 117 | [Collaborative Robot](http://localhost:5187/studios/how-devices-work/robotics/collaborative-robot) | 13 → 18 | 24 → 24 | 4 → 4 | 11/1 → 11/1 | 1 → 3 | PASS |
| 118 | [LiDAR Mapping Robot](http://localhost:5187/studios/how-devices-work/robotics/lidar-mapping-robot) | 17 → 21 | 6 → 6 | 10 → 10 | 6/1 → 6/1 | 1 → 3 | PASS |
| 119 | [SLAM Navigation System](http://localhost:5187/studios/how-devices-work/robotics/slam-navigation-system) | 10 → 15 | 7 → 7 | 11 → 11 | 8/1 → 8/1 | 1 → 3 | PASS |
| 120 | [Autonomous Mobile Robot](http://localhost:5187/studios/how-devices-work/robotics/autonomous-mobile-robot) | 12 → 18 | 1 → 1 | 5 → 5 | 5/1 → 5/1 | 1 → 3 | PASS |
| 121 | [Warehouse Robot](http://localhost:5187/studios/how-devices-work/robotics/warehouse-robot) | 11 → 15 | 9 → 9 | 3 → 3 | 6/1 → 6/1 | 1 → 3 | PASS |
| 122 | [Machine-Vision System](http://localhost:5187/studios/how-devices-work/robotics/machine-vision-system) | 13 → 18 | 7 → 7 | 4 → 4 | 8/1 → 8/1 | 1 → 3 | PASS |
| 123 | [Quadruped Robot](http://localhost:5187/studios/how-devices-work/robotics/quadruped-robot) | 11 → 16 | 20 → 20 | 4 → 4 | 6/1 → 6/1 | 1 → 3 | PASS |
| 124 | [Wi-Fi Router](http://localhost:5187/studios/how-devices-work/everyday/wi-fi-router) | 15 → 19 | 10 → 10 | 2 → 2 | 7/1 → 7/1 | 1 → 3 | PASS |
| 125 | [Bluetooth Headphones](http://localhost:5187/studios/how-devices-work/everyday/bluetooth-headphones) | 9 → 14 | 2 → 2 | 4 → 4 | 6/1 → 6/1 | 1 → 3 | PASS |
| 126 | [Smartwatch](http://localhost:5187/studios/how-devices-work/everyday/smartwatch) | 13 → 18 | 3 → 3 | 2 → 2 | 2/1 → 2/1 | 1 → 3 | PASS |
| 127 | [RFID Access Card](http://localhost:5187/studios/how-devices-work/everyday/rfid-access-card) | 16 → 21 | 3 → 3 | 9 → 9 | 4/1 → 4/1 | 1 → 3 | PASS |
| 128 | [Barcode Scanner](http://localhost:5187/studios/how-devices-work/everyday/barcode-scanner) | 20 → 25 | 9 → 9 | 9 → 9 | 4/2 → 4/2 | 1 → 3 | PASS |
| 129 | [QR Code Scanner](http://localhost:5187/studios/how-devices-work/everyday/qr-code-scanner) | 18 → 23 | 15 → 15 | 3 → 3 | 3/1 → 3/1 | 1 → 3 | PASS |
| 130 | [Biometric Fingerprint Scanner](http://localhost:5187/studios/how-devices-work/everyday/biometric-fingerprint-scanner) | 20 → 25 | 3 → 3 | 9 → 9 | 4/1 → 4/1 | 1 → 3 | PASS |
| 131 | [CCTV Camera](http://localhost:5187/studios/how-devices-work/everyday/cctv-camera) | 22 → 26 | 8 → 8 | 4 → 4 | 5/1 → 5/1 | 1 → 3 | PASS |
| 132 | [IR Camera](http://localhost:5187/studios/how-devices-work/everyday/ir-camera) | 16 → 21 | 15 → 15 | 2 → 2 | 4/1 → 4/1 | 1 → 3 | PASS |
| 133 | [Television](http://localhost:5187/studios/how-devices-work/everyday/television) | 23 → 28 | 12 → 12 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 134 | [Digital Door Lock](http://localhost:5187/studios/how-devices-work/everyday/digital-door-lock) | 14 → 19 | 2 → 2 | 2 → 2 | 4/1 → 4/1 | 1 → 3 | PASS |
| 135 | [Microwave Oven Controller](http://localhost:5187/studios/how-devices-work/everyday/microwave-oven-controller) | 12 → 18 | 7 → 7 | 2 → 2 | 6/1 → 6/1 | 1 → 3 | PASS |
| 136 | [Washing Machine Controller](http://localhost:5187/studios/how-devices-work/everyday/washing-machine-controller) | 10 → 15 | 14 → 15 | 3 → 3 | 5/1 → 5/1 | 1 → 3 | PASS |
| 137 | [Induction Cooktop](http://localhost:5187/studios/how-devices-work/everyday/induction-cooktop) | 7 → 11 | 2 → 2 | 5 → 5 | 6/1 → 6/1 | 1 → 3 | PASS |
| 138 | [Smart Energy Meter](http://localhost:5187/studios/how-devices-work/everyday/smart-energy-meter) | 14 → 17 | 13 → 13 | 10 → 10 | 7/1 → 7/1 | 1 → 3 | PASS |
| 139 | [GPS Receiver](http://localhost:5187/studios/how-devices-work/everyday/gps-receiver) | 9 → 14 | 4 → 4 | 5 → 5 | 6/1 → 6/1 | 1 → 3 | PASS |
| 140 | [Digital Multimeter](http://localhost:5187/studios/how-devices-work/everyday/digital-multimeter) | 11 → 16 | 7 → 7 | 6 → 6 | 6/2 → 6/2 | 1 → 3 | PASS |
