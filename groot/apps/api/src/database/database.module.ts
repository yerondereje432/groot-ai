import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const PRISMA = Symbol('PRISMA_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: () => new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      }),
    },
  ],
  exports: [PRISMA],
})
export class DatabaseModule {
  /** Convenience re-export so consumers can inject by string. */
  static readonly PRISMA = PRISMA;
}
