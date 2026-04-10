import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { StringValue } from 'ms';
import { DataSource } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { User } from '../users/user.entity';
import { UsersRepository } from '../users/users.repository';
import { Wallet } from '../wallet/wallet.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'access-secret';
    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'refresh-secret';
    this.accessTtl = this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtl = this.configService.get<string>('JWT_REFRESH_TTL') ?? '7d';
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log(`Register attempt for email=${dto.email}`);
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      this.logger.warn(`Register blocked: email exists email=${dto.email}`);
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.dataSource.transaction(async (manager) => {
      const createdUser = manager.create(User, {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        role: UserRole.USER,
      });
      const savedUser = await manager.save(User, createdUser);
      const wallet = manager.create(Wallet, {
        userId: savedUser.id,
        balance: '0.00',
        currency: 'NGN',
      });
      await manager.save(Wallet, wallet);
      return savedUser;
    });
    this.logger.log(`User registered userId=${user.id}`);
    return this.generateTokenPair(user);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log(`Login attempt for email=${dto.email}`);
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      this.logger.warn(`Login failed: user not found email=${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      this.logger.warn(`Login failed: bad credentials email=${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Login successful userId=${user.id}`);
    return this.generateTokenPair(user);
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(
      refreshToken,
      {
        secret: this.refreshSecret,
      },
    );
    if (payload.tokenType !== 'refresh') {
      this.logger.warn(`Refresh failed: tokenType mismatch sub=${payload.sub}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepository.findById(payload.sub);
    if (!user) {
      this.logger.warn(`Refresh failed: user not found sub=${payload.sub}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.logger.log(`Refresh successful userId=${user.id}`);
    return this.generateTokenPair(user);
  }

  private async generateTokenPair(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const basePayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    } as const;
    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, tokenType: 'access' },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtl as StringValue,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, tokenType: 'refresh' },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl as StringValue,
      },
    );
    return { accessToken, refreshToken };
  }
}
