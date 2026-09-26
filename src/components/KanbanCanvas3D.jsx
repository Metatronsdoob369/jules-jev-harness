import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';

const COLUMN_CONFIG = [
  { id: 'BACKLOG', label: '01 // BACKLOG', x: -10.5, color: '#38BDF8' },
  { id: 'IN_PROGRESS', label: '02 // IN_PROGRESS', x: -3.5, color: '#00E5FF' },
  { id: 'REVIEW', label: '03 // REVIEW', x: 3.5, color: '#FFB020' },
  { id: 'DONE', label: '04 // VERIFIED_DONE', x: 10.5, color: '#00FF88' },
];

function GridMatrix() {
  return (
    <group position={[0, -5, -2]}>
      <gridHelper args={[60, 60, '#084B63', '#161F2E']} position={[0, 0, 0]} />
    </group>
  );
}

function AmbientParticles() {
  const pointsRef = useRef();
  const particleCount = 200;

  const positions = React.useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#00E5FF"
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function TaskTile3D({ task, project, position, isSelected, onSelect }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Mouse roll animation frame
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Smooth target tilt on hover
    const targetRotX = hovered ? 0.15 : 0;
    const targetRotY = hovered ? 0.2 : 0;
    const targetScale = hovered ? 1.05 : (isSelected ? 1.03 : 1.0);

    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, delta * 10);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, delta * 10);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10);
  });

  const patronageColor = project?.color || '#00E5FF';

  return (
    <group position={position}>
      <Float speed={hovered ? 2 : 1} rotationIntensity={0.1} floatIntensity={0.2}>
        <group
          ref={meshRef}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
          onClick={(e) => { e.stopPropagation(); onSelect(task); }}
        >
          {/* Main 3D Card Box */}
          <RoundedBox
            args={[5.8, 3.4, 0.25]}
            radius={0.1}
            smoothness={4}
          >
            <meshStandardMaterial
              color={isSelected ? '#1A2333' : (hovered ? '#161F2E' : '#0D1117')}
              roughness={0.2}
              metalness={0.8}
              emissive={isSelected ? '#00E5FF' : (hovered ? patronageColor : '#090B10')}
              emissiveIntensity={isSelected ? 0.35 : (hovered ? 0.25 : 0.05)}
            />
          </RoundedBox>

          {/* Left Patronage Indicator Bar */}
          <mesh position={[-2.75, 0, 0.14]}>
            <boxGeometry args={[0.15, 3.1, 0.05]} />
            <meshBasicMaterial color={patronageColor} />
          </mesh>

          {/* Hover Glow Edge Line */}
          {(hovered || isSelected) && (
            <lineSegments position={[0, 0, 0.14]}>
              <edgesGeometry args={[new THREE.BoxGeometry(5.82, 3.42, 0.26)]} />
              <lineBasicMaterial color={isSelected ? '#00FF88' : patronageColor} linewidth={2} />
            </lineSegments>
          )}

          {/* Minimal 3D Text Overlay */}
          <Text
            position={[-2.4, 1.2, 0.16]}
            fontSize={0.26}
            color="#38BDF8"
            anchorX="left"
            font="https://fonts.gstatic.com/s/jetbrainsmono/v18/t3Om121W0a2E27M_sP8X8M9.woff"
          >
            {task.id}
          </Text>

          <Text
            position={[2.4, 1.2, 0.16]}
            fontSize={0.24}
            color={task.progress === 100 ? '#00FF88' : '#FFB020'}
            anchorX="right"
            font="https://fonts.gstatic.com/s/jetbrainsmono/v18/t3Om121W0a2E27M_sP8X8M9.woff"
          >
            {`${task.progress}%`}
          </Text>

          <Text
            position={[-2.4, 0.4, 0.16]}
            fontSize={0.32}
            color="#E2E2E9"
            anchorX="left"
            maxWidth={4.8}
            lineHeight={1.2}
          >
            {task.title.length > 38 ? task.title.substring(0, 38) + '...' : task.title}
          </Text>

          <Text
            position={[-2.4, -0.9, 0.16]}
            fontSize={0.22}
            color="#BAC9CC"
            anchorX="left"
            font="https://fonts.gstatic.com/s/jetbrainsmono/v18/t3Om121W0a2E27M_sP8X8M9.woff"
          >
            {`ASSIGNEE: ${task.assignee}`}
          </Text>

          <Text
            position={[2.4, -0.9, 0.16]}
            fontSize={0.22}
            color={patronageColor}
            anchorX="right"
            font="https://fonts.gstatic.com/s/jetbrainsmono/v18/t3Om121W0a2E27M_sP8X8M9.woff"
          >
            {project?.name || 'PATRON'}
          </Text>

          {/* Progress Mini Tube */}
          <group position={[0, -1.35, 0.15]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[4.8, 0.08, 0.02]} />
              <meshBasicMaterial color="#1E1F25" />
            </mesh>
            <mesh position={[-2.4 + (4.8 * (task.progress / 100)) / 2, 0, 0.01]}>
              <boxGeometry args={[4.8 * (task.progress / 100), 0.09, 0.03]} />
              <meshBasicMaterial color={task.progress === 100 ? '#00FF88' : patronageColor} />
            </mesh>
          </group>
        </group>
      </Float>
    </group>
  );
}

