import { DataSource } from 'typeorm';
import path from 'path';
import * as Entities from '../Entities';

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  logging: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'schema', 'query'],
  synchronize: process.env.NODE_ENV === 'production' ? false : process.env.DB_SYNCHRONIZE === 'true',
  entities: Object.values(Entities),
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],
  subscribers: [],
});
