import type { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';

export type OrganizationMembershipSource = 'params' | 'query';

/**
 * Require the authenticated user to belong to the target organization.
 *
 * Platform admins bypass the check (platform-wide access per ADR-0002).
 *
 * The middleware is shared across routers where `:id` may identify different
 * resources (e.g. an organization in the organizations router, a product in
 * the products router), so each route declares where its organization id
 * comes from:
 *
 * - `'params'` reads the `:id` route parameter
 *   (e.g. `GET /organizations/:id`).
 * - `'query'` (default) reads the required `organizationId`
 *   query parameter (e.g. `GET /products?organizationId=...`).
 */
export function requireOrganizationMembership(
  source: OrganizationMembershipSource = 'query',
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError(401, 'Authentication is required.', {
          code: 'AUTHENTICATION_REQUIRED',
        });
      }

      if (req.user.accessLevel === 'admin') {
        next();
        return;
      }

      const paramName = source === 'params' ? 'id' : 'organizationId';
      const value =
        source === 'params' ? req.params[paramName] : req.query[paramName];

      if (typeof value !== 'string' || value.length === 0) {
        throw createError(400, 'An organization id is required.', {
          code: 'MISSING_ORGANIZATION_ID',
        });
      }

      if (req.user.organizationId !== value) {
        throw createError(403, 'Insufficient permissions.', {
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
