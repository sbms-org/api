import { Payment } from '../Entities/payment';
import { TenantAssignment } from '../Entities/tenant_assignment';

export class PaymentService {
  static async markPaidAndExtend(paymentId: string) {
    const payment = await Payment.findOne({ where: { id: paymentId } as any });
    if (!payment) throw new Error('Payment not found');

    payment.status = 'paid';
    payment.paid_date = new Date();
    await payment.save();

    // find latest active assignment for tenant & unit
    const assignment = await TenantAssignment.findOne({
      where: { tenant_id: payment.tenant_id, unit_id: payment.unit_id, active: true } as any,
      order: { start_date: 'DESC' },
    });

    if (!assignment) return payment;

    // extend end_date by payment_cycle_months
    const currentEnd = new Date(assignment.end_date);
    currentEnd.setMonth(currentEnd.getMonth() + (assignment.payment_cycle_months || 0));
    assignment.end_date = currentEnd;
    await assignment.save();

    return payment;
  }
}
