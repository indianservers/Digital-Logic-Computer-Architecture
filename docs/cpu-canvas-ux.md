# CPU canvas UX

The builder keeps the studio header compact and supports fullscreen authoring. Use the canvas toolbar to enter fullscreen, then use Parts, Inspector, Find, Views, Issues, Changes, and Keys without leaving it. Escape exits fullscreen. Editing module internals opens the existing full editor after exiting fullscreen.

## Delivered improvements

1. Searchable floating component palette; click to insert into the visible region or drag to position.
2. Floating inspector for names, widths, values, notes, and behavior-editor access.
3. Larger port targets.
4. Compatible input highlights, including replacement outputs during reconnection.
5. Live wire preview with width, direction, and occupied-input diagnostics. Escape cancels.
6. Quiet wire labels; hover or select a wire to see its details.
7. Obstacle-aware rectilinear routes with rounded corners in curved mode.
8. Selected-wire source and destination handles for pointer or keyboard reconnection. Failed reconnections preserve the original wire.
9. Selection toolbar beside the selected component: edit, duplicate, rotate, probe, delete.
10. Canvas, component, and selected-wire context actions.
11. Alignment guides and snapping while dragging components.
12. Canvas pans near its edges during a component drag.
13. Find components by name, type, or ID and jump to the result.
14. Named viewport bookmarks, saved locally per design name.
15. Select, Pan, and Wire modes, with V/H/W shortcuts.
16. Auto Arrange previews the layout before Apply or Cancel. Apply is undoable.
17. Resizable and independently collapsible side panels with locally saved sizes and collapse state.
18. Compact command bar with File menu and grouped edit/simulation actions.
19. Undo/redo descriptions in accessible labels and tooltips.
20. Clickable validation findings focus the component or connection; known offending inputs get a red ring.
21. Selection tracing highlights downstream connections and immediate drivers.
22. Changed component outputs/storage are highlighted after a step. Changes shows before/after values.
23. Canvas status includes running/paused/halted/error, cycle, instruction, and storage status. Errors remain visible in fullscreen.
24. Visual microcode rows, drives, conditions, branches, instruction boundaries, and halt flags; advanced JSON remains available. Existing custom-block visual forms remain available.
25. Keyboard selection/movement, port connection, reconnection, wire deletion, undo/redo, and shortcut reference.

## Interaction details

- Drag an empty area to pan. Shift-drag selects a region. Shift-click adds components to the selection.
- Drag a selected component to move the selection; release creates one undo entry.
- Scroll zooms around the pointer. Fit Canvas shows the entire design.
- Tab to an output, press Enter, then Tab to a compatible input and press Enter to connect.
- Select a wire, Tab to its reconnect handle, press Enter, then choose the replacement port.
- Arrow keys move a focused component by one grid step.
- Switch values and terminal/timer output are available beside the canvas when those devices are present.

Automatic routing avoids other component bounds, including rotated bounds. Manually specified wire bends remain authoritative. Overlapping components or enclosed endpoints can prevent a collision-free route; move those components apart. Routing has a bounded search to keep editing responsive.

Workspace preferences and bookmarks use browser-local storage. They are not included in project exports. Simulation records are kept in the existing bounded execution history.
