import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Item, Shell } from '../../stores/useGameStore';

// ── Lighting ─────────────────────────────────────────────────────────────────

function SceneLighting() {
  return (
    <>
      <ambientLight color="#1a0804" intensity={1.2} />
      <directionalLight
        position={[1, 7, 4]}
        intensity={1.8}
        color="#c8976e"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      {/* Red atmospheric fill from opponent side */}
      <pointLight position={[0, 3, -4]} color="#6b0000" intensity={2} />
      {/* Warm under-fill */}
      <pointLight position={[-2, 0.5, 2]} color="#5c2616" intensity={0.6} />
    </>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function GameTable() {
  return (
    <group>
      {/* Table top */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[5.5, 0.12, 5]} />
        <meshStandardMaterial color="#170c05" roughness={0.92} metalness={0} />
      </mesh>
      {/* Wood grain strips */}
      {[-1.6, -0.8, 0, 0.8, 1.6].map((x, i) => (
        <mesh key={i} position={[x, 0.062, 0]}>
          <boxGeometry args={[0.06, 0.002, 5]} />
          <meshStandardMaterial color="#0e0703" roughness={1} />
        </mesh>
      ))}
      {/* Center felt strip */}
      <mesh position={[0, 0.063, 0]}>
        <boxGeometry args={[3.8, 0.004, 3.2]} />
        <meshStandardMaterial color="#0c1408" roughness={0.99} />
      </mesh>
      {/* Near edge trim */}
      <mesh position={[0, 0.05, 2.5]} castShadow>
        <boxGeometry args={[5.5, 0.07, 0.06]} />
        <meshStandardMaterial color="#2e1808" roughness={0.75} />
      </mesh>
      {/* Far edge trim */}
      <mesh position={[0, 0.05, -2.5]}>
        <boxGeometry args={[5.5, 0.07, 0.06]} />
        <meshStandardMaterial color="#2e1808" roughness={0.75} />
      </mesh>
      {/* Table legs */}
      {(
        [[-2.4, -0.56, -2.2], [2.4, -0.56, -2.2],
         [-2.4, -0.56,  2.2], [2.4, -0.56,  2.2]] as [number, number, number][]
      ).map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.12, 1.0, 0.12]} />
          <meshStandardMaterial color="#0e0804" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ── Shotgun ───────────────────────────────────────────────────────────────────

interface ShotgunProps {
  firingTime: number;
  firedShell: Shell | null;
}

function ProcShotgun({ firingTime, firedShell }: ShotgunProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const flashRef   = useRef<THREE.PointLight>(null);
  const BASE_Z     = 0.12;

  useFrame(() => {
    const elapsed = (Date.now() - firingTime) / 1000;
    const active  = firingTime > 0 && elapsed < 0.55;

    if (groupRef.current) {
      if (active) {
        const t       = elapsed / 0.55;
        const recoil  = Math.sin(t * Math.PI) * 0.38;
        const tilt    = Math.sin(t * Math.PI * 0.7) * 0.14;
        groupRef.current.position.z    = BASE_Z + recoil;
        groupRef.current.rotation.x    = -tilt;
      } else {
        groupRef.current.position.z    =
          THREE.MathUtils.lerp(groupRef.current.position.z, BASE_Z, 0.18);
        groupRef.current.rotation.x    =
          THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.18);
      }
    }

    if (flashRef.current) {
      const e2 = (Date.now() - firingTime) / 1000;
      if (firingTime > 0 && e2 < 0.14 && firedShell === 'live') {
        flashRef.current.intensity = (1 - e2 / 0.14) * 14;
      } else {
        flashRef.current.intensity =
          THREE.MathUtils.lerp(flashRef.current.intensity, 0, 0.25);
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, 0.16, BASE_Z]}
      rotation={[0, Math.PI / 2, 0]}
    >
      {/* ── Barrel ── */}
      <mesh position={[1.1, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.032, 2.2, 14]} />
        <meshStandardMaterial color="#141414" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Under-barrel magazine tube */}
      <mesh position={[0.9, -0.055, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 1.8, 10]} />
        <meshStandardMaterial color="#181818" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* ── Receiver ── */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.72, 0.19, 0.155]} />
        <meshStandardMaterial color="#222" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Ejection port recess */}
      <mesh position={[0.06, 0.025, -0.08]}>
        <boxGeometry args={[0.32, 0.12, 0.01]} />
        <meshStandardMaterial color="#080808" />
      </mesh>

      {/* ── Pump slide ── */}
      <mesh position={[0.52, 0, 0]} castShadow>
        <boxGeometry args={[0.44, 0.155, 0.17]} />
        <meshStandardMaterial color="#333" metalness={0.55} roughness={0.5} />
      </mesh>
      {/* Pump grooves */}
      {[-0.14, 0, 0.14].map((z, i) => (
        <mesh key={i} position={[0.52, 0.082, z]}>
          <boxGeometry args={[0.4, 0.014, 0.022]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}

      {/* ── Stock (wood) ── */}
      <mesh position={[-0.7, -0.01, 0]} castShadow>
        <boxGeometry args={[1.0, 0.17, 0.145]} />
        <meshStandardMaterial color="#7c4523" roughness={0.88} metalness={0} />
      </mesh>
      {/* Stock end cap */}
      <mesh position={[-1.21, -0.01, 0]} castShadow>
        <cylinderGeometry args={[0.076, 0.076, 0.145, 14]} />
        <meshStandardMaterial color="#5a3010" roughness={0.9} metalness={0} />
      </mesh>
      {/* Wood grain on stock */}
      {[-0.9, -0.7, -0.5].map((x, i) => (
        <mesh key={i} position={[x, -0.005, 0.074]}>
          <boxGeometry args={[0.18, 0.155, 0.002]} />
          <meshStandardMaterial color="#6a3818" roughness={1} />
        </mesh>
      ))}

      {/* ── Pistol grip (wood) ── */}
      <mesh position={[-0.19, -0.165, 0]} castShadow>
        <boxGeometry args={[0.27, 0.28, 0.125]} />
        <meshStandardMaterial color="#5a3210" roughness={0.9} metalness={0} />
      </mesh>

      {/* ── Trigger guard ── */}
      <mesh position={[-0.12, -0.155, 0]}>
        <torusGeometry args={[0.092, 0.014, 8, 14, Math.PI]} />
        <meshStandardMaterial color="#1e1e1e" metalness={0.65} roughness={0.4} />
      </mesh>
      {/* Trigger */}
      <mesh position={[-0.12, -0.175, 0]}>
        <boxGeometry args={[0.018, 0.1, 0.01]} />
        <meshStandardMaterial color="#555" metalness={0.8} />
      </mesh>

      {/* ── Muzzle end ── */}
      <mesh position={[2.2, 0.02, 0]}>
        <cylinderGeometry args={[0.038, 0.035, 0.04, 12]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* ── Front sight ── */}
      <mesh position={[2.05, 0.06, 0]}>
        <boxGeometry args={[0.025, 0.055, 0.016]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.6} />
      </mesh>
      {/* Rear sight notch */}
      <mesh position={[0.15, 0.1, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.015]} />
        <meshStandardMaterial color="#2e2e2e" metalness={0.6} />
      </mesh>

      {/* ── Muzzle flash light ── */}
      <pointLight
        ref={flashRef}
        position={[2.2, 0.02, 0]}
        color="#ff9933"
        intensity={0}
        distance={5}
      />
    </group>
  );
}

// ── Shell casings ─────────────────────────────────────────────────────────────

type ShellType = 'live' | 'blank' | 'unknown';

function ShellModel({
  shellType,
  position,
}: {
  shellType: ShellType;
  position: [number, number, number];
}) {
  const tipColor =
    shellType === 'live' ? '#c0392b' :
    shellType === 'blank' ? '#1e8449' : '#1a1208';
  const bodyColor = shellType === 'unknown' ? '#100c05' : '#b8860b';
  const tipEmissive =
    shellType === 'live' ? '#3a0000' :
    shellType === 'blank' ? '#003a00' : '#000000';

  return (
    <group position={position}>
      {/* Rim */}
      <mesh position={[0, -0.125, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.024, 12]} />
        <meshStandardMaterial color="#7a7a68" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Brass body */}
      <mesh>
        <cylinderGeometry args={[0.042, 0.044, 0.245, 12]} />
        <meshStandardMaterial color={bodyColor} metalness={0.45} roughness={0.5} />
      </mesh>
      {/* Tip */}
      <mesh position={[0, 0.155, 0]}>
        <sphereGeometry args={[0.042, 12, 8]} />
        <meshStandardMaterial
          color={tipColor}
          emissive={tipEmissive}
          emissiveIntensity={0.5}
          metalness={0.1}
          roughness={0.65}
        />
      </mesh>
    </group>
  );
}

function ShellRow({
  totalVisible,
  revealedShell,
  isMyTurn,
}: {
  totalVisible: number;
  revealedShell: Shell | null;
  isMyTurn: boolean;
}) {
  const spacing = 0.33;
  const startX  = -((totalVisible - 1) * spacing) / 2;

  return (
    <group position={[0, 0.2, 0.55]}>
      {Array.from({ length: totalVisible }).map((_, i) => {
        const revealed  = i === 0 && !!revealedShell && isMyTurn;
        const shellType: ShellType =
          revealed ? (revealedShell as ShellType) : 'unknown';
        return (
          <ShellModel
            key={i}
            shellType={shellType}
            position={[startX + i * spacing, 0, 0]}
          />
        );
      })}
    </group>
  );
}

// ── Item objects ──────────────────────────────────────────────────────────────

function useHoverLift(interactive: boolean) {
  const ref       = useRef<THREE.Group>(null);
  const [hov, setHov] = useState(false);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.y =
        THREE.MathUtils.lerp(ref.current.position.y, hov ? 0.07 : 0, 0.12);
    }
  });
  const handlers = {
    onPointerEnter: () => {
      if (interactive) {
        setHov(true);
        document.body.style.cursor = 'pointer';
      }
    },
    onPointerLeave: () => {
      setHov(false);
      document.body.style.cursor = '';
    },
  };
  return { ref, hovered: hov, handlers };
}

