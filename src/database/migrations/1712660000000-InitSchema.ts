import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1712660000000 implements MigrationInterface {
  name = 'InitSchema1712660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `users` (`id` char(36) NOT NULL, `email` varchar(255) NOT NULL, `full_name` varchar(120) NOT NULL, `password_hash` varchar(255) NOT NULL, `role` enum ('admin', 'user') NOT NULL DEFAULT 'user', `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_users_email` (`email`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      "CREATE TABLE `wallets` (`id` char(36) NOT NULL, `user_id` char(36) NOT NULL, `balance` decimal(18,2) NOT NULL DEFAULT '0.00', `currency` varchar(3) NOT NULL DEFAULT 'NGN', `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_wallets_user_id` (`user_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      "CREATE TABLE `transactions` (`id` char(36) NOT NULL, `reference` varchar(64) NOT NULL, `wallet_id` char(36) NOT NULL, `type` enum ('credit', 'debit') NOT NULL, `amount` decimal(18,2) NOT NULL, `balance_before` decimal(18,2) NOT NULL, `balance_after` decimal(18,2) NOT NULL, `status` enum ('pending', 'success', 'failed') NOT NULL DEFAULT 'pending', `idempotency_key` varchar(128) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_transactions_reference` (`reference`), INDEX `IDX_transactions_wallet_id` (`wallet_id`), UNIQUE INDEX `IDX_transactions_idempotency_key` (`idempotency_key`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'CREATE TABLE `audit_logs` (`id` char(36) NOT NULL, `actor_user_id` char(36) NULL, `action` varchar(100) NOT NULL, `metadata` json NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `wallets` ADD CONSTRAINT `FK_wallets_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `transactions` ADD CONSTRAINT `FK_transactions_wallets` FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `transactions` DROP FOREIGN KEY `FK_transactions_wallets`',
    );
    await queryRunner.query(
      'ALTER TABLE `wallets` DROP FOREIGN KEY `FK_wallets_users`',
    );
    await queryRunner.query('DROP TABLE `audit_logs`');
    await queryRunner.query('DROP TABLE `transactions`');
    await queryRunner.query('DROP TABLE `wallets`');
    await queryRunner.query('DROP TABLE `users`');
  }
}
