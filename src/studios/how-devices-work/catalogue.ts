export type DeviceCategory = "medical" | "aviation" | "defence" | "marine" | "robotics" | "everyday";
export type DeviceStatus = "upcoming" | "available" | "beta";
export type FeatureId = "anatomy" | "signal" | "logic" | "waveforms" | "simulation" | "failure";
export interface Device { id: string; slug: string; name: string; category: DeviceCategory; categories: DeviceCategory[]; shortDescription: string; longDescription: string; thumbnail: string; status: DeviceStatus; keywords: string[]; signalFlow: string[]; futureFeatures: FeatureId[] }
export interface Category { id: DeviceCategory; name: string; description: string; tagline: string; accent: string }
export const STUDIO_PATH = "/studios/how-devices-work";
export const devicePath = (device: Device) => `${STUDIO_PATH}/${device.category}/${device.slug}`;
export const CATEGORIES: Category[] = [
  {
    "id": "medical",
    "name": "Medical & Healthcare",
    "description": "Explore sensing, diagnosis, imaging, patient monitoring and digital treatment systems.",
    "tagline": "Vital signals. Extraordinary insight.",
    "accent": "#127e87"
  },
  {
    "id": "aviation",
    "name": "Aviation & Aerospace",
    "description": "Explore flight computing, navigation, control, sensing and aircraft communication systems.",
    "tagline": "Precision above the clouds.",
    "accent": "#3265b5"
  },
  {
    "id": "defence",
    "name": "Defence & Security",
    "description": "Study sensing, surveillance, secure communications, identification and defensive digital systems.",
    "tagline": "Sense, identify and protect.",
    "accent": "#596b61"
  },
  {
    "id": "marine",
    "name": "Marine & Navigation",
    "description": "Understand how ships and underwater systems sense, communicate and navigate.",
    "tagline": "Discover what lies beneath.",
    "accent": "#167d9c"
  },
  {
    "id": "robotics",
    "name": "Robotics & Automation",
    "description": "Explore sensing, motion control, feedback, perception and intelligent automation.",
    "tagline": "From perception to movement.",
    "accent": "#93662d"
  },
  {
    "id": "everyday",
    "name": "Everyday Digital Technology",
    "description": "Open up familiar devices and discover the electronics and digital logic hidden inside them.",
    "tagline": "The remarkable inside the familiar.",
    "accent": "#725ca8"
  }
];
export const DEVICES: Device[] = [
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
    "longDescription": "Compare red and infrared light absorption to estimate blood oxygen saturation and pulse rate. The Pulse Oximeter signal path begins with red / ir leds and leads to spo₂ display. Between these endpoints, finger tissue, photodiode, analog front end, adc / ratio processing connect the physical system to its digital processing and output.",
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
      "spo₂ display"
    ],
    "signalFlow": [
      "Red / IR LEDs",
      "Finger tissue",
      "Photodiode",
      "Analog front end",
      "ADC / ratio processing",
      "SpO₂ display"
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
    "shortDescription": "Cycle a sample through controlled temperatures to amplify selected DNA; real-time PCR instruments also monitor fluorescence.",
    "longDescription": "Cycle a sample through controlled temperatures to amplify selected DNA; real-time PCR instruments also monitor fluorescence. The PCR Machine signal path begins with thermal program and leads to amplification curve. Between these endpoints, temperature sensing, feedback controller, heater / cooler, fluorescence detector connect the physical system to its digital processing and output.",
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
    "shortDescription": "Broadcast vessel identity and navigation data and decode nearby ships’ standardized messages.",
    "longDescription": "Broadcast vessel identity and navigation data and decode nearby ships’ standardized messages. The Automatic Identification System (AIS) signal path begins with gnss / vessel data and leads to traffic display. Between these endpoints, ais encoder, time-slot scheduler, vhf transmitter, nearby receiver connect the physical system to its digital processing and output.",
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
    "shortDescription": "Combine inertial, acoustic and velocity measurements to estimate an underwater vehicle’s position.",
    "longDescription": "Combine inertial, acoustic and velocity measurements to estimate an underwater vehicle’s position. The Autonomous Underwater Vehicle Navigation signal path begins with imu / acoustic / velocity sensors and leads to navigation telemetry. Between these endpoints, sensor acquisition, navigation filter, mission planner, vehicle controller connect the physical system to its digital processing and output.",
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
    "shortDescription": "Match observations over time to build a map while estimating the robot’s position.",
    "longDescription": "Match observations over time to build a map while estimating the robot’s position. The SLAM Navigation System signal path begins with camera / lidar / odometry and leads to navigation planner. Between these endpoints, feature extraction, data association, pose estimation, map update connect the physical system to its digital processing and output.",
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
export function findDevice(category: string | undefined, slug: string | undefined) { return DEVICES.find(device => device.category === category && device.slug === slug); }
export function searchDevices(query: string, category?: string) { const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean); return DEVICES.filter(device => (!category || device.categories.some(id => id === category)) && terms.every(term => [device.name, ...CATEGORIES.filter(item => device.categories.includes(item.id)).map(item => item.name), ...device.keywords].join(" ").toLowerCase().includes(term))); }
export const FEATURES: Record<FeatureId, {title: string; description: string}> = {
 anatomy: { title: "Device Anatomy", description: "Explore the major internal modules." },
 signal: { title: "Signal Journey", description: "Trace signals through the system." },
 logic: { title: "Digital Logic", description: "See how data becomes binary and is processed." },
 waveforms: { title: "Waveforms", description: "Inspect important signals and timing." },
 simulation: { title: "Interactive Simulation", description: "Change inputs and observe system behaviour." },
 failure: { title: "Failure Explorer", description: "Discover what happens when key components fail." },
};
const RELATED: Record<string, string[]> = {
 "medical/mri-scanner": ["ct-scanner", "pet-scanner", "ultrasound-scanner", "x-ray-machine"],
 "everyday/tv-remote": ["television", "ir-camera", "nfc-payment-system", "smartphone"],
 "aviation/aircraft-autopilot": ["aircraft-flight-computer", "fly-by-wire", "air-data-computer", "inertial-navigation-system"],
};
export function relatedDevices(device: Device) {
 const preferred = RELATED[device.id];
 if (preferred) return preferred.map(slug => DEVICES.find(item => item.slug === slug && item.categories.includes(device.category))).filter((item): item is Device => Boolean(item));
 return DEVICES.filter(item => item.id !== device.id && item.categories.some(category => device.categories.includes(category))).sort((a, b) => Number(b.keywords[0] === device.keywords[0]) - Number(a.keywords[0] === device.keywords[0])).slice(0, 4);
}
