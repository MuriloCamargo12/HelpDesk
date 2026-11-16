import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly authService: AuthService,
  ) { }

  @Post()
  async create(
    @Body() createTicketDto: CreateTicketDto,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    if (!user) {
      throw new UnauthorizedException('Faça login para abrir um chamado');
    }
    return this.ticketsService.create(createTicketDto, user.id);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() body: { message?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    return this.ticketsService.addMessage(+id, body.message ?? '', user);
  }

  @Post(':id/assume')
  async assume(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    return this.ticketsService.assume(+id, user);
  }

  @Post(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    return this.ticketsService.resolve(+id, user);
  }

  @Post(':id/reply')
  async reply(
    @Param('id') id: string,
    @Body() body: { message?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    return this.ticketsService.reply(+id, body.message ?? '', user);
  }

  @Post(':id/suggest')
  async suggest(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    return this.ticketsService.suggest(+id, user);
  }

  @Get('metrics')
  async metrics(@Headers('authorization') authorization?: string) {
    const user = await this.authService.userFromHeader(authorization);
    this.ticketsService.atendenteDe(user);
    return this.ticketsService.metrics();
  }

  @Get()
  async findAll(@Headers('authorization') authorization?: string) {
    const user = await this.authService.userFromHeader(authorization);
    if (!user) {
      throw new UnauthorizedException('Faça login para ver os chamados');
    }
    return this.ticketsService.findAll(user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user = await this.authService.userFromHeader(authorization);
    if (!user) {
      throw new UnauthorizedException('Faça login para ver o chamado');
    }
    return this.ticketsService.findOne(+id, user);
  }
}
