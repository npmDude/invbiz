export interface Repository<TFilters, TResult> {
  findOne(filters?: TFilters): Promise<TResult | undefined>;
  findAll(filters?: TFilters): Promise<TResult[]>;
}

export abstract class BaseService<
  TFilters,
  TResult,
  TRepository extends Repository<TFilters, TResult>,
> {
  constructor(protected readonly repository: TRepository) {}

  findOne(filters?: TFilters) {
    return this.repository.findOne(filters);
  }

  findAll(filters?: TFilters) {
    return this.repository.findAll(filters);
  }
}
