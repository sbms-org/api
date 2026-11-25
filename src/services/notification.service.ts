import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Notification } from '../Entities/notification';
import { NotificationTemplate } from '../Entities/notification_template';
import { User } from '../Entities/user';
import { UUID } from 'crypto';

export class NotificationService {
    private static instance: NotificationService;
    private notificationRepository: Repository<Notification>;
    private templateRepository: Repository<NotificationTemplate>;
    private userRepository: Repository<User>;

    private constructor() {
        this.notificationRepository = dataSource.getRepository(Notification);
        this.templateRepository = dataSource.getRepository(NotificationTemplate);
        this.userRepository = dataSource.getRepository(User);
    }

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    async sendNotification(
        userId: UUID,
        title: string,
        message: string,
        type: string = 'general',
        relatedEntityType?: string,
        relatedEntityId?: string
    ): Promise<Notification> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) throw new Error('User not found');

        const notification = this.notificationRepository.create({
            title,
            message,
            type: type as any,
            user,
            related_entity_type: relatedEntityType,
            related_entity_id: relatedEntityId,
        });

        return await this.notificationRepository.save(notification);
    }

    async sendFromTemplate(
        userId: UUID,
        templateKey: string,
        variables: Record<string, string>,
        relatedEntityType?: string,
        relatedEntityId?: string
    ): Promise<Notification> {
        const template = await this.templateRepository.findOne({
            where: { template_key: templateKey as any, is_active: true }
        });

        if (!template) throw new Error(`Template ${templateKey} not found`);

        let title = template.title;
        let message = template.message_template;

        Object.entries(variables).forEach(([key, value]) => {
            title = title.replace(new RegExp(`{{${key}}}`, 'g'), value);
            message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        return await this.sendNotification(
            userId,
            title,
            message,
            'payment_due',
            relatedEntityType,
            relatedEntityId
        );
    }

    async getUserNotifications(userId: UUID, limit = 50): Promise<Notification[]> {
        return await this.notificationRepository.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
            take: limit
        });
    }

    async markAsRead(notificationId: UUID): Promise<void> {
        await this.notificationRepository.update(notificationId, { is_read: true });
    }

    async markAllAsRead(userId: UUID): Promise<void> {
        await this.notificationRepository.update({ user_id: userId }, { is_read: true });
    }

    /**
     * Notify the owner of a building AND all active property managers assigned to it.
     * Useful for tenant/payment events so PMs stay in the loop.
     */
    async notifyBuildingManagers(
        buildingId: string,
        ownerId: UUID,
        title: string,
        message: string,
        type: string = 'general',
        relatedEntityType?: string,
        relatedEntityId?: string
    ): Promise<void> {
        const { BuildingManagement } = await import('../Entities/building_management');
        const managementRepo = dataSource.getRepository(BuildingManagement);

        const assignments = await managementRepo.find({
            where: { building_id: buildingId as UUID, is_active: true }
        });

        const userIds = new Set<string>([ownerId]);
        assignments.forEach(a => userIds.add(a.manager_id));

        for (const userId of userIds) {
            try {
                await this.sendNotification(
                    userId as UUID,
                    title,
                    message,
                    type,
                    relatedEntityType,
                    relatedEntityId
                );
            } catch (e) {
                // Don't fail entire flow if one notification fails
            }
        }
    }
}

export const notificationService = NotificationService.getInstance();
