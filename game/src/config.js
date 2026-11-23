// Solmar Bay — every tuning number and colour in one place.
// The world is a fixed 3200x2400 city; the camera follows the player and the
// renderer scales the 1280x720 view to the window, so no rule here depends
// on the screen size.

export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };

// Roads sit on a 400px grid; each road is 120px wide with two lanes.
export const ROAD = { spacing: 400, width: 120, lane: 30 };
// South of this line the city gives way to sand and then the sea.
export const BEACH_Y = 2080;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 260,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.35,
  shootCooldown: 0.22,
  bulletSpeed: 640,
  ammoMax: 24,
};

export const CAR = {
  // Player car: acceleration, braking and top speed in px/s.
  accel: 420,
  brake: 620,
  reverse: 190,
  maxSpeed: 560,
  turn: 2.9,
  radius: 17,
  // Traffic cars cruise slower than the player can drive.
  cruise: 150,
  cruiseJitter: 45,
};

export const POLICE = {
  // How many patrol cars the city fields at each wanted level.
  carsPerStar: [0, 1, 2, 3, 4, 5],
  chaseSpeed: 520,
  ramDamage: 5,
  ramCooldown: 1.2,
  // Seconds a cop must stay touching the player to make the bust.
  bustTime: 1.4,
  shootFromStar: 3,
  shootCooldown: 1.1,
};

export const WANTED = {
  steal: 26,
  hitPed: 14,
  shoot: 9,
  killCop: 30,
  killPed: 22,
  // Heat (0..100) decays when no cop can see the player.
  decay: 2.2,
  decayDelay: 4,
};

export const PICKUP = { cashValue: 25, ammoValue: 12, healthValue: 30 };

export const MISSIONS = [
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    giver: 'Mara Quinn',
    reward: 150,
    brief: 'Mara needs wheels. Steal the Comet GT parked by the marina and bring it to the paint shop.',
    steps: [
      { text: 'Steal the Comet GT at the marina', kind: 'car', target: { x: 2960, y: 1900 } },
      { text: 'Drive the Comet GT to the paint shop', kind: 'drive', target: { x: 620, y: 620 } },
    ],
  },
  {
    id: 'the-parcel',
    name: 'The Parcel',
    giver: 'Mara Quinn',
    reward: 300,
    brief: 'A parcel is waiting at the east pier. Pick it up and drop it at the hotel — and keep your head down.',
    steps: [
      { text: 'Pick up the parcel at the east pier', kind: 'goto', target: { x: 2980, y: 1020 } },
      { text: 'Deliver the parcel to the Grand Hotel', kind: 'goto', target: { x: 1020, y: 220 } },
    ],
  },
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    giver: 'Mara Quinn',
    reward: 500,
    brief: 'The cops are onto you. Lose the 3-star heat and reach the safehouse on the north side.',
    steps: [
      { text: 'Survive the heat — lose the cops', kind: 'survive', target: null },
      { text: 'Reach the safehouse', kind: 'goto', target: { x: 220, y: 220 } },
    ],
  },
];

export const PALETTE = {
  sky: '#0e1a24',
  road: '#2b2f36',
  roadLine: '#c9a227',
  sidewalk: '#3d434e',
  grass: '#2e6b3a',
  sand: '#d9b380',
  sea: '#1b6f8f',
  building: ['#b5543f', '#4f7fa8', '#c08a3e', '#7a5a94', '#5a8a6a', '#a85a6e', '#6e7f8a'],
  buildingRoof: '#232830',
  window: '#ffd97a',
  player: '#ffb703',
  playerCar: '#e63946',
  traffic: ['#8ecae6', '#adb5bd', '#f4a261', '#90be6d', '#f9c74f'],
  police: '#1d3557',
  policeLight: '#ff2e2e',
  policeLight2: '#2e7bff',
  ped: ['#f1fa8c', '#ff8fa3', '#a3e635', '#f0abfc', '#93c5fd'],
  text: '#f4f1ea',
  muted: '#9aa5b1',
  hudPanel: 'rgba(10, 16, 24, 0.72)',
  star: '#ffd60a',
  health: '#43aa5b',
  healthLow: '#e63946',
  marker: '#ffea00',
  danger: '#ff3b30',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';