function ColumnHeader3D({ config }) {
  return (
    <group position={[config.x, 6, 0]}>
      {/* Header Backing */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[6.2, 0.8, 0.1]} />
        <meshStandardMaterial color="#131923" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Top Accent Stripe */}
      <mesh position={[0, 0.38, 0.06]}>
        <boxGeometry args={[6.2, 0.05, 0.02]} />
        <meshBasicMaterial color={config.color} />
      </mesh>

      <Text
        position={[-2.8, 0, 0.1]}
        fontSize={0.34}
        color={config.color}
        anchorX="left"
        font="https://fonts.gstatic.com/s/jetbrainsmono/v18/t3Om121W0a2E27M_sP8X8M9.woff"
      >
        {config.label}
      </Text>
    </group>
  );
}

export default function KanbanCanvas3D({ tasks, projects, selectedTask, onSelectTask }) {
  return (
    <div className="w-full h-full relative bg-canvas-deep">
      <Canvas
        camera={{ position: [0, 1, 22], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 15, 10]} intensity={1.2} color="#00E5FF" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#FFB020" />
        <directionalLight position={[0, 10, 5]} intensity={0.5} />

        {/* Fonts load from the web. Suspense keeps a slow or offline font from freezing the whole app. */}
        <Suspense fallback={null}>
        <GridMatrix />
        <AmbientParticles />

        {/* Column Headers */}
        {COLUMN_CONFIG.map((col) => (
          <ColumnHeader3D key={col.id} config={col} />
        ))}

        {/* Task Cards Stacked per Column */}
        {COLUMN_CONFIG.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.id);
          return colTasks.map((task, index) => {
            const project = projects.find((p) => p.id === task.projectId);
            const posY = 3.6 - index * 4.0;
            return (
              <TaskTile3D
                key={task.id}
                task={task}
                project={project}
                position={[col.x, posY, 0]}
                isSelected={selectedTask?.id === task.id}
                onSelect={onSelectTask}
              />
            );
          });
        })}

        </Suspense>

        <OrbitControls
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 + 0.1}
          minPolarAngle={Math.PI / 4}
          maxDistance={35}
          minDistance={10}
          enablePan={true}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Viewport Overlay Controls */}
      <div className="absolute top-4 left-4 pointer-events-none flex items-center space-x-3 bg-canvas-base/80 backdrop-blur border border-optic-cyan/20 px-3 py-1.5 rounded text-xs font-mono text-optic-bright">
        <span className="inline-block w-2 h-2 rounded-full bg-wal-emerald animate-pulse"></span>
        <span>WEBGL 3D HARNESS ENGINE // 60 FPS</span>
      </div>
    </div>
  );
}
