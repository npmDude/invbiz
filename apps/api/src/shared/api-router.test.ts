import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';

import { ApiRouter } from './api-router';

const querySchema = z.object({
  organizationId: z.uuid().optional(),
  limit: z.coerce.number().default(20),
});

const paramsSchema = z.object({
  id: z.uuid(),
});

const dataSchema = z.object({
  name: z.string().trim().min(1),
});

const user = { id: 'user-1' };

function createApi() {
  const registerPath = vi.fn();
  const api = new ApiRouter('/users', { routeRegistry: { registerPath } });

  return { api, registerPath };
}

function createReq(query: unknown, data: unknown, reqUser?: unknown): Request {
  return { query, body: data, user: reqUser } as unknown as Request;
}

function createRes(headersSent = false) {
  const status = vi.fn();
  const json = vi.fn();
  const send = vi.fn();
  const res = { headersSent, status, json, send } as unknown as Response;
  status.mockReturnValue(res);

  return { res, status, json, send };
}

describe('ApiRouter', () => {
  it('registers the docs path with OpenAPI param style', () => {
    const { api, registerPath } = createApi();

    api.endpoint({
      method: 'post',
      path: '/:id',
      summary: 'Update a user',
      tags: ['Users'],
      paramsSchema,
      querySchema,
      dataSchema,
      responses: { 200: { description: 'User updated' } },
      handler: () => {},
    });

    expect(registerPath).toHaveBeenCalledWith({
      method: 'post',
      path: '/users/{id}',
      summary: 'Update a user',
      tags: ['Users'],
      request: {
        params: paramsSchema,
        query: querySchema,
        body: {
          required: true,
          content: { 'application/json': { schema: dataSchema } },
        },
      },
      responses: { 200: { description: 'User updated' } },
    });
  });

  it('strips the trailing slash from collection docs paths', () => {
    const { api, registerPath } = createApi();

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      querySchema,
      handler: () => {},
    });

    expect(registerPath).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/users' }),
    );
  });

  it('authenticates by default, before any other middleware', async () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');
    const custom = vi.fn((_req, _res, next) => {
      next();
    });

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      requiredPermission: 'users.view',
      middlewares: [custom],
      handler: () => {},
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/',
      expect.any(Function),
      expect.any(Function),
      custom,
      expect.any(Function),
    );

    const authenticateMiddleware = (
      getSpy.mock.calls[0] as unknown[]
    )[1] as RequestHandler;
    const next = vi.fn();
    await authenticateMiddleware(
      { headers: {} } as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0]?.[0] as { status?: number };
    expect(error.status).toBe(401);
  });

  it('prepends the permission gate when requiredPermission is set', async () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      requiredPermission: 'users.view',
      handler: () => {},
    });

    const gate = (getSpy.mock.calls[0] as unknown[])[2] as RequestHandler;
    const next = vi.fn();
    await gate({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0]?.[0] as { status?: number };
    expect(error.status).toBe(401);
  });

  it('skips authentication when authenticate is false', async () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');
    const custom = vi.fn((_req, _res, next) => {
      next();
    });
    const handler = vi.fn();
    const next = vi.fn();
    const { res } = createRes();

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      authenticate: false,
      middlewares: [custom],
      handler,
    });

    expect(getSpy).toHaveBeenCalledWith('/', custom, expect.any(Function));

    const routeHandler = (
      getSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    await routeHandler(createReq({}, undefined), res, next);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0].auth).toEqual({ user: undefined });
    expect(next).not.toHaveBeenCalled();
  });

  it('wires middlewares, validation, and handler in order', () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');
    const first = vi.fn((_req, _res, next) => {
      next();
    });

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      middlewares: [first],
      querySchema,
      handler: () => {},
    });

    expect(getSpy).toHaveBeenCalledWith(
      '/',
      expect.any(Function),
      first,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('passes parsed params, query, and data to the handler', async () => {
    const { api } = createApi();
    const postSpy = vi.spyOn(api.router, 'post');
    const handler = vi.fn();
    const next = vi.fn() as unknown as NextFunction;
    const { res } = createRes();

    api.endpoint({
      method: 'post',
      path: '/',
      summary: 'Create a user',
      querySchema,
      dataSchema,
      handler: async (ctx) => {
        expect(ctx.query.limit).toBeTypeOf('number');
        await handler(ctx);
      },
    });

    const routeHandler = (
      postSpy.mock.calls[0] as unknown[]
    )[3] as RequestHandler;
    await routeHandler(
      createReq({ limit: '5' }, { name: '  Ada  ' }, user),
      res,
      next,
    );

    expect(handler).toHaveBeenCalledOnce();
    const ctx = handler.mock.calls[0]?.[0];
    expect(ctx.query).toEqual({ limit: 5 });
    expect(ctx.data).toEqual({ name: 'Ada' });
    expect(ctx.res).toBe(res);
    expect(next).not.toHaveBeenCalled();
  });

  it('exposes the authenticated user on auth', async () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');
    const next = vi.fn();
    const { res } = createRes();

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      handler: ({ auth }) => {
        // Compiles only when auth.user is non-optional.
        expect(auth.user.id).toBe('user-1');
      },
    });

    const routeHandler = (
      getSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    await routeHandler(createReq({}, undefined, user), res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('sends the returned value as a JSON response', async () => {
    const { api } = createApi();
    const postSpy = vi.spyOn(api.router, 'post');
    const next = vi.fn();
    const { res, status, json, send } = createRes();

    api.endpoint({
      method: 'post',
      path: '/',
      summary: 'Create a user',
      dataSchema,
      handler: ({ data }) => ({ hello: data.name }),
    });

    const routeHandler = (
      postSpy.mock.calls[0] as unknown[]
    )[3] as RequestHandler;
    await routeHandler(createReq({}, { name: 'Ada' }, user), res, next);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ hello: 'Ada' });
    expect(send).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the configured status code', async () => {
    const { api } = createApi();
    const postSpy = vi.spyOn(api.router, 'post');
    const next = vi.fn();
    const { res, status, json } = createRes();

    api.endpoint({
      method: 'post',
      path: '/',
      summary: 'Create a user',
      statusCode: 201,
      handler: () => ({ id: 'user-1' }),
    });

    const routeHandler = (
      postSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    await routeHandler(createReq({}, undefined, user), res, next);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ id: 'user-1' });
  });

  it('sends an empty response when the handler returns undefined', async () => {
    const { api } = createApi();
    const deleteSpy = vi.spyOn(api.router, 'delete');
    const next = vi.fn();
    const { res, status, json, send } = createRes();

    api.endpoint({
      method: 'delete',
      path: '/:id',
      summary: 'Delete a user',
      statusCode: 204,
      handler: () => {},
    });

    const routeHandler = (
      deleteSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    await routeHandler(createReq({}, undefined, user), res, next);

    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalledOnce();
    expect(json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('skips the automatic response when headers were already sent', async () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');
    const next = vi.fn();
    const { res, json, send } = createRes(true);

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      handler: ({ res: rawRes }) => {
        rawRes.status(201).json({ custom: true });
      },
    });

    const routeHandler = (
      getSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    await routeHandler(createReq({}, undefined, user), res, next);

    expect(json).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledWith({ custom: true });
    expect(send).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid input through the validation middleware', () => {
    const { api } = createApi();
    const getSpy = vi.spyOn(api.router, 'get');
    const next = vi.fn();

    api.endpoint({
      method: 'get',
      path: '/',
      summary: 'List users',
      querySchema,
      handler: () => {},
    });

    const validate = (getSpy.mock.calls[0] as unknown[])[2] as RequestHandler;
    validate(
      createReq({ limit: 'not-a-number' }, undefined),
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ZodError);
  });

  it('forwards handler errors to next', async () => {
    const { api } = createApi();
    const deleteSpy = vi.spyOn(api.router, 'delete');
    const failure = new Error('boom');
    const next = vi.fn();
    const { res } = createRes();

    api.endpoint({
      method: 'delete',
      path: '/:id',
      summary: 'Delete a user',
      handler: () => {
        throw failure;
      },
    });

    const routeHandler = (
      deleteSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    await routeHandler(createReq({}, undefined, user), res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  it('omits validation and request docs when no schemas are given', async () => {
    const { api, registerPath } = createApi();
    const deleteSpy = vi.spyOn(api.router, 'delete');
    const handler = vi.fn();
    const next = vi.fn();
    const { res } = createRes();

    api.endpoint({
      method: 'delete',
      path: '/:id',
      summary: 'Delete a user',
      handler,
    });

    expect(deleteSpy).toHaveBeenCalledWith(
      '/:id',
      expect.any(Function),
      expect.any(Function),
    );
    expect(registerPath).toHaveBeenCalledWith({
      method: 'delete',
      path: '/users/{id}',
      summary: 'Delete a user',
      responses: { 200: { description: 'Delete a user' } },
    });

    const routeHandler = (
      deleteSpy.mock.calls[0] as unknown[]
    )[2] as RequestHandler;
    const req = createReq({}, undefined, user);
    await routeHandler(req, res, next);

    expect(handler).toHaveBeenCalledWith({
      req,
      res: expect.anything(),
      next,
      auth: { user },
      params: undefined,
      query: undefined,
      data: undefined,
    });
  });
});