function MagnifierItem({
  interactive, onUse,
}: { interactive: boolean; onUse?: () => void }) {
  const { ref, handlers } = useHoverLift(interactive);
  return (
    <group ref={ref} {...handlers} onClick={() => interactive && onUse?.()}>
      <mesh>
        <torusGeometry args={[0.08, 0.017, 10, 24]} />
        <meshStandardMaterial color="#c8a44a" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.063, 18]} />
        <meshStandardMaterial
          color="#88aacc" transparent opacity={0.35}
          metalness={0.1} roughness={0}
        />
      </mesh>
      <mesh position={[0.1, -0.105, 0]} rotation={[0, 0, -0.55]}>
        <cylinderGeometry args={[0.012, 0.016, 0.17, 8]} />
        <meshStandardMaterial color="#8a6030" roughness={0.7} />
      </mesh>
    </group>
  );
}

function CigarettesItem({
  interactive, onUse,
}: { interactive: boolean; onUse?: () => void }) {
  const { ref, handlers } = useHoverLift(interactive);
  return (
    <group ref={ref} rotation={[Math.PI / 2, 0, 0.3]}
      {...handlers} onClick={() => interactive && onUse?.()}>
      <mesh>
        <cylinderGeometry args={[0.024, 0.024, 0.22, 10]} />
        <meshStandardMaterial color="#d4c5a0" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.115, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.04, 10]} />
        <meshStandardMaterial color="#c87a5a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.018, 8, 6]} />
        <meshStandardMaterial
          color="#ff5500" emissive="#cc2200" emissiveIntensity={1.5}
        />
      </mesh>
    </group>
  );
}

