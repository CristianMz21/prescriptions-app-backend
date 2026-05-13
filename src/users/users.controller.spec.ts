import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUsers = [
    { id: '1', email: 'p1@c.com', role: Role.PATIENT },
    { id: '2', email: 'p2@c.com', role: Role.PATIENT },
  ];

  beforeEach(async () => {
    const mockUsersService = {
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
    it('should return a list of patients', async () => {
      usersService.findAllByRole.mockResolvedValue(mockUsers as any);
      const result = await controller.findAllPatients();
      expect(usersService.findAllByRole).toHaveBeenCalledWith(Role.PATIENT);
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findAllDoctors', () => {
    it('should return a list of doctors', async () => {
      usersService.findAllByRole.mockResolvedValue(mockUsers as any);
      const result = await controller.findAllDoctors();
      expect(usersService.findAllByRole).toHaveBeenCalledWith(Role.DOCTOR);
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      usersService.findById.mockResolvedValue(mockUsers[0] as any);
      const result = await controller.findOne('1');
      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockUsers[0]);
    });
  });
});
