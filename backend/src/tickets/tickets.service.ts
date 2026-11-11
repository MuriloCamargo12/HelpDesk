import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TicketStatus } from '../generated/prisma/enums.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) { }

  create(input: CreateTicketDto) {
    const subject = input.subject?.trim();
    const message = input.message?.trim();

    if (!subject || !message) {
      throw new BadRequestException("Informe o assunto e a mensagem da solicitação");
    }

    return this.prisma.ticket.create({
      data: {
        subject,
        messages: { create: { body: message, author: "cliente"}},
      },
      include: {
        messages: true,
      },
    })

  }

  async findAll() {
    return await this.prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      include: { messages: true },
    })
  }

  async findOne(id: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if(!ticket) {
      throw new NotFoundException("Chamado não encontrado")
    }

    return ticket;
  }

  async addMessage(id: number, message: string) {
    const ticket = await this.findOne(id);
    const body = message?.trim();
    if (!body) {
      throw new BadRequestException("Informe a message");
    }
    await this.prisma.message.create({
      data: { body, author: "cliente", ticketId: id },
    });
    if (ticket.status !== TicketStatus.AGUARDANDO_CLIENTE) {
      return this.findOne(id);
    }
    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.EM_ATENDIMENTO },
      include: { messages: true },
    });
  }

  async assume(id: number) {
    const ticket = await this.findOne(id);

    if(ticket.status !== TicketStatus.NOVO) {
      throw new BadRequestException("Só um chamado novo pode ser assumido")
    }

    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.EM_ATENDIMENTO },
      include: { messages: true },
    })
  }

  async resolve(id: number) {
    const ticket = await this.findOne(id);

    if (
      ticket.status !== TicketStatus.EM_ATENDIMENTO &&
      ticket.status !== TicketStatus.AGUARDANDO_CLIENTE
    ) {
      throw new BadRequestException("Esse chamado não pode ser resolvido agora");
    }

    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.RESOLVIDO },
      include: { messages: true },
    })
  }

  async reply(id: number, message: string) {
    const ticket = await this.findOne(id);
    if(ticket.status !== TicketStatus.EM_ATENDIMENTO) {
      throw new BadRequestException("Só um chamado em atendimento pode ser respondido")
    }

    const body = message?.trim();
    if(!body) {
      throw new BadRequestException("Informe a mensagem")
    }

    await this.prisma.message.create({
      data: { body, author: "atendente", ticketId: id },
    });
    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.AGUARDANDO_CLIENTE },
      include: { messages: true },
    });
  }
}
