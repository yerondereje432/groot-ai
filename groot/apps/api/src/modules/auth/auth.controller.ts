import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service.js';

class RegisterDto {
  @IsString() @MinLength(8) phone!: string;
  @IsString() @MinLength(2) fullName!: string;
  @IsOptional() @IsString() inviteCode?: string;
  @IsOptional() @IsString() role?: 'student' | 'teacher';
}

class VerifyOtpDto {
  @IsString() challengeId!: string;
  @IsString() @MinLength(4) code!: string;
  // Profile replayed so verifyOtp can create the user.
  @IsString() phone!: string;
  @IsString() fullName!: string;
  @IsOptional() @IsString() role?: 'student' | 'teacher';
}

class RefreshDto {
  @IsString() refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(200)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.challengeId, dto.code, {
      phone: dto.phone,
      fullName: dto.fullName,
      role: dto.role,
    });
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
