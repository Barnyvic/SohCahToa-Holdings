import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/enums/user-role.enum';

const runDbIntegration = process.env.ENABLE_DB_INTEGRATION_TESTS === 'true';
const describeDbIntegration = runDbIntegration ? describe : describe.skip;

describeDbIntegration('Transactions concurrency (db integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let authToken: string;
  let walletId: string;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];

    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    jwtService = moduleRef.get(JwtService);

    const userId = '11111111-1111-4111-8111-111111111111';
    await dataSource.query('DELETE FROM `transactions`');
    await dataSource.query('DELETE FROM `wallets`');
    await dataSource.query('DELETE FROM `users`');
    await dataSource.query(
      'INSERT INTO `users` (`id`, `email`, `full_name`, `password_hash`, `role`) VALUES (?, ?, ?, ?, ?)',
      [userId, 'load@test.com', 'Load Test User', 'hashed', UserRole.USER],
    );
    await dataSource.query(
      'INSERT INTO `wallets` (`id`, `user_id`, `balance`, `currency`) VALUES (?, ?, ?, ?)',
      ['22222222-2222-4222-8222-222222222222', userId, '150.00', 'NGN'],
    );
    walletId = '22222222-2222-4222-8222-222222222222';

    authToken = await jwtService.signAsync(
      {
        sub: userId,
        email: 'load@test.com',
        role: UserRole.USER,
        tokenType: 'access',
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'access-secret',
      },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('one of two parallel debits should fail from 150 balance', async () => {
    const debitA = request(server)
      .post('/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 100, type: 'debit', idempotencyKey: 'parallel-a' });
    const debitB = request(server)
      .post('/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 100, type: 'debit', idempotencyKey: 'parallel-b' });

    const [resA, resB] = await Promise.all([debitA, debitB]);
    const bodyA = resA.body as { status: string };
    const bodyB = resB.body as { status: string };

    const statuses = [bodyA.status, bodyB.status].sort();
    expect(statuses).toEqual(['failed', 'success']);

    const walletRowsUnknown: unknown = await dataSource.query(
      'SELECT `balance` FROM `wallets` WHERE `id` = ?',
      [walletId],
    );
    const walletRows = walletRowsUnknown as Array<{ balance: string }>;
    const wallet = walletRows[0];
    expect(wallet.balance).toBe('50.00');
  });
});
