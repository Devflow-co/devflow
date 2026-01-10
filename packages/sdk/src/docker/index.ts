/**
 * Docker Module - Phase 4 V2
 *
 * Provides container execution services for isolated code generation
 * and validation workflows.
 */

export {
  ContainerExecutorService,
  type ContainerExecutorOptions,
} from './container-executor.service';

export {
  CredentialInjectorService,
  type CredentialSet,
  type SecureEnvOptions,
} from './credential-injector.service';
