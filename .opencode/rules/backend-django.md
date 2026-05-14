# Backend-Django Rules (Prisma/NestJS)

*Note: This project uses NestJS + Prisma. Adapt these Django rules accordingly.*

## Database (Prisma)
- Use **migrations** for all schema changes, NEVER `synchronize: true`
- Custom repositories for complex queries
- Use transactions for multi-step operations
- Avoid N+1 queries — use `include` for eager loading

## Configuration
- Use `@nestjs/config` with `ConfigModule.forRoot()`
- Validate env vars at startup via `class-validator` (see `src/config/env.validation.ts`)
- No `process.env` access outside config module

## Async Operations
- Always handle async errors with `.catch()`
- Use `async/await` consistently
- Return promises from lifecycle hooks (`onModuleInit`)

## Error Handling
- Throw `HttpException` subclasses from services
- Use global exception filters for consistent responses
- Never catch and swallow errors silently

## Performance
- Select only needed columns (`select: ['email']`)
- Add indexes on frequently queried columns
- Implement caching for expensive operations
- Paginate large datasets

## Graceful Shutdown
- Enable `app.enableShutdownHooks()`
- Handle `SIGTERM`/`SIGINT` for zero-downtime deployments
- Wait for in-flight requests before closing