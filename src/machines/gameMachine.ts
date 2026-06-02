import { setup, assign, type AnyActorRef } from 'xstate';
import { missions, type MissionData } from '../data/missions';

export interface GameContext {
  currentMission: number;
  fuel: number;
  completedMissions: number[];
  roverUnlocked: boolean;
  controlMode: 'thrustAndTorque' | 'torqueOnly';
  showOnScreenButtons: boolean;
  velocity: { x: number; y: number };
  altitude: number;
  angle: number;
  thrustLevel: number;
  browsePosition: number;
}

export type GameEvent =
  | { type: 'LOADED' }
  | { type: 'LAUNCH' }
  | { type: 'BROWSE' }
  | { type: 'INFO' }
  | { type: 'CLOSE' }
  | { type: 'LANDED'; missionIndex?: number }
  | { type: 'CRASHED' }
  | { type: 'MISSED' }
  | { type: 'RETRY' }
  | { type: 'SIMULATE' }
  | { type: 'CONTINUE' }
  | { type: 'DRIVE_ROVER' }
  | { type: 'RETURN_TO_LANDER' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'EXPLORE_MISSIONS' }
  | { type: 'SCROLL'; position: number }
  | { type: 'SET_MANUAL_MISSION'; missionIndex: number }
  | { type: 'JUMP_TO_MISSION'; missionIndex: number }
  | { type: 'CONTROLS_PRESSED' }
  | { type: 'EXIT_MANUAL' }
  | { type: 'KONAMI' }
  | {
      type: 'UPDATE_TELEMETRY';
      velocity: { x: number; y: number };
      altitude: number;
      angle: number;
      fuel: number;
      thrustLevel: number;
    };

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    resetFuel: assign({ fuel: (_) => 100 }),
    completeMission: assign({
      completedMissions: ({ context, event }) => {
        const missionIndex =
          event.type === 'LANDED' && event.missionIndex != null
            ? event.missionIndex
            : context.currentMission;
        return context.completedMissions.includes(missionIndex)
          ? context.completedMissions
          : [...context.completedMissions, missionIndex];
      },
      currentMission: ({ context, event }) =>
        event.type === 'LANDED' && event.missionIndex != null
          ? event.missionIndex
          : context.currentMission,
    }),
    advanceMission: assign({
      currentMission: ({ context }) =>
        Math.min(context.currentMission + 1, missions.length - 1),
    }),
    setMission: assign({
      currentMission: ({ event }) => {
        if (event.type !== 'JUMP_TO_MISSION') return 0;
        return event.missionIndex;
      },
    }),
    resetManualBrowse: assign({
      currentMission: 0,
      browsePosition: 0,
    }),
    setBrowsePosition: assign({
      browsePosition: ({ event, context }) => {
        if (event.type !== 'SCROLL') return context.browsePosition;
        return Math.max(0, Math.min(1, event.position));
      },
    }),
    setManualMission: assign({
      currentMission: ({ event, context }) => {
        if (event.type !== 'SET_MANUAL_MISSION') return context.currentMission;
        return event.missionIndex;
      },
    }),
    unlockRover: assign({ roverUnlocked: true }),
    updateTelemetry: assign({
      velocity: ({ event }) => {
        if (event.type !== 'UPDATE_TELEMETRY') return { x: 0, y: 0 };
        return event.velocity;
      },
      altitude: ({ event }) => {
        if (event.type !== 'UPDATE_TELEMETRY') return 0;
        return event.altitude;
      },
      angle: ({ event }) => {
        if (event.type !== 'UPDATE_TELEMETRY') return 0;
        return event.angle;
      },
      fuel: ({ event }) => {
        if (event.type !== 'UPDATE_TELEMETRY') return 100;
        return event.fuel;
      },
      thrustLevel: ({ event }) => {
        if (event.type !== 'UPDATE_TELEMETRY') return 0;
        return event.thrustLevel;
      },
    }),
  },
  guards: {
    canDriveRover: ({ context }) => {
      const mission = missions[context.currentMission];
      return context.roverUnlocked || mission?.roverAvailable === true;
    },
    hasNextMission: ({ context }) =>
      context.currentMission < missions.length - 1,
    isKonamiRoverUnlock: ({ context }) => {
      const mission = missions[context.currentMission];
      return mission?.roverAvailable === true;
    },
  },
}).createMachine({
  id: 'lunarLander',
  initial: 'loading',
  context: {
    currentMission: 0,
    fuel: 100,
    completedMissions: [],
    roverUnlocked: false,
    controlMode: 'thrustAndTorque',
    showOnScreenButtons: false,
    velocity: { x: 0, y: 0 },
    altitude: 0,
    angle: 0,
    thrustLevel: 0,
    browsePosition: 0,
  },
  on: {
    UPDATE_TELEMETRY: { actions: 'updateTelemetry' },
  },
  states: {
    loading: {
      on: { LOADED: 'title' },
    },

    title: {
      on: {
        LAUNCH: 'playing',
        BROWSE: {
          target: 'manual',
          actions: 'resetManualBrowse',
        },
        INFO: 'info',
      },
    },

    info: {
      on: { CLOSE: 'title' },
    },

    playing: {
      initial: 'descending',
      on: {
        PAUSE: '.paused',
        KONAMI: {
          target: '.rover',
          actions: 'unlockRover',
        },
        JUMP_TO_MISSION: {
          target: '.simulatingLanding',
          actions: ['setMission', 'resetFuel'],
        },
      },
      states: {
        descending: {
          entry: 'resetFuel',
          on: {
            LANDED: {
              target: 'landed',
              actions: 'completeMission',
            },
            CRASHED: 'crashed',
            MISSED: 'missed',
          },
        },

        landed: {
          on: {
            CONTINUE: [
              {
                target: 'descending',
                guard: 'hasNextMission',
                actions: 'advanceMission',
              },
              { target: '#lunarLander.title' },
            ],
            DRIVE_ROVER: {
              target: 'rover',
              guard: 'canDriveRover',
            },
            EXPLORE_MISSIONS: {
              target: '#lunarLander.manual',
              actions: 'resetManualBrowse',
            },
          },
        },

        crashed: {
          on: {
            RETRY: 'descending',
            SIMULATE: 'simulatingLanding',
            EXPLORE_MISSIONS: {
              target: '#lunarLander.manual',
              actions: 'resetManualBrowse',
            },
          },
        },

        missed: {
          on: {
            RETRY: 'descending',
            SIMULATE: 'simulatingLanding',
            EXPLORE_MISSIONS: {
              target: '#lunarLander.manual',
              actions: 'resetManualBrowse',
            },
          },
        },

        simulatingLanding: {
          on: {
            LANDED: {
              target: 'landed',
              actions: 'completeMission',
            },
          },
        },

        rover: {
          on: {
            RETURN_TO_LANDER: 'descending',
          },
        },

        paused: {
          on: {
            RESUME: {
              target: '#lunarLander.playing.hist',
            },
            EXPLORE_MISSIONS: {
              target: '#lunarLander.manual',
              actions: 'resetManualBrowse',
            },
            SIMULATE: {
              target: '#lunarLander.playing.simulatingLanding',
            },
          },
        },

        hist: {
          type: 'history',
          history: 'deep',
        },
      },
    },

    manual: {
      on: {
        SCROLL: {
          actions: 'setBrowsePosition',
        },
        SET_MANUAL_MISSION: {
          actions: 'setManualMission',
        },
        CONTROLS_PRESSED: 'playing',
        EXIT_MANUAL: 'title',
      },
    },
  },
});
