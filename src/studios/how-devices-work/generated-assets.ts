/** Native-resolution generated masters; captions and component names stay in HTML. */
export const SONAR_GENERATED_ROOT = '/device-labs/generated/011-sonar';
const INS_ROOT='/device-labs/generated/063-inertial-navigation-system';
export const GENERATED_DEVICE_ART: Record<number, Record<string, string>> = {
  63: Object.fromEntries(['hero','external','internal','context','device'].map(role=>[role,`${INS_ROOT}/${role==='device'?'external':role}.png`])),
  11: { hero: `${SONAR_GENERATED_ROOT}/hero.png`, external: `${SONAR_GENERATED_ROOT}/external.png`, internal: `${SONAR_GENERATED_ROOT}/internal.png` },
};
export const GENERATED_PART_ART: Record<number, Record<string, string>> = {
  63: Object.fromEntries([['Gyroscope assembly','gyroscope-assembly'],['Accelerometer assembly','accelerometer-assembly'],['ADC interface','adc-interface'],['Processor board','processor-board'],['Memory','memory-v2'],['Power supply','power-supply'],['Data bus interface','data-bus-interface'],['Rugged enclosure','rugged-enclosure']].map(([name,file])=>[name,`${INS_ROOT}/${file}.png`])),
  11: Object.fromEntries([
    ['Pulse generator', 'pulse-generator'], ['Power amplifier', 'power-amplifier'],
    ['Transducer', 'transducer'], ['Receive amplifier', 'receive-amplifier'],
    ['ADC', 'adc'], ['Echo processor', 'echo-processor'],
    ['Display', 'display'], ['Pressure housing', 'pressure-housing'],
  ].map(([name, file]) => [name, `${SONAR_GENERATED_ROOT}/${file}.png`])),
};

