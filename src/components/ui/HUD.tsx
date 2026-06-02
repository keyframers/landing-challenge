import styles from "./HUD.module.css";

interface HUDProps {
  fuel: number;
  speed: number;
  altitude: number;
  angle: number;
  thrustLevel: number;
  status: string;
  missionNumber: number;
  totalMissions: number;
  onPause: () => void;
  onMissionSelect?: (missionIndex: number) => void;
}

export function HUD({
  fuel,
  speed,
  altitude,
  angle,
  thrustLevel,
  status,
  missionNumber,
  totalMissions,
  onPause,
  onMissionSelect,
}: HUDProps) {
  const angleDeg = Math.abs((angle * 180) / Math.PI) % 360;

  return (
    <div className={styles.container}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.logo}>Lunar Landing</div>
        <div className={styles.missionInfo}>
          <div className={styles.missionLabel}>
            Mission {missionNumber} / {totalMissions}
          </div>
          <MissionProgress
            current={missionNumber - 1}
            total={totalMissions}
            onMissionSelect={onMissionSelect}
          />
        </div>
        <button onClick={onPause} className={styles.pauseButton}>
          ⏸
        </button>
      </div>

      {/* Left panel - thrust gauge */}
      <div className={styles.leftPanel}>
        <div className={`${styles.panelLabel} ${styles.thrustLabel}`}>
          Thrust
        </div>
        <ThrustGauge level={thrustLevel} />
        <div className={`${styles.panelLabel} ${styles.fuelLabel}`}>Fuel</div>
        <div
          className={`${styles.fuelValue} ${fuel < 20 ? styles.low : styles.normal}`}
        >
          {Math.round(fuel)}%
        </div>
      </div>

      {/* Right panel - telemetry */}
      <div className={styles.rightPanel}>
        <TelemetryItem label="Altitude" value={`${Math.round(altitude)} m`} />
        <TelemetryItem
          label="Speed"
          value={`${speed.toFixed(1)} m/s`}
          warn={speed > 1.5}
        />
        <TelemetryItem
          label="Angle"
          value={`${angleDeg.toFixed(0)}°`}
          warn={angleDeg > 10 && angleDeg < 350}
        />
      </div>

      {/* Bottom - status */}
      <div className={styles.statusBar}>
        <div className={styles.statusLabel}>Status</div>
        <div className={styles.statusValue}>{status}</div>
      </div>
    </div>
  );
}

function ThrustGauge({ level }: { level: number }) {
  const bars = 10;
  return (
    <div className={styles.thrustGauge}>
      {Array.from({ length: bars }).map((_, i) => {
        const barLevel = (bars - i) / bars;
        const active = level >= barLevel;
        return (
          <div
            key={i}
            className={`${styles.thrustBar} ${active ? styles.active : styles.inactive}`}
          />
        );
      })}
    </div>
  );
}

function TelemetryItem({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={styles.telemetryItem}>
      <div className={styles.telemetryLabel}>{label}</div>
      <div
        className={`${styles.telemetryValue} ${warn ? styles.warning : styles.normal}`}
      >
        {value}
      </div>
    </div>
  );
}

function MissionProgress({
  current,
  total,
  onMissionSelect,
}: {
  current: number;
  total: number;
  onMissionSelect?: (missionIndex: number) => void;
}) {
  return (
    <div className={styles.missionProgress}>
      {Array.from({ length: total }).map((_, i) => {
        let dotClass = styles.pending;
        if (i < current) dotClass = styles.completed;
        else if (i === current) dotClass = styles.current;
        return (
          <button
            key={i}
            onClick={() => onMissionSelect?.(i)}
            className={`${styles.progressDot} ${dotClass} ${onMissionSelect ? styles.clickable : ""}`}
            style={{ cursor: onMissionSelect ? "pointer" : "default" }}
          />
        );
      })}
    </div>
  );
}
