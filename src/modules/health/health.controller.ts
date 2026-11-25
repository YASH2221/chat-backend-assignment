import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirestoreService } from '@/infrastructure/firebase/firestore.service';
import { PostgresService } from '@/infrastructure/postgres/postgres.service';

interface HealthStatus {
  status: 'ok' | 'degraded';
  postgres: 'up' | 'down';
  firestore: 'up' | 'down';
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly postgres: PostgresService,
    private readonly firestore: FirestoreService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check PostgreSQL and Firestore connectivity' })
  async check(): Promise<HealthStatus> {
    const [pgResult, fsResult] = await Promise.allSettled([
      this.postgres.ping(),
      this.firestore.ping(),
    ]);

    const postgresUp = pgResult.status === 'fulfilled';
    const firestoreUp = fsResult.status === 'fulfilled';
    const payload: HealthStatus = {
      status: postgresUp && firestoreUp ? 'ok' : 'degraded',
      postgres: postgresUp ? 'up' : 'down',
      firestore: firestoreUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };

    if (!postgresUp || !firestoreUp) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
