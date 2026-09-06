import type { Branch } from '../../database/schemas/branches';
import { BaseService } from '../../shared/base.service';
import {
  branchesRepository,
  type BranchFilters,
  type BranchesRepository,
} from './branches.repository';

export class BranchesService extends BaseService<
  BranchFilters,
  Branch,
  BranchesRepository
> {}

export const branchesService = new BranchesService(
  branchesRepository,
  'Branch',
);
