import type { Organization } from '../../database/schemas/organizations';
import { BaseService } from '../../shared/base.service';
import {
  organizationsRepository,
  type OrganizationFilters,
  type OrganizationsRepository,
} from './organizations.repository';

export class OrganizationsService extends BaseService<
  OrganizationFilters,
  Organization,
  OrganizationsRepository
> {}

export const organizationsService = new OrganizationsService(
  organizationsRepository,
  'Organization',
);
