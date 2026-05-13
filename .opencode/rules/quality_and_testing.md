# Quality & Testing Rules

## Unit Tests
- Use `@nestjs/testing` with `Test.createTestingModule()`
- Mock external dependencies (HTTP, database, queues)
- Test services in isolation, not implementation details

## E2E Tests
- Use **Supertest** for HTTP-level tests
- Proper `beforeAll`/`afterAll` setup/teardown
- Isolate database between tests (clean slate per test)

## Test Structure
```
describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: mockRepo },
      ],
    }).compile();
    service = module.get(UsersService);
  });
});
```

## Mocking Rules
- NEVER call real external services in tests
- Create realistic mock data
- Test error scenarios (timeouts, 429, 500)

## Coverage
- Aim for meaningful coverage, not arbitrary %
- Critical paths (auth, payments) require high coverage
- NO `@ts-ignore` or `as any` in test assertions