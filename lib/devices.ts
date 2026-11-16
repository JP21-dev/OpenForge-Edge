export type Point = [number, number];

export interface ScrewGroup {
  id: string;
  label: string;
  head: string;
  length: string;
  count: number;
  view: string;
  positions: Point[];
  note?: string;
}

export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; label?: string; tone?: "body" | "part" | "chip" | "hot" }
  | { kind: "circle"; x: number; y: number; r: number; label?: string; tone?: "body" | "part" | "chip" | "hot" }
  | { kind: "text"; x: number; y: number; text: string };

export interface DeviceView {
  title: string;
  caption: string;
  shapes: Shape[];
}

export interface StepSuggestion {
  title: string;
  detail?: string;
}

export interface ProcedureStep {
  id: string;
  title: string;
  detail?: string;
  view?: string;
  screws?: string[];
  onFail?: StepSuggestion[];
  added?: boolean;
}

export const TEARDOWN_FAIL: StepSuggestion[] = [
  { title: "Free a stripped or stuck screw", detail: "Use a fresh bit and press down hard while turning. A rubber band between bit and screw helps; a screw extractor is the last resort." },
  { title: "Look for a hidden screw or clip", detail: "Check under stickers and labels and recheck this stage's screw list before applying force." },
  { title: "Inspect for damage before continuing", detail: "Check for cracked clips, torn ribbon cables or bent connectors from the stuck part." },
];

const INSPECT_FAIL: StepSuggestion[] = [
  { title: "Photograph and note the damage", detail: "Record burnt parts, corrosion or residue and where they are before cleaning anything." },
  { title: "Clean corrosion and residue", detail: "Isopropyl alcohol and a soft brush, then dry fully. Re-inspect under magnification." },
  { title: "Check damaged areas for shorts to ground", detail: "Diode or resistance mode across nearby capacitors and the rail they sit on." },
];

const SHORT_FAIL: StepSuggestion[] = [
  { title: "Locate the shorted component", detail: "Thermal camera, freeze spray or isopropyl while injecting a low, current-limited voltage into the shorted rail." },
  { title: "Lift suspect capacitors one at a time", detail: "Re-measure the rail after each one until the short clears." },
  { title: "Replace any open fuse after clearing the short", detail: "Match the original rating; a new fuse on a live short will blow again." },
];

export interface Procedure {
  id: string;
  title: string;
  summary: string;
  steps: ProcedureStep[];
}

export type DeviceGroup = "Consoles" | "Phones" | "Tablets" | "Laptops";

export interface DeviceProfile {
  id: string;
  name: string;
  group?: DeviceGroup;
  starter?: boolean;
  ifixit?: string;
  revisions: string[];
  sources: { label: string; url: string }[];
  views: Record<string, DeviceView>;
  screws: Record<string, ScrewGroup>;
  procedures: Procedure[];
}

const W = 100;
const H = 160;
export const VIEW_BOX = `0 0 ${W} ${H}`;

function perimeter(n: number, x: number, y: number, w: number, h: number): Point[] {
  const total = 2 * (w + h);
  return Array.from({ length: n }, (_, i) => {
    let d = (i / n) * total;
    if (d < w) return [x + d, y];
    d -= w;
    if (d < h) return [x + w, y + d];
    d -= h;
    if (d < w) return [x + w - d, y + h];
    d -= w;
    return [x, y + h - d];
  }).map(([px, py]) => [Math.round(px * 10) / 10, Math.round(py * 10) / 10] as Point);
}

function grid(cols: number, rows: number, x: number, y: number, w: number, h: number): Point[] {
  const pts: Point[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) pts.push([x + (w * (c + 0.5)) / cols, y + (h * (r + 0.5)) / rows]);
  return pts;
}

const screwMap = (groups: ScrewGroup[]) => Object.fromEntries(groups.map((g) => [g.id, g]));

const PS5_SHIELD = [...perimeter(30, 15, 11, 70, 138), ...grid(3, 4, 25, 30, 50, 100).slice(0, 11)];