function HandcuffsItem({
  interactive, onUse,
}: { interactive: boolean; onUse?: () => void }) {
  const { ref, handlers } = useHoverLift(interactive);
  return (
    <group ref={ref} {...handlers} onClick={() => interactive && onUse?.()}>
      {[-0.07, 0.07].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <torusGeometry args={[0.06, 0.014, 8, 18]} />
          <meshStandardMaterial color="#888878" metalness={0.82} roughness={0.28} />
        </mesh>
      ))}
      {/* Chain link */}
      <mesh>
        <boxGeometry args={[0.06, 0.016, 0.016]} />
        <meshStandardMaterial color="#777768" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  );
}

function BeerItem({
  interactive, onUse,
}: { interactive: boolean; onUse?: () => void }) {
  const { ref, handlers } = useHoverLift(interactive);
  return (
    <group ref={ref} {...handlers} onClick={() => interactive && onUse?.()}>
      <mesh>
        <cylinderGeometry args={[0.048, 0.048, 0.18, 14]} />
        <meshStandardMaterial color="#b8960c" metalness={0.6} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.04, 0.048, 0.022, 14]} />
        <meshStandardMaterial color="#888" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0.03, 0.117, 0]}>
        <boxGeometry args={[0.03, 0.005, 0.012]} />
        <meshStandardMaterial color="#aaa" metalness={0.9} />
      </mesh>
    </group>
  );
}

