import { DataSource } from 'typeorm';
import path from 'path';
import * as Entities from '../Entities';

export const dataSource = new DataSource({
  // The shared legacy API is still on MySQL. SBMS PostGIS conversion is not
  // complete; switching this driver alone would break legacy entity metadata.
  type: 'mysql',
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
  logging: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'schema', 'query'],
  synchronize: process.env.NODE_ENV === 'production' ? false : process.env.DB_SYNCHRONIZE === 'true',
  entities: Object.values(Entities),
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],
  subscribers: [],
});
