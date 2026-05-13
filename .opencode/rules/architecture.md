# Architecture Rules — NestJS Backend

## Modularity
- Organize by **feature modules**, not technical layer
- Each feature = self-contained module with controllers, services, entities, DTOs
- Avoid "god services" — single responsibility per service

## Dependency Injection
- Use **constructor injection** over property injection
- Avoid `ModuleRef.get()` service locator pattern
- Use injection tokens (`Symbol`) for interfaces
- Understand provider scopes: DEFAULT (singleton), REQUEST, TRANSIENT

## Data Access
- Use **repository pattern** for database logic abstraction
- Custom repositories encapsulate complex queries
- Never expose raw Prisma queries in controllers

## Event-Driven
- Use `@nestjs/event-emitter` for intra-service decoupling
- Define explicit event classes (`OrderCreatedEvent`)
- Event handlers in separate modules

## Circular Dependencies
- NEVER allow circular module dependencies
- Extract shared logic to a third module or use events
- Use `forwardRef()` only as last resort

## API Boundaries
- Return DTOs/responses, never entity objects directly
- Use `class-transformer` `@Exclude()` for sensitive fields
- Versioning for breaking changes (`@Version('1')`)