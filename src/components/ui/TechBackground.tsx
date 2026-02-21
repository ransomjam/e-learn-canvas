import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 120;
const CONNECTION_DISTANCE = 2.8;
const BOUNDS = 6;

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const lineRef = useRef<THREE.LineSegments>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * BOUNDS * 2,
          (Math.random() - 0.5) * BOUNDS * 2,
          (Math.random() - 0.5) * BOUNDS * 0.6
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.002
        ),
        scale: 0.03 + Math.random() * 0.04,
      });
    }
    return arr;
  }, []);

  const lineGeometry = useMemo(() => {
    const maxLines = PARTICLE_COUNT * 6;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maxLines * 6), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(maxLines * 8), 4));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  useFrame(() => {
    // Update particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      p.position.add(p.velocity);

      // Bounce
      ['x', 'y', 'z'].forEach((axis) => {
        const bound = axis === 'z' ? BOUNDS * 0.3 : BOUNDS;
        if (Math.abs(p.position[axis as 'x' | 'y' | 'z']) > bound) {
          p.velocity[axis as 'x' | 'y' | 'z'] *= -1;
        }
      });

      dummy.position.copy(p.position);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update connections
    const positions = lineGeometry.attributes.position.array as Float32Array;
    const colors = lineGeometry.attributes.color.array as Float32Array;
    let lineIndex = 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dist = particles[i].position.distanceTo(particles[j].position);
        if (dist < CONNECTION_DISTANCE) {
          const alpha = 1 - dist / CONNECTION_DISTANCE;
          const idx = lineIndex * 6;
          const cidx = lineIndex * 8;

          positions[idx] = particles[i].position.x;
          positions[idx + 1] = particles[i].position.y;
          positions[idx + 2] = particles[i].position.z;
          positions[idx + 3] = particles[j].position.x;
          positions[idx + 4] = particles[j].position.y;
          positions[idx + 5] = particles[j].position.z;

          // Cyan-blue tint
          colors[cidx] = 0.3; colors[cidx + 1] = 0.7; colors[cidx + 2] = 1.0; colors[cidx + 3] = alpha * 0.4;
          colors[cidx + 4] = 0.3; colors[cidx + 5] = 0.7; colors[cidx + 6] = 1.0; colors[cidx + 7] = alpha * 0.4;

          lineIndex++;
          if (lineIndex >= PARTICLE_COUNT * 6) break;
        }
      }
      if (lineIndex >= PARTICLE_COUNT * 6) break;
    }

    lineGeometry.setDrawRange(0, lineIndex * 2);
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.8} />
      </instancedMesh>
      <lineSegments ref={lineRef} geometry={lineGeometry}>
        <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} />
      </lineSegments>
    </>
  );
}

const TechBackground = () => {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,7%)] via-[hsl(217,60%,12%)] to-[hsl(187,50%,10%)]" />
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 1.5]}
      >
        <Particles />
      </Canvas>
      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
    </div>
  );
};

export default TechBackground;