const PS5: DeviceProfile = {
  id: "ps5",
  name: "PlayStation 5",
  group: "Consoles",
  ifixit: "PlayStation 5",
  revisions: ["EDM-010", "EDM-020", "EDM-031", "EDM-033"],
  sources: [
    { label: "iFixit: PlayStation 5 Teardown", url: "https://www.ifixit.com/Teardown/PlayStation+5+Teardown/138280" },
    { label: "iFixit: How to Apply Liquid Metal in a PlayStation 5", url: "https://www.ifixit.com/Guide/How+to+Apply+Liquid+Metal+in+a+PlayStation+5/170479" },
  ],
  views: {
    exterior: {
      title: "Outside, console standing",
      caption: "Original PS5 (CFI-10xx) seen from the right side.",
      shapes: [
        { kind: "rect", x: 12, y: 6, w: 76, h: 140, tone: "body", label: "Faceplate" },
        { kind: "rect", x: 32, y: 146, w: 36, h: 9, tone: "part", label: "Stand" },
      ],
    },
    side: {
      title: "Faceplate removed",
      caption: "Fan, M.2 bay and the black inner case. Case screws run around the edge.",
      shapes: [
        { kind: "rect", x: 12, y: 6, w: 76, h: 146, tone: "body" },
        { kind: "circle", x: 55, y: 41, r: 20, tone: "part", label: "120 mm fan" },
        { kind: "rect", x: 22, y: 82, w: 30, h: 40, tone: "part", label: "M.2 bay" },
        { kind: "rect", x: 58, y: 84, w: 24, h: 56, tone: "part", label: "Optical drive" },
      ],
    },
    shield: {
      title: "Case off: top shield plate",
      caption: "The steel shield covers the back of the main board. 42 screws, mostly around the edge.",
      shapes: [
        { kind: "rect", x: 12, y: 8, w: 76, h: 144, tone: "body", label: "" },
        { kind: "rect", x: 26, y: 36, w: 48, h: 40, tone: "part", label: "VRM heat pipe" },
        { kind: "text", x: 50, y: 110, text: "Top shield plate" },
      ],
    },
    board: {
      title: "Main board",
      caption: "Board side with the APU. Liquid metal sits under the heatsink, inside a foam barrier.",
      shapes: [
        { kind: "rect", x: 12, y: 18, w: 76, h: 124, tone: "body" },
        { kind: "rect", x: 38, y: 56, w: 24, h: 24, tone: "hot", label: "APU" },
        ...grid(4, 2, 30, 46, 40, 44)
          .filter(([, y]) => y < 52 || y > 84)
          .map(([x, y]) => ({ kind: "rect" as const, x: x - 4, y: y - 3, w: 8, h: 6, tone: "chip" as const })),
        { kind: "text", x: 50, y: 98, text: "GDDR6 around the APU" },
        { kind: "rect", x: 16, y: 118, w: 26, h: 8, tone: "part", label: "M.2 slot" },
        { kind: "rect", x: 66, y: 128, w: 18, h: 10, tone: "part", label: "HDMI" },
      ],
    },
  },
  screws: screwMap([
    { id: "stand", label: "Stand", head: "Coin / flathead", length: "26.5 mm", count: 1, view: "exterior", positions: [[50, 150]] },
    { id: "shroud-23", label: "Fan shroud", head: "TR9", length: "23.3 mm", count: 2, view: "side", positions: [[32, 20], [78, 20]] },
    { id: "shroud-11", label: "Fan shroud", head: "TR9", length: "11.4 mm", count: 1, view: "side", positions: [[32, 62]] },
    { id: "shroud-31", label: "Fan shroud", head: "TR9", length: "31 mm", count: 1, view: "side", positions: [[78, 62]] },
    { id: "ssd-cover", label: "SSD cover", head: "Phillips", length: "17 mm", count: 1, view: "side", positions: [[37, 118]] },
    { id: "case-18", label: "Case", head: "TR8", length: "18.6 mm", count: 6, view: "side", positions: [[16, 10], [84, 10], [16, 78], [84, 78], [16, 148], [84, 148]] },
    { id: "case-23", label: "Case", head: "TR8", length: "23.3 mm", count: 2, view: "side", positions: [[50, 9], [50, 149]] },
    { id: "case-43", label: "Case", head: "TR8", length: "43.2 mm", count: 2, view: "side", positions: [[16, 112], [84, 112]] },
    { id: "case-7", label: "Case", head: "TR8", length: "7.3 mm", count: 1, view: "side", positions: [[56, 148]], note: "One case screw sits under a tamper-evident sticker" },
    { id: "shield-7", label: "Top shield", head: "TR8", length: "7.3 mm", count: 41, view: "shield", positions: PS5_SHIELD },
    { id: "shield-43", label: "Top shield", head: "TR8", length: "43.2 mm", count: 1, view: "shield", positions: [[50, 128]] },
    { id: "bracket", label: "APU tension bracket", head: "Phillips", length: "11.8 mm", count: 2, view: "board", positions: [[32, 68], [68, 68]], note: "Loosen alternately, a little at a time" },
    { id: "ssd-screw", label: "Main board (SSD)", head: "Phillips", length: "11 mm", count: 1, view: "board", positions: [[44, 122]] },
    { id: "board-7", label: "Main board", head: "TR8", length: "7.3 mm", count: 2, view: "board", positions: [[16, 22], [84, 138]] },
  ]),
  procedures: [],
};

