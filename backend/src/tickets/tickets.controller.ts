import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) { }

  @Post()
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Post(':id/messages')
  addMessage(@Param('id') id: string, @Body() body: { message?: string }) {
    return this.ticketsService.addMessage(+id, body.message ?? "");
  }

  @Post(':id/assume')
  assume(@Param('id') id: string) {
    return this.ticketsService.assume(+id);
  }
  @Post(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.ticketsService.resolve(+id);
  }

  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() body: { message?: string }) {
    return this.ticketsService.reply(+id, body.message ?? '');
  }

  @Post(':id/suggest')
  suggest(@Param('id') id: string) {
    return this.ticketsService.suggest(+id);
  }

  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }

}
