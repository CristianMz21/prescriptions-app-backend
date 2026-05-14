/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hash } from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new user with enterprise-grade password hashing.
   */
  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    // 1. Enforce minimum of 10 salt rounds for bcrypt
    const saltRounds = 10;

    // 2. Hash the plain-text password before it ever touches the database
    const hashedPassword = await hash(createUserDto.password, saltRounds);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          passwordHash: hashedPassword,
          role: createUserDto.role,
        },
      });
      return new UserEntity(user);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  /**
   * Internal Use Only: Fetches a user by email for the Auth workflow.
   * This method intentionally returns the raw Prisma object (including passwordHash)
   * because AuthService needs the hash to perform bcrypt.compare().
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Public/Profile Use: Fetches a user by ID.
   * Crucially returns an instantiated UserEntity. When this hits a controller
   * using ClassSerializerInterceptor, the passwordHash is automatically stripped.
   */
  async findById(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return new UserEntity(user);
  }

  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany();
    return users.map(user => new UserEntity(user));
  }

  /**
   * Directory Use: Lists users by role, instantiated as secure UserEntities.
   */
  async findAllByRole(role: Role): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: { role },
    });

    return users.map(user => new UserEntity(user));
  }
}
