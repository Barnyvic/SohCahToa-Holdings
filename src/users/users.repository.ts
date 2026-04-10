import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly userOrmRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userOrmRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userOrmRepository.findOne({ where: { id } });
  }
}
