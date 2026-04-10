import { Injectable, Logger } from '@nestjs/common';
import { User } from './user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Finding user by email=${email}`);
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    this.logger.debug(`Finding user by id=${id}`);
    return this.usersRepository.findById(id);
  }
}
