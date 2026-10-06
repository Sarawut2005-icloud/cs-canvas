import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionsModule } from './sessions/sessions.module';
import { JwksController } from './jwks.controller';
import { SsoService } from './sso.service';
import { SubsystemsModule } from '../subsystems/subsystems.module';
import { MjuSsoService } from './mju-sso/mju-sso.service';

@Module({
  imports: [
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const privateKeyPath =
          configService.get<string>('jwt.privateKeyPath') ??
          'keys/jwt-private.pem';

        const publicKeyPath =
          configService.get<string>('jwt.publicKeyPath') ??
          'keys/jwt-public.pem';

        const privateKey = readFileSync(privateKeyPath, 'utf8');
        const publicKey = readFileSync(publicKeyPath, 'utf8');

        const expiresIn = configService.get<string>('jwt.expiresIn') ?? '15m';

        return {
          privateKey,
          publicKey,

          signOptions: {
            algorithm: 'RS256',
            expiresIn:
              expiresIn as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`,
          },
        };
      },
    }),

    UsersModule,
    SessionsModule,
    SubsystemsModule,
  ],

  controllers: [AuthController, JwksController],

  providers: [AuthService, JwtStrategy, SsoService, MjuSsoService],
})
export class AuthModule {}
