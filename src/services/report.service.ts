import { dataSource } from '../configurations/db.config';
import { Unit } from '../Entities/unit';
import { Payment } from '../Entities/payment';
import { UUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import moment from 'moment';
import { In, LessThan } from 'typeorm';
import logger from '../configurations/logger';

export class ReportService {
    async exportCompositeReport(
        buildingIds: UUID[],
        res: Response,
        format: 'pdf' | 'excel',
        types: string[], // ['income', 'overdue', 'occupancy']
        options: {
            startDate?: string;
            endDate?: string;
            floor?: number;
            unitId?: UUID;
        } = {}
    ): Promise<void> {
        try {
            if (buildingIds.length === 0) {
                res.status(404).json({ success: false, message: 'No buildings found' });
                return;
            }

            const start = options.startDate ? new Date(options.startDate) : undefined;
            const end = options.endDate ? new Date(options.endDate) : undefined;

            if (format === 'excel') {
                const workbook = new ExcelJS.Workbook();

                if (types.includes('income')) {
                    await this.addIncomeSheet(workbook, buildingIds, start, end, options.floor, options.unitId);
                }
                if (types.includes('overdue')) {
                    await this.addOverdueSheet(workbook, buildingIds, options.floor, options.unitId);
                }
                if (types.includes('occupancy')) {
                    await this.addOccupancySheet(workbook, buildingIds);
                }

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename=report_${moment().format('YYYYMMDD')}.xlsx`);
                await workbook.xlsx.write(res);
                res.end();
            } else {
                const doc = new PDFDocument({ margin: 50, autoFirstPage: false });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=report_${moment().format('YYYYMMDD')}.pdf`);
                doc.pipe(res);

                if (types.includes('income')) {
                    await this.addIncomeSection(doc, buildingIds, start, end, options.floor, options.unitId);
                }
                if (types.includes('overdue')) {
                    await this.addOverdueSection(doc, buildingIds, options.floor, options.unitId);
                }
                if (types.includes('occupancy')) {
                    await this.addOccupancySection(doc, buildingIds);
                }

                doc.end();
            }
        } catch (error) {
            logger.error('Report generation error:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Failed to generate report' });
            }
        }
    }

    private async addIncomeSheet(workbook: ExcelJS.Workbook, buildingIds: UUID[], start?: Date, end?: Date, floor?: number, unitId?: UUID) {
        const query = dataSource.getRepository(Payment).createQueryBuilder('p')
            .leftJoinAndSelect('p.unit', 'unit')
            .leftJoinAndSelect('unit.building', 'building')
            .leftJoinAndSelect('p.tenant', 'tenant')
            .where('unit.building_id IN (:...buildingIds)', { buildingIds });

        if (start) query.andWhere('p.due_date >= :start', { start });
        if (end) query.andWhere('p.due_date <= :end', { end });
        if (floor !== undefined) query.andWhere('unit.floor = :floor', { floor });
        if (unitId) query.andWhere('unit.id = :unitId', { unitId });

        const payments = await query.getMany();
        const sheet = workbook.addWorksheet('Income Report');
        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Building', key: 'building', width: 25 },
            { header: 'Unit', key: 'unit', width: 10 },
            { header: 'Tenant', key: 'tenant', width: 25 },
            { header: 'Amount (ETB)', key: 'amount', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        payments.forEach(p => {
            sheet.addRow({
                date: moment(p.paid_date || p.due_date).format('YYYY-MM-DD'),
                building: p.unit?.building?.name || 'N/A',
                unit: p.unit?.unit_number || 'N/A',
                tenant: p.tenant?.fullname || 'N/A',
                amount: p.amount,
                status: p.status,
            });
        });

        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        sheet.addRow({});
        const totalRow = sheet.addRow({ tenant: 'TOTAL REVENUE', amount: total });
        totalRow.font = { bold: true };
    }

    private async addOverdueSheet(workbook: ExcelJS.Workbook, buildingIds: UUID[], floor?: number, unitId?: UUID) {
        const where: any = { building_id: In(buildingIds), status: 'occupied', next_rent_due_date: LessThan(new Date()) };
        if (floor !== undefined) where.floor = floor;
        if (unitId) where.id = unitId;

        const overdueUnits = await dataSource.getRepository(Unit).find({ where, relations: ['building', 'tenant'] });
        const sheet = workbook.addWorksheet('Overdue Report');
        sheet.columns = [
            { header: 'Building', key: 'building', width: 25 },
            { header: 'Unit', key: 'unit', width: 10 },
            { header: 'Tenant', key: 'tenant', width: 25 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
            { header: 'Amount Due (ETB)', key: 'amount', width: 15 },
        ];

        overdueUnits.forEach(u => {
            sheet.addRow({
                building: u.building?.name,
                unit: u.unit_number,
                tenant: u.tenant?.fullname || 'N/A',
                dueDate: moment(u.next_rent_due_date).format('YYYY-MM-DD'),
                amount: u.rent_amount,
            });
        });
    }

    private async addOccupancySheet(workbook: ExcelJS.Workbook, buildingIds: UUID[]) {
        const units = await dataSource.getRepository(Unit).find({ where: { building_id: In(buildingIds) }, relations: ['building'] });
        const sheet = workbook.addWorksheet('Occupancy Report');
        sheet.columns = [
            { header: 'Building', key: 'building', width: 25 },
            { header: 'Unit', key: 'unit', width: 10 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Rent Amount', key: 'rent', width: 15 },
        ];

        units.forEach(u => {
            sheet.addRow({
                building: u.building?.name,
                unit: u.unit_number,
                status: u.status,
                rent: u.rent_amount,
            });
        });
    }

    private async addIncomeSection(doc: typeof PDFDocument, buildingIds: UUID[], start?: Date, end?: Date, floor?: number, unitId?: UUID) {
        const query = dataSource.getRepository(Payment).createQueryBuilder('p')
            .leftJoinAndSelect('p.unit', 'unit')
            .leftJoinAndSelect('unit.building', 'building')
            .leftJoinAndSelect('p.tenant', 'tenant')
            .where('unit.building_id IN (:...buildingIds)', { buildingIds });

        if (start) query.andWhere('p.due_date >= :start', { start });
        if (end) query.andWhere('p.due_date <= :end', { end });
        if (floor !== undefined) query.andWhere('unit.floor = :floor', { floor });
        if (unitId) query.andWhere('unit.id = :unitId', { unitId });

        const payments = await query.getMany();
        doc.addPage();
        doc.fontSize(20).text('Income Report', { align: 'center' });
        doc.fontSize(10).text(`Period: ${start ? moment(start).format('LL') : 'All Time'} - ${end ? moment(end).format('LL') : 'Present'}`, { align: 'center' });
        doc.moveDown();

        let y = 150;
        doc.font('Helvetica-Bold');
        doc.text('Date', 50, y);
        doc.text('Unit', 150, y);
        doc.text('Tenant', 250, y);
        doc.text('Amount', 450, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();

        y += 25;
        doc.font('Helvetica');
        payments.forEach(p => {
            if (y > 700) { doc.addPage(); y = 50; }
            doc.text(moment(p.paid_date || p.due_date).format('YY-MM-DD'), 50, y);
            doc.text(`${p.unit?.building?.name || ''} - ${p.unit?.unit_number || 'N/A'}`, 150, y, { width: 90 });
            doc.text(p.tenant?.fullname || 'N/A', 250, y, { width: 180 });
            doc.text(p.amount.toString(), 450, y);
            y += 20;
        });

        const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        doc.font('Helvetica-Bold').text(`TOTAL: ETB ${total}`, 400, y + 20);
    }

    private async addOverdueSection(doc: typeof PDFDocument, buildingIds: UUID[], floor?: number, unitId?: UUID) {
        const where: any = { building_id: In(buildingIds), status: 'occupied', next_rent_due_date: LessThan(new Date()) };
        if (floor !== undefined) where.floor = floor;
        if (unitId) where.id = unitId;

        const overdueUnits = await dataSource.getRepository(Unit).find({ where, relations: ['building', 'tenant'] });
        doc.addPage();
        doc.fontSize(20).text('Overdue Report', { align: 'center' });
        doc.moveDown();

        let y = 150;
        doc.font('Helvetica-Bold');
        doc.text('Unit', 50, y);
        doc.text('Tenant', 150, y);
        doc.text('Due Date', 350, y);
        doc.text('Amount', 450, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();

        y += 25;
        doc.font('Helvetica');
        overdueUnits.forEach(u => {
            if (y > 700) { doc.addPage(); y = 50; }
            doc.text(`${u.building?.name} - ${u.unit_number}`, 50, y, { width: 90 });
            doc.text(u.tenant?.fullname || 'N/A', 150, y, { width: 180 });
            doc.text(moment(u.next_rent_due_date).format('YY-MM-DD'), 350, y);
            doc.text(u.rent_amount?.toString() || '0', 450, y);
            y += 20;
        });
    }

    private async addOccupancySection(doc: typeof PDFDocument, buildingIds: UUID[]) {
        const units = await dataSource.getRepository(Unit).find({ where: { building_id: In(buildingIds) }, relations: ['building'] });
        doc.addPage();
        doc.fontSize(20).text('Occupancy Report', { align: 'center' });
        doc.moveDown();

        const occupied = units.filter(u => u.status === 'occupied').length;
        doc.fontSize(12).text(`Total Units: ${units.length}`);
        doc.text(`Occupied: ${occupied} (${units.length > 0 ? Math.round((occupied / units.length) * 100) : 0}%)`);
        doc.text(`Vacant: ${units.length - occupied}`);
        doc.moveDown();

        let y = 200;
        doc.font('Helvetica-Bold');
        doc.text('Building', 50, y);
        doc.text('Unit', 150, y);
        doc.text('Status', 250, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();

        y += 25;
        doc.font('Helvetica');
        units.forEach(u => {
            if (y > 700) { doc.addPage(); y = 50; }
            doc.text(u.building?.name || 'N/A', 50, y, { width: 90 });
            doc.text(u.unit_number, 150, y);
            doc.text(u.status, 250, y);
            y += 20;
        });
    }

    // Keep legacy single-export methods for compatibility but refactor them to use the helpers
    async exportIncomeReport(buildingIds: UUID[], res: Response, format: 'pdf' | 'excel', options: any = {}) {
        return this.exportCompositeReport(buildingIds, res, format, ['income'], options);
    }

    async exportOverdueReport(buildingIds: UUID[], res: Response, format: 'pdf' | 'excel', options: any = {}) {
        return this.exportCompositeReport(buildingIds, res, format, ['overdue'], options);
    }
}
