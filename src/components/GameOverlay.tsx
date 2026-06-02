import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Actor } from "xstate";
import type { gameMachine } from "../machines/gameMachine";
import { missions } from "../data/missions";
import { TitleScreen } from "./ui/TitleScreen";
import { HUD } from "./ui/HUD";
import { InfoPanel } from "./ui/InfoPanel";
import { CrashOverlay } from "./ui/CrashOverlay";
import { PauseOverlay } from "./ui/PauseOverlay";
import { InfoDialog } from "./ui/InfoDialog";
import { LoadingScreen } from "./ui/LoadingScreen";

interface GameOverlayProps {
  actor: Actor<typeof gameMachine>;
  loadingProgress: number;
}

function useActorState(actor: Actor<typeof gameMachine>) {
  return useSyncExternalStore(
    (cb) => {
      const sub = actor.subscribe(cb);
      return () => sub.unsubscribe();
    },
    () => actor.getSnapshot(),
  );
}

export function GameOverlay({ actor, loadingProgress }: GameOverlayProps) {
  const state = useActorState(actor);
  const ctx = state.context;
  const touchXRef = useRef<number | null>(null);
  const touchYRef = useRef<number | null>(null);

  const currentMission = missions[ctx.currentMission];
  const speed = Math.sqrt(ctx.velocity.x ** 2 + ctx.velocity.y ** 2);

  function getStatusText(): string {
    if (state.matches("loading")) return "Loading";
    if (state.matches("title")) return "Ready";
    if (state.matches({ playing: "descending" })) {
      if (ctx.fuel <= 0) return "No Fuel";
      if (speed > 1.5) return "Too Fast";
      return "Descending";
    }
    if (state.matches({ playing: "landed" })) return "Landed";
    if (state.matches({ playing: "simulatingLanding" })) return "Simulating";
    if (state.matches({ playing: "transit" })) return "In Transit";
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
          onBrowse={() => actor.send({ type: "BROWSE" })}
          onInfo={() => actor.send({ type: "INFO" })}
        />
      )}

      {state.matches("info") && (
        <InfoDialog onClose={() => actor.send({ type: "CLOSE" })} />
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
            onPause={() => actor.send({ type: "PAUSE" })}
            onMissionSelect={(missionIndex) =>
              actor.send({ type: "JUMP_TO_MISSION", missionIndex })
            }
          />

          {state.matches({ playing: "landed" }) && currentMission && (
            <InfoPanel
              mission={currentMission}
              onContinue={() => actor.send({ type: "CONTINUE" })}
              onDriveRover={() => actor.send({ type: "DRIVE_ROVER" })}
              showRoverButton={
                currentMission.roverAvailable || ctx.roverUnlocked
              }
            />
          )}

          {state.matches({ playing: "crashed" }) && (
            <CrashOverlay
              type="crashed"
              onRetry={() => actor.send({ type: "RETRY" })}
              onSimulate={() => actor.send({ type: "SIMULATE" })}
            />
          )}

          {state.matches({ playing: "missed" }) && (
            <CrashOverlay
              type="missed"
              onRetry={() => actor.send({ type: "RETRY" })}
              onSimulate={() => actor.send({ type: "SIMULATE" })}
            />
          )}

          {state.matches({ playing: "paused" }) && (
            <PauseOverlay
              onResume={() => actor.send({ type: "RESUME" })}
              onExploreMissions={() =>
                actor.send({ type: "EXPLORE_MISSIONS" })
              }
            />
          )}

          {state.matches({ playing: "transit" }) && (
            <div
              style={{
                position: "absolute",
                bottom: "6rem",
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.2em",
                  color: "#888",
                  textTransform: "uppercase",
                }}
              >
                In Transit
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 200,
                  color: "#f4f4f5",
                  marginTop: "0.3rem",
                }}
              >
                {missions[ctx.currentMission]?.name ?? "Next Mission"}
              </div>
            </div>
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
              <button
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
              </button>
            </div>
          )}
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
            if (
              touch == null ||
              touchXRef.current == null ||
              touchYRef.current == null
            ) {
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
          {currentMission && (
            <InfoPanel
              key={currentMission.id}
              mission={currentMission}
              onContinue={() => actor.send({ type: "CONTROLS_PRESSED" })}
              showRoverButton={false}
            />
          )}
          <button
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
          </button>
        </div>
      )}
    </div>
  );
}