const PS5_OPEN: ProcedureStep[] = [
  { id: "stand", title: "Remove the stand", detail: "Remove the stand screw, the stand and the cubby cap.", view: "exterior", screws: ["stand"] },
  { id: "faceplate", title: "Remove the faceplate", detail: "Lift the corner and slide the faceplate off. It is held by clips only.", view: "side" },
  { id: "fan", title: "Remove the fan shroud and fan", detail: "Disconnect the fan by its connector, never the wires.", view: "side", screws: ["shroud-23", "shroud-11", "shroud-31"] },
];

const PS5_TO_SHIELD: ProcedureStep[] = [
  ...PS5_OPEN,
  { id: "ssd-cover", title: "Remove the SSD cover", detail: "Disconnect the optical drive cable by its connector.", view: "side", screws: ["ssd-cover"] },
  { id: "case", title: "Remove the case and optical drive", detail: "Lift the black case half, then slide the optical drive out. The drive is paired to this board.", view: "side", screws: ["case-18", "case-23", "case-43", "case-7"] },
  { id: "cables", title: "Disconnect ribbon and antenna cables", detail: "Some revisions have no antenna wires.", view: "shield" },
  { id: "shield", title: "Remove the top shield plate", detail: "Keep the thermal pads; replacements must be the same thickness.", view: "shield", screws: ["shield-7", "shield-43"] },
];

const PS5_BOARD_OUT: ProcedureStep[] = [
  ...PS5_TO_SHIELD,
  { id: "usb", title: "Disconnect the USB board cable", view: "board" },
  { id: "board", title: "Loosen the APU bracket and lift the board", detail: "Loosen the two bracket screws alternately. Separate the board from the power supply prongs without pressing it onto the bench.", view: "board", screws: ["bracket", "ssd-screw", "board-7"] },
];

PS5.procedures = [
  {
    id: "no-power",
    title: "No power / no video diagnosis",
    summary: "Open to the main board, then work through the power checks.",
    steps: [
      ...PS5_TO_SHIELD,
      {
        id: "inspect",
        title: "Visual inspection",
        detail: "HDMI port, burnt parts, liquid metal outside the APU barrier.",
        view: "board",
        onFail: [
          ...INSPECT_FAIL,
          { title: "Check for liquid metal leakage", detail: "Silver residue outside the APU barrier can short capacitors near the 12 V area. Clean it off completely before powering on." },
        ],
      },
      {
        id: "12v",
        title: "Confirm 12 V from the power supply",
        view: "board",
        onFail: [
          { title: "Check the 12 V rail for a short to ground", detail: "A board-side short can stop the supply from starting." },
          { title: "Test with a known-good power supply", detail: "If 12 V appears with another supply and the board has no short, the original PSU has failed." },
          { title: "Inspect around the 12 V area", detail: "Look for shorted or burnt capacitors and liquid metal residue." },
        ],
      },
      {
        id: "5v",
        title: "Check 5 V and southbridge voltages",
        view: "board",
        onFail: [
          { title: "Check the missing rail for a short to ground", detail: "Measure resistance or diode mode on the rail with power off." },
          { title: "Check the regulator's input and enable", detail: "If its input is present but the output is missing, suspect the regulator itself." },
          { title: "Check fuses for continuity", detail: "Fuse designators differ between revisions; confirm on your boardview." },
        ],
      },
      { id: "fuses", title: "Check fuses and shorts to ground", view: "board", onFail: SHORT_FAIL },
      {
        id: "uart",
        title: "Read UART error codes",
        view: "board",
        onFail: [
          { title: "Ask the copilot about the error code", detail: "Paste the code into the chat so it can search the manuals and past repairs." },
          { title: "Dump the NOR flash", detail: "Read the SPI flash next to the southbridge to recover the error log." },
          { title: "Check the UART connection", detail: "Confirm ground, TX/RX wiring and the adapter's voltage level before trusting an empty log." },
        ],
      },
    ],
  },
  {
    id: "fan-clean",
    title: "Fan cleaning or replacement",
    summary: "Only the stand, faceplate and fan shroud come off.",
    steps: [
      ...PS5_OPEN,
      {
        id: "clean",
        title: "Clean the fan and dust ports",
        detail: "Vacuum the two dust ports beside the fan.",
        view: "side",
        onFail: [
          { title: "Spin the fan by hand", detail: "Rough or noisy bearings mean the fan should be replaced." },
          { title: "Check the fan cable and connector", detail: "Look for pinched wires or a bent connector pin." },
        ],
      },
    ],
  },
  {
    id: "repaste",
    title: "APU liquid metal service",
    summary: "Full teardown to the APU, then clean and re-apply liquid metal.",
    steps: [
      ...PS5_BOARD_OUT,
      { id: "clean-lm", title: "Clean the APU and heatsink", detail: "Gloves on. Isopropyl alcohol above 90 %. Leave the foam barrier in place.", view: "board" },
      { id: "apply-lm", title: "Apply liquid metal", detail: "Thin, complete layer on both surfaces. Keep it off the board: it is conductive.", view: "board" },
    ],
  },
];

