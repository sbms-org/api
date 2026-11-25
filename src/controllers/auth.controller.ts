import jwt from 'jwt-simple';
import moment from 'moment';
import { User } from '../Entities/user';
import { dataSource } from '../configurations/db.config';

class Auth {
  public sendOtp = async (mobile: string, force = false) => {
    const user = await dataSource.getRepository(User).findOneBy({ mobile });
    if (!user) throw new Error('User not found');

    // if not forcing, block OTP when account isn't active
    if (!force && user.status && user.status !== 'ACTIVE') {
      const err = new Error(
        user.status === 'PENDING' ? 'Account pending approval' : 'Account is inactive',
      );
      (err as any).status = 403;
      (err as any).errorCode = user.status === 'PENDING' ? 'ACCOUNT_PENDING' : 'ACCOUNT_INACTIVE';
      throw err;
    }

    const otp = '123456'; // Default OTP for development
    const expires = moment().add(5, 'minutes').toDate();

    user.otp_code = otp;
    user.otp_expires = expires;
    await user.save();

    console.log(`OTP for ${mobile}: ${otp}`);

    return {
      message: 'OTP sent successfully',
    };
  };

  public verifyOtp = async (mobile: string, otp: string) => {
    // Accept the development stub code unconditionally if the mobile exists.
    // This allows both login and registration flows to succeed using 123456
    // without worrying about what is stored in the database.
    const repo = dataSource.getRepository(User);
    let user: User | null = null;

    if (otp === '123456') {
      user = await repo.findOneBy({ mobile });
    } else {
      user = await repo.findOneBy({ mobile, otp_code: otp });
    }

    if (!user) {
      const err = new Error('Invalid OTP or Phone Number');
      (err as any).status = 400;
      (err as any).errorCode = 'INVALID_OTP';
      throw err;
    }

    // ensure user is active before issuing token
    if (user.status && user.status !== 'ACTIVE') {
      if (user.status === 'PENDING') {
        const err = new Error('Account pending approval');
        (err as any).status = 403;
        (err as any).errorCode = 'ACCOUNT_PENDING';
        return;
        // throw err;
      }
      const err = new Error('Account is inactive');
      (err as any).status = 403;
      (err as any).errorCode = 'ACCOUNT_INACTIVE';
      throw err;
    }

    // Return token without resetting OTP for testing scalability
    return this.genToken(user);
  };

  public registerClient = async (fullname: string, mobile: string) => {
    const repo = dataSource.getRepository(User);
    const existing = await repo.findOneBy({ mobile });
    if (existing) {
      const err = new Error('Phone number already registered');
      (err as any).status = 400;
      (err as any).errorCode = 'USER_EXISTS';
      throw err;
    }

    const user = new User();
    user.fullname = fullname;
    user.mobile = mobile;
    user.role = 'client';
    user.status = 'ACTIVE';
    await user.save();

    await this.sendOtp(mobile);
    return { message: 'Registration successful' };
  };

  private genToken = (user: User): { token: string; expiresAt: string; user: any } => {
    const expires = moment().utc().add({ minutes: 60 * 24 * 7 }).unix();
    const token = jwt.encode(
      {
        exp: expires,
        user: user.id,
      },
      process.env.JWT_SECRET as string,
    );

    return {
      token: `${token}`,
      expiresAt: moment.unix(expires).utc().toISOString(),
      user: {
        id: user.id,
        mobile: user.mobile,
        role: user.role,
        name: user.fullname,
        // add other user fields if needed
      }
    };
  };
}

export default new Auth();
