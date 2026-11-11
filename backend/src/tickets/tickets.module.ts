import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { TicketsController } from './tickets.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ArticlesModule } from '../articles/articles.module.js';

@Module({
  imports: [PrismaModule, ArticlesModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