const XSX: DeviceProfile = {
  id: "xbox-series-x",
  name: "Xbox Series X",
  group: "Consoles",
  ifixit: "Xbox Series X",
  revisions: [],
  sources: [
    { label: "iFixit: Xbox Series X Teardown", url: "https://www.ifixit.com/Teardown/Xbox+Series+X+Teardown/138451" },
    { label: "iFixit: Xbox Series X Motherboard and Heatsink Assembly Replacement", url: "https://www.ifixit.com/Guide/Xbox+Series+X+Motherboard+and+Heatsink+Assembly+Replacement/141751" },
  ],
  views: {
    rear: {
      title: "Back of the console",
      caption: "Both back-panel screws are hidden under stickers. All screws are T8 Torx.",
      shapes: [
        { kind: "rect", x: 16, y: 6, w: 68, h: 148, tone: "body", label: "" },
        { kind: "circle", x: 50, y: 30, r: 18, tone: "part", label: "Vents" },
        { kind: "rect", x: 26, y: 112, w: 48, h: 10, tone: "part", label: "Ports" },
        { kind: "text", x: 50, y: 80, text: "Back panel" },
      ],
    },
    interior: {
      title: "Back panel off",
      caption: "Fan at the top, optical drive below, power port at the base.",
      shapes: [
        { kind: "rect", x: 16, y: 6, w: 68, h: 148, tone: "body" },
        { kind: "circle", x: 50, y: 34, r: 20, tone: "part", label: "130 mm fan" },
        { kind: "rect", x: 20, y: 86, w: 34, h: 52, tone: "part", label: "Optical drive" },
        { kind: "rect", x: 60, y: 86, w: 20, h: 30, tone: "part", label: "Antenna" },
        { kind: "rect", x: 58, y: 132, w: 24, h: 16, tone: "part", label: "Power port" },
      ],
    },
    shield: {
      title: "Board shield and power supply",
      caption: "Shield over the motherboard, PSU at the base held by the chassis strap.",
      shapes: [
        { kind: "rect", x: 16, y: 6, w: 68, h: 148, tone: "body" },
        { kind: "rect", x: 22, y: 12, w: 56, h: 80, tone: "part", label: "Board shield" },
        { kind: "rect", x: 54, y: 100, w: 28, h: 50, tone: "part", label: "PSU" },
      ],
    },
    board: {
      title: "Motherboard sandwich",
      caption: "Two boards with the aluminium center chassis between them.",
      shapes: [
        { kind: "rect", x: 16, y: 10, w: 68, h: 140, tone: "body" },
        { kind: "rect", x: 38, y: 52, w: 24, h: 24, tone: "hot", label: "SoC" },
        ...grid(5, 2, 26, 40, 48, 48)
          .filter(([, y]) => y < 50 || y > 78)
          .map(([x, y]) => ({ kind: "rect" as const, x: x - 4, y: y - 3, w: 8, h: 6, tone: "chip" as const })),
        { kind: "text", x: 50, y: 98, text: "GDDR6 around the SoC" },
        { kind: "rect", x: 22, y: 116, w: 26, h: 10, tone: "part", label: "SSD 2230" },
        { kind: "rect", x: 60, y: 130, w: 20, h: 10, tone: "part", label: "HDMI" },
      ],
    },
  },
  screws: screwMap([
    { id: "back", label: "Back panel", head: "T8", length: "7.4 mm", count: 2, view: "rear", positions: [[34, 146], [64, 132]], note: "Under stickers: a small one near the base and a large one" },
    { id: "fan-105", label: "Fan", head: "T8", length: "10.5 mm pancake", count: 1, view: "interior", positions: [[28, 16]] },
    { id: "fan-88", label: "Fan", head: "T8", length: "8.8 mm", count: 2, view: "interior", positions: [[72, 16], [72, 52]] },
    { id: "odd", label: "Optical drive isolator", head: "T8", length: "8.8 mm", count: 2, view: "interior", positions: [[24, 90], [50, 134]] },
    { id: "chassis", label: "Center chassis", head: "T8", length: "7.4 mm", count: 3, view: "interior", positions: [[20, 70], [80, 70], [56, 122]] },
    { id: "port-13", label: "Power port", head: "T8", length: "13.1 mm", count: 2, view: "interior", positions: [[61, 136], [79, 136]] },
    { id: "port-35", label: "Power port", head: "T8", length: "35 mm", count: 1, view: "interior", positions: [[70, 150]] },
    { id: "corner", label: "Corner cover", head: "T8", length: "8.8 mm", count: 1, view: "interior", positions: [[80, 10]], note: "Some units have no corner cover" },
    { id: "antenna", label: "Antenna board", head: "T8", length: "9.6 mm", count: 3, view: "interior", positions: [[63, 90], [77, 90], [70, 113]] },
    { id: "shield-88", label: "Board shield", head: "T8 (black)", length: "8.8 mm", count: 6, view: "shield", positions: perimeter(6, 24, 14, 52, 76) },
    { id: "shield-35", label: "Board shield", head: "T8 (silver)", length: "35 mm", count: 2, view: "shield", positions: [[30, 88], [70, 88]] },
    { id: "shield-13", label: "Board shield", head: "T8 (silver)", length: "13.1 mm", count: 1, view: "shield", positions: [[50, 90]] },
    { id: "psu-35", label: "Power supply", head: "T8 (silver)", length: "35 mm", count: 3, view: "shield", positions: [[57, 104], [79, 104], [57, 146]], note: "Leave the fourth, black screw in place" },
    { id: "ssd", label: "SSD", head: "T8", length: "5.2 mm", count: 1, view: "board", positions: [[46, 121]] },
  ]),
  procedures: [],
};

