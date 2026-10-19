import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import ErrorBoundary from './ErrorBoundary';

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

  const safeProgress = Math.max(0, Math.min(100, Number(task.progress) || 0));
  const progressRatio = safeProgress / 100;
  const barWidth = Math.max(0.02, 4.8 * progressRatio);
  const barPos = -2.4 + barWidth / 2;

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const targetRotX = hovered ? 0.15 : 0;
    const targetRotY = hovered ? 0.2 : 0;
    const targetScale = hovered ? 1.05 : isSelected ? 1.03 : 1.0;

    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, delta * 10);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, delta * 10);
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10);
  });

  const patronageColor = project?.color || '#00E5FF';
  const displayTitle = task.title ? (task.title.length > 38 ? task.title.substring(0, 38) + '...' : task.title) : 'Untitled Task';
  const displayAssignee = task.assignee || 'Jules + Jev';

  return (
    <group position={position}>
      <Float speed={hovered ? 2 : 1} rotationIntensity={0.1} floatIntensity={0.2}>
        <group
          ref={meshRef}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(task);
          }}
        >
          {/* Main 3D Card Box */}
          <RoundedBox args={[5.8, 3.4, 0.25]} radius={0.1} smoothness={4}>
            <meshStandardMaterial
              color={isSelected ? '#1A2333' : hovered ? '#161F2E' : '#0D1117'}
              roughness={0.2}
              metalness={0.8}
              emissive={isSelected ? '#00E5FF' : hovered ? patronageColor : '#090B10'}
              emissiveIntensity={isSelected ? 0.35 : hovered ? 0.25 : 0.05}
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
          <Text position={[-2.4, 1.2, 0.16]} fontSize={0.26} color="#38BDF8" anchorX="left">
            {task.id}
          </Text>

          <Text
            position={[2.4, 1.2, 0.16]}
            fontSize={0.24}
            color={safeProgress === 100 ? '#00FF88' : '#FFB020'}
            anchorX="right"
          >
            {`${safeProgress}%`}
          </Text>

          <Text
            position={[-2.4, 0.4, 0.16]}
            fontSize={0.32}
            color="#E2E2E9"
            anchorX="left"
            maxWidth={4.8}
            lineHeight={1.2}
          >
            {displayTitle}
          </Text>

          <Text position={[-2.4, -0.9, 0.16]} fontSize={0.22} color="#BAC9CC" anchorX="left">
            {`ASSIGNEE: ${displayAssignee}`}
          </Text>

          <Text position={[2.4, -0.9, 0.16]} fontSize={0.22} color={patronageColor} anchorX="right">
            {project?.name || 'PATRON'}
          </Text>

          {/* Progress Mini Tube */}
          <group position={[0, -1.35, 0.15]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[4.8, 0.08, 0.02]} />
              <meshBasicMaterial color="#1E1F25" />
            </mesh>
            <mesh position={[barPos, 0, 0.01]}>
              <boxGeometry args={[barWidth, 0.09, 0.03]} />
              <meshBasicMaterial color={safeProgress === 100 ? '#00FF88' : patronageColor} />
            </mesh>
          </group>
        </group>
      </Float>
    </group>
  );
}

function ColumnHeader3D({ config }) {
  return (
    <group position={[config.x, 6.2, 0]}>
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[6.2, 0.05, 0.02]} />
        <meshBasicMaterial color={config.color} />
      </mesh>

      <Text position={[-2.8, 0, 0.1]} fontSize={0.34} color={config.color} anchorX="left">
        {config.label}
      </Text>
    </group>
  );
}

export default function KanbanCanvas3D({ tasks = [], projects = [], selectedTask, onSelectTask, onSwitchTo2D }) {
  return (
    <div className="w-full h-full relative bg-canvas-deep">
      <ErrorBoundary
        title="3D WebGL renderer paused. Switch to 2D board for standard view."
        onSwitchTo2D={onSwitchTo2D}
      >
        <Canvas camera={{ position: [0, 1, 22], fov: 45 }} gl={{ antialias: true, powerPreference: 'default' }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 15, 10]} intensity={1.2} color="#00E5FF" />
          <pointLight position={[-10, -10, -10]} intensity={0.8} color="#FFB020" />
          <directionalLight position={[0, 10, 5]} intensity={0.5} />

          <Suspense fallback={null}>
            <GridMatrix />
            <AmbientParticles />

            {/* Column Headers */}
            {COLUMN_CONFIG.map((col) => (
              <ColumnHeader3D key={col.id} config={col} />
            ))}

            {/* Task Cards Stacked per Column */}
            {COLUMN_CONFIG.map((col) => {
              const colTasks = tasks.filter((t) => {
                const taskCol = t.column || (t.lane === 'READY' ? 'BACKLOG' : 'BACKLOG');
                return taskCol === col.id;
              });

              return colTasks.map((task, index) => {
                const project =
                  projects.find((p) => p.id === task.projectId) || {
                    name: task.project || 'Discovery Lab',
                    color: '#00E5FF',
                  };
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
      </ErrorBoundary>

      {/* Viewport Overlay Controls */}
      <div className="absolute top-4 left-4 pointer-events-none flex items-center space-x-3 bg-canvas-base/80 backdrop-blur border border-optic-cyan/20 px-3 py-1.5 rounded text-xs font-mono text-optic-bright">
        <span className="inline-block w-2 h-2 rounded-full bg-wal-emerald animate-pulse"></span>
        <span>WEBGL 3D HARNESS ENGINE // 60 FPS</span>
      </div>
    </div>
  );
}
