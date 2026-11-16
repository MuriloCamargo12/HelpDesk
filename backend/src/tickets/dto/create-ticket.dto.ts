import { IsString, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString({ message: 'Informe o assunto' })
  @MinLength(1, { message: 'Informe o assunto' })
  subject: string;

  @IsString({ message: 'Informe a mensagem' })
  @MinLength(1, { message: 'Informe a mensagem' })
  message: string;
}