const XSX_OPEN: ProcedureStep[] = [
  { id: "back", title: "Remove the back panel", detail: "Peel the stickers just enough to reach both screws, then unclip the panel at the gaps near the base and lift it off.", view: "rear", screws: ["back"] },
  { id: "fan", title: "Remove the fan", detail: "Disconnect the fan cable by its connector, then slide the fan out.", view: "interior", screws: ["fan-105", "fan-88"] },
];

const XSX_TO_BOARD: ProcedureStep[] = [
  ...XSX_OPEN,
  { id: "odd", title: "Remove the optical drive", detail: "Unlock and rotate the base, remove the isolator, disconnect power and data by their connectors. The drive is paired to the board.", view: "interior", screws: ["odd"] },
  { id: "chassis-cables", title: "Slide the internals out of the shell", detail: "Flip the metal lock on the USB ribbon and pull its tab; press the tab on the power button connector before pulling. Both are fragile. Then slide the center chassis toward the fan grille and lift it out without pinching the ribbons.", view: "interior", screws: ["chassis"] },
  { id: "power-port", title: "Remove the power port", detail: "Lift the power connector out and de-route its cable.", view: "interior", screws: ["port-13", "port-35"] },
  { id: "antenna", title: "Remove the corner cover and antenna board", detail: "Pull the antenna board straight off its connector.", view: "interior", screws: ["corner", "antenna"] },
  { id: "shield", title: "Remove the board shield", view: "shield", screws: ["shield-88", "shield-35", "shield-13"] },
  { id: "psu", title: "Release the chassis strap and PSU screws", detail: "Unlatch the strap from both sides of the PSU. Remove the three silver screws only.", view: "shield", screws: ["psu-35"] },
  { id: "connectors", title: "Disconnect the 10-pin power and interconnect cables", detail: "Squeeze the 10-pin lock and lift straight up. Pull connectors, not wires.", view: "board" },
  { id: "lift-chassis", title: "Lift the center chassis off the boards", detail: "Lift by the chassis edges, not the PSU, and route the interconnect cable through its cutout.", view: "board" },
];

