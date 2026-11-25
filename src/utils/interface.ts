import { UUID } from 'crypto'
import { Session } from 'express-session'

export interface UserInfo {
  id?: UUID;
  _id?: UUID;
  fullname: string;
  mobile: string;
  otp: string;
  roles?: string[];
  gender?: string;
  created_at?: Date;
  updated_at?: Date;
  account_status?: boolean;
  blocked_till?: Date;
}

export interface Token {
  user_id: UUID;
  token_type: string;
  token: string;
}

export interface CustomSessionData extends Session {
  user: {
  id?: UUID;
  _id?: UUID;
  fullname: string;
  mobile: string;
  otp: string;
  roles?: string[];
  gender?: string;
  created_at?: Date;
  updated_at?: Date;
  account_status?: boolean;
  blocked_till?: Date;
  };
}
