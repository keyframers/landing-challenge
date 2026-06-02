import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import type { Actor } from "xstate";
import type { gameMachine } from "../machines/gameMachine";
import { missions } from "../data/missions";
import TitleScreen from "./ui/TitleScreen";
import HUD from "./ui/HUD";
import InfoPanel from "./ui/InfoPanel";
import CrashOverlay from "./ui/CrashOverlay";
import PauseOverlay from "./ui/PauseOverlay";
import InfoDialog from "./ui/InfoDialog";
import LoadingScreen from "./ui/LoadingScreen";
import { tuning } from "../game/tuning";
import Button from "./ui/Button";
import type { InputManager, InputState } from "../game/input";

interface GameOverlayProps {
  actor: Actor<typeof gameMachine>;
  input: InputManager;
  loadingProgress: number;
}

function useActorState(actor: Actor<typeof gameMachine>) {
  return useSyncExternalStore(
    (cb) => {
      const sub = actor.subscribe(cb);
      return () => sub.unsubscribe();
    },
    () => actor.getSnapshot()
  );
}

export default function GameOverlay({ actor, input, loadingProgress }: GameOverlayProps) {
  const state = useActorState(actor);
  const ctx = state.context;
  const touchXRef = useRef<number | null>(null);
  const touchYRef = useRef<number | null>(null);
  const [showControls, setShowControls] = useState(false);

  const currentMission = missions[ctx.currentMission];
  const speed = Math.sqrt(ctx.velocity.x ** 2 + ctx.velocity.y ** 2);
  const angleDeg = Math.abs((ctx.angle * 180) / Math.PI) % 360;
  const landingAngleDeg = Math.min(angleDeg, 360 - angleDeg);

  useEffect(() => {
    const explore = () => actor.send({ type: "EXPLORE_MISSIONS" });

    window.addEventListener("scroll", explore);
    return () => window.removeEventListener("scroll", explore);
  }, [actor]);

  function getStatusText(): string {
    if (state.matches("loading")) return "Loading";
    if (state.matches("title")) return "Ready";
    if (state.matches({ playing: "descending" })) {
      if (ctx.fuel <= 0) return "No Fuel";
      if (speed > tuning.maxLandingSpeed) return "High Speed";
      if (landingAngleDeg > (tuning.maxLandingAngle * 180) / Math.PI) {
        return "Bad Angle";
      }
      return "Nominal";
    }
    if (state.matches({ playing: "landed" })) return "Landed";
    if (state.matches({ playing: "simulatingLanding" })) return "Simulating";
    if (state.matches({ playing: "rover" })) return "Rover Active";
    if (state.matches({ playing: "crashed" })) return "Crashed";
    if (state.matches({ playing: "missed" })) return "Off Target";
    if (state.matches({ playing: "paused" })) return "Paused";
    if (state.matches("manual")) return "Browse Mode";
    return "";
  }

  function sendBrowseDelta(delta: number) {
    actor.send({
      type: "SCROLL",
      position: Math.max(0, Math.min(1, ctx.browsePosition + delta / 2400)),
    });
  }

  if (state.matches("loading")) {
    return <LoadingScreen progress={loadingProgress} />;
  }

  return (
    <div>
      {state.matches("title") && (
        <TitleScreen
          onLaunch={() => actor.send({ type: "LAUNCH" })}
          onExploreMissions={() => actor.send({ type: "EXPLORE_MISSIONS" })}
        />
      )}

      {(state.matches("info") || showControls) && (
        <InfoDialog
          onClose={() => {
            if (showControls) {
              setShowControls(false);
            } else {
              actor.send({ type: "CLOSE" });
            }
          }}
        />
      )}

      {typeof state.value === "object" && "playing" in state.value && (
        <>
          <HUD
            fuel={ctx.fuel}
            speed={speed}
            altitude={ctx.altitude}
            angle={ctx.angle}
            thrustLevel={ctx.thrustLevel}
            status={getStatusText()}
            missionNumber={ctx.currentMission + 1}
            totalMissions={missions.length}
            onInfo={() => actor.send({ type: "INFO" })}
            onPause={() => actor.send({ type: "PAUSE" })}
            onMissionSelect={(missionIndex) =>
              actor.send({ type: "JUMP_TO_MISSION", missionIndex })
            }
          />

          {state.matches({ playing: "landed" }) && currentMission && (
            <InfoPanel
              mission={currentMission}
              onContinue={() => actor.send({ type: "CONTINUE" })}
              onExploreMissions={() => actor.send({ type: "EXPLORE_MISSIONS" })}
              onDriveRover={() => actor.send({ type: "DRIVE_ROVER" })}
              showRoverButton={currentMission.roverAvailable || ctx.roverUnlocked}
            />
          )}

          {state.matches({ playing: "crashed" }) && (
            <CrashOverlay
              type="crashed"
              onRetry={() => actor.send({ type: "RETRY" })}
              onSimulate={() => actor.send({ type: "SIMULATE" })}
              onExplore={() => actor.send({ type: "EXPLORE_MISSIONS" })}
              onControls={() => setShowControls(true)}
            />
          )}

          {state.matches({ playing: "missed" }) && (
            <CrashOverlay
              type="missed"
              onRetry={() => actor.send({ type: "RETRY" })}
              onSimulate={() => actor.send({ type: "SIMULATE" })}
              onExplore={() => actor.send({ type: "EXPLORE_MISSIONS" })}
              onControls={() => setShowControls(true)}
            />
          )}

          {state.matches({ playing: "paused" }) && (
            <PauseOverlay
              onResume={() => actor.send({ type: "RESUME" })}
              onRestart={() => actor.send({ type: "RESTART_MISSION" })}
              onSimulate={() => actor.send({ type: "SIMULATE" })}
              onExploreMissions={() => actor.send({ type: "EXPLORE_MISSIONS" })}
              onControls={() => setShowControls(true)}
            />
          )}

          {state.matches({ playing: "rover" }) && (
            <div
              style={{
                position: "absolute",
                bottom: "2rem",
                right: "2rem",
                pointerEvents: "auto",
              }}
            >
              <Button
                onClick={() => actor.send({ type: "RETURN_TO_LANDER" })}
                style={{
                  padding: "0.6rem 1.5rem",
                  fontSize: "0.75rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  background: "rgba(10,10,20,0.8)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#f4f4f5",
                  cursor: "pointer",
                  borderRadius: "2px",
                }}
              >
                Return to Lander
              </Button>
            </div>
          )}

          {state.matches({ playing: "descending" }) && <MobileJoystick input={input} />}
        </>
      )}

      {state.matches("manual") && (
        <div
          onWheel={(event) => {
            event.preventDefault();
            sendBrowseDelta(event.deltaY + event.deltaX);
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchXRef.current = touch?.clientX ?? null;
            touchYRef.current = touch?.clientY ?? null;
          }}
          onTouchMove={(event) => {
            event.preventDefault();
            const touch = event.touches[0];
            if (touch == null || touchXRef.current == null || touchYRef.current == null) {
              return;
            }
            const dx = touchXRef.current - touch.clientX;
            const dy = touchYRef.current - touch.clientY;
            touchXRef.current = touch.clientX;
            touchYRef.current = touch.clientY;
            sendBrowseDelta(dx + dy);
          }}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
            touchAction: "none",
          }}
        >
          {ctx.manualMissionInView && currentMission && (
            <InfoPanel
              key={currentMission.id}
              mission={currentMission}
              onContinue={() => actor.send({ type: "CONTROLS_PRESSED" })}
              showRoverButton={false}
            />
          )}
          <Button
            onClick={() => actor.send({ type: "EXIT_MANUAL" })}
            style={{
              position: "absolute",
              right: "2rem",
              bottom: "2rem",
              padding: "0.5rem 1.5rem",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#aaa",
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            Back to Title
          </Button>
        </div>
      )}
    </div>
  );
}