XSX.procedures = [
  {
    id: "no-power",
    title: "No power / no video diagnosis",
    summary: "Open to the motherboard, then work through the power checks.",
    steps: [
      ...XSX_TO_BOARD,
      { id: "inspect", title: "Visual inspection", detail: "Liquid damage, burnt parts, the HDMI port and the area around the HDMI redriver.", view: "board", onFail: INSPECT_FAIL },
      {
        id: "12v",
        title: "Confirm 12 V from the power supply",
        detail: "Measure at the motherboard power connector. Do not open the PSU: it carries mains voltage.",
        view: "board",
        onFail: [
          { title: "Check the power cord and outlet", detail: "Try a known-good cord and outlet first." },
          { title: "Reseat the 10-pin power connector", detail: "Squeeze the lock, lift straight up, check the pins, then press it fully home." },
          { title: "Check the 12 V input for a short to ground", detail: "A board-side short can stop the supply from starting." },
          { title: "Test with a known-good power supply", detail: "Swap the PSU rather than opening it." },
        ],
      },
      { id: "shorts", title: "Check the 12 V input for a short to ground", view: "board", onFail: SHORT_FAIL },
      {
        id: "rails",
        title: "Check the regulator outputs around the SoC",
        view: "board",
        onFail: [
          { title: "Check the regulator's input and enable", detail: "If its input is present but the output is missing, suspect the regulator itself." },
          { title: "Check the missing rail for a short to ground", detail: "Measure with power off before replacing the regulator." },
          { title: "Compare against a known-good board", detail: "Save trusted values in the Reference tab so they are checked automatically." },
        ],
      },
    ],
  },
  {
    id: "fan-clean",
    title: "Fan cleaning or replacement",
    summary: "Only the back panel and fan come off.",
    steps: [
      ...XSX_OPEN,
      {
        id: "clean",
        title: "Clean the fan and vents",
        view: "interior",
        onFail: [
          { title: "Spin the fan by hand", detail: "Rough or noisy bearings mean the fan should be replaced." },
          { title: "Check the fan cable and connector", detail: "Look for pinched wires or a bent connector pin." },
        ],
      },
    ],
  },
  {
    id: "optical",
    title: "Optical drive service",
    summary: "Back panel, fan and the drive. The drive is paired to the motherboard.",
    steps: XSX_TO_BOARD.slice(0, 3),
  },
  {
    id: "ssd",
    title: "Internal SSD access",
    summary: "The SSD sits under the center chassis, so most of the console comes apart.",
    steps: [
      ...XSX_TO_BOARD,
      { id: "ssd", title: "Remove the SSD", detail: "Pry the SSD shield off keeping its thermal pads intact, then remove the screw; the drive pops up at an angle.", view: "board", screws: ["ssd"] },
    ],
  },
];

const OPEN_FAIL: StepSuggestion[] = [
  { title: "Apply more heat and work slowly", detail: "Re-warm the adhesive and use more opening picks instead of more force; slide picks rather than prying." },
  { title: "Check for a hidden screw or clip", detail: "Look under labels, rubber feet and stickers before forcing a panel." },
  { title: "Check flex cables before lifting further", detail: "Some panels have a cable attached; open only far enough to disconnect it." },
];

const PORT_FAIL: StepSuggestion[] = [
  { title: "Clean the port", detail: "Remove lint with a non-conductive pick, then isopropyl alcohol; inspect pins under magnification." },
  { title: "Try a known-good cable and charger", detail: "Rules out the accessory before replacing the port." },
  { title: "Measure VBUS at the port", detail: "No VBUS with a good charger points to the port or its flex; VBUS present but no charging points to the charging circuit." },
];

function mobileProcedures(battery: boolean): Procedure[] {
  return [
    {
      id: "no-power",
      title: "No power / no boot diagnosis",
      summary: "Generic checks from the charger inwards.",
      steps: [
        { id: "inspect", title: "Visual inspection", detail: "Liquid indicators, corrosion, a swollen battery, bent frame or cracked board.", onFail: INSPECT_FAIL },
        { id: "port", title: "Check the charging port and cable", detail: "Lint, bent pins; try a known-good cable and charger.", onFail: PORT_FAIL },
        {
          id: "usb-meter",
          title: "Measure charging current with a USB meter",
          detail: "No current at all points to the port, its flex or the charging circuit. A fixed draw with no boot can mean a short or a boot fault.",
          onFail: [
            { title: "Check VBUS at the port", detail: "Confirms whether power reaches the board." },
            { title: "Check the main battery rail for a short to ground", detail: "Battery disconnected, diode or resistance mode." },
          ],
        },
        ...(battery
          ? [
              {
                id: "battery-v",
                title: "Check the battery voltage",
                detail: "Measure at the battery connector. A deeply discharged, swollen or damaged battery should be replaced, not charged.",
                onFail: [
                  { title: "Try a known-good battery", detail: "Rules out the cell and its protection circuit." },
                  { title: "Boot from a bench power supply", detail: "Feed battery voltage through the battery connector with current limiting and watch the draw while pressing power." },
                ],
              },
            ]
          : []),
        { id: "shorts", title: "Check the main battery rail for a short to ground", detail: "Battery disconnected.", onFail: SHORT_FAIL },
        { id: "dc-boot", title: "Boot from a current-limited bench supply", detail: "Watch the current draw pattern when pressing power; compare against a known-good unit." },
      ],
    },
    {
      id: "battery",
      title: "Battery replacement",
      summary: "Open, disconnect, swap and test the battery.",
      steps: [
        { id: "open", title: "Open the device", detail: "Heat to soften adhesive or remove the case screws, depending on the model.", onFail: OPEN_FAIL },
        { id: "disconnect", title: "Disconnect the battery", detail: "Before touching any other connector." },
        { id: "remove-battery", title: "Remove the old battery", detail: "Use the adhesive pull tabs or isopropyl alcohol under the cell. Never bend or puncture a Li-ion cell." },
        { id: "fit-battery", title: "Fit the new battery and test", detail: "Reconnect, check it charges and reports a sensible voltage before closing up." },
      ],
    },
    {
      id: "charging",
      title: "Charging port fault",
      summary: "Not charging, loose cable, intermittent charging.",
      steps: [
        { id: "port-clean", title: "Inspect and clean the port", onFail: PORT_FAIL },
        { id: "port-test", title: "Test with a known-good cable and charger" },
        { id: "port-vbus", title: "Measure VBUS and charge current", detail: "USB meter between charger and device." },
        { id: "port-replace", title: "Replace the port or charging flex", detail: "If the port is soldered to the main board, this is a micro-soldering job." },
      ],
    },
  ];
}

