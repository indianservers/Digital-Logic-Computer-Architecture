# MCU project 3D workbenches

The robotic arm, DC motor, line-following robot and ultrasonic distance meter project labs lazy-load `ProjectThreeScene`. Other projects retain their existing scenes. Three.js assemblies use local procedural geometry, physically based materials, lights and shadows, with no external asset requests.

- Arm: base, shoulder, elbow, wrist and gripper follow runtime outputs; the payload follows the tool while held and moves to the placement pad on release.
- Motor: simulator memory integrates shaft angle using RPM over each time step, including acceleration and direction. Input edits at zero elapsed time cannot jump the rotor.
- Robot: the runtime and renderer share `projectTrack`, including a distinct Challenging track. Wheel angles integrate the individual PWM outputs. Position and sensor indicators use runtime outputs. The existing path-following visualization remains an educational display model rather than a rigid-body dynamics model.
- Ultrasonic: target position follows raw simulated distance; the readout shows measured distance and echo quality. An outgoing/return ring is shown only for valid echoes. Pulse travel is deliberately slowed and labeled; the timing readout retains the simulator calculation.

Run, Pause, Step, Reset, firmware changes, arm presets/playback and experiment controls use the existing runtime. Rendering never calls the simulator. A bounded 100 ms display extrapolation smooths rotor/wheel rotation between ticks while running. Pause displays the exact stored state. Shared Motion off / reduced motion hides pulse travel and decorative rotation while retaining actual arm/robot positions and measurements.

Perspective, Top and Front controls supplement drag-to-orbit and scroll/pinch-to-zoom. ResizeObserver sizes the canvas; rendering suspends offscreen or in hidden tabs. Pixel ratio is capped at 2. Scene resources, controls, observers and WebGL contexts are released on navigation. WebGL creation failure or context loss falls back to the existing image scene and keeps controls usable.

Verification: `npm exec vitest run src/studios/microcontroller/projectThree.test.ts src/studios/microcontroller/projectEngine.test.ts`. Browser checks cover all four routes, stepping, running, paused canvas stability, reset, camera buttons, mobile overflow, reduced motion and WebGL fallback.
