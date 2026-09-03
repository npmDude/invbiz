import { db } from '../index';
import { permissionsTable } from '../schemas/permissions';

const permissions = [
  {
    id: 'categories.view',
    description: 'View categories',
  },
  {
    id: 'categories.create',
    description: 'Create categories',
  },
  {
    id: 'categories.manage',
    description: 'Manage categories',
  },
  {
    id: 'products.view',
    description: 'View products',
  },
  {
    id: 'products.create',
    description: 'Create products',
  },
  {
    id: 'products.manage',
    description: 'Manage products',
  },
];

export async function seedPermissions() {
  await db
    .insert(permissionsTable)
    .values(permissions)
    .onConflictDoNothing({
      target: permissionsTable.id,
    });
}
