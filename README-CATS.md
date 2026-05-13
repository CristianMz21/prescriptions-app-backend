# 🐈 Endava CATS Security Fuzzing

To aggressively test our validation rules and RBAC layer, we use the Endava CATS fuzzer. Because our API enforces strict `HttpOnly` cookies, you must extract a valid token before running the test suite.

## Execution Steps

**1. Boot the NestJS Backend**
Ensure your local backend and database are running:
```bash
npm run start:dev
```

**2. Extract the Secure Cookie**
Use `curl` to authenticate as a DOCTOR (or PATIENT) and extract the raw `Set-Cookie` header. The `-i` flag forces `curl` to print the response headers.
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor@clinic.com","password":"***REDACTED-DEV-PASSWORD***"}' | grep "set-cookie: accessToken="
```
*Copy the JWT string (everything after `accessToken=` and before the first `;`).*

**3. Inject the Token**
Open `cats-headers.yml` in the root directory and paste your token:
```yaml
all:
  Cookie: "accessToken=YOUR_COPIED_JWT_STRING"
```

**4. Run the Fuzzer**
Execute the Docker script to launch CATS. It is pre-configured to target the `Validation` and `Security` fuzzers for high-ROI testing.
```bash
chmod +x scripts/run-cats.sh
./scripts/run-cats.sh
```

**5. Review the Report**
Open the generated HTML report in your browser:
```bash
open cats-report/index.html
```