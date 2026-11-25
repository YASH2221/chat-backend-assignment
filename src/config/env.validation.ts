import { z } from 'zod';

const booleanStringSchema = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((val) => val === 'true' || val === '1');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: booleanStringSchema,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const hasEmulator = Boolean(env.FIRESTORE_EMULATOR_HOST?.trim());
    const hasServiceAccountPath = Boolean(env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim());
    const hasInlineCreds = Boolean(
      env.FIREBASE_PROJECT_ID?.trim() &&
      env.FIREBASE_CLIENT_EMAIL?.trim() &&
      env.FIREBASE_PRIVATE_KEY?.trim(),
    );

    if (!hasEmulator && !hasServiceAccountPath && !hasInlineCreds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Firebase credentials required: provide FIREBASE_SERVICE_ACCOUNT_PATH, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or FIRESTORE_EMULATOR_HOST',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }
  return parsed.data;
}
