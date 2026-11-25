import { User } from '../Entities/user';
import { dataSource } from '../configurations/db.config';
import bcrypt from 'bcrypt';
import { CONSTANT } from '../utils/constant';
import { APIError } from '../utils/errorhandler';
import { UUID } from 'crypto';
/* eslint-disable no-useless-catch */

export class UserService {
  static async createUser(user: any) {
    try {
      const repository = dataSource.getRepository(User);
      user.mobile = String(user.mobile).toLowerCase();
      if ('password' in user) {
        user.salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, user.salt);
      }
      if (typeof user.roles === 'undefined') {
        user.roles = [];
      }
      if (Array.isArray(user.roles) && user.roles.length === 0) {
        user.roles.push('standard');
      }
      const savedUser = await repository.save(user);
      return savedUser;
    } catch (error) {
      throw error; // Rethrow the error to be caught by the calling code
    }
  }

  static async findUserByMobile(mobile: string) {
    try {
      const repository = dataSource.getRepository(User);
      const user = await repository.findOne({
        select: {
          id: true,
          fullname: true,
          mobile: true,
          role: true,
          account_status: true,
        },
        where: {
          mobile,
        },
      });

      if (!user || !user.mobile) {
        await this.addLoginMessage(mobile, 'failure', CONSTANT.MOBILE_NOT_REGISTERED);
        throw new APIError(
          CONSTANT.MOBILE_NOT_REGISTERED,
          400,
          CONSTANT.INCORRECT_OTP,
          false,
        );
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async addLoginMessage(
    mobile: string,
    text: string,
    message: string,
    userId?: UUID,
  ) {
    try {
      const repositoryLogin = dataSource.getRepository(User);
      await repositoryLogin.save({ mobile, login_type: text, message, userId });
    } catch (error) {
      throw error; // Rethrow the error to be caught by the calling code
    }
  }

  static async updateUser(userId: UUID, updateObj: any) {
    try {
      const repositoryLogin = dataSource.getRepository(User);
      await repositoryLogin.update({ id: userId }, updateObj);
    } catch (error) {
      throw error; // Rethrow the error to be caught by the calling code
    }
  }
}
