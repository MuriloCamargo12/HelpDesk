import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import bcrypt from "bcryptjs";
import { BadRequestException, Injectable } from "@nestjs/common";
import { LoginDto } from "./dto/login.dto.js";
import { Role } from "../generated/prisma/enums.js";


@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService
    ) { }

    private publicUser(user: {
        id: number;
        name: string;
        email: string;
        role: string;
    }) {
        return { id: user.id, name: user.name, email: user.email, role: user.role };
    }

    private secret() {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new BadRequestException('Falta JWT_SECRET no .env')
        }
        return secret;
    }

    async userFromHeader(header?: string) {
        if (!header?.startsWith("Bearer ")) {
            return null;
        }

        const token = header.slice("Bearer ".length);

        try {
            const payload = await this.jwt.verifyAsync<{ sub: number; role: string }>(
                token,
                { secret: this.secret() },
            );

            const id = Number(payload.sub);
            if (!Number.isInteger(id) || typeof payload.role !== "string") {
                return null;
            }

            return { id, role: payload.role };
        } catch {
            return null;
        }
    }

    async register(input: RegisterDto) {
        const passwordHash = await bcrypt.hash(input.password, 10);

        try {
            const user = await this.prisma.user.create({
                data: {
                    name: input.name,
                    email: input.email,
                    passwordHash,
                    role: Role.CLIENTE
                },
            });
            return this.publicUser(user);
        } catch {
            throw new BadRequestException('Este email já está cadastrado')
        }
    }

    async login(input: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: input.email },
        });

        const match = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

        if (!match || !user) {
            throw new BadRequestException('Email ou senha inválidos')
        }

        const token = await this.jwt.signAsync(
            { sub: user.id, role: user.role },
            { secret: this.secret(), expiresIn: '7d' }
        )
        return { token, user: this.publicUser(user) }
    }
}