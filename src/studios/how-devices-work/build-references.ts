export interface BuildItem {name:string;quantity:string;purpose:string;purchase:string}
export interface BuildReference {title:string;scope:string;source:string;assemblySource:string;items:BuildItem[];completion:string}
const thermometer:BuildReference={
 title:'Educational temperature reader — TMP36 and a development board',
 scope:'Alternative room-temperature demonstration. It replaces the thermistor chain with an analog TMP36 and reports readings to a computer; it is not the illustrated clinical thermometer or an LCD build.',
 source:'https://learn.adafruit.com/tmp36-temperature-sensor/using-a-temp-sensor',
 assemblySource:'https://learn.adafruit.com/tmp36-temperature-sensor/using-a-temp-sensor',
 items:[
  {name:'TMP36 analog temperature sensor',quantity:'1',purpose:'Produces a temperature-dependent analog voltage.',purchase:'Required; pin orientation must follow the guide.'},
  {name:'Arduino Uno development board',quantity:'1',purpose:'Includes ADC and microcontroller; reads the sensor and sends serial measurements.',purchase:'Required; use the guide-compatible board and code.'},
  {name:'Solderless breadboard',quantity:'1',purpose:'Supports the sensor and temporary electrical connections.',purchase:'Required for the illustrated prototype.'},
  {name:'Breadboard jumper wires',quantity:'3 connections',purpose:'Connects sensor supply, ground and analog output.',purchase:'Required; supply, ground and A0 connections follow the guide.'},
  {name:'Arduino Uno USB programming cable',quantity:'1',purpose:'Powers the board and carries firmware and serial measurements.',purchase:'Required; connector must match the selected Uno revision.'},
  {name:'Computer with Arduino software',quantity:'1 existing host',purpose:'Loads the program and shows temperature readings.',purchase:'External equipment / software prerequisite.'},
 ],
 completion:'Follow the source wiring and example program, verify sensor voltage and compare readings with a reference. A finished enclosure, battery supply and standalone display need a separate revised BOM.',
};
const robot:BuildReference={
 title:'Educational tracked robot — Zumo 2040 kit',
 scope:'Alternative tracked platform for mobile-robot and line-following exercises. The kit electronics replace the generic controller and motor-driver choices shown elsewhere; do not combine the two inventories into one shopping list.',
 source:'https://www.pololu.com/product/5010',
 assemblySource:'https://www.pololu.com/docs/0J87/all',
 items:[
  {name:'Zumo 2040 robot kit (without motors)',quantity:'1 kit',purpose:'Provides the matched chassis, control electronics, sensor board, display and kit hardware.',purchase:'Required parent assembly; child items below are included, not extra purchases.'},
  {name:'Zumo tracked chassis assembly',quantity:'1 included assembly',purpose:'Carries the electronics and provides tracks, sprockets and battery mounting.',purchase:'Included in kit; use all supplied mounting hardware in the assembly guide.'},
  {name:'Zumo 2040 controller board assembly',quantity:'1 included board',purpose:'Integrates controller, motor drivers, encoder sensing and other onboard electronics.',purchase:'Included in kit; includes matched encoder magnets and buzzer.'},
  {name:'Zumo 2040 front sensing board',quantity:'1 included board',purpose:'Observes the floor and nearby obstacles for line following and proximity behavior.',purchase:'Included in kit.'},
  {name:'Zumo front blade and IR emitter holder',quantity:'1 included set',purpose:'Provides the front mechanical assembly and positions the emitter hardware.',purchase:'Included in kit; install as directed by the manufacturer.'},
  {name:'Zumo graphical display module',quantity:'1 included module',purpose:'Presents local program information and sensor feedback.',purchase:'Included in kit.'},
  {name:'Extended-shaft micro metal gearmotor',quantity:'2',purpose:'Drives the left and right tracks; shaft extensions accept the encoder magnets.',purchase:'Sold separately; choose a manufacturer-recommended HP/HPCB ratio compatible with the chassis.'},
  {name:'AA battery cell',quantity:'4',purpose:'Supplies the motor and controller power through the chassis contacts.',purchase:'Sold separately; manufacturer supports alkaline or NiMH cells.'},
  {name:'USB-C programming cable',quantity:'1',purpose:'Connects the controller to a computer for firmware loading.',purchase:'Sold separately; use a data-capable cable.'},
  {name:'Robot assembly and programming tools',quantity:'Tool set',purpose:'Supports soldering, fastener installation and program loading.',purchase:'External tools; follow the manufacturer tool list and setup instructions.'},
 ],
 completion:'Use the manufacturer assembly guide, its firmware libraries and a compatible example. Test polarity, each drive and each sensor before line-following trials. Kit details must match the revision being purchased.',
};
export const BUILD_REFERENCES:Record<number,BuildReference>={1:thermometer,113:robot,114:robot};
