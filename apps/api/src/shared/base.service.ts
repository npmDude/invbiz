import createError from 'http-errors';
import type { Repository } from './base.repository';

export abstract class BaseService<
  TFilters,
  TResult,
  TRepository extends Repository<TFilters, TResult, unknown>,
  TCreate = TRepository extends Repository<unknown, unknown, infer TInput>
    ? TInput
    : never,
> {
  constructor(
    protected readonly repository: TRepository,
    private readonly resourceName = 'Record',
  ) {}

  findAll(filters?: TFilters) {
    return this.repository.findAll(filters);
  }

  findOne(filters?: TFilters) {
    return this.repository.findOne(filters);
  }

  async findById(id: string): Promise<TResult> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw createError(404, `${this.resourceName} not found.`);
    }

    return record;
  }

  create(data: TCreate): Promise<TResult> {
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<TCreate>): Promise<TResult> {
    const record = await this.repository.update(id, data);

    if (!record) {
      throw createError(404, `${this.resourceName} not found.`);
    }

    return record;
  }

  async delete(id: string): Promise<TResult> {
    const record = await this.repository.delete(id);

    if (!record) {
      throw createError(404, `${this.resourceName} not found.`);
    }

    return record;
  }
}
