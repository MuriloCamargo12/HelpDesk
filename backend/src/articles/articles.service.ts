import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateArticleDto) {
    const title = input.title?.trim();
    const body = input.body?.trim();

    if(!title || !body) {
      throw new BadRequestException("Informe o título e o texto do artigo")
    }

    return this.prisma.article.create({
      data: { title, body}
    })
  }

  findAll(includeHidden = false) {
    return this.prisma.article.findMany({
      where: includeHidden ? undefined : { published: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unpublish(id: number) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if(!article) {
      throw new NotFoundException("Artigo não encontrado.")
    }

    return this.prisma.article.update({
      where: { id },
      data: { published: false },
    })
  }

  async publish(id: number) {
    await this.findOne(id);
    return this.prisma.article.update({
      where: { id },
      data: { published: true },
    })
  }

  async findOne(id: number) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if(!article) {
      throw new NotFoundException("Artigo não encontrado.")
    }
    return article;
  }

  async update(id: number, input: UpdateArticleDto) {
    await this.findOne(id);

    const data: { title?: string; body?: string } = {};

    if(input.title !== undefined) {
      const title = input.title.trim();
      if(!title) {
        throw new BadRequestException("Informe o título do artigo.")
      }
      data.title = title;
    }

    if(input.body !== undefined) {
      const body = input.body.trim();
      if(!body) {
        throw new BadRequestException("Informe o texto do artigo.")
      }
      data.body = body;
    }

    if(!data.title && !data.body) {
      throw new BadRequestException("Informe o título ou o texto do artigo.")
    }

    return this.prisma.article.update({
      where: { id },
      data,
    })
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.article.delete({ where: { id } });
    return { id };
  }
}
