import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirestoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FirestoreService.name);
  private app!: admin.app.App;
  private db!: Firestore;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const emulatorHost = this.configService.get<string>('FIRESTORE_EMULATOR_HOST')?.trim();
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID')?.trim();
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL')?.trim();
    const rawPrivateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const serviceAccountPath = this.configService
      .get<string>('FIREBASE_SERVICE_ACCOUNT_PATH')
      ?.trim();

    if (admin.apps.length > 0 && admin.apps[0]) {
      this.app = admin.apps[0];
    } else if (emulatorHost) {
      this.app = admin.initializeApp({
        projectId: projectId || 'demo-chat-backend',
      });
      this.logger.log(`Firebase initialized against Firestore Emulator (${emulatorHost})`);
    } else if (serviceAccountPath) {
      const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
      const rawJson = fs.readFileSync(resolvedPath, 'utf8');
      const serviceAccount = JSON.parse(rawJson) as admin.ServiceAccount;
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.logger.log(`Firebase initialized via service account file: ${resolvedPath}`);
    } else if (projectId && clientEmail && rawPrivateKey) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: rawPrivateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log(`Firebase initialized via environment credentials (${projectId})`);
    } else {
      throw new Error('Firebase credentials are not configured');
    }

    this.db = this.app.firestore();
    this.db.settings({ ignoreUndefinedProperties: true });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.db) {
      await this.db.terminate();
    }
  }

  get firestore(): Firestore {
    return this.db;
  }

  async ping(): Promise<void> {
    await this.db.collection('_health').limit(1).get();
  }
}
