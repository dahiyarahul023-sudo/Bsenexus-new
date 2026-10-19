import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  getAiPluginManifest, 
  getOpenApiSpec, 
  getGeminiToolsSpec, 
  aiPluginRouter 
} from '../api/aiPlugin.js';

describe('BSE Nexus Universal AI Plugin & Action Gateway', () => {

  test('Manifest: validates ChatGPT plugin schema standards', () => {
    const manifest = getAiPluginManifest();
    assert.strictEqual(manifest.schema_version, 'v1');
    assert.strictEqual(manifest.auth.type, 'none');
    assert.strictEqual(manifest.api.type, 'openapi');
    assert.ok(manifest.api.url.endsWith('/api/ai/openapi.json'));
    assert.ok(manifest.description_for_model.includes('SEBI LODR Regulation 30'));
    assert.ok(manifest.description_for_human.length > 20);
    assert.ok(manifest.contact_email.includes('@'));
  });

  test('OpenAPI: validates OpenAPI 3.1 structure and operations', () => {
    const spec = getOpenApiSpec() as any;
    assert.strictEqual(spec.openapi, '3.1.0');
    assert.ok(spec.info.title.includes('BSE Nexus'));
    assert.strictEqual(spec.info.version, '1.0.0');

    const paths = spec.paths;
    assert.ok(paths['/api/ai/v1/filings']);
    assert.ok(paths['/api/ai/v1/results']);
    assert.ok(paths['/api/ai/v1/board-meetings']);
    assert.ok(paths['/api/ai/v1/company']);

    // Check operation IDs
    assert.strictEqual(paths['/api/ai/v1/filings'].get.operationId, 'getBseFilings');
    assert.strictEqual(paths['/api/ai/v1/results'].get.operationId, 'getQuarterlyResults');
    assert.strictEqual(paths['/api/ai/v1/board-meetings'].get.operationId, 'getBoardMeetings');
    assert.strictEqual(paths['/api/ai/v1/company'].get.operationId, 'getCompanyIntel');

    // Filings parameters
    const filingParams = paths['/api/ai/v1/filings'].get.parameters;
    const paramNames = filingParams.map((p: any) => p.name);
    assert.ok(paramNames.includes('symbol'));
    assert.ok(paramNames.includes('category'));
    assert.ok(paramNames.includes('limit'));
  });

  test('Gemini Tools: produces valid Google GenAI functionDeclarations', () => {
    const gemini = getGeminiToolsSpec() as any;
    assert.ok(Array.isArray(gemini.functionDeclarations));
    assert.strictEqual(gemini.functionDeclarations.length, 4);

    const names = gemini.functionDeclarations.map((fn: any) => fn.name);
    assert.ok(names.includes('getBseFilings'));
    assert.ok(names.includes('getQuarterlyResults'));
    assert.ok(names.includes('getBoardMeetings'));
    assert.ok(names.includes('getCompanyIntel'));

    for (const fn of gemini.functionDeclarations) {
      assert.strictEqual(fn.parameters.type, 'OBJECT');
      assert.ok(typeof fn.description === 'string' && fn.description.length > 10);
      assert.ok(fn.parameters.properties);
    }
  });

  test('Endpoints: /v1/results rejects missing symbol parameter with HTTP 400', async () => {
    let statusCode = 200;
    let jsonBody: any = null;

    const mockReq = { query: {} } as any;
    const mockRes = {
      setHeader() {},
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonBody = data;
        return this;
      }
    } as any;

    // Simulate route handler
    const routes = (aiPluginRouter as any).stack;
    const routeLayer = routes.find((r: any) => r.route?.path === '/v1/results');
    assert.ok(routeLayer, 'Route /v1/results should be registered');

    await routeLayer.route.stack[0].handle(mockReq, mockRes, () => {});

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonBody.success, false);
    assert.ok(jsonBody.error.includes('symbol'));
  });

  test('Endpoints: /v1/company rejects missing query parameter with HTTP 400', async () => {
    let statusCode = 200;
    let jsonBody: any = null;

    const mockReq = { query: {} } as any;
    const mockRes = {
      setHeader() {},
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonBody = data;
        return this;
      }
    } as any;

    const routes = (aiPluginRouter as any).stack;
    const routeLayer = routes.find((r: any) => r.route?.path === '/v1/company');
    assert.ok(routeLayer, 'Route /v1/company should be registered');

    await routeLayer.route.stack[0].handle(mockReq, mockRes, () => {});

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(jsonBody.success, false);
    assert.ok(jsonBody.error.includes('query'));
  });

  test('Endpoints: /v1/company resolves well-known company (e.g. Reliance)', async () => {
    let jsonBody: any = null;

    const mockReq = { query: { query: 'RELIANCE' } } as any;
    const mockRes = {
      setHeader() {},
      status() { return this; },
      json(data: any) {
        jsonBody = data;
        return this;
      }
    } as any;

    const routes = (aiPluginRouter as any).stack;
    const routeLayer = routes.find((r: any) => r.route?.path === '/v1/company');
    await routeLayer.route.stack[0].handle(mockReq, mockRes, () => {});

    assert.strictEqual(jsonBody.success, true);
    assert.strictEqual(jsonBody.found, true);
    assert.strictEqual(jsonBody.company.scripCode, '500325');
    assert.ok(jsonBody.company.name.includes('Reliance'));
  });

  test('Endpoints: /v1/filings returns valid JSON array format', async () => {
    let jsonBody: any = null;

    const mockReq = { query: { limit: '5' } } as any;
    const mockRes = {
      setHeader() {},
      status() { return this; },
      json(data: any) {
        jsonBody = data;
        return this;
      }
    } as any;

    const routes = (aiPluginRouter as any).stack;
    const routeLayer = routes.find((r: any) => r.route?.path === '/v1/filings');
    await routeLayer.route.stack[0].handle(mockReq, mockRes, () => {});

    assert.strictEqual(jsonBody.success, true);
    assert.ok(Array.isArray(jsonBody.filings));
  });

  test('Endpoints: /v1/board-meetings returns valid JSON array format', async () => {
    let jsonBody: any = null;

    const mockReq = { query: { daysAhead: '30' } } as any;
    const mockRes = {
      setHeader() {},
      status() { return this; },
      json(data: any) {
        jsonBody = data;
        return this;
      }
    } as any;

    const routes = (aiPluginRouter as any).stack;
    const routeLayer = routes.find((r: any) => r.route?.path === '/v1/board-meetings');
    await routeLayer.route.stack[0].handle(mockReq, mockRes, () => {});

    assert.strictEqual(jsonBody.success, true);
    assert.ok(Array.isArray(jsonBody.meetings));
  });
});
