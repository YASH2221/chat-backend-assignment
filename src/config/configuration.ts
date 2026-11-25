import type { EnvConfig } from './env.validation';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  database: {
    url: string;
    ssl: boolean;
    poolMax: number;
  };
  firebase: {
    projectId: string | undefined;
    clientEmail: string | undefined;
    privateKey: string | undefined;
    serviceAccountPath: string | undefined;
    emulatorHost: string | undefined;
  };
}

export function buildAppConfig(env: EnvConfig): AppConfig {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    database: {
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
      poolMax: env.DATABASE_POOL_MAX,
    },
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID?.trim(),
      clientEmail: env.FIREBASE_CLIENT_EMAIL?.trim(),
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      serviceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim(),
      emulatorHost: env.FIRESTORE_EMULATOR_HOST?.trim(),
    },
  };
}
