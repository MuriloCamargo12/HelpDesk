import { IsString, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString({ message: 'Informe o título' })
  @MinLength(1, { message: 'Informe o título' })
  title: string;

  @IsString({ message: 'Informe o texto' })
  @MinLength(1, { message: 'Informe o texto' })
  body: string;
}
