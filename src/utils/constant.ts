export const CONSTANT = {
  USER_EXISTS: 'Mobile already registered',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  MOBILE_NOT_REGISTERED: 'This mobile number does not exist.',
  INCORRECT_OTP: 'Incorrect OTP code. Try again.',
}

export enum HttpStatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  INTERNAL_SERVER = 500,
}