function InverterItem({
  interactive, onUse,
}: { interactive: boolean; onUse?: () => void }) {
  const { ref, handlers } = useHoverLift(interactive);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.6;
  });
  return (
    <group ref={ref} {...handlers} onClick={() => interactive && onUse?.()}>
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial
          color="#3a0068" emissive="#1a0030"
          emissiveIntensity={0.7} metalness={0.3} roughness={0.5}
        />
      </mesh>
      {[0.072, -0.072].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[i === 1 ? Math.PI : 0, 0, 0]}>
          <coneGeometry args={[0.028, 0.048, 6]} />
          <meshStandardMaterial
            color="#cc88ff" emissive="#8844cc" emissiveIntensity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

const ITEM_COMPS: Record<Item, React.FC<{ interactive: boolean; onUse?: () => void }>> = {
  magnifier:  MagnifierItem,
  cigarettes: CigarettesItem,
  handcuffs:  HandcuffsItem,
  beer:       BeerItem,
  inverter:   InverterItem,
};

function ItemObjects({
  items, zPos, interactive, onUseItem,
}: {
  items: Item[];
  zPos: number;
  interactive: boolean;
  onUseItem?: (item: Item) => void;
}) {
  const spacing = 0.38;
  const startX  = -((items.length - 1) * spacing) / 2;
  return (
    <group position={[0, 0.12, zPos]}>
      {items.map((item, i) => {
        const Comp = ITEM_COMPS[item];
        return (
          <group key={`${item}-${i}`} position={[startX + i * spacing, 0, 0]}>
            <Comp
              interactive={interactive}
              onUse={() => onUseItem?.(item)}
            />
          </group>
        );
      })}
    </group>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────

export interface GameSceneProps {
  totalShells:    number;
  revealedShell:  Shell | null;
  isMyTurn:       boolean;
  myItems:        Item[];
  opponentItems:  Item[];
  firingTime:     number;
  firedShell:     Shell | null;
  onUseItem:      (item: Item) => void;
}

export default function GameScene({
  totalShells, revealedShell, isMyTurn,
  myItems, opponentItems, firingTime, firedShell, onUseItem,
}: GameSceneProps) {
  return (
    <>
      <fog attach="fog" args={['#090402', 11, 22]} />
      <SceneLighting />
      <GameTable />
      <ProcShotgun firingTime={firingTime} firedShell={firedShell} />
      <ShellRow
        totalVisible={totalShells}
        revealedShell={revealedShell}
        isMyTurn={isMyTurn}
      />
      <ItemObjects
        items={myItems}
        zPos={1.75}
        interactive={isMyTurn}
        onUseItem={onUseItem}
      />
      <ItemObjects
        items={opponentItems}
        zPos={-1.75}
        interactive={false}
      />
    </>
  );
}
