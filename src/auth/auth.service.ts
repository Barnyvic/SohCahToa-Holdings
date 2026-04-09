import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { StringValue } from 'ms';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
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
    const existing = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: dto.email })
      .getOne();
    if (existing) {
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
    return this.generateTokenPair(user);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');

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
    if (payload.tokenType !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token');

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException('Invalid refresh token');
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
