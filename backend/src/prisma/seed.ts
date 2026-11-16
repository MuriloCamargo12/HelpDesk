import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { Role } from "../generated/prisma/enums.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL ?? ""),
});

async function main() {
  const passwordHash = await bcrypt.hash("atendente123", 10);

  await prisma.user.upsert({
    where: { email: "atendente@helpdesk.local" },
    update: {
      name: "Atendente",
      passwordHash,
      role: Role.ATENDENTE,
    },
    create: {
      name: "Atendente",
      email: "atendente@helpdesk.local",
      passwordHash,
      role: Role.ATENDENTE,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });