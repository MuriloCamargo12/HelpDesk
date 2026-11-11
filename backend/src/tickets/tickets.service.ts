import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TicketStatus } from '../generated/prisma/enums.js';
import { ArticlesService } from '../articles/articles.service.js';

@Injectable()
export class TicketsService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly prisma: PrismaService) { }

  create(input: CreateTicketDto) {
    const subject = input.subject?.trim();
    const message = input.message?.trim();

    if (!subject || !message) {
      throw new BadRequestException("Informe o assunto e a mensagem da solicitação");
    }

    return this.prisma.ticket.create({
      data: {
        subject,
        messages: { create: { body: message, author: "cliente" } },
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

    if (!ticket) {
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

    if (ticket.status !== TicketStatus.NOVO) {
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
    if (ticket.status !== TicketStatus.EM_ATENDIMENTO) {
      throw new BadRequestException("Só um chamado em atendimento pode ser respondido")
    }

    const body = message?.trim();
    if (!body) {
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
  async suggest(id: number) {
    const ticket = await this.findOne(id);
    if (ticket.status !== TicketStatus.EM_ATENDIMENTO) {
      throw new BadRequestException("Só um chamado em atendimento pode ser sugerido")
    }

    const articles = await this.articlesService.findAll();
    if (articles.length === 0) {
      return { draft: "Não há artigo publicado para responder este chamado." }
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("Erro na chave da API do Gemini.")
    }

    const history = ticket.messages
      .map((message) => `${message.author}: ${message.body}`)
      .join("\n");
    const knowledge = articles
      .map((article) => `${article.title}\n${article.body}`)
      .join("\n");

    const prompt = [
      "Você é o atendente de um helpdesk.",
      "Responda em português, em um parágrafo curto, usando somente os artigos abaixo.",
      "Se nenhum artigo responder, responda exatamente: Não sei responder com a base publicada.",
      "",
      "Artigos:",
      knowledge,
      "",
      `Assunto: ${ticket.subject}`,
      "Conversa:",
      history,
    ].join("\n");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!response.ok) {
      throw new Error("O Gemini não respondeu corretamente.")
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const draft = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!draft) {
      throw new BadRequestException("O Gemini não devolveu texto.");
    }
    return { draft };
  }
}
