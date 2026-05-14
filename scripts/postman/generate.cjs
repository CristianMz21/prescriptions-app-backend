/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const converter = require('openapi-to-postmanv2');

const root = process.cwd();
const openapiPath = path.join(root, 'openapi.json');
const postmanDir = path.join(root, 'postman');
const collectionPath = path.join(
  postmanDir,
  'prescription-api.postman_collection.json',
);
const localEnvPath = path.join(
  postmanDir,
  'prescription-api.local.postman_environment.json',
);
const ciEnvPath = path.join(
  postmanDir,
  'prescription-api.ci.postman_environment.json',
);

const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));

function convertOpenApi() {
  return new Promise((resolve, reject) => {
    converter.convert(
      { type: 'file', data: openapiPath },
      {
        folderStrategy: 'Tags',
        requestNameSource: 'operationId',
        includeAuthInfoInExample: false,
        schemaFaker: false,
        indentCharacter: 'Space',
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result.result)
          return reject(
            new Error(result.reason || 'OpenAPI conversion failed'),
          );
        resolve(result.output[0].data);
      },
    );
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveRef(ref) {
  const parts = ref.replace(/^#\//, '').split('/');
  let current = spec;
  for (const part of parts) current = current[part];
  return current;
}

function mergeAllOf(schema) {
  if (schema.allOf.length === 1) return normalizeSchema(schema.allOf[0]);
  const merged = { type: 'object', properties: {}, required: [] };
  for (const part of schema.allOf) {
    const normalized = normalizeSchema(part);
    Object.assign(merged.properties, normalized.properties || {});
    if (normalized.required) merged.required.push(...normalized.required);
    for (const [key, value] of Object.entries(normalized)) {
      if (!['properties', 'required', 'type'].includes(key))
        merged[key] = value;
    }
  }
  merged.required = [...new Set(merged.required)];
  return merged;
}

function normalizeSchema(schema) {
  if (!schema) return {};
  if (schema.$ref) return normalizeSchema(resolveRef(schema.$ref));
  if (schema.allOf) {
    const merged = mergeAllOf(schema);
    if (schema.nullable) {
      merged.type = merged.type ? [merged.type, 'null'] : ['object', 'null'];
    }
    return merged;
  }
  const out = clone(schema);
  delete out.example;
  delete out.description;
  if (out.nullable) {
    out.type = out.type ? [out.type, 'null'] : ['object', 'null'];
    delete out.nullable;
  }
  if (out.properties) {
    for (const [key, value] of Object.entries(out.properties))
      out.properties[key] = normalizeSchema(value);
  }
  if (out.items) out.items = normalizeSchema(out.items);
  if (
    out.additionalProperties &&
    typeof out.additionalProperties === 'object'
  ) {
    out.additionalProperties = normalizeSchema(out.additionalProperties);
  }
  return out;
}

function successResponse(op) {
  for (const status of ['200', '201', '204']) {
    if (op.responses && op.responses[status])
      return { status, response: op.responses[status] };
  }
  return null;
}

function jsonSchemaFor(op) {
  const success = successResponse(op);
  const schema = success?.response?.content?.['application/json']?.schema;
  return schema ? normalizeSchema(schema) : null;
}

function operations() {
  const rows = [];
  for (const [route, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      rows.push({ route, method: method.toUpperCase(), op });
    }
  }
  return rows;
}

function urlFor(route, opId) {
  const replacements = {
    UsersController_findOne: '{{adminUserId}}',
    PrescriptionsController_findOne: '{{prescriptionId}}',
    PrescriptionsController_markAsConsumed: '{{prescriptionId}}',
    PrescriptionsController_downloadPdf: '{{prescriptionId}}',
  };
  const replaced = route.replace(
    /\{id\}/g,
    replacements[opId] || '{{resourceId}}',
  );
  return `{{baseUrl}}${replaced}`;
}

function queryFor(opId) {
  const defaults = {
    UsersController_findAll: [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ],
    UsersController_findAllPatients: [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ],
    UsersController_findAllDoctors: [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ],
    PrescriptionsController_findAll: [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ],
    AdminController_listPrescriptions: [
      { key: 'page', value: '1' },
      { key: 'limit', value: '10' },
    ],
    AdminController_getMetrics: [],
    AdminController_streamMetrics: [{ key: 'once', value: 'true' }],
  };
  return defaults[opId] || [];
}

function bodyFor(opId) {
  const bodies = {
    AuthController_login: {
      email: '{{adminEmail}}',
      password: '{{seedPassword}}',
    },
    UsersController_create: {
      email: 'qa-created-patient-{{$guid}}@clinic.com',
      password: '{{seedPassword}}',
      role: 'PATIENT',
      birthDate: '1990-05-21',
    },
    UsersController_updateMyTheme: { themePreference: 'DARK' },
    PrescriptionsController_create: {
      patientId: '{{patientId}}',
      items: [
        {
          name: 'QA Amoxicillin {{$timestamp}}',
          dosage: '500mg',
          quantity: 21,
          instructions: 'Take 1 pill every 8 hours for 7 days',
        },
      ],
      notes: 'Postman/Newman generated E2E prescription',
    },
    PrescriptionsController_markAsConsumed: {
      reason: 'Consumed by Postman/Newman E2E flow',
    },
  };
  return bodies[opId];
}

function roleFor(opId) {
  if (opId === 'AppController_getHello' || opId === 'AuthController_login')
    return null;
  if (opId === 'AuthController_refresh') return 'ADMIN_REFRESH_ONLY';
  if (opId.startsWith('AdminController_')) return 'ADMIN';
  if (
    opId === 'UsersController_create' ||
    opId === 'UsersController_findAll' ||
    opId === 'UsersController_findAllDoctors' ||
    opId === 'UsersController_findOne'
  )
    return 'ADMIN';
  if (opId === 'UsersController_findAllPatients') return 'DOCTOR';
  if (opId === 'PrescriptionsController_create') return 'DOCTOR';
  if (opId === 'PrescriptionsController_markAsConsumed') return 'PATIENT';
  if (opId.startsWith('PrescriptionsController_')) return 'PATIENT';
  return 'ADMIN';
}

function requestFor(row) {
  const opId = row.op.operationId;
  const headers = [
    {
      key: 'Accept',
      value:
        opId === 'AdminController_streamMetrics'
          ? 'text/event-stream'
          : 'application/json',
    },
  ];
  const body = bodyFor(opId);
  if (body) headers.push({ key: 'Content-Type', value: 'application/json' });

  const query = queryFor(opId);
  const queryString =
    query.length > 0
      ? `?${query.map(q => `${q.key}=${q.value}`).join('&')}`
      : '';
  const req = {
    method: row.method,
    header: headers,
    url: `${urlFor(row.route, opId)}${queryString}`,
  };
  if (body)
    req.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
  return req;
}

function preRequestScript(role) {
  if (!role) return [];
  if (role === 'NO_AUTH')
    return ["pm.request.headers.upsert({ key: 'Cookie', value: '' });"];
  if (role === 'ADMIN_REFRESH_ONLY') {
    return [
      "const refreshToken = pm.environment.get('adminRefreshToken');",
      "if (refreshToken) pm.request.headers.upsert({ key: 'Cookie', value: `refreshToken=${refreshToken}` });",
    ];
  }
  return [
    `const role = '${role.toLowerCase()}';`,
    'const accessToken = pm.environment.get(`${role}AccessToken`);',
    'const refreshToken = pm.environment.get(`${role}RefreshToken`);',
    'const csrfToken = pm.environment.get(`${role}CsrfToken`);',
    "let cookie = accessToken ? `accessToken=${accessToken}` : '';",
    "if (refreshToken) cookie += `${cookie ? '; ' : ''}refreshToken=${refreshToken}`;",
    "if (csrfToken) cookie += `${cookie ? '; ' : ''}csrfToken=${csrfToken}`;",
    "if (cookie) pm.request.headers.upsert({ key: 'Cookie', value: cookie });",
    "if (csrfToken) pm.request.headers.upsert({ key: 'X-CSRF-Token', value: csrfToken });",
  ];
}

function commonTests(opId, expectedStatus, schema) {
  const lines = [
    `pm.test('${opId} returns ${expectedStatus}', function () { pm.response.to.have.status(${Number(expectedStatus)}); });`,
  ];
  if (schema) {
    if (schema.type === 'string') {
      lines.push(
        "pm.test('response matches OpenAPI string schema', function () { pm.expect(pm.response.text()).to.be.a('string'); });",
      );
    } else {
      lines.push(`const schema = ${JSON.stringify(schema)};`);
      lines.push(
        "pm.test('response matches OpenAPI JSON schema', function () { pm.response.to.have.jsonSchema(schema); });",
      );
    }
  }
  if (
    opId.includes('findAll') ||
    opId === 'AdminController_listPrescriptions'
  ) {
    lines.push(
      "pm.test('response has pagination metadata', function () { const json = pm.response.json(); pm.expect(json.data).to.be.an('array'); pm.expect(json.meta).to.include.keys(['page','limit','total','totalPages']); pm.expect(json.meta.page).to.be.a('number'); pm.expect(json.meta.limit).to.be.a('number'); });",
    );
  }
  if (opId === 'AuthController_login')
    lines.push(...captureAuthScript('admin'));
  if (opId === 'AuthController_refresh')
    lines.push(...captureAccessFromSetCookie('admin'));
  if (opId === 'AuthController_getProfile')
    lines.push(
      "pm.test('profile has UUID user id', function () { pm.expect(pm.response.json().id).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });",
    );
  if (opId === 'UsersController_create') {
    lines.push(
      "const createdUser = pm.response.json(); pm.environment.set('createdUserId', createdUser.id);",
    );
  }
  if (opId === 'PrescriptionsController_create') {
    lines.push(
      "const prescription = pm.response.json(); pm.environment.set('prescriptionId', prescription.id); pm.environment.set('prescriptionCode', prescription.code);",
    );
    lines.push(
      "pm.test('prescription fields have expected formats', function () { const p = pm.response.json(); pm.expect(p.id).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); pm.expect(p.code).to.match(/^RX-[A-Za-z0-9_-]{10}$/); pm.expect(p.createdAt).to.match(new RegExp(pm.collectionVariables.get('isoDateTimeRegex'))); });",
    );
  }
  if (opId === 'PrescriptionsController_markAsConsumed') {
    lines.push(
      "pm.test('prescription is consumed', function () { const p = pm.response.json(); pm.expect(p.status).to.equal('CONSUMED'); pm.expect(p.consumedAt).to.match(new RegExp(pm.collectionVariables.get('isoDateTimeRegex'))); });",
    );
  }
  if (opId === 'PrescriptionsController_downloadPdf') {
    lines.push(
      "pm.test('PDF content type is returned', function () { pm.expect(pm.response.headers.get('Content-Type')).to.include('application/pdf'); });",
    );
  }
  if (opId === 'AdminController_streamMetrics') {
    lines.push(
      "pm.test('SSE response emits metrics data', function () { pm.expect(pm.response.text()).to.include('data:'); });",
    );
  }
  return lines;
}

function captureAccessFromSetCookie(role) {
  return [
    `captureCookies('${role}');`,
    `pm.test('${role} access cookie captured', function () { pm.expect(pm.environment.get('${role}AccessToken')).to.be.a('string').and.not.empty; });`,
  ];
}

function captureAuthScript(role) {
  return [
    `captureCookies('${role}');`,
    `const loginJson = pm.response.json(); pm.environment.set('${role}UserId', loginJson.user.id);`,
    `pm.test('${role} login response has UUID user id', function () { pm.expect(loginJson.user.id).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });`,
    `pm.test('${role} auth cookies captured', function () { pm.expect(pm.environment.get('${role}AccessToken')).to.be.a('string').and.not.empty; pm.expect(pm.environment.get('${role}RefreshToken')).to.be.a('string').and.not.empty; });`,
  ];
}

const helperScript = [
  "function getSetCookieHeaders() { return pm.response.headers.all().filter(h => h.key.toLowerCase() === 'set-cookie').map(h => h.value); }",
  "function cookieValue(setCookie, name) { const found = setCookie.find(c => c.startsWith(`${name}=`)); return found ? found.split(';')[0].slice(name.length + 1) : undefined; }",
  "function captureCookies(role) { const setCookie = getSetCookieHeaders(); const access = cookieValue(setCookie, 'accessToken'); const refresh = cookieValue(setCookie, 'refreshToken'); const csrf = cookieValue(setCookie, 'csrfToken') || pm.response.headers.get('X-CSRF-Token'); if (access) pm.environment.set(`${role}AccessToken`, access); if (refresh) pm.environment.set(`${role}RefreshToken`, refresh); if (csrf) pm.environment.set(`${role}CsrfToken`, csrf); }",
];

function event(listen, exec) {
  return { listen, script: { type: 'text/javascript', exec } };
}

function item(row) {
  const opId = row.op.operationId;
  const success = successResponse(row.op);
  const role = roleFor(opId);
  const events = [
    event('test', [
      ...helperScript,
      ...commonTests(opId, success?.status || '200', jsonSchemaFor(row.op)),
    ]),
  ];
  const pre = preRequestScript(role);
  if (pre.length) events.unshift(event('prerequest', pre));
  return { name: opId, request: requestFor(row), event: events };
}

function folderedItems() {
  const groups = new Map();
  for (const row of operations()) {
    const tag = row.op.tags?.[0] || 'Untagged';
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(item(row));
  }
  return [...groups.entries()].map(([name, items]) => ({ name, item: items }));
}

function rawJsonRequest(
  name,
  method,
  route,
  body,
  role,
  tests,
  expectedStatus = 200,
) {
  const headers = [{ key: 'Accept', value: 'application/json' }];
  if (body) headers.push({ key: 'Content-Type', value: 'application/json' });
  const events = [
    event('test', [
      ...helperScript,
      `pm.test('${name} returns ${expectedStatus}', function () { pm.response.to.have.status(${expectedStatus}); });`,
      ...tests,
    ]),
  ];
  const pre = preRequestScript(role);
  if (pre.length) events.unshift(event('prerequest', pre));
  const request = { method, header: headers, url: `{{baseUrl}}${route}` };
  if (body)
    request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    };
  return { name, request, event: events };
}

function setupFolder() {
  const login = role =>
    rawJsonRequest(
      `Login ${role}`,
      'POST',
      '/auth/login',
      { email: `{{${role}Email}}`, password: '{{seedPassword}}' },
      null,
      [...captureAuthScript(role)],
      201,
    );
  return {
    name: 'Setup - Role Sessions',
    item: [
      login('admin'),
      login('doctor'),
      login('patient'),
      rawJsonRequest(
        'Get Patient Profile',
        'GET',
        '/auth/profile',
        null,
        'PATIENT',
        [
          "const profile = pm.response.json(); pm.environment.set('patientUserId', profile.id); pm.environment.set('patientId', profile.patient.id);",
          "pm.test('patient typed id captured', function () { pm.expect(pm.environment.get('patientId')).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });",
        ],
      ),
      rawJsonRequest(
        'Create Patient B',
        'POST',
        '/users',
        {
          email: 'qa-patient-b-{{$guid}}@clinic.com',
          password: '{{seedPassword}}',
          role: 'PATIENT',
          birthDate: '1992-02-02',
        },
        'ADMIN',
        [
          "const user = pm.response.json(); pm.environment.set('patientBUserId', user.id);",
          "pm.test('patient B user id captured', function () { pm.expect(user.id).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });",
        ],
        201,
      ),
      rawJsonRequest(
        'Resolve Patient B Typed ID',
        'GET',
        '/users/{{patientBUserId}}',
        null,
        'ADMIN',
        [
          "const user = pm.response.json(); pm.environment.set('patientBId', user.patient.id);",
          "pm.test('patient B typed id captured', function () { pm.expect(pm.environment.get('patientBId')).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });",
        ],
      ),
    ],
  };
}

function securityFolder() {
  return {
    name: 'Security - Negative RBAC and IDOR',
    item: [
      rawJsonRequest(
        'Missing auth rejects profile',
        'GET',
        '/auth/profile',
        null,
        'NO_AUTH',
        [],
        401,
      ),
      rawJsonRequest(
        'Doctor cannot access admin metrics',
        'GET',
        '/admin/metrics',
        null,
        'DOCTOR',
        [],
        403,
      ),
      rawJsonRequest(
        'Patient cannot access admin prescriptions',
        'GET',
        '/admin/prescriptions',
        null,
        'PATIENT',
        [],
        403,
      ),
      rawJsonRequest(
        'Invalid user payload returns 400',
        'POST',
        '/users',
        { email: 'not-an-email', role: 'INVALID_ROLE' },
        'ADMIN',
        [],
        400,
      ),
      rawJsonRequest(
        'Doctor creates prescription for Patient B',
        'POST',
        '/prescriptions',
        {
          patientId: '{{patientBId}}',
          items: [
            {
              name: 'QA IDOR Boundary {{$timestamp}}',
              dosage: '10mg',
              quantity: 1,
              instructions: 'IDOR setup',
            },
          ],
          notes: 'Patient B boundary prescription',
        },
        'DOCTOR',
        [
          "const p = pm.response.json(); pm.environment.set('patientBPrescriptionId', p.id);",
        ],
        201,
      ),
      rawJsonRequest(
        'Patient A cannot view Patient B prescription',
        'GET',
        '/prescriptions/{{patientBPrescriptionId}}',
        null,
        'PATIENT',
        [],
        403,
      ),
      rawJsonRequest(
        'Consuming already consumed prescription returns 400',
        'PATCH',
        '/prescriptions/{{prescriptionId}}/consume',
        { reason: 'Duplicate consume attempt' },
        'PATIENT',
        [],
        400,
      ),
    ],
  };
}

function sequentialFolder() {
  const login = role =>
    rawJsonRequest(
      `E2E Login ${role}`,
      'POST',
      '/auth/login',
      { email: `{{${role}Email}}`, password: '{{seedPassword}}' },
      null,
      [...captureAuthScript(role)],
      201,
    );
  return {
    name: 'Sequential E2E - Prescription Business Flow',
    item: [
      login('admin'),
      login('doctor'),
      login('patient'),
      rawJsonRequest(
        'E2E Resolve Patient Profile',
        'GET',
        '/auth/profile',
        null,
        'PATIENT',
        [
          "const profile = pm.response.json(); pm.environment.set('e2ePatientId', profile.patient.id);",
          "pm.test('E2E patient id captured', function () { pm.expect(pm.environment.get('e2ePatientId')).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });",
        ],
      ),
      rawJsonRequest(
        'E2E Doctor Creates Prescription',
        'POST',
        '/prescriptions',
        {
          patientId: '{{e2ePatientId}}',
          items: [
            {
              name: 'QA Sequential {{$timestamp}}',
              dosage: '5mg',
              quantity: 2,
              instructions: 'Sequential E2E item',
            },
          ],
          notes: 'Strict sequential Postman E2E prescription',
        },
        'DOCTOR',
        [
          "const p = pm.response.json(); pm.environment.set('e2ePrescriptionId', p.id);",
          "pm.test('E2E prescription created pending', function () { pm.expect(p.status).to.equal('PENDING'); pm.expect(p.id).to.match(new RegExp(pm.collectionVariables.get('uuidRegex'))); });",
        ],
        201,
      ),
      rawJsonRequest(
        'E2E Patient Views Prescription',
        'GET',
        '/prescriptions/{{e2ePrescriptionId}}',
        null,
        'PATIENT',
        [
          "const p = pm.response.json(); pm.test('E2E patient sees own prescription', function () { pm.expect(p.id).to.equal(pm.environment.get('e2ePrescriptionId')); });",
        ],
      ),
      rawJsonRequest(
        'E2E Patient Consumes Prescription',
        'PATCH',
        '/prescriptions/{{e2ePrescriptionId}}/consume',
        { reason: 'Sequential E2E consumption' },
        'PATIENT',
        [
          "const p = pm.response.json(); pm.test('E2E prescription consumed', function () { pm.expect(p.status).to.equal('CONSUMED'); });",
        ],
      ),
      rawJsonRequest(
        'E2E Admin Checks Metrics',
        'GET',
        '/admin/metrics',
        null,
        'ADMIN',
        [
          "const metrics = pm.response.json(); pm.test('metrics contain prescriptions total', function () { pm.expect(metrics.totals.prescriptions).to.be.a('number').and.greaterThan(0); });",
        ],
      ),
    ],
  };
}

function environment(name, baseUrl) {
  const values = {
    baseUrl,
    seedPassword: '',
    adminEmail: 'admin@clinic.com',
    doctorEmail: 'doctor@clinic.com',
    patientEmail: 'patient@clinic.com',
    adminAccessToken: '',
    adminRefreshToken: '',
    adminCsrfToken: '',
    adminUserId: '',
    doctorAccessToken: '',
    doctorRefreshToken: '',
    doctorCsrfToken: '',
    doctorUserId: '',
    patientAccessToken: '',
    patientRefreshToken: '',
    patientCsrfToken: '',
    patientUserId: '',
    patientId: '',
    patientBUserId: '',
    patientBId: '',
    patientBPrescriptionId: '',
    createdUserId: '',
    prescriptionId: '',
    prescriptionCode: '',
    e2ePatientId: '',
    e2ePrescriptionId: '',
    resourceId: '',
  };
  return {
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-prescription-api`,
    name,
    values: Object.entries(values).map(([key, value]) => ({
      key,
      value,
      type: 'default',
      enabled: true,
    })),
    _postman_variable_scope: 'environment',
    _postman_exported_using: 'Postman/Newman generator',
  };
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

(async () => {
  fs.mkdirSync(postmanDir, { recursive: true });
  const generated = await convertOpenApi();
  const collection = {
    ...generated,
    info: {
      ...generated.info,
      _postman_id: 'prescription-api-generated-curated-qa-suite',
      name: 'Prescription Management API - Generated and Curated QA Suite',
      description:
        'Generated from openapi.json with curated Newman business-flow and security tests.',
    },
    variable: [
      {
        key: 'uuidRegex',
        value:
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
      },
      {
        key: 'isoDateTimeRegex',
        value: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$',
      },
    ],
    item: [
      setupFolder(),
      ...folderedItems(),
      securityFolder(),
      sequentialFolder(),
    ],
  };
  writeJson(collectionPath, collection);
  writeJson(
    localEnvPath,
    environment('Prescription API Local', 'http://localhost:3000'),
  );
  writeJson(
    ciEnvPath,
    environment('Prescription API CI', 'http://localhost:3000'),
  );
  console.log(`Wrote ${path.relative(root, collectionPath)}`);
  console.log(`Wrote ${path.relative(root, localEnvPath)}`);
  console.log(`Wrote ${path.relative(root, ciEnvPath)}`);
})();
