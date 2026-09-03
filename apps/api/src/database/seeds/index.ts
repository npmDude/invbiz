import { db } from '../index'
import { seedPermissions } from './permissions'

async function seed() {
  await seedPermissions()
}

seed()
  .catch(console.error)
  .finally(() => db.$client.end())
