import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Informe o nome' })
  @MinLength(1, { message: 'Informe o nome' })
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Informe um email válido' })
  email: string;

  @IsString({ message: 'Informe a senha' })
  @MinLength(6, { message: 'A senha precisa de 6 caracteres' })
  password: string;
}