function MobileJoystick({ input }: { input: InputManager }) {
  const [isMobile, setIsMobile] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const radius = 58;

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (max-width: 768px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      input.setAnalog({ left: 0, right: 0, up: 0 });
    };
  }, [input]);

  function setFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = event.clientX - rect.left - rect.width / 2;
    const rawY = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const normalizedX = Math.abs(x / radius) < 0.12 ? 0 : x / radius;
    const normalizedY = Math.abs(y / radius) < 0.12 ? 0 : y / radius;
    const next: InputState = {
      left: Math.max(0, -normalizedX),
      right: Math.max(0, normalizedX),
      up: Math.max(0, -normalizedY),
    };
    setKnob({ x, y });
    input.setAnalog(next);
  }

  function reset() {
    activePointerRef.current = null;
    setKnob({ x: 0, y: 0 });
    input.setAnalog({ left: 0, right: 0, up: 0 });
  }

  if (!isMobile) return null;

  return (
    <div
      ref={rootRef}
      aria-label="Lander joystick"
      onPointerDown={(event) => {
        activePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (activePointerRef.current === event.pointerId) setFromPointer(event);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      style={{
        position: "absolute",
        left: "50%",
        bottom: "max(1.25rem, env(safe-area-inset-bottom))",
        width: "9rem",
        height: "9rem",
        marginLeft: "-4.5rem",
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.3)",
        background: "rgba(10,10,20,0.34)",
        boxShadow: "inset 0 0 24px rgba(255,255,255,0.08)",
        pointerEvents: "auto",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "3.25rem",
          height: "3.25rem",
          marginLeft: "-1.625rem",
          marginTop: "-1.625rem",
          borderRadius: "50%",
          background: "rgba(244,244,245,0.72)",
          border: "1px solid rgba(255,255,255,0.9)",
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
        }}
      />
    </div>
  );
}
