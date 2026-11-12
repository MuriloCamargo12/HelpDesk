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

    async create(input: CreateTicketDto) {
      const subject = input.subject?.trim();
      const message = input.message?.trim();
      if (!subject || !message) {
        throw new BadRequestException("Informe o assunto e a mensagem da solicitação");
      }
      const ticket = await this.prisma.ticket.create({
        data: {
          subject,
          status: TicketStatus.COM_IA,
          messages: { create: { body: message, author: "cliente" } },
        },
        include: { messages: true },
      });
      let draft = "Não sei responder com a base publicada.";
      try {
        draft = await this.draftFor(ticket.subject, ticket.messages);
      } catch {
        draft = "Não sei responder com a base publicada.";
      }
      if (draft === "Não sei responder com a base publicada.") {
        return this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: TicketStatus.NA_FILA },
          include: { messages: true },
        });
      }
      await this.prisma.message.create({
        data: { body: draft, author: "ia", ticketId: ticket.id },
      });
      return this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.AGUARDANDO_CLIENTE },
        include: { messages: true },
      });
    }

  async findAll() {
    return await this.prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      include: { messages: true },
    })
  }

  async metrics() {
    const tickets = await this.findAll();
  
    const open = tickets.filter(
      (ticket) => ticket.status !== TicketStatus.RESOLVIDO,
    ).length;
  
    const answeredByAi = tickets.filter((ticket) => {
      const hasAi = ticket.messages.some((message) => message.author === "ia");
      const hasPerson = ticket.messages.some(
        (message) => message.author === "atendente",
      );
      return hasAi && !hasPerson;
    }).length;
  
    const handledByPerson = tickets.filter((ticket) =>
      ticket.messages.some((message) => message.author === "atendente"),
    ).length;
  
    return { open, answeredByAi, handledByPerson };
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

    if (
      ticket.status !== TicketStatus.NOVO &&
      ticket.status !== TicketStatus.NA_FILA
    ) {
      throw new BadRequestException("Só um chamado novo ou na fila pode ser assumido");
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
      throw new BadRequestException("Só um chamado em atendimento pode ser sugerido");
    }
    const draft = await this.draftFor(ticket.subject, ticket.messages);
    return { draft };
  }

  private async draftFor(
    subject: string,
    messages: { author: string; body: string }[],
  ) {
    const articles = await this.articlesService.findAll();
    if (articles.length === 0) {
      return "Não sei responder com a base publicada.";
    }
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new BadRequestException("Falta a chave OPENAI_API_KEY no .env");
    }
    const history = messages
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
      `Assunto: ${subject}`,
      "Conversa:",
      history,
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const failure = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const detail = failure?.error?.message;
      throw new BadRequestException(
        detail || `A OpenAI respondeu ${response.status}.`,
      );
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const draft = payload.choices?.[0]?.message?.content?.trim();
    if (!draft) {
      throw new BadRequestException("A OpenAI não devolveu texto.");
    }
    return draft;
  }
}
