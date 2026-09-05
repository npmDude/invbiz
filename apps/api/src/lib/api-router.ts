import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';

import { checkSchema } from '../middlewares/check-schema';
import { authenticate, requireRequestUser } from '../middlewares/authenticate';
import { requirePermission } from '../middlewares/require-permission';
import { registry } from '../openapi/registry';

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

type InferSchema<TSchema> = TSchema extends z.ZodTypeAny
  ? z.output<TSchema>
  : undefined;

export interface RouteAuth<TAuthenticated extends boolean = boolean> {
  user: TAuthenticated extends true
    ? NonNullable<Request['user']>
    : Request['user'];
}

export interface RouteContext<
  TParams,
  TQuery,
  TData,
  TAuthenticated extends boolean = boolean,
> {
  req: Request;
  res: Response;
  next: NextFunction;
  auth: RouteAuth<TAuthenticated>;
  params: TParams;
  query: TQuery;
  data: TData;
}

export interface RouteDefinition<
  TParamsSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TDataSchema extends z.ZodTypeAny | undefined = undefined,
  TAuthenticated extends boolean = boolean,
> {
  method: HttpMethod;
  /** Router-local path (Express style, e.g. `/:id`). */
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  paramsSchema?: TParamsSchema;
  querySchema?: TQuerySchema;
  dataSchema?: TDataSchema;
  /**
   * Run the `authenticate` middleware and guarantee `auth.user`.
   * Defaults to the router setting. Set `false` for public routes.
   */
  authenticate?: TAuthenticated;
  /** Permission key(s) enforced before any other middleware. */
  requiredPermission?: Parameters<typeof requirePermission>[0];
  middlewares?: RequestHandler[];
  responses?: RouteConfig['responses'];
  /** Response status for the returned value. Defaults to 200. */
  statusCode?: number;
  handler: (
    ctx: RouteContext<
      InferSchema<TParamsSchema>,
      InferSchema<TQuerySchema>,
      InferSchema<TDataSchema>,
      TAuthenticated
    >,
    // The return value becomes the JSON response; return undefined for an
    // empty response (e.g. 204). Handlers needing headers or cookies can
    // still use `res` directly, which skips the automatic response.
  ) => unknown;
}

interface RouteRegistry {
  registerPath: (config: RouteConfig) => void;
}

type DocsParameter = NonNullable<RouteConfig['request']>['query'];

// Converts an Express path to its OpenAPI equivalent (`/:id` → `/{id}`)
// and drops a trailing slash from collection routes (`/users/` → `/users`).
function toDocsPath(docsBasePath: string, path: string): string {
  const joined = `${docsBasePath}${path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;

  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

// A router that declares validated, documented endpoints: one object wires
// authentication, the permission gate, auth middlewares, schema validation,
// a schema-typed handler, and OpenAPI docs. The handler's return value
// becomes the JSON response. `docsBasePath` is the mount prefix from
// routes.ts, used to derive docs paths from router-local ones.
export class ApiRouter<const TRouterAuth extends boolean = true> {
  readonly router: Router;
  private readonly authenticate: boolean;
  private readonly routeRegistry: RouteRegistry;

  constructor(
    private readonly docsBasePath: string,
    options?: {
      authenticate?: TRouterAuth;
      routeRegistry?: RouteRegistry;
    },
  ) {
    this.router = Router();
    this.authenticate = options?.authenticate ?? true;
    this.routeRegistry = options?.routeRegistry ?? registry;
  }

  use(...handlers: RequestHandler[]): void {
    this.router.use(...handlers);
  }

  endpoint<
    TParamsSchema extends z.ZodTypeAny | undefined = undefined,
    TQuerySchema extends z.ZodTypeAny | undefined = undefined,
    TDataSchema extends z.ZodTypeAny | undefined = undefined,
    const TEndpointAuth extends boolean = TRouterAuth,
  >(
    definition: RouteDefinition<
      TParamsSchema,
      TQuerySchema,
      TDataSchema,
      TEndpointAuth
    >,
  ): void {
    const {
      method,
      path,
      summary,
      description,
      tags,
      middlewares = [],
      responses = { 200: { description: summary } },
      statusCode = 200,
      handler,
    } = definition;
    const paramsSchema: z.ZodTypeAny | undefined = definition.paramsSchema;
    const querySchema: z.ZodTypeAny | undefined = definition.querySchema;
    const dataSchema: z.ZodTypeAny | undefined = definition.dataSchema;
    const hasSchemas =
      (paramsSchema ?? querySchema ?? dataSchema) !== undefined;
    const authenticated = definition.authenticate ?? this.authenticate;

    this.routeRegistry.registerPath({
      method,
      path: toDocsPath(this.docsBasePath, path),
      summary,
      ...(description !== undefined ? { description } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(hasSchemas
        ? {
            request: {
              ...(paramsSchema !== undefined
                ? { params: paramsSchema as unknown as DocsParameter }
                : {}),
              ...(querySchema !== undefined
                ? { query: querySchema as unknown as DocsParameter }
                : {}),
              ...(dataSchema !== undefined
                ? {
                    body: {
                      required: true,
                      content: {
                        'application/json': { schema: dataSchema },
                      },
                    },
                  }
                : {}),
            },
          }
        : {}),
      responses,
    });

    const routeHandler: RequestHandler = async (req, res, next) => {
      try {
        const result = await handler({
          req,
          res,
          next,
          auth: {
            user: authenticated ? requireRequestUser(req) : req.user,
          } as RouteAuth<TEndpointAuth>,
          params: (paramsSchema !== undefined
            ? paramsSchema.parse(req.params)
            : undefined) as InferSchema<TParamsSchema>,
          query: (querySchema !== undefined
            ? querySchema.parse(req.query)
            : undefined) as InferSchema<TQuerySchema>,
          data: (dataSchema !== undefined
            ? dataSchema.parse(req.body)
            : undefined) as InferSchema<TDataSchema>,
        });

        if (!res.headersSent) {
          if (result === undefined) {
            res.status(statusCode).send();
          } else {
            res.status(statusCode).json(result);
          }
        }
      } catch (error) {
        next(error);
      }
    };

    const handlers: RequestHandler[] = [
      ...(authenticated ? [authenticate] : []),
      ...(definition.requiredPermission !== undefined
        ? [requirePermission(definition.requiredPermission)]
        : []),
      ...middlewares,
      ...(hasSchemas
        ? [checkSchema({ paramsSchema, querySchema, bodySchema: dataSchema })]
        : []),
      routeHandler,
    ];

    switch (method) {
      case 'get': {
        this.router.get(path, ...handlers);
        break;
      }
      case 'post': {
        this.router.post(path, ...handlers);
        break;
      }
      case 'patch': {
        this.router.patch(path, ...handlers);
        break;
      }
      case 'put': {
        this.router.put(path, ...handlers);
        break;
      }
      case 'delete': {
        this.router.delete(path, ...handlers);
        break;
      }
    }
  }
}
