import { useEffect, useRef, useState } from 'react';
import { Leva, useControls } from 'leva';
import { createGame, type Game } from '../game/engine';
import { tuning } from '../game/tuning';
import GameOverlay from './GameOverlay';
import LoadingScreen from './ui/LoadingScreen';

// Show the leva debug panel in dev, or when explicitly enabled via
// PUBLIC_SHOW_LEVA=true. Hidden by default in production builds (e.g. on deploy).
const showLeva =
  import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_LEVA === 'true';

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const values = useControls('Physics', {
    gravity: { value: tuning.gravity, min: 0, max: 8, step: 0.01 },
    mainEngineForce: {
      value: tuning.mainEngineForce,
      min: 0,
      max: 100000,
      step: 100,
    },
    sideEngineTorque: {
      value: tuning.sideEngineTorque,
      min: 0,
      max: 100000,
      step: 100,
    },
    fuelBurnMain: { value: tuning.fuelBurnMain, min: 0, max: 50, step: 0.5 },
    fuelBurnSide: { value: tuning.fuelBurnSide, min: 0, max: 20, step: 0.25 },
    startAltitude: { value: tuning.startAltitude, min: 20, max: 400, step: 1 },
    maxLandingSpeed: {
      value: tuning.maxLandingSpeed,
      min: 0.5,
      max: 10,
      step: 0.1,
    },
    maxLandingAngle: {
      value: tuning.maxLandingAngle,
      min: 0,
      max: Math.PI / 2,
      step: 0.01,
    },
    roverAccel: { value: tuning.roverAccel, min: 0, max: 5000, step: 50 },
    roverMaxSpeed: { value: tuning.roverMaxSpeed, min: 1, max: 70, step: 1 },
    roverGrip: { value: tuning.roverGrip, min: 0, max: 40, step: 0.5 },
    roverAirTorque: { value: tuning.roverAirTorque, min: 0, max: 3000, step: 10 },
    roverDownforce: { value: tuning.roverDownforce, min: 0, max: 3000, step: 10 },
    roverBoostForce: {
      value: tuning.roverBoostForce,
      min: 0,
      max: 25000,
      step: 100,
    },
    roverBoostFuelBurn: {
      value: tuning.roverBoostFuelBurn,
      min: 0,
      max: 20,
      step: 0.25,
    },
    roverWheelSpinSpeed: {
      value: tuning.roverWheelSpinSpeed,
      min: 0,
      max: 50,
      step: 1,
    },
    roverSuspensionLength: {
      value: tuning.roverSuspensionLength,
      min: 0.3,
      max: 3,
      step: 0.1,
    },
    roverSuspensionSpring: {
      value: tuning.roverSuspensionSpring,
      min: 200,
      max: 8000,
      step: 50,
    },
    roverSuspensionDamping: {
      value: tuning.roverSuspensionDamping,
      min: 0,
      max: 3000,
      step: 10,
    },
    roverSuspensionMaxForce: {
      value: tuning.roverSuspensionMaxForce,
      min: 200,
      max: 8000,
      step: 50,
    },
    starterLaunchForce: {
      value: tuning.starterLaunchForce,
      min: 1000,
      max: 160000,
      step: 1000,
    },
    starterEngineBurnSeconds: {
      value: tuning.starterEngineBurnSeconds,
      min: 0.1,
      max: 4,
      step: 0.05,
    },
    starterLaunchAngle: {
      value: tuning.starterLaunchAngle,
      min: -Math.PI / 4,
      max: Math.PI / 4,
      step: 0.01,
    },
    foregroundJaggedness: {
      value: tuning.foregroundJaggedness,
      min: 0,
      max: 3,
      step: 0.05,
    },
    wireframe: { value: tuning.wireframe },
    showDebugBounds: { value: tuning.showDebugBounds },
  });

  Object.assign(tuning, values);

  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return;

    let destroyed = false;

    createGame(canvasRef.current, (pct) => {
      if (!destroyed) setLoadingProgress(pct);
    }).then((g) => {
      if (destroyed) {
        g.destroy();
        return;
      }
      gameRef.current = g;
      (window as any).__actor = g.actor;
      (window as any).__game = g;
      setGame(g);

      setTimeout(() => {
        g.actor.send({ type: 'LOADED' });
      }, 500);
    });

    return () => {
      destroyed = true;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#0a0a14',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
      {game ? (
        <GameOverlay actor={game.actor} input={game.input} loadingProgress={1} />
      ) : (
        <LoadingScreen progress={loadingProgress} />
      )}
      <Leva collapsed hidden={!showLeva} />
    </div>
  );
}
