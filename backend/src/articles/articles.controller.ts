import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ArticlesService } from './articles.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { Role } from '../generated/prisma/enums.js';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly authService: AuthService,
  ) {}

  private async atendenteDe(authorization?: string) {
    const user = await this.authService.userFromHeader(authorization);
    if (!user) {
      throw new UnauthorizedException('Faça login');
    }
    if (user.role !== Role.ATENDENTE) {
      throw new ForbiddenException('Só um atendente pode fazer isso');
    }
    return user;
  }

  @Post()
  async create(
    @Body() createArticleDto: CreateArticleDto,
    @Headers('authorization') authorization?: string,
  ) {
    await this.atendenteDe(authorization);
    return this.articlesService.create(createArticleDto);
  }

  @Get()
  async findAll(
    @Query('all') all?: string,
    @Headers('authorization') authorization?: string,
  ) {
    if (all === '1') {
      await this.atendenteDe(authorization);
    }
    return this.articlesService.findAll(all === '1');
  }

  @Post(':id/unpublish')
  async unpublish(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.atendenteDe(authorization);
    return this.articlesService.unpublish(+id);
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.atendenteDe(authorization);
    return this.articlesService.publish(+id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.atendenteDe(authorization);
    return this.articlesService.findOne(+id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @Headers('authorization') authorization?: string,
  ) {
    await this.atendenteDe(authorization);
    return this.articlesService.update(+id, updateArticleDto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.atendenteDe(authorization);
    return this.articlesService.remove(+id);
  }
}
