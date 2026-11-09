import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "../../stores/useAppStore";
import { useRefresh } from "../../hooks/useEngine";
import type { Ship } from "../../types";
import { localHull } from "../../simulation/geometry/hulls";
import type { CollisionContact } from "../../simulation/geometry/types";
import { DEPTH_ZONES } from "../../simulation/environment/bathymetry";
type CameraMode =
  "iso" | "top" | "overview" | "follow" | "free" | "collision" | "grounding";
// CanvasTexture sprites stay inside the WebGL scene. They avoid a second DOM
// React root per label and dispose cleanly during frequent view switches.
function Label3D({
  text,
  position,
  active = false,
  danger = false,
}: {
  text: string;
  position: [number, number, number];
  active?: boolean;
  danger?: boolean;
}) {
  const sprite = useRef<THREE.Sprite>(null),
    worldPosition = useMemo(() => new THREE.Vector3(), []);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(76, text.length * 28 + 20);
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = danger ? "#7d2634" : active ? "#15473e" : "#173442";
    context.strokeStyle = danger ? "#ffad91" : active ? "#69e4bf" : "#698e9a";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(3, 3, canvas.width - 6, 58, 8);
    context.fill();
    context.stroke();
    context.fillStyle = active ? "#94f4d5" : "#d1e9eb";
    context.font = "600 40px Segoe UI, Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, 33);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [text, active, danger]);
  useEffect(() => {
    texture.needsUpdate = true;
    return () => texture.dispose();
  }, [texture]);
  useFrame(({ camera, size }) => {
    if (!sprite.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    sprite.current.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition),
      pixelHeight = danger ? 24 : 20,
      height =
        (pixelHeight *
          2 *
          distance *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
        size.height;
    sprite.current.scale.set(
      (Math.max(76, text.length * 28 + 20) / 64) * height,
      height,
      1,
    );
  });
  return (
    <sprite
      ref={sprite}
      position={position}
      scale={[(Math.max(76, text.length * 28 + 20) / 64) * 3.2, 3.2, 1]}
    >
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
function Water() {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    if (material.current)
      material.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
      <planeGeometry args={[180, 110, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`uniform float uTime;varying vec2 vUv;void main(){float w=sin(vUv.x*220.+uTime*.7)*sin(vUv.y*270.-uTime*.4);float line=smoothstep(.88,1.,w);vec3 base=mix(vec3(.035,.15,.20),vec3(.07,.25,.29),vUv.y);gl_FragColor=vec4(base+line*.035,1.);}`}
      />
    </mesh>
  );
}
function ShipModel({ ship }: { ship: Ship }) {
  const group = useRef<THREE.Group>(null),
    set = useAppStore((s) => s.set),
    engine = useAppStore((s) => s.engine),
    selected = useAppStore((s) => s.selected);
  const showHulls = useAppStore((s) => s.showHulls);
  const drag = useRef<{ offsetX: number; offsetZ: number } | null>(null);
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const intersection = useMemo(() => new THREE.Vector3(), []);
  const gl = useThree((s) => s.gl);
  const release = () => {
    if (drag.current) {
      drag.current = null;
      engine.endDrag();
      set({ draggingShip: null });
      gl.domElement.style.cursor = "auto";
    }
  };
  useEffect(() => {
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      release();
    };
  }, [engine, ship.id]);
  const dragMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(plane, intersection))
      engine.moveShip(
        ship.id,
        intersection.x + drag.current.offsetX,
        intersection.z + drag.current.offsetZ,
      );
  };
  const shape = useMemo(() => {
    const p = new THREE.Shape();
    localHull(ship.length, ship.width).forEach((v, i) =>
      i ? p.lineTo(v.x, v.y) : p.moveTo(v.x, v.y),
    );
    p.closePath();
    return p;
  }, [ship.length, ship.width]);
  useFrame(() => {
    if (group.current) {
      group.current.position.set(
        ship.x,
        0.55 + Math.sin(engine.time * 1.7 + ship.spawnTime) * 0.08,
        ship.y,
      );
      group.current.rotation.y = ship.direction === "AB" ? 0 : Math.PI;
      group.current.rotation.z = Math.sin(engine.time + ship.spawnTime) * 0.008;
    }
  });
  const warning = engine.contacts.some((c) => c.shipIds.includes(ship.id));
  const grounded =
    engine.groundingAssessments.find((a) => a.shipId === ship.id)?.status ===
    "grounded";
  const color = warning
    ? "#ed7776"
    : grounded
      ? "#e5af67"
      : ship.type === "fishing"
        ? "#e8b66a"
        : "#7fc4c5";
  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (
          !e.ray.intersectPlane(plane, intersection) ||
          !engine.beginDrag(ship.id)
        )
          return;
        drag.current = {
          offsetX: ship.x - intersection.x,
          offsetZ: ship.y - intersection.z,
        };
        set({ selected: ship.id, draggingShip: ship.id });
        gl.domElement.style.cursor = "grabbing";
        (
          e.target as unknown as { setPointerCapture: (id: number) => void }
        ).setPointerCapture(e.pointerId);
      }}
      onPointerMove={dragMove}
      onPointerUp={release}
      onPointerOver={() => {
        if (!engine.draggingShipId) gl.domElement.style.cursor = "grab";
      }}
      onPointerOut={() => {
        if (!drag.current) gl.domElement.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        set({ selected: ship.id });
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.9,
              bevelEnabled: true,
              bevelSegments: 1,
              steps: 1,
              bevelSize: 0,
              bevelThickness: 0.15,
            },
          ]}
        />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[-ship.length * 0.25, 0.75, 0]}>
        <boxGeometry args={[ship.length * 0.24, 1.6, ship.width * 0.75]} />
        <meshStandardMaterial color="#e6e9de" />
      </mesh>
      <mesh position={[-ship.length * 0.25, 1.1, 0]}>
        <boxGeometry args={[ship.length * 0.25, 0.45, ship.width * 0.79]} />
        <meshStandardMaterial color="#365972" />
      </mesh>
      <mesh position={[-ship.length * 0.35, 1.9, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1.1, 6]} />
        <meshStandardMaterial color="#e9d7a6" />
      </mesh>
      {ship.type === "fishing" ? (
        <group>
          <mesh position={[0.7, 0.9, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 2.1, 6]} />
            <meshStandardMaterial color="#c9b895" />
          </mesh>
          <mesh position={[1.1, 0.4, 0]}>
            <boxGeometry args={[1.8, 0.3, ship.width * 0.7]} />
            <meshStandardMaterial color="#b58c58" />
          </mesh>
        </group>
      ) : (
        <group>
          {[0, 1].map((i) => (
            <mesh key={i} position={[0.5 + i * 1.65, 0.65, 0]}>
              <boxGeometry args={[1.45, 1.1, ship.width * 0.8]} />
              <meshStandardMaterial color={i ? "#b58e62" : "#487f8c"} />
            </mesh>
          ))}
        </group>
      )}
      {(selected === ship.id || warning) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <ringGeometry
            args={[ship.length * 0.6, ship.length * 0.6 + 0.1, 40]}
          />
          <meshBasicMaterial
            color={warning ? "#ff8085" : "#66efcf"}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
      {showHulls && (
        <Line
          points={localHull(ship.length, ship.width)
            .concat(localHull(ship.length, ship.width)[0])
            .map((p) => [p.x, -0.05, -p.y] as [number, number, number])}
          color={warning ? "#ff9c85" : "#8ee5db"}
          lineWidth={warning ? 2 : 1}
          transparent
          opacity={warning ? 1 : 0.65}
          depthTest={false}
        />
      )}
      <Label3D
        position={[0, 3.4, 0]}
        text={grounded ? `${ship.id} · CẠN` : ship.id}
        danger={warning}
      />
    </group>
  );
}
function SensorStation({
  x,
  id,
  active,
}: {
  x: number;
  id: string;
  active: boolean;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current)
      mat.current.emissiveIntensity = active
        ? 1.3 + Math.sin(clock.elapsedTime * 8) * 0.4
        : 0.1;
  });
  return (
    <group position={[x, 0, -11]}>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 2, 8]} />
        <meshStandardMaterial color="#a5bac0" />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[1.2, 0.8, 0.65]} />
        <meshStandardMaterial
          ref={mat}
          color={active ? "#5ce8bb" : "#3b6470"}
          emissive={active ? "#23dca7" : "#122933"}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 11]}>
        <planeGeometry args={[1.4, 18]} />
        <meshBasicMaterial
          color={active ? "#50f4c1" : "#77b5bc"}
          transparent
          opacity={active ? 0.2 : 0.035}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Label3D position={[0, 4, 0]} text={id} active={active} />
    </group>
  );
}
function CameraRig({ mode }: { mode: CameraMode }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const engine = useAppStore((s) => s.engine),
    selected = useAppStore((s) => s.selected),
    dragging = useAppStore((s) => s.draggingShip);
  useEffect(() => {
    const presets = {
      iso: [55, 63, 65],
      top: [0, 105, 0.1],
      overview: [85, 45, 82],
      follow: [20, 18, 25],
      free: [55, 63, 65],
      collision: [20, 24, 28],
      grounding: [20, 24, 28],
    } as const;
    const p = presets[mode];
    camera.position.set(p[0], p[1], p[2]);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
  }, [mode, camera]);
  useFrame((_, dt) => {
    if (mode === "grounding" && controls.current && !dragging) {
      const p = engine.groundingAssessments.find(
        (a) => a.status !== "clear",
      )?.point;
      if (p) {
        controls.current.target.lerp(
          new THREE.Vector3(p.x, 0, p.y),
          1 - Math.exp(-dt * 5),
        );
        camera.position.lerp(
          new THREE.Vector3(p.x + 20, 24, p.y + 28),
          1 - Math.exp(-dt * 4),
        );
        controls.current.update();
      }
      return;
    }
    if (
      mode === "collision" &&
      engine.contacts[0] &&
      controls.current &&
      !dragging
    ) {
      const p = engine.contacts[0].point;
      controls.current.target.lerp(
        new THREE.Vector3(p.x, 0, p.y),
        1 - Math.exp(-dt * 5),
      );
      camera.position.lerp(
        new THREE.Vector3(p.x + 20, 24, p.y + 28),
        1 - Math.exp(-dt * 4),
      );
      controls.current.update();
      return;
    }
    if (mode !== "follow" || !controls.current || dragging) return;
    const ship = engine.ships.find(
      (s) => s.id === selected && s.status !== "completed",
    );
    if (ship) {
      const target = new THREE.Vector3(ship.x, 0, ship.y);
      controls.current.target.lerp(target, 1 - Math.exp(-dt * 5));
      camera.position.lerp(
        new THREE.Vector3(ship.x + 16, 20, ship.y + 25),
        1 - Math.exp(-dt * 3),
      );
      controls.current.update();
    }
  });
  return (
    <OrbitControls
      enabled={!dragging}
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={12}
      maxDistance={170}
      maxPolarAngle={Math.PI * 0.48}
    />
  );
}
function ContactMarker({ contact }: { contact: CollisionContact }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.14;
    ring.current?.scale.set(s, s, 1);
  });
  return (
    <group position={[contact.point.x, 0.22, contact.point.y]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.5, 40]} />
        <meshBasicMaterial
          color="#ff956f"
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.3, 12, 8]} />
        <meshBasicMaterial color="#ffd4a5" depthTest={false} />
      </mesh>
      <Label3D text="VA CHẠM" position={[0, 8, 0]} danger />
    </group>
  );
}
function Environment() {
  const engine = useAppStore((s) => s.engine);
  useRefresh(100);
  const a = { warning: engine.conflictNow };
  const showTrails = useAppStore((s) => s.showTrails),
    showDistances = useAppStore((s) => s.showDistances);
  const showDepths = useAppStore((s) => s.showDepths),
    showSensorBeams = useAppStore((s) => s.showSensorBeams);
  const depthShapes = useMemo(
    () =>
      DEPTH_ZONES.map(
        (z) =>
          new THREE.Shape(z.polygon.map((p) => new THREE.Vector2(p.x, p.y))),
      ),
    [],
  );
  const signalColor = engine.collisionNow
    ? "#ff6575"
    : a.warning
      ? "#e3b468"
      : "#56ceab";
  return (
    <>
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[30, 70, 20]}
        intensity={2.5}
        color="#e2f3ed"
      />
      <hemisphereLight args={["#a7d5eb", "#2b4346", 1]} />
      <Water />
      {showDepths &&
        DEPTH_ZONES.map((z, i) => (
          <group key={z.id}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
              <shapeGeometry args={[depthShapes[i]]} />
              <meshBasicMaterial
                color={z.depth < 2 ? "#d0a55e" : "#a8ad79"}
                transparent
                opacity={z.depth < 2 ? 0.24 : 0.16}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            <Line
              points={z.polygon
                .concat(z.polygon[0])
                .map((p) => [p.x, 0.04, p.y] as [number, number, number])}
              color="#cfbd7f"
              transparent
              opacity={0.35}
              lineWidth={1}
              dashed
              dashSize={0.6}
              gapSize={0.6}
            />
          </group>
        ))}
      {showSensorBeams &&
        engine.rangeSensors.map((s) => {
          const end = s.hit ?? {
            x: s.origin.x + s.direction.x * s.maxRange,
            y: s.origin.y + s.direction.y * s.maxRange,
          };
          return (
            <group key={s.id}>
              <Line
                points={[
                  [s.origin.x, 0.4, s.origin.y],
                  [end.x, 0.4, end.y],
                ]}
                color={s.hit ? "#a8e6b2" : "#6a9aa9"}
                transparent
                opacity={s.hit ? 0.8 : 0.22}
                lineWidth={s.hit ? 2 : 1}
                dashed
                dashSize={0.4}
                gapSize={0.4}
              />
              <mesh position={[s.origin.x, 0.7, s.origin.y]}>
                <boxGeometry args={[0.9, 0.7, 0.9]} />
                <meshStandardMaterial
                  color={s.hit ? "#8cc79f" : "#658796"}
                  emissive="#365848"
                  emissiveIntensity={s.hit ? 1 : 0.1}
                />
              </mesh>
            </group>
          );
        })}
      {showDepths &&
        [
          { id: "D_A", x: -22, z: -5.1 },
          { id: "D_B", x: 15, z: 5.1 },
        ].map((p) => (
          <group key={p.id} position={[p.x, 0.15, p.z]}>
            <mesh>
              <cylinderGeometry args={[0.2, 0.35, 0.5, 8]} />
              <meshStandardMaterial
                color="#c5b075"
                emissive="#675b32"
                emissiveIntensity={0.2}
              />
            </mesh>
            <Label3D text={p.id} position={[0, 1.3, 0]} />
          </group>
        ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, 0, side * 28]}>
            <boxGeometry args={[160, 2, 30]} />
            <meshStandardMaterial color="#344c50" roughness={1} />
          </mesh>
          <mesh position={[0, 0.5, side * 13]}>
            <boxGeometry args={[160, 1, 1]} />
            <meshStandardMaterial color="#799091" />
          </mesh>
        </group>
      ))}
      <mesh position={[-10, 0.55, -16]}>
        <boxGeometry args={[32, 1.2, 8]} />
        <meshStandardMaterial color="#708180" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-23 + i * 6, 2.1, -18]}>
          <boxGeometry args={[4.8, 2.2, 3]} />
          <meshStandardMaterial color={i % 2 ? "#a68b67" : "#597a7c"} />
        </mesh>
      ))}
      <group position={[-25, 1, 23]}>
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[7, 4, 6]} />
          <meshStandardMaterial color="#a0afab" />
        </mesh>
        <mesh position={[0, 5, 0]}>
          <boxGeometry args={[5, 2, 4.5]} />
          <meshStandardMaterial color="#376577" />
        </mesh>
        <mesh position={[0, 6.3, 0]}>
          <boxGeometry args={[6, 0.6, 5.5]} />
          <meshStandardMaterial color="#d2d8c9" />
        </mesh>
        <mesh position={[0, 8, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 4, 6]} />
          <meshStandardMaterial color="#c2c9ba" />
        </mesh>
      </group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 17]} />
        <meshBasicMaterial
          color={
            engine.collisionNow ? "#ff5265" : a.warning ? "#e5b25d" : "#3bdac1"
          }
          transparent
          opacity={a.warning ? 0.18 : 0.035}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[-1, 1].flatMap((side) =>
        Array.from({ length: 9 }, (_, i) => (
          <group
            key={`${side}-${i}`}
            position={[-30 + i * 7.5, 0.15, side * 10]}
          >
            <mesh>
              <cylinderGeometry args={[0.28, 0.6, 0.7, 8]} />
              <meshStandardMaterial
                color={side === 1 ? "#d9a255" : "#4ab89b"}
              />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 1, 6]} />
              <meshStandardMaterial color="#c7d5c6" />
            </mesh>
          </group>
        )),
      )}
      {[-40, 40].map((x) => (
        <group key={x} position={[x, 0, 15]}>
          <mesh position={[0, 2.3, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 4.6, 8]} />
            <meshStandardMaterial color="#90a6a8" />
          </mesh>
          <mesh position={[0, 4.9, 0]}>
            <sphereGeometry args={[0.65, 10, 10]} />
            <meshStandardMaterial
              color={signalColor}
              emissive={signalColor}
              emissiveIntensity={
                a.warning ? (Math.floor(engine.time * 3) % 2 ? 3 : 0.3) : 0.4
              }
            />
          </mesh>
        </group>
      ))}
      {engine.sensors.sensors.map((s) => (
        <SensorStation key={s.id} id={s.id} x={s.x} active={s.state} />
      ))}
      {showTrails &&
        engine.ships
          .filter((s) => s.status !== "completed")
          .map((s) => {
            const trail = engine.trails.get(s.id);
            return trail && trail.length > 1 ? (
              <Line
                key={`trail-${s.id}`}
                points={trail.map(
                  (p) => [p.x, 0.06, p.y] as [number, number, number],
                )}
                color={s.direction === "AB" ? "#79dbca" : "#e1b877"}
                transparent
                opacity={0.3}
                lineWidth={1}
                dashed
                dashSize={0.7}
                gapSize={0.6}
              />
            ) : null;
          })}
      {showDistances &&
        engine.closestPair &&
        engine.closestPair.distance > 0.001 && (
          <Line
            points={[
              [engine.closestPair.pointA.x, 0.18, engine.closestPair.pointA.y],
              [engine.closestPair.pointB.x, 0.18, engine.closestPair.pointB.y],
            ]}
            color={engine.closestPair.distance < 2.5 ? "#f1c27d" : "#a1cfd8"}
            dashed
            dashSize={0.5}
            gapSize={0.5}
            lineWidth={1}
          />
        )}
      {engine.ships
        .filter((s) => s.status !== "completed")
        .map((s) => (
          <ShipModel key={s.id} ship={s} />
        ))}
      {engine.contacts.map((c) => (
        <ContactMarker key={c.key} contact={c} />
      ))}
      {engine.groundingAssessments
        .filter((a) => a.status !== "clear")
        .map((a) => (
          <group
            key={`ground-${a.shipId}`}
            position={[a.point.x, 0.12, a.point.y]}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.4, 1.55, 36]} />
              <meshBasicMaterial color="#edbd75" depthTest={false} />
            </mesh>
          </group>
        ))}
    </>
  );
}
class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty">
        Không khởi tạo được WebGL. Chọn chế độ 2D để tiếp tục mô phỏng.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function Harbor3D() {
  const [mode, setMode] = useState<CameraMode>("iso");
  const quality = useAppStore((s) => s.quality);
  const selected = useAppStore((s) => s.selected);
  const engine = useAppStore((s) => s.engine);
  useRefresh(150);
  const [supported] = useState(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  return (
    <div className="three-container" data-testid="harbor-3d">
      <div className="camera-controls">
        <select
          aria-label="Góc nhìn 3D"
          value={mode}
          onChange={(e) => setMode(e.target.value as CameraMode)}
        >
          <option value="iso">Góc đẳng phối</option>
          <option value="top">Nhìn từ trên</option>
          <option value="overview">Toàn cảnh cảng</option>
          <option value="follow" disabled={!selected}>
            Theo tàu đã chọn
          </option>
          <option value="free">Camera tự do</option>
          <option value="collision" disabled={!engine.collisionNow}>
            Cận cảnh va chạm
          </option>
          <option value="grounding" disabled={!engine.groundingRisk}>
            Cận cảnh mắc cạn
          </option>
        </select>
      </div>
      {supported ? (
        <WebGLErrorBoundary>
          <Canvas
            dpr={quality === "low" ? 1 : [1, 1.5]}
            camera={{ position: [55, 63, 65], fov: 45, near: 0.1, far: 500 }}
            gl={{
              antialias: quality === "high",
              powerPreference: "high-performance",
            }}
          >
            <color attach="background" args={["#0d2432"]} />
            <fog attach="fog" args={["#0d2432", 130, 250]} />
            <Environment />
            <CameraRig mode={mode} />
          </Canvas>
        </WebGLErrorBoundary>
      ) : (
        <div className="empty">
          Trình duyệt chưa hỗ trợ WebGL 2. Mô phỏng vẫn tiếp tục; hãy chọn 2D.
        </div>
      )}
      <div className="map-corner-label">3D / MÔ HÌNH HÌNH HỌC CỤC BỘ</div>
    </div>
  );
}
