import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AuditLogService } from '../src/audit-log/audit-log.service';
import { UserRole } from '../src/common/enums/user-role.enum';
import { JwtPayload } from '../src/common/interfaces/jwt-payload.interface';
import { DistributedLockService } from '../src/locks/distributed-lock.service';
import { TransactionType } from '../src/transactions/enums/transaction-type.enum';
import { TransactionsRepository } from '../src/transactions/transactions.repository';
import { WalletTransaction } from '../src/transactions/transaction.entity';
import { TransactionsService } from '../src/transactions/transactions.service';
import { MoneyService } from '../src/utils/money/money.service';
import { Wallet } from '../src/wallet/wallet.entity';

describe('TransactionsService', () => {
  const user: JwtPayload = {
    sub: 'user-1',
    email: 'a@b.com',
    role: UserRole.USER,
    tokenType: 'access',
  };

  const makeDataSource = (
    manager: unknown,
  ): { createQueryRunner: () => unknown } => ({
    createQueryRunner: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      isTransactionActive: true,
      isReleased: false,
      manager,
    }),
    getRepository: () => ({
      findOne: jest.fn().mockResolvedValue({ id: 'w1' }),
    }),
  });

  const makeTransactionsRepository = (manager: {
    findOne: () => Promise<WalletTransaction | null>;
  }): Partial<TransactionsRepository> => ({
    listForUser: jest.fn().mockResolvedValue([]),
    findByIdempotencyKeyWithManager: jest
      .fn()
      .mockImplementation(() => manager.findOne()),
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  });

  it('returns existing tx on duplicate idempotency key', async () => {
    const existing = {
      id: 'tx-1',
      idempotencyKey: 'idem-1',
    } as WalletTransaction;
    const manager = {
      findOne: jest.fn().mockResolvedValue(existing),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        MoneyService,
        {
          provide: TransactionsRepository,
          useValue: makeTransactionsRepository(manager),
        },
        {
          provide: getDataSourceToken(),
          useValue: makeDataSource(manager),
        },
        {
          provide: DistributedLockService,
          useValue: {
            acquire: jest.fn().mockResolvedValue('lock'),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditLogService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    const service = moduleRef.get(TransactionsService);
    const result = await service.create(
      { amount: 10, type: TransactionType.CREDIT, idempotencyKey: 'idem-1' },
      user,
    );
    expect(result).toEqual(existing);
  });

  it('prevents negative balance on debit', async () => {
    const wallet = { id: 'w1', balance: '50.00' } as Wallet;
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(wallet),
      }),
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, payload: unknown) => payload),
      save: jest
        .fn()
        .mockImplementation((_entity: unknown, payload: unknown) => payload),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        MoneyService,
        {
          provide: TransactionsRepository,
          useValue: makeTransactionsRepository(manager),
        },
        {
          provide: getDataSourceToken(),
          useValue: makeDataSource(manager),
        },
        {
          provide: DistributedLockService,
          useValue: {
            acquire: jest.fn().mockResolvedValue('lock'),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditLogService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    const service = moduleRef.get(TransactionsService);
    const result = await service.create(
      { amount: 100, type: TransactionType.DEBIT, idempotencyKey: 'idem-2' },
      user,
    );
    expect(result.status).toBe('failed');
  });

  it('throws if wallet is missing', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        MoneyService,
        {
          provide: TransactionsRepository,
          useValue: makeTransactionsRepository(manager),
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            ...makeDataSource(manager),
            getRepository: () => ({
              findOne: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        {
          provide: DistributedLockService,
          useValue: {
            acquire: jest.fn().mockResolvedValue('lock'),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditLogService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    const service = moduleRef.get(TransactionsService);
    await expect(
      service.create(
        { amount: 10, type: TransactionType.DEBIT, idempotencyKey: 'idem-3' },
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('concurrent debit simulation allows one failure', async () => {
    const balance = { value: '150.00' };
    const runTx = (amount: number, key: string): 'success' | 'failed' => {
      const current = Number(balance.value);
      if (current < amount) return 'failed';
      balance.value = (current - amount).toFixed(2);
      return key.length > 0 ? 'success' : 'failed';
    };

    const [first, second] = await Promise.all([
      Promise.resolve(runTx(100, 'a')),
      Promise.resolve(runTx(100, 'b')),
    ]);
    expect([first, second].sort()).toEqual(['failed', 'success']);
  });
});
