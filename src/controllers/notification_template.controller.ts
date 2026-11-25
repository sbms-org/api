import { NextFunction, Request, Response } from 'express';
import { dataSource } from '../configurations/db.config';
import { NotificationTemplate } from '../Entities/notification_template';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { UUID } from 'crypto';

export class NotificationTemplateController {
    async getTemplates(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = dataSource.getRepository(NotificationTemplate);
            const templates = await repo.find({ order: { created_at: 'DESC' } });
            return ApiResponse.success(res, templates);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    }

    async getTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as UUID;
            const repo = dataSource.getRepository(NotificationTemplate);
            const template = await repo.findOneBy({ id });
            if (!template) return ApiResponse.error(res, 'Template not found', 404);
            return ApiResponse.success(res, template);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    }

    async createTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const { template_key, title, message_template, target_role, is_active } = req.body;
            const repo = dataSource.getRepository(NotificationTemplate);

            const existing = await repo.findOneBy({ template_key });
            if (existing) return ApiResponse.error(res, 'Template key already exists', 400);

            const template = repo.create({
                template_key,
                title,
                message_template,
                target_role,
                is_active: is_active ?? true
            });

            await repo.save(template);
            return ApiResponse.success(res, template, 'Template created', 201);
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    }

    async updateTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as UUID;
            const { title, message_template, target_role, is_active } = req.body;
            const repo = dataSource.getRepository(NotificationTemplate);

            const template = await repo.findOneBy({ id });
            if (!template) return ApiResponse.error(res, 'Template not found', 404);

            if (title) template.title = title;
            if (message_template) template.message_template = message_template;
            if (target_role !== undefined) template.target_role = target_role;
            if (is_active !== undefined) template.is_active = is_active;

            await repo.save(template);
            return ApiResponse.success(res, template, 'Template updated');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    }

    async deleteTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as UUID;
            const repo = dataSource.getRepository(NotificationTemplate);

            const result = await repo.delete(id);
            if (result.affected === 0) return ApiResponse.error(res, 'Template not found', 404);

            return ApiResponse.success(res, null, 'Template deleted');
        } catch (error) {
            logger.error(error);
            return next(error);
        }
    }
}
