import { Transform } from "class-transformer";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLocaleLowerCase() : value))
    @IsEmail({}, { message: 'Informe um email válido'})
    email: string;

    @IsString({ message: 'Informe a senha'})
    @MinLength(6, { message: 'A senha precisa ter no mínimo 6 caracteres'})
    password: string;
}