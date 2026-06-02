import { useEffect, useRef, useState } from 'react';
import { Leva, useControls } from 'leva';
import { createGame, type Game } from '../game/engine';
import { tuning } from '../game/tuning';
import { GameOverlay } from './GameOverlay';
import { LoadingScreen } from './ui/LoadingScreen';

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const values = useControls('Physics', {
    gravity: { value: tuning.gravity, min: 0, max: 8, step: 0.01 },
    mainEngineForce: { value: tuning.mainEngineForce, min: 0, max: 300, step: 1 },
    sideEngineTorque: { value: tuning.sideEngineTorque, min: 0, max: 250, step: 1 },
    fuelBurnMain: { value: tuning.fuelBurnMain, min: 0, max: 10, step: 0.1 },
    fuelBurnSide: { value: tuning.fuelBurnSide, min: 0, max: 10, step: 0.1 },
    startAltitude: { value: tuning.startAltitude, min: 20, max: 400, step: 1 },
    maxLandingSpeed: { value: tuning.maxLandingSpeed, min: 0.5, max: 10, step: 0.1 },
    maxLandingAngle: { value: tuning.maxLandingAngle, min: 0, max: Math.PI / 2, step: 0.01 },
    roverAccel: { value: tuning.roverAccel, min: 0, max: 800, step: 10 },
    roverMaxSpeed: { value: tuning.roverMaxSpeed, min: 1, max: 70, step: 1 },
    roverAirTorque: { value: tuning.roverAirTorque, min: 0, max: 400, step: 1 },
    roverDownforce: { value: tuning.roverDownforce, min: 0, max: 400, step: 5 },
    roverBoostForce: { value: tuning.roverBoostForce, min: 0, max: 1200, step: 10 },
    roverWheelSpinSpeed: { value: tuning.roverWheelSpinSpeed, min: 0, max: 50, step: 1 },
    roverSuspensionLength: { value: tuning.roverSuspensionLength, min: 0.3, max: 3, step: 0.1 },
    roverSuspensionSpring: { value: tuning.roverSuspensionSpring, min: 100, max: 3000, step: 50 },
    roverSuspensionDamping: { value: tuning.roverSuspensionDamping, min: 0, max: 400, step: 10 },
    roverSuspensionMaxForce: { value: tuning.roverSuspensionMaxForce, min: 100, max: 3000, step: 50 },
    transitLaunchForce: { value: tuning.transitLaunchForce, min: 100, max: 1600, step: 10 },
    transitEngineBurnSeconds: { value: tuning.transitEngineBurnSeconds, min: 0.1, max: 3, step: 0.1 },
    transitLaunchAngle: { value: tuning.transitLaunchAngle, min: -Math.PI / 4, max: Math.PI / 4, step: 0.01 },
    transitPlayableAltitude: { value: tuning.transitPlayableAltitude, min: 10, max: 120, step: 1 },
    transitMaxHorizontalSpeed: { value: tuning.transitMaxHorizontalSpeed, min: 1, max: 30, step: 0.5 },
    transitHandOffDistance: { value: tuning.transitHandOffDistance, min: 20, max: 400, step: 5 },
    transitHandOffVerticalSpeed: { value: tuning.transitHandOffVerticalSpeed, min: 2, max: 60, step: 1 },
    transitMaxSeconds: { value: tuning.transitMaxSeconds, min: 1, max: 30, step: 0.5 },
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
        <GameOverlay actor={game.actor} loadingProgress={1} />
      ) : (
        <LoadingScreen progress={loadingProgress} />
      )}
      <Leva collapsed />
    </div>
  );
}
