import express, { ErrorRequestHandler } from 'express'
import request from 'supertest'
import DemoRouter from './demo.routes'

process.env.SBMS_DEMO_MODE = 'always'
process.env.JWT_SECRET = 'sbms-demo-test-secret'

const app = express()
app.use(express.json())
app.use(DemoRouter)
const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error.status ?? 500).json({ message: error.message })
}
app.use(handleError)

describe('SBMS JSON demo API', () => {
  it('serves nearby verified providers and identifies fixture responses', async () => {
    const response = await request(app)
      .get('/providers/nearby')
      .query({ latitude: 9.02, longitude: 38.75, radiusKm: 25 })

    expect(response.status).toBe(200)
    expect(response.headers['x-sbms-data-source']).toBe('demo')
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '20000000-0000-4000-8000-000000000001' }),
    ]))
  })

  it('scopes bookings by authenticated user and protects admin records', async () => {
    const clientLogin = await request(app)
      .post('/auth/verify-otp')
      .send({ mobile: '+251911000001', otp: '123456' })
    const clientToken = clientLogin.body.data.token as string

    const clientBookings = await request(app)
      .get('/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
    expect(clientBookings.status).toBe(200)
    expect(clientBookings.body.data).toHaveLength(2)
    expect(clientBookings.body.data.every((booking: { clientId: string }) =>
      booking.clientId === '10000000-0000-4000-8000-000000000001')).toBe(true)

    const forbidden = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${clientToken}`)
    expect(forbidden.status).toBe(403)

    const adminLogin = await request(app)
      .post('/auth/verify-otp')
      .send({ mobile: '+251911000006', otp: '123456' })
    const adminUsers = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminLogin.body.data.token as string}`)
    expect(adminUsers.status).toBe(200)
    expect(adminUsers.body.data).toHaveLength(9)
  })
})
