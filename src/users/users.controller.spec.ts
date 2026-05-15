import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';
import { Role, ThemePreference } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const makeUser = (id: string, email: string, role: Role): UserEntity =>
    new UserEntity({
      id,
      email,
      name: `User ${id}`,
      phone: null,
      passwordHash: 'irrelevant-in-tests',
      role,
      themePreference: ThemePreference.SYSTEM,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

  const mockUsers: UserEntity[] = [
    makeUser('1', 'p1@c.com', Role.PATIENT),
    makeUser('2', 'p2@c.com', Role.PATIENT),
  ];

  const paginated = (data: UserEntity[]) => ({
    data,
    meta: { page: 1, limit: 10, total: data.length, totalPages: 1 },
  });

  beforeEach(async () => {
    const mockUsersService = {
      findAll: jest.fn(),
      findAllByRole: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllPatients', () => {
    it('should return a paginated list of patients', async () => {
      const expected = paginated(mockUsers);
      usersService.findAllByRole.mockResolvedValue(expected);

      const result = await controller.findAllPatients({});

      expect(usersService.findAllByRole).toHaveBeenCalledWith(Role.PATIENT, {});
      expect(result).toEqual(expected);
    });
  });

  describe('findAllDoctors', () => {
    it('should return a paginated list of doctors', async () => {
      const doctors = [makeUser('3', 'd1@c.com', Role.DOCTOR)];
      const expected = paginated(doctors);
      usersService.findAllByRole.mockResolvedValue(expected);

      const result = await controller.findAllDoctors({});

      expect(usersService.findAllByRole).toHaveBeenCalledWith(Role.DOCTOR, {});
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      usersService.findById.mockResolvedValue(mockUsers[0]);

      const result = await controller.findOne('1');

      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockUsers[0]);
    });
  });
});
