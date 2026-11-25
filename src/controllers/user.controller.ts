/* src/controllers/user.controller.ts */

import { Request, Response } from 'express';
import { check, matchedData, validationResult } from 'express-validator';
import { CONSTANT } from '../utils/constant';
import bcrypt from 'bcrypt';
// import moment from 'moment'
import AuthController from './auth.controller';
import { validationErrors } from '../functions';
import { UserInfo, CustomSessionData } from '../utils/interface';
import { UserService } from '../services';

/*
 * Controller to handle request to /users
 */
export class UserController {
  // validation rules
  static validate(name: string) {
    let returnArr: any = [];
    switch (name) {
      case 'signup':
        returnArr = [
          check('fullname', "Name can't be empty").isLength({ min: 2 }),
          check('street_address').optional(),
          check('city').optional(),
          check('mobile_number').isMobilePhone('et-EE')
            .notEmpty()
            .withMessage('Mobile number is required.'),
          check('country_code')
            .notEmpty()
            .withMessage('Country code is required.'),
        ];
        break;
      case 'login':
        returnArr = [
          check('mobile')
            .isMobilePhone('et-EE')
            .withMessage('Invalid mobile phone')
            .trim()
            .custom(async (value, params) => {
              const req = params.req;
              req.session.user = null;
              const user = await UserService.findUserByMobile(value);

              if (user) {
                req.session.user = { ...user };
              }
              return null;
            }),
          check('password', 'Incorrect password').custom((value, params) => {
            const req = params.req;
            const session = req && (req.session as CustomSessionData);

            const user: UserInfo = session.user;
            if (!user) {
              // throw new Error('Incorrect user or password')
              return true;
            }
            if (!user.account_status) {
              throw new Error(
                'Your account is suspended. Please connect with support team.',
              );
            }

            if (user.blocked_till && new Date(user.blocked_till) > new Date()) {
              throw new Error(
                'Your account is temporarily blocked. Please try after sometime.',
              );
            }

            return bcrypt.compare(value, user.otp).then(async (res) => {
              if (res !== true) {
                await UserService.addLoginMessage(
                  user.mobile,
                  'failure',
                  CONSTANT.INCORRECT_OTP,
                  user._id,
                );
                throw new Error(CONSTANT.INCORRECT_OTP);
              } else {
                await UserService.addLoginMessage(
                  user.mobile,
                  'success',
                  CONSTANT.LOGIN_SUCCESS,
                  user._id,
                );
              }
            });
          }),
        ];
        break;
    }
    return returnArr;
  }

  static async signup(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(422)
          .json({ errors: validationErrors(errors.mapped()) });
      }
      console.log(req.body)
      const postData = matchedData(req);
      await UserService.createUser(postData);

      // TODO: Re-enable SMS service
      // const user: UserInfo = await UserService.createUser(postData);
      // await Sms.sendOtp(
      //   user.mobile,
      //   'Verify Your Account',
      //   `Hello ${user.fullname} \\n This is your OTP Code for registering to the Property Management App and sending documents for review`,
      // );
      return res.status(200).json({ success: true, data: null });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, errors: validationErrors(errors.mapped()) });
      }
      const session = req && (req.session as CustomSessionData);
      const user: UserInfo = session.user;
      const result = JSON.parse(JSON.stringify(AuthController.verifyOtp(user.mobile, user.otp)));
      result['users'] = {
        id: user._id,
        fullname: user.fullname,
        mobile: user.mobile,
        roles: user.roles,
        account_status: user.account_status

      };
      const dataToUpdate = { last_login_at: new Date() };
      if (user.id) {
        UserService.updateUser(user.id, dataToUpdate);
      }
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}
