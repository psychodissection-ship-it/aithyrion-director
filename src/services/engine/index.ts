import { DirectorEngine } from './DirectorEngine';
import { JevDirectorEngine } from './JevDirectorEngine';

export * from './DirectorEngine';
export * from './JevDirectorEngine';
export * from './HardConstraintsService';

export type EngineType = 'jev';

export function createDirectorEngine(_type: EngineType = 'jev'): DirectorEngine {
  return new JevDirectorEngine();
}

