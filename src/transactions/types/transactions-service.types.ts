import type { AuditAction } from '../../audit-log/audit-actions.enum';
import type { Paginated } from '../../common/types/paginated.type';
import type { WalletTransaction } from '../transaction.entity';

export type AuditAfterCommitPayload = {
  action: AuditAction;
  actorUserId: string;
  metadata: Record<string, unknown>;
};

export type PaginatedWalletTransactions = Paginated<WalletTransaction>;
