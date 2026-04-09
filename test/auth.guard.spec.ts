import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

@Controller('guard-test')
class GuardTestController {
  @UseGuards(JwtAuthGuard)
  @Get()
  getProtected(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({
  imports: [JwtModule.register({})],
  controllers: [GuardTestController],
  providers: [JwtStrategy],
})
class GuardTestModule {}

describe('JwtAuthGuard', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    const moduleRef = await Test.createTestingModule({
      imports: [GuardTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects request without token', async () => {
    await request(server).get('/guard-test').expect(401);
  });

  it('rejects request with invalid token', async () => {
    await request(server)
      .get('/guard-test')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('allows request with valid token', async () => {
    const token = await jwtService.signAsync(
      {
        sub: 'user-1',
        email: 'guard@test.com',
        role: 'user',
        tokenType: 'access',
      },
      { secret: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret' },
    );

    await request(server)
      .get('/guard-test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