function laptopProcedures(): Procedure[] {
  return [
    {
      id: "no-power",
      title: "No power diagnosis",
      summary: "Generic checks from the adapter inwards.",
      steps: [
        { id: "inspect", title: "Visual inspection", detail: "Liquid damage, burnt parts, a swollen battery, damaged DC jack or USB-C port.", onFail: INSPECT_FAIL },
        {
          id: "adapter",
          title: "Check the adapter output",
          detail: "Measure the adapter, or use a USB-C PD meter to confirm it negotiates 20 V.",
          onFail: [
            { title: "Try a known-good adapter", detail: "Match the voltage and wattage of the original." },
            { title: "Check the cable and plug", detail: "Wiggle-test for intermittent output." },
          ],
        },
        { id: "input", title: "Check power at the DC jack or USB-C port", onFail: PORT_FAIL },
        { id: "battery", title: "Disconnect the battery and try adapter only", detail: "A failed battery can stop some laptops from starting." },
        { id: "shorts", title: "Check the main power rail for a short to ground", detail: "Adapter and battery disconnected.", onFail: SHORT_FAIL },
        { id: "reset", title: "Drain residual power and reset the embedded controller", detail: "Disconnect battery and coin cell, hold power for 30 seconds, reconnect." },
      ],
    },
    {
      id: "no-display",
      title: "No display",
      summary: "Powers on but no picture.",
      steps: [
        { id: "external", title: "Test with an external monitor", detail: "Picture on the external screen points to the panel, its cable or the backlight." },
        { id: "backlight", title: "Torch test for a backlight fault", detail: "Shine a light at the screen; a faint image means the backlight or its fuse." },
        { id: "cable", title: "Reseat the display cable", detail: "Check for pinched or damaged sections at the hinge." },
        { id: "ram", title: "Reseat or test the RAM", detail: "Many laptops show nothing on screen with a RAM fault." },
      ],
    },
    {
      id: "battery",
      title: "Battery replacement",
      summary: "Bottom case off, battery out.",
      steps: [
        { id: "open", title: "Remove the bottom case", onFail: OPEN_FAIL },
        { id: "disconnect", title: "Disconnect the battery", detail: "Before touching any other connector." },
        { id: "swap", title: "Swap the battery", detail: "Glued batteries: use isopropyl alcohol and slow, even pressure. Never puncture a cell." },
        { id: "test", title: "Test charging before closing" },
      ],
    },
  ];
}

function consoleProcedures(): Procedure[] {
  return [
    {
      id: "no-power",
      title: "No power / no video diagnosis",
      summary: "Generic console checks; add photos to map the teardown.",
      steps: [
        { id: "inspect", title: "Visual inspection", detail: "Liquid, burnt parts, the HDMI port and the area around it.", onFail: INSPECT_FAIL },
        {
          id: "12v",
          title: "Confirm 12 V from the power supply",
          detail: "Measure where the PSU feeds the board. Do not open the PSU: it carries mains voltage.",
          onFail: [
            { title: "Check the 12 V rail for a short to ground", detail: "A board-side short can stop the supply from starting." },
            { title: "Test with a known-good power supply", detail: "Swap the PSU rather than opening it." },
          ],
        },
        { id: "shorts", title: "Check the 12 V rail for a short to ground", onFail: SHORT_FAIL },
        { id: "hdmi", title: "Check the HDMI port", detail: "Bent or missing pins, and +5 V on pin 18 when the console is on." },
        { id: "rails", title: "Check the regulator outputs around the main chip" },
      ],
    },
    {
      id: "fan-clean",
      title: "Cleaning and overheating",
      summary: "Open, clean the fan and heatsink, renew thermal paste if needed.",
      steps: [
        { id: "open", title: "Open the console", onFail: OPEN_FAIL },
        { id: "clean", title: "Clean the fan and heatsink", detail: "Blow dust out in the direction of airflow; hold the fan still while doing so." },
        { id: "paste", title: "Renew thermal paste if temperatures stay high", detail: "Some models use liquid metal: clean and re-apply it with care, it is conductive." },
        { id: "test", title: "Reassemble and test under load" },
      ],
    },
  ];
}

function switchProcedures(): Procedure[] {
  const [noPower, battery, charging] = mobileProcedures(true);
  return [
    noPower,
    {
      id: "no-dock-video",
      title: "No video on the TV (dock)",
      summary: "Handheld works but the dock gives no picture.",
      steps: [
        { id: "dock-power", title: "Use the original dock power adapter", detail: "Many third-party chargers can't power the dock's video output." },
        { id: "dock-hdmi", title: "Test the dock with another HDMI cable and TV" },
        { id: "usb-c", title: "Inspect the console's USB-C port", detail: "Bent pins or debris also cause charging faults.", onFail: PORT_FAIL },
        { id: "dock-test", title: "Test the console in a known-good dock", detail: "Separates a dock fault from a console fault." },
      ],
    },
    battery,
    charging,
  ];
}

function starter(id: string, name: string, group: DeviceGroup, ifixit: string, procedures: Procedure[], revisions: string[] = []): DeviceProfile {
  return { id, name, group, ifixit, starter: true, revisions, sources: [], views: {}, screws: {}, procedures };
}

const STARTERS: DeviceProfile[] = [
  starter("ps4", "PlayStation 4", "Consoles", "PlayStation 4", consoleProcedures()),
  starter("xbox-series-s", "Xbox Series S", "Consoles", "Xbox Series S", consoleProcedures()),
  starter("xbox-one", "Xbox One", "Consoles", "Xbox One", consoleProcedures()),
  starter("switch", "Nintendo Switch", "Consoles", "Nintendo Switch", switchProcedures(), ["HAC-001", "HAC-001(-01)", "HEG-001", "HDH-001"]),
  starter("switch-2", "Nintendo Switch 2", "Consoles", "Nintendo Switch 2", switchProcedures()),
  starter("iphone", "iPhone", "Phones", "iPhone 15", mobileProcedures(true)),
  starter("pixel", "Google Pixel", "Phones", "Google Pixel 8", mobileProcedures(true)),
  starter("galaxy-s", "Samsung Galaxy S", "Phones", "Samsung Galaxy S24", mobileProcedures(true)),
  starter("ipad", "iPad", "Tablets", "iPad 10", mobileProcedures(true)),
  starter("android-tablet", "Android tablet", "Tablets", "Samsung Galaxy Tab S9", mobileProcedures(true)),
  starter("macbook", "MacBook", "Laptops", "MacBook Air 13\" M2 2022", laptopProcedures()),
  starter("windows-laptop", "Windows laptop", "Laptops", "Dell XPS 13 9310", laptopProcedures()),
];

export const CUSTOM_ID = "custom";

const CUSTOM: DeviceProfile = {
  id: CUSTOM_ID,
  name: "Other device",
  revisions: [],
  sources: [],
  views: {},
  screws: {},
  procedures: [
    {
      id: "no-power",
      title: "General diagnosis",
      summary: "No device profile yet: generic checks only.",
      steps: [
        { id: "inspect", title: "Visual inspection", onFail: INSPECT_FAIL },
        { id: "input", title: "Confirm input power" },
        { id: "shorts", title: "Check main rails for shorts to ground", onFail: SHORT_FAIL },
        { id: "rails", title: "Measure regulator outputs" },
      ],
    },
  ],
};

export const DEVICES: DeviceProfile[] = [PS5, XSX, ...STARTERS];

export const DEVICE_GROUPS: DeviceGroup[] = ["Consoles", "Phones", "Tablets", "Laptops"];

export function getDevice(id: string): DeviceProfile {
  return DEVICES.find((d) => d.id === id) ?? CUSTOM;
}

export function getProcedure(device: DeviceProfile, procedureId: string): Procedure {
  return device.procedures.find((p) => p.id === procedureId) ?? device.procedures[0];
}

export const screwKey = (groupId: string, index: number) => `${groupId}:${index}`;

export function stepDefinition<T extends ProcedureStep>(deviceId: string, procedureId: string, step: T): T {
  if (step.added) return step;
  const def = getProcedure(getDevice(deviceId), procedureId).steps.find((s) => s.id === step.id);
  return def ? { ...step, ...def } : step;
}

export function failSuggestions(step: ProcedureStep): StepSuggestion[] {
  if (step.onFail?.length) return step.onFail;
  if (step.screws?.length) return TEARDOWN_FAIL;
  return [];
}